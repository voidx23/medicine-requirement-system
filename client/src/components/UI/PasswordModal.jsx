import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { Lock, ArrowRight } from 'lucide-react';

const PasswordModal = ({ isOpen, onClose, onSubmit }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if(!password) return;
        
        // Pass password back to parent
        const success = onSubmit(password);
        if (!success) {
            setError(true);
            setPassword('');
        } else {
            setError(false);
            setPassword('');
            onClose();
        }
    };

    const handleClose = () => {
        setPassword('');
        setError(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Security Check">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                    <div style={{ 
                        width: '64px', height: '64px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem'
                    }}>
                        <Lock size={32} />
                    </div>
                    <p style={{ color: 'var(--text-muted)' }}>This action requires administrative privileges.</p>
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-main)' }}>
                        Password
                    </label>
                    <input 
                        type="password"
                        autoFocus
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            setError(false);
                        }}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            borderRadius: '8px',
                            border: error ? '1px solid #ef4444' : '1px solid var(--glass-border)',
                            fontSize: '1rem',
                            outline: 'none',
                            transition: 'border-color 0.2s',
                            boxShadow: error ? '0 0 0 2px #fee2e2' : 'none'
                        }}
                        placeholder="Enter admin password"
                    />
                    {error && (
                        <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                            Incorrect password. Please try again.
                        </p>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <Button 
                        type="button" 
                        onClick={handleClose}
                        variant="secondary"
                    >
                        Cancel
                    </Button>
                    <Button 
                        type="submit" 
                        variant="danger" // Danger since it's a delete protection
                        style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}
                    >
                        Confirm Access <ArrowRight size={18} style={{ marginLeft: '0.5rem' }} />
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default PasswordModal;
