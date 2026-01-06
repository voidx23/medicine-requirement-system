import { useState, useRef, useEffect } from 'react';
import { Search, Plus, Trash2, Send, FileText } from 'lucide-react';
import api from '../services/api';
import Button from '../components/UI/Button';
import QuantityModal from '../components/UI/QuantityModal';
import StaffVerificationModal from '../components/UI/StaffVerificationModal';
import { useNotification } from '../context/NotificationContext';

const PharmacistNewRequest = () => {
    const { showConfirm } = useNotification();
    const [requestItems, setRequestItems] = useState([]);
    const [verifyModalOpen, setVerifyModalOpen] = useState(false);
    
    // Search State
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const wrapperRef = useRef(null);
    const searchInputRef = useRef(null);

    // Quantity Modal State
    const [qtyModalOpen, setQtyModalOpen] = useState(false);
    const [pendingItem, setPendingItem] = useState(null);

    // Click Outside to close search
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Search Function
    const handleSearch = async (value) => {
        setQuery(value);
        if (value.length > 0) { 
            setSearching(true);
            try {
                const { data } = await api.get(`/medicines?search=${value}&limit=10`);
                setResults(data.medicines || []);
                setIsOpen(true);
            } catch (error) {
                console.error("Search failed", error);
            } finally {
                setSearching(false);
            }
        } else {
            setResults([]);
            setIsOpen(false);
        }
    };

    // Step 1: User selects item -> Open Modal
    const initiateAdd = (medicine) => {
        setPendingItem(medicine);
        setQtyModalOpen(true);
        setIsOpen(false); // Close dropdown
    };

    // Step 2: User confirms quantity -> Add to Request List
    const confirmAdd = (quantity) => {
        if (!pendingItem) return;

        setRequestItems(prev => {
            // Check if exists
            const exists = prev.find(item => item._id === pendingItem._id);
            if (exists) {
                // Update quantity of existing
                return prev.map(item => item._id === pendingItem._id 
                    ? { ...item, quantity: item.quantity + quantity }
                    : item
                );
            }
            // Add new
            return [...prev, { ...pendingItem, quantity }];
        });

        // Cleanup
        setQtyModalOpen(false);
        setPendingItem(null);
        setQuery('');
        setResults([]);
        setHighlightedIndex(-1);
        
        // Refocus search for next item (smoothness!)
        setTimeout(() => searchInputRef.current?.focus(), 100);
    };

    const removeItem = async (id) => {
        const isConfirmed = await showConfirm('Are you sure you want to remove this medicine?');
        if (isConfirmed) {
            setRequestItems(requestItems.filter(item => item._id !== id));
        }
    };

    const updateQuantity = (id, newQty) => {
        setRequestItems(requestItems.map(item => item._id === id ? { ...item, quantity: parseInt(newQty) || 1 } : item));
    };

    const handleSubmitRequest = () => {
        if (requestItems.length === 0) return;
        setVerifyModalOpen(true);
    };

    const handleStaffVerified = async (staffName) => {
        try {
            await api.post('/requests/submit', { items: requestItems, submittedBy: staffName });
            setRequestItems([]);
            
            alert(`Request Submitted Successfully! Signed by: ${staffName}`);
        } catch (error) {
            console.error(error);
            alert('Failed to submit request: ' + (error.response?.data?.message || error.message));
        }
    };
    
    // Keyboard Navigation
    const handleKeyDown = (e) => {
        if (!isOpen || results.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev + 1) % results.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev - 1 + results.length) % results.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && results[highlightedIndex]) {
                initiateAdd(results[highlightedIndex]);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
            setHighlightedIndex(-1);
        }
    };

    return (
        <div>
            {/* Header Section (Matches Dashboard.jsx) */}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                   <h1 className="header-title" style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Create New Request</h1>
                   <p style={{ color: 'var(--text-muted)' }}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div className="glass-panel" style={{ padding: '0.5rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--primary)' }}>
                        <FileText size={18} />
                        <span style={{ fontWeight: 600 }}>{requestItems.length} Items</span>
                    </div>
                    <Button 
                        variant="primary"
                        onClick={handleSubmitRequest}
                        disabled={requestItems.length === 0}
                        icon={Send}
                    >
                        Submit Request
                    </Button>
                </div>
            </div>

            {/* Search Section (Matches AddItem.jsx - Pill Shape) */}
            <div style={{ marginBottom: '2rem' }}>
                <div ref={wrapperRef} style={{ position: 'relative', width: '100%', maxWidth: '500px' }}>
                    <div 
                        className="glass-panel"
                        style={{ 
                            display: 'flex', alignItems: 'center', padding: '0.5rem', paddingLeft: '1rem',
                            borderRadius: '50px' // Pill shape
                        }}
                    >
                        <Search size={20} style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }} />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search medicine to add..."
                            value={query}
                            onChange={(e) => {
                                handleSearch(e.target.value);
                                setHighlightedIndex(-1); // Reset highlight on type
                            }}
                            onFocus={() => { if (query.length > 0) setIsOpen(true); }}
                            onKeyDown={handleKeyDown}
                            style={{
                                border: 'none', outline: 'none', background: 'transparent',
                                flex: 1, fontSize: '1rem', minWidth: 0
                            }}
                        />
                    </div>

                    {/* Search Results Dropdown */}
                    {isOpen && (
                        <div className="glass-panel" style={{
                            position: 'absolute', top: '110%', left: 0, right: 0, maxHeight: '300px', overflowY: 'auto', zIndex: 50,
                            padding: '0.5rem', background: 'rgba(255, 255, 255, 0.95)'
                        }}>
                            {searching ? (
                                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>Searching...</div>
                            ) : results.length > 0 ? (
                                results.map((medicine, index) => (
                                    <button
                                        key={medicine._id}
                                        onClick={() => initiateAdd(medicine)}
                                        style={{
                                            width: '100%', textAlign: 'left', padding: '0.75rem', border: 'none',
                                            background: highlightedIndex === index ? 'var(--primary-light)' : 'transparent',
                                            cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            borderRadius: '8px', transition: 'background 0.2s', color: 'var(--text-main)'
                                        }}
                                        onMouseOver={() => setHighlightedIndex(index)}
                                    >
                                        <span style={{ fontWeight: 500 }}>{medicine.name}</span>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{medicine.supplierId?.name}</span>
                                    </button>
                                ))
                            ) : (
                                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>No medicines found.</div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* List Section (Matches RequirementList.jsx - Table) */}
            {requestItems.length === 0 ? (
                <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Your list is empty.</p>
                    <p style={{ fontSize: '0.9rem' }}>Use the search bar above to start adding medicines.</p>
                </div>
            ) : (
                <div className="glass-panel" style={{ overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'rgba(255, 255, 255, 0.5)', borderBottom: '1px solid var(--glass-border)' }}>
                            <tr>
                                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>#</th>
                                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Medicine Name</th>
                                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Supplier</th>
                                <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>Quantity</th>
                                <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requestItems.map((item, index) => (
                                <tr key={item._id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                    <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{index + 1}</td>
                                    <td style={{ padding: '1rem', fontWeight: 500 }}>{item.name}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{ 
                                            padding: '0.25rem 0.6rem', background: 'var(--primary-light)', 
                                            color: 'var(--primary)', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 500
                                        }}>
                                            {item.supplierId?.name || 'Unknown'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        <input 
                                            type="number" min="1" value={item.quantity}
                                            onChange={(e) => updateQuantity(item._id, e.target.value)}
                                            style={{ 
                                                width: '60px', padding: '0.4rem', borderRadius: '6px', 
                                                border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold'
                                            }}
                                        />
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                        <button 
                                            onClick={() => removeItem(item._id)}
                                            style={{ 
                                                background: 'transparent', border: 'none', color: '#ef4444', 
                                                cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', transition: 'background 0.2s'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.background = '#fee2e2'}
                                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                            title="Remove item"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <QuantityModal 
                isOpen={qtyModalOpen}
                onClose={() => setQtyModalOpen(false)}
                onConfirm={confirmAdd}
                medicine={pendingItem}
            />
            
            <StaffVerificationModal
                isOpen={verifyModalOpen}
                onClose={() => setVerifyModalOpen(false)}
                onVerified={handleStaffVerified}
            />
        </div>
    );
};

export default PharmacistNewRequest;
