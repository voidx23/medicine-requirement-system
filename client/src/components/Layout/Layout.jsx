import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

const Layout = () => {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', paddingBottom: '80px' }}>
      <div className="desktop-only">
        <Sidebar />
      </div>
      
      <main className="main-content">
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
