import { useState, useEffect } from 'react';
import { Plus, Package, Calendar, Clock, CheckCircle } from 'lucide-react';
import api from '../services/api';
import Button from '../components/UI/Button';
import NewExpiryReturnModal from '../components/Expiry/NewExpiryReturnModal';

const BranchExpiryReturns = () => {
    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

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
    }, []);

    const getStatusColor = (status) => {
        switch (status) {
            case 'Draft': return 'var(--warning)';
            case 'Submitted': return 'var(--primary)';
            case 'Verified': return 'var(--success)';
            default: return 'var(--text-muted)';
        }
    };

    const getMonthName = (monthNum) => {
        const date = new Date();
        date.setMonth(monthNum - 1);
        return date.toLocaleString('default', { month: 'long' });
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                        Expiry Returns
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>Manage your monthly expired medicine returns.</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <Plus size={20} />
                    New Expiry List
                </Button>
            </div>

            {loading ? (
                <div>Loading returns...</div>
            ) : returns.length === 0 ? (
                <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Package size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
                    <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>No Expiry Returns Yet</h3>
                    <p>Click "New Expiry List" to create your first return box.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {returns.map((ret) => (
                        <div key={ret._id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ 
                                        width: '48px', height: '48px', borderRadius: '12px',
                                        background: 'var(--primary-light)', color: 'var(--primary)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <Calendar size={24} />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                                            {getMonthName(ret.month)} {ret.year}
                                        </h3>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            {ret.items.length} unique medicines
                                        </p>
                                    </div>
                                </div>
                                <div style={{ 
                                    background: `${getStatusColor(ret.status)}20`,
                                    color: getStatusColor(ret.status),
                                    padding: '0.5rem 1rem',
                                    borderRadius: '9999px',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    {ret.status === 'Verified' ? <CheckCircle size={16} /> : <Clock size={16} />}
                                    {ret.status}
                                </div>
                            </div>
                            
                            {ret.storeNote && (
                                <div style={{ background: '#fef3c7', color: '#92400e', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', gap: '0.5rem' }}>
                                    <strong>Store Note:</strong> {ret.storeNote}
                                </div>
                            )}

                            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '1rem', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', padding: '0 0.5rem' }}>
                                    <div>Medicine</div>
                                    <div style={{ textAlign: 'center', width: '80px' }}>Sent</div>
                                    <div style={{ textAlign: 'center', width: '80px' }}>Verified</div>
                                </div>
                                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                    {ret.items.map((item, idx) => (
                                        <div key={idx} style={{ 
                                            display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '1rem', 
                                            padding: '0.5rem', 
                                            background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                                            borderRadius: '6px',
                                            fontSize: '0.9rem',
                                            alignItems: 'center'
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>{item.medicineId?.name || 'Unknown Item'}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.medicineId?.barcode}</div>
                                            </div>
                                            <div style={{ textAlign: 'center', width: '80px', fontWeight: 600 }}>{item.qtySent}</div>
                                            <div style={{ textAlign: 'center', width: '80px', fontWeight: 600, color: item.qtyReceived !== null && item.qtyReceived !== item.qtySent ? 'var(--danger)' : 'var(--success)' }}>
                                                {item.qtyReceived !== null ? item.qtyReceived : '-'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <NewExpiryReturnModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => {
                    setIsModalOpen(false);
                    fetchReturns();
                }}
            />
        </div>
    );
};

export default BranchExpiryReturns;
