import { useState, useEffect } from 'react';
import { RotateCw } from 'lucide-react';
import api from '../services/api';

import Modal from '../components/UI/Modal';

const PharmacistHistory = () => {
    const [myRequests, setMyRequests] = useState([]);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            // Wait for both the API call AND a minimum delay of 800ms
            const [{ data }] = await Promise.all([
                api.get('/requests'),
                new Promise(resolve => setTimeout(resolve, 800))
            ]);
            setMyRequests(data);
        } catch (error) {
            console.error("Failed to fetch history", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    return (
        <div>
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="header-title">Requirement History</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Track status of your submitted requirements.</p>
                </div>
                <button 
                    onClick={fetchHistory}
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
                    <span>Refresh</span>
                </button>
            </div>

            {loading ? <div>Loading...</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {myRequests.map((req, index) => (
                        <div 
                            key={req._id} 
                            className="glass-panel" 
                            onClick={() => setSelectedRequest(req)}
                            style={{ 
                                padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center',
                                cursor: 'pointer', transition: 'all 0.2s ease'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseOut={(e) => e.currentTarget.style.transform = 'none'}
                        >
                            {/* Number Badge */}
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-light)',
                                color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 'bold', fontSize: '0.9rem', flexShrink: 0
                            }}>
                                {myRequests.length - index}
                            </div>

                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
                                            {new Date(req.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </div>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                            {req.items.length} Items Requested
                                        </div>
                                    </div>
                                    <span style={{ 
                                        padding: '0.35rem 1rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600,
                                        background: req.status === 'pending' ? '#fef3c7' : (req.status === 'approved' ? '#dcfce7' : '#fee2e2'),
                                        color: req.status === 'pending' ? '#d97706' : (req.status === 'approved' ? '#166534' : '#991b1b')
                                    }}>
                                        {req.status.toUpperCase()}
                                    </span>
                                </div>
                                
                                {req.adminNotes && (
                                    <div style={{ 
                                        marginTop: '0.5rem', padding: '0.5rem 0.75rem', 
                                        background: '#fff1f2', borderRadius: '6px', 
                                        fontSize: '0.85rem', color: '#be123c', border: '1px solid #fecdd3'
                                    }}>
                                        <span style={{ fontWeight: 600 }}>Note: </span> {req.adminNotes}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {myRequests.length === 0 && <p className="text-muted">No history found.</p>}
                </div>
            )}

            {/* Details Modal */}
            <Modal
                isOpen={!!selectedRequest}
                onClose={() => setSelectedRequest(null)}
                title={`Request Details - ${selectedRequest ? new Date(selectedRequest.createdAt).toLocaleDateString('en-GB') : ''}`}
            >
                {selectedRequest && (
                    <div>
                        <div style={{ maxHeight: '60vh', overflowY: 'auto', marginBottom: '1.5rem' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                                <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                                    <tr>
                                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0', width: '50px' }}>Sl.No</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Medicine</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0' }}>Qty</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedRequest.items.map((item, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                            <td style={{ padding: '0.75rem', color: 'var(--text-main)' }}>{item.name}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>


                    </div>
                )}
            </Modal>
        </div>
    );
};

export default PharmacistHistory;
