import { useState } from 'react';
import { X, Lock, AlertTriangle } from 'lucide-react';
import Button from './Button';

const PasswordConfirmModal = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title = "Security Check", 
    message = "Please enter your password to confirm this action.",
    confirmText = "Confirm Deletion",
    verifyingText = "Verifying...",
    variant = "danger"
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
        setError('Password is required');
        return;
    }
    setError('');
    setLoading(true);
    try {
        await onConfirm(password);
        setPassword('');
    } catch {
        setError('Verification failed');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div 
        className="glass-panel" 
        style={{ 
            maxWidth: '400px', 
            width: '90%', 
            padding: '2rem',
            background: 'rgba(255, 255, 255, 0.95)', // Slightly more opaque for input focus
            border: '1px solid rgba(255, 255, 255, 0.6)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem', color: 'var(--text-main)', fontWeight: 700 }}>
                <div style={{ background: variant === 'danger' ? '#fee2e2' : '#dbeafe', padding: '0.5rem', borderRadius: '50%', color: variant === 'danger' ? '#ef4444' : '#3b82f6', display: 'flex' }}>
                    <Lock size={20} />
                </div>
                {title}
            </h2>
            <button 
                onClick={onClose}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
                <X size={20} />
            </button>
        </div>

        <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '2rem' }}>
                <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>{message}</p>
                <input
                    type="password"
                    autoFocus
                    placeholder="Enter Admin Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ 
                        width: '100%', 
                        padding: '0.875rem', 
                        borderRadius: '8px', 
                        border: '1px solid #cbd5e1',
                        fontSize: '1rem',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                />
                {error && (
                    <p style={{ 
                        color: '#ef4444', 
                        fontSize: '0.9rem', 
                        marginTop: '0.75rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.4rem',
                        background: '#fef2f2',
                        padding: '0.5rem',
                        borderRadius: '6px'
                    }}>
                        <AlertTriangle size={16} /> {error}
                    </p>
                )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <Button variant="outline" onClick={onClose} disabled={loading} style={{ border: '1px solid #e2e8f0' }}>
                    Cancel
                </Button>
                <Button type="submit" variant={variant} isLoading={loading} disabled={!password}>
                    {loading ? verifyingText : confirmText}
                </Button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordConfirmModal;
