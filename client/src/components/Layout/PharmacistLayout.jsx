import { useState, useEffect, useContext } from 'react';
import { Outlet } from 'react-router-dom';
import PharmacistSidebar from './PharmacistSidebar';
import BottomNav from './BottomNav';
import { Menu, X, UserCircle, LogOut } from 'lucide-react';
import Frame from '../../assets/frame.svg?react';
import AuthContext from '../../context/AuthContext';

const PharmacistLayout = ({ children }) => {
    const { user, logout } = useContext(AuthContext);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div style={{ display: 'flex', height: '100dvh', background: 'var(--bg-secondary)', position: 'relative', overflow: 'hidden' }}>
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div 
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, backdropFilter: 'blur(4px)' }}
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar with mobile override */}
            <div 
                className={isSidebarOpen ? '' : 'desktop-only'}
                style={isSidebarOpen ? {
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    zIndex: 101,
                    width: 'var(--sidebar-width)',
                    animation: 'slideRight 0.3s ease-out'
                } : {}}
            >
                <PharmacistSidebar />
            </div>
            
            <div className="main-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, height: '100%' }}>
                {/* Header - Always visible */}
                <div style={{ 
                    padding: '0.5rem 1rem', 
                    background: '#fff', 
                    borderBottom: '1px solid var(--glass-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: '60px',
                    boxSizing: 'border-box',
                    flexShrink: 0,
                    zIndex: 90
                }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        {isMobile && (
                            <button 
                                onClick={() => setIsSidebarOpen(true)}
                                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '0.5rem', marginLeft: '-0.5rem' }}
                            >
                                <Menu size={24} />
                            </button>
                        )}
                        {/* Logo only on mobile since desktop has it in sidebar */}
                        {isMobile && (
                            <Frame style={{ height: '80px', width: 'auto', fill: 'var(--primary)' }} />
                        )}
                    </div>
                    
                    {/* Right side: User Profile & Logout */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <UserCircle size={20} />
                            </div>
                            {!isMobile && (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: '1.2' }}>
                                        {user?.name || user?.username || 'Pharmacist'}
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: '1.2' }}>
                                        {user?.role || 'Pharmacy Branch'}
                                    </span>
                                </div>
                            )}
                        </div>
                        <button 
                            onClick={logout}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderRadius: '8px' }}
                            title="Logout"
                            onMouseOver={(e) => e.currentTarget.style.background = '#fee2e2'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                        >
                            <LogOut size={18} />
                            {!isMobile && <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Logout</span>}
                        </button>
                    </div>
                </div>

                <main style={{ overflowY: 'auto', flex: 1, padding: 0 }}>
                    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '1rem' : '1.5rem', paddingBottom: isMobile ? '6rem' : '1.5rem' }}>
                        {children || <Outlet />}
                    </div>
                </main>
            </div>

            <div className="mobile-only">
                <BottomNav />
            </div>

            <style>{`
                @keyframes slideRight {
                    from { transform: translateX(-100%); }
                    to { transform: translateX(0); }
                }
            `}</style>
        </div>
    );
};

export default PharmacistLayout;
