import { useState, useContext } from 'react';
import { X, MessageSquare, Bug, Lightbulb, CheckCircle2, Building2 } from 'lucide-react';
import api from '../../services/api';
import Button from './Button';
import { useNotification } from '../../context/NotificationContext';
import AuthContext from '../../context/AuthContext';

const FeedbackModal = ({ isOpen, onClose }) => {
    const { showToast } = useNotification();
    const { user } = useContext(AuthContext);
    const [message, setMessage] = useState('');
    const [type, setType] = useState('feature'); // feature, bug, other
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim()) return;

        setLoading(true);
        try {
            await api.post('/feedback', { message, type });
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                setMessage('');
                setType('feature');
                onClose();
                showToast('Feedback sent successfully. Thank you!', 'success');
            }, 1500);
        } catch (error) {
            console.error(error);
            showToast('Failed to send feedback', 'error');
        } finally {
            setLoading(false);
        }
    };

    const getTypeIcon = (t) => {
        switch (t) {
            case 'feature': return <Lightbulb size={18} />;
            case 'bug': return <Bug size={18} />;
            default: return <MessageSquare size={18} />;
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.1)', // Lighter, glassier overlay
            backdropFilter: 'blur(8px)'
        }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '2rem', position: 'relative' }}>
                <button 
                    onClick={onClose}
                    aria-label="Close feedback modal"
                    style={{
                        position: 'absolute', top: '1rem', right: '1rem',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)'
                    }}
                >
                    <X size={24} />
                </button>

                {success ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                        <div style={{ 
                            width: '60px', height: '60px', 
                            background: '#dcfce7', color: '#16a34a',
                            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1.5rem'
                        }}>
                            <CheckCircle2 size={32} />
                        </div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                            Thank You!
                        </h2>
                        <p style={{ color: 'var(--text-muted)' }}>
                            Your feedback helps us make the system better.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <MessageSquare className="text-primary" />
                            Send Feedback
                        </h2>

                        {/* User identification */}
                        <div className="glass-panel" style={{ 
                            padding: '0.75rem', marginBottom: '1.5rem', 
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            background: 'rgba(99, 102, 241, 0.1)', // Primary light Tint
                            border: '1px solid rgba(99, 102, 241, 0.2)'
                        }}>
                             <div style={{ 
                                 width: '32px', height: '32px', borderRadius: '50%', 
                                 background: 'var(--primary)', color: 'white',
                                 display: 'flex', alignItems: 'center', justifyContent: 'center'
                             }}>
                                 <Building2 size={18} />
                             </div>
                             <div>
                                 <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.1rem' }}>Feedback from</p>
                                 <p style={{ fontWeight: 600, color: 'var(--text-main)' }}>{user?.username || 'Pharmacist'}</p>
                             </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                                What kind of feedback is this?
                            </label>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                {['feature', 'bug', 'other'].map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setType(t)}
                                        aria-label={`Select ${t} feedback type`}
                                        style={{
                                            flex: 1,
                                            padding: type === t ? 'calc(0.75rem - 1px)' : '0.75rem',
                                            borderRadius: '8px',
                                            border: type === t ? '2px solid var(--primary)' : '1px solid var(--glass-border)',
                                            background: type === t ? 'var(--primary-light)' : 'transparent',
                                            color: type === t ? 'var(--primary)' : 'var(--text-muted)',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                            textTransform: 'capitalize',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {getTypeIcon(t)}
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                                Your Message
                            </label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Describe your idea or the bug you found..."
                                rows="5"
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    border: '1px solid var(--glass-border)',
                                    background: 'rgba(255,255,255,0.5)',
                                    fontSize: '1rem',
                                    outline: 'none',
                                    fontFamily: 'inherit',
                                    resize: 'none'
                                }}
                                onFocus={(e) => e.target.style.background = 'white'}
                                onBlur={(e) => e.target.style.background = 'rgba(255,255,255,0.5)'}
                                required
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={loading || !message.trim()}>
                                {loading ? 'Sending...' : 'Send Feedback'}
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default FeedbackModal;
