import { useState, useEffect, useContext, useMemo } from 'react';
import { ShoppingCart, Plus, ClipboardList, RotateCw, AlertTriangle, Eye, CheckSquare, Trash2, Calendar, FileText, Search, Sparkles, FileSpreadsheet, UploadCloud, Info, ArrowLeft, Printer, Edit3, BookOpen, Receipt } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import AuthContext from '../context/AuthContext';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';
import Input from '../components/UI/Input';
import { TableRowSkeleton } from '../components/UI/Skeleton';
import PrintableLPO from '../components/Purchasing/PrintableLPO';
import ExcelInvoiceUploadModal from '../components/Purchasing/ExcelInvoiceUploadModal';
import PurchaseEntryModal from '../components/Purchasing/PurchaseEntryModal';

const Purchasing = () => {
    const { showConfirm, showToast } = useNotification();
    const { user } = useContext(AuthContext);

    const getInvoiceFileUrl = (filePath) => {
        if (!filePath) return '';
        const base = api.defaults.baseURL || '';
        if (base.endsWith('/api')) {
            return base.replace('/api', filePath);
        }
        return filePath;
    };

    // Permissions Gating
    const canCreate = user?.isSuperAdmin || user?.permissions?.includes('create_purchase_orders');
    const canReceive = user?.isSuperAdmin || user?.permissions?.includes('receive_purchase_orders');

    // Sub-Tabs State: 'orders', 'invoices', 'ledger'
    const [activeTab, setActiveTab] = useState('orders');

    // State Variables
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [invoicesList, setInvoicesList] = useState([]);
    const [invoicesLoading, setInvoicesLoading] = useState(false);
    const [ledgerList, setLedgerList] = useState([]);
    const [ledgerLoading, setLedgerLoading] = useState(false);
    const [allMedicines, setAllMedicines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    
    // Page view state: 'list' or 'create'
    const [viewMode, setViewMode] = useState('list');
    
    // Filters (for list view)
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterSupplier, setFilterSupplier] = useState('all');

    // Create / Edit PO Form State
    const [editingPoId, setEditingPoId] = useState(null);
    const [poSupplierId, setPoSupplierId] = useState('');
    const [poSupplierType, setPoSupplierType] = useState('exclusive');
    const [poItems, setPoItems] = useState([]);
    const [poNotes, setPoNotes] = useState('');
    const [poStatus, setPoStatus] = useState('draft'); // draft or ordered
    const [isSaving, setIsSaving] = useState(false);

    // Dynamic Panels State
    const [panels, setPanels] = useState({ panel1: [], panel2: [], panel3: [] });
    const [panelsLoading, setPanelsLoading] = useState(false);
    
    // Global Medicine Search state inside Creator (For Multi Supplier Panel 1)
    const [medSearchQuery, setMedSearchQuery] = useState('');
    const [medResults, setMedResults] = useState([]);
    const [isSearchingMed, setIsSearchingMed] = useState(false);

    // Invoice Matching & Upload Modal State
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [invoiceNo, setInvoiceNo] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [invSupplierId, setInvSupplierId] = useState('');
    const [invLpoId, setInvLpoId] = useState('');
    const [invItems, setInvItems] = useState([]); // { medicineId, name, quantityOrdered, quantityReceived, quantity, focQuantity, unitCost }
    const [invLpos, setInvLpos] = useState([]);
    const [isSavingInvoice, setIsSavingInvoice] = useState(false);
    const [invoiceFile, setInvoiceFile] = useState(null);
    const [isParsingExcel, setIsParsingExcel] = useState(false);
    const [uploadedInvoicePath, setUploadedInvoicePath] = useState('');

    // View & Receive PO Modal state
    const [selectedPO, setSelectedPO] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [receiveQuantities, setReceiveQuantities] = useState({}); // { itemId: quantity }
    const [isReceiving, setIsReceiving] = useState(false);

    // Printable LPO Modal state
    const [showPrintableModal, setShowPrintableModal] = useState(false);
    const [printablePo, setPrintablePo] = useState(null);

    // Suggestions Modal state
    const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
    const [showExcelUploadModal, setShowExcelUploadModal] = useState(false);

    // Invoice Detail View Modal
    const [showInvoiceDetailModal, setShowInvoiceDetailModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    // Fetch Data on Load
    const fetchData = async () => {
        setLoading(true);
        try {
            const [poRes, supplierRes, medRes] = await Promise.all([
                api.get('/purchasing'),
                api.get('/suppliers?limit=all'),
                api.get('/medicines?limit=all')
            ]);
            setPurchaseOrders(poRes.data);
            setSuppliers(supplierRes.data.suppliers || supplierRes.data || []);
            setAllMedicines(medRes.data.medicines || medRes.data || []);
        } catch (error) {
            console.error('Failed to load purchasing data', error);
            showToast('Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchInvoices = async () => {
        setInvoicesLoading(true);
        try {
            const { data } = await api.get('/invoices');
            setInvoicesList(data);
        } catch (error) {
            console.error('Failed to load invoices', error);
        } finally {
            setInvoicesLoading(false);
        }
    };

    const fetchLedger = async () => {
        setLedgerLoading(true);
        try {
            const { data } = await api.get('/invoices/history');
            setLedgerList(data);
        } catch (error) {
            console.error('Failed to load purchase history ledger', error);
        } finally {
            setLedgerLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'orders') fetchData();
        if (activeTab === 'invoices') fetchInvoices();
        if (activeTab === 'ledger') fetchLedger();
    }, [activeTab]);

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

    // Load supplier details and dynamic panels when creating a PO
    useEffect(() => {
        if (!poSupplierId) {
            setPanels({ panel1: [], panel2: [], panel3: [] });
            return;
        }

        const selectedSup = suppliers.find(s => s._id === poSupplierId);
        if (selectedSup) {
            setPoSupplierType(selectedSup.supplierType || 'exclusive');
        }

        const fetchPanels = async () => {
            setPanelsLoading(true);
            try {
                const { data } = await api.get(`/purchasing/panels/${poSupplierId}`);
                setPanels({
                    panel1: data.panel1 || [],
                    panel2: data.panel2 || [],
                    panel3: data.panel3 || []
                });
            } catch (error) {
                console.error('Failed to load supplier panels', error);
                showToast('Failed to load supplier panel requirements', 'error');
            } finally {
                setPanelsLoading(false);
            }
        };

        fetchPanels();
    }, [poSupplierId, suppliers]);

    // Global Medicine Search for Multi-Supplier Panel 1
    useEffect(() => {
        if (!poSupplierId || poSupplierType !== 'multi') {
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
                const { data } = await api.get(`/medicines?search=${encodeURIComponent(medSearchQuery)}&limit=50`);
                setMedResults(data.medicines || []);
            } catch (error) {
                console.error(error);
            } finally {
                setIsSearchingMed(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounce);
    }, [medSearchQuery, poSupplierId, poSupplierType]);

    // Fetch LPOs for Invoice Matching when invoice supplier changes
    useEffect(() => {
        if (!invSupplierId) {
            setInvLpos([]);
            setInvLpoId('');
            setInvItems([]);
            return;
        }
        const filteredLPOs = purchaseOrders.filter(po => 
            po.supplierId?._id === invSupplierId && 
            (po.status === 'ordered' || po.status === 'partially_received')
        );
        setInvLpos(filteredLPOs);
        setInvLpoId('');
        setInvItems([]);
    }, [invSupplierId, purchaseOrders]);

    // Fetch LPO Items when LPO is selected for invoice matching
    useEffect(() => {
        if (!invLpoId) {
            setInvItems([]);
            return;
        }
        const loadLpoDetails = async () => {
            try {
                const { data } = await api.get(`/purchasing/${invLpoId}`);
                const itemsPayload = data.items.map(item => {
                    const outstanding = Math.max(0, item.quantityOrdered - (item.quantityReceived || 0));
                    return {
                        medicineId: item.medicineId?._id || item.medicineId,
                        name: item.medicineId?.name || 'Unknown',
                        quantityOrdered: item.quantityOrdered,
                        quantityReceived: item.quantityReceived || 0,
                        quantity: outstanding,
                        focQuantity: 0,
                        unitCost: item.costPrice || 0
                    };
                });
                setInvItems(itemsPayload);
            } catch (err) {
                console.error(err);
                showToast('Failed to load LPO items for matching', 'error');
            }
        };
        loadLpoDetails();
    }, [invLpoId]);

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
            costPrice: it.costPrice || 0,
            unitsPerBox: it.unitsPerBox
        }));
        setPoItems(items);
        setPoNotes('Auto-generated from daily requirement list suggestions.');
        setPoStatus('draft');
        setShowSuggestionsModal(false);
        setViewMode('create');
    };

    // Add Item to Current PO Cart
    const handleAddMedicine = (med, suggestedQty = 1) => {
        const exists = poItems.find(item => item.medicineId === med._id);
        if (exists) {
            showToast(`${med.name} is already added.`, 'warning');
            return;
        }

        // 1. Fetch from last purchase invoice stats
        const prevStat = panels.panel2.find(p => p._id === med._id);
        let resolvedCost = prevStat?.stats?.lastUnitCost;

        // 2. Fallback to medicine's master record costPrice
        if (!resolvedCost || resolvedCost <= 0) {
            resolvedCost = med.costPrice || 0;
        }

        setPoItems(prev => [
            ...prev,
            {
                medicineId: med._id,
                name: med.name,
                barcode: med.barcode,
                quantityOrdered: suggestedQty,
                costPrice: resolvedCost, // Auto resolved cost price
                unitsPerBox: med.unitsPerBox || 1
            }
        ]);
        showToast(`Added ${med.name} to order`, 'success');
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

    // Edit Existing Draft PO
    const handleEditDraftPO = (po) => {
        setEditingPoId(po._id);
        setPoSupplierId(po.supplierId?._id || po.supplierId);
        setPoSupplierType(po.supplierId?.supplierType || 'exclusive');
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
        setShowDetailModal(false);
        setViewMode('create');
    };

    // Open Printable LPO Document
    const handlePrintPO = (po) => {
        setPrintablePo(po);
        setShowPrintableModal(true);
    };

    // Submit New or Updated LPO
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
            const cleanedItems = poItems.map(it => ({
                medicineId: it.medicineId,
                quantityOrdered: it.quantityOrdered,
                costPrice: Number(it.costPrice) || 0
            }));

            if (editingPoId) {
                await api.put(`/purchasing/${editingPoId}`, {
                    supplierId: poSupplierId,
                    items: cleanedItems,
                    notes: poNotes,
                    status: poStatus
                });
                showToast('Purchase Order updated successfully!', 'success');
            } else {
                await api.post('/purchasing', {
                    supplierId: poSupplierId,
                    items: cleanedItems,
                    notes: poNotes,
                    status: poStatus
                });
                showToast(`Purchase Order created successfully as ${poStatus}`, 'success');
            }

            setEditingPoId(null);
            setPoSupplierId('');
            setPoItems([]);
            setPoNotes('');
            setPoStatus('draft');
            setViewMode('list');
            fetchData();
        } catch (error) {
            console.error(error);
            showToast(error.response?.data?.message || 'Failed to save PO', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Submit matching invoice details
    const handleSubmitInvoice = async (e) => {
        e.preventDefault();
        if (!invoiceNo.trim()) {
            showToast('Please enter an invoice number', 'error');
            return;
        }
        if (!invSupplierId) {
            showToast('Please select a supplier', 'error');
            return;
        }
        if (invItems.length === 0) {
            showToast('Please specify invoice products', 'error');
            return;
        }

        setIsSavingInvoice(true);
        try {
            const formData = new FormData();
            formData.append('invoiceNumber', invoiceNo);
            formData.append('invoiceDate', invoiceDate);
            if (invLpoId) formData.append('lpoId', invLpoId);
            formData.append('supplierId', invSupplierId);
            formData.append('items', JSON.stringify(
                invItems.map(item => ({
                    medicineId: item.medicineId,
                    quantity: Number(item.quantity) || 0,
                    focQuantity: Number(item.focQuantity) || 0,
                    unitCost: Number(item.unitCost) || 0
                })).filter(item => item.quantity > 0)
            ));
            if (uploadedInvoicePath) {
                formData.append('invoiceFileUrl', uploadedInvoicePath);
            } else if (invoiceFile) {
                formData.append('invoiceFile', invoiceFile);
            }

            await api.post('/invoices', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            showToast('Invoice matched and uploaded successfully!', 'success');
            setShowInvoiceModal(false);
            setInvoiceNo('');
            setInvSupplierId('');
            setInvLpoId('');
            setInvItems([]);
            setInvoiceFile(null);
            setUploadedInvoicePath('');
            fetchData();
        } catch (error) {
            console.error(error);
            showToast(error.response?.data?.message || 'Failed to submit invoice', 'error');
        } finally {
            setIsSavingInvoice(false);
        }
    };

    const handleParseExcelInvoice = async () => {
        if (!invoiceFile) {
            showToast('Please select an Excel invoice file first', 'warning');
            return;
        }

        setIsParsingExcel(true);
        try {
            const formData = new FormData();
            formData.append('invoiceFile', invoiceFile);

            const { data } = await api.post('/invoices/parse-excel', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            setUploadedInvoicePath(data.filePath);
            showToast(`Parsed ${data.items.length} items from Excel invoice!`, 'success');

            // Try to match parsed items against LPO items if LPO is selected
            if (invLpoId && invItems.length > 0) {
                const updatedItems = invItems.map(lpoItem => {
                    const match = data.items.find(pi => 
                        (pi.barcode && pi.barcode === lpoItem.barcode) || 
                        (pi.name && pi.name.toLowerCase() === lpoItem.name.toLowerCase())
                    );

                    if (match) {
                        return {
                            ...lpoItem,
                            quantity: match.quantity,
                            focQuantity: match.focQuantity,
                            unitCost: match.unitCost
                        };
                    }
                    return lpoItem;
                });
                setInvItems(updatedItems);
            } else {
                // Otherwise populate with parsed items directly
                setInvItems(data.items.map(item => ({
                    medicineId: item.medicineId,
                    name: item.name,
                    quantityOrdered: 0,
                    quantityReceived: 0,
                    quantity: item.quantity,
                    focQuantity: item.focQuantity,
                    unitCost: item.unitCost
                })));
            }
        } catch (error) {
            console.error(error);
            showToast(error.response?.data?.message || 'Failed to parse Excel invoice', 'error');
        } finally {
            setIsParsingExcel(false);
        }
    };

    // Open PO Details / Receiving Screen
    const handleOpenPODetails = async (poId) => {
        try {
            const { data } = await api.get(`/purchasing/${poId}`);
            setSelectedPO(data);
            
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

    // RENDER LIST VIEW (Dashboard)
    if (viewMode === 'list') {
        return (
            <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Header section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 className="page-title" style={{ margin: 0, fontSize: '2.2rem', fontWeight: 800 }}>Purchasing Management</h1>
                        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Create, verify, and receive supplier purchase orders.</p>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {canReceive && (
                            <Button 
                                variant="primary" 
                                onClick={() => setShowInvoiceModal(true)}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#059669', borderColor: '#059669' }}
                            >
                                <Receipt size={16} />
                                Purchase Entry (Excel & Manual)
                            </Button>
                        )}
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
                                onClick={() => setViewMode('create')}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                                <Plus size={16} />
                                Create PO
                            </Button>
                        )}
                    </div>
                </div>

                {/* Sub-Tabs Navigation Bar */}
                <div style={{ display: 'flex', gap: '0.75rem', borderBottom: '2px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                    <button
                        type="button"
                        onClick={() => setActiveTab('orders')}
                        style={{
                            padding: '0.65rem 1.25rem',
                            borderRadius: '10px',
                            border: 'none',
                            fontWeight: 700,
                            fontSize: '0.92rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: activeTab === 'orders' ? 'var(--primary)' : 'rgba(0,0,0,0.04)',
                            color: activeTab === 'orders' ? 'white' : 'var(--text-secondary)',
                            transition: 'all 0.2s'
                        }}
                    >
                        <ShoppingCart size={16} /> Purchase Orders ({purchaseOrders.length})
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('invoices')}
                        style={{
                            padding: '0.65rem 1.25rem',
                            borderRadius: '10px',
                            border: 'none',
                            fontWeight: 700,
                            fontSize: '0.92rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: activeTab === 'invoices' ? 'var(--primary)' : 'rgba(0,0,0,0.04)',
                            color: activeTab === 'invoices' ? 'white' : 'var(--text-secondary)',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Receipt size={16} /> Invoices History ({invoicesList.length})
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('ledger')}
                        style={{
                            padding: '0.65rem 1.25rem',
                            borderRadius: '10px',
                            border: 'none',
                            fontWeight: 700,
                            fontSize: '0.92rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: activeTab === 'ledger' ? 'var(--primary)' : 'rgba(0,0,0,0.04)',
                            color: activeTab === 'ledger' ? 'white' : 'var(--text-secondary)',
                            transition: 'all 0.2s'
                        }}
                    >
                        <BookOpen size={16} /> Purchase History Ledger ({ledgerList.length})
                    </button>
                </div>

                {activeTab === 'orders' && (
                    <>
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
                                        <TableRowSkeleton cols={8} rows={5} />
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
                                                                View / Receive
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
                    </>
                )}

                {activeTab === 'invoices' && (
                    <div className="glass-panel" style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                    <th style={{ padding: '1rem' }}>Invoice Number</th>
                                    <th style={{ padding: '1rem' }}>Supplier</th>
                                    <th style={{ padding: '1rem' }}>Invoice Date</th>
                                    <th style={{ padding: '1rem' }}>Items</th>
                                    <th style={{ padding: '1rem' }}>Total Amount</th>
                                    <th style={{ padding: '1rem' }}>Linked LPO</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Attachment</th>
                                    <th style={{ padding: '1rem', textAlign: 'center' }}>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoicesLoading ? (
                                    <TableRowSkeleton cols={8} rows={5} />
                                ) : invoicesList.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            <Receipt size={40} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
                                            No purchase invoices uploaded yet.
                                        </td>
                                    </tr>
                                ) : (
                                    invoicesList.map(inv => (
                                        <tr key={inv._id} style={{ borderBottom: '1px solid var(--glass-border)', fontSize: '0.95rem' }} className="table-row-hover">
                                            <td style={{ padding: '1rem', fontWeight: 'bold' }}>{inv.invoiceNumber}</td>
                                            <td style={{ padding: '1rem' }}>{inv.supplierId?.name || 'Unknown'}</td>
                                            <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                                            <td style={{ padding: '1rem' }}>{inv.items?.length || 0} line items</td>
                                            <td style={{ padding: '1rem', fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(inv.totalAmount)}</td>
                                            <td style={{ padding: '1rem' }}>{inv.lpoId?.lpoNumber ? <span style={{ fontWeight: 600, color: '#4f46e5' }}>{inv.lpoId.lpoNumber}</span> : <span style={{ color: 'var(--text-muted)' }}>Direct Invoice</span>}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                {inv.invoiceFile ? (
                                                    <a 
                                                        href={getInvoiceFileUrl(inv.invoiceFile)} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                                    >
                                                        <FileText size={14} /> View File
                                                    </a>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>None</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                <button
                                                    type="button"
                                                    title="View invoice details"
                                                    onClick={() => { setSelectedInvoice(inv); setShowInvoiceDetailModal(true); }}
                                                    style={{
                                                        background: 'var(--primary)',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '7px',
                                                        padding: '0.35rem 0.75rem',
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.35rem',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 700
                                                    }}
                                                >
                                                    <Eye size={13} /> View
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'ledger' && (
                    <div className="glass-panel" style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                    <th style={{ padding: '1rem' }}>Date</th>
                                    <th style={{ padding: '1rem' }}>Invoice #</th>
                                    <th style={{ padding: '1rem' }}>Supplier</th>
                                    <th style={{ padding: '1rem' }}>Division</th>
                                    <th style={{ padding: '1rem' }}>Medicine</th>
                                    <th style={{ padding: '1rem', textAlign: 'center' }}>Qty Received</th>
                                    <th style={{ padding: '1rem', textAlign: 'center' }}>FOC Qty</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Unit Cost</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Total Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ledgerLoading ? (
                                    <TableRowSkeleton cols={9} rows={5} />
                                ) : ledgerList.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            <BookOpen size={40} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
                                            No purchase transactions recorded in history ledger yet.
                                        </td>
                                    </tr>
                                ) : (
                                    ledgerList.map(row => (
                                        <tr key={row._id} style={{ borderBottom: '1px solid var(--glass-border)', fontSize: '0.92rem' }} className="table-row-hover">
                                            <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>{new Date(row.invoiceDate).toLocaleDateString()}</td>
                                            <td style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>{row.invoiceNumber}</td>
                                            <td style={{ padding: '0.85rem 1rem' }}>{row.supplierId?.name || 'Unknown'}</td>
                                            <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>{row.divisionId?.divisionName || 'General'}</td>
                                            <td style={{ padding: '0.85rem 1rem' }}>
                                                <div style={{ fontWeight: 700 }}>{row.productId?.name || 'Medicine'}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{row.productId?.barcode || 'No barcode'}</div>
                                            </td>
                                            <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 600 }}>{row.quantity}</td>
                                            <td style={{ padding: '0.85rem 1rem', textAlign: 'center', color: row.foc > 0 ? 'var(--success)' : 'var(--text-muted)', fontWeight: row.foc > 0 ? 700 : 400 }}>{row.foc || 0}</td>
                                            <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>{formatCurrency(row.unitCost)}</td>
                                            <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>{formatCurrency(row.totalCost)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Suggestions Modal */}
                <Modal
                    isOpen={showSuggestionsModal}
                    onClose={() => setShowSuggestionsModal(false)}
                    title="⚙️ Purchasing Recommendations"
                    maxWidth="850px"
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '450px', overflowY: 'auto' }}>
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

                {/* Purchase Entry Modal (Excel & Manual Entry) */}
                <PurchaseEntryModal
                    isOpen={showInvoiceModal}
                    onClose={() => setShowInvoiceModal(false)}
                    suppliers={suppliers}
                    purchaseOrders={purchaseOrders}
                    medicines={allMedicines}
                    onSaveSuccess={() => {
                        setActiveTab('invoices');
                        fetchData();
                        fetchInvoices();
                        fetchLedger();
                    }}
                    showToast={showToast}
                />

                {/* Invoice Detail View Modal */}
                <Modal
                    isOpen={showInvoiceDetailModal}
                    onClose={() => { setShowInvoiceDetailModal(false); setSelectedInvoice(null); }}
                    title={selectedInvoice ? `📄 Invoice: ${selectedInvoice.invoiceNumber}` : 'Invoice Detail'}
                    maxWidth="1300px"
                >
                    {selectedInvoice && (() => {
                        const inv = selectedInvoice;
                        const totals = (inv.items || []).reduce((acc, it) => {
                            acc.amount += Number(it.amount) || 0;
                            acc.discAmt += Number(it.discAmt) || 0;
                            acc.netValue += Number(it.netValue) || 0;
                            acc.vatAmt += Number(it.vatAmt) || 0;
                            acc.netAmount += Number(it.netAmount) || 0;
                            return acc;
                        }, { amount: 0, discAmt: 0, netValue: 0, vatAmt: 0, netAmount: 0 });

                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                                {/* Header Info Cards */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                                    {[
                                        { label: 'Supplier', value: inv.supplierId?.name || 'Unknown', highlight: false },
                                        { label: 'Invoice Date', value: new Date(inv.invoiceDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), highlight: false },
                                        { label: 'Linked LPO', value: inv.lpoId?.lpoNumber || 'Direct Invoice', highlight: !!inv.lpoId },
                                        { label: 'Line Items', value: `${(inv.items || []).length} items`, highlight: false },
                                        { label: 'Grand Total', value: formatCurrency(inv.totalAmount), highlight: true },
                                    ].map(card => (
                                        <div key={card.label} style={{
                                            background: card.highlight ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : 'var(--surface-color, #f8fafc)',
                                            border: '1px solid var(--border-color, #e2e8f0)',
                                            borderRadius: '12px',
                                            padding: '1rem 1.25rem'
                                        }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: card.highlight ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</div>
                                            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: card.highlight ? 'white' : 'var(--text-main)' }}>{card.value}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Line Items Table */}
                                <div style={{ border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '10px', overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: '1200px' }}>
                                        <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#1e293b' }}>
                                            <tr style={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                <th style={{ padding: '0.7rem 0.5rem', width: '32px', textAlign: 'center' }}>#</th>
                                                <th style={{ padding: '0.7rem 0.5rem', textAlign: 'left', minWidth: '200px' }}>Product</th>
                                                <th style={{ padding: '0.7rem 0.5rem', textAlign: 'left', width: '120px' }}>Barcode</th>
                                                <th style={{ padding: '0.7rem 0.5rem', textAlign: 'left', width: '90px' }}>Batch</th>
                                                <th style={{ padding: '0.7rem 0.5rem', textAlign: 'center', width: '95px' }}>Exp Date</th>
                                                <th style={{ padding: '0.7rem 0.4rem', textAlign: 'center', width: '55px' }}>Pack</th>
                                                <th style={{ padding: '0.7rem 0.4rem', textAlign: 'center', width: '55px' }}>Loose</th>
                                                <th style={{ padding: '0.7rem 0.4rem', textAlign: 'center', width: '60px' }}>Unit</th>
                                                <th style={{ padding: '0.7rem 0.4rem', textAlign: 'right', width: '80px' }}>Cost</th>
                                                <th style={{ padding: '0.7rem 0.4rem', textAlign: 'center', width: '50px' }}>FOC</th>
                                                <th style={{ padding: '0.7rem 0.4rem', textAlign: 'right', width: '80px' }}>Amount</th>
                                                <th style={{ padding: '0.7rem 0.4rem', textAlign: 'right', width: '80px' }}>Retail Rate</th>
                                                <th style={{ padding: '0.7rem 0.4rem', textAlign: 'right', width: '75px' }}>Disc Amt</th>
                                                <th style={{ padding: '0.7rem 0.4rem', textAlign: 'right', width: '80px' }}>Net Value</th>
                                                <th style={{ padding: '0.7rem 0.4rem', textAlign: 'right', width: '70px' }}>VAT Amt</th>
                                                <th style={{ padding: '0.7rem 0.5rem', textAlign: 'right', width: '90px', background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}>Net Amt</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(inv.items || []).map((it, idx) => (
                                                <tr key={idx} style={{
                                                    borderBottom: '1px solid #1e293b',
                                                    background: idx % 2 === 0 ? '#0f172a' : '#1a2744',
                                                    color: '#e2e8f0'
                                                }}>
                                                    <td style={{ padding: '0.55rem 0.4rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>{idx + 1}</td>
                                                    <td style={{ padding: '0.55rem 0.5rem' }}>
                                                        <div style={{ fontWeight: 700, color: it.medicineId ? '#818cf8' : '#e2e8f0' }}>
                                                            {it.product || it.medicineId?.name || '—'}
                                                        </div>
                                                        {it.medicineId && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Matched ✓</div>}
                                                    </td>
                                                    <td style={{ padding: '0.55rem 0.5rem', color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.78rem' }}>{it.code || '—'}</td>
                                                    <td style={{ padding: '0.55rem 0.5rem', color: '#94a3b8' }}>{it.batch || '—'}</td>
                                                    <td style={{ padding: '0.55rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                                                        {it.expDateFormatted || (it.expDate ? new Date(it.expDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—')}
                                                    </td>
                                                    <td style={{ padding: '0.55rem 0.4rem', textAlign: 'center', fontWeight: 600 }}>{it.pack ?? 0}</td>
                                                    <td style={{ padding: '0.55rem 0.4rem', textAlign: 'center' }}>{it.loose ?? 0}</td>
                                                    <td style={{ padding: '0.55rem 0.4rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem' }}>{it.unit || 'BOX'}</td>
                                                    <td style={{ padding: '0.55rem 0.4rem', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(it.price ?? it.unitCost)}</td>
                                                    <td style={{ padding: '0.55rem 0.4rem', textAlign: 'center', color: (it.foc ?? it.focQuantity) > 0 ? '#4ade80' : '#64748b', fontWeight: (it.foc ?? it.focQuantity) > 0 ? 700 : 400 }}>{it.foc ?? it.focQuantity ?? 0}</td>
                                                    <td style={{ padding: '0.55rem 0.4rem', textAlign: 'right', color: '#cbd5e1' }}>{formatCurrency(it.amount)}</td>
                                                    <td style={{ padding: '0.55rem 0.4rem', textAlign: 'right', color: '#94a3b8' }}>{formatCurrency(it.rpSale ?? it.retailRate)}</td>
                                                    <td style={{ padding: '0.55rem 0.4rem', textAlign: 'right', color: '#f87171' }}>{it.discAmt > 0 ? `- ${formatCurrency(it.discAmt)}` : '—'}</td>
                                                    <td style={{ padding: '0.55rem 0.4rem', textAlign: 'right', color: '#cbd5e1', fontWeight: 600 }}>{formatCurrency(it.netValue)}</td>
                                                    <td style={{ padding: '0.55rem 0.4rem', textAlign: 'right', color: '#fbbf24' }}>{it.vatAmt > 0 ? formatCurrency(it.vatAmt) : '—'}</td>
                                                    <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontWeight: 800, color: '#a5b4fc', background: 'rgba(99,102,241,0.1)' }}>{formatCurrency(it.netAmount)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        {/* Totals footer row */}
                                        <tfoot style={{ position: 'sticky', bottom: 0, background: '#0f172a', borderTop: '2px solid #334155' }}>
                                            <tr style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '0.85rem' }}>
                                                <td colSpan={10} style={{ padding: '0.65rem 0.5rem', textAlign: 'right', color: '#94a3b8' }}>TOTALS</td>
                                                <td style={{ padding: '0.65rem 0.4rem', textAlign: 'right' }}>{formatCurrency(totals.amount)}</td>
                                                <td style={{ padding: '0.65rem 0.4rem' }}></td>
                                                <td style={{ padding: '0.65rem 0.4rem', textAlign: 'right', color: '#f87171' }}>- {formatCurrency(totals.discAmt)}</td>
                                                <td style={{ padding: '0.65rem 0.4rem', textAlign: 'right' }}>{formatCurrency(totals.netValue)}</td>
                                                <td style={{ padding: '0.65rem 0.4rem', textAlign: 'right', color: '#fbbf24' }}>{formatCurrency(totals.vatAmt)}</td>
                                                <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', color: '#818cf8', background: 'rgba(99,102,241,0.15)', fontSize: '0.95rem' }}>{formatCurrency(totals.netAmount)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                {/* Attachment link if exists */}
                                {inv.invoiceFile && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.25rem', background: 'rgba(99,102,241,0.08)', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.2)' }}>
                                        <FileText size={18} color="#818cf8" />
                                        <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.9rem' }}>Attached Document:</span>
                                        <a
                                            href={getInvoiceFileUrl(inv.invoiceFile)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ color: '#818cf8', fontWeight: 700, textDecoration: 'underline' }}
                                        >
                                            {inv.invoiceFile.split('/').pop()}
                                        </a>
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <Button variant="secondary" onClick={() => { setShowInvoiceDetailModal(false); setSelectedInvoice(null); }}>Close</Button>
                                </div>
                            </div>
                        );
                    })()}
                </Modal>

                {/* View / Receive PO Details Modal */}
                <Modal
                    isOpen={showDetailModal}
                    onClose={() => setShowDetailModal(false)}
                    title={selectedPO ? `📦 Local Purchase Order: ${selectedPO.poNumber}` : 'PO Details'}
                    maxWidth="950px"
                >
                    {selectedPO && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            
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

                            {selectedPO.notes && (
                                <div className="glass-panel" style={{ padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.01)', border: '1px solid var(--glass-border)' }}>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Notes:</span>
                                    <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>{selectedPO.notes}</p>
                                </div>
                            )}

                            {selectedPO.invoices && selectedPO.invoices.length > 0 && (
                                <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(99,102,241,0.02)', border: '1px solid rgba(99,102,241,0.15)' }}>
                                    <span style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Matched Invoices & Uploaded Documents
                                    </span>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {selectedPO.invoices.map((inv, idx) => (
                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--glass-border)', fontSize: '0.88rem' }}>
                                                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                                    <span>Invoice: <strong>{inv.invoiceNumber}</strong></span>
                                                    <span style={{ color: 'var(--text-muted)' }}>Date: {new Date(inv.invoiceDate).toLocaleDateString()}</span>
                                                    <span style={{ fontWeight: 600, color: 'var(--success)' }}>Total: {formatCurrency(inv.totalAmount)}</span>
                                                </div>
                                                {inv.invoiceFile ? (
                                                    <a 
                                                        href={getInvoiceFileUrl(inv.invoiceFile)}
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                                    >
                                                        <FileText size={14} />
                                                        View Document
                                                    </a>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>No document attached</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedPO.status === 'partially_received' && (
                                <div className="glass-panel" style={{ padding: '0.75rem 1rem', background: '#fffbeb', border: '1px solid #fef3c7', color: '#b45309', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <AlertTriangle size={18} />
                                    <span style={{ fontSize: '0.88rem', fontWeight: 550 }}>
                                        Some items ordered in this Purchase Order are still outstanding. Match a Purchase Invoice to complete them.
                                    </span>
                                </div>
                            )}

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

                {/* Printable LPO Document Overlay Modal */}
                {showPrintableModal && (
                    <PrintableLPO 
                        po={printablePo} 
                        onClose={() => setShowPrintableModal(false)} 
                    />
                )}

                {/* Purchase Invoice Excel Upload Modal */}
                <ExcelInvoiceUploadModal
                    isOpen={showExcelUploadModal}
                    onClose={() => setShowExcelUploadModal(false)}
                    suppliers={suppliers}
                    purchaseOrders={purchaseOrders}
                    onUploadSuccess={() => {
                        fetchData();
                        if (fetchInvoices) fetchInvoices();
                        if (fetchLedger) fetchLedger();
                    }}
                    showToast={showToast}
                />
            </div>
        );
    }

    // RENDER CREATE LPO VIEW (Full Page workspace)
    return (
        <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button 
                        type="button"
                        onClick={() => {
                            setPoSupplierId('');
                            setPoItems([]);
                            setPoNotes('');
                            setViewMode('list');
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', display: 'flex', alignItems: 'center' }}
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="page-title" style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>Create Local Purchase Order</h1>
                        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Select a supplier and add required medicines to draft LPO.</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmitPO} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* Supplier selection card */}
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', alignItems: 'center' }}>
                    <div className="flex flex-col gap-1">
                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.4rem', display: 'block' }}>Supplier *</label>
                        <select
                            value={poSupplierId}
                            onChange={(e) => {
                                setPoSupplierId(e.target.value);
                                setPoItems([]); // Reset items if supplier changes
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
                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.4rem', display: 'block' }}>Initial Status</label>
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

                {/* Swapped dynamic workspace layout: LPO Cart on LEFT, Dynamic Panels on RIGHT */}
                {poSupplierId ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '2rem', alignItems: 'stretch' }}>
                        
                        {/* LEFT COLUMN: The LPO Draft Items cart */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' }}>
                                <h3 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 800, color: 'var(--text-main)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
                                    🛒 Purchase Order Items list
                                </h3>

                                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '420px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {poItems.length === 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1rem', color: 'var(--text-muted)', gap: '0.5rem', textAlign: 'center' }}>
                                            <ShoppingCart size={36} style={{ opacity: 0.4 }} />
                                            <span>No items added to LPO cart yet. Click items in the panels to add them.</span>
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

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                    <div className="flex flex-col gap-1">
                                                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Quantity Ordered (Boxes)</label>
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
                                                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Cost Price</span>
                                                        <span style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                                                            {formatCurrency(item.costPrice)}
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
                                                setPoSupplierId('');
                                                setPoItems([]);
                                                setPoNotes('');
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
                                            {isSaving ? <RotateCw className="spin" size={16} /> : 'Save Purchase Order'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Dynamic panels based on Supplier Type */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(99, 102, 241, 0.05)', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                                <Info size={16} color="var(--primary)" />
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    LPO Rules: <strong>{poSupplierType.toUpperCase()} SUPPLIER</strong> panels loaded.
                                </span>
                            </div>

                            {panelsLoading ? (
                                <div className="glass-panel" style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
                                    <RotateCw className="spin" size={32} color="var(--primary)" />
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    
                                    {/* PANEL 1: Requirement list items */}
                                    <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
                                            <h3 style={{ fontSize: '0.95rem', margin: 0, fontWeight: 800, color: 'var(--text-main)' }}>
                                                📋 Last 1 Month Requirements
                                            </h3>
                                            <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700 }}>
                                                {panels.panel1.length} Items
                                            </span>
                                        </div>

                                        {/* Multi supplier global search */}
                                        {poSupplierType === 'multi' && (
                                            <div style={{ position: 'relative' }}>
                                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                    <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem' }} />
                                                    <input
                                                        type="text"
                                                        value={medSearchQuery}
                                                        onChange={(e) => setMedSearchQuery(e.target.value)}
                                                        placeholder="Search and add any medicine from database..."
                                                        className="input-field"
                                                        style={{ paddingLeft: '2.5rem', fontSize: '0.82rem' }}
                                                    />
                                                </div>
                                                {medResults.length > 0 && (
                                                    <div style={{ 
                                                        position: 'absolute', left: 0, right: 0, zIndex: 110, 
                                                        background: 'white', border: '1px solid var(--glass-border)',
                                                        borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', 
                                                        marginTop: '0.25rem', maxHeight: '200px', overflowY: 'auto'
                                                    }}>
                                                        {medResults.map(med => (
                                                            <div 
                                                                key={med._id}
                                                                onClick={() => handleAddMedicine(med)}
                                                                style={{ padding: '0.6rem 0.8rem', cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                                                className="table-row-hover"
                                                            >
                                                                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{med.name}</span>
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cost: {formatCurrency(med.costPrice)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                            {panels.panel1.length === 0 ? (
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '2rem' }}>
                                                    No requirements pending.
                                                </div>
                                            ) : (
                                                panels.panel1.map(med => (
                                                    <div key={med._id} onClick={() => handleAddMedicine(med)} className="table-row-hover" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', borderRadius: '10px', cursor: 'pointer', background: 'rgba(255,255,255,0.4)', border: '1px solid var(--glass-border)' }}>
                                                        <div>
                                                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>{med.name}</div>
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Primary: {med.supplierId?.name || 'Self'}</div>
                                                        </div>
                                                        <Plus size={14} color="var(--primary)" />
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* PANEL 2: Previously supplied (only for Multi-Supplier) */}
                                    {poSupplierType === 'multi' && (
                                        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
                                                <h3 style={{ fontSize: '0.95rem', margin: 0, fontWeight: 800, color: 'var(--text-main)' }}>
                                                    🕒 Previously Ordered From This Supplier
                                                </h3>
                                            </div>

                                            <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                                {panels.panel2.length === 0 ? (
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '2rem' }}>
                                                        No order history found for this supplier.
                                                    </div>
                                                ) : (
                                                    panels.panel2.map(med => (
                                                        <div key={med._id} onClick={() => handleAddMedicine(med)} className="table-row-hover" style={{ padding: '0.8rem', borderRadius: '10px', cursor: 'pointer', background: 'rgba(255,255,255,0.4)', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-main)' }}>{med.name}</span>
                                                                <Plus size={14} color="var(--primary)" />
                                                            </div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', background: 'white', padding: '0.4rem 0.6rem', borderRadius: '8px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                                                <div>Ord Qty: <strong>{med.stats.lastOrderedQty}</strong></div>
                                                                <div>Rec Qty: <strong>{med.stats.lastReceivedQty}</strong></div>
                                                                <div>Last FOC: <strong>{med.stats.lastFocQty || 0}</strong></div>
                                                                <div>Avg FOC: <strong>{Number(med.stats.averageFocPercent || 0).toFixed(0)}%</strong></div>
                                                                <div>Orders: <strong>{med.stats.purchaseCount} times</strong></div>
                                                                <div>Last LPO: <strong>{med.stats.lastLpoNumber || 'N/A'}</strong></div>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* PANEL 3 (or Panel 2 for Exclusive): Supplier Products */}
                                    <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
                                            <h3 style={{ fontSize: '0.95rem', margin: 0, fontWeight: 800, color: 'var(--text-main)' }}>
                                                📦 Supplier Products Catalog
                                            </h3>
                                        </div>

                                        <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                            {((poSupplierType === 'multi' ? panels.panel3 : panels.panel2) || []).length === 0 ? (
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '2rem' }}>
                                                    No additional products.
                                                </div>
                                            ) : (
                                                (poSupplierType === 'multi' ? panels.panel3 : panels.panel2).map(med => (
                                                    <div key={med._id} onClick={() => handleAddMedicine(med)} className="table-row-hover" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', borderRadius: '10px', cursor: 'pointer', background: 'rgba(255,255,255,0.4)', border: '1px solid var(--glass-border)' }}>
                                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>{med.name}</span>
                                                        <Plus size={14} color="var(--primary)" />
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                </div>
                            )}
                        </div>

                    </div>
                ) : (
                    <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', background: '#fffbeb', border: '1px solid #fef3c7', color: '#b45309' }}>
                        <AlertTriangle size={32} style={{ margin: '0 auto 1rem auto', opacity: 0.8 }} />
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>Supplier Not Selected</h3>
                        <p style={{ margin: 0, fontSize: '0.95rem', opacity: 0.9 }}>
                            Please select a supplier from the dropdown list above to load their products, requirements, and ordering history.
                        </p>
                    </div>
                )}

            </form>
        </div>
    );
};

export default Purchasing;
