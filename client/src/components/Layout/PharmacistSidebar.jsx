import { NavLink } from 'react-router-dom';
import { PlusCircle, History, LogOut, Sparkles } from 'lucide-react';
import { useContext } from 'react';
import Frame from '../../assets/frame.svg?react';
import AuthContext from '../../context/AuthContext';

const PharmacistSidebar = () => {
  const { logout } = useContext(AuthContext);
  
  const links = [
    { to: '/pharmacist-dashboard/new', icon: PlusCircle, label: 'New Request' },
    { to: '/pharmacist-dashboard/history', icon: History, label: 'Req History' },
    { to: '/pharmacist-dashboard/updates', icon: Sparkles, label: "What's New" },
  ];

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      height: '100vh',
      position: 'fixed',
      left: 0,
      top: 0,
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '2rem',
      backgroundColor: 'rgba(255, 255, 255, 0.6)',
      backdropFilter: 'blur(10px)',
      borderRight: '1px solid var(--glass-border)',
      zIndex: 10,
      overflowY: 'auto',
      scrollbarWidth: 'thin',
    }}>
      <div style={{ paddingLeft: '0.5rem' }}>
        <div style={{ 
          color: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
           <Frame
              style={{
                width: '150px',
                height: '150px',
                fill: 'var(--primary)'
              }}
            />
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              textDecoration: 'none',
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
              backgroundColor: isActive ? 'var(--primary-light)' : 'transparent',
              fontWeight: isActive ? 600 : 500,
              transition: 'all 0.2s ease',
              border: isActive ? '1px solid rgba(99, 102, 241, 0.1)' : '1px solid transparent'
            })}
          >
            <link.icon size={20} />
            {link.label}
          </NavLink>
        ))}
      </nav>
      
      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
        <button 
          onClick={logout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            width: '100%',
            background: 'none',
            border: 'none',
            color: '#ef4444',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 500,
            borderRadius: '8px',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = '#fee2e2'}
          onMouseOut={(e) => e.currentTarget.style.background = 'none'}
        >
          <LogOut size={20} />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default PharmacistSidebar;
