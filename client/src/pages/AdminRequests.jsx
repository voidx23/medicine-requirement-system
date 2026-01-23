import { useState, useEffect, useMemo } from 'react';
import { CheckCircle, XCircle, ChevronDown, ChevronUp, RotateCw, Trash2, ListPlus, ListX, Store, Users, Filter } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import Button from '../components/UI/Button';
import PasswordConfirmModal from '../components/UI/PasswordConfirmModal';

const AdminRequests = () => {
    const { showConfirm, showToast } = useNotification();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, requestId: null });
    const [dailyListIds, setDailyListIds] = useState(new Set());

    // Filter State
    const [selectedPharmacistId, setSelectedPharmacistId] = useState('all');

    const fetchRequests = async () => {
        setLoading(true); 
        try {
            const [{ data: requestsData }, { data: todayData }] = await Promise.all([
                api.get('/requests'),
                api.get('/requirements/today'),
                new Promise(resolve => setTimeout(resolve, 800))
            ]);
            setRequests(requestsData);
            
            const ids = new Set(todayData.items.map(item => item.medicineId?._id || item.medicineId));
            setDailyListIds(ids);
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    // --- Computed Data for Sidebar ---
    const pharmacistStats = useMemo(() => {
        const stats = {};
        requests.forEach(req => {
            const id = req.pharmacistId?._id || 'unknown';
            const name = req.pharmacistId?.username || 'Unknown';
            if (!stats[id]) {
                stats[id] = { id, name, count: 0, pending: 0 };
            }
            stats[id].count += 1;
            if (req.status === 'pending') {
                stats[id].pending += 1;
            }
        });
        // Convert to array and sort (optional: put pending first)
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
    
    const handleDeleteClick = (id) => setDeleteModal({ isOpen: true, requestId: id });

    const handleConfirmDelete = async (password) => {
        try {
            await api.delete(`/requests/${deleteModal.requestId}`, { data: { password } });
            setDeleteModal({ isOpen: false, requestId: null });
            fetchRequests();
            showToast('Request deleted successfully', 'success');
        } catch (error) {
             throw error; 
        }
    };

    const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);

    return (
        <div style={{ paddingBottom: '2rem' }}>
            {/* Page Header */}
            <div className="flex justify-between items-center mb-6" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h1 className="header-title">Pharmacist Requests</h1>
                <Button onClick={fetchRequests} disabled={loading} icon={RotateCw} aria-label="Refresh requests">
                    {loading ? 'Refreshing...' : 'Refresh'}
                </Button>
            </div>

            {/* Split Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem', alignItems: 'start' }}>
                
                {/* --- Left Sidebar (Filters) --- */}
                <div className="glass-panel" style={{ padding: '1rem', position: 'sticky', top: '100px' }}>
                    <h3 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', letterSpacing: '0.5px' }}>
                        <Filter size={14} /> FILTER BY BRANCH
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
                </div>

                {/* --- Right Content (Request List) --- */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading requests...</div>
                    ) : filteredRequests.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Store size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
                            <p style={{ fontSize: '1.1rem' }}>No requests found for this filter.</p>
                        </div>
                    ) : (
                        filteredRequests.map((req, index) => (
                            <div key={req._id} className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                                 {/* Header Row (Same as before but cleaner) */}
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
                                        <div style={{ width: '4px', height: '40px', borderRadius: '2px', background: req.status === 'pending' ? '#f59e0b' : (req.status === 'approved' ? '#22c55e' : '#ef4444') }}></div>
                                        
                                        <div>
                                            <div style={{ fontWeight: '600', fontSize: '1.05rem' }}>{req.pharmacistId?.username}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                <span>{new Date(req.createdAt).toLocaleString()}</span>
                                                {req.submittedBy && <span style={{ color: 'var(--primary)' }}>• Signed by {req.submittedBy}</span>}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                         {req.status === 'pending' && <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#d97706', background: '#fef3c7', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>PENDING REVIEW</span>}
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
                                                        <th style={{ padding: '0.75rem 0' }}>Medicine</th>
                                                        <th style={{ padding: '0.75rem 0' }}>Supplier</th>
                                                        <th style={{ padding: '0.75rem 0' }}>Qty</th>
                                                        <th style={{ padding: '0.75rem 0', textAlign: 'right' }}>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {req.items.map((item, idx) => (
                                                        <tr key={idx} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                                                            <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                                            <td style={{ padding: '0.75rem 0', fontWeight: 500 }}>{item.name}</td>
                                                            <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{item.medicineId?.supplierId?.name || 'Unknown'}</td>
                                                            <td style={{ padding: '0.75rem 0', fontWeight: 'bold' }}>{item.quantity}</td>
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
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Footer Actions */}
                                        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                                            <Button variant="danger" icon={Trash2} style={{ marginRight: 'auto' }} onClick={(e) => { e.stopPropagation(); handleDeleteClick(req._id); }} aria-label="Delete request">
                                                Delete
                                            </Button>
                                            {req.status === 'pending' && (
                                                <>
                                                    <Button variant="outline" icon={XCircle} style={{ color: '#ef4444', borderColor: '#fee2e2' }} onClick={(e) => { e.stopPropagation(); updateStatus(req._id, 'rejected'); }} aria-label="Reject request">
                                                        Reject
                                                    </Button>
                                                    <Button className="btn-primary" style={{ backgroundColor: '#22c55e', borderColor: '#22c55e' }} icon={CheckCircle} onClick={(e) => { e.stopPropagation(); updateStatus(req._id, 'approved'); }} aria-label="Approve request">
                                                        Mark as Done
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            <PasswordConfirmModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, requestId: null })}
                onConfirm={handleConfirmDelete}
                title="Confirm Deletion"
                message="This action is permanent and cannot be undone. Please enter your admin password to confirm."
            />
        </div>
    );
};

export default AdminRequests;
