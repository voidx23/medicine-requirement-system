import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const NotificationBell = () => {
    const [unreadCount, setUnreadCount] = useState(0);
    const navigate = useNavigate();

    const fetchUnreadCount = async () => {
        try {
            const res = await api.get('/notifications');
            setUnreadCount(res.data.filter(n => !n.isRead).length);
        } catch (error) {
            // silent fail — non-critical
        }
    };

    useEffect(() => {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 60000);
        return () => clearInterval(interval);
    }, []);

    return (
        <button
            onClick={() => navigate('/pharmacist-dashboard/notifications')}
            title="Notifications"
            style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                padding: '0.5rem',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
            <Bell size={20} />
            {unreadCount > 0 && (
                <span style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    background: '#ef4444',
                    color: 'white',
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    padding: '2px 4px',
                    borderRadius: '10px',
                    minWidth: '16px',
                    textAlign: 'center',
                    lineHeight: 1.2
                }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}
        </button>
    );
};

export default NotificationBell;
