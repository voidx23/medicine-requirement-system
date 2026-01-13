
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Filter, Package, Calendar } from 'lucide-react';

const HistoryDetailsModal = ({ isOpen, onClose, data }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSupplier, setSelectedSupplier] = useState('');

    // Extract unique suppliers from the items
    const suppliers = useMemo(() => {
        if (!data) return [];
        const unique = new Set();
        data.items.forEach(item => {
            if (item.medicineId?.supplierId?.name) {
                unique.add(item.medicineId.supplierId.name);
            }
        });
        return Array.from(unique).sort();
    }, [data]);

    // Filter items
    const filteredItems = useMemo(() => {
        if (!data) return [];
        return data.items.filter(item => {
            const medName = item.medicineId?.name?.toLowerCase() || '';
            const supName = item.medicineId?.supplierId?.name || '';
            
            const matchesSearch = medName.includes(searchQuery.toLowerCase());
            const matchesSupplier = selectedSupplier ? supName === selectedSupplier : true;

            return matchesSearch && matchesSupplier;
        });
    }, [data, searchQuery, selectedSupplier]);

    if (!isOpen || !data) return null;

    return createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', 
            zIndex: 99999, // High z-index to break out of all contexts
            animation: 'fadeIn 0.2s ease-out'
        }}>
            <div className="glass-panel" style={{
                width: '90%', maxWidth: '850px', height: '80vh',
                display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.6)',
                background: 'rgba(255, 255, 255, 0.9)', 
                borderRadius: '16px'
            }}>
                {/* Compact Header */}
                <div style={{
                    padding: '1rem 1.5rem', borderBottom: '1px solid rgba(0,0,0,0.06)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'rgba(255,255,255,0.8)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {/* Smaller Icon Block */}
                        <div style={{ 
                            width: '36px', height: '36px', borderRadius: '10px', 
                            background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', boxShadow: '0 4px 12px rgba(var(--primary-rgb), 0.2)'
                        }}>
                             <Calendar size={18} />
                        </div>
                        
                        {/* Compact Date & Title */}
                        <div>
                            <h2 style={{ 
                                fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', 
                                margin: 0, lineHeight: 1.2
                            }}>
                                {new Date(data.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                            </h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2px' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Daily Items</span>
                                <span style={{ width: '4px', height: '4px', background: '#cbd5e1', borderRadius: '50%' }}></span>
                                <span style={{ 
                                    fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600,
                                    display: 'flex', alignItems: 'center', gap: '0.25rem'
                                }}>
                                    <Package size={12} /> {data.items.length}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={onClose}
                        className="btn-icon"
                        style={{ 
                            width: '32px', height: '32px', borderRadius: '50%', border: 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.03)',
                            transition: 'all 0.2s'
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Single Line Toolbar */}
                <div style={{ 
                    padding: '0.75rem 1.5rem', background: 'rgba(255,255,255,0.4)', 
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    display: 'flex', gap: '1rem', alignItems: 'center'
                }}>
                    {/* Search - Flexible width */}
                    <div style={{ 
                        flex: 1, position: 'relative', display: 'flex', alignItems: 'center',
                        background: 'white', borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        padding: '0 0.75rem', height: '38px'
                    }}>
                        <Search size={16} style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }} />
                        <input
                            type="text"
                            placeholder="Search medicine..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ 
                                border: 'none', background: 'transparent', outline: 'none', width: '100%', 
                                fontSize: '0.9rem', color: 'var(--text-main)'
                            }}
                        />
                    </div>
                    
                    {/* Filter - Fixed width relative */}
                    <div style={{ 
                        flex: '0 0 200px', position: 'relative', display: 'flex', alignItems: 'center',
                        background: 'white', borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        padding: '0 0.75rem', height: '38px'
                    }}>
                        <Filter size={16} style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }} />
                        <select
                            value={selectedSupplier}
                            onChange={(e) => setSelectedSupplier(e.target.value)}
                            style={{ 
                                border: 'none', background: 'transparent', outline: 'none', width: '100%', 
                                fontSize: '0.9rem', color: 'var(--text-main)', cursor: 'pointer'
                            }}
                        >
                            <option value="">All Suppliers</option>
                            {suppliers.map(sup => (
                                <option key={sup} value={sup}>{sup}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Expanded Table Area */}
                <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(255,255,255,0.5)' }}>
                    {filteredItems.length === 0 ? (
                        <div style={{ 
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                            height: '100%', color: 'var(--text-muted)', gap: '0.5rem' 
                        }}>
                             <Search size={32} style={{ opacity: 0.2 }} />
                             <p style={{fontSize: '0.9rem'}}>No results found</p>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                <tr style={{ background: 'rgba(248, 250, 252, 0.95)', borderBottom: '1px solid #e2e8f0' }}>
                                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', color: '#64748b', fontWeight: 600, width: '50px' }}>#</th>
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Medicine Name</th>
                                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Supplier</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.map((item, index) => (
                                    <tr key={index} className="table-row-hover" style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '0.75rem 1.5rem', color: '#94a3b8', fontWeight: 500 }}>{index + 1}</td>
                                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#334155' }}>
                                            {item.medicineId?.name || <span style={{color:'var(--danger)'}}>Deleted Item</span>}
                                        </td>
                                        <td style={{ padding: '0.75rem 1.5rem' }}>
                                            <span style={{ 
                                                display: 'inline-block', padding: '0.15rem 0.6rem', 
                                                background: 'white', border: '1px solid #e2e8f0',
                                                borderRadius: '4px', fontSize: '0.8rem', color: '#475569'
                                            }}>
                                                {item.medicineId?.supplierId?.name || 'Unknown'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Compact Footer */}
                <div style={{ 
                    padding: '0.75rem 1.5rem', borderTop: '1px solid #e2e8f0', 
                    textAlign: 'right', background: 'white', color: '#64748b', fontSize: '0.8rem',
                    display: 'flex', justifyContent: 'flex-end', alignItems: 'center'
                }}>
                    Showing <strong style={{ margin: '0 4px', color: '#334155' }}>{filteredItems.length}</strong> items
                </div>
                
                <style>{`
                    .table-row-hover:hover {
                        background-color: #f8fafc;
                    }
                    @keyframes fadeIn {
                        from { opacity: 0; transform: scale(0.98); }
                        to { opacity: 1; transform: scale(1); }
                    }
                `}</style>
            </div>
        </div>
    , document.body);
};

export default HistoryDetailsModal;
