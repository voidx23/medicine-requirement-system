import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Lightbulb, Bug, User, Clock, ChevronDown, ChevronUp, RotateCw } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { FeedbackCardSkeleton } from '../components/UI/Skeleton';

const AdminFeedback = () => {
    const { showToast } = useNotification();
    const [feedbacks, setFeedbacks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);

    const fetchFeedback = useCallback(async () => {
        setLoading(true);
        try {
            const [{ data }] = await Promise.all([
                api.get('/feedback'),
                new Promise(resolve => setTimeout(resolve, 800))
            ]);
            setFeedbacks(data);
        } catch (error) {
            console.error("Failed to fetch feedback", error);
            showToast('Failed to fetch feedback', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchFeedback();
    }, [fetchFeedback]);

    const toggleExpand = (id) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'feature': return <Lightbulb size={20} className="text-yellow-500" />;
            case 'bug': return <Bug size={20} className="text-red-500" />;
            default: return <MessageSquare size={20} className="text-blue-500" />;
        }
    };

    const getTypeColor = (type) => {
        switch (type) {
            case 'feature': return { bg: '#fef9c3', text: '#854d0e', border: '#fef08a' }; // Yellow
            case 'bug': return { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' }; // Red
            default: return { bg: '#e0f2fe', text: '#075985', border: '#bae6fd' }; // Blue
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h1 className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <MessageSquare className="text-primary" />
                    User Feedback
                </h1>
                <button 
                    onClick={fetchFeedback}
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

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {Array.from({ length: 5 }).map((_, i) => <FeedbackCardSkeleton key={i} />)}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {feedbacks.length === 0 && <p className="text-muted">No feedback received yet.</p>}
                    
                    {feedbacks.map((item) => {
                        const style = getTypeColor(item.type);
                        return (
                            <div key={item._id} className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                                <div 
                                    style={{ 
                                        padding: '1rem 1.5rem', 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                        background: expandedId === item._id ? 'rgba(255,255,255,0.8)' : 'transparent'
                                    }}
                                    onClick={() => toggleExpand(item._id)}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        {/* Type Icon Badge */}
                                        <div style={{
                                            width: '40px', height: '40px', borderRadius: '12px',
                                            background: style.bg, color: style.text, border: `1px solid ${style.border}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            {getTypeIcon(item.type)}
                                        </div>

                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <h3 style={{ fontWeight: 600, margin: 0, textTransform: 'capitalize' }}>{item.type}</h3>
                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>•</span>
                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{new Date(item.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginTop: '0.2rem', maxWidth: '500px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {item.message}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                            <User size={16} />
                                            <span>{item.userId?.username || 'Unknown'}</span>
                                        </div>
                                        {expandedId === item._id ? <ChevronUp size={20} color="var(--text-muted)"/> : <ChevronDown size={20} color="var(--text-muted)"/>}
                                    </div>
                                </div>

                                {expandedId === item._id && (
                                    <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', borderTop: '1px solid var(--glass-border)' }}>
                                        <div style={{ marginTop: '1.5rem' }}>
                                            <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Full Message</h4>
                                            <div style={{ 
                                                background: 'rgba(255,255,255,0.5)', 
                                                padding: '1.25rem', 
                                                borderRadius: '12px',
                                                whiteSpace: 'pre-wrap',
                                                lineHeight: '1.6',
                                                color: 'var(--text-main)',
                                                border: '1px solid var(--glass-border)'
                                            }}>
                                                {item.message}
                                            </div>
                                        </div>
                                        
                                        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            Sent at {new Date(item.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AdminFeedback;
