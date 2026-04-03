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

    const [action, setAction] = useState(null); // null | 'accept' | 'reject'
    const [responseQty, setResponseQty] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [authAction, setAuthAction] = useState(null); // 'edit' | 'delete'

    const verifyAdminPassword = async (password) => {
        const { data } = await api.post('/auth/verify-password', { password });
        return data.isValid;
    };

    if (!isOpen || !task) return null;

    const { transferDetails: td, transferResponse: tr, transferRole } = task;
    const isDonor = transferRole === 'donor';
    const isRequester = transferRole === 'requester';
    const alreadyResponded = tr?.responseStatus !== 'pending';

    const isCreatorOrSuperAdmin = user?.isSuperAdmin || task.createdBy?._id === user?._id || task.createdBy === user?._id;

    const handleSubmit = async () => {
        if (action === 'accept' && (!responseQty || Number(responseQty) <= 0)) {
            showToast('Please enter a valid quantity to give', 'error');
            return;
        }
        if (action === 'reject' && !rejectionReason.trim()) {
            showToast('Please enter a reason for rejection', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            await taskService.respondToTransfer(
                task._id,
                action,
                action === 'accept'
                    ? { responseQty: Number(responseQty) }
                    : { rejectionReason },
                user.token
            );
            showToast(
                action === 'accept' ? 'Transfer accepted successfully!' : 'Transfer rejected.',
                action === 'accept' ? 'success' : 'info'
            );
            onResponded?.();
            onClose();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to submit response', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const statusColor = {
        pending:  { bg: '#fef9c3', text: '#92400e', label: 'Awaiting Response' },
        accepted: { bg: '#dcfce7', text: '#166534', label: 'Accepted' },
        rejected: { bg: '#fee2e2', text: '#991b1b', label: 'Rejected' },
    }[tr?.responseStatus || 'pending'];

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
                    {/* Medicine Info Card */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                            <Package size={20} color="#6366f1" />
                            <span style={{ fontWeight: 600, color: '#1e293b' }}>Transfer Details</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.9rem' }}>
                            <div>
                                <div style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '0.2rem' }}>Medicine</div>
                                <div style={{ fontWeight: 600, color: '#1e293b' }}>{td?.medicineName}</div>
                            </div>
                            <div>
                                <div style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '0.2rem' }}>Requested Qty</div>
                                <div style={{ fontWeight: 600, color: '#1e293b' }}>{td?.requestedQty} unit(s)</div>
                            </div>
                            <div>
                                <div style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '0.2rem' }}>Requesting Branch</div>
                                <div style={{ fontWeight: 500, color: '#334155' }}>{td?.recipientBranchId?.username || task.createdBy?.username}</div>
                            </div>
                            <div>
                                <div style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '0.2rem' }}>Donor Branch</div>
                                <div style={{ fontWeight: 500, color: '#334155' }}>{td?.donorBranchId?.username}</div>
                            </div>
                        </div>
                    </div>

                    {/* Status Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Status:</span>
                        <span style={{ padding: '0.2rem 0.8rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 600, background: statusColor.bg, color: statusColor.text }}>
                            {statusColor.label}
                        </span>
                    </div>

                    {/* Already Responded — show result */}
                    {alreadyResponded && (
                        <div style={{
                            background: tr.responseStatus === 'accepted' ? '#f0fdf4' : '#fff1f2',
                            border: `1px solid ${tr.responseStatus === 'accepted' ? '#bbf7d0' : '#fecdd3'}`,
                            borderRadius: '10px', padding: '1rem'
                        }}>
                            {tr.responseStatus === 'accepted' ? (
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                    <CheckCircle2 size={20} color="#16a34a" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#166534' }}>Transfer Accepted</div>
                                        <div style={{ fontSize: '0.88rem', color: '#15803d', marginTop: '0.25rem' }}>
                                            {td?.donorBranchId?.username} will provide <strong>{tr.responseQty} unit(s)</strong> of {td?.medicineName}.
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                    <XCircle size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#991b1b' }}>Transfer Rejected</div>
                                        <div style={{ fontSize: '0.88rem', color: '#b91c1c', marginTop: '0.25rem' }}>
                                            Reason: "{tr.rejectionReason}"
                                        </div>
                                    </div>
                                </div>
                            )}
                            {tr.respondedAt && (
                                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.75rem' }}>
                                    Responded on {new Date(tr.respondedAt).toLocaleString()}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Donor Action Area — only if pending and I am the donor */}
                    {isDonor && !alreadyResponded && (
                        <>
                            {/* Pick action */}
                            {!action && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <button
                                        onClick={() => setAction('accept')}
                                        style={{
                                            padding: '0.9rem', borderRadius: '10px', border: '2px solid #22c55e',
                                            background: '#f0fdf4', color: '#16a34a', fontWeight: 600, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                            fontSize: '0.95rem', transition: 'all 0.2s'
                                        }}
                                        onMouseOver={e => e.currentTarget.style.background = '#dcfce7'}
                                        onMouseOut={e => e.currentTarget.style.background = '#f0fdf4'}
                                    >
                                        <CheckCircle2 size={18} /> Accept
                                    </button>
                                    <button
                                        onClick={() => setAction('reject')}
                                        style={{
                                            padding: '0.9rem', borderRadius: '10px', border: '2px solid #ef4444',
                                            background: '#fff1f2', color: '#dc2626', fontWeight: 600, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                            fontSize: '0.95rem', transition: 'all 0.2s'
                                        }}
                                        onMouseOver={e => e.currentTarget.style.background = '#fee2e2'}
                                        onMouseOut={e => e.currentTarget.style.background = '#fff1f2'}
                                    >
                                        <XCircle size={18} /> Reject
                                    </button>
                                </div>
                            )}

                            {/* Accept — qty input */}
                            {action === 'accept' && (
                                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '1.25rem' }}>
                                    <label style={{ display: 'block', fontWeight: 600, color: '#166534', marginBottom: '0.6rem' }}>
                                        How many units can you provide?
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={responseQty}
                                        onChange={e => setResponseQty(e.target.value)}
                                        placeholder={`Up to ${td?.requestedQty} requested`}
                                        style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #86efac', fontSize: '1rem', marginBottom: '1rem', boxSizing: 'border-box' }}
                                    />
                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        <button onClick={() => setAction(null)} style={{ flex: 1, padding: '0.7rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', cursor: 'pointer', fontWeight: 500 }}>
                                            Back
                                        </button>
                                        <button onClick={handleSubmit} disabled={isSubmitting} style={{ flex: 2, padding: '0.7rem', borderRadius: '8px', border: 'none', background: '#22c55e', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                                            {isSubmitting ? 'Submitting...' : 'Confirm Acceptance'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Reject — reason input */}
                            {action === 'reject' && (
                                <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '1.25rem' }}>
                                    <label style={{ display: 'block', fontWeight: 600, color: '#991b1b', marginBottom: '0.6rem' }}>
                                        Reason for rejection <span style={{ fontWeight: 400, color: '#b91c1c' }}>(required)</span>
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={rejectionReason}
                                        onChange={e => setRejectionReason(e.target.value)}
                                        placeholder="e.g. We don't have sufficient stock of this medicine right now..."
                                        style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #fca5a5', fontSize: '0.9rem', marginBottom: '1rem', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }}
                                    />
                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        <button onClick={() => setAction(null)} style={{ flex: 1, padding: '0.7rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', cursor: 'pointer', fontWeight: 500 }}>
                                            Back
                                        </button>
                                        <button onClick={handleSubmit} disabled={isSubmitting} style={{ flex: 2, padding: '0.7rem', borderRadius: '8px', border: 'none', background: '#ef4444', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                                            {isSubmitting ? 'Submitting...' : 'Confirm Rejection'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
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
