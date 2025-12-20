import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import Suppliers from './pages/Suppliers';
import Medicines from './pages/Medicines';
import History from './pages/History';

import { NotificationProvider } from './context/NotificationContext';
import ToastContainer from './components/UI/ToastContainer';
import ConfirmDialog from './components/UI/ConfirmDialog';
import ServerLoader from './components/UI/ServerLoader';
import api from './services/api';

function App() {
  const [isServerReady, setIsServerReady] = useState(false);

  useEffect(() => {
    const checkServer = async () => {
      try {
        // Simple ping to check if server is awake. 
        // Using /suppliers as it's lightweight (or expected to be).
        await api.get('/suppliers'); 
        setIsServerReady(true);
      } catch (err) {
        // Retrying logic could be added here, but for now, 
        // if it fails (e.g. 500 or timeout), we might still want to show the app 
        // effectively handling the error, OR keep showing loader?
        // Let's assume on error we also let them in so they can see error messages inside?
        // User requested "wake up", which implies waiting for success.
        // But if persistent error, they get stuck.
        // Let's retry once or just show app after a delay?
        // Better: let them in if error, so they aren't blocked forever.
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
    <NotificationProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="medicines" element={<Medicines />} />
            <Route path="history" element={<History />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        
        {/* Global UI Components */}
        <ToastContainer />
        <ConfirmDialog />
      </Router>
    </NotificationProvider>
  );
}

export default App;
