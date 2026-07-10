import React, { useState, useEffect, useContext } from 'react';
import { Calendar, Filter, FileText, Download, Search, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import Loading from '../components/UI/Loading';
import AuthContext from '../context/AuthContext';

const Reports = () => {
    const { user } = useContext(AuthContext);
    const canGeneratePDF = user?.isSuperAdmin || user?.permissions?.includes('generate_requirement_pdf') || user?.permissions?.includes('reports');
    const [loading, setLoading] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const { showToast } = useNotification();

    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    
    // Multi-select state
    const [selectedSupplierIds, setSelectedSupplierIds] = useState([]); 
    const [suppliers, setSuppliers] = useState([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Data
    const [reportData, setReportData] = useState(null); 

    useEffect(() => {
        fetchSuppliers();
        // Set default dates (This Month)
        const date = new Date();
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        setStartDate(firstDay.toISOString().split('T')[0]);
        setEndDate(lastDay.toISOString().split('T')[0]);
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isDropdownOpen && !event.target.closest('.custom-dropdown')) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isDropdownOpen]);

    const fetchSuppliers = async () => {
        try {
            const response = await api.get('/suppliers');
            setSuppliers(response.data);
        } catch (error) {
            console.error("Failed to load suppliers", error);
        }
    };

    const toggleSupplier = (id) => {
        if (selectedSupplierIds.includes(id)) {
            setSelectedSupplierIds(selectedSupplierIds.filter(sid => sid !== id));
        } else {
            setSelectedSupplierIds([...selectedSupplierIds, id]);
        }
    };

    const handlePreview = async () => {
        if (!startDate || !endDate) {
            showToast('Please select a date range', 'error');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/requirements/report-data', {
                startDate,
                endDate,
                // If empty, send empty array (backend interprets as All)
                supplierIds: selectedSupplierIds 
            });
            setReportData(response.data);
            if (response.data.totalItems === 0) {
                showToast('No medicines found for the selected criteria', 'info');
            }
        } catch (error) {
            console.error('Report fetch failed', error);
            showToast(error.response?.data?.message || 'Failed to generate report preview', 'error');
            setReportData(null);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (!reportData || reportData.totalItems === 0) return;

        setGeneratingPdf(true);
        try {
            const response = await api.post('/requirements/generate-pdf', {
                startDate,
                endDate,
                supplierIds: selectedSupplierIds 
            }, {
                responseType: 'blob'
            });
            
            // Create blob link to download
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Requirement_Report_${startDate}_to_${endDate}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            showToast('PDF downloaded successfully', 'success');
        } catch (err) {
            console.error('PDF Generation failed', err);
            showToast('Failed to generate PDF', 'error');
        } finally {
            setGeneratingPdf(false);
        }
    };

    return (
        <div>
            <h1 className="header-title">Reports</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                Generate consolidated requirements by date range and supplier.
            </p>

            {/* Control Panel */}
            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', position: 'relative', zIndex: 20 }}>
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    
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

                    {/* Supplier Multi-Select Custom Dropdown */}
                    <div style={{ flex: 1.5, minWidth: '300px' }}>
                        <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Suppliers</label>
                        
                        <div className="custom-dropdown" style={{ position: 'relative' }}>
                            {/* Trigger */}
                            <div 
                                className="input-field"
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                style={{ 
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                                    cursor: 'pointer', background: 'white'
                                }}
                            >
                                <span style={{ color: selectedSupplierIds.length === 0 ? 'var(--text-muted)' : 'var(--text-main)' }}>
                                    {selectedSupplierIds.length === 0 
                                        ? 'All Suppliers Selected' 
                                        : `${selectedSupplierIds.length} Supplier${selectedSupplierIds.length > 1 ? 's' : ''} Selected`}
                                </span>
                                <Filter size={16} color="var(--text-muted)" />
                            </div>

                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                                <div style={{
                                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
                                    marginTop: '5px', background: 'white', borderRadius: '12px',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.05)',
                                    maxHeight: '300px', overflowY: 'auto', padding: '0.5rem',
                                    minWidth: '260px' // Prevent being too narrow
                                }}>
                                    <div 
                                        onClick={() => setSelectedSupplierIds([])}
                                        style={{
                                            padding: '0.75rem', borderRadius: '8px', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                                            marginBottom: '4px',
                                            background: selectedSupplierIds.length === 0 ? 'rgba(var(--primary-rgb), 0.05)' : 'transparent',
                                            color: selectedSupplierIds.length === 0 ? 'var(--primary)' : 'var(--text-main)'
                                        }}
                                    >
                                        <div style={{
                                            width: '18px', height: '18px', borderRadius: '4px',
                                            border: selectedSupplierIds.length === 0 ? '2px solid var(--primary)' : '2px solid var(--text-muted)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                            background: selectedSupplierIds.length === 0 ? 'var(--primary)' : 'transparent'
                                        }}>
                                            {selectedSupplierIds.length === 0 && <div style={{width: '6px', height: '6px', borderRadius: '1px', background: 'white'}} />}
                                        </div>
                                        <span style={{ fontWeight: selectedSupplierIds.length === 0 ? 600 : 400 }}>Select All / Reset</span>
                                    </div>

                                    <div style={{ height: '1px', background: 'rgba(0,0,0,0.05)', margin: '4px 0' }} />

                                    {suppliers.map(sup => {
                                        const isSelected = selectedSupplierIds.includes(sup._id);
                                        return (
                                            <div 
                                                key={sup._id} 
                                                onClick={() => toggleSupplier(sup._id)}
                                                style={{
                                                    padding: '0.75rem', borderRadius: '8px', cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                                                    background: isSelected ? 'rgba(var(--primary-rgb), 0.05)' : 'transparent',
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = isSelected ? 'rgba(var(--primary-rgb), 0.08)' : 'rgba(0,0,0,0.02)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? 'rgba(var(--primary-rgb), 0.05)' : 'transparent'}
                                            >
                                                <div style={{
                                                    width: '18px', height: '18px', borderRadius: '4px',
                                                    border: isSelected ? '2px solid var(--primary)' : '2px solid var(--text-muted)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                                    background: isSelected ? 'var(--primary)' : 'transparent',
                                                    transition: 'all 0.2s'
                                                }}>
                                                    {isSelected && (
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="20 6 9 17 4 12"></polyline>
                                                        </svg>
                                                    )}
                                                </div>
                                                <span style={{ color: isSelected ? 'var(--primary)' : 'var(--text-main)', fontWeight: isSelected ? 500 : 400 }}>
                                                    {sup.name}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Generate Button */}
                    <button 
                        onClick={handlePreview}
                        className="btn-primary"
                        style={{ height: '44px', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 1.5rem', marginTop: '1.6rem' }}
                        disabled={loading}
                    >
                        {loading ? 'Loading...' : (
                            <>
                                <Search size={18} /> Preview Report
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Results Area */}
            {reportData && (
                <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', animation: 'fadeIn 0.3s ease-out' }}>
                    
                    {/* Results Header */}
                    <div style={{ 
                        padding: '1.5rem', borderBottom: '1px solid rgba(0,0,0,0.06)', 
                        background: 'rgba(255,255,255,0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                        <div>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                                Report Preview
                            </h2>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                Found <strong>{reportData.totalItems}</strong> unique items for selected period
                            </div>
                        </div>
                        {canGeneratePDF && (
                            <button 
                                onClick={handleDownloadPDF}
                                className="btn-primary"
                                disabled={generatingPdf || reportData.totalItems === 0}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--success)', borderColor: 'var(--success)' }}
                            >
                                {generatingPdf ? 'Generating...' : (
                                    <>
                                        <Download size={18} /> Download PDF
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Content */}
                    <div style={{ padding: '1.5rem', maxHeight: '600px', overflowY: 'auto' }}>
                        {reportData.totalItems === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                <AlertCircle size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                                <p>No requirements found for better criteria.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                {reportData.data.map((group, groupIndex) => (
                                    <div key={groupIndex} style={{ 
                                        background: 'rgba(255,255,255,0.6)', borderRadius: '12px', 
                                        border: '1px solid rgba(0,0,0,0.05)', overflow: 'hidden'
                                    }}>
                                        <div style={{ 
                                            padding: '1rem 1.5rem', background: 'rgba(var(--primary-rgb), 0.05)', 
                                            borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between'
                                        }}>
                                            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                                                {group.supplier.name}
                                            </h3>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                {group.medicines.length} Items
                                            </span>
                                        </div>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', color: 'var(--text-muted)', width: '60px' }}>#</th>
                                                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', color: 'var(--text-muted)' }}>Medicine Name</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {group.medicines.map((med, i) => (
                                                    <tr key={i} style={{ borderBottom: i < group.medicines.length - 1 ? '1px solid rgba(0,0,0,0.03)' : 'none' }}>
                                                        <td style={{ padding: '0.75rem 1.5rem', color: 'var(--text-muted)' }}>{i + 1}</td>
                                                        <td style={{ padding: '0.75rem 1.5rem', fontWeight: 500, color: 'var(--text-main)' }}>{med.name}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ))}
                            </div>
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

export default Reports;
