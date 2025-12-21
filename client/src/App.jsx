import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import Suppliers from './pages/Suppliers';
import Medicines from './pages/Medicines';
import History from './pages/History';
import DevUpdates from './pages/DevUpdates';

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
        await api.get('/suppliers'); 
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
    <NotificationProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="medicines" element={<Medicines />} />
            <Route path="history" element={<History />} />
            <Route path="updates" element={<DevUpdates />} />
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
