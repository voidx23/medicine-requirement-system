import { useState, useEffect, useContext } from 'react';
import { RotateCw, CheckCircle, X, ChevronRight, AlertTriangle, CornerDownRight } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import AuthContext from '../context/AuthContext';

import Modal from '../components/UI/Modal';
import { RequestCardSkeleton } from '../components/UI/Skeleton';

// Warning Modal Component
// Warning Modal Component
const ReorderModal = ({ isOpen, onClose, onConfirm, pendingItems }) => {
    const [selectedItems, setSelectedItems] = useState([]);

    useEffect(() => {
        if (isOpen) {
            // Default select all
            setSelectedItems(pendingItems.map(i => i._id));
        }
    }, [isOpen, pendingItems]);

    const toggleItem = (id) => {
        setSelectedItems(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleAll = () => {
        if (selectedItems.length === pendingItems.length) {
            setSelectedItems([]);
        } else {
            setSelectedItems(pendingItems.map(i => i._id));
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1100
        }} onClick={onClose}>
            <div style={{
                background: 'white', padding: '2rem', borderRadius: '16px', width: '90%', maxWidth: '500px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }} onClick={e => e.stopPropagation()}>
                
                <h3 style={{ marginTop: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CornerDownRight size={24} color="#3b82f6" />
                    Re-order Missing Items
                </h3>

                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem' }}>
                    <AlertTriangle size={24} color="#f97316" style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: '0.9rem', color: '#c2410c' }}>
                        <strong>One-Time Action:</strong> Please select carefully. This action can only be performed <strong>once</strong> for this list. Unselected items will be marked as skipped and cannot be forwarded later.
                    </div>
                </div>

                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#64748b' }}>Select Items to Forward:</span>
                    <button onClick={toggleAll} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontWeight: 600 }}>
                        {selectedItems.length === pendingItems.length ? 'Deselect All' : 'Select All'}
                    </button>
                </div>

                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '1.5rem' }}>
                    {pendingItems.map(item => (
                        <div key={item._id} 
                            onClick={() => toggleItem(item._id)}
                            style={{ 
                                padding: '0.75rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '1rem',
                                background: selectedItems.includes(item._id) ? '#eff6ff' : 'white', cursor: 'pointer'
                            }}>
                            <input 
                                type="checkbox" 
                                checked={selectedItems.includes(item._id)}
                                onChange={() => {}} // handled by div click
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            />
                            <span style={{ fontWeight: 500, color: '#334155' }}>{item.name}</span>
                            <span style={{ marginLeft: 'auto', background: '#e2e8f0', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>
                                x{item.quantity}
                            </span>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'end', gap: '1rem' }}>
                    <button onClick={onClose} style={{
                        padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', cursor: 'pointer', fontWeight: 600
                    }}>
                        Cancel
                    </button>
                    <button 
                        onClick={() => onConfirm(selectedItems)}
                        disabled={selectedItems.length === 0}
                        style={{
                            padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', 
                            background: selectedItems.length === 0 ? '#94a3b8' : '#3b82f6', 
                            color: 'white', cursor: selectedItems.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 600
                        }}>
                        Confirm & Forward
                    </button>
                </div>
            </div>
        </div>
    );
};

const PharmacistHistory = () => {
    const { showToast } = useNotification();
    const { user } = useContext(AuthContext);
    const [myRequests, setMyRequests] = useState([]);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [reorderModalOpen, setReorderModalOpen] = useState(false);
    const [reorderRequestId, setReorderRequestId] = useState(null);
    const [pendingItems, setPendingItems] = useState([]);

    const handleReorderClick = (request) => {
        // Filter items that are NOT packed and NOT already forwarded
        const eligibleItems = request.items.filter(i => i.status !== 'packed' && i.status !== 'forwarded');
        setPendingItems(eligibleItems);
        setReorderRequestId(request._id);
        setReorderModalOpen(true);
    };

    const handleConfirmReorder = async (selectedIds) => {
        try {
            const { data } = await api.post(`/requests/${reorderRequestId}/forward`, { itemsToForward: selectedIds });
            
            // Add forwarded items to LocalStorage Cart
            if (data.forwardedItems && data.forwardedItems.length > 0) {
                const STORAGE_KEY = `pharmacistRequestDraft_${user?._id || 'guest'}`;
                const savedCart = localStorage.getItem(STORAGE_KEY);
                let cartItems = savedCart ? JSON.parse(savedCart) : [];

                // Add forwarded items to LocalStorage Cart
                let newCartItems = [...cartItems];

                data.forwardedItems.forEach(item => {
                    // Check if item is already in cart
                    const existingItemIndex = newCartItems.findIndex(cartItem => 
                        item.isCustom ? cartItem.name.toLowerCase() === item.name.toLowerCase() : cartItem.medicineId === item.medicineId
                    );

                    if (existingItemIndex >= 0) {
                        // Increment quantity if it already exists
                        newCartItems[existingItemIndex].quantity += item.quantity;
                    } else {
                        // Add new item
                        newCartItems.push({
                            _id: item.medicineId || `custom-forwarded-${Date.now()}-${Math.random()}`,
                            medicineId: item.medicineId,
                            name: item.name,
                            quantity: item.quantity,
                            isCustom: item.isCustom,
                            supplierId: null
                        });
                    }
                });

                localStorage.setItem(STORAGE_KEY, JSON.stringify(newCartItems));
            }

            showToast(`Forwarded ${data.forwardedItems?.length || 0} items to your New Request cart`, 'success');
            setReorderModalOpen(false);
            fetchHistory(); // Refresh to show new status
            setSelectedRequest(null); // Close details modal
        } catch (error) {
            showToast('Failed to forward items', 'error');
            console.error(error);
        }
    };

    const getStatusColor = (status) => {
        switch(status) {
            case 'completed': return { bg: '#dcfce7', text: '#166534' }; // Green
            case 'partially_fulfilled': return { bg: '#f3e8ff', text: '#6b21a8' }; // Purple
            case 'approved': return { bg: '#dbeafe', text: '#1e40af' }; // Blue
            case 'rejected': return { bg: '#fee2e2', text: '#991b1b' }; // Red
            default: return { bg: '#fef3c7', text: '#d97706' }; // Pending (Yellow)
        }
    };

    const fetchHistory = async () => {
        setLoading(true);
        try {
            // Wait for both the API call AND a minimum delay of 800ms
            const [{ data }] = await Promise.all([
                api.get('/requests'),
                new Promise(resolve => setTimeout(resolve, 800))
            ]);
            setMyRequests(data);
        } catch (error) {
            console.error("Failed to fetch history", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    return (
        <div>
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="header-title">Requirement History</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Track status of your submitted requirements.</p>
                </div>
                <button 
                    onClick={fetchHistory}
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
                    <span>Refresh</span>
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {Array.from({ length: 4 }).map((_, i) => <RequestCardSkeleton key={i} />)}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {myRequests.map((req, index) => (
                        <div 
                            key={req._id} 
                            className="glass-panel" 
                            onClick={() => setSelectedRequest(req)}
                            style={{ 
                                padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center',
                                cursor: 'pointer', transition: 'all 0.2s ease'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseOut={(e) => e.currentTarget.style.transform = 'none'}
                        >
                            {/* Number Badge */}
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-light)',
                                color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 'bold', fontSize: '0.9rem', flexShrink: 0
                            }}>
                                {myRequests.length - index}
                            </div>

                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
                                            {new Date(req.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </div>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                            {req.items.length} Items Requested
                                        </div>
                                    </div>
                                    <span style={{ 
                                        padding: '0.35rem 1rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600,
                                        background: getStatusColor(req.status).bg,
                                        color: getStatusColor(req.status).text,
                                        border: `1px solid ${getStatusColor(req.status).text}20`
                                    }}>
                                        {req.status === 'partially_fulfilled' ? 'PARTIAL' : req.status.toUpperCase()}
                                    </span>
                                </div>
                                
                                {req.adminNotes && (
                                    <div style={{ 
                                        marginTop: '0.5rem', padding: '0.5rem 0.75rem', 
                                        background: '#fff1f2', borderRadius: '6px', 
                                        fontSize: '0.85rem', color: '#be123c', border: '1px solid #fecdd3'
                                    }}>
                                        <span style={{ fontWeight: 600 }}>Note: </span> {req.adminNotes}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {myRequests.length === 0 && <p className="text-muted">No history found.</p>}
                </div>
            )}

            {/* Details Modal */}
            <Modal
                isOpen={!!selectedRequest}
                onClose={() => setSelectedRequest(null)}
                title={`Request Details - ${selectedRequest ? new Date(selectedRequest.createdAt).toLocaleDateString('en-GB') : ''}`}
            >
                {selectedRequest && (
                    <div>
                        <div style={{ maxHeight: '60vh', overflowY: 'auto', marginBottom: '1.5rem' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                                <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                                    <tr>
                                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0', width: '50px' }}>Sl.No</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Medicine</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', width: '80px' }}>Qty</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', width: '80px' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedRequest.items.map((item, idx) => (
                                        <tr key={idx} style={{ 
                                            borderBottom: '1px solid #f1f5f9', 
                                            background: item.status === 'packed' ? 'rgba(34, 197, 94, 0.03)' : (item.status === 'forwarded' ? 'rgba(59, 130, 246, 0.03)' : '#fff1f2') 
                                        }}>
                                            <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                            <td style={{ padding: '0.75rem', color: 'var(--text-main)', textDecoration: item.status === 'packed' ? 'line-through' : 'none', opacity: item.status === 'packed' ? 0.6 : 1, fontWeight: item.status === 'packed' ? 400 : 500 }}>{item.name}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                {item.status === 'packed' ? (
                                                     <div style={{ 
                                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                        color: '#15803d',
                                                        background: '#dcfce7', width: '28px', height: '28px', borderRadius: '50%',
                                                     }} title="Packed">
                                                        <CheckCircle size={18} />
                                                     </div>
                                                ) : item.status === 'forwarded' ? (
                                                    <div style={{ 
                                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                        color: '#2563eb',
                                                        background: '#dbeafe', width: '28px', height: '28px', borderRadius: '50%',
                                                     }} title="Forwarded to new request">
                                                        <CornerDownRight size={18} />
                                                     </div>
                                                ) : (
                                                    <div style={{ 
                                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                        color: '#b91c1c',
                                                        background: '#fee2e2', width: '28px', height: '28px', borderRadius: '50%',
                                                     }} title="Pending / Out of Stock">
                                                        <X size={18} />
                                                     </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Re-order Button Logic */}
                        {!selectedRequest.forwardingProcessed && 
                         (selectedRequest.status === 'partially_fulfilled' || selectedRequest.status === 'completed') &&
                         selectedRequest.items.some(i => i.status !== 'packed' && i.status !== 'forwarded') && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                                <button 
                                    onClick={() => handleReorderClick(selectedRequest)}
                                    style={{
                                        background: '#3b82f6', color: 'white', border: 'none',
                                        padding: '0.75rem 1.5rem', borderRadius: '10px',
                                        fontWeight: 600, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                        boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.5)'
                                    }}
                                >
                                    <RotateCw size={18} />
                                    Re-order Missing Items
                                </button>
                            </div>
                        )}

                        {selectedRequest.forwardingProcessed && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', color: '#64748b' }}>
                                <CheckCircle size={18} color="#64748b" />
                                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Remaining items processed for re-order</span>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Reorder Modal */}
            <ReorderModal 
                isOpen={reorderModalOpen}
                onClose={() => setReorderModalOpen(false)}
                onConfirm={handleConfirmReorder}
                pendingItems={pendingItems}
            />
        </div>
    );
};

export default PharmacistHistory;
