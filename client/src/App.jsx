import { useState, useEffect, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import Suppliers from './pages/Suppliers';
import Medicines from './pages/Medicines';
import History from './pages/History';
import DevUpdates from './pages/DevUpdates';
import Login from './pages/Login';
import AdminRequests from './pages/AdminRequests';
import ManageStaff from './pages/ManageStaff';
import Reports from './pages/Reports';
import PharmacistNewRequest from './pages/PharmacistNewRequest';
import PharmacistHistory from './pages/PharmacistHistory';
import PharmacistLayout from './components/Layout/PharmacistLayout';

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
  if (loading) return <div>Loading...</div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

const AdminRoute = () => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <div>Loading...</div>;
  return user && user.role === 'admin' ? <Outlet /> : <Navigate to="/pharmacist-dashboard" replace />;
};

function App() {
  const [isServerReady, setIsServerReady] = useState(false);

  useEffect(() => {
    const checkServer = async () => {
      try {
        // Simple health check or just relying on auth logic directly
        // await api.get('/suppliers'); 
        setIsServerReady(true);
      } catch (err) {
        console.error("Server check failed", err);
        setIsServerReady(true); 
      }
    };
    checkServer();
  }, []);

  if (!isServerReady) {
    return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ServerLoader />
        </div>
    );
  }

  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <Routes>
            {/* Public Route */}
            <Route path="/login" element={<Login />} />

            {/* Protected Routes */}
            <Route element={<PrivateRoute />}>
                
                {/* Admin Routes */}
                <Route element={<AdminRoute />}>
                    <Route path="/" element={<Layout />}>
                        <Route index element={<Dashboard />} />
                        <Route path="requests" element={<AdminRequests />} />
                        <Route path="suppliers" element={<Suppliers />} />
                        <Route path="medicines" element={<Medicines />} />
                        <Route path="staff" element={<ManageStaff />} />
                        <Route path="history" element={<History />} />
                        <Route path="reports" element={<Reports />} />
                        <Route path="updates" element={<DevUpdates />} />
                    </Route>
                </Route>

                {/* Pharmacist Routes */}
                <Route path="/pharmacist-dashboard" element={<PharmacistLayout><Outlet /></PharmacistLayout>}>
                    <Route index element={<Navigate to="new" replace />} />
                    <Route path="new" element={<PharmacistNewRequest />} />
                    <Route path="history" element={<PharmacistHistory />} />
                </Route>
                
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
          
          <ToastContainer />
          <ConfirmDialog />
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
