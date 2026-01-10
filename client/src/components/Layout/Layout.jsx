import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

const Layout = () => {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <div className="desktop-only">
        <Sidebar />
      </div>
      
      <main className="main-content" style={{ overflowY: 'auto' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <Outlet />
        </div>
      </main>

      <div className="mobile-only">
        <BottomNav />
      </div>
    </div>
  );
};

export default Layout;
