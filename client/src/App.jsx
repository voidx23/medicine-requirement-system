import { useState, useEffect, useContext } from 'react';
import { Zap } from 'lucide-react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import Suppliers from './pages/Suppliers';
import Medicines from './pages/Medicines';
import History from './pages/History';
import DevUpdates from './pages/DevUpdates';
import Login from './pages/Login';
import AdminRequests from './pages/AdminRequests';
import AdminFeedback from './pages/AdminFeedback';
import ManageBranches from './pages/ManageBranches';
import ManagePharmacists from './pages/ManagePharmacists';
import ManageStoreStaff from './pages/ManageStoreStaff';
import Reports from './pages/Reports';
import MedicineAudit from './pages/MedicineAudit';
import PharmacistNewRequest from './pages/PharmacistNewRequest';
import PharmacistHistory from './pages/PharmacistHistory';
import PharmacistWhatsNew from './pages/PharmacistWhatsNew';
import PharmacyTasks from './pages/PharmacyTasks';
import BranchExpiryReturns from './pages/BranchExpiryReturns';
import PharmacistNotifications from './pages/PharmacistNotifications';
import SetupDevice from './pages/SetupDevice';
import PharmacistLayout from './components/Layout/PharmacistLayout';
import AdminTasks from './pages/AdminTasks';
import StoreExpiryVerification from './pages/StoreExpiryVerification';
import HandoverPreparation from './pages/HandoverPreparation';
import SupplierExpiryReport from './pages/SupplierExpiryReport';
import { SpeedInsights } from "@vercel/speed-insights/react";

import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider } from './context/AuthContext';
import AuthContext from './context/AuthContext';
import ToastContainer from './components/UI/ToastContainer';
import ConfirmDialog from './components/UI/ConfirmDialog';
import ServerLoader from './components/UI/ServerLoader';
import api from './services/api';

// Route Protection Components
const PrivateRoute = () => {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();

  if (loading) return <div>Loading...</div>;
  return user ? <Outlet /> : <Navigate to="/login" state={{ from: location }} replace />;
};

const AdminRoute = () => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <div>Loading...</div>;
  return user && user.role === 'admin' ? <Outlet /> : <Navigate to="/pharmacist-dashboard" replace />;
};

const RootRedirect = () => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/pharmacist-dashboard" replace />;
};

const SuperAdminRoute = () => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <div>Loading...</div>;
  return user && user.isSuperAdmin ? <Outlet /> : <Navigate to="/admin" replace />;
};

const VersionPoller = () => {
    const [localVersion, setLocalVersion] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [countdown, setCountdown] = useState(5); // 5 second countdown

    useEffect(() => {
        let isFirstLoad = true;
        
        const checkVersion = async () => {
            if (isUpdating) return;
            try {
                const res = await api.get('/system/version');
                const serverVersion = res.data.clientVersion;
                const versionString = res.data.versionString || 'v1.0.0';
                
                if (isFirstLoad) {
                    setLocalVersion(serverVersion);
                    localStorage.setItem('appVersion', versionString);
                    isFirstLoad = false;
                    
                    // Fire telemetry beacon now that we have loaded successfully
                    // We wrap it in a silent catch block so if the user isn't logged in yet, it fails gracefully
                    api.post('/system/telemetry', { versionString }).catch(() => {});
                    
                } else if (localVersion !== null && serverVersion > localVersion) {
                    setIsUpdating(true);
                }
            } catch {
                // Ignore silent background fails
            }
        };

        checkVersion();
        const interval = setInterval(checkVersion, 15000); 
        return () => clearInterval(interval);
    }, [localVersion, isUpdating]);

    useEffect(() => {
        if (isUpdating) {
            const timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        window.location.reload(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [isUpdating]);

    if (!isUpdating) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(255, 255, 255, 0.5)',
            backdropFilter: 'blur(10px)',
            zIndex: 999999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', padding: '2rem'
        }}>
            <div style={{
                background: 'white', padding: '3rem', borderRadius: '24px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                maxWidth: '500px', width: '100%',
                border: '1px solid rgba(99, 102, 241, 0.2)'
            }}>
                <Zap size={48} color="var(--primary)" style={{ margin: '0 auto 1.5rem auto' }} />
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem' }}>
                    Remote Update In Progress
                </h2>
                <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '2rem' }}>
                    A remote update is currently taking place. This will automatically do a hard refresh to apply the latest server changes.<br/><br/>
                    <strong>Don't worry, you won't lose any of your list data!</strong>
                </p>
                <div style={{
                    background: 'var(--primary-light)', color: 'var(--primary)',
                    padding: '1rem', borderRadius: '12px', fontWeight: 700, fontSize: '1.2rem'
                }}>
                    Rebooting in {countdown} seconds...
                </div>
            </div>
        </div>
    );
};

const App = () => {
    // ... existing provider logic ...

  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <VersionPoller />
          <Routes>
            {/* Public Route */}
            <Route path="/login" element={<Login />} />

            {/* Root redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* Protected Routes */}
            <Route element={<PrivateRoute />}>
                
                {/* Admin Routes (all under /admin) */}
                <Route element={<AdminRoute />}>
                    <Route path="/setup-device" element={<SetupDevice />} />
                    <Route path="/admin" element={<Layout />}>
                        <Route index element={<Dashboard />} />
                        {/* Modules protected by their own logic or shown if permitted */}
                        <Route path="tasks" element={<AdminTasks />} />
                        <Route path="requests" element={<AdminRequests />} />
                        <Route path="suppliers" element={<Suppliers />} />
                        <Route path="medicines" element={<Medicines />} />
                        <Route path="history" element={<History />} />
                        <Route path="expiry-verification" element={<StoreExpiryVerification />} />
                        <Route path="handover" element={<HandoverPreparation />} />
                        <Route path="reports/supplier-expiry" element={<SupplierExpiryReport />} />
                        <Route path="reports" element={<Reports />} />
                        <Route path="reports/audit" element={<MedicineAudit />} />

                        {/* Super Admin ONLY routes */}
                        <Route element={<SuperAdminRoute />}>
                            <Route path="branches" element={<ManageBranches />} />
                            <Route path="pharmacists" element={<ManagePharmacists />} />
                            <Route path="store-staff" element={<ManageStoreStaff />} />
                            <Route path="feedback" element={<AdminFeedback />} />
                            <Route path="updates" element={<DevUpdates />} />
                        </Route>
                    </Route>
                </Route>

                {/* Pharmacist Routes */}
                <Route path="/pharmacist-dashboard" element={<PharmacistLayout><Outlet /></PharmacistLayout>}>
                    <Route index element={<Navigate to="new" replace />} />
                    <Route path="tasks" element={<PharmacyTasks />} />
                    <Route path="new" element={<PharmacistNewRequest />} />
                    <Route path="history" element={<PharmacistHistory />} />
                    <Route path="expiry" element={<BranchExpiryReturns />} />
                    <Route path="notifications" element={<PharmacistNotifications />} />
                    <Route path="updates" element={<PharmacistWhatsNew />} />
                </Route>
                
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
          
          <ToastContainer />
          <ConfirmDialog />
          <SpeedInsights />
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
