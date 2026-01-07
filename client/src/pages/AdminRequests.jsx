import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, RotateCw } from 'lucide-react';
import api from '../services/api';

const AdminRequests = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);

    const fetchRequests = async () => {
        setLoading(true); // Ensure loading state starts
        try {
            // Wait for both the API call AND a minimum delay of 800ms
            const [{ data }] = await Promise.all([
                api.get('/requests'),
                new Promise(resolve => setTimeout(resolve, 800))
            ]);
            setRequests(data);
        } catch (error) {
            console.error("Failed to fetch requests", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const updateStatus = async (id, status) => {
        if (!window.confirm(`Are you sure you want to mark this as ${status}?`)) return;
        try {
            await api.put(`/requests/${id}/status`, { status });
            fetchRequests(); // Refresh list
        } catch (error) {
            alert('Failed to update status');
        }
    };

    const toggleExpand = (id) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'approved': return 'bg-green-100 text-green-800';
            case 'rejected': return 'bg-red-100 text-red-800';
            default: return 'bg-yellow-100 text-yellow-800';
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h1 className="header-title">Pharmacist Requests</h1>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button 
                        onClick={fetchRequests}
                        disabled={loading}
                        style={{ 
                            background: 'rgba(255, 255, 255, 0.8)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255, 255, 255, 0.5)',
                            padding: '0.6rem 1.2rem',
                            borderRadius: '30px',
                            display: 'flex', alignItems: 'center', gap: '0.6rem',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                            color: 'var(--primary)',
                            fontWeight: 600,
                            fontSize: '0.9rem'
                        }}
                        onMouseOver={(e) => { 
                            if(!loading) {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                            }
                        }}
                        onMouseOut={(e) => {
                            if(!loading) {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)';
                            }
                        }}
                    >
                        <RotateCw size={18} className={loading ? "spin-animation" : ""} />
                        <span>Refresh List</span>
                    </button>
                </div>
            </div>

            {loading ? <div>Loading...</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {requests.length === 0 && <p className="text-muted">No requests found.</p>}
                    
                    {requests.map(req => (
                        <div key={req._id} className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                            {/* Header Row */}
                            <div 
                                style={{ 
                                    padding: '1rem 1.5rem', 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    background: expandedId === req._id ? 'rgba(255,255,255,0.8)' : 'transparent'
                                }}
                                onClick={() => toggleExpand(req._id)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ 
                                        width: '40px', height: '40px', borderRadius: '50%', 
                                        background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#0284c7', fontWeight: 'bold'
                                    }}>
                                        {req.pharmacistId?.username?.[0]?.toUpperCase() || 'U'}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '600' }}>{req.pharmacistId?.username}</div>
                                        {req.submittedBy && (
                                            <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 500 }}>
                                                Signed by: {req.submittedBy}
                                            </div>
                                        )}
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            {new Date(req.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                    <span style={{ 
                                        padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.85rem',
                                        background: req.status === 'pending' ? '#fef3c7' : (req.status === 'approved' ? '#dcfce7' : '#fee2e2'),
                                        color: req.status === 'pending' ? '#d97706' : (req.status === 'approved' ? '#166534' : '#991b1b')
                                    }}>
                                        {req.status?.toUpperCase()}
                                    </span>
                                    {expandedId === req._id ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                                </div>
                            </div>

                            {/* Expanded Content */}
                            {expandedId === req._id && (
                                <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', borderTop: '1px solid var(--glass-border)' }}>
                                    <div style={{ marginTop: '1rem', width: '100%' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                                    <th style={{ paddingBottom: '0.5rem' }}>Medicine</th>
                                                    <th style={{ paddingBottom: '0.5rem' }}>Supplier</th>
                                                    <th style={{ paddingBottom: '0.5rem' }}>Qty</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {req.items.map((item, idx) => (
                                                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                                        <td style={{ padding: '0.75rem 0' }}>{item.name}</td>
                                                        <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)' }}>{item.medicineId?.supplierId?.name || 'Unknown'}</td>
                                                        <td style={{ padding: '0.75rem 0', fontWeight: 'bold' }}>{item.quantity}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Action Buttons */}
                                    {req.status === 'pending' && (
                                        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                            <button 
                                                className="btn-ghost" 
                                                style={{ color: '#ef4444', border: '1px solid #ef4444' }}
                                                onClick={(e) => { e.stopPropagation(); updateStatus(req._id, 'rejected'); }}
                                            >
                                                <XCircle size={18} /> Reject
                                            </button>
                                            <button 
                                                className="btn-primary" 
                                                style={{ background: '#22c55e' }}
                                                onClick={(e) => { e.stopPropagation(); updateStatus(req._id, 'approved'); }}
                                            >
                                                <CheckCircle size={18} /> Mark as Done
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdminRequests;
