import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_URL } from '../lib/config';

const AuthContext = createContext(null);

/** Email format validation regex — lightweight check before sending to backend. */
const _EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Timeout for all auth API calls in milliseconds (10 seconds). */
const _AUTH_TIMEOUT_MS = 10000;

/**
 * Provides authentication state and actions (login, register, logout, authFetch)
 * to all descendant components via React context.
 *
 * Security note: The JWT token is stored in sessionStorage (not localStorage).
 * sessionStorage is cleared when the browser tab closes, limiting exposure.
 * It is still accessible by JavaScript, so XSS remains a concern — sanitise
 * all user-rendered content and avoid eval()/innerHTML with untrusted data.
 */
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(sessionStorage.getItem('ats_token'));
    const [loading, setLoading] = useState(true);

    // On mount, verify the stored token is still valid by calling /api/me
    useEffect(() => {
        if (token) {
            fetchUser(token);
        } else {
            setLoading(false);
        }
    }, []);

    /**
     * Verify a token by fetching the current user profile from the backend.
     * Clears session on any failure (expired token, network error, etc.).
     *
     * @param {string} t - The JWT token string to validate.
     */
    const fetchUser = async (t) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), _AUTH_TIMEOUT_MS);
        try {
            const res = await fetch(`${API_URL}/api/me`, {
                headers: { Authorization: `Bearer ${t}` },
                signal: controller.signal,
            });
            if (res.ok) {
                const data = await res.json();
                setUser(data);
            } else {
                // Token is invalid or expired — clear session
                sessionStorage.removeItem('ats_token');
                setToken(null);
                setUser(null);
            }
        } catch {
            // Network failure or timeout — clear session to force re-login
            sessionStorage.removeItem('ats_token');
            setToken(null);
            setUser(null);
        } finally {
            clearTimeout(timeout);
            setLoading(false);
        }
    };

    /**
     * Authenticate a user and store the returned JWT in sessionStorage.
     *
     * @param {string} email - The user's email address.
     * @param {string} password - The user's plain-text password.
     * @returns {Promise<Object>} The authenticated user object.
     * @throws {Error} If credentials are invalid, network fails, or request times out.
     */
    const login = async (email, password) => {
        // Client-side validation before making the network call
        if (!email || !_EMAIL_RE.test(email.trim())) {
            throw new Error('Please enter a valid email address.');
        }
        if (!password || password.length < 8) {
            throw new Error('Password must be at least 8 characters.');
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), _AUTH_TIMEOUT_MS);
        try {
            const res = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
                signal: controller.signal,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || data.detail || 'Login failed.');
            sessionStorage.setItem('ats_token', data.token);
            setToken(data.token);
            setUser(data.user);
            return data.user;
        } catch (err) {
            if (err.name === 'AbortError') throw new Error('Login request timed out. Please check your connection.');
            throw err;
        } finally {
            clearTimeout(timeout);
        }
    };

    /**
     * Register a new user account and store the returned JWT in sessionStorage.
     *
     * @param {string} email - The new user's email address.
     * @param {string} password - The new user's password (min 8 characters).
     * @param {string} name - The new user's display name (max 100 characters).
     * @param {string} role - Either 'hr' or 'candidate'.
     * @returns {Promise<Object>} The newly created user object.
     * @throws {Error} If validation fails, email is taken, or network fails.
     */
    const register = async (email, password, name, role) => {
        // Client-side validation mirrors backend validators for immediate feedback
        if (!email || !_EMAIL_RE.test(email.trim())) {
            throw new Error('Please enter a valid email address.');
        }
        if (!password || password.length < 8) {
            throw new Error('Password must be at least 8 characters.');
        }
        if (!name || !name.trim()) {
            throw new Error('Full name is required.');
        }
        if (name.trim().length > 100) {
            throw new Error('Name must be 100 characters or fewer.');
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), _AUTH_TIMEOUT_MS);
        try {
            const res = await fetch(`${API_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase(), password, name: name.trim(), role }),
                signal: controller.signal,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || data.detail || 'Registration failed.');
            sessionStorage.setItem('ats_token', data.token);
            setToken(data.token);
            setUser(data.user);
            return data.user;
        } catch (err) {
            if (err.name === 'AbortError') throw new Error('Registration timed out. Please check your connection.');
            throw err;
        } finally {
            clearTimeout(timeout);
        }
    };

    /**
     * Clear the session and log the user out.
     */
    const logout = () => {
        sessionStorage.removeItem('ats_token');
        setToken(null);
        setUser(null);
    };

    /**
     * Authenticated fetch wrapper that automatically attaches the Bearer token
     * and sets the correct Content-Type for JSON requests.
     *
     * @param {string} url - The API path (e.g., '/api/hr/jobs'). Prepended with API_URL.
     * @param {RequestInit} options - Standard fetch options (method, body, headers, etc.).
     * @returns {Promise<Response>} The raw fetch Response object.
     */
    const authFetch = async (url, options = {}) => {
        const headers = {
            ...options.headers,
            Authorization: `Bearer ${token}`
        };
        // Do not force Content-Type for FormData — browser sets it with the correct boundary
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

/**
 * Hook to access the authentication context.
 *
 * @returns {Object} Auth context value: { user, token, loading, login, register, logout, authFetch }.
 * @throws {Error} If used outside of an AuthProvider.
 */
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider.');
    return context;
}
