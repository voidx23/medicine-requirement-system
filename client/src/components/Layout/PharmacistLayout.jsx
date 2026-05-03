import { useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import AuthContext from '../../context/AuthContext';
import PharmacistSidebar from './PharmacistSidebar';
import NotificationBell from '../UI/NotificationBell';

const PharmacistLayout = ({ children }) => {
    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-secondary)' }}>
            <PharmacistSidebar />
            
            <main style={{
                flex: 1,
                marginLeft: 'var(--sidebar-width)',
                padding: '2rem',
                maxWidth: '1600px',
                width: '100%',
                position: 'relative'
            }}>
                {/* Global Pharmacy Header Elements */}
                <div style={{ 
                    position: 'absolute', 
                    top: '1.5rem', 
                    right: '2rem', 
                    zIndex: 1001,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                }}>
                    <NotificationBell />
                </div>

                {children}
            </main>
        </div>
    );
};

export default PharmacistLayout;
