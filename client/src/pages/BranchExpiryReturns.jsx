import { useState, useEffect } from 'react';
import { Plus, Package, Calendar, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../services/api';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';
import NewExpiryReturnModal from '../components/Expiry/NewExpiryReturnModal';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const getStatusColor = (status) => {
    switch (status) {
        case 'Submitted': return 'var(--primary)';
        case 'Verified': return 'var(--success, #22c55e)';
        default: return '#d97706';
    }
};

// ---- Main Page ----
const BranchExpiryReturns = () => {
    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [allMedicines, setAllMedicines] = useState([]);
    const [selectedDetail, setSelectedDetail] = useState(null);

    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchReturns = async () => {
        try {
            setLoading(true);
            const res = await api.get('/expiry/my-returns');
            setReturns(res.data);
        } catch (error) {
            console.error('Error fetching expiry returns:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReturns();
        api.get('/medicines?limit=all')
            .then(res => setAllMedicines(res.data.medicines || []))
            .catch(console.error);
    }, []);

    // Unique sorted years from data + current year
    const years = Array.from(new Set([currentYear, ...returns.map(r => r.year)])).sort((a, b) => b - a);

    const byMonth = {};
    returns.filter(r => r.year === selectedYear).forEach(r => { byMonth[r.month] = r; });

    // Months to show: for current year show up to now; for past years only months with data
    const relevantMonths = Array.from({ length: 12 }, (_, i) => i + 1).filter(m => {
        if (selectedYear < currentYear) return !!byMonth[m];
        return m <= new Date().getMonth() + 1 || !!byMonth[m];
    });

    // ---- Month Detail Modal ----
    const MonthDetailModalResponsive = ({ ret, onClose }) => {
        if (!ret) return null;
        return (
            <Modal isOpen={!!ret} onClose={onClose} title={`${MONTH_NAMES[ret.month - 1]} ${ret.year} — Expiry List`} maxWidth="720px">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Status + meta */}
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <span style={{
                            background: `${getStatusColor(ret.status)}18`,
                            color: getStatusColor(ret.status),
                            padding: '0.35rem 1rem', borderRadius: '9999px', fontSize: '0.82rem', fontWeight: 700,
                            display: 'flex', alignItems: 'center', gap: '0.4rem'
                        }}>
                            {ret.status === 'Verified' ? <CheckCircle size={14} /> : <Clock size={14} />}
                            {ret.status}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', alignSelf: 'center' }}>
                            {ret.items.length} medicines listed
                        </span>
                    </div>

                    {/* Notes */}
                    {ret.branchNote && (
                        <div style={{
                            background: '#f0fdf4', color: '#166534',
                            padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem',
                            display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
                            marginBottom: '0.5rem'
                        }}>
                            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div><strong>Your Note:</strong> {ret.branchNote}</div>
                        </div>
                    )}
                    {ret.storeNote && (
                        <div style={{
                            background: '#fef3c7', color: '#92400e',
                            padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem',
                            display: 'flex', gap: '0.5rem', alignItems: 'flex-start'
                        }}>
                            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div><strong>Store Note:</strong> {ret.storeNote}</div>
                        </div>
                    )}

                    {/* Items List */}
                    <div style={{ border: isMobile ? 'none' : '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                        {!isMobile && (
                            <div style={{
                                display: 'grid', gridTemplateColumns: '30px 1fr 100px 100px',
                                padding: '0.65rem 1rem', background: '#f8fafc',
                                fontWeight: 700, fontSize: '0.78rem', color: '#475569',
                                borderBottom: '1px solid #e2e8f0'
                            }}>
                                <div>#</div>
                                <div>Medicine</div>
                                <div style={{ textAlign: 'center' }}>Sent (Bx/L)</div>
                                <div style={{ textAlign: 'center' }}>Verified (Bx/L)</div>
                            </div>
                        )}
                        <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: isMobile ? '0.75rem' : '0' }}>
                            {ret.items.map((item, idx) => {
                                const mismatch = item.qtyReceived !== null && (item.qtyReceived !== item.qtySent || item.qtyReceivedLoose !== item.qtySentLoose);
                                if (isMobile) {
                                    return (
                                        <div key={idx} style={{
                                            padding: '1rem', borderRadius: '10px',
                                            background: mismatch ? '#fef2f2' : '#fff',
                                            border: '1px solid',
                                            borderColor: mismatch ? '#fecdd3' : '#e2e8f0',
                                            display: 'flex', flexDirection: 'column', gap: '0.5rem'
                                        }}>
                                            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem', display: 'flex', gap: '0.5rem' }}>
                                                <span style={{ color: '#94a3b8' }}>{idx + 1}.</span>
                                                <span>{item.medicineId?.name || 'Unknown'}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Sent:</span>
                                                <span style={{ fontWeight: 600 }}>{item.qtySent} Bx / {item.qtySentLoose} L</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Verified:</span>
                                                <span style={{ fontWeight: 700, color: item.qtyReceived === null ? '#94a3b8' : mismatch ? '#dc2626' : '#16a34a' }}>
                                                    {item.qtyReceived !== null ? `${item.qtyReceived} Bx / ${item.qtyReceivedLoose} L` : '—'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }
                                return (
                                    <div key={idx} style={{
                                        display: 'grid', gridTemplateColumns: '30px 1fr 100px 100px',
                                        padding: '0.6rem 1rem', alignItems: 'center',
                                        background: mismatch ? 'rgba(239,68,68,0.04)' : idx % 2 === 0 ? '#fff' : '#fafafa',
                                        borderBottom: idx !== ret.items.length - 1 ? '1px solid #f1f5f9' : 'none'
                                    }}>
                                        <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{idx + 1}</div>
                                        <div>
                                            <div style={{ fontWeight: 500, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                                                {item.medicineId?.name || 'Unknown'}
                                            </div>
                                            {item.medicineId?.barcode && (
                                                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{item.medicineId.barcode}</div>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.88rem' }}>
                                            {item.qtySent} {item.qtySentLoose > 0 && <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>/ {item.qtySentLoose}L</span>}
                                        </div>
                                        <div style={{
                                            textAlign: 'center', fontWeight: 700, fontSize: '0.88rem',
                                            color: item.qtyReceived === null ? '#94a3b8' : mismatch ? '#dc2626' : '#16a34a'
                                        }}>
                                            {item.qtyReceived !== null ? (
                                                <>{item.qtyReceived} {item.qtyReceivedLoose > 0 && <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>/ {item.qtyReceivedLoose}L</span>}</>
                                            ) : '—'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button variant="secondary" onClick={onClose} style={{ width: isMobile ? '100%' : 'auto' }}>Close</Button>
                    </div>
                </div>
            </Modal>
        );
    };

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', marginBottom: '1.5rem', flexDirection: isMobile ? 'column' : 'row', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: isMobile ? '1.5rem' : '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                        Expiry Returns
                    </h1>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Your monthly expired medicine return lists.</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
                    <Plus size={18} /> New List
                </Button>
            </div>

            {/* Year Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <label style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    View Year:
                </label>
                <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(Number(e.target.value))}
                    style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        border: '1px solid var(--glass-border)',
                        background: '#fff',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        color: 'var(--text-main)',
                        cursor: 'pointer'
                    }}
                >
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>

            {/* Month Cards */}
            {loading ? (
                <div style={{ color: 'var(--text-muted)', padding: '1rem' }}>Loading...</div>
            ) : relevantMonths.length === 0 ? (
                <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Package size={44} style={{ margin: '0 auto 1rem auto', opacity: 0.4 }} />
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>No data for {selectedYear}</h3>
                    <p>No expiry lists have been submitted for this year yet.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
                    {relevantMonths.map(month => {
                        const ret = byMonth[month];
                        return (
                            <div
                                key={month}
                                onClick={() => ret && setSelectedDetail(ret)}
                                className="glass-panel"
                                style={{
                                    padding: '1.25rem',
                                    display: 'flex', flexDirection: 'column', gap: '0.75rem',
                                    cursor: ret ? 'pointer' : 'default',
                                    borderLeft: ret ? `4px solid ${getStatusColor(ret.status)}` : '4px solid #e2e8f0',
                                    transition: 'transform 0.15s, box-shadow 0.15s',
                                    opacity: ret ? 1 : 0.6
                                }}
                                onMouseEnter={e => { if (ret) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <div style={{
                                            width: '34px', height: '34px', borderRadius: '8px',
                                            background: ret ? `${getStatusColor(ret.status)}18` : '#f1f5f9',
                                            color: ret ? getStatusColor(ret.status) : '#94a3b8',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                        }}>
                                            <Calendar size={17} />
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                                            {MONTH_NAMES[month - 1]}
                                        </div>
                                    </div>
                                    {ret && (
                                        <span style={{
                                            background: `${getStatusColor(ret.status)}18`,
                                            color: getStatusColor(ret.status),
                                            padding: '0.2rem 0.6rem',
                                            borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 700,
                                        }}>
                                            {ret.status}
                                        </span>
                                    )}
                                </div>

                                {ret ? (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {ret.items.length} medicines · Click to view
                                        {ret.storeNote && (
                                            <div style={{ color: '#d97706', marginTop: '0.35rem', fontWeight: 600 }}>
                                                ⚠ Store note added
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No list submitted</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Month Detail Modal */}
            <MonthDetailModalResponsive ret={selectedDetail} onClose={() => setSelectedDetail(null)} />

            {/* New Expiry Modal */}
            <NewExpiryReturnModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                allMedicines={allMedicines}
                onSuccess={() => { setIsModalOpen(false); fetchReturns(); }}
            />
        </div>
    );
};

export default BranchExpiryReturns;
