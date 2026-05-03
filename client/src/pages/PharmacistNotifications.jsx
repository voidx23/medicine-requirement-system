import { useState, useEffect } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import api from '../services/api';
import Button from '../components/UI/Button';

const PharmacistNotifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const res = await api.get('/notifications');
            setNotifications(res.data);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const handleReadAll = async () => {
        try {
            await api.put('/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const handleRead = async (id) => {
        try {
            await api.put(`/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                        Notifications
                    </h1>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                        {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <Button variant="secondary" onClick={handleReadAll} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <CheckCheck size={16} />
                        Mark all as read
                    </Button>
                )}
            </div>

            {loading ? (
                <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
            ) : notifications.length === 0 ? (
                <div className="glass-panel" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Bell size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>No notifications yet</h3>
                    <p>You'll be notified here when the store team takes action on your expiry lists.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {notifications.map(n => (
                        <div
                            key={n._id}
                            onClick={() => !n.isRead && handleRead(n._id)}
                            className="glass-panel"
                            style={{
                                padding: '1.25rem 1.5rem',
                                display: 'flex', gap: '1rem', alignItems: 'flex-start',
                                borderLeft: n.isRead ? '4px solid transparent' : '4px solid var(--primary)',
                                cursor: n.isRead ? 'default' : 'pointer',
                                opacity: n.isRead ? 0.7 : 1,
                                transition: 'opacity 0.2s'
                            }}
                        >
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                                background: n.isRead ? '#f1f5f9' : 'var(--primary-light)',
                                color: n.isRead ? '#94a3b8' : 'var(--primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Bell size={17} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: n.isRead ? 500 : 700, fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                                    {n.title}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                    {n.message}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.4rem' }}>
                                    {new Date(n.createdAt).toLocaleDateString()} at {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                            {!n.isRead && (
                                <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: '5px' }} />
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PharmacistNotifications;
