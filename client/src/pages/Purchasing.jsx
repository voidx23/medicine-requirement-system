import { useState, useEffect, useContext, useMemo } from 'react';
import { ShoppingCart, Plus, ClipboardList, RotateCw, AlertTriangle, Eye, CheckSquare, Trash2, Calendar, FileText, Search, Sparkles } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import AuthContext from '../context/AuthContext';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';
import { TableRowSkeleton } from '../components/UI/Skeleton';

const Purchasing = () => {
    const { showConfirm, showToast } = useNotification();
    const { user } = useContext(AuthContext);

    // Permissions Gating
    const canCreate = user?.isSuperAdmin || user?.permissions?.includes('create_purchase_orders');
    const canReceive = user?.isSuperAdmin || user?.permissions?.includes('receive_purchase_orders');

    // State Variables
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    
    // Filters
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterSupplier, setFilterSupplier] = useState('all');

    // Create PO Modal state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [poSupplierId, setPoSupplierId] = useState('');
    const [poItems, setPoItems] = useState([]);
    const [poNotes, setPoNotes] = useState('');
    const [poStatus, setPoStatus] = useState('draft'); // draft or ordered
    const [isSaving, setIsSaving] = useState(false);
    
    // Medicine Search state inside Creator
    const [medSearchQuery, setMedSearchQuery] = useState('');
    const [medResults, setMedResults] = useState([]);
    const [isSearchingMed, setIsSearchingMed] = useState(false);

    // View & Receive PO Modal state
    const [selectedPO, setSelectedPO] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [receiveQuantities, setReceiveQuantities] = useState({}); // { itemId: quantity }
    const [isReceiving, setIsReceiving] = useState(false);

    // Suggestions Modal state
    const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);

    // Fetch Data on Load
    const fetchData = async () => {
        setLoading(true);
        try {
            const [poRes, supplierRes] = await Promise.all([
                api.get('/purchasing'),
                api.get('/suppliers?limit=all')
            ]);
            setPurchaseOrders(poRes.data);
            setSuppliers(supplierRes.data.suppliers || supplierRes.data || []);
        } catch (error) {
            console.error('Failed to load purchasing data', error);
            showToast('Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchSuggestions = async () => {
        setSuggestionsLoading(true);
        try {
            const { data } = await api.get('/purchasing/suggestions');
            setSuggestions(data);
        } catch (error) {
            console.error('Failed to load purchase suggestions', error);
            showToast('Failed to load suggestions', 'error');
        } finally {
            setSuggestionsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Search Medicines by Query and Supplier
    useEffect(() => {
        if (!poSupplierId) {
            setMedResults([]);
            return;
        }

        const delayDebounce = setTimeout(async () => {
            if (medSearchQuery.trim().length < 2) {
                setMedResults([]);
                return;
            }
            setIsSearchingMed(true);
            try {
                // Fetch medicines belonging to the selected supplier or match search query
                const { data } = await api.get(`/medicines?search=${encodeURIComponent(medSearchQuery)}&limit=50`);
                // Filter client side to make sure they belong to the selected supplier
                const filtered = (data.medicines || []).filter(m => m.supplierId?._id === poSupplierId || m.supplierId === poSupplierId);
                setMedResults(filtered);
            } catch (error) {
                console.error(error);
            } finally {
                setIsSearchingMed(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounce);
    }, [medSearchQuery, poSupplierId]);

    // Handle suggestions click
    const handleOpenSuggestions = () => {
        fetchSuggestions();
        setShowSuggestionsModal(true);
    };

    // Apply Suggestion for a specific supplier
    const handleApplySuggestion = (sug) => {
        setPoSupplierId(sug.supplier._id);
        const items = sug.items.map(it => ({
            medicineId: it.medicineId,
            name: it.name,
            barcode: it.barcode,
            quantityOrdered: it.suggestedQuantity,
            costPrice: it.costPrice,
            unitsPerBox: it.unitsPerBox
        }));
        setPoItems(items);
        setPoNotes('Auto-generated from daily requirement list suggestions.');
        setPoStatus('draft');
        setShowSuggestionsModal(false);
        setShowCreateModal(true);
    };

    // Add Item to Current PO
    const handleAddMedicine = (med) => {
        const exists = poItems.find(item => item.medicineId === med._id);
        if (exists) {
            showToast(`${med.name} is already added.`, 'warning');
            return;
        }
        setPoItems(prev => [
            ...prev,
            {
                medicineId: med._id,
                name: med.name,
                barcode: med.barcode,
                quantityOrdered: 1,
                costPrice: med.costPrice || 0,
                unitsPerBox: med.unitsPerBox || 1
            }
        ]);
        setMedSearchQuery('');
        setMedResults([]);
    };

    const handleRemovePOItem = (medId) => {
        setPoItems(prev => prev.filter(item => item.medicineId !== medId));
    };

    const handleUpdatePOItemQty = (medId, qty) => {
        setPoItems(prev => prev.map(item => 
            item.medicineId === medId ? { ...item, quantityOrdered: Math.max(1, Number(qty) || 1) } : item
        ));
    };

    const handleUpdatePOItemPrice = (medId, price) => {
        setPoItems(prev => prev.map(item => 
            item.medicineId === medId ? { ...item, costPrice: Math.max(0, Number(price) || 0) } : item
        ));
    };

    // Submit New Purchase Order
    const handleSubmitPO = async (e) => {
        e.preventDefault();
        if (!poSupplierId) {
            showToast('Please select a supplier', 'error');
            return;
        }
        if (poItems.length === 0) {
            showToast('Please add at least one medicine', 'error');
            return;
        }

        setIsSaving(true);
        try {
            await api.post('/purchasing', {
                supplierId: poSupplierId,
                items: poItems,
                notes: poNotes,
                status: poStatus
            });
            showToast(`Purchase Order created successfully as ${poStatus}`, 'success');
            setShowCreateModal(false);
            // Reset form
            setPoSupplierId('');
            setPoItems([]);
            setPoNotes('');
            setPoStatus('draft');
            fetchData();
        } catch (error) {
            console.error(error);
            showToast(error.response?.data?.message || 'Failed to create PO', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Open PO Details / Receiving Screen
    const handleOpenPODetails = async (poId) => {
        try {
            const { data } = await api.get(`/purchasing/${poId}`);
            setSelectedPO(data);
            
            // Pre-fill receive quantities with their current values
            const qties = {};
            data.items.forEach(item => {
                qties[item._id] = item.quantityReceived || 0;
            });
            setReceiveQuantities(qties);
            setShowDetailModal(true);
        } catch (error) {
            console.error(error);
            showToast('Failed to load PO details', 'error');
        }
    };

    // Handle PO Cancel
    const handleCancelPO = (poId) => {
        showConfirm({
            title: 'Cancel Purchase Order?',
            message: 'Are you sure you want to cancel this Purchase Order? This action is irreversible.',
            type: 'danger',
            onConfirm: async () => {
                try {
                    await api.put(`/purchasing/${poId}`, { status: 'cancelled' });
                    showToast('Purchase Order cancelled successfully', 'success');
                    setShowDetailModal(false);
                    fetchData();
                } catch (error) {
                    console.error(error);
                    showToast('Failed to cancel PO', 'error');
                }
            }
        });
    };

    // Update PO Status (e.g. Draft -> Ordered)
    const handleSendPO = async (poId) => {
        try {
            await api.put(`/purchasing/${poId}`, { status: 'ordered' });
            showToast('Purchase Order marked as Ordered!', 'success');
            setShowDetailModal(false);
            fetchData();
        } catch (error) {
            console.error(error);
            showToast('Failed to update PO status', 'error');
        }
    };

    // Submit Received Quantities
    const handleReceivePOItems = async () => {
        setIsReceiving(true);
        try {
            const itemsPayload = Object.keys(receiveQuantities).map(itemId => ({
                _id: itemId,
                quantityReceived: Number(receiveQuantities[itemId]) || 0
            }));

            const { data } = await api.put(`/purchasing/${selectedPO._id}/receive`, {
                items: itemsPayload
            });

            showToast(`Shipment received. PO Status is now: ${data.status.toUpperCase()}`, 'success');
            setShowDetailModal(false);
            fetchData();
        } catch (error) {
            console.error(error);
            showToast('Failed to submit receipt', 'error');
        } finally {
            setIsReceiving(false);
        }
    };

    // Compute stats
    const stats = useMemo(() => {
        let active = 0;
        let draft = 0;
        let completed = 0;
        let spend = 0;

        purchaseOrders.forEach(po => {
            if (po.status === 'ordered' || po.status === 'partially_received') active++;
            if (po.status === 'draft') draft++;
            if (po.status === 'received') completed++;
            if (po.status !== 'cancelled') spend += po.totalAmount || 0;
        });

        return { active, draft, completed, spend };
    }, [purchaseOrders]);

    // Filter POs
    const filteredPOs = useMemo(() => {
        return purchaseOrders.filter(po => {
            const matchesStatus = filterStatus === 'all' || po.status === filterStatus;
            const matchesSupplier = filterSupplier === 'all' || po.supplierId?._id === filterSupplier;
            return matchesStatus && matchesSupplier;
        });
    }, [purchaseOrders, filterStatus, filterSupplier]);

    const getStatusStyle = (status) => {
        switch (status) {
            case 'draft': return { bg: '#f3f4f6', text: '#374151' }; // Gray
            case 'ordered': return { bg: '#dbeafe', text: '#1e40af' }; // Blue
            case 'partially_received': return { bg: '#fef3c7', text: '#d97706' }; // Amber
            case 'received': return { bg: '#dcfce7', text: '#15803d' }; // Green
            case 'cancelled': return { bg: '#fee2e2', text: '#991b1b' }; // Red
            default: return { bg: '#f3f4f6', text: '#374151' };
        }
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'OMR' }).format(val || 0);
    };

    return (
        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title" style={{ margin: 0, fontSize: '2.2rem', fontWeight: 800 }}>Purchasing Management</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Create, verify, and receive supplier purchase orders.</p>
                </div>
                
                <div style={{ display: 'flex', gap: '1rem' }}>
                    {canCreate && (
                        <Button 
                            variant="secondary" 
                            onClick={handleOpenSuggestions}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <Sparkles size={16} />
                            Requirement Suggestions
                        </Button>
                    )}
                    {canCreate && (
                        <Button 
                            variant="primary" 
                            onClick={() => setShowCreateModal(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <Plus size={16} />
                            Create PO
                        </Button>
                    )}
                </div>
            </div>

            {/* Overview Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>Active Orders</span>
                    <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)' }}>{stats.active}</span>
                </div>
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>Draft Tenders</span>
                    <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#6b7280' }}>{stats.draft}</span>
                </div>
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>Fully Received POs</span>
                    <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--success)' }}>{stats.completed}</span>
                </div>
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>Total Order Value</span>
                    <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)' }}>{formatCurrency(stats.spend)}</span>
                </div>
            </div>

            {/* Filters panel */}
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>Status:</span>
                    <select 
                        value={filterStatus} 
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="input-field" 
                        style={{ padding: '0.4rem 2rem 0.4rem 0.8rem', width: '180px' }}
                    >
                        <option value="all">All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="ordered">Ordered</option>
                        <option value="partially_received">Partially Received</option>
                        <option value="received">Received</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>Supplier:</span>
                    <select 
                        value={filterSupplier} 
                        onChange={(e) => setFilterSupplier(e.target.value)}
                        className="input-field" 
                        style={{ padding: '0.4rem 2rem 0.4rem 0.8rem', width: '220px' }}
                    >
                        <option value="all">All Suppliers</option>
                        {suppliers.map(s => (
                            <option key={s._id} value={s._id}>{s.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Orders list table */}
            <div className="glass-panel" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            <th style={{ padding: '1rem' }}>PO Number</th>
                            <th style={{ padding: '1rem' }}>Supplier</th>
                            <th style={{ padding: '1rem' }}>Order Date</th>
                            <th style={{ padding: '1rem' }}>Items</th>
                            <th style={{ padding: '1rem' }}>Total Amount</th>
                            <th style={{ padding: '1rem' }}>Status</th>
                            <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <TableRowSkeleton cols={7} rows={5} />
                        ) : filteredPOs.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    <ClipboardList size={40} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
                                    No purchase orders found matching the filter criteria.
                                </td>
                            </tr>
                        ) : (
                            filteredPOs.map((po) => {
                                const styles = getStatusStyle(po.status);
                                return (
                                    <tr key={po._id} style={{ borderBottom: '1px solid var(--glass-border)', fontSize: '0.95rem' }} className="table-row-hover">
                                        <td style={{ padding: '1rem', fontWeight: 'bold' }}>{po.poNumber}</td>
                                        <td style={{ padding: '1rem' }}>{po.supplierId?.name || 'Unknown'}</td>
                                        <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                                            {po.orderedAt ? new Date(po.orderedAt).toLocaleDateString() : 'N/A (Draft)'}
                                        </td>
                                        <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                                            {po.items?.length || 0} {po.items?.length === 1 ? 'item' : 'items'}
                                        </td>
                                        <td style={{ padding: '1rem', fontWeight: 600 }}>{formatCurrency(po.totalAmount)}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{ 
                                                fontSize: '0.78rem', fontWeight: 700, padding: '0.25rem 0.6rem', 
                                                borderRadius: '12px', background: styles.bg, color: styles.text,
                                                letterSpacing: '0.5px', textTransform: 'uppercase'
                                            }}>
                                                {po.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            <Button 
                                                variant="secondary" 
                                                size="sm" 
                                                onClick={() => handleOpenPODetails(po._id)}
                                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                                            >
                                                <Eye size={14} style={{ marginRight: '0.25rem' }} />
                                                View / Receive
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Suggestions Modal */}
            <Modal
                isOpen={showSuggestionsModal}
                onClose={() => setShowSuggestionsModal(false)}
                title="⚙️ Purchasing Recommendations"
                width="750px"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>
                        These recommendations are grouped by supplier, based on today's **Daily Requirement List** and open pharmacist orders that need stock.
                    </p>

                    {suggestionsLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                            <RotateCw className="spin" size={32} color="var(--primary)" />
                        </div>
                    ) : suggestions.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Sparkles size={40} style={{ margin: '0 auto 1rem auto', opacity: 0.5, color: 'var(--primary)' }} />
                            All requirements are currently fulfilled or there are no requirements registered for today.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxH: '450px', overflowY: 'auto' }}>
                            {suggestions.map((sug, idx) => (
                                <div key={idx} className="glass-panel" style={{ padding: '1.25rem', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{sug.supplier.name}</h3>
                                        <Button 
                                            variant="primary" 
                                            size="sm" 
                                            onClick={() => handleApplySuggestion(sug)}
                                        >
                                            Generate Draft PO
                                        </Button>
                                    </div>
                                    <table style={{ width: '100%', fontSize: '0.88rem' }}>
                                        <thead>
                                            <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--glass-border)' }}>
                                                <th style={{ padding: '0.4rem 0', textAlign: 'left' }}>Medicine</th>
                                                <th style={{ padding: '0.4rem 0', textAlign: 'center' }}>Branch Requests (Units)</th>
                                                <th style={{ padding: '0.4rem 0', textAlign: 'right' }}>Suggested Order (Boxes)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sug.items.map((it, iIdx) => (
                                                <tr key={iIdx} style={{ borderBottom: '1px solid rgba(0,0,0,0.02)' }}>
                                                    <td style={{ padding: '0.5rem 0' }}>{it.name}</td>
                                                    <td style={{ padding: '0.5rem 0', textAlign: 'center', fontWeight: 600 }}>{it.requiredQty}</td>
                                                    <td style={{ padding: '0.5rem 0', textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                                                        {it.suggestedQuantity} box(es) <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>({it.unitsPerBox} units/box)</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>

            {/* Create Purchase Order Modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="📝 New Purchase Order"
                width="800px"
            >
                <form onSubmit={handleSubmitPO} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: '0.4rem' }}>Supplier *</label>
                            <select
                                value={poSupplierId}
                                onChange={(e) => {
                                    setPoSupplierId(e.target.value);
                                    setPoItems([]); // Reset items if supplier changes
                                }}
                                className="input-field"
                                required
                                disabled={poItems.length > 0} // lock supplier if items are added
                            >
                                <option value="">Select Supplier</option>
                                {suppliers.map(s => (
                                    <option key={s._id} value={s._id}>{s.name}</option>
                                ))}
                            </select>
                            {poItems.length > 0 && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
                                    Remove all items to change supplier.
                                </span>
                            )}
                        </div>

                        <div>
                            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: '0.4rem' }}>Initial Status</label>
                            <select
                                value={poStatus}
                                onChange={(e) => setPoStatus(e.target.value)}
                                className="input-field"
                            >
                                <option value="draft">Save as Draft</option>
                                <option value="ordered">Save & Mark as Ordered</option>
                            </select>
                        </div>
                    </div>

                    {/* Medicine Search Section */}
                    {poSupplierId ? (
                        <div style={{ position: 'relative' }}>
                            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: '0.4rem' }}>
                                Search and Add Medicines (Filtered by Supplier)
                            </label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem' }} />
                                <input
                                    type="text"
                                    value={medSearchQuery}
                                    onChange={(e) => setMedSearchQuery(e.target.value)}
                                    placeholder="Type medicine name to search..."
                                    className="input-field"
                                    style={{ paddingLeft: '2.5rem' }}
                                />
                            </div>

                            {/* Dropdown Results list */}
                            {medResults.length > 0 && (
                                <div style={{ 
                                    position: 'absolute', left: 0, right: 0, zIndex: 100, 
                                    background: 'white', border: '1px solid var(--glass-border)',
                                    borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', 
                                    marginTop: '0.25rem', maxH: '200px', overflowY: 'auto'
                                }}>
                                    {medResults.map(med => (
                                        <div 
                                            key={med._id}
                                            onClick={() => handleAddMedicine(med)}
                                            style={{ 
                                                padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.02)',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                            }}
                                            className="table-row-hover"
                                        >
                                            <span style={{ fontWeight: 600 }}>{med.name}</span>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                Cost: {formatCurrency(med.costPrice)} • Box Size: {med.unitsPerBox}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {isSearchingMed && (
                                <div style={{ position: 'absolute', right: '1rem', top: '2.4rem' }}>
                                    <RotateCw className="spin" size={16} color="var(--primary)" />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center', background: '#fffbeb', border: '1px solid #fef3c7', color: '#b45309' }}>
                            <AlertTriangle size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }} />
                            Please select a supplier first to search and add medicines.
                        </div>
                    )}

                    {/* PO Items Table */}
                    {poItems.length > 0 && (
                        <div className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '0.75rem' }}>Medicine</th>
                                        <th style={{ padding: '0.75rem', width: '120px', textAlign: 'center' }}>Qty (Boxes)</th>
                                        <th style={{ padding: '0.75rem', width: '140px', textAlign: 'right' }}>Cost Price (OMR)</th>
                                        <th style={{ padding: '0.75rem', width: '140px', textAlign: 'right' }}>Total</th>
                                        <th style={{ padding: '0.75rem', width: '60px', textAlign: 'center' }}>Remove</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {poItems.map((item) => (
                                        <tr key={item.medicineId} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                            <td style={{ padding: '0.75rem' }}>
                                                <div style={{ fontWeight: 600 }}>{item.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Barcode: {item.barcode || 'N/A'}</div>
                                            </td>
                                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                <input
                                                    type="number"
                                                    value={item.quantityOrdered}
                                                    min="1"
                                                    onChange={(e) => handleUpdatePOItemQty(item.medicineId, e.target.value)}
                                                    className="input-field"
                                                    style={{ width: '70px', padding: '0.25rem', textAlign: 'center', margin: '0 auto' }}
                                                />
                                            </td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                                <input
                                                    type="number"
                                                    step="0.001"
                                                    value={item.costPrice}
                                                    min="0"
                                                    onChange={(e) => handleUpdatePOItemPrice(item.medicineId, e.target.value)}
                                                    className="input-field"
                                                    style={{ width: '90px', padding: '0.25rem', textAlign: 'right', marginLeft: 'auto' }}
                                                />
                                            </td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>
                                                {formatCurrency(item.quantityOrdered * item.costPrice)}
                                            </td>
                                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleRemovePOItem(item.medicineId)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    <tr style={{ background: 'rgba(99, 102, 241, 0.05)', fontWeight: 'bold' }}>
                                        <td colSpan="3" style={{ padding: '1rem', textAlign: 'right' }}>Estimated PO Total:</td>
                                        <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--primary)', fontSize: '1.05rem' }}>
                                            {formatCurrency(poItems.reduce((acc, it) => acc + (it.quantityOrdered * it.costPrice), 0))}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Notes field */}
                    <div>
                        <label className="form-label" style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: '0.4rem' }}>Notes / Remarks</label>
                        <textarea
                            value={poNotes}
                            onChange={(e) => setPoNotes(e.target.value)}
                            placeholder="Add delivery instructions, payment terms, or reference notes..."
                            className="input-field"
                            style={{ minHeight: '80px', resize: 'vertical' }}
                        />
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                        <Button variant="secondary" type="button" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                        <Button variant="primary" type="submit" disabled={isSaving}>
                            {isSaving ? <RotateCw className="spin" size={16} /> : 'Submit Purchase Order'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* View / Receive PO Details Modal */}
            <Modal
                isOpen={showDetailModal}
                onClose={() => setShowDetailModal(false)}
                title={selectedPO ? `📦 Purchase Order: ${selectedPO.poNumber}` : 'PO Details'}
                width="850px"
            >
                {selectedPO && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        
                        {/* PO Info Bar */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }} className="glass-panel">
                            <div>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Supplier</span>
                                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selectedPO.supplierId?.name}</div>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>CR No: {selectedPO.supplierId?.crNo || 'N/A'}</span>
                            </div>
                            <div>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status</span>
                                <div>
                                    <span style={{ 
                                        fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.5rem', 
                                        borderRadius: '10px', ...getStatusStyle(selectedPO.status)
                                    }}>
                                        {selectedPO.status.replace('_', ' ').toUpperCase()}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Order Placed</span>
                                <div style={{ fontWeight: 600 }}>{selectedPO.orderedAt ? new Date(selectedPO.orderedAt).toLocaleString() : 'Not Sent (Draft)'}</div>
                            </div>
                            <div>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Value</span>
                                <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(selectedPO.totalAmount)}</div>
                            </div>
                        </div>

                        {/* PO Notes */}
                        {selectedPO.notes && (
                            <div className="glass-panel" style={{ padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.01)', border: '1px solid var(--glass-border)' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Notes:</span>
                                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>{selectedPO.notes}</p>
                            </div>
                        )}

                        {/* Receiving Discrepancy Warnings */}
                        {selectedPO.status === 'partially_received' && (
                            <div className="glass-panel" style={{ padding: '0.75rem 1rem', background: '#fffbeb', border: '1px solid #fef3c7', color: '#b45309', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <AlertTriangle size={18} />
                                <span style={{ fontSize: '0.88rem', fontWeight: 550 }}>
                                    Some items ordered in this Purchase Order are still outstanding.
                                </span>
                            </div>
                        )}

                        {/* Items Checklist Table */}
                        <div className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '0.75rem' }}>Medicine</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Cost (OMR)</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Ordered (Boxes)</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Received (Boxes)</th>
                                        {(selectedPO.status === 'ordered' || selectedPO.status === 'partially_received') && canReceive && (
                                            <th style={{ padding: '0.75rem', width: '150px', textAlign: 'center', background: 'rgba(99, 102, 241, 0.05)' }}>
                                                Set Received Qty
                                            </th>
                                        )}
                                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total Cost</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedPO.items.map((item, idx) => {
                                        const totalItemCost = item.quantityOrdered * item.costPrice;
                                        const isLineDeficit = item.quantityReceived < item.quantityOrdered;
                                        const isLineCompleted = item.quantityReceived >= item.quantityOrdered;

                                        return (
                                            <tr 
                                                key={item._id} 
                                                style={{ 
                                                    borderBottom: '1px solid var(--glass-border)',
                                                    background: isLineCompleted && selectedPO.status !== 'received' ? 'rgba(34,197,94,0.04)' : 'transparent'
                                                }}
                                            >
                                                <td style={{ padding: '0.75rem' }}>
                                                    <div style={{ fontWeight: 600 }}>{item.medicineId?.name || 'Deleted Medicine'}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Barcode: {item.medicineId?.barcode || 'N/A'}</div>
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatCurrency(item.costPrice)}</td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>{item.quantityOrdered}</td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                    <span style={{ 
                                                        fontWeight: 700, 
                                                        color: isLineDeficit && selectedPO.status !== 'draft' && selectedPO.status !== 'cancelled' ? '#dc2626' : 'var(--text-main)' 
                                                    }}>
                                                        {item.quantityReceived}
                                                    </span>
                                                    {isLineCompleted && selectedPO.status !== 'draft' && selectedPO.status !== 'cancelled' && (
                                                        <span style={{ color: 'var(--success)', marginLeft: '0.35rem', fontSize: '0.8rem' }}>✓</span>
                                                    )}
                                                </td>

                                                {/* Receiving Input cells */}
                                                {(selectedPO.status === 'ordered' || selectedPO.status === 'partially_received') && canReceive && (
                                                    <td style={{ padding: '0.5rem', textAlign: 'center', background: 'rgba(99, 102, 241, 0.02)' }}>
                                                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center', alignItems: 'center' }}>
                                                            <input
                                                                type="number"
                                                                value={receiveQuantities[item._id] !== undefined ? receiveQuantities[item._id] : 0}
                                                                min="0"
                                                                max={item.quantityOrdered}
                                                                onChange={(e) => {
                                                                    const val = Math.min(item.quantityOrdered, Math.max(0, Number(e.target.value) || 0));
                                                                    setReceiveQuantities(prev => ({
                                                                        ...prev,
                                                                        [item._id]: val
                                                                    }));
                                                                }}
                                                                className="input-field"
                                                                style={{ width: '65px', padding: '0.2rem', textAlign: 'center' }}
                                                            />
                                                            <Button 
                                                                variant="secondary" 
                                                                onClick={() => {
                                                                    setReceiveQuantities(prev => ({
                                                                        ...prev,
                                                                        [item._id]: item.quantityOrdered
                                                                    }));
                                                                }}
                                                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                                                            >
                                                                All
                                                            </Button>
                                                        </div>
                                                    </td>
                                                )}

                                                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(totalItemCost)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Modal Action Footer buttons */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                            <div>
                                {selectedPO.status === 'draft' && canCreate && (
                                    <Button 
                                        variant="danger" 
                                        onClick={() => handleCancelPO(selectedPO._id)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                    >
                                        Delete Draft
                                    </Button>
                                )}
                                {selectedPO.status === 'ordered' && canCreate && (
                                    <Button 
                                        variant="danger" 
                                        onClick={() => handleCancelPO(selectedPO._id)}
                                    >
                                        Cancel PO
                                    </Button>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <Button variant="secondary" onClick={() => setShowDetailModal(false)}>Close</Button>
                                
                                {selectedPO.status === 'draft' && canCreate && (
                                    <Button variant="primary" onClick={() => handleSendPO(selectedPO._id)}>
                                        <ShoppingCart size={16} style={{ marginRight: '0.4rem' }} />
                                        Confirm & Place Order
                                    </Button>
                                )}

                                {(selectedPO.status === 'ordered' || selectedPO.status === 'partially_received') && canReceive && (
                                    <Button variant="primary" onClick={handleReceivePOItems} disabled={isReceiving}>
                                        {isReceiving ? <RotateCw className="spin" size={16} /> : 'Save Received Checklist'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Purchasing;
