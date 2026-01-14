import { useState, useContext, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { Lock, User, ArrowRight, Activity, ShieldCheck } from 'lucide-react';
import Frame from '../assets/frame.svg?react';

const Login = () => {
    const [searchParams] = useSearchParams();
    const branchParam = searchParams.get('branch'); // Get ?branch=xyz

    const [username, setUsername] = useState(branchParam || '');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login, user } = useContext(AuthContext);
    const navigate = useNavigate();

    const location = useLocation();

    useEffect(() => {
        if (user) {
            // Check if there's a page they came from (e.g. /setup-device)
            const from = location.state?.from?.pathname;
            const defaultDashboard = user.role === 'admin' ? '/' : '/pharmacist-dashboard';
            
            navigate(from || defaultDashboard, { replace: true });
        }
    }, [user, navigate, location]);

    // Force username from param if present
    useEffect(() => {
        if (branchParam) {
            setUsername(branchParam);
        }
    }, [branchParam]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        
        // 1. If username locked by param -> It's safe (already restricted).
        // 2. If NO param -> Must be ADMIN. Everyone else is BLOCKED.
        if (!branchParam && username.toLowerCase() !== 'admin') {
             setError('Security Restriction: You must use the Secure Desktop Shortcut to log in.');
             setIsLoading(false);
             return;
        }

        try {
            await login(username, password);
             // Navigation happens in useEffect
        } catch (err) {
            setError('Invalid credentials');
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)', // Softer indigo gradient
            padding: '1rem',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Ambient Background Shapes */}
            <div style={{
                position: 'absolute',
                top: '-10%',
                right: '-5%',
                width: '600px',
                height: '600px',
                background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(255,255,255,0) 70%)',
                borderRadius: '50%',
                zIndex: 0
            }} />
            <div style={{
                position: 'absolute',
                bottom: '-10%',
                left: '-10%',
                width: '500px',
                height: '500px',
                background: 'radial-gradient(circle, rgba(168,85,247,0.15) 0%, rgba(255,255,255,0) 70%)',
                borderRadius: '50%',
                zIndex: 0
            }} />

            <div className="glass-panel" style={{ 
                padding: '3.5rem 3rem', 
                width: '100%', 
                maxWidth: '440px',
                position: 'relative',
                zIndex: 1,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.5)'
            }}>
                <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    marginBottom: '2.5rem' 
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        marginBottom: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary)',
                        filter: 'drop-shadow(0 4px 6px rgba(99, 102, 241, 0.3))'
                    }}>
                        <Frame style={{ width: '100%', height: '100%' }} />
                    </div>
                    
                    <h1 className="header-title" style={{ fontSize: '1.75rem', marginBottom: '0.5rem', textAlign: 'center' }}>
                        Welcome Back
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                        Sign in to access the dashboard
                    </p>
                </div>

                {error && (
                    <div style={{ 
                        background: 'rgba(239, 68, 68, 0.1)', 
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#ef4444', 
                        padding: '0.75rem', 
                        borderRadius: '12px', 
                        marginBottom: '1.5rem', 
                        fontSize: '0.9rem', 
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                    }}>
                        <Activity size={16} />
                        {error}
                    </div>
                )}
                
                {branchParam && (
                    <div style={{ 
                        background: 'rgba(22, 163, 74, 0.1)', 
                        border: '1px solid rgba(22, 163, 74, 0.2)',
                        color: '#166534', 
                        padding: '0.75rem', 
                        borderRadius: '12px', 
                        marginBottom: '1.5rem', 
                        fontSize: '0.9rem', 
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                    }}>
                        <ShieldCheck size={16} />
                        Secure Login for <b>{branchParam.toUpperCase()}</b>
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="input-group" style={{ position: 'relative' }}>
                        <User 
                            size={20} 
                            style={{ 
                                position: 'absolute', 
                                left: '16px', 
                                top: '50%', 
                                transform: 'translateY(-50%)',
                                color: 'var(--text-muted)',
                                pointerEvents: 'none'
                            }} 
                        />
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            readOnly={!!branchParam} // Lock if param is present
                            required
                            style={{
                                width: '100%',
                                padding: '0.85rem 1rem 0.85rem 3rem',
                                border: '1px solid rgba(203, 213, 225, 0.6)',
                                borderRadius: '12px',
                                fontSize: '1rem',
                                background: branchParam ? '#f1f5f9' : 'rgba(255, 255, 255, 0.6)', // Greyed out if locked
                                backdropFilter: 'blur(4px)',
                                transition: 'all 0.2s ease',
                                outline: 'none',
                                color: 'var(--text-main)',
                                cursor: branchParam ? 'not-allowed' : 'text'
                            }}
                            onFocus={(e) => {
                                if (!branchParam) {
                                    e.target.style.borderColor = 'var(--primary)';
                                    e.target.style.background = 'white';
                                    e.target.style.boxShadow = '0 0 0 3px var(--primary-light)';
                                }
                            }}
                            onBlur={(e) => {
                                if (!branchParam) {
                                    e.target.style.borderColor = 'rgba(203, 213, 225, 0.6)';
                                    e.target.style.background = 'rgba(255, 255, 255, 0.6)';
                                    e.target.style.boxShadow = 'none';
                                }
                            }}
                        />
                         {branchParam && (
                            <Lock 
                                size={16} 
                                style={{ 
                                    position: 'absolute', 
                                    right: '16px', 
                                    top: '50%', 
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-muted)'
                                }} 
                            />
                        )}
                    </div>

                    <div className="input-group" style={{ position: 'relative' }}>
                        <Lock 
                            size={20} 
                            style={{ 
                                position: 'absolute', 
                                left: '16px', 
                                top: '50%', 
                                transform: 'translateY(-50%)',
                                color: 'var(--text-muted)',
                                pointerEvents: 'none'
                            }} 
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '0.85rem 1rem 0.85rem 3rem',
                                border: '1px solid rgba(203, 213, 225, 0.6)',
                                borderRadius: '12px',
                                fontSize: '1rem',
                                background: 'rgba(255, 255, 255, 0.6)',
                                backdropFilter: 'blur(4px)',
                                transition: 'all 0.2s ease',
                                outline: 'none',
                                color: 'var(--text-main)'
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = 'var(--primary)';
                                e.target.style.background = 'white';
                                e.target.style.boxShadow = '0 0 0 3px var(--primary-light)';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = 'rgba(203, 213, 225, 0.6)';
                                e.target.style.background = 'rgba(255, 255, 255, 0.6)';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        style={{
                            marginTop: '1rem',
                            padding: '0.85rem',
                            background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '1rem',
                            fontWeight: 600,
                            cursor: isLoading ? 'wait' : 'pointer',
                            transition: 'all 0.3s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                            opacity: isLoading ? 0.7 : 1
                        }}
                        onMouseOver={(e) => !isLoading && (e.currentTarget.style.transform = 'translateY(-1px)')}
                        onMouseOut={(e) => !isLoading && (e.currentTarget.style.transform = 'translateY(0)')}
                    >
                        {isLoading ? 'Signing in...' : (
                            <>
                                Sign In <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>
                
                <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Medicine Management System v1.0
                </div>
            </div>
        </div>
    );
};

export default Login;
