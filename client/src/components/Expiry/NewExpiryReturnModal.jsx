import { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import api from '../../services/api';
import { Search, Plus, Trash2 } from 'lucide-react';
import useDebounce from '../../hooks/useDebounce';

const NewExpiryReturnModal = ({ isOpen, onClose, onSuccess }) => {
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [items, setItems] = useState([]);
    
    // Search
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (debouncedSearchTerm) {
            handleSearch(debouncedSearchTerm);
        } else {
            setSearchResults([]);
        }
    }, [debouncedSearchTerm]);

    const handleSearch = async (term) => {
        try {
            setIsSearching(true);
            const res = await api.get(`/medicines/search?q=${term}`);
            setSearchResults(res.data);
        } catch (error) {
            console.error('Error searching medicines', error);
        } finally {
            setIsSearching(false);
        }
    };

    const addItem = (medicine) => {
        if (items.some(i => i.medicineId === medicine._id)) {
            // Increment qty if already exists
            setItems(items.map(i => i.medicineId === medicine._id ? { ...i, qtySent: i.qtySent + 1 } : i));
        } else {
            setItems([...items, { medicineId: medicine._id, name: medicine.name, barcode: medicine.barcode, qtySent: 1 }]);
        }
        setSearchTerm('');
        setSearchResults([]);
    };

    const updateQty = (id, newQty) => {
        const qty = parseInt(newQty);
        if (isNaN(qty) || qty < 1) return;
        setItems(items.map(i => i.medicineId === id ? { ...i, qtySent: qty } : i));
    };

    const removeItem = (id) => {
        setItems(items.filter(i => i.medicineId !== id));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (items.length === 0) {
            setError("Please add at least one item.");
            return;
        }

        try {
            setSubmitting(true);
            setError(null);
            const payload = {
                month: parseInt(month),
                year: parseInt(year),
                items: items.map(i => ({ medicineId: i.medicineId, qtySent: i.qtySent })),
                status: 'Submitted'
            };
            
            await api.post('/expiry', payload);
            setMonth(new Date().getMonth() + 1);
            setItems([]);
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="New Expiry Return List">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: '400px' }}>
                
                {error && (
                    <div style={{ padding: '0.75rem', background: 'var(--danger-light)', color: 'var(--danger)', borderRadius: '8px', fontSize: '0.9rem' }}>
                        {error}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="input-group">
                        <label>Expiry Month</label>
                        <select 
                            value={month} 
                            onChange={(e) => setMonth(e.target.value)}
                            style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)' }}
                        >
                            {months.map((m, idx) => (
                                <option key={idx} value={idx + 1}>{m}</option>
                            ))}
                        </select>
                    </div>
                    <div className="input-group">
                        <label>Expiry Year</label>
                        <input 
                            type="number" 
                            value={year} 
                            onChange={(e) => setYear(e.target.value)}
                            min={2020}
                            max={2100}
                            style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)' }}
                        />
                    </div>
                </div>

                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                        Add Items
                    </label>
                    <div style={{ position: 'relative' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Search by name or barcode..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem',
                                    borderRadius: '8px', border: '1px solid var(--glass-border)',
                                    background: 'var(--bg-primary)'
                                }}
                            />
                        </div>
                        
                        {searchResults.length > 0 && (
                            <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0,
                                background: 'var(--bg-primary)', border: '1px solid var(--glass-border)',
                                borderRadius: '8px', marginTop: '4px', zIndex: 10,
                                maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}>
                                {searchResults.map(med => (
                                    <div 
                                        key={med._id}
                                        onClick={() => addItem(med)}
                                        style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-light)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 500 }}>{med.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{med.barcode}</div>
                                        </div>
                                        <Plus size={16} color="var(--primary)" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '150px' }}>
                    {items.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            No items added yet.<br/>Search above to add expiring medicines.
                        </div>
                    ) : (
                        <div style={{ padding: '0.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 40px', gap: '0.5rem', padding: '0.5rem', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                <div>Medicine</div>
                                <div style={{ textAlign: 'center' }}>Qty Sent</div>
                                <div></div>
                            </div>
                            {items.map((item, idx) => (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 40px', gap: '0.5rem', padding: '0.5rem', alignItems: 'center', borderBottom: idx !== items.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                                    <div style={{ overflow: 'hidden' }}>
                                        <div style={{ fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', fontSize: '0.9rem' }}>{item.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.barcode}</div>
                                    </div>
                                    <input 
                                        type="number"
                                        min="1"
                                        value={item.qtySent}
                                        onChange={(e) => updateQty(item.medicineId, e.target.value)}
                                        style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'center' }}
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => removeItem(item.medicineId)}
                                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                    <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit" disabled={submitting || items.length === 0}>
                        {submitting ? 'Submitting...' : 'Submit Expiry Box'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default NewExpiryReturnModal;
