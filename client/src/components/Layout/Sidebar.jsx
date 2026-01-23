import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Pill, History, GitBranch, LogOut, ClipboardList, Truck, FileText, MessageSquare } from 'lucide-react';
import Frame from '../../assets/frame.svg?react';
import { useContext } from 'react';
import AuthContext from '../../context/AuthContext';

const Sidebar = () => {
  const { logout } = useContext(AuthContext);
  const links = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/requests', icon: ClipboardList, label: 'Requests' },
    { to: '/suppliers', icon: Truck, label: 'Suppliers' },
    { to: '/medicines', icon: Pill, label: 'Medicines' },
    { to: '/staff', icon: Users, label: 'Manage Staff' },
    { to: '/history', icon: History, label: 'Req History' },
    { to: '/reports', icon: FileText, label: 'Reports' },
    { to: '/feedback', icon: MessageSquare, label: 'Feedback' },
    { to: '/updates', icon: GitBranch, label: 'Dev Updates' },
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
      zIndex: 10,
      overflowY: 'auto', // Allow scrolling
      scrollbarWidth: 'thin', // For Firefox
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
      <button
            onClick={logout}
            aria-label="Logout"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              textDecoration: 'none',
              color: '#ef4444', 
              backgroundColor: 'transparent',
              fontWeight: 500,
              transition: 'all 0.2s ease',
              border: '1px solid transparent',
              width: '100%',
              cursor: 'pointer',
              fontSize: '1rem',
              fontFamily: 'inherit'
            }}
            onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#fee2e2';
            }}
            onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <LogOut size={20} />
            Logout
          </button>
      </nav>
      
      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>

        <div style={{ padding: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            © 2025 voidx23
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
