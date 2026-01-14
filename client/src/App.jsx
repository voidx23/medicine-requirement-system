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
import AdminFeedback from './pages/AdminFeedback';
import ManageStaff from './pages/ManageStaff';
import Reports from './pages/Reports';
import PharmacistNewRequest from './pages/PharmacistNewRequest';
import PharmacistHistory from './pages/PharmacistHistory';
import PharmacistWhatsNew from './pages/PharmacistWhatsNew';
import SetupDevice from './pages/SetupDevice';
import PharmacistLayout from './components/Layout/PharmacistLayout';
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
  if (loading) return <div>Loading...</div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

const AdminRoute = () => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <div>Loading...</div>;
  return user && user.role === 'admin' ? <Outlet /> : <Navigate to="/pharmacist-dashboard" replace />;
};

const App = () => {
    // ... existing provider logic ...

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
                    <Route path="/setup-device" element={<SetupDevice />} />
                    <Route path="/" element={<Layout />}>
                        <Route index element={<Dashboard />} />
                        <Route path="requests" element={<AdminRequests />} />
                        <Route path="suppliers" element={<Suppliers />} />
                        <Route path="medicines" element={<Medicines />} />
                        <Route path="staff" element={<ManageStaff />} />
                        <Route path="history" element={<History />} />
                        <Route path="reports" element={<Reports />} />
                        <Route path="feedback" element={<AdminFeedback />} />
                        <Route path="updates" element={<DevUpdates />} />
                    </Route>
                </Route>

                {/* Pharmacist Routes */}
                <Route path="/pharmacist-dashboard" element={<PharmacistLayout><Outlet /></PharmacistLayout>}>
                    <Route index element={<Navigate to="new" replace />} />
                    <Route path="new" element={<PharmacistNewRequest />} />
                    <Route path="history" element={<PharmacistHistory />} />
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
