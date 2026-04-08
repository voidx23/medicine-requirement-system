import { useState } from 'react';
import { X, ArrowRightLeft, CheckCircle2, XCircle, Package, Edit, Trash2 } from 'lucide-react';
import taskService from '../../services/taskService';
import { useNotification } from '../../context/NotificationContext';
import AuthContext from '../../context/AuthContext';
import { useContext } from 'react';
import PasswordConfirmModal from '../UI/PasswordConfirmModal';
import api from '../../services/api';

/**
 * TransferRequestModal — shown to the DONOR branch pharmacist to accept/reject.
 * Also used as a read-only status view for the REQUESTER.
 *
 * Props:
 *  task         – full task object (with transferDetails, transferResponse, transferRole)
 *  isOpen       – bool
 *  onClose      – fn
 *  onResponded  – fn() called after successful response so parent can reload
 */
const TransferRequestModal = ({ task, isOpen, onClose, onResponded, isAdminView, onEdit, onDelete }) => {
    const { user } = useContext(AuthContext);
    const { showToast } = useNotification();

    const [itemResponses, setItemResponses] = useState({}); // { itemId: { action, qty, reason } }
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [authAction, setAuthAction] = useState(null); // 'edit' | 'delete'

    const verifyAdminPassword = async (password) => {
        const { data } = await api.post('/auth/verify-password', { password });
        return data.isValid;
    };

    if (!isOpen || !task) return null;

    const { transferDetails: td, transferRole } = task;
    const isDonor = transferRole === 'donor';
    const isRequester = transferRole === 'requester';
    
    // Calculate if overall task is still pending or fully responded
    const allItemsResponded = td?.items?.every(it => it.responseStatus !== 'pending');
    const alreadyResponded = allItemsResponded;

    const isCreatorOrSuperAdmin = user?.isSuperAdmin || task.createdBy?._id === user?._id || task.createdBy === user?._id;

    const handleItemAction = (itemId, action) => {
        setItemResponses(prev => ({
            ...prev,
            [itemId]: { 
                ...prev[itemId], 
                action, 
                qty: action === 'accept' ? (prev[itemId]?.qty || td.items.find(i => i._id === itemId).requestedQty) : '',
                reason: action === 'reject' ? (prev[itemId]?.reason || '') : ''
            }
        }));
    };

    const handleItemQtyChange = (itemId, qty) => {
        setItemResponses(prev => ({ ...prev, [itemId]: { ...prev[itemId], qty } }));
    };

    const handleItemReasonChange = (itemId, reason) => {
        setItemResponses(prev => ({ ...prev, [itemId]: { ...prev[itemId], reason } }));
    };

    const handleSubmit = async () => {
        const responsesArray = td.items
            .filter(it => it.responseStatus === 'pending')
            .map(it => {
                const res = itemResponses[it._id];
                if (!res || !res.action) return null;
                return {
                    itemId: it._id,
                    action: res.action,
                    responseQty: Number(res.qty),
                    rejectionReason: res.reason
                };
            }).filter(Boolean);

        if (responsesArray.length === 0) {
            showToast('Please respond to at least one item', 'error');
            return;
        }

        // Check if all pending items have a response selected
        const pendingItems = td.items.filter(it => it.responseStatus === 'pending');
        if (responsesArray.length < pendingItems.length) {
            showToast('Please provide a response for all items', 'warning');
            // return; // Allow partial if you want, but for now let's encourage full
        }

        setIsSubmitting(true);
        try {
            await taskService.respondToTransfer(task._id, responsesArray);
            showToast('Response submitted successfully', 'success');
            onResponded?.();
            onClose();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to submit response', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Overall Status Logic
    const anyAccepted = td?.items?.some(it => it.responseStatus === 'accepted');
    const anyPending = td?.items?.some(it => it.responseStatus === 'pending');
    
    let statusLabel = anyPending ? 'Partially Pending' : (anyAccepted ? 'Accepted' : 'Rejected');
    if (alreadyResponded && !anyAccepted) statusLabel = 'Rejected';

    const statusColor = {
        pending:  { bg: '#fef9c3', text: '#92400e', label: statusLabel },
        accepted: { bg: '#dcfce7', text: '#166534', label: statusLabel },
        rejected: { bg: '#fee2e2', text: '#991b1b', label: statusLabel },
    }[anyPending ? 'pending' : (anyAccepted ? 'accepted' : 'rejected')];

    return (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
            <div style={{
                background: 'white', borderRadius: '16px', width: '90%', maxWidth: '520px',
                maxHeight: '90vh', overflowY: 'auto',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}>
                {/* Header */}
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ background: '#eff6ff', padding: '0.5rem', borderRadius: '10px', color: '#3b82f6' }}>
                            <ArrowRightLeft size={20} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Medicine Transfer Request</h2>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                                {isDonor ? 'You are being asked to provide medicine' : 'Your transfer request status'}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {/* Admin Edit / Delete */}
                        {isAdminView && isCreatorOrSuperAdmin && (
                            <>
                                {alreadyResponded ? null : (
                                    <button onClick={() => setAuthAction('edit')} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: '0.25rem' }}>
                                        <Edit size={18} />
                                    </button>
                                )}
                                <button onClick={() => setAuthAction('delete')} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.25rem' }}>
                                    <Trash2 size={18} />
                                </button>
                                <div style={{ width: '1px', height: '20px', background: '#e2e8f0', margin: '0 0.25rem' }} />
                            </>
                        )}
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                            <X size={22} />
                        </button>
                    </div>
                </div>

                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Route Info */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eff6ff', borderRadius: '10px', padding: '0.75rem', fontSize: '0.85rem', gap: '1rem' }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase' }}>From</div>
                            <div style={{ fontWeight: 600 }}>{td?.donorBranchId?.name}</div>
                        </div>
                        <ArrowRightLeft size={16} color="#3b82f6" />
                        <div>
                            <div style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase' }}>To</div>
                            <div style={{ fontWeight: 600 }}>{td?.recipientBranchId?.name || task.createdBy?.username}</div>
                        </div>
                    </div>

                    {/* Items Table/List */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <tr>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Medicine</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>Qty</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {td?.items?.map(it => (
                                    <tr key={it._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '0.75rem' }}>{it.medicineName}</td>
                                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>{it.requestedQty}</td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                            {it.responseStatus === 'pending' ? (
                                                <span style={{ color: '#d97706', fontWeight: 500 }}>Pending</span>
                                            ) : it.responseStatus === 'accepted' ? (
                                                <span style={{ color: '#16a34a', fontWeight: 600 }}>Accepted ({it.responseQty})</span>
                                            ) : (
                                                <span style={{ color: '#dc2626', fontWeight: 500 }}>Rejected</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Status Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Status:</span>
                        <span style={{ padding: '0.2rem 0.8rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 600, background: statusColor.bg, color: statusColor.text }}>
                            {statusColor.label}
                        </span>
                    </div>

                    {/* Donor Action Area — per item */}
                    {isDonor && !alreadyResponded && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Your Response</h3>
                            {td.items.filter(it => it.responseStatus === 'pending').map(it => {
                                const res = itemResponses[it._id] || {};
                                return (
                                    <div key={it._id} style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                            <span style={{ fontWeight: 600 }}>{it.medicineName} (Req: {it.requestedQty})</span>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button 
                                                    onClick={() => handleItemAction(it._id, 'accept')}
                                                    style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: res.action === 'accept' ? '2px solid #22c55e' : '1px solid #cbd5e1', background: res.action === 'accept' ? '#f0fdf4' : 'white', color: res.action === 'accept' ? '#16a34a' : '#64748b', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                                                >
                                                    Accept
                                                </button>
                                                <button 
                                                    onClick={() => handleItemAction(it._id, 'reject')}
                                                    style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: res.action === 'reject' ? '2px solid #ef4444' : '1px solid #cbd5e1', background: res.action === 'reject' ? '#fff1f2' : 'white', color: res.action === 'reject' ? '#dc2626' : '#64748b', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                        {res.action === 'accept' && (
                                            <input 
                                                type="number" 
                                                min="1"
                                                value={res.qty}
                                                onChange={(e) => handleItemQtyChange(it._id, e.target.value)}
                                                placeholder="Qty to give"
                                                style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #86efac', fontSize: '0.85rem' }}
                                            />
                                        )}
                                        {res.action === 'reject' && (
                                            <input 
                                                type="text" 
                                                value={res.reason}
                                                onChange={(e) => handleItemReasonChange(it._id, e.target.value)}
                                                placeholder="Rejection reason..."
                                                style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #fca5a5', fontSize: '0.85rem' }}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                            
                            <button 
                                onClick={handleSubmit} 
                                disabled={isSubmitting}
                                style={{ marginTop: '0.5rem', padding: '0.9rem', borderRadius: '10px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)' }}
                            >
                                {isSubmitting ? 'Submitting...' : 'Send Response'}
                            </button>
                        </div>
                    )}

                    {/* Overall Rejection Reasons (if any) */}
                    {alreadyResponded && td.items.some(it => it.responseStatus === 'rejected') && (
                        <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '1rem', fontSize: '0.85rem' }}>
                            <div style={{ fontWeight: 600, color: '#991b1b', marginBottom: '0.5rem' }}>Rejection Details:</div>
                            {td.items.filter(it => it.responseStatus === 'rejected').map(it => (
                                <div key={it._id} style={{ marginBottom: '0.25rem', color: '#b91c1c' }}>
                                    • <strong>{it.medicineName}</strong>: {it.rejectionReason}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Admin Password Confirm for Edit / Delete */}
            <PasswordConfirmModal
                isOpen={!!authAction}
                onClose={() => setAuthAction(null)}
                title={authAction === 'edit' ? 'Verify Edit' : 'Confirm Deletion'}
                message={`Enter your admin password to ${authAction === 'edit' ? 'edit' : 'delete'} this transfer request.`}
                confirmText={authAction === 'edit' ? 'Proceed to Edit' : 'Delete'}
                variant={authAction === 'edit' ? 'primary' : 'danger'}
                onConfirm={async (pwd) => {
                    const isValid = await verifyAdminPassword(pwd);
                    if (!isValid) throw new Error('Invalid Password');
                    const action = authAction;
                    setAuthAction(null);
                    if (action === 'edit') {
                        onClose();
                        setTimeout(() => onEdit(task), 100);
                    } else {
                        onDelete(task._id);
                        onClose();
                    }
                }}
            />
        </div>
    );
};

export default TransferRequestModal;
