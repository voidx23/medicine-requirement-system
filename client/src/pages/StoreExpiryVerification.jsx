import { useState, useEffect } from 'react';
import { PackageSearch, Calendar, CheckCircle, Clock } from 'lucide-react';
import api from '../services/api';
import Button from '../components/UI/Button';
import VerificationModal from '../components/Expiry/VerificationModal';

const StoreExpiryVerification = () => {
    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedReturn, setSelectedReturn] = useState(null);

    const fetchReturns = async () => {
        try {
            setLoading(true);
            const res = await api.get('/expiry/all');
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

    const getMonthName = (monthNum) => {
        const date = new Date();
        date.setMonth(monthNum - 1);
        return date.toLocaleString('default', { month: 'long' });
    };

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                    Store Expiry Verification
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>Verify expired items sent from branches before handing them to suppliers.</p>
            </div>

            {loading ? (
                <div>Loading...</div>
            ) : returns.length === 0 ? (
                <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <PackageSearch size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
                    <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>No Expiry Returns Pending</h3>
                    <p>Branches have not submitted any expiry boxes yet.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {returns.map((ret) => (
                        <div key={ret._id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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
                                            {ret.branchId?.name} - {getMonthName(ret.month)} {ret.year}
                                        </h3>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            Submitted: {new Date(ret.submittedAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <div style={{ 
                                        background: ret.status === 'Verified' ? 'var(--success-light)' : 'var(--warning-light)',
                                        color: ret.status === 'Verified' ? 'var(--success)' : '#d97706',
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

                                    {ret.status === 'Submitted' && (
                                        <Button onClick={() => setSelectedReturn(ret)}>
                                            Verify Box
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {ret.status === 'Verified' && (
                                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '1rem', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', padding: '0 0.5rem' }}>
                                        <div>Medicine</div>
                                        <div style={{ textAlign: 'center', width: '80px' }}>Sent</div>
                                        <div style={{ textAlign: 'center', width: '80px' }}>Received</div>
                                        <div style={{ textAlign: 'center', width: '100px' }}>Disposed?</div>
                                    </div>
                                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                        {ret.items.map((item, idx) => (
                                            <div key={idx} style={{ 
                                                display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '1rem', 
                                                padding: '0.5rem', 
                                                background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                                                borderRadius: '6px',
                                                fontSize: '0.9rem',
                                                alignItems: 'center'
                                            }}>
                                                <div>
                                                    <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>{item.medicineId?.name || 'Unknown'}</div>
                                                </div>
                                                <div style={{ textAlign: 'center', width: '80px' }}>{item.qtySent}</div>
                                                <div style={{ textAlign: 'center', width: '80px', fontWeight: 600, color: item.qtyReceived !== item.qtySent ? 'var(--danger)' : 'var(--success)' }}>
                                                    {item.qtyReceived}
                                                </div>
                                                <div style={{ textAlign: 'center', width: '100px', color: item.isNonReturnable ? 'var(--danger)' : 'var(--text-muted)' }}>
                                                    {item.isNonReturnable ? 'Yes' : 'No'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {selectedReturn && (
                <VerificationModal 
                    isOpen={!!selectedReturn}
                    onClose={() => setSelectedReturn(null)}
                    expiryList={selectedReturn}
                    onSuccess={() => {
                        setSelectedReturn(null);
                        fetchReturns();
                    }}
                />
            )}
        </div>
    );
};

export default StoreExpiryVerification;
