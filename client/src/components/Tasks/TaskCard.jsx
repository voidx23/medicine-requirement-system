import { Calendar, User, CheckCircle, Clock, ArrowRightLeft, Package, XCircle } from 'lucide-react';

const TaskCard = ({ task, onClick, isAdminView }) => {
    const isTransfer = task.type === 'transfer_request';

    const renderPriority = (priority) => {
        let color = '#3b82f6', bg = '#dbeafe';
        if (priority === 'High')   { color = '#f97316'; bg = '#ffedd5'; }
        if (priority === 'Urgent') { color = '#ef4444'; bg = '#fee2e2'; }
        return (
            <span style={{ backgroundColor: bg, color, padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 600 }}>
                {priority}
            </span>
        );
    };

    const renderAdminProgress = () => {
        if (!isAdminView || !task.assignments) return null;
        const total = task.assignments.length;
        const completed = task.assignments.filter(a => a.status === 'Completed').length;
        if (isTransfer) return null; // transfer requests show response status instead
        return (
            <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#64748b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span>Progress</span><span>{completed} / {total} Completed</span>
                </div>
                <div style={{ width: '100%', backgroundColor: '#e2e8f0', borderRadius: '4px', height: '6px' }}>
                    <div style={{ height: '100%', borderRadius: '4px', backgroundColor: completed === total ? '#22c55e' : '#3b82f6', width: `${(completed / total) * 100}%` }} />
                </div>
            </div>
        );
    };

    const renderStatus = () => {
        if (isTransfer) {
            const rs = task.transferResponse?.responseStatus || 'pending';
            const cfg = {
                pending:  { color: '#d97706', bg: '#fef9c3', icon: <Clock size={14}/>,         label: 'Awaiting Response' },
                accepted: { color: '#16a34a', bg: '#dcfce7', icon: <CheckCircle size={14}/>,   label: 'Accepted' },
                rejected: { color: '#dc2626', bg: '#fee2e2', icon: <XCircle size={14}/>,       label: 'Rejected' },
            }[rs];
            return (
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: cfg.color, background: cfg.bg, padding: '0.25rem 0.6rem', borderRadius: '20px', width: 'fit-content' }}>
                    {cfg.icon} {cfg.label}
                </div>
            );
        }

        if (isAdminView || !task.myAssignment) return null;
        const isCompleted = task.myAssignment.status === 'Completed';
        return (
            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                {isCompleted
                    ? <><CheckCircle size={16} color="#22c55e" /><span style={{ color: '#22c55e', fontWeight: 500 }}>Completed</span></>
                    : <><Clock size={16} color="#f59e0b" /><span style={{ color: '#f59e0b', fontWeight: 500 }}>Pending</span></>
                }
            </div>
        );
    };

    return (
        <div
            onClick={() => onClick(task)}
            style={{
                backgroundColor: isTransfer ? '#f0f9ff' : 'white',
                padding: '1.25rem',
                borderRadius: '0.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                border: isTransfer ? '1px solid #bae6fd' : '1px solid #e2e8f0',
                borderLeft: isTransfer ? '4px solid #0ea5e9' : '4px solid transparent',
                transition: 'transform 0.1s, box-shadow 0.1s',
                display: 'flex', flexDirection: 'column', gap: '0.5rem',
            }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)'; }}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                    {isTransfer && (
                        <div style={{ background: '#e0f2fe', color: '#0284c7', borderRadius: '6px', padding: '4px', flexShrink: 0 }}>
                            <ArrowRightLeft size={14} />
                        </div>
                    )}
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isTransfer ? task.transferDetails?.medicineName || task.title : task.title}
                    </h3>
                </div>
                {!isTransfer && renderPriority(task.priority)}
                {isTransfer && (
                    <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0 }}>
                        Transfer
                    </span>
                )}
            </div>

            {isTransfer ? (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#64748b', marginBottom: '0.5rem' }}>
                        <Package size={13} /> <span>Qty: <strong>{task.transferDetails?.requestedQty}</strong></span>
                    </div>
                    {/* From → To route bar */}
                    <div style={{ display: 'flex', alignItems: 'stretch', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', overflow: 'hidden', fontSize: '0.78rem' }}>
                        <div style={{ flex: 1, padding: '0.4rem 0.6rem', textAlign: 'center' }}>
                            <div style={{ color: '#94a3b8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>From</div>
                            <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '0.1rem' }}>{task.transferDetails?.donorBranchId?.username || '—'}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', padding: '0 0.4rem', background: '#e0f2fe', flexShrink: 0 }}>
                            <svg width="20" height="12" viewBox="0 0 28 16" fill="none"><path d="M2 8h22M20 3l6 5-6 5" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                        <div style={{ flex: 1, padding: '0.4rem 0.6rem', textAlign: 'center', borderLeft: '1px solid #bae6fd' }}>
                            <div style={{ color: '#94a3b8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>To</div>
                            <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '0.1rem' }}>{task.transferDetails?.recipientBranchId?.username || task.createdBy?.username || '—'}</div>
                        </div>
                    </div>
                </div>
            ) : (
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {task.description}
                </p>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: 'auto', paddingTop: '0.25rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                {task.dueDate && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Calendar size={14} /><span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                    </div>
                )}
                {task.createdBy?.username && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <User size={14} /><span>From: {task.createdBy.username}</span>
                    </div>
                )}
            </div>

            {renderAdminProgress()}
            {renderStatus()}
        </div>
    );
};

export default TaskCard;
