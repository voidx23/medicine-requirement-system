import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, RotateCw, Trash2, ListPlus, ListX } from 'lucide-react';
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

    const fetchRequests = async () => {
        setLoading(true); 
        try {
            const [{ data: requestsData }, { data: todayData }] = await Promise.all([
                api.get('/requests'),
                api.get('/requirements/today'), // Fetch today's list to check simple existence
                new Promise(resolve => setTimeout(resolve, 800))
            ]);
            setRequests(requestsData);
            
            // Create a Set of medicine IDs already in today's list
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
                // Remove
                await api.delete(`/requirements/item/${medicineId}`);
                setDailyListIds(prev => {
                    const next = new Set(prev);
                    next.delete(medicineId);
                    return next;
                });
                showToast(`Removed ${medicineName} from daily list`, 'info');
            } else {
                // Add
                await api.post('/requirements/add-item', { medicineId });
                setDailyListIds(prev => {
                    const next = new Set(prev);
                    next.add(medicineId);
                    return next;
                });
                showToast(`Added ${medicineName} to daily list`, 'success');
            }
        } catch (error) {
            const msg = error.response?.data?.message || 'Action failed';
            showToast(msg, 'error');
        }
    };
    
    const handleDeleteClick = (id) => {
        setDeleteModal({ isOpen: true, requestId: id });
    };

    const handleConfirmDelete = async (password) => {
        // ... (existing helper) ...
        try {
            await api.delete(`/requests/${deleteModal.requestId}`, {
                data: { password } // Send password in body
            });
            setDeleteModal({ isOpen: false, requestId: null });
            fetchRequests();
            showToast('Request deleted successfully', 'success');
        } catch (error) {
             console.error(error);
             const msg = error.response?.data?.message || 'Failed to delete request';
             showToast(msg, 'error');
             throw error; 
        }
    };

    // ... (rest of helpers) ...

    const toggleExpand = (id) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'approved': return 'bg-green-100 text-green-800';
            case 'rejected': return 'bg-red-100 text-red-800';
            default: return 'bg-yellow-100 text-yellow-800';
        }
    };

    return (
        <div>
            {/* ... header ... */}
            <div className="flex justify-between items-center mb-6" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h1 className="header-title">Pharmacist Requests</h1>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button 
                        onClick={fetchRequests}
                        disabled={loading}
                        style={{ 
                            background: 'rgba(255, 255, 255, 0.8)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255, 255, 255, 0.5)',
                            padding: '0.6rem 1.2rem',
                            borderRadius: '30px',
                            display: 'flex', alignItems: 'center', gap: '0.6rem',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                            color: 'var(--primary)',
                            fontWeight: 600,
                            fontSize: '0.9rem'
                        }}
                        onMouseOver={(e) => { 
                            if(!loading) {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                            }
                        }}
                        onMouseOut={(e) => {
                            if(!loading) {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)';
                            }
                        }}
                    >
                        <RotateCw size={18} className={loading ? "spin-animation" : ""} />
                        <span>Refresh List</span>
                    </button>
                </div>
            </div>

            {loading ? <div>Loading...</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {requests.length === 0 && <p className="text-muted">No requests found.</p>}
                    
                    {requests.map((req, index) => (
                        <div key={req._id} className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                            {/* Header Row */}
                            <div 
                                style={{ 
                                    padding: '1rem 1.5rem', 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    background: expandedId === req._id ? 'rgba(255,255,255,0.8)' : 'transparent'
                                }}
                                onClick={() => toggleExpand(req._id)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    {/* Number Badge */}
                                    <div style={{
                                        width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary-light)',
                                        color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 'bold', fontSize: '0.85rem'
                                    }}>
                                        {requests.length - index}
                                    </div>

                                    <div style={{ 
                                        width: '40px', height: '40px', borderRadius: '50%', 
                                        background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#0284c7', fontWeight: 'bold'
                                    }}>
                                        {req.pharmacistId?.username?.[0]?.toUpperCase() || 'U'}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '600' }}>{req.pharmacistId?.username}</div>
                                        {req.submittedBy && (
                                            <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 500 }}>
                                                Signed by: {req.submittedBy}
                                            </div>
                                        )}
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            {new Date(req.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                    <span style={{ 
                                        padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.85rem',
                                        background: req.status === 'pending' ? '#fef3c7' : (req.status === 'approved' ? '#dcfce7' : '#fee2e2'),
                                        color: req.status === 'pending' ? '#d97706' : (req.status === 'approved' ? '#166534' : '#991b1b')
                                    }}>
                                        {req.status?.toUpperCase()}
                                    </span>
                                    {expandedId === req._id ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                                </div>
                            </div>

                            {/* Expanded Content */}
                            {expandedId === req._id && (
                                <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', borderTop: '1px solid var(--glass-border)' }}>
                                    <div style={{ marginTop: '1rem', width: '100%' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                                    <th style={{ paddingBottom: '0.5rem', width: '50px' }}>Sl.No</th>
                                                    <th style={{ paddingBottom: '0.5rem' }}>Medicine</th>
                                                    <th style={{ paddingBottom: '0.5rem' }}>Supplier</th>
                                                    <th style={{ paddingBottom: '0.5rem' }}>Qty</th>
                                                    <th style={{ paddingBottom: '0.5rem', textAlign: 'right' }}>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {req.items.map((item, idx) => (
                                                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                                        <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                                        <td style={{ padding: '0.75rem 0' }}>{item.name}</td>
                                                        <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)' }}>{item.medicineId?.supplierId?.name || 'Unknown'}</td>
                                                        <td style={{ padding: '0.75rem 0', fontWeight: 'bold' }}>{item.quantity}</td>
                                                        <td style={{ padding: '0.75rem 0', textAlign: 'right' }}>
                                                            {item.medicineId && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleShortlist(item.medicineId._id, item.name);
                                                                    }}
                                                                    title={dailyListIds.has(item.medicineId._id) ? "Remove from Daily List" : "Add to Daily List"}
                                                                    style={{
                                                                        background: dailyListIds.has(item.medicineId._id) ? '#fee2e2' : 'var(--primary-light)',
                                                                        border: 'none',
                                                                        borderRadius: '8px', 
                                                                        width: '32px',
                                                                        height: '32px',
                                                                        cursor: 'pointer',
                                                                        color: dailyListIds.has(item.medicineId._id) ? '#ef4444' : 'var(--primary)',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        transition: 'all 0.2s',
                                                                    }}
                                                                    onMouseOver={(e) => {
                                                                        e.currentTarget.style.transform = 'scale(1.1)';
                                                                    }}
                                                                    onMouseOut={(e) => {
                                                                        e.currentTarget.style.transform = 'scale(1)';
                                                                    }}
                                                                >
                                                                    {dailyListIds.has(item.medicineId._id) ? <ListX size={18} /> : <ListPlus size={18} />}
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Action Buttons */}
                                    {/* Action Buttons */}
                                    <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                        <Button 
                                            variant="danger"
                                            icon={Trash2}
                                            style={{ marginRight: 'auto' }}
                                            onClick={(e) => { e.stopPropagation(); handleDeleteClick(req._id); }}
                                        >
                                            Delete
                                        </Button>

                                        {req.status === 'pending' && (
                                            <>
                                                <Button 
                                                    variant="secondary"
                                                    icon={XCircle}
                                                    style={{ 
                                                        color: '#ef4444', 
                                                        borderColor: '#fee2e2', 
                                                        background: '#fff' 
                                                    }}
                                                    onClick={(e) => { e.stopPropagation(); updateStatus(req._id, 'rejected'); }}
                                                >
                                                    Reject
                                                </Button>
                                                <Button 
                                                    // variant="primary" - Overriding with explicit green
                                                    className="btn-primary" 
                                                    style={{ backgroundColor: '#22c55e', borderColor: '#22c55e' }}
                                                    icon={CheckCircle}
                                                    onClick={(e) => { e.stopPropagation(); updateStatus(req._id, 'approved'); }}
                                                >
                                                    Mark as Done
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

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
