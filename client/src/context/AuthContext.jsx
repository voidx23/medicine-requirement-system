import { createContext, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const userInfo = localStorage.getItem('userInfo');
        return userInfo ? JSON.parse(userInfo) : null;
    });
    const [loading] = useState(false);

    const login = async (username, password) => {
        const { data } = await api.post('/auth/login', { username, password });
        localStorage.setItem('userInfo', JSON.stringify(data));
        setUser(data);
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
