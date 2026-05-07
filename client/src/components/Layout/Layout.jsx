import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { Menu } from 'lucide-react';

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, backdropFilter: 'blur(4px)' }}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

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
        <Sidebar />
      </div>
      
      <main className="main-content" style={{ overflowY: 'auto', flex: 1 }}>
        {/* Mobile Header */}
        <div className="mobile-only" style={{ 
            padding: '1rem', 
            background: '#fff', 
            borderBottom: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 90
        }}>
            <button 
                onClick={() => setIsSidebarOpen(true)}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}
            >
                <Menu size={24} />
            </button>
            <div style={{ fontWeight: 700, color: 'var(--primary)' }}>Admin Panel</div>
            <div style={{ width: 24 }} /> {/* Spacer */}
        </div>

        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem' }}>
            <Outlet />
        </div>
      </main>

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

export default Layout;
