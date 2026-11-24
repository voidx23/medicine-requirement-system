import { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { ShoppingCart, Plus, ClipboardList, RotateCw, AlertTriangle, Eye, Trash2, Search, ArrowLeft, Printer, Edit3 } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import AuthContext from '../context/AuthContext';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';
import { TableRowSkeleton } from '../components/UI/Skeleton';
import PrintableLPO from '../components/Purchasing/PrintableLPO';

const Purchasing = () => {
    const { showConfirm, showToast } = useNotification();
    const { user } = useContext(AuthContext);

    const canCreate = user?.isSuperAdmin || user?.permissions?.includes('create_purchase_orders');

    // LPO List State
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);

    // View & Filter State
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'create'
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterSupplier, setFilterSupplier] = useState('all');

    // Create / Edit LPO Form State
    const [editingPoId, setEditingPoId] = useState(null);
    const [poSupplierId, setPoSupplierId] = useState('');
    const [poSupplierType, setPoSupplierType] = useState('exclusive');
    const [poDivisionId, setPoDivisionId] = useState('');
    const [divisions, setDivisions] = useState([]);
    const [divisionsLoading, setDivisionsLoading] = useState(false);
    const [poItems, setPoItems] = useState([]);
    const [poNotes, setPoNotes] = useState('');
    const [poStatus, setPoStatus] = useState('draft'); // 'draft' | 'ordered'
    const [isSaving, setIsSaving] = useState(false);

    // Medicine Search & Selection State
    const [medSearchQuery, setMedSearchQuery] = useState('');
    const [availableMedicines, setAvailableMedicines] = useState([]);
    const [medicinesLoading, setMedicinesLoading] = useState(false);

    // Detail & Print Modal State
    const [selectedPO, setSelectedPO] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showPrintableModal, setShowPrintableModal] = useState(false);
    const [printablePo, setPrintablePo] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [poRes, supplierRes] = await Promise.all([
                api.get('/purchasing'),
                api.get('/suppliers?limit=all')
            ]);
            setPurchaseOrders(poRes.data);
            setSuppliers(supplierRes.data.suppliers || supplierRes.data || []);
        } catch (error) {
            console.error('Failed to load LPO data', error);
            showToast('Failed to load LPO data', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const resetCreateForm = useCallback(() => {
        setEditingPoId(null);
        setPoSupplierId('');
        setPoSupplierType('exclusive');
        setPoDivisionId('');
        setDivisions([]);
        setPoItems([]);
        setPoNotes('');
        setPoStatus('draft');
        setMedSearchQuery('');
        setAvailableMedicines([]);
    }, []);

    // Load supplier type & divisions whenever selected supplier changes
    useEffect(() => {
        if (!poSupplierId) {
            setDivisions([]);
            setPoDivisionId('');
            return;
        }

        const selectedSup = suppliers.find(s => s._id === poSupplierId);
        if (selectedSup) {
            setPoSupplierType(selectedSup.supplierType || 'exclusive');
        }

        let cancelled = false;
        const fetchDivisions = async () => {
            setDivisionsLoading(true);
            try {
                const { data } = await api.get(`/suppliers/${poSupplierId}/divisions`);
                if (cancelled) return;
                const list = Array.isArray(data) ? data : (data.divisions || []);
                setDivisions(list);
                setPoDivisionId(prev => (prev && list.some(d => d._id === prev) ? prev : ''));
            } catch (error) {
                if (!cancelled) {
                    console.error('Failed to load supplier divisions', error);
                    setDivisions([]);
                    setPoDivisionId('');
                }
            } finally {
                if (!cancelled) {
                    setDivisionsLoading(false);
                }
            }
        };

        fetchDivisions();
        return () => {
            cancelled = true;
        };
    }, [poSupplierId, suppliers]);

    // Fetch medicines for selection inside LPO builder
    useEffect(() => {
        if (viewMode !== 'create' || !poSupplierId) {
            setAvailableMedicines([]);
            return;
        }

        let cancelled = false;
        const trimmed = medSearchQuery.trim();
        const delayMs = trimmed ? 300 : 0;

        const timer = setTimeout(async () => {
            setMedicinesLoading(true);
            try {
                const params = new URLSearchParams();

                if (poSupplierType === 'multi' && trimmed.length >= 2) {
                    params.set('search', trimmed);
                    params.set('limit', '50');
                } else {
                    params.set('supplierId', poSupplierId);
                    if (poDivisionId) {
                        params.set('divisionId', poDivisionId);
                    }
                    if (trimmed) {
                        params.set('search', trimmed);
                    }
                    params.set('limit', '100');
                }

                const { data } = await api.get(`/medicines?${params.toString()}`);
                if (!cancelled) {
                    setAvailableMedicines(data.medicines || []);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('Failed to load medicines', error);
                }
            } finally {
                if (!cancelled) {
                    setMedicinesLoading(false);
                }
            }
        }, delayMs);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [viewMode, poSupplierId, poSupplierType, poDivisionId, medSearchQuery]);

    const handleStartCreate = () => {
        resetCreateForm();
        setViewMode('create');
    };

    const handleAddMedicine = (med) => {
        const exists = poItems.some(item => item.medicineId === med._id);
        if (exists) {
            showToast(`${med.name} is already added.`, 'warning');
            return;
        }

        setPoItems(prev => [
            ...prev,
            {
                medicineId: med._id,
                name: med.name,
                barcode: med.barcode || '',
                quantityOrdered: 1,
                costPrice: med.costPrice || 0,
                unitsPerBox: med.unitsPerBox || 1
            }
        ]);
        showToast(`Added ${med.name} to LPO`, 'success');
    };

    const handleRemovePOItem = (medId) => {
        setPoItems(prev => prev.filter(item => item.medicineId !== medId));
    };

    const handleUpdatePOItemQty = (medId, qty) => {
        setPoItems(prev => prev.map(item =>
            item.medicineId === medId ? { ...item, quantityOrdered: Math.max(1, Number(qty) || 1) } : item
        ));
    };

    const handleEditDraftPO = (po) => {
        setEditingPoId(po._id);
        setPoSupplierId(po.supplierId?._id || po.supplierId || '');
        setPoSupplierType(po.supplierId?.supplierType || 'exclusive');
        setPoDivisionId(po.divisionId?._id || po.divisionId || '');
        setPoItems((po.items || []).map(it => ({
            medicineId: it.medicineId?._id || it.medicineId,
            name: it.medicineId?.name || 'Medicine',
            barcode: it.medicineId?.barcode || '',
            quantityOrdered: it.quantityOrdered || it.orderQuantity || 1,
            costPrice: it.costPrice || it.lastPrice || 0,
            unitsPerBox: it.medicineId?.unitsPerBox || 1
        })));
        setPoNotes(po.notes || po.remarks || '');
        setPoStatus('draft');
        setMedSearchQuery('');
        setShowDetailModal(false);
        setViewMode('create');
    };

    const handlePrintPO = (po) => {
        setPrintablePo(po);
        setShowPrintableModal(true);
    };

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
            const payload = {
                supplierId: poSupplierId,
                divisionId: poDivisionId || undefined,
                items: poItems.map(it => ({
                    medicineId: it.medicineId,
                    quantityOrdered: it.quantityOrdered,
                    costPrice: Number(it.costPrice) || 0
                })),
                notes: poNotes,
                status: poStatus
            };

            if (editingPoId) {
                await api.put(`/purchasing/${editingPoId}`, payload);
                showToast('LPO updated successfully!', 'success');
            } else {
                await api.post('/purchasing', payload);
                showToast(`LPO created successfully as ${poStatus}`, 'success');
            }

            resetCreateForm();
            setViewMode('list');
            fetchData();
        } catch (error) {
            console.error(error);
            showToast(error.response?.data?.message || 'Failed to save LPO', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleOpenPODetails = async (poId) => {
        try {
            const { data } = await api.get(`/purchasing/${poId}`);
            setSelectedPO(data);
            setShowDetailModal(true);
        } catch (error) {
            console.error(error);
            showToast('Failed to load LPO details', 'error');
        }
    };

    const handleCancelPO = async (poId) => {
        const confirmed = await showConfirm('Are you sure you want to cancel this Local Purchase Order? This action cannot be undone.');
        if (!confirmed) return;

        try {
            await api.put(`/purchasing/${poId}`, { status: 'cancelled' });
            showToast('LPO cancelled successfully', 'success');
            setShowDetailModal(false);
            fetchData();
        } catch (error) {
            console.error(error);
            showToast('Failed to cancel LPO', 'error');
        }
    };

    const handleSendPO = async (poId) => {
        try {
            await api.put(`/purchasing/${poId}`, { status: 'ordered' });
            showToast('LPO marked as Ordered!', 'success');
            setShowDetailModal(false);
            fetchData();
        } catch (error) {
            console.error(error);
            showToast('Failed to update LPO status', 'error');
        }
    };

    const filteredPOs = useMemo(() => {
        return purchaseOrders.filter(po => {
            const matchesStatus = filterStatus === 'all' || po.status === filterStatus;
            const matchesSupplier = filterSupplier === 'all' || po.supplierId?._id === filterSupplier;
            return matchesStatus && matchesSupplier;
        });
    }, [purchaseOrders, filterStatus, filterSupplier]);

    const getStatusStyle = (status) => {
        switch (status) {
            case 'draft': return { bg: '#f3f4f6', text: '#374151' };
            case 'ordered': return { bg: '#dbeafe', text: '#1e40af' };
            case 'partially_received': return { bg: '#fef3c7', text: '#d97706' };
            case 'received': return { bg: '#dcfce7', text: '#15803d' };
            case 'cancelled': return { bg: '#fee2e2', text: '#991b1b' };
            default: return { bg: '#f3f4f6', text: '#374151' };
        }
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'OMR' }).format(val || 0);
    };

    // LIST VIEW
    if (viewMode === 'list') {
        return (
            <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 className="page-title" style={{ margin: 0, fontSize: '2.2rem', fontWeight: 800 }}>Local Purchase Orders (LPO)</h1>
                        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Create, manage, view, and print supplier Local Purchase Orders.</p>
                    </div>

                    {canCreate && (
                        <Button
                            variant="primary"
                            onClick={handleStartCreate}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <Plus size={16} />
                            Create LPO
                        </Button>
                    )}
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

                {/* LPO list table */}
                <div className="glass-panel" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                <th style={{ padding: '1rem' }}>LPO Number</th>
                                <th style={{ padding: '1rem' }}>Supplier</th>
                                <th style={{ padding: '1rem' }}>Division</th>
                                <th style={{ padding: '1rem' }}>Order Date</th>
                                <th style={{ padding: '1rem' }}>Items</th>
                                <th style={{ padding: '1rem' }}>Total Amount</th>
                                <th style={{ padding: '1rem' }}>Status</th>
                                <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <TableRowSkeleton cols={8} rows={5} />
                            ) : filteredPOs.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <ClipboardList size={40} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
                                        No LPOs found matching the filter criteria.
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
                                                {po.divisionId?.divisionName || 'General'}
                                            </td>
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
                                                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() => handlePrintPO(po)}
                                                        style={{ padding: '0.35rem 0.55rem' }}
                                                        title="Print LPO Document"
                                                    >
                                                        <Printer size={14} />
                                                    </Button>
                                                    {po.status === 'draft' && canCreate && (
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={() => handleEditDraftPO(po)}
                                                            style={{ padding: '0.35rem 0.55rem' }}
                                                            title="Edit Draft LPO"
                                                        >
                                                            <Edit3 size={14} />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() => handleOpenPODetails(po._id)}
                                                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                                                    >
                                                        <Eye size={14} style={{ marginRight: '0.25rem' }} />
                                                        View
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* View LPO Details Modal */}
                <Modal
                    isOpen={showDetailModal}
                    onClose={() => setShowDetailModal(false)}
                    title={selectedPO ? `📦 Local Purchase Order: ${selectedPO.poNumber}` : 'LPO Details'}
                    maxWidth="900px"
                >
                    {selectedPO && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }} className="glass-panel">
                                <div>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Supplier</span>
                                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selectedPO.supplierId?.name || 'Unknown'}</div>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>CR No: {selectedPO.supplierId?.crNo || 'N/A'}</span>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Division</span>
                                    <div style={{ fontWeight: 600 }}>{selectedPO.divisionId?.divisionName || 'General'}</div>
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
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Order Date</span>
                                    <div style={{ fontWeight: 600 }}>{selectedPO.orderedAt ? new Date(selectedPO.orderedAt).toLocaleString() : 'Not Sent (Draft)'}</div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Value</span>
                                    <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(selectedPO.totalAmount)}</div>
                                </div>
                            </div>

                            {selectedPO.notes && (
                                <div className="glass-panel" style={{ padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.01)', border: '1px solid var(--glass-border)' }}>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Notes:</span>
                                    <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>{selectedPO.notes}</p>
                                </div>
                            )}

                            <div className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>
                                            <th style={{ padding: '0.75rem' }}>Medicine</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'right' }}>Cost (OMR)</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>Quantity (Boxes)</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(selectedPO.items || []).map((item) => {
                                            const totalItemCost = item.quantityOrdered * item.costPrice;
                                            return (
                                                <tr key={item._id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                                    <td style={{ padding: '0.75rem' }}>
                                                        <div style={{ fontWeight: 600 }}>{item.medicineId?.name || 'Deleted Medicine'}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Barcode: {item.medicineId?.barcode || 'N/A'}</div>
                                                    </td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatCurrency(item.costPrice)}</td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>{item.quantityOrdered}</td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(totalItemCost)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

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
                                            Cancel LPO
                                        </Button>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <Button
                                        variant="secondary"
                                        onClick={() => handlePrintPO(selectedPO)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                                    >
                                        <Printer size={16} />
                                        Print / Export LPO
                                    </Button>

                                    {selectedPO.status === 'draft' && canCreate && (
                                        <Button
                                            variant="secondary"
                                            onClick={() => handleEditDraftPO(selectedPO)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                                        >
                                            <Edit3 size={16} />
                                            Edit Draft
                                        </Button>
                                    )}

                                    <Button variant="secondary" onClick={() => setShowDetailModal(false)}>Close</Button>

                                    {selectedPO.status === 'draft' && canCreate && (
                                        <Button variant="primary" onClick={() => handleSendPO(selectedPO._id)}>
                                            <ShoppingCart size={16} style={{ marginRight: '0.4rem' }} />
                                            Confirm & Place Order
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </Modal>

                {/* Printable LPO Document Overlay Modal */}
                {showPrintableModal && (
                    <PrintableLPO
                        po={printablePo}
                        onClose={() => setShowPrintableModal(false)}
                    />
                )}
            </div>
        );
    }

    // CREATE / EDIT LPO VIEW
    return (
        <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                        type="button"
                        onClick={() => {
                            resetCreateForm();
                            setViewMode('list');
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', display: 'flex', alignItems: 'center' }}
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="page-title" style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>
                            {editingPoId ? 'Edit Draft LPO' : 'Create Local Purchase Order'}
                        </h1>
                        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            Select a supplier, optionally choose a division, and add medicines with quantities.
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmitPO} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Supplier, Division, and Status Card */}
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
                    <div className="flex flex-col gap-1">
                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.4rem', display: 'block' }}>Supplier *</label>
                        <select
                            value={poSupplierId}
                            onChange={(e) => {
                                setPoSupplierId(e.target.value);
                                setPoDivisionId('');
                                setDivisions([]);
                                setPoItems([]);
                                setMedSearchQuery('');
                            }}
                            className="input-field"
                            required
                            disabled={poItems.length > 0}
                            style={{ padding: '0.6rem 2.5rem 0.6rem 1rem' }}
                        >
                            <option value="">Select Supplier</option>
                            {suppliers.map(s => (
                                <option key={s._id} value={s._id}>{s.name} ({s.supplierType === 'multi' ? 'Multi Supplier' : 'Exclusive'})</option>
                            ))}
                        </select>
                        {poItems.length > 0 && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
                                Remove all items to change supplier.
                            </span>
                        )}
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.4rem', display: 'block' }}>Supplier Division</label>
                        {divisionsLoading ? (
                            <select disabled className="input-field" style={{ padding: '0.6rem 2.5rem 0.6rem 1rem' }}>
                                <option>Loading divisions...</option>
                            </select>
                        ) : divisions.length > 0 ? (
                            <select
                                value={poDivisionId}
                                onChange={(e) => setPoDivisionId(e.target.value)}
                                className="input-field"
                                disabled={!poSupplierId}
                                style={{ padding: '0.6rem 2.5rem 0.6rem 1rem' }}
                            >
                                <option value="">All / Default Division</option>
                                {divisions.map(d => (
                                    <option key={d._id} value={d._id}>{d.divisionName}</option>
                                ))}
                            </select>
                        ) : (
                            <select disabled className="input-field" style={{ padding: '0.6rem 2.5rem 0.6rem 1rem', opacity: 0.75 }}>
                                <option value="">{poSupplierId ? 'General (Default)' : 'Select supplier first'}</option>
                            </select>
                        )}
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.4rem', display: 'block' }}>Status</label>
                        <select
                            value={poStatus}
                            onChange={(e) => setPoStatus(e.target.value)}
                            className="input-field"
                            style={{ padding: '0.6rem 2.5rem 0.6rem 1rem' }}
                        >
                            <option value="draft">Save as Draft</option>
                            <option value="ordered">Save & Place Order</option>
                        </select>
                    </div>
                </div>

                {/* LPO Builder Workspace */}
                {poSupplierId ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', alignItems: 'stretch' }}>
                        {/* LEFT COLUMN: LPO Items Cart */}
                        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <h3 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 800, color: 'var(--text-main)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
                                🛒 LPO Items ({poItems.length})
                            </h3>

                            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '420px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {poItems.length === 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1rem', color: 'var(--text-muted)', gap: '0.5rem', textAlign: 'center' }}>
                                        <ShoppingCart size={36} style={{ opacity: 0.4 }} />
                                        <span>No items added yet. Search and click medicines on the right to add them.</span>
                                    </div>
                                ) : (
                                    poItems.map((item) => (
                                        <div key={item.medicineId} style={{ background: 'white', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)' }}>{item.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Barcode: {item.barcode || 'N/A'}</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemovePOItem(item.medicineId)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', alignItems: 'center' }}>
                                                <div className="flex flex-col gap-1">
                                                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Quantity (Boxes)</label>
                                                    <input
                                                        type="number"
                                                        value={item.quantityOrdered}
                                                        min="1"
                                                        onChange={(e) => handleUpdatePOItemQty(item.medicineId, e.target.value)}
                                                        className="input-field"
                                                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                                                    />
                                                </div>

                                                <div className="flex flex-col gap-1">
                                                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Unit Cost</span>
                                                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                                        {formatCurrency(item.costPrice)}
                                                    </span>
                                                </div>

                                                <div className="flex flex-col gap-1" style={{ textAlign: 'right' }}>
                                                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Line Total</span>
                                                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--primary)' }}>
                                                        {formatCurrency(item.quantityOrdered * (Number(item.costPrice) || 0))}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.1rem', fontWeight: 800 }}>
                                    <span>Estimated LPO Total:</span>
                                    <span style={{ color: 'var(--primary)' }}>
                                        {formatCurrency(poItems.reduce((acc, it) => acc + (it.quantityOrdered * (Number(it.costPrice) || 0)), 0))}
                                    </span>
                                </div>

                                <div>
                                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>Notes / Remarks</label>
                                    <textarea
                                        value={poNotes}
                                        onChange={(e) => setPoNotes(e.target.value)}
                                        placeholder="Terms, delivery instructions..."
                                        className="input-field"
                                        style={{ minHeight: '60px', resize: 'vertical', fontSize: '0.85rem' }}
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                    <Button
                                        variant="secondary"
                                        type="button"
                                        onClick={() => {
                                            resetCreateForm();
                                            setViewMode('list');
                                        }}
                                        style={{ flex: 1 }}
                                    >
                                        Discard Draft
                                    </Button>
                                    <Button
                                        variant="primary"
                                        type="submit"
                                        disabled={isSaving || poItems.length === 0}
                                        style={{ flex: 1.5 }}
                                    >
                                        {isSaving ? <RotateCw className="spin" size={16} /> : (editingPoId ? 'Update LPO' : 'Save LPO')}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Medicine Search & Selection */}
                        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
                                <h3 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 800, color: 'var(--text-main)' }}>
                                    📦 Select Medicines
                                </h3>
                                <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                                    {availableMedicines.length} Shown
                                </span>
                            </div>

                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '0.8rem' }} />
                                <input
                                    type="text"
                                    value={medSearchQuery}
                                    onChange={(e) => setMedSearchQuery(e.target.value)}
                                    placeholder={poSupplierType === 'multi'
                                        ? 'Type 2+ chars to search all medicines, or pick supplier items below...'
                                        : 'Search supplier medicines by name...'}
                                    className="input-field"
                                    style={{ paddingLeft: '2.5rem', fontSize: '0.85rem' }}
                                />
                            </div>

                            <div style={{ flex: 1, maxHeight: '460px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                {medicinesLoading ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                                        <RotateCw className="spin" size={26} color="var(--primary)" />
                                    </div>
                                ) : availableMedicines.length === 0 ? (
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '3rem 1rem' }}>
                                        No medicines found for the current selection.
                                    </div>
                                ) : (
                                    availableMedicines.map(med => {
                                        const isAdded = poItems.some(item => item.medicineId === med._id);
                                        return (
                                            <div
                                                key={med._id}
                                                onClick={() => handleAddMedicine(med)}
                                                className="table-row-hover"
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '0.65rem 0.85rem',
                                                    borderRadius: '10px',
                                                    cursor: 'pointer',
                                                    background: isAdded ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.4)',
                                                    border: '1px solid var(--glass-border)'
                                                }}
                                            >
                                                <div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>{med.name}</div>
                                                    <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                                                        Cost: {formatCurrency(med.costPrice)}
                                                        {med.divisionId?.divisionName ? ` • ${med.divisionId.divisionName}` : ''}
                                                        {poSupplierType === 'multi' && med.supplierId?.name ? ` • ${med.supplierId.name}` : ''}
                                                    </div>
                                                </div>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                    {isAdded ? 'Added' : <Plus size={15} color="var(--primary)" />}
                                                </span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', background: '#fffbeb', border: '1px solid #fef3c7', color: '#b45309' }}>
                        <AlertTriangle size={32} style={{ margin: '0 auto 1rem auto', opacity: 0.8 }} />
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>Supplier Not Selected</h3>
                        <p style={{ margin: 0, fontSize: '0.95rem', opacity: 0.9 }}>
                            Please select a supplier above to choose a division and search medicines for this LPO.
                        </p>
                    </div>
                )}
            </form>
        </div>
    );
};

export default Purchasing;
