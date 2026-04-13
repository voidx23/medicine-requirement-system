import { useState, useEffect, useMemo } from 'react';
import { CheckCircle, XCircle, ChevronDown, ChevronUp, RotateCw, Trash2, ListPlus, ListX, Store, Users, Filter, PackageCheck, Edit, Search, Calendar } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { useContext } from 'react';
import AuthContext from '../context/AuthContext';
import Button from '../components/UI/Button';
import PasswordConfirmModal from '../components/UI/PasswordConfirmModal';
import { RequestCardSkeleton } from '../components/UI/Skeleton';

const AdminRequests = () => {
    const { user } = useContext(AuthContext);
    const { showConfirm, showToast } = useNotification();
    const [requests, setRequests] = useState([]);
    const [historyRequests, setHistoryRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [expandedId, setExpandedId] = useState(null);
    const [actionModal, setActionModal] = useState({ isOpen: false, type: 'delete', requestId: null });
    const [dailyListIds, setDailyListIds] = useState(new Set());

    // Local state to track packing progress for the expanded request
    // structure: { [requestId]: { [itemId]: 'packed' | 'pending' } }
    const [packingState, setPackingState] = useState({});

    // Filter State
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
    const [selectedPharmacistId, setSelectedPharmacistId] = useState('all');
    
    // History Filter State
    const [branches, setBranches] = useState([]);
    const [historyFilter, setHistoryFilter] = useState({
        branchId: 'all',
        startDate: '',
        endDate: ''
    });

    const fetchRequests = async (isBackground = false) => {
        if (!isBackground) setLoading(true); 
        try {
            const [{ data: requestsData }, { data: todayData }] = await Promise.all([
                api.get('/requests?status=pending'),
                api.get('/requirements/today'),
                isBackground ? Promise.resolve() : new Promise(resolve => setTimeout(resolve, 800))
            ]);
            setRequests(requestsData);
            
            // Only initialize packing state for new requests (don't overwrite active packing progress)
            setPackingState(prev => {
                const newState = { ...prev };
                requestsData.forEach(req => {
                    if (!newState[req._id]) {
                        const itemStates = {};
                        req.items.forEach(item => {
                            itemStates[item._id] = item.status;
                        });
                        newState[req._id] = itemStates;
                    }
                });
                return newState;
            });
            
            const ids = new Set(todayData.items.map(item => item.medicineId?._id || item.medicineId));
            setDailyListIds(ids);
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            if (!isBackground) setLoading(false);
        }
    };

    const fetchBranches = async () => {
        try {
            const { data } = await api.get('/branches');
            setBranches(data);
        } catch (error) {
            console.error("Failed to fetch branches", error);
        }
    };

    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const query = new URLSearchParams({ status: 'completed,rejected,approved,partially_fulfilled' });
            if (historyFilter.branchId !== 'all') query.append('branchId', historyFilter.branchId);
            if (historyFilter.startDate) query.append('startDate', historyFilter.startDate);
            if (historyFilter.endDate) query.append('endDate', historyFilter.endDate);

            const { data } = await api.get(`/requests?${query.toString()}`);
            setHistoryRequests(data);
            
            setExpandedId(null); // Close any expanded rows
        } catch (error) {
            showToast('Failed to fetch history', 'error');
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
        fetchBranches();

        const intervalId = setInterval(() => {
            fetchRequests(true);
        }, 10000);

        return () => clearInterval(intervalId);
    }, []);

    // --- Computed Data for Sidebar ---
    const pharmacistStats = useMemo(() => {
        const stats = {};
        requests.forEach(req => {
            const id = req.pharmacistId?._id || 'unknown';
            const name = req.pharmacistId?.name || 'Unknown';
            if (!stats[id]) {
                stats[id] = { id, name, count: 0, pending: 0 };
            }
            stats[id].count += 1;
            if (req.status === 'pending') {
                stats[id].pending += 1;
            }
        });
        return Object.values(stats).sort((a, b) => b.pending - a.pending);
    }, [requests]);

    const filteredRequests = useMemo(() => {
        if (selectedPharmacistId === 'all') return requests;
        return requests.filter(req => (req.pharmacistId?._id || 'unknown') === selectedPharmacistId);
    }, [requests, selectedPharmacistId]);

    const totalPending = requests.filter(r => r.status === 'pending').length;

    // --- Actions ---
    const updateStatus = async (id, status) => {
        const isConfirmed = await showConfirm(`Are you sure you want to mark this as ${status}?`, status === 'rejected' ? 'danger' : 'success');
        if (!isConfirmed) return;

        try {
            await api.put(`/requests/${id}/status`, { status });
            fetchRequests();
            showToast(`Request marked as ${status}`, status === 'approved' ? 'success' : 'info');
        } catch (error) {
            console.error(error);
            showToast('Failed to update status', 'error');
        }
    };

    const toggleShortlist = async (medicineId, medicineName) => {
        const isAdded = dailyListIds.has(medicineId);
        try {
            if (isAdded) {
                await api.delete(`/requirements/item/${medicineId}`);
                setDailyListIds(prev => { const next = new Set(prev); next.delete(medicineId); return next; });
                showToast(`Removed ${medicineName}`, 'info');
            } else {
                await api.post('/requirements/add-item', { medicineId });
                setDailyListIds(prev => { const next = new Set(prev); next.add(medicineId); return next; });
                showToast(`Added ${medicineName}`, 'success');
            }
        } catch (error) {
            showToast(error.response?.data?.message || 'Action failed', 'error');
        }
    };
    
    // New: Action Handlers for Modal
    const handleDeleteClick = (id) => setActionModal({ isOpen: true, type: 'delete', requestId: id });
    const handleEditClick = (id) => setActionModal({ isOpen: true, type: 'edit', requestId: id });

    const handleConfirmAction = async (password) => {
        const { type, requestId } = actionModal;
        try {
            if (type === 'delete') {
                await api.delete(`/requests/${requestId}`, { data: { password } });
                showToast('Request deleted successfully', 'success');
            } else if (type === 'edit') {
                await api.put(`/requests/${requestId}/reset`, { password });
                showToast('Request unlocked for editing', 'success');
            }
            
            setActionModal({ isOpen: false, type: 'delete', requestId: null });
            fetchRequests(); // Refresh data
        } catch (error) {
             throw error; // Let modal handle error display
        }
    };

    const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);

    // Toggle item packed status LOCALLY
    const toggleItemPacked = (requestId, itemId) => {
        setPackingState(prev => {
            const requestState = prev[requestId] || {};
            const currentStatus = requestState[itemId] || 'pending';
            const newStatus = currentStatus === 'packed' ? 'pending' : 'packed';
            
            return {
                ...prev,
                [requestId]: {
                    ...requestState,
                    [itemId]: newStatus
                }
            };
        });
    };

    // New: Batch Fulfill Action
    const handleCompleteFulfillment = async (reqId) => {
        const isConfirmed = await showConfirm(
            "Are you sure you want to complete this request? This will save all packing statuses and finalize the list.",
            "success"
        );
        
        if (!isConfirmed) return;

        try {
            // Prepare items payload from current local state
            const currentRequestState = packingState[reqId] || {};
            const itemsToUpdate = Object.entries(currentRequestState).map(([itemId, status]) => ({
                _id: itemId,
                status
            }));

            await api.put(`/requests/${reqId}/fulfill`, { items: itemsToUpdate });
            
            showToast('Fulfillment completed successfully', 'success');
            fetchRequests(); // Refresh to get updated status and lock UI
        } catch (error) {
            console.error(error);
            showToast('Failed to complete fulfillment', 'error');
        }
    };

    return (
        <div style={{ paddingBottom: '2rem' }}>
            {/* Page Header */}
            <div className="flex justify-between items-center mb-6" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <h1 className="header-title">Pharmacist Requests</h1>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', background: 'var(--glass-bg)', padding: '0.25rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                        <button
                            onClick={() => setActiveTab('pending')}
                            style={{
                                padding: '0.5rem 1rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s',
                                background: activeTab === 'pending' ? 'white' : 'transparent',
                                color: activeTab === 'pending' ? 'var(--primary)' : 'var(--text-muted)',
                                boxShadow: activeTab === 'pending' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                display: 'flex', alignItems: 'center', gap: '0.5rem'
                            }}
                        >
                           <Store size={18} /> Active
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            style={{
                                padding: '0.5rem 1rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s',
                                background: activeTab === 'history' ? 'white' : 'transparent',
                                color: activeTab === 'history' ? 'var(--primary)' : 'var(--text-muted)',
                                boxShadow: activeTab === 'history' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                display: 'flex', alignItems: 'center', gap: '0.5rem'
                            }}
                        >
                           <Calendar size={18} /> History
                        </button>
                    </div>

                    {activeTab === 'pending' && (
                        <Button onClick={fetchRequests} disabled={loading} icon={RotateCw} aria-label="Refresh requests">
                            {loading ? 'Refreshing...' : 'Refresh'}
                        </Button>
                    )}
                </div>
            </div>

            {/* Split Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem', alignItems: 'start' }}>
                
                {/* --- Left Sidebar (Filters) --- */}
                <div className="glass-panel" style={{ padding: '1rem', position: 'sticky', top: '100px' }}>
                    {activeTab === 'pending' ? (
                        <>
                            <h3 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', letterSpacing: '0.5px' }}>
                                <Filter size={14} /> FILTER ACTIVE BY BRANCH
                            </h3>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {/* 'All' Option */}
                        <button
                            onClick={() => setSelectedPharmacistId('all')}
                            aria-label="Show all requests"
                            style={{
                                width: '100%', textAlign: 'left', padding: '0.75rem 1rem',
                                borderRadius: '8px', border: 'none', cursor: 'pointer',
                                background: selectedPharmacistId === 'all' ? 'var(--primary)' : 'transparent',
                                color: selectedPharmacistId === 'all' ? 'white' : 'var(--text-main)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                transition: 'all 0.2s', fontWeight: 500
                            }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <Store size={18} /> All Requests
                            </span>
                            {totalPending > 0 && (
                                <span style={{ 
                                    background: selectedPharmacistId === 'all' ? 'rgba(255,255,255,0.2)' : 'var(--primary-light)', 
                                    color: selectedPharmacistId === 'all' ? 'white' : 'var(--primary)',
                                    padding: '0.1rem 0.5rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700
                                }}>
                                    {totalPending}
                                </span>
                            )}
                        </button>

                        <div style={{ height: '1px', background: 'rgba(0,0,0,0.05)', margin: '0.5rem 0' }}></div>

                        {/* Individual Pharmacists */}
                        {pharmacistStats.map(pharm => (
                            <button
                                key={pharm.id}
                                onClick={() => setSelectedPharmacistId(pharm.id)}
                                aria-label={`Show requests from ${pharm.name}`}
                                style={{
                                    width: '100%', textAlign: 'left', padding: '0.75rem 1rem',
                                    borderRadius: '8px', border: 'none', cursor: 'pointer',
                                    background: selectedPharmacistId === pharm.id ? 'white' : 'transparent',
                                    boxShadow: selectedPharmacistId === pharm.id ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                    color: 'var(--text-main)',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: selectedPharmacistId === pharm.id ? 600 : 400 }}>
                                    <Users size={18} style={{ color: selectedPharmacistId === pharm.id ? 'var(--primary)' : 'var(--text-muted)' }} />
                                    {pharm.name}
                                </span>
                                {pharm.pending > 0 && (
                                    <span style={{ 
                                        background: '#fee2e2', color: '#ef4444',
                                        padding: '0.1rem 0.5rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700
                                    }}>
                                        {pharm.pending}
                                    </span>
                                )}
                            </button>
                        ))}
                            </div>
                        </>
                    ) : (
                        <>
                            <h3 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', letterSpacing: '0.5px' }}>
                                <Search size={14} /> SEARCH HISTORY
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>Branch</label>
                                    <select
                                        value={historyFilter.branchId}
                                        onChange={(e) => setHistoryFilter(prev => ({ ...prev, branchId: e.target.value }))}
                                        style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                    >
                                        <option value="all">All Branches</option>
                                        {branches.map(b => (
                                            <option key={b._id} value={b._id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>Start Date</label>
                                    <input
                                        type="date"
                                        value={historyFilter.startDate}
                                        onChange={(e) => setHistoryFilter(prev => ({ ...prev, startDate: e.target.value }))}
                                        style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>End Date</label>
                                    <input
                                        type="date"
                                        value={historyFilter.endDate}
                                        min={historyFilter.startDate}
                                        onChange={(e) => setHistoryFilter(prev => ({ ...prev, endDate: e.target.value }))}
                                        style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                    />
                                </div>
                                
                                <Button 
                                    className="btn-primary w-full"
                                    onClick={fetchHistory}
                                    disabled={historyLoading}
                                    icon={Search}
                                    style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }}
                                >
                                    {historyLoading ? 'Searching...' : 'Search History'}
                                </Button>
                            </div>
                        </>
                    )}
                </div>

                {/* --- Right Content (Request List) --- */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {(activeTab === 'pending' ? loading : historyLoading) ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {Array.from({ length: 4 }).map((_, i) => <RequestCardSkeleton key={i} />)}
                        </div>
                    ) : (activeTab === 'pending' ? filteredRequests : historyRequests).length === 0 ? (
                        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Store size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
                            <p style={{ fontSize: '1.1rem' }}>
                                {activeTab === 'pending' 
                                    ? "No active requests found for this branch." 
                                    : "No history data. Adjust your search filters and click Search."}
                            </p>
                        </div>
                    ) : (
                        (activeTab === 'pending' ? filteredRequests : historyRequests).map((req, index) => {
                            // Extract item statuses for this request from local state
                            const requestItemStates = packingState[req._id] || {};
                            
                            return (
                                <div key={req._id} className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                                     {/* Header Row */}
                                    <div 
                                        style={{ 
                                            padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
                                            background: expandedId === req._id ? 'rgba(255,255,255,0.8)' : 'transparent',
                                            transition: 'background 0.2s'
                                        }}
                                        onClick={() => toggleExpand(req._id)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            {/* Status Line on Left */}
                                            <div style={{ 
                                                width: '4px', height: '40px', borderRadius: '2px', 
                                                background: req.status === 'pending' ? '#f59e0b' : 
                                                            (req.status === 'approved' ? '#f59e0b' : // Treat approved as pending for packing
                                                            (req.status === 'partially_fulfilled' ? '#8b5cf6' : 
                                                            (req.status === 'completed' ? '#22c55e' : '#ef4444')))
                                            }}></div>
                                            
                                            <div>
                                                <div style={{ fontWeight: '600', fontSize: '1.05rem' }}>{req.pharmacistId?.name}</div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                    <span>{new Date(req.createdAt).toLocaleString()}</span>
                                                    {req.submittedBy && <span style={{ color: 'var(--primary)' }}>• Signed by {req.submittedBy}</span>}
                                                    <span style={{ fontWeight: 500 }}>• {req.items?.length || 0} {req.items?.length === 1 ? 'Item' : 'Items'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                            {(req.status === 'pending' || req.status === 'approved') && <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#d97706', background: '#fef3c7', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>PENDING ACTION</span>}
                                            {req.status === 'partially_fulfilled' && <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#7c3aed', background: '#ede9fe', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>FULFILLED PARTIALLY</span>}
                                            {req.status === 'completed' && <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#15803d', background: '#dcfce7', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>COMPLETED</span>}
                                            {req.status === 'rejected' && <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#991b1b', background: '#fee2e2', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>REJECTED</span>}
                                            {expandedId === req._id ? <ChevronUp size={20} color="var(--text-muted)"/> : <ChevronDown size={20} color="var(--text-muted)"/>}
                                        </div>
                                    </div>

                                    {/* Expanded Content */}
                                    {expandedId === req._id && (
                                        <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', borderTop: '1px solid var(--glass-border)' }}>
                                            <div style={{ marginTop: '1rem', width: '100%' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                    <thead>
                                                        <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.9rem', borderBottom: '1px solid #eee' }}>
                                                            <th style={{ padding: '0.75rem 0', width: '50px' }}>#</th>
                                                            {req.status !== 'rejected' && (user?.isSuperAdmin || user?.permissions?.includes('dashboard')) && <th style={{ padding: '0.75rem 0', width: '50px' }}>Packed</th>}
                                                            <th style={{ padding: '0.75rem 0' }}>Medicine</th>
                                                            <th style={{ padding: '0.75rem 0' }}>Supplier</th>
                                                            <th style={{ padding: '0.75rem 0' }}>Qty</th>
                                                            {(user?.isSuperAdmin || user?.permissions?.includes('dashboard')) && <th style={{ padding: '0.75rem 0', textAlign: 'right' }}>Actions</th>}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {req.items.map((item, idx) => {
                                                            // Determine status from local state or fallback to item status
                                                            // For rejected/completed requests, rely purely on item.status
                                                            // For pending requests, use local state
                                                            const isInteractive = req.status === 'pending' || req.status === 'approved'; 
                                                            const currentStatus = isInteractive ? (requestItemStates[item._id] || 'pending') : item.status;
                                                            const isPacked = currentStatus === 'packed';

                                                            return (
                                                                <tr key={idx} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)', background: isPacked ? 'rgba(34, 197, 94, 0.05)' : 'transparent' }}>
                                                                    <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                                                    {req.status !== 'rejected' && (user?.isSuperAdmin || user?.permissions?.includes('dashboard')) && (
                                                                        <td style={{ width: '40px', padding: '0.75rem 0' }}>
                                                                            <button
                                                                                disabled={!isInteractive} 
                                                                                onClick={(e) => { e.stopPropagation(); if(isInteractive) toggleItemPacked(req._id, item._id); }}
                                                                                style={{
                                                                                    border: '2px solid ' + (isPacked ? '#22c55e' : '#e5e7eb'),
                                                                                    borderRadius: '6px',
                                                                                    width: '24px', height: '24px',
                                                                                    background: isPacked ? '#22c55e' : 'white',
                                                                                    color: 'white',
                                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                    cursor: isInteractive ? 'pointer' : 'default', transition: 'all 0.2s',
                                                                                    padding: 0,
                                                                                    opacity: isInteractive ? 1 : 0.6
                                                                                }}
                                                                                title={isInteractive ? "Mark as Packed" : "Status Locked"}
                                                                            >
                                                                                {isPacked && <CheckCircle size={16} />}
                                                                            </button>
                                                                        </td>
                                                                    )}
                                                                    <td style={{ padding: '0.75rem 0', fontWeight: 500, color: isPacked ? 'var(--text-muted)' : 'inherit', textDecoration: isPacked ? 'line-through' : 'none' }}>{item.name}</td>
                                                                    <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{item.medicineId?.supplierId?.name || 'Unknown'}</td>
                                                                    <td style={{ padding: '0.75rem 0', fontWeight: 'bold' }}>{item.quantity}</td>
                                                                    {(user?.isSuperAdmin || user?.permissions?.includes('dashboard')) && (
                                                                        <td style={{ padding: '0.75rem 0', textAlign: 'right' }}>
                                                                            {item.medicineId && (
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); toggleShortlist(item.medicineId._id, item.name); }}
                                                                                    title={dailyListIds.has(item.medicineId._id) ? "Remove" : "Add"}
                                                                                    aria-label={dailyListIds.has(item.medicineId._id) ? `Remove ${item.name} from shortlist` : `Add ${item.name} to shortlist`}
                                                                                    style={{
                                                                                        background: dailyListIds.has(item.medicineId._id) ? '#fee2e2' : 'var(--primary-light)',
                                                                                        border: 'none', borderRadius: '8px', 
                                                                                        width: '32px', height: '32px', cursor: 'pointer',
                                                                                        color: dailyListIds.has(item.medicineId._id) ? '#ef4444' : 'var(--primary)',
                                                                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                                                        transition: 'all 0.2s'
                                                                                    }}
                                                                                >
                                                                                    {dailyListIds.has(item.medicineId._id) ? <ListX size={16} /> : <ListPlus size={16} />}
                                                                                </button>
                                                                            )}
                                                                        </td>
                                                                    )}
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Footer Actions */}
                                            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                                                {user?.isSuperAdmin && (
                                                    <Button variant="danger" icon={Trash2} style={{ marginRight: 'auto' }} onClick={(e) => { e.stopPropagation(); handleDeleteClick(req._id); }} aria-label="Delete request">
                                                        Delete
                                                    </Button>
                                                )}
                                                
                                                {/* Action Buttons based on Status */}
                                                {(req.status === 'pending' || req.status === 'approved') ? (
                                                    (user?.isSuperAdmin || user?.permissions?.includes('dashboard')) && (
                                                        <Button 
                                                            className="btn-primary" 
                                                            style={{ backgroundColor: '#10b981', borderColor: '#10b981' }} // Emerald green 
                                                            icon={PackageCheck} 
                                                            onClick={(e) => { e.stopPropagation(); handleCompleteFulfillment(req._id); }} 
                                                            aria-label="Complete Fulfillment"
                                                        >
                                                            Complete Fulfillment
                                                        </Button>
                                                    )
                                                ) : (
                                                    // Edit button for completed/locked requests
                                                    user?.isSuperAdmin && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleEditClick(req._id); }}
                                                            aria-label="Unlock to Edit"
                                                            title="Unlock Request for Editing"
                                                            style={{
                                                                background: 'rgba(59, 130, 246, 0.1)', 
                                                                border: '1px solid rgba(59, 130, 246, 0.3)', 
                                                                borderRadius: '8px', 
                                                                width: '40px', height: '40px', 
                                                                cursor: 'pointer',
                                                                color: '#3b82f6',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                transition: 'all 0.2s',
                                                                marginLeft: '1rem' // Add some spacing just in case
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.background = '#3b82f6';
                                                                e.currentTarget.style.color = 'white';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                                                                e.currentTarget.style.color = '#3b82f6';
                                                            }}
                                                        >
                                                            <Edit size={20} />
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <PasswordConfirmModal
                isOpen={actionModal.isOpen}
                onClose={() => setActionModal({ isOpen: false, type: 'delete', requestId: null })}
                onConfirm={handleConfirmAction}
                title={actionModal.type === 'delete' ? "Confirm Deletion" : "Confirm Edit"}
                message={actionModal.type === 'delete' 
                    ? "This action is permanent and cannot be undone. Please enter your admin password to confirm."
                    : "Editing a completed request requires admin authorization. Please enter your admin password to unlock this request."
                }
                confirmText={actionModal.type === 'delete' ? "Confirm Deletion" : "Unlock to Edit"}
                variant={actionModal.type === 'delete' ? "danger" : "primary"}
            />
        </div>
    );
};

export default AdminRequests;
