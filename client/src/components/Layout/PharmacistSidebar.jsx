import { NavLink, useNavigate } from 'react-router-dom';
import { PlusCircle, History, LogOut, Sparkles, ListTodo, BellRing, UserCircle, PackageX } from 'lucide-react';
import Frame from '../../assets/frame.svg?react';
import { useContext, useEffect, useState, useRef } from 'react';
import AuthContext from '../../context/AuthContext';
import taskService from '../../services/taskService';

const PharmacistSidebar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [notiPermission, setNotiPermission] = useState(
      typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const isInitialLoad = useRef(true);

  const requestNotiPermission = () => {
      if (typeof Notification !== 'undefined') {
          Notification.requestPermission().then(permission => {
              setNotiPermission(permission);
              if (permission === 'granted') {
                 new Notification('Notifications Enabled', { body: 'You will now be notified of new tasks.' });
              }
          });
      }
  };

  useEffect(() => {
      if (!user?.token) return;

      const fetchCount = () => {
          taskService.getPharmacyTasks(user.token)
            .then(tasks => {
                const pendingTasks = tasks.filter(t => t.myAssignment?.status === 'Pending');
                const pending = pendingTasks.length;
                
                setPendingTasksCount(prevCount => {
                    if (!isInitialLoad.current && pending > prevCount && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                        const newTasksCount = pending - prevCount;
                        let title = "New Task Assigned";
                        let body = `You have ${newTasksCount} new pending action(s) in your Task Inbox.`;

                        // If exactly 1 new task, make the notification detailed
                        if (newTasksCount === 1 && pendingTasks.length > 0) {
                            const latestTask = pendingTasks[0]; // Tasks are sorted descending by createdAt
                            if (latestTask.type === 'transfer_request') {
                                title = "Medicine Transfer Request";
                            } else {
                                title = latestTask.priority === 'Urgent' || latestTask.priority === 'High' ? `🚨 Urgent Task: ${latestTask.title}` : `📋 Task: ${latestTask.title}`;
                            }
                            body = latestTask.description || `Admin requires your action on ${latestTask.title}.`;
                        }

                        const notification = new Notification(title, { body });
                        
                        notification.onclick = function() {
                            window.focus();
                            navigate('/pharmacist-dashboard/tasks');
                            this.close();
                        };
                    }
                    
                    if (isInitialLoad.current) {
                        isInitialLoad.current = false;
                    }
                    return pending;
                });
            })
            .catch(err => console.error('Failed to side-load pharmacy tasks:', err));
      };

      fetchCount();
      const intervalId = setInterval(fetchCount, 10000); // 10s polling for badge
      return () => clearInterval(intervalId);
  }, [user]);
  
  const links = [
    { to: '/pharmacist-dashboard/new', icon: PlusCircle, label: 'New Request' },
    { to: '/pharmacist-dashboard/tasks', icon: ListTodo, label: 'Task Inbox', badge: pendingTasksCount },
    { to: '/pharmacist-dashboard/expiry', icon: PackageX, label: 'Expiry Returns' },
    { to: '/pharmacist-dashboard/notifications', icon: BellRing, label: 'Notifications' },
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
      
      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.5rem 0.75rem 0.5rem',
            marginBottom: '0.25rem', borderBottom: '1px dashed var(--glass-border)'
        }}>
            <div style={{
                width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
                <UserCircle size={24} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: '1.2', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {user?.name || user?.username || 'Pharmacist'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.2' }}>
                    {user?.role || 'Pharmacy Branch'}
                </span>
            </div>
        </div>
            <button 
              onClick={() => {
                  if (notiPermission === 'default') {
                      requestNotiPermission();
                  } else if (notiPermission === 'granted') {
                      new Notification('Test Alert', { body: 'Notifications are working perfectly!' });
                  } else {
                      alert('You have blocked notifications in your browser settings. Please click the icon near your address bar to allow them.');
                  }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                width: '100%',
                background: notiPermission === 'granted' ? 'rgba(34, 197, 94, 0.1)' : notiPermission === 'denied' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                border: notiPermission === 'granted' ? '1px solid rgba(34, 197, 94, 0.2)' : notiPermission === 'denied' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(59, 130, 246, 0.2)',
                color: notiPermission === 'granted' ? '#22c55e' : notiPermission === 'denied' ? '#ef4444' : '#3b82f6',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 600,
                borderRadius: '8px',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => {
                  const bgMap = { granted: 'rgba(34, 197, 94, 0.2)', denied: 'rgba(239, 68, 68, 0.2)', default: 'rgba(59, 130, 246, 0.2)' };
                  e.currentTarget.style.background = bgMap[notiPermission] || bgMap.default;
              }}
              onMouseOut={(e) => {
                  const bgMap = { granted: 'rgba(34, 197, 94, 0.1)', denied: 'rgba(239, 68, 68, 0.1)', default: 'rgba(59, 130, 246, 0.1)' };
                  e.currentTarget.style.background = bgMap[notiPermission] || bgMap.default;
              }}
            >
              <BellRing size={18} />
              {notiPermission === 'default' ? 'Enable Alerts' : notiPermission === 'granted' ? 'Alerts Enabled (Test)' : 'Alerts Blocked'}
            </button>
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
        <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            <div style={{ marginTop: '0.5rem' }}>
                <span style={{ background: '#f1f5f9', color: '#64748b', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 600 }}>
                    {localStorage.getItem('appVersion') || 'v1.0.0'}
                </span>
            </div>
        </div>
      </div>
    </aside>
  );
};

export default PharmacistSidebar;
