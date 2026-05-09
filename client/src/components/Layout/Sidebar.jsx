import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Pill, History, GitBranch, ClipboardList, Truck, FileText, MessageSquare, CheckSquare, BellRing, PackageX, ArrowRightLeft } from 'lucide-react';
import Frame from '../../assets/frame.svg?react';
import { useContext, useState, useEffect, useRef } from 'react';
import AuthContext from '../../context/AuthContext';
import api from '../../services/api';

const Sidebar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [notiPermission, setNotiPermission] = useState(
      typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const isInitialLoad = useRef(true);

  const requestNotiPermission = () => {
      if (typeof Notification !== 'undefined') {
          Notification.requestPermission().then(permission => {
              setNotiPermission(permission);
              if (permission === 'granted') {
                 new Notification('Notifications Enabled', { body: 'You will now be notified of new requests.' });
              }
          });
      }
  };

  useEffect(() => {
      if (!user?.token) return;

      const fetchCount = () => {
          api.get('/requests?status=pending')
            .then(res => {
                const pending = res.data.length;
                
                setPendingRequestsCount(prevCount => {
                    if (!isInitialLoad.current && pending > prevCount && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                        const newRequestsCount = pending - prevCount;
                        let title = "New Request Arrived";
                        let body = `You have ${newRequestsCount} new pending medicine request(s) from branches.`;

                        if (res.data && res.data.length > 0) {
                            const latestReq = res.data[0]; // Assuming backend returns newest first
                            const branchName = latestReq.pharmacistId?.name || 'A branch';
                            const itemCount = latestReq.items?.length || 0;
                            
                            if (newRequestsCount === 1) {
                                title = `New Request from ${branchName}`;
                                body = `They requested ${itemCount} medicine item(s). Click to view details.`;
                            } else {
                                title = `${newRequestsCount} New Requests Arrived`;
                                body = `Latest is from ${branchName} (${itemCount} items). You have ${newRequestsCount} new actions.`;
                            }
                        }

                        const notification = new Notification(title, { body });
                        
                        notification.onclick = function() {
                            window.focus();
                            navigate('/requests');
                            this.close();
                        };
                    }
                    
                    if (isInitialLoad.current) {
                        isInitialLoad.current = false;
                    }
                    return pending;
                });
            })
            .catch(err => console.error('Failed to side-load requests for badge:', err));
      };

      fetchCount();
      const intervalId = setInterval(fetchCount, 10000); // 10s polling for badge
      return () => clearInterval(intervalId);
  }, [user]);

  const rawLinks = [
    { to: '/', icon: LayoutDashboard, label: 'Daily Requirement List', reqPerm: 'dashboard' },
    { to: '/tasks', icon: CheckSquare, label: 'Tasks', reqPerm: 'tasks' },
    { to: '/requests', icon: ClipboardList, label: 'Requests', badge: pendingRequestsCount, reqPerm: 'requests' },
    { to: '/suppliers', icon: Truck, label: 'Suppliers', reqPerm: 'suppliers' },
    { to: '/medicines', icon: Pill, label: 'Medicines', reqPerm: 'medicines' },
    { 
      id: 'pharmacy-network', 
      icon: Users, 
      label: 'Pharmacy Network',
      superAdminOnly: true,
      subLinks: [
        { to: '/branches', label: 'Branches' },
        { to: '/pharmacists', label: 'Pharmacists' }
      ]
    },
    { 
      id: 'store-administration', 
      icon: Users, 
      label: 'Store Administration',
      superAdminOnly: true,
      subLinks: [
        { to: '/store-staff', label: 'Store Staff' }
      ]
    },
    { 
      id: 'expiry-management',
      icon: PackageX,
      label: 'Expiry Management',
      reqPerm: 'expiry_returns',
      subLinks: [
        { to: '/expiry-verification', label: 'Expiry Verification' },
        { to: '/handover', label: 'Handover Prep' },
        { to: '/reports/supplier-expiry', label: 'Supplier Ledger' }
      ]
    },
    { to: '/history', icon: History, label: 'Req History', reqPerm: 'history' },
    { 
      id: 'reports-menu', 
      icon: FileText, 
      label: 'Reports',
      reqPerm: 'reports',
      subLinks: [
        { to: '/reports', label: 'Requirement Report' },
        { to: '/reports/audit', label: 'Medicine Audit' }
      ]
    },
    { to: '/feedback', icon: MessageSquare, label: 'Feedback', superAdminOnly: true },
    { to: '/updates', icon: GitBranch, label: 'Dev Updates', superAdminOnly: true },
  ];

  const links = rawLinks.filter(link => {
      if (link.superAdminOnly) {
          return user?.isSuperAdmin;
      }
      if (!user?.isSuperAdmin && link.reqPerm) {
          const perms = user?.permissions || [];
          return perms.includes(link.reqPerm);
      }
      return true; // dashboard/superAdmin logic handled above
  });

  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isNetworkOpen, setIsNetworkOpen] = useState(false);
  const [isStoreAdminOpen, setIsStoreAdminOpen] = useState(false);
  const [isExpiryOpen, setIsExpiryOpen] = useState(false);

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
                fill: 'var(--primary)'
              }}
            />
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        {links.map((link) => {
          if (link.subLinks) {
            let isOpen = false;
            if (link.id === 'reports-menu') isOpen = isReportsOpen;
            else if (link.id === 'pharmacy-network') isOpen = isNetworkOpen;
            else if (link.id === 'store-administration') isOpen = isStoreAdminOpen;
            else if (link.id === 'expiry-management') isOpen = isExpiryOpen;

            const toggleOpen = () => {
                if (link.id === 'reports-menu') setIsReportsOpen(!isReportsOpen);
                else if (link.id === 'pharmacy-network') setIsNetworkOpen(!isNetworkOpen);
                else if (link.id === 'store-administration') setIsStoreAdminOpen(!isStoreAdminOpen);
                else if (link.id === 'expiry-management') setIsExpiryOpen(!isExpiryOpen);
            };

            return (
              <div key={link.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <div
                  onClick={toggleOpen}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                    border: '1px solid transparent'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <link.icon size={20} />
                    {link.label}
                  </div>
                  <span style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                </div>
                
                {isOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '2.5rem', marginTop: '0.25rem', gap: '0.25rem' }}>
                    {link.subLinks.map(subLink => (
                      <NavLink
                        key={subLink.to}
                        to={subLink.to}
                        end={subLink.to === '/reports'} // Exact matching for /reports so it doesn't highlight both
                        style={({ isActive }) => ({
                          display: 'block',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '6px',
                          textDecoration: 'none',
                          color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                          backgroundColor: isActive ? 'var(--primary-light)' : 'transparent',
                          fontWeight: isActive ? 600 : 400,
                          fontSize: '0.9rem',
                          transition: 'all 0.2s ease'
                        })}
                      >
                        {subLink.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
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
          );
        })}

      </nav>
      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

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
        <div style={{ padding: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            © 2025 voidx23
            <div style={{ marginTop: '0.75rem' }}>
                <span style={{ background: '#f1f5f9', color: '#64748b', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 600 }}>
                    {localStorage.getItem('appVersion') || 'v1.0.0'}
                </span>
            </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
