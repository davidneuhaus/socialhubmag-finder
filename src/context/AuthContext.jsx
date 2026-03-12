import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import bcrypt from 'bcryptjs';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [admin, setAdmin] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Restore session from localStorage
        const stored = localStorage.getItem('mag_admin');
        if (stored) {
            try {
                setAdmin(JSON.parse(stored));
            } catch {
                localStorage.removeItem('mag_admin');
            }
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        const { data, error } = await supabase
            .from('admins')
            .select('id, email, password_hash')
            .eq('email', email.toLowerCase().trim())
            .single();

        if (error || !data) {
            throw new Error('Invalid email or password');
        }

        const valid = await bcrypt.compare(password, data.password_hash);
        if (!valid) {
            throw new Error('Invalid email or password');
        }

        const session = { id: data.id, email: data.email };
        localStorage.setItem('mag_admin', JSON.stringify(session));
        setAdmin(session);
        return session;
    };

    const logout = () => {
        localStorage.removeItem('mag_admin');
        setAdmin(null);
    };

    return (
        <AuthContext.Provider value={{ admin, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
