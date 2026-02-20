import React, { useState, useEffect } from 'react';
import { Search, AlertCircle, Pill, Activity, CalendarDays, MapPin, Hash, CheckCircle2 } from 'lucide-react';
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
    const [hasSearched, setHasSearched] = useState(false);

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
            setHasSearched(true);
            
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

    const getStatusText = (status) => {
        if (status === 'partially_fulfilled') return 'Partially Fulfilled';
        return status.charAt(0).toUpperCase() + status.slice(1);
    };

    return (
        <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <div style={{ 
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(99, 102, 241, 0.05) 100%)', 
                    padding: '0.6rem', 
                    borderRadius: '12px',
                    color: 'var(--primary)',
                    boxShadow: 'inset 0 0 0 1px rgba(99, 102, 241, 0.1)'
                }}>
                    <Activity size={24} />
                </div>
                <h1 className="header-title" style={{ margin: 0 }}>Medicine Audit Log</h1>
            </div>
            
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '1.05rem', paddingLeft: '0.5rem' }}>
                Track distribution history and branch requisition records for precise auditing.
            </p>

            {/* Control Panel */}
            <div className="glass-panel" style={{ 
                padding: '1.75rem', 
                marginBottom: '2.5rem',
                border: '1px solid rgba(255,255,255,0.4)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.04)'
            }}>
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'minmax(250px, 2fr) 1fr 1fr auto', 
                    gap: '1.5rem', 
                    alignItems: 'end' 
                }}>
                    {/* Medicine Auto-Suggest */}
                    <div style={{ position: 'relative' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.6rem' }}>
                            <Pill size={16} style={{ color: 'var(--primary)' }} /> Search Medicine
                        </label>
                        <div className="input-group" style={{ 
                            background: 'rgba(255,255,255,0.8)', 
                            border: selectedMedicineId ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--glass-border)',
                            boxShadow: selectedMedicineId ? '0 0 0 3px rgba(16, 185, 129, 0.1)' : 'none',
                            transition: 'all 0.3s'
                        }}>
                            {selectedMedicineId ? <CheckCircle2 className="input-icon" size={20} color="#10b981" /> : <Search className="input-icon" size={20} />}
                            <input
                                type="text"
                                className="glass-input"
                                placeholder="Start typing medicine generic name..."
                                value={query}
                                onChange={(e) => handleSearchInput(e.target.value)}
                                style={{ background: 'transparent' }}
                            />
                        </div>

                        {/* Dropdown Suggestions */}
                        {isDropdownOpen && (
                            <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
                                marginTop: '8px', background: 'rgba(255, 255, 255, 0.95)', 
                                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                                borderRadius: '12px',
                                boxShadow: '0 10px 40px rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.5)',
                                maxHeight: '350px', overflowY: 'auto',
                                transformOrigin: 'top', animation: 'dropdownFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                            }}>
                                {searching ? (
                                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <div className="pulse" style={{ width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%', display: 'inline-block', margin: '0 4px', animation: 'pulse 1.5s infinite' }}></div>
                                        <div className="pulse" style={{ width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%', display: 'inline-block', margin: '0 4px', animation: 'pulse 1.5s infinite 0.2s' }}></div>
                                        <div className="pulse" style={{ width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%', display: 'inline-block', margin: '0 4px', animation: 'pulse 1.5s infinite 0.4s' }}></div>
                                    </div>
                                ) : results.length > 0 ? (
                                    results.map(med => (
                                        <div 
                                            key={med._id} 
                                            onClick={() => selectMedicine(med)}
                                            style={{
                                                padding: '0.85rem 1.25rem', cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.03)',
                                                display: 'flex', alignItems: 'center', gap: '1rem',
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.5rem', borderRadius: '10px', color: 'var(--primary)' }}>
                                                <Pill size={18} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '1rem' }}>{med.name}</div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>Supplier: {med.supplierId?.name || 'Unassigned'}</div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    query.length > 1 && <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>No matches found in inventory.</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Date Range Start */}
                    <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.6rem' }}>
                            <CalendarDays size={16} style={{ color: 'var(--text-muted)' }} /> Start Period
                        </label>
                        <input 
                            type="date" 
                            className="input-field" 
                            value={startDate} 
                            onChange={(e) => setStartDate(e.target.value)}
                            style={{ width: '100%', height: '44px', background: 'rgba(255,255,255,0.8)' }}
                        />
                    </div>
                    {/* Date Range End */}
                    <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.6rem' }}>
                            <CalendarDays size={16} style={{ color: 'var(--text-muted)' }} /> End Period
                        </label>
                        <input 
                            type="date" 
                            className="input-field" 
                            value={endDate} 
                            onChange={(e) => setEndDate(e.target.value)}
                            style={{ width: '100%', height: '44px', background: 'rgba(255,255,255,0.8)' }}
                        />
                    </div>

                    {/* Search Button */}
                    <button 
                        onClick={handleSearch}
                        className="btn-primary"
                        style={{ 
                            height: '44px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.5rem', 
                            padding: '0 2rem',
                            fontSize: '0.95rem',
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                            transition: 'all 0.3s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)'}
                        onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.25)'}
                        disabled={loading}
                    >
                        {loading ? 'Processing...' : (
                            <>
                                <Search size={18} /> Retrieve Log
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Results Area */}
            {!auditData && !hasSearched && (
                <div style={{ textAlign: 'center', padding: '4rem 2rem', opacity: 0.8, animation: 'fadeIn 0.6s ease-out' }}>
                    <div style={{ 
                        width: '80px', height: '80px', borderRadius: '50%', background: 'var(--glass-bg)', 
                        border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', 
                        justifyContent: 'center', margin: '0 auto 1.5rem', color: 'var(--primary)' 
                    }}>
                        <Activity size={36} strokeWidth={1.5} />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: 600 }}>Ready to Audit</h3>
                    <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto', lineHeight: 1.6 }}>
                        Use the filters above to pull a comprehensive history of requests for any specific medication.
                    </p>
                </div>
            )}

            {auditData && (
                <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', animation: 'fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                    <div style={{ 
                        padding: '1.5rem', borderBottom: '1px solid rgba(0,0,0,0.06)', 
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 100%)', 
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                        <div>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <FileText size={20} className="text-primary" /> Audit Results Log
                            </h2>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.4rem', paddingLeft: '28px' }}>
                                Found <strong>{auditData.length}</strong> requisition record{auditData.length !== 1 ? 's' : ''} on file.
                            </div>
                        </div>
                    </div>

                    <div style={{ maxHeight: 'calc(100vh - 400px)', minHeight: '300px', overflowY: 'auto' }}>
                        {auditData.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
                                <AlertCircle size={48} strokeWidth={1.5} style={{ opacity: 0.4, marginBottom: '1rem', display: 'inline-block' }} />
                                <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>No Records Found</h3>
                                <p style={{ fontSize: '0.95rem' }}>There were no branch requests for this medication during the specified timeframe.</p>
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(249, 250, 251, 0.95)', backdropFilter: 'blur(4px)' }}>
                                    <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.06)', textAlign: 'left' }}>
                                        <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                 <CalendarDays size={16} /> Date Logged
                                            </div>
                                        </th>
                                        <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                 <MapPin size={16} /> Branch Origin
                                            </div>
                                        </th>
                                        <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                 <Hash size={16} /> Quantity
                                            </div>
                                        </th>
                                        <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                 <Activity size={16} /> Fulfillment Status
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {auditData.map((record, index) => (
                                        <tr key={`${record._id}-${index}`} style={{ 
                                            borderBottom: index < auditData.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none', 
                                            transition: 'all 0.2s ease', cursor: 'default',
                                            background: 'transparent'
                                        }} 
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'rgba(99, 102, 241, 0.03)';
                                            e.currentTarget.style.transform = 'translateY(-1px)';
                                        }} 
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'transparent';
                                            e.currentTarget.style.transform = 'none';
                                        }}>
                                            <td style={{ padding: '1.1rem 1.5rem', color: 'var(--text-main)', fontWeight: 500 }}>
                                                {new Date(record.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric'})}
                                            </td>
                                            <td style={{ padding: '1.1rem 1.5rem' }}>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.7)', padding: '0.2rem 0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', opacity: 0.8 }}></div>
                                                    <span style={{ fontWeight: 600, color: 'var(--primary-dark)' }}>{record.branchName}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.1rem 1.5rem', fontWeight: 600, color: 'var(--text-main)', fontSize: '1.05rem' }}>
                                                {record.quantity} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>units</span>
                                            </td>
                                            <td style={{ padding: '1.1rem 1.5rem' }}>
                                                <span style={{
                                                    padding: '0.35rem 0.85rem',
                                                    borderRadius: '20px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600,
                                                    letterSpacing: '0.3px',
                                                    backgroundColor: `color-mix(in srgb, ${getStatusColor(record.status)} 15%, transparent)`,
                                                    color: getStatusColor(record.status),
                                                    border: `1px solid color-mix(in srgb, ${getStatusColor(record.status)} 30%, transparent)`,
                                                    boxShadow: `0 2px 8px color-mix(in srgb, ${getStatusColor(record.status)} 15%, transparent)`
                                                }}>
                                                    {getStatusText(record.status)}
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
                    from { opacity: 0; transform: translateY(15px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes dropdownFadeIn {
                    from { opacity: 0; transform: translateY(-10px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes pulse {
                    0% { transform: scale(0.8); opacity: 0.5; }
                    50% { transform: scale(1.2); opacity: 1; }
                    100% { transform: scale(0.8); opacity: 0.5; }
                }
            `}</style>
        </div>
    );
};

export default MedicineAudit;
