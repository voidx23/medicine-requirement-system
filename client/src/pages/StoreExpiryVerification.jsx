import { useState, useEffect } from 'react';
import { PackageSearch, Calendar, CheckCircle, Clock, ChevronDown, ChevronUp, Building2, Trash2, Edit2 } from 'lucide-react';
import api from '../services/api';
import Button from '../components/UI/Button';
import VerificationModal from '../components/Expiry/VerificationModal';
import AdminEditExpiryModal from '../components/Expiry/AdminEditExpiryModal';
import PasswordConfirmModal from '../components/UI/PasswordConfirmModal';
import { useNotification } from '../context/NotificationContext';

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const ReturnCard = ({ ret, onVerify, onDelete, onEdit }) => {
    // Pending cards start expanded; verified cards start collapsed
    const [expanded, setExpanded] = useState(ret.status === 'Submitted');

    const isVerified = ret.status === 'Verified';

    return (
        <div className="glass-panel" style={{
            overflow: 'hidden',
            borderLeft: `4px solid ${isVerified ? '#22c55e' : 'var(--primary)'}`,
        }}>
            {/* Card Header — always visible, click to toggle */}
            <div
                onClick={() => setExpanded(e => !e)}
                style={{
                    padding: '1.25rem 1.5rem',
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    cursor: 'pointer', userSelect: 'none',
                    borderBottom: expanded ? '1px solid var(--glass-border)' : 'none',
                    transition: 'background 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
                {/* Icon */}
                <div style={{
                    width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                    background: isVerified ? '#dcfce7' : 'var(--primary-light)',
                    color: isVerified ? '#16a34a' : 'var(--primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <Calendar size={20} />
                </div>

                {/* Title block */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Branch name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.1rem' }}>
                        <Building2 size={13} color="#94a3b8" />
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                            {ret.branchId?.name || 'Unknown Branch'}
                        </span>
                    </div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                        {MONTHS[(ret.month || 1) - 1]} {ret.year}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {ret.items.length} items · Submitted {new Date(ret.submittedAt).toLocaleDateString()}
                        {ret.verifiedAt && ` · Verified ${new Date(ret.verifiedAt).toLocaleDateString()}`}
                    </p>
                </div>

                {/* Right side */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexShrink: 0 }}>
                    <span style={{
                        background: isVerified ? '#dcfce7' : '#fff7ed',
                        color: isVerified ? '#16a34a' : '#d97706',
                        padding: '0.25rem 0.75rem', borderRadius: '9999px',
                        fontSize: '0.72rem', fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: '0.3rem'
                    }}>
                        {isVerified ? <CheckCircle size={12} /> : <Clock size={12} />}
                        {ret.status}
                    </span>
                    {ret.status === 'Submitted' && (
                        <Button onClick={e => { e.stopPropagation(); onVerify(ret); }} style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem' }}>
                            Verify
                        </Button>
                    )}
                    {ret.status === 'Submitted' && (
                        <button
                            onClick={e => { e.stopPropagation(); onEdit(ret); }}
                            title="Edit Items"
                            style={{
                                background: '#f1f5f9', color: '#64748b',
                                border: 'none', borderRadius: '8px',
                                width: '32px', height: '32px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                            onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
                        >
                            <Edit2 size={16} />
                        </button>
                    )}
                    {ret.status === 'Submitted' && (
                        <button
                            onClick={e => { e.stopPropagation(); onDelete(ret._id); }}
                            title="Delete Return"
                            style={{
                                background: '#fee2e2', color: '#ef4444',
                                border: 'none', borderRadius: '8px',
                                width: '32px', height: '32px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#fca5a5'}
                            onMouseLeave={e => e.currentTarget.style.background = '#fee2e2'}
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                    {expanded ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
                </div>
            </div>

            {/* Collapsible items */}
            {expanded && (
                <div style={{ padding: '1rem 1.5rem' }}>
                    {/* Store note */}
                    {ret.storeNote && (
                        <div style={{ padding: '0.6rem 0.9rem', background: '#fef3c7', borderRadius: '6px', fontSize: '0.82rem', color: '#92400e', marginBottom: '0.75rem' }}>
                            📝 <strong>Store note:</strong> {ret.storeNote}
                        </div>
                    )}

                    {/* Items table */}
                    <div style={{ border: '1px solid #f1f5f9', borderRadius: '8px', overflow: 'hidden' }}>
                        <div style={{
                            display: 'grid', gridTemplateColumns: '1fr 100px 100px 90px',
                            padding: '0.5rem 0.75rem', background: '#f8fafc',
                            fontWeight: 700, fontSize: '0.72rem', color: '#64748b',
                            borderBottom: '1px solid #f1f5f9'
                        }}>
                            <div>Medicine</div>
                            <div style={{ textAlign: 'center' }}>Sent (Bx/L)</div>
                            <div style={{ textAlign: 'center' }}>Rcv (Bx/L)</div>
                            <div style={{ textAlign: 'center' }}>Disposed?</div>
                        </div>
                        <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                            {ret.items.map((item, idx) => {
                                const mismatch = item.qtyReceived !== null && (item.qtyReceived !== item.qtySent || item.qtyReceivedLoose !== item.qtySentLoose);
                                return (
                                    <div key={idx} style={{
                                        display: 'grid', gridTemplateColumns: '1fr 100px 100px 90px',
                                        padding: '0.5rem 0.75rem', alignItems: 'center',
                                        background: mismatch ? 'rgba(239,68,68,0.04)' : idx % 2 === 0 ? '#fff' : '#fafafa',
                                        borderBottom: idx !== ret.items.length - 1 ? '1px solid #f1f5f9' : 'none',
                                        fontSize: '0.85rem'
                                    }}>
                                        <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>
                                            {item.medicineId?.name || item.customName || 'Unknown'}
                                            {item.customName && <span style={{ fontSize: '0.65rem', background: '#fde68a', color: '#92400e', padding: '1px 4px', borderRadius: '3px', marginLeft: '5px' }}>CUSTOM</span>}
                                        </div>
                                        <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '4px' }}>
                                            <span>{item.qtySent}</span>
                                            <span style={{ color: '#94a3b8' }}>/</span>
                                            <span>{item.qtySentLoose || 0}</span>
                                        </div>
                                        <div style={{
                                            textAlign: 'center', fontWeight: 600, display: 'flex', justifyContent: 'center', gap: '4px',
                                            color: item.qtyReceived === null || item.qtyReceived === undefined ? '#94a3b8' : mismatch ? '#dc2626' : '#16a34a'
                                        }}>
                                            <span>{item.qtyReceived !== null && item.qtyReceived !== undefined ? item.qtyReceived : '—'}</span>
                                            <span style={{ color: '#94a3b8', fontWeight: 400 }}>/</span>
                                            <span>{item.qtyReceivedLoose !== null && item.qtyReceivedLoose !== undefined ? item.qtyReceivedLoose : '—'}</span>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            {item.isNonReturnable ? (
                                                <span style={{ 
                                                    background: '#fee2e2', color: '#dc2626', 
                                                    padding: '0.15rem 0.5rem', borderRadius: '4px', 
                                                    fontSize: '0.7rem', fontWeight: 700 
                                                }}>
                                                    DISPOSED
                                                </span>
                                            ) : (
                                                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>No</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const StoreExpiryVerification = () => {
    const { showToast } = useNotification();
    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedReturn, setSelectedReturn] = useState(null);
    const [editingReturn, setEditingReturn] = useState(null);
    const [allMedicines, setAllMedicines] = useState([]);
    const [filter, setFilter] = useState('all'); // 'all' | 'Submitted' | 'Verified'
    const [actionModal, setActionModal] = useState({ isOpen: false, requestId: null });

    const fetchReturns = async () => {
        try {
            setLoading(true);
            const [res, medRes] = await Promise.all([
                api.get('/expiry/all'),
                api.get('/medicines?limit=all')
            ]);
            setReturns(res.data);
            setAllMedicines(medRes.data.medicines || []);
        } catch (error) {
            console.error('Error fetching expiry returns:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchReturns(); }, []);

    const handleDeleteClick = (id) => {
        setActionModal({ isOpen: true, requestId: id });
    };

    const handleConfirmDelete = async (password) => {
        try {
            await api.delete(`/expiry/${actionModal.requestId}`, { data: { password } });
            showToast('Expiry return deleted successfully', 'success');
            setActionModal({ isOpen: false, requestId: null });
            fetchReturns();
        } catch (error) {
            throw error; // Let modal show the error
        }
    };

    const pending = returns.filter(r => r.status === 'Submitted');
    const verified = returns.filter(r => r.status === 'Verified');
    const filtered = filter === 'all' ? returns : returns.filter(r => r.status === filter);

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                    Store Expiry Verification
                </h1>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                    Verify expired items sent from branches before handing them to suppliers.
                </p>
            </div>

            {/* Stats strip */}
            {!loading && returns.length > 0 && (
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.25rem', padding: '0.6rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', alignItems: 'center' }}>
                    {[
                        { label: 'Pending', count: pending.length, color: '#f97316' },
                        { label: 'Verified', count: verified.length, color: '#16a34a' },
                        { label: 'Total', count: returns.length, color: '#64748b' },
                    ].map((stat, i) => (
                        <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', paddingRight: i < 2 ? '1.5rem' : 0, borderRight: i < 2 ? '1px solid #e2e8f0' : 'none' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: stat.color }}>{stat.count}</span>
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{stat.label}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Filter tabs */}
            {!loading && returns.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    {['all', 'Submitted', 'Verified'].map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            style={{
                                padding: '0.4rem 1rem', borderRadius: '9999px', fontSize: '0.82rem', fontWeight: 600,
                                border: filter === f ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                                background: filter === f ? 'var(--primary-light)' : '#fff',
                                color: filter === f ? 'var(--primary)' : 'var(--text-muted)',
                                cursor: 'pointer', transition: 'all 0.15s'
                            }}>
                            {f === 'all' ? 'All' : f}
                        </button>
                    ))}
                </div>
            )}

            {/* Content */}
            {loading ? (
                <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
            ) : filtered.length === 0 ? (
                <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <PackageSearch size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
                    <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>No Expiry Returns</h3>
                    <p>No submissions match the current filter.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {filtered.map(ret => (
                        <ReturnCard 
                            key={ret._id} 
                            ret={ret} 
                            onVerify={setSelectedReturn} 
                            onDelete={handleDeleteClick}
                            onEdit={setEditingReturn}
                        />
                    ))}
                </div>
            )}

            {editingReturn && (
                <AdminEditExpiryModal
                    isOpen={!!editingReturn}
                    onClose={() => setEditingReturn(null)}
                    expiryList={editingReturn}
                    allMedicines={allMedicines}
                    onSuccess={() => {
                        setEditingReturn(null);
                        showToast('Expiry list updated successfully', 'success');
                        fetchReturns();
                    }}
                />
            )}

            {selectedReturn && (
                <VerificationModal
                    isOpen={!!selectedReturn}
                    onClose={() => setSelectedReturn(null)}
                    expiryList={selectedReturn}
                    onSuccess={() => { setSelectedReturn(null); fetchReturns(); }}
                />
            )}

            <PasswordConfirmModal
                isOpen={actionModal.isOpen}
                onClose={() => setActionModal({ isOpen: false, requestId: null })}
                onConfirm={handleConfirmDelete}
                title="Confirm Deletion"
                message="This action is permanent and cannot be undone. Please enter your admin password to confirm."
                confirmText="Confirm Deletion"
                variant="danger"
            />
        </div>
    );
};

export default StoreExpiryVerification;
