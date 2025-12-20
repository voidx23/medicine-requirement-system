import { Loader2 } from 'lucide-react';

const ServerLoader = () => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3rem',
            minHeight: '300px',
            textAlign: 'center',
            color: 'var(--text-main)',
            gap: '1.5rem'
        }}>
            {/* Animated Spinner with Glow */}
            <div style={{ position: 'relative' }}>
                <div style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '60px', height: '60px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, rgba(0,0,0,0) 70%)',
                    filter: 'blur(10px)'
                }}></div>
                <Loader2 
                    size={48} 
                    color="var(--primary)" 
                    style={{ animation: 'spin 1.5s linear infinite' }} 
                />
            </div>

            <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    Waking up Server...
                </h3>
                <p style={{ color: 'var(--text-muted)' }}>
                    Please wait a moment while we establish connection.
                </p>
            </div>

            {/* Notice Box */}
            <div style={{
                marginTop: '1rem',
                padding: '1rem 1.5rem',
                background: 'rgba(234, 179, 8, 0.1)', // Yellowish tint
                border: '1px solid rgba(234, 179, 8, 0.3)',
                borderRadius: '8px',
                maxWidth: '450px',
                fontSize: '0.9rem',
                color: '#854d0e', // Darker yellow/brown text
                textAlign: 'left',
                display: 'flex',
                alignItems: 'start',
                gap: '0.75rem'
            }}>
                <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                <div>
                    <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Notice:</strong>
                    This web application is in active development.<br/>
                    Performance may be affected, and loading times could be longer than usual.
                </div>
            </div>

            <style>
                {`
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                `}
            </style>
        </div>
    );
};

export default ServerLoader;
