import { useState, useEffect, useContext } from 'react';
import { PackageSearch, Calendar, CheckCircle, Clock, ChevronDown, ChevronUp, Building2, Trash2, Edit2, Plus } from 'lucide-react';
import api from '../services/api';
import Button from '../components/UI/Button';
import VerificationModal from '../components/Expiry/VerificationModal';
import AdminEditExpiryModal from '../components/Expiry/AdminEditExpiryModal';
import PasswordConfirmModal from '../components/UI/PasswordConfirmModal';
import NewExpiryReturnModal from '../components/Expiry/NewExpiryReturnModal';
import { useNotification } from '../context/NotificationContext';
import AuthContext from '../context/AuthContext';

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const ReturnCard = ({ ret, onVerify, onDelete, onEdit }) => {
    // Pending cards start expanded; verified cards start collapsed
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [expanded, setExpanded] = useState(ret.status === 'Submitted');

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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
                    padding: isMobile ? '1rem' : '1.25rem 1.5rem',
                    display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', gap: '1rem',
                    cursor: 'pointer', userSelect: 'none',
                    borderBottom: expanded ? '1px solid var(--glass-border)' : 'none',
                    transition: 'background 0.15s',
                    flexDirection: isMobile ? 'column' : 'row'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
                <div style={{ display: 'flex', gap: '1rem', width: '100%', alignItems: 'center' }}>
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
                                {ret.branchId?.name || 'Main Store'}
                            </span>
                        </div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                            {MONTHS[(ret.month || 1) - 1]} {ret.year}
                        </h3>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                         <span style={{
                            background: isVerified ? '#dcfce7' : '#fff7ed',
                            color: isVerified ? '#16a34a' : '#d97706',
                            padding: '0.25rem 0.6rem', borderRadius: '9999px',
                            fontSize: '0.65rem', fontWeight: 700,
                            display: 'flex', alignItems: 'center', gap: '0.2rem'
                        }}>
                            {isVerified ? <CheckCircle size={10} /> : <Clock size={10} />}
                            {isVerified ? 'VERIFIED' : 'PENDING'}
                        </span>
                        {expanded ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
                    </div>
                </div>

                {/* Subtext and Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: isMobile ? '0.5rem' : '0' }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {ret.items.length} items · {new Date(ret.submittedAt).toLocaleDateString()}
                    </p>
                    
                    {ret.status === 'Submitted' ? (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                                onClick={e => { e.stopPropagation(); onEdit(ret); }}
                                style={{ background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Edit2 size={14} />
                            </button>
                            <button
                                onClick={e => { e.stopPropagation(); onDelete(ret._id); }}
                                style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Trash2 size={14} />
                            </button>
                            <Button onClick={e => { e.stopPropagation(); onVerify(ret); }} style={{ fontSize: '0.75rem', padding: '0.3rem 0.7rem' }}>
                                Verify
                            </Button>
                        </div>
                    ) : (
                        ret.status === 'Verified' && !ret.items.some(item => item.handoverStatus === 'HandedOver') && (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <button
                                    onClick={e => { e.stopPropagation(); onDelete(ret._id); }}
                                    style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    title="Delete Verified Expiry Return"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Collapsible items */}
            {expanded && (
                <div style={{ padding: isMobile ? '0.75rem' : '1rem 1.5rem' }}>
                    {/* Notes */}
                    {ret.branchNote && (
                        <div style={{ padding: '0.6rem 0.9rem', background: '#f0fdf4', borderRadius: '6px', fontSize: '0.82rem', color: '#166534', marginBottom: '0.75rem' }}>
                            📝 <strong>Branch Note:</strong> {ret.branchNote}
                        </div>
                    )}
                    {ret.storeNote && (
                        <div style={{ padding: '0.6rem 0.9rem', background: '#fef3c7', borderRadius: '6px', fontSize: '0.82rem', color: '#92400e', marginBottom: '0.75rem' }}>
                            📝 <strong>Store Note:</strong> {ret.storeNote}
                        </div>
                    )}

                    {/* Items table */}
                    <div style={{ border: isMobile ? 'none' : '1px solid #f1f5f9', borderRadius: '8px', overflow: 'hidden' }}>
                        {!isMobile && (
                            <div style={{
                                display: 'grid', gridTemplateColumns: '30px 1fr 100px 100px 90px',
                                padding: '0.5rem 0.75rem', background: '#f8fafc',
                                fontWeight: 700, fontSize: '0.72rem', color: '#64748b',
                                borderBottom: '1px solid #f1f5f9'
                            }}>
                                <div>#</div>
                                <div>Medicine</div>
                                <div style={{ textAlign: 'center' }}>Sent (Bx/L)</div>
                                <div style={{ textAlign: 'center' }}>Rcv (Bx/L)</div>
                                <div style={{ textAlign: 'center' }}>Disposed?</div>
                            </div>
                        )}
                        <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: isMobile ? '0.75rem' : '0' }}>
                            {ret.items.map((item, idx) => {
                                const mismatch = item.qtyReceived !== null && (item.qtyReceived !== item.qtySent || item.qtyReceivedLoose !== item.qtySentLoose);
                                if (isMobile) {
                                    return (
                                        <div key={idx} style={{
                                            padding: '0.75rem', borderRadius: '8px',
                                            background: mismatch ? '#fef2f2' : '#fff',
                                            border: '1px solid',
                                            borderColor: mismatch ? '#fecdd3' : '#f1f5f9',
                                            fontSize: '0.82rem'
                                        }}>
                                            <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem', display: 'flex', gap: '0.5rem' }}>
                                                <span style={{ color: '#94a3b8' }}>{idx + 1}.</span>
                                                <span>
                                                    {item.medicineId?.name || item.customName || 'Unknown'}
                                                    {item.customName && <span style={{ fontSize: '0.6rem', background: '#fde68a', color: '#92400e', padding: '1px 4px', borderRadius: '3px', marginLeft: '5px' }}>CUSTOM</span>}
                                                </span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                                <div style={{ color: 'var(--text-muted)' }}>Sent: <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{item.qtySent} / {item.qtySentLoose || 0}</span></div>
                                                <div style={{ color: 'var(--text-muted)' }}>Rcv: <span style={{ fontWeight: 700, color: item.qtyReceived === null ? '#94a3b8' : mismatch ? '#dc2626' : '#16a34a' }}>{item.qtyReceived !== null ? `${item.qtyReceived} / ${item.qtyReceivedLoose}` : '—'}</span></div>
                                                {item.batchNumber && <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Batch: {item.batchNumber}</div>}
                                                {item.isNonReturnable && <div style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.75rem' }}>DISPOSED</div>}
                                            </div>
                                        </div>
                                    );
                                }
                                return (
                                    <div key={idx} style={{
                                        display: 'grid', gridTemplateColumns: '30px 1fr 100px 100px 90px',
                                        padding: '0.5rem 0.75rem', alignItems: 'center',
                                        background: mismatch ? 'rgba(239,68,68,0.04)' : idx % 2 === 0 ? '#fff' : '#fafafa',
                                        borderBottom: idx !== ret.items.length - 1 ? '1px solid #f1f5f9' : 'none',
                                        fontSize: '0.85rem'
                                    }}>
                                        <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{idx + 1}</div>
                                        <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>
                                            {item.medicineId?.name || item.customName || 'Unknown'}
                                            {item.customName && <span style={{ fontSize: '0.65rem', background: '#fde68a', color: '#92400e', padding: '1px 4px', borderRadius: '3px', marginLeft: '5px' }}>CUSTOM</span>}
                                            {item.batchNumber && <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>Batch: {item.batchNumber}</div>}
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
    const { user } = useContext(AuthContext);
    const { showToast } = useNotification();
    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedReturn, setSelectedReturn] = useState(null);
    const [editingReturn, setEditingReturn] = useState(null);
    const [allMedicines, setAllMedicines] = useState([]);
    const [filter, setFilter] = useState('all'); // 'all' | 'Submitted' | 'Verified'
    const [filterMonth, setFilterMonth] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'
    const [actionModal, setActionModal] = useState({ isOpen: false, requestId: null });
    const [isNewExpiryModalOpen, setIsNewExpiryModalOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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
    
    const filtered = (filter === 'all' ? returns : returns.filter(r => r.status === filter))
        .filter(r => {
            const mMatch = filterMonth === '' || r.month === parseInt(filterMonth);
            const yMatch = filterYear === '' || r.year === parseInt(filterYear);
            return mMatch && yMatch;
        })
        .sort((a, b) => {
            const dateA = (a.year * 100) + a.month;
            const dateB = (b.year * 100) + b.month;
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });

    return (
        <div style={{ paddingBottom: '2rem' }}>
            {/* Header */}
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: isMobile ? '1.5rem' : '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                        Store Expiry Verification
                    </h1>
                    <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: isMobile ? '0.85rem' : '1rem' }}>
                        Verify expired items sent from branches or add store expiries.
                    </p>
                </div>
                <Button onClick={() => setIsNewExpiryModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={16} /> Add Store Expiry
                </Button>
            </div>

            {/* Stats strip */}
            {!loading && returns.length > 0 && (
                <div style={{ 
                    display: 'flex', gap: isMobile ? '1rem' : '1.5rem', marginBottom: '1.25rem', 
                    padding: '0.6rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', 
                    borderRadius: '8px', alignItems: 'center', overflowX: 'auto', whiteSpace: 'nowrap'
                }}>
                    {[
                        { label: 'Pending', count: pending.length, color: '#f97316' },
                        { label: 'Verified', count: verified.length, color: '#16a34a' },
                        { label: 'Total', count: returns.length, color: '#64748b' },
                    ].map((stat, i) => (
                        <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', paddingRight: i < 2 ? (isMobile ? '1rem' : '1.5rem') : 0, borderRight: i < 2 ? '1px solid #e2e8f0' : 'none' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: stat.color }}>{stat.count}</span>
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{stat.label}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Filter sections */}
            {!loading && returns.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                    {/* Status Tabs */}
                    <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '2px' }}>
                        {['all', 'Submitted', 'Verified'].map(f => (
                            <button key={f} onClick={() => setFilter(f)}
                                style={{
                                    padding: '0.4rem 1rem', borderRadius: '9999px', fontSize: '0.82rem', fontWeight: 600,
                                    border: filter === f ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                                    background: filter === f ? 'var(--primary-light)' : '#fff',
                                    color: filter === f ? 'var(--primary)' : 'var(--text-muted)',
                                    cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap'
                                }}>
                                {f === 'all' ? 'All Status' : f}
                            </button>
                        ))}
                    </div>

                    {/* Date Filters & Sort */}
                    <div style={{ 
                        display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap',
                        justifyContent: 'space-between', width: '100%'
                    }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: isMobile ? 1 : 'none' }}>
                            <select 
                                value={filterMonth} 
                                onChange={(e) => setFilterMonth(e.target.value)}
                                style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--glass-border)', fontSize: '0.85rem', background: '#fff', minWidth: '100px' }}
                            >
                                <option value="">All Months</option>
                                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                            </select>
                            <input 
                                type="number" 
                                placeholder="Year"
                                value={filterYear}
                                onChange={(e) => setFilterYear(e.target.value)}
                                style={{ width: '80px', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--glass-border)', fontSize: '0.85rem' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: isMobile ? 1 : 'none' }}>
                            <select 
                                value={sortOrder} 
                                onChange={(e) => setSortOrder(e.target.value)}
                                style={{ 
                                    width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)',
                                    fontSize: '0.85rem', background: '#fff', cursor: 'pointer', outline: 'none'
                                }}
                            >
                                <option value="desc">Newest First</option>
                                <option value="asc">Oldest First</option>
                            </select>
                        </div>
                    </div>
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

            {/* New Expiry Return Modal (for Store) */}
            {isNewExpiryModalOpen && (
                <NewExpiryReturnModal
                    isOpen={isNewExpiryModalOpen}
                    onClose={() => setIsNewExpiryModalOpen(false)}
                    onSuccess={() => {
                        setIsNewExpiryModalOpen(false);
                        fetchReturns();
                    }}
                    allMedicines={allMedicines}
                    userId={user?._id}
                    isAdminView={true}
                />
            )}
        </div>
    );
};

export default StoreExpiryVerification;
