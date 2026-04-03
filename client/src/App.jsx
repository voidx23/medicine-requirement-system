import { useState, useEffect, useContext } from 'react';
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
import SetupDevice from './pages/SetupDevice';
import PharmacistLayout from './components/Layout/PharmacistLayout';
import AdminTasks from './pages/AdminTasks';
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

const SuperAdminRoute = () => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <div>Loading...</div>;
  return user && user.isSuperAdmin ? <Outlet /> : <Navigate to="/" replace />;
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
                        {/* Modules protected by their own logic or shown if permitted */}
                        <Route path="tasks" element={<AdminTasks />} />
                        <Route path="requests" element={<AdminRequests />} />
                        <Route path="suppliers" element={<Suppliers />} />
                        <Route path="medicines" element={<Medicines />} />
                        <Route path="history" element={<History />} />
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
