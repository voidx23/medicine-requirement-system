import { NavLink } from 'react-router-dom';
import { PlusCircle, History, LogOut, Sparkles, ListTodo } from 'lucide-react';
import { useContext, useEffect, useState } from 'react';
import Frame from '../../assets/frame.svg?react';
import AuthContext from '../../context/AuthContext';
import taskService from '../../services/taskService';

const PharmacistSidebar = () => {
  const { user, logout } = useContext(AuthContext);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);

  useEffect(() => {
      if (user && user.token) {
          taskService.getPharmacyTasks(user.token)
            .then(tasks => {
                const pending = tasks.filter(t => t.myAssignment?.status === 'Pending').length;
                setPendingTasksCount(pending);
            })
            .catch(err => console.error('Failed to side-load pharmacy tasks:', err));
      }
  }, [user]);
  
  const links = [
    { to: '/pharmacist-dashboard/new', icon: PlusCircle, label: 'New Request' },
    { to: '/pharmacist-dashboard/tasks', icon: ListTodo, label: 'Task Inbox', badge: pendingTasksCount },
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
              justifyContent: 'space-between',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <link.icon size={20} />
              {link.label}
            </div>
            {link.badge > 0 && (
                <span style={{
                    backgroundColor: '#ef4444',
                    color: 'white',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.4rem',
                    borderRadius: '9999px'
                }}>
                    {link.badge}
                </span>
            )}
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
