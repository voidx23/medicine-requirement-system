import { useState } from 'react';
import { X, Calendar, AlertCircle, CheckCircle, Edit, Trash2 } from 'lucide-react';
import StaffVerificationModal from '../UI/StaffVerificationModal';
import PasswordConfirmModal from '../UI/PasswordConfirmModal';
import TransferRequestModal from './TransferRequestModal';
import api from '../../services/api';
import { useContext } from 'react';
import AuthContext from '../../context/AuthContext';

const TaskDetailModal = ({ task, onClose, onComplete, isAdminView, onEdit, onDelete, onResponded }) => {
    const { user } = useContext(AuthContext);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showVerification, setShowVerification] = useState(false);
    const [authAction, setAuthAction] = useState(null);

    if (!task) return null;

    const isCreatorOrSuperAdmin = user?.isSuperAdmin || task.createdBy?._id === user?._id || task.createdBy === user?._id;

    // Route transfer_request tasks to their own modal
    if (task.type === 'transfer_request') {
        return (
            <TransferRequestModal
                task={task}
                isOpen={true}
                onClose={onClose}
                onResponded={onResponded}
                isAdminView={isAdminView}
                onEdit={onEdit}
                onDelete={onDelete}
            />
        );
    }

    const myAssignment = task.myAssignment;
    const isCompleted = myAssignment?.status === 'Completed';

    // Check if task is fully completed (if viewing as admin)
    const isFullyCompleted = task.assignments && task.assignments.length > 0 && 
                             task.assignments.every(assign => assign.status === 'Completed');

    const verifyAdminPassword = async (password) => {
        const { data } = await api.post('/auth/verify-password', { password });
        return data.isValid;
    };

    const handlePreComplete = () => {
        // Trigger verification modal before actual completion
        setShowVerification(true);
    };

    const handleVerifiedComplete = async (staffName) => {
        setIsSubmitting(true);
        // Include staffName in the comment or as a separate parameter if the backend supports it.
        // For now, we prepend the staff signature to the comment.
        const signedComment = comment ? `[Signed by: ${staffName}] ${comment}` : `[Signed by: ${staffName}] Task Completed`;
        
        await onComplete(task._id, 'Completed', signedComment);
        setIsSubmitting(false);
        setShowVerification(false);
    };

    return (
        <>
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="modal-content" style={{ width: '90%', maxWidth: '600px', backgroundColor: 'white', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                {/* Header */}
                <div style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#0f172a' }}>{task.title}</h2>
                        <span style={{ padding: '0.25rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#f1f5f9', color: '#475569' }}>
                            {task.priority} Priority
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {isAdminView && isCreatorOrSuperAdmin && (
                            <>
                                {onEdit && !isFullyCompleted && (
                                    <button onClick={() => setAuthAction('edit')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: '0.25rem' }} title="Edit Task">
                                        <Edit size={20} />
                                    </button>
                                )}
                                {onDelete && (
                                    <button onClick={() => setAuthAction('delete')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.25rem' }} title="Delete Task">
                                        <Trash2 size={20} />
                                    </button>
                                )}
                                {(onEdit || onDelete) && (
                                    <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0', margin: '0 0.5rem' }}></div>
                                )}
                            </>
                        )}
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '0.25rem' }}>
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Instructions</h4>
                        <p style={{ margin: 0, color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{task.description}</p>
                    </div>

                    {task.dueDate && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', backgroundColor: '#fff7ed', color: '#c2410c', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                            <Calendar size={18} />
                            <span style={{ fontWeight: 500 }}>Due by: {new Date(task.dueDate).toLocaleDateString()}</span>
                        </div>
                    )}

                    {/* Admin View Details */}
                    {isAdminView && task.assignments && (
                        <div>
                            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pharmacy Progress</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {task.assignments.map(assign => (
                                    <div key={assign.pharmacyId?._id || assign.pharmacyId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                                        <div>
                                            <div style={{ fontWeight: 500, color: '#1e293b' }}>{assign.pharmacyId?.name || 'Unknown Pharmacy'}</div>
                                            {assign.comment && <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>"{assign.comment}"</div>}
                                        </div>
                                        <div>
                                            {assign.status === 'Completed' ? (
                                                <span style={{ color: '#22c55e', fontSize: '0.875rem', fontWeight: 600 }}>Completed</span>
                                            ) : (
                                                <span style={{ color: '#f59e0b', fontSize: '0.875rem', fontWeight: 600 }}>Pending</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Pharmacy Action Area */}
                    {!isAdminView && myAssignment && (
                        <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                            {isCompleted ? (
                                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1rem', borderRadius: '0.5rem', color: '#166534', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                                    <CheckCircle size={20} style={{ marginTop: '0.125rem' }} />
                                    <div>
                                        <div style={{ fontWeight: 600 }}>You have completed this task</div>
                                        {myAssignment.completedAt && <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>Completed on {new Date(myAssignment.completedAt).toLocaleString()}</div>}
                                        {myAssignment.comment && <div style={{ fontSize: '0.875rem', marginTop: '0.5rem', fontStyle: 'italic' }}>Your note: "{myAssignment.comment}"</div>}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#334155' }}>
                                        Completion Note (Optional)
                                    </label>
                                    <textarea 
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        placeholder="Add a note about completing this task (e.g. Stock successfully updated)..."
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', minHeight: '80px', marginBottom: '1rem', fontFamily: 'inherit' }}
                                    />
                                    <button 
                                        onClick={handlePreComplete}
                                        disabled={isSubmitting}
                                        className="btn btn-primary"
                                        style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '0.75rem' }}
                                    >
                                        {isSubmitting ? 'Submitting...' : 'Mark as Completed'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>

            {/* Inject Admin Password Modal for Edit/Delete */}
            <PasswordConfirmModal
                isOpen={!!authAction}
                onClose={() => setAuthAction(null)}
                title={authAction === 'edit' ? "Verify Edit" : "Confirm Deletion"}
                message={`Please enter your admin password to ${authAction === 'edit' ? 'edit' : 'delete'} this task.`}
                confirmText={authAction === 'edit' ? "Proceed to Edit" : "Delete Task"}
                variant={authAction === 'edit' ? "primary" : "danger"}
                onConfirm={async (pwd) => {
                    const isValid = await verifyAdminPassword(pwd);
                    if (!isValid) throw new Error('Invalid Password');
                    
                    const actionToTake = authAction;
                    setAuthAction(null); // Close password modal
                    
                    if (actionToTake === 'edit') {
                        onEdit(task);
                    } else {
                        onDelete(task._id);
                        onClose(); // Close detail view after delete
                    }
                }}
            />

            {/* Inject Verification Modal (For Pharmacy Staff) */}
            <StaffVerificationModal 
                isOpen={showVerification}
                onClose={() => setShowVerification(false)}
                onVerified={handleVerifiedComplete}
            />
        </>
    );
};

export default TaskDetailModal;
