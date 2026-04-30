import { useState, useEffect } from 'react';
import { Truck, Search, DollarSign, ArrowRightLeft } from 'lucide-react';
import api from '../services/api';
import Button from '../components/UI/Button';
import LogCompensationModal from '../components/Expiry/LogCompensationModal';

const SupplierExpiryReport = () => {
    const [ledgers, setLedgers] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonths, setSelectedMonths] = useState([]); // Array of month numbers
    
    const [selectedLedger, setSelectedLedger] = useState(null);

    const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    useEffect(() => {
        api.get('/suppliers').then(res => setSuppliers(res.data)).catch(console.error);
    }, []);

    const fetchLedgers = async () => {
        try {
            setLoading(true);
            let url = `/expiry/ledgers?year=${selectedYear}`;
            if (selectedSupplier) url += `&supplierId=${selectedSupplier}`;
            if (selectedMonths.length > 0) url += `&months=${selectedMonths.join(',')}`;

            const res = await api.get(url);
            setLedgers(res.data);
        } catch (error) {
            console.error('Error fetching ledgers:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLedgers();
    }, [selectedSupplier, selectedYear, selectedMonths]);

    const toggleMonth = (monthNum) => {
        if (selectedMonths.includes(monthNum)) {
            setSelectedMonths(selectedMonths.filter(m => m !== monthNum));
        } else {
            setSelectedMonths([...selectedMonths, monthNum]);
        }
    };

    const formatCurrency = (val) => `OMR ${val.toFixed(2)}`;

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                    Supplier Expiry Ledger
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>Track the financial value of expired goods and log supplier compensations.</p>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: '1rem' }}>
                    <div className="input-group">
                        <label>Filter by Supplier</label>
                        <select 
                            value={selectedSupplier} 
                            onChange={(e) => setSelectedSupplier(e.target.value)}
                            style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)' }}
                        >
                            <option value="">All Suppliers</option>
                            {suppliers.map(s => (
                                <option key={s._id} value={s._id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="input-group">
                        <label>Year</label>
                        <input 
                            type="number" 
                            value={selectedYear} 
                            onChange={(e) => setSelectedYear(e.target.value)}
                            style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)' }}
                        />
                    </div>
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Filter by Month(s)</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {months.map((m, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => toggleMonth(idx + 1)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '9999px',
                                    border: selectedMonths.includes(idx + 1) ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                                    background: selectedMonths.includes(idx + 1) ? 'var(--primary-light)' : 'var(--bg-primary)',
                                    color: selectedMonths.includes(idx + 1) ? 'var(--primary)' : 'var(--text-muted)',
                                    fontWeight: selectedMonths.includes(idx + 1) ? 600 : 400,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? (
                <div>Loading ledgers...</div>
            ) : ledgers.length === 0 ? (
                <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Truck size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
                    <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>No Ledger Data Found</h3>
                    <p>There are no verified expiry returns matching your filters.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                    {ledgers.map((ledger) => {
                        const pendingValue = ledger.totalValueHandedOver - ledger.totalValueCompensated;
                        const isResolved = pendingValue <= 0.01; // floating point math safety

                        return (
                            <div key={ledger._id} className="glass-panel" style={{ 
                                padding: '1.5rem', 
                                display: 'flex', flexDirection: 'column', gap: '1rem',
                                borderLeft: `4px solid ${isResolved ? 'var(--success)' : 'var(--primary)'}`
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                                            {ledger.supplierId?.name || 'Unknown Supplier'}
                                        </h3>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            {months[ledger.month - 1]} {ledger.year}
                                        </p>
                                    </div>
                                    <div style={{ 
                                        background: isResolved ? 'var(--success-light)' : 'var(--warning-light)',
                                        color: isResolved ? 'var(--success)' : '#d97706',
                                        padding: '0.25rem 0.75rem',
                                        borderRadius: '9999px',
                                        fontSize: '0.75rem',
                                        fontWeight: 700
                                    }}>
                                        {isResolved ? 'RESOLVED' : 'PENDING'}
                                    </div>
                                </div>

                                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Value Handed Over:</span>
                                        <span style={{ fontWeight: 600 }}>{formatCurrency(ledger.totalValueHandedOver)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Value Received:</span>
                                        <span style={{ fontWeight: 600, color: 'var(--success)' }}>{formatCurrency(ledger.totalValueCompensated)}</span>
                                    </div>
                                    <div style={{ borderTop: '1px dashed #cbd5e1', margin: '0.25rem 0' }} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Pending Balance:</span>
                                        <span style={{ fontWeight: 800, color: isResolved ? 'var(--text-muted)' : 'var(--danger)' }}>
                                            {formatCurrency(pendingValue)}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {!isResolved && (
                                        <Button 
                                            onClick={() => setSelectedLedger(ledger)}
                                            style={{ flex: 1, display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <DollarSign size={16} /> Log Compensation
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {selectedLedger && (
                <LogCompensationModal 
                    isOpen={!!selectedLedger}
                    onClose={() => setSelectedLedger(null)}
                    ledger={selectedLedger}
                    onSuccess={() => {
                        setSelectedLedger(null);
                        fetchLedgers();
                    }}
                />
            )}
        </div>
    );
};

export default SupplierExpiryReport;
