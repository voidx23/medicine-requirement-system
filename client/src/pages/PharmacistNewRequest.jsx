import { useState, useRef, useEffect, useContext } from 'react';
import { Search, Plus, Trash2, Send, FileText } from 'lucide-react';
import api from '../services/api';
import Button from '../components/UI/Button';
import QuantityModal from '../components/UI/QuantityModal';
import StaffVerificationModal from '../components/UI/StaffVerificationModal';
import CustomItemModal from '../components/UI/CustomItemModal';
import DigitalClock from '../components/UI/DigitalClock';
import { useNotification } from '../context/NotificationContext';
import AuthContext from '../context/AuthContext';

const PharmacistNewRequest = () => {
    const { showConfirm, showToast } = useNotification();
    const { user } = useContext(AuthContext); // Get current user
    const STORAGE_KEY = `pharmacistRequestDraft_${user?._id || 'guest'}`;

    const [requestItems, setRequestItems] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    // Save to localStorage whenever items change
    useEffect(() => {
        if (user?._id) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(requestItems));
        }
    }, [requestItems, STORAGE_KEY, user]);
    const [verifyModalOpen, setVerifyModalOpen] = useState(false);
    const [submittedToday, setSubmittedToday] = useState(0);

    // Auto-scroll
    const bottomRef = useRef(null);
    useEffect(() => {
        if (requestItems.length > 0) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [requestItems.length]);
    
    // Search State
    const [query, setQuery] = useState('');

    const [allMedicines, setAllMedicines] = useState([]); // Master list
    const [results, setResults] = useState([]);
    
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const wrapperRef = useRef(null);
    const searchInputRef = useRef(null);
    // Quantity Modal State
    const [qtyModalOpen, setQtyModalOpen] = useState(false);
    const [customModalOpen, setCustomModalOpen] = useState(false);
    const [pendingItem, setPendingItem] = useState(null);

    const fetchAllMedicines = async () => {
        try {
            // Fetch ALL medicines for client-side search
            const { data } = await api.get('/medicines?limit=all');
            setAllMedicines(data.medicines || []);
        } catch (error) {
            console.error('Failed to load medicines', error);
        }
    };

    const fetchStats = async () => {
        try {
            const { data } = await api.get('/requests/stats');
            setSubmittedToday(data.todayParams || 0);
        } catch (error) {
            console.error('Failed to load stats', error);
        }
    };

    useEffect(() => {
        fetchStats();
        fetchAllMedicines();
    }, []);

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

    // Search Function (Client-Side)
    const handleSearch = (value) => {
        setQuery(value);
        if (value.length > 0) { 
            const lowerQuery = value.toLowerCase().trim();

            // Filter Results (Name or Barcode)
            const filtered = allMedicines.filter(med => 
                med.name.toLowerCase().includes(lowerQuery) || (med.barcode && med.barcode.includes(lowerQuery))
            ).slice(0, 10); 
            
            setResults(filtered);
            setIsOpen(true);
        } else {
            setResults([]);
            setIsOpen(false);
        }
    };

    // ... (initiateAdd, confirmAdd, etc. unchanged)

    // Keyboard Navigation
    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            if (!isOpen) setIsOpen(true);
            e.preventDefault();
            setHighlightedIndex(prev => (prev + 1) % results.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev - 1 + results.length) % results.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            
            // 1. If item is highlighted, add it
            if (highlightedIndex >= 0 && results[highlightedIndex]) {
                initiateAdd(results[highlightedIndex]);
                return;
            }

            // 2. Scan Logic: If NO item highlighted, check for Exact Barcode Match
            if (query.trim()) {
                const lowerQuery = query.toLowerCase().trim();
                const barcodeMatch = allMedicines.find(med => med.barcode && med.barcode === lowerQuery);
                
                if (barcodeMatch) {
                    initiateAdd(barcodeMatch);
                    setQuery(''); // Ready for next scan
                    return;
                }
            }

        } else if (e.key === 'Escape') {
            setIsOpen(false);
            setHighlightedIndex(-1);
        }
    };

    return (
        <div>
            {/* Sticky Header Section */}
            <div className="sticky-header">
                {/* Header Section (Matches Dashboard.jsx) */}
                <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                    <div>
                    <h1 className="header-title" style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        Create New Request
                        <span style={{ 
                            fontSize: '0.9rem', fontWeight: 500, color: 'var(--primary)', 
                            background: 'var(--primary-light)', padding: '0.2rem 0.8rem', borderRadius: '20px',
                            border: '1px solid rgba(var(--primary-rgb), 0.2)'
                        }}>
                            {user?.username?.toUpperCase() || 'PHARMACY'}
                        </span>
                    </h1>
                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', color: 'var(--text-muted)' }}>
                            <p>{new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            <div style={{ width: '1px', height: '16px', background: 'rgba(0,0,0,0.1)' }}></div>
                            <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontWeight: 500 }}>
                                <span style={{ fontSize: '0.9rem', background: 'rgba(var(--primary-rgb), 0.1)', padding: '0.1rem 0.5rem', borderRadius: '4px' }}>
                                    {submittedToday}
                                </span>
                                Requests Submitted Today
                            </p>
                    </div>
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
                <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '2rem' }}>
                    <div style={{ flex: 1, maxWidth: '500px' }}>
                        <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
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
                                    placeholder="Search name or scan barcode..."
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
                                    {results.length > 0 ? (
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

                    <div className="desktop-only">
                        <DigitalClock />
                    </div>
                </div>
                
                {/* Not Found Link - Moved outside flex to keep it centered or aligned logic separate if needed, but keeping logic consistent */}
                <div style={{ textAlign: 'center', marginTop: '-1rem', marginBottom: '2rem', maxWidth: '500px' }}>
                        <button 
                            onClick={() => setCustomModalOpen(true)}
                            style={{ 
                                background: 'transparent', border: 'none', 
                                color: 'var(--primary)', fontSize: '0.9rem', 
                                cursor: 'pointer', textDecoration: 'underline' 
                            }}
                        >
                            Medicine not found? Add it manually
                        </button>
                </div>
            </div>


            {/* List Section */}
            <div style={{ paddingBottom: '1rem' }}>
                {requestItems.length === 0 ? (
                    <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Your list is empty.</p>
                        <p style={{ fontSize: '0.9rem' }}>Use the search bar above to start adding medicines.</p>
                    </div>
                ) : (
                    <>
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
                                                {item.isCustom ? (
                                                    <span style={{ 
                                                        padding: '0.25rem 0.6rem', background: '#fef3c7', 
                                                        color: '#d97706', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 500,
                                                        border: '1px solid #fcd34d'
                                                    }}>
                                                        Manual Entry
                                                    </span>
                                                ) : (
                                                    <span style={{ 
                                                        padding: '0.25rem 0.6rem', background: 'var(--primary-light)', 
                                                        color: 'var(--primary)', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 500
                                                    }}>
                                                        {item.supplierId?.name || 'Unknown'}
                                                    </span>
                                                )}
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
                        <div ref={bottomRef} />
                    </>
                )}
            </div>

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

            <CustomItemModal
                isOpen={customModalOpen}
                onClose={() => setCustomModalOpen(false)}
                onConfirm={handleAddCustom}
            />
        </div>
    );
};

export default PharmacistNewRequest;
