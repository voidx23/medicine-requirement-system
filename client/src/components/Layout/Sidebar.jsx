import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Pill, History } from 'lucide-react';
import Frame from '../../assets/frame.svg?react';

const Sidebar = () => {
  const links = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/suppliers', icon: Users, label: 'Suppliers' },
    { to: '/medicines', icon: Pill, label: 'Medicines' },
    { to: '/history', icon: History, label: 'History' },
  ];

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      height: '100vh',
      position: 'fixed',
      left: 0,
      top: 0,
      padding: '1rem 1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '2rem',
      backgroundColor: 'rgba(255, 255, 255, 0.6)',
      backdropFilter: 'blur(10px)',
      borderRight: '1px solid var(--glass-border)',
      zIndex: 10
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
        fill: 'var(--primary)' // works if SVG uses fill="currentColor"
      }}
    />
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
      
      <div style={{ marginTop: 'auto', padding: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        © 2025 voidx23
      </div>
    </aside>
  );
};

export default Sidebar;
