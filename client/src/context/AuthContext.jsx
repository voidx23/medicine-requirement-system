import { createContext, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const userInfo = localStorage.getItem('userInfo');
        return userInfo ? JSON.parse(userInfo) : null;
    });
    const [loading] = useState(false);

    const login = async (username, password, onBeforeSuccess) => {
        const { data } = await api.post('/auth/login', { username, password });
        
        // Allow components to block the login after API success but before state update
        if (onBeforeSuccess) {
            const shouldAbort = await onBeforeSuccess(data);
            if (shouldAbort) return data;
        }

        localStorage.setItem('userInfo', JSON.stringify(data));
        setUser(data);
        return data;
    };

    const logout = () => {
        const stickyBranch = localStorage.getItem('sticky_branch');
        localStorage.removeItem('userInfo');
        setUser(null);
        
        // Redirect: If sticky branch exists, go to Magic Link to keep context visible
        if (stickyBranch) {
            window.location.href = `/login?branch=${stickyBranch}`;
        } else {
            window.location.href = '/login';
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
