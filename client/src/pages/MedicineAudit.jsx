import React, { useState, useEffect } from 'react';
import { Search, AlertCircle, Pill } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';

const MedicineAudit = () => {
    const [loading, setLoading] = useState(false);
    const { showToast } = useNotification();

    // Filters
    const [selectedMedicineId, setSelectedMedicineId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Search input state
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Data
    const [auditData, setAuditData] = useState(null);

    useEffect(() => {
        // Default dates: last 30 days
        const date = new Date();
        const end = new Date(date);
        const start = new Date(date);
        start.setDate(date.getDate() - 30);
        
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
    }, []);

    // Handle Medicine Search Input
    const handleSearchInput = async (value) => {
        setQuery(value);
        setSelectedMedicineId(''); // Force re-selection when typing
        
        if (value.length > 1) { 
            setSearching(true);
            setIsDropdownOpen(true);
            try {
                const { data } = await api.get(`/medicines?search=${encodeURIComponent(value)}&limit=10`);
                setResults(data.medicines || []); 
            } catch (error) {
                console.error("Search failed", error);
            } finally {
                setSearching(false);
            }
        } else {
            setResults([]);
            setIsDropdownOpen(false);
        }
    };

    const selectMedicine = (med) => {
        setSelectedMedicineId(med._id);
        setQuery(med.name);
        setResults([]);
        setIsDropdownOpen(false);
    };

    const handleSearch = async () => {
        if (!selectedMedicineId) {
            showToast('Please search and select a medicine from the list first', 'error');
            return;
        }
        if (!startDate || !endDate) {
            showToast('Please select a date range', 'error');
            return;
        }

        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                medicineId: selectedMedicineId,
                startDate,
                endDate
            });
            
            const response = await api.get(`/requirements/medicine-audit?${queryParams.toString()}`);
            setAuditData(response.data.data);
            
            if (response.data.data.length === 0) {
                showToast('No branch requested this medicine in the selected period', 'info');
            }
        } catch (error) {
            console.error('Audit fetch failed', error);
            showToast(error.response?.data?.message || 'Failed to fetch audit data', 'error');
            setAuditData(null);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'var(--warning)';
            case 'approved': return 'var(--info)';
            case 'partially_fulfilled': return 'var(--primary)';
            case 'completed': return 'var(--success)';
            case 'rejected': return 'var(--danger)';
            default: return 'var(--text-muted)';
        }
    };

    return (
        <div>
            <h1 className="header-title">Medicine Audit</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                Look up which branches requested a specific medicine within a time period.
            </p>

            {/* Control Panel */}
            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    
                    {/* Medicine Auto-Suggest */}
                    <div style={{ flex: '1 1 300px', position: 'relative' }}>
                        <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Search Medicine</label>
                        <div className="input-group">
                            <Search className="input-icon" size={20} />
                            <input
                                type="text"
                                className="glass-input"
                                placeholder="Start typing medicine name..."
                                value={query}
                                onChange={(e) => handleSearchInput(e.target.value)}
                            />
                        </div>

                        {/* Dropdown Suggestions */}
                        {isDropdownOpen && (
                            <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
                                marginTop: '5px', background: 'white', borderRadius: '12px',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.05)',
                                maxHeight: '300px', overflowY: 'auto'
                            }}>
                                {searching ? (
                                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Searching...</div>
                                ) : results.length > 0 ? (
                                    results.map(med => (
                                        <div 
                                            key={med._id} 
                                            onClick={() => selectMedicine(med)}
                                            style={{
                                                padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.03)',
                                                display: 'flex', alignItems: 'center', gap: '0.75rem'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(var(--primary-rgb), 0.05)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', padding: '0.4rem', borderRadius: '8px', color: 'var(--primary)' }}>
                                                <Pill size={16} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 500, color: 'var(--text-main)', fontSize: '0.95rem' }}>{med.name}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{med.supplierId?.name || 'No Supplier'}</div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    query.length > 1 && <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No medicines found.</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Date Range */}
                    <div style={{ flex: '0 1 200px' }}>
                        <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Start Date</label>
                        <input 
                            type="date" 
                            className="input-field" 
                            value={startDate} 
                            onChange={(e) => setStartDate(e.target.value)}
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div style={{ flex: '0 1 200px' }}>
                        <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>End Date</label>
                        <input 
                            type="date" 
                            className="input-field" 
                            value={endDate} 
                            onChange={(e) => setEndDate(e.target.value)}
                            style={{ width: '100%' }}
                        />
                    </div>

                    {/* Search Button */}
                    <button 
                        onClick={handleSearch}
                        className="btn-primary"
                        style={{ height: '44px', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 1.5rem', marginTop: '1.65rem' }}
                        disabled={loading}
                    >
                        {loading ? 'Searching...' : (
                            <>
                                <Search size={18} /> Lookup
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Results Area */}
            {auditData && (
                <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', animation: 'fadeIn 0.3s ease-out' }}>
                    <div style={{ 
                        padding: '1.5rem', borderBottom: '1px solid rgba(0,0,0,0.06)', 
                        background: 'rgba(255,255,255,0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                        <div>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                                Audit Results
                            </h2>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                Found <strong>{auditData.length}</strong> request records for this medicine.
                            </div>
                        </div>
                    </div>

                    <div style={{ padding: '1.5rem', maxHeight: '600px', overflowY: 'auto' }}>
                        {auditData.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                <AlertCircle size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                                <p>No branches requested this medicine in the selected dates.</p>
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', textAlign: 'left' }}>
                                        <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Date</th>
                                        <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Branch Name</th>
                                        <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Quantity</th>
                                        <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Request Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {auditData.map((record, index) => (
                                        <tr key={`${record._id}-${index}`} style={{ borderBottom: index < auditData.length - 1 ? '1px solid rgba(0,0,0,0.03)' : 'none', transition: 'background 0.2s', cursor: 'default' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                                            <td style={{ padding: '1rem 1.5rem', color: 'var(--text-main)' }}>
                                                {new Date(record.date).toLocaleDateString()}
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--primary)' }}>
                                                {record.branchName}
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                                {record.quantity}
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem' }}>
                                                <span style={{
                                                    padding: '0.25rem 0.75rem',
                                                    borderRadius: '20px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600,
                                                    textTransform: 'uppercase',
                                                    backgroundColor: `color-mix(in srgb, ${getStatusColor(record.status)} 15%, transparent)`,
                                                    color: getStatusColor(record.status),
                                                    border: `1px solid color-mix(in srgb, ${getStatusColor(record.status)} 30%, transparent)`
                                                }}>
                                                    {record.status.replace('_', ' ')}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
            
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default MedicineAudit;
