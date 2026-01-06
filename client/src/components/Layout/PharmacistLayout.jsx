import { useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import AuthContext from '../../context/AuthContext';
import PharmacistSidebar from './PharmacistSidebar';

const PharmacistLayout = ({ children }) => {
    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-secondary)' }}>
            <PharmacistSidebar />
            
            <main style={{
                flex: 1,
                marginLeft: 'var(--sidebar-width)',
                padding: '2rem',
                maxWidth: '1600px',
                width: '100%'
            }}>
                {children}
            </main>
        </div>
    );
};

export default PharmacistLayout;
