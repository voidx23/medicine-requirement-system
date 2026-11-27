import { useContext } from 'react';
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
import DutyScheduler from './pages/DutyScheduler';
import Purchasing from './pages/Purchasing';
import AnalyticsHub from './pages/AnalyticsHub';
import ProductWiseSales from './pages/analytics/ProductWiseSales';
import ProductDetailAnalytics from './pages/analytics/ProductDetailAnalytics';
import ProductBranchTransactions from './pages/analytics/ProductBranchTransactions';
import LocationWiseSales from './pages/analytics/LocationWiseSales';
import LocationDetailAnalytics from './pages/analytics/LocationDetailAnalytics';
import SalesTransactionsDrilldown from './pages/analytics/SalesTransactionsDrilldown';
import { SpeedInsights } from "@vercel/speed-insights/react";

import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider } from './context/AuthContext';
import AuthContext from './context/AuthContext';
import ToastContainer from './components/UI/ToastContainer';
import ConfirmDialog from './components/UI/ConfirmDialog';
import VersionPoller from './components/UI/VersionPoller';
import ServerLoader from './components/UI/ServerLoader';
import api from './services/api';

export { VersionPoller };

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

const PermissionRoute = ({ permission }) => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <div>Loading...</div>;
  
  const LEGACY_MAPPING = {
    view_requirements: ['dashboard'],
    view_tasks: ['tasks'],
    view_requests: ['requests'],
    view_order_history: ['history'],
    view_reports_dashboard: ['reports'],
    view_medicines: ['medicines', 'edit_medicines'],
    view_suppliers: ['suppliers', 'edit_suppliers'],
    view_expiry_returns: ['expiry_returns'],
    process_handover: ['expiry_returns'],
    view_supplier_ledgers: ['expiry_returns'],
    view_medicine_audit_logs: ['reports'],
    generate_requirement_pdf: ['dashboard', 'reports', 'history'],
    view_duty_schedules: ['duty_schedules', 'workforce'],
    edit_duty_schedules: ['duty_schedules', 'workforce']
  };

  const hasAccess = user && (
    user.isSuperAdmin || 
    (user.permissions && (
      user.permissions.includes(permission) || 
      (LEGACY_MAPPING[permission] || []).some(legacyPerm => user.permissions.includes(legacyPerm))
    ))
  );

  return hasAccess ? <Outlet /> : <Navigate to="/admin" replace />;
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
                        <Route element={<PermissionRoute permission="view_requirements" />}>
                            <Route index element={<Dashboard />} />
                        </Route>
                        <Route element={<SuperAdminRoute />}>
                            <Route path="analytics" element={<AnalyticsHub />} />
                            <Route path="analytics/products" element={<ProductWiseSales />} />
                            <Route path="analytics/products/:itemId" element={<ProductDetailAnalytics />} />
                            <Route path="analytics/products/:itemId/branch/:locationId" element={<ProductBranchTransactions />} />
                            <Route path="analytics/locations" element={<LocationWiseSales />} />
                            <Route path="analytics/locations/:locationId" element={<LocationDetailAnalytics />} />
                            <Route path="analytics/transactions" element={<SalesTransactionsDrilldown />} />
                        </Route>
                        {/* Modules protected by granular permissions */}
                        <Route element={<PermissionRoute permission="view_tasks" />}>
                            <Route path="tasks" element={<AdminTasks />} />
                        </Route>
                        <Route element={<PermissionRoute permission="view_requests" />}>
                            <Route path="requests" element={<AdminRequests />} />
                        </Route>
                        <Route element={<PermissionRoute permission="view_suppliers" />}>
                            <Route path="suppliers" element={<Suppliers />} />
                        </Route>
                        <Route element={<PermissionRoute permission="view_medicines" />}>
                            <Route path="medicines" element={<Medicines />} />
                        </Route>
                        <Route element={<PermissionRoute permission="view_order_history" />}>
                            <Route path="history" element={<History />} />
                        </Route>
                        <Route element={<PermissionRoute permission="view_expiry_returns" />}>
                            <Route path="expiry-verification" element={<StoreExpiryVerification />} />
                        </Route>
                        <Route element={<PermissionRoute permission="process_handover" />}>
                            <Route path="handover" element={<HandoverPreparation />} />
                        </Route>
                        <Route element={<PermissionRoute permission="view_supplier_ledgers" />}>
                            <Route path="reports/supplier-expiry" element={<SupplierExpiryReport />} />
                        </Route>
                        <Route element={<PermissionRoute permission="view_reports_dashboard" />}>
                            <Route path="reports" element={<Reports />} />
                        </Route>
                        <Route element={<PermissionRoute permission="view_duty_schedules" />}>
                            <Route path="duty-scheduler" element={<DutyScheduler />} />
                        </Route>
                        <Route element={<PermissionRoute permission="view_medicine_audit_logs" />}>
                            <Route path="reports/audit" element={<MedicineAudit />} />
                        </Route>
                        <Route element={<PermissionRoute permission="view_purchasing" />}>
                            <Route path="purchasing" element={<Purchasing />} />
                        </Route>

                        {/* Delegated / Super Admin routes */}
                        <Route element={<PermissionRoute permission="view_branches" />}>
                            <Route path="branches" element={<ManageBranches />} />
                        </Route>
                        <Route element={<PermissionRoute permission="view_pharmacists" />}>
                            <Route path="pharmacists" element={<ManagePharmacists />} />
                        </Route>
                        <Route element={<PermissionRoute permission="manage_store_staff_permissions" />}>
                            <Route path="store-staff" element={<ManageStoreStaff />} />
                        </Route>
                        <Route element={<PermissionRoute permission="view_user_feedback" />}>
                            <Route path="feedback" element={<AdminFeedback />} />
                        </Route>
                        <Route element={<PermissionRoute permission="view_dev_updates" />}>
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
