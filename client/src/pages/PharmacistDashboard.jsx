import { useState, useContext } from 'react';
import { Search, Plus, Trash2, Send } from 'lucide-react';
import api from '../services/api';
import AddItem from '../components/Dashboard/AddItem'; // Reuse for search logic? Or build custom?
// Let's build a custom one to keep it simple and isolated as requested.

const PharmacistDashboard = () => {
    const [cart, setCart] = useState([]);
    const [myRequests, setMyRequests] = useState([]);
    
    // Fetch History
    const fetchHistory = async () => {
        try {
            const { data } = await api.get('/requests');
            setMyRequests(data);
        } catch (error) {
            console.error("Failed to fetch history", error);
        }
    };

    const getStatusColor = (status) => {
        switch(status) {
            case 'completed': return { bg: '#dcfce7', text: '#166534' }; // Green
            case 'partially_fulfilled': return { bg: '#f3e8ff', text: '#6b21a8' }; // Purple
            case 'unfulfilled': return { bg: '#fef2f2', text: '#dc2626' }; // Red
            case 'approved': return { bg: '#dbeafe', text: '#1e40af' }; // Blue
            case 'rejected': return { bg: '#fee2e2', text: '#991b1b' }; // Red
            default: return { bg: '#fef3c7', text: '#d97706' }; // Pending (Yellow)
        }
    };

    // Load history on mount
    const [initialized, setInitialized] = useState(false);
    if (!initialized) {
        fetchHistory();
        setInitialized(true);
    }

    // Search State
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);

    // Search Function
    const handleSearch = async (value) => {
        setQuery(value);
        if (value.length > 1) { 
            setSearching(true);
            try {
                // Correct Endpoint: /api/medicines?search=value (Not /search)
                const { data } = await api.get(`/medicines?search=${value}&limit=50`);
                setResults(data.medicines || []); // Extract array from pagination object
            } catch (error) {
                console.error("Search failed", error);
            } finally {
                setSearching(false);
            }
        } else {
            setResults([]);
        }
    };

    const addToCart = (medicine) => {
        if (!cart.find(item => item._id === medicine._id)) {
            setCart([...cart, { ...medicine, quantity: 1 }]);
        }
        setQuery('');
        setResults([]);
    };

    const removeFromCart = (id) => {
        setCart(cart.filter(item => item._id !== id));
    };

    const updateQuantity = (id, newQty) => {
        setCart(cart.map(item => item._id === id ? { ...item, quantity: parseInt(newQty) || 1 } : item));
    };

    const handleSubmitRequest = async () => {
        if (cart.length === 0) return;
        
        try {
            await api.post('/requests/submit', { items: cart });
            setCart([]);
            fetchHistory(); // Refresh history list
            alert('Request Submitted Successfully!');
        } catch (error) {
            console.error(error);
            alert('Failed to submit request: ' + (error.response?.data?.message || error.message));
        }
    };

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <h1 className="header-title">Create New Requirement List</h1>
                <p style={{ color: 'var(--text-muted)' }}>Search for medicines and add them to your request list.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
                
                {/* Left: Search Panel */}
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1rem', fontWeight: '600' }}>Add Medicines</h3>
                    
                    <div className="input-group" style={{ marginBottom: '1rem' }}>
                        <Search className="input-icon" size={20} />
                        <input
                            type="text"
                            className="glass-input"
                            placeholder="Search medicine name or generic name..."
                            value={query}
                            onChange={(e) => handleSearch(e.target.value)}
                        />
                    </div>

                    <div style={{ 
                        maxHeight: '400px', 
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                    }}>
                        {results.map(med => (
                            <div key={med._id} style={{
                                padding: '1rem',
                                background: 'rgba(255,255,255,0.5)',
                                borderRadius: '8px',
                                border: '1px solid var(--glass-border)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onClick={() => addToCart(med)}
                            >
                                <div>
                                    <div style={{ fontWeight: '600' }}>{med.name}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{med.supplierId?.name}</div>
                                </div>
                                <button className="btn-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
                                    <Plus size={18} />
                                </button>
                            </div>
                        ))}
                        {query && results.length === 0 && !searching && (
                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>No medicines found.</div>
                        )}
                    </div>
                </div>

                {/* Right: Cart/List Panel */}
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ fontWeight: '600' }}>Current Request ({cart.length})</h3>
                        {cart.length > 0 && (
                             <button className="btn-primary" onClick={handleSubmitRequest}>
                                <Send size={18} />
                                Submit Request
                             </button>
                        )}
                    </div>

                    {cart.length === 0 ? (
                        <div style={{ 
                            padding: '3rem', 
                            textAlign: 'center', 
                            border: '2px dashed var(--glass-border)',
                            borderRadius: '12px',
                            color: 'var(--text-muted)'
                        }}>
                            List is empty. Add items from the left.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {cart.map(item => (
                                <div key={item._id} style={{
                                    padding: '1rem',
                                    background: 'white',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '600' }}>{item.name}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.supplierId?.name}</div>
                                    </div>
                                    
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <label style={{ fontSize: '0.8rem' }}>Qty:</label>
                                        <input 
                                            type="number" 
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => updateQuantity(item._id, e.target.value)}
                                            style={{ 
                                                width: '60px', 
                                                padding: '0.5rem', 
                                                borderRadius: '6px', 
                                                border: '1px solid #ddd' 
                                            }}
                                        />
                                    </div>

                                    <button 
                                        className="btn-icon" 
                                        onClick={() => removeFromCart(item._id)}
                                        style={{ color: '#ef4444' }}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Request History Section */}
            <div style={{ marginTop: '3rem' }}>
                <h2 className="header-title" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>My Request History</h2>
                
                <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                    {myRequests.map(req => (
                        <div key={req._id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                                    {new Date(req.createdAt).toLocaleDateString()}
                                </span>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: getStatusColor(req.status).text, background: getStatusColor(req.status).bg, padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
                                    {req.status === 'partially_fulfilled' ? 'PARTIAL' : req.status.toUpperCase()}
                                </span>
                            </div>
                            
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                {req.items.length} Medicines
                            </div>
                            
                            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '0.5rem', marginTop: 'auto' }}>
                                <div style={{ fontSize: '0.85rem' }}>
                                    {req.items.slice(0, 3).map((item, idx) => (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>{item.name}</span>
                                            <span style={{ fontWeight: 'bold' }}>x{item.quantity}</span>
                                        </div>
                                    ))}
                                    {req.items.length > 3 && <div style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>+ {req.items.length - 3} more...</div>}
                                </div>
                            </div>
                        </div>
                    ))}
                    {myRequests.length === 0 && <p className="text-muted">No history yet.</p>}
                </div>
            </div>
        </div>
    );
};export default PharmacistDashboard;
