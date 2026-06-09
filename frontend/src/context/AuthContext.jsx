import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_URL } from '../lib/config';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(sessionStorage.getItem('ats_token'));
    const [loading, setLoading] = useState(true);

    // On mount, verify token
    useEffect(() => {
        if (token) {
            fetchUser(token);
        } else {
            setLoading(false);
        }
    }, []);

    const fetchUser = async (t) => {
        try {
            const res = await fetch(`${API_URL}/api/me`, {
                headers: { Authorization: `Bearer ${t}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUser(data);
            } else {
                // Token invalid
                sessionStorage.removeItem('ats_token');
                setToken(null);
                setUser(null);
            }
        } catch {
            sessionStorage.removeItem('ats_token');
            setToken(null);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        const res = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Login failed');
        sessionStorage.setItem('ats_token', data.token);
        setToken(data.token);
        setUser(data.user);
        return data.user;
    };

    const register = async (email, password, name, role) => {
        const res = await fetch(`${API_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name, role })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Registration failed');
        sessionStorage.setItem('ats_token', data.token);
        setToken(data.token);
        setUser(data.user);
        return data.user;
    };

    const logout = () => {
        sessionStorage.removeItem('ats_token');
        setToken(null);
        setUser(null);
    };

    const authFetch = async (url, options = {}) => {
        const headers = {
            ...options.headers,
            Authorization: `Bearer ${token}`
        };
        // Don't set Content-Type for FormData
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        }
        return fetch(`${API_URL}${url}`, { ...options, headers });
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, register, logout, authFetch }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}
