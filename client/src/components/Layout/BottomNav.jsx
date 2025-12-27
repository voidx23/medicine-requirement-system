import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Pill, History, GitBranch } from 'lucide-react';

const BottomNav = () => {
  console.log("nihal");
  const links = [
    { to: '/', icon: LayoutDashboard, label: 'Dash' },
    { to: '/medicines', icon: Pill, label: 'Meds' },
    { to: '/suppliers', icon: Users, label: 'Sups' },
    { to: '/history', icon: History, label: 'Hist' },
    { to: '/updates', icon: GitBranch, label: 'Dev' }
  ];

  return (
    <nav className="glass-panel" style={{
      position: 'fixed',
      bottom: '1rem',
      left: '1rem',
      right: '1rem',
      height: '64px',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      zIndex: 100,
      padding: '0 0.5rem',
      borderRadius: '20px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
    }}>
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            color: isActive ? 'var(--primary)' : 'var(--text-muted)',
            fontSize: '0.75rem',
            fontWeight: isActive ? 600 : 500,
            padding: '0.5rem',
            borderRadius: '12px',
            flex: 1,
            height: '100%',
            gap: '2px'
          })}
        >
          {({ isActive }) => (
            <>
              <link.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span>{link.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
};

export default BottomNav;
