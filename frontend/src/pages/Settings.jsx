import React, { useState, useEffect } from 'react';
import Sidebar from '../components/layout/Sidebar';
import { User, Bell, Lock, Save, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Settings page for HR users.
 * Allows configuration of SMTP email settings for candidate decision emails.
 * Profile, Notifications, and Security tabs are UI placeholders for future features.
 */
export default function Settings() {
    const { user, authFetch } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(false);

    // SMTP form state
    const [smtpEmail, setSmtpEmail] = useState('');
    const [smtpHost, setSmtpHost] = useState('');
    const [smtpPort, setSmtpPort] = useState(587);
    const [smtpPassword, setSmtpPassword] = useState('');
    const [hasSavedPassword, setHasSavedPassword] = useState(false);

    // Inline feedback state (replaces alert() calls)
    const [smtpFetchError, setSmtpFetchError] = useState('');
    const [saveStatus, setSaveStatus] = useState(null); // null | 'success' | 'error'
    const [saveMessage, setSaveMessage] = useState('');

    // SMTP validation errors
    const [smtpErrors, setSmtpErrors] = useState({});

    // Fetch SMTP settings when the HR user loads the smtp tab
    useEffect(() => {
        if (user?.role === 'hr') {
            const fetchSmtp = async () => {
                setSmtpFetchError('');
                try {
                    const res = await authFetch('/api/hr/smtp-settings');
                    if (res.ok) {
                        const data = await res.json();
                        setSmtpEmail(data.smtp_email || '');
                        setSmtpHost(data.smtp_host || '');
                        setSmtpPort(data.smtp_port || 587);
                        setSmtpPassword(data.smtp_password || '');
                        setHasSavedPassword(data.smtp_password === '********');
                    } else {
                        setSmtpFetchError('Could not load your SMTP settings. Please try refreshing.');
                    }
                } catch (err) {
                    console.error('Error fetching SMTP settings:', err);
                    setSmtpFetchError('Network error loading SMTP settings.');
                }
            };
            fetchSmtp();
        }
    }, [user]);

    /**
     * Validate the SMTP form fields before submitting.
     * @returns {boolean} True if all fields are valid, false otherwise.
     */
    const validateSmtp = () => {
        const errors = {};
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!smtpEmail.trim()) errors.smtpEmail = 'SMTP email is required.';
        else if (!emailRe.test(smtpEmail.trim())) errors.smtpEmail = 'Must be a valid email address.';

        if (!smtpHost.trim()) errors.smtpHost = 'SMTP host is required.';
        else if (smtpHost.trim().length > 253) errors.smtpHost = 'Host is too long (max 253 chars).';

        const portNum = parseInt(smtpPort, 10);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            errors.smtpPort = 'Port must be between 1 and 65535.';
        }

        if (!smtpPassword && !hasSavedPassword) {
            errors.smtpPassword = 'SMTP password is required.';
        } else if (smtpPassword && smtpPassword !== '********' && smtpPassword.length > 500) {
            errors.smtpPassword = 'Password is too long (max 500 chars).';
        }

        setSmtpErrors(errors);
        return Object.keys(errors).length === 0;
    };

    /**
     * Save settings for the currently active tab.
     * Only SMTP settings are backed by a real API call.
     */
    const handleSave = async () => {
        setSaveStatus(null);
        setSaveMessage('');

        if (activeTab === 'smtp') {
            if (!validateSmtp()) return;

            setLoading(true);
            try {
                const res = await authFetch('/api/hr/smtp-settings', {
                    method: 'PUT',
                    body: JSON.stringify({
                        smtp_email: smtpEmail.trim(),
                        smtp_host: smtpHost.trim(),
                        smtp_port: parseInt(smtpPort, 10),
                        // Only send password if user entered a new one (not the redacted placeholder)
                        smtp_password: smtpPassword === '********' ? '' : smtpPassword
                    })
                });
                if (res.ok) {
                    setSaveStatus('success');
                    setSaveMessage('SMTP settings saved successfully! You can now send candidate decision emails.');
                    setHasSavedPassword(true);
                    setSmtpPassword('********');
                } else {
                    const data = await res.json();
                    setSaveStatus('error');
                    setSaveMessage(data.error?.message || data.detail || 'Failed to save SMTP settings.');
                }
            } catch (err) {
                setSaveStatus('error');
                setSaveMessage('Network error. Please check your connection and try again.');
            } finally {
                setLoading(false);
            }
        } else {
            // Placeholder save for non-implemented tabs
            setLoading(true);
            await new Promise(resolve => setTimeout(resolve, 800));
            setSaveStatus('success');
            setSaveMessage('Settings saved successfully!');
            setLoading(false);
        }

        // Auto-clear feedback after 5 seconds
        setTimeout(() => { setSaveStatus(null); setSaveMessage(''); }, 5000);
    };

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans">
            <Sidebar />
            <main className="flex-1 ml-64 p-8">
                <header className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                    <p className="text-sm text-gray-500">Manage your account and preferences</p>
                </header>

                <div className="grid grid-cols-12 gap-8">
                    {/* Settings Navigation */}
                    <div className="col-span-3">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <nav className="flex flex-col p-2 space-y-1">
                                <button
                                    onClick={() => setActiveTab('profile')}
                                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'profile' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    <User size={18} className="mr-3" /> Profile Info
                                </button>
                                <button
                                    onClick={() => setActiveTab('notifications')}
                                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'notifications' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    <Bell size={18} className="mr-3" /> Notifications
                                </button>
                                <button
                                    onClick={() => setActiveTab('security')}
                                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'security' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    <Lock size={18} className="mr-3" /> Security
                                </button>
                                {user?.role === 'hr' && (
                                    <button
                                        onClick={() => setActiveTab('smtp')}
                                        className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'smtp' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                                    >
                                        <Mail size={18} className="mr-3" /> Email SMTP
                                    </button>
                                )}
                            </nav>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="col-span-9 space-y-6">
                        {activeTab === 'profile' && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-lg font-bold text-gray-900 mb-6">Profile Information</h2>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">Full Name</label>
                                        <input type="text" defaultValue={user?.name || ''} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">Email Address</label>
                                        <input type="email" defaultValue={user?.email || ''} readOnly className="w-full p-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 outline-none cursor-not-allowed" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'notifications' && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-lg font-bold text-gray-900 mb-6">Notification Preferences</h2>
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-medium text-gray-900">Email Alerts</h4>
                                            <p className="text-sm text-gray-500">Receive emails when a candidate is successfully analyzed.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" defaultChecked />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'security' && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-lg font-bold text-gray-900 mb-6">Security Settings</h2>
                                <div className="space-y-4">
                                    <button className="text-blue-600 font-medium hover:underline text-sm block">Change Password</button>
                                    <button className="text-blue-600 font-medium hover:underline text-sm block">Enable Two-Factor Authentication</button>
                                    <button className="text-red-600 font-medium hover:underline text-sm block">Deactivate Account</button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'smtp' && user?.role === 'hr' && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-lg font-bold text-gray-900 mb-2">Custom SMTP Settings</h2>
                                <p className="text-xs text-gray-500 mb-6">
                                    Configure your SMTP server to send candidate decision emails from your own domain.
                                    Used when you Approve or Reject candidates in the HR Dashboard.
                                </p>

                                {/* SMTP fetch error */}
                                {smtpFetchError && (
                                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mb-4">
                                        <AlertCircle size={16} /> {smtpFetchError}
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-gray-700">SMTP Host</label>
                                        <input
                                            type="text"
                                            value={smtpHost}
                                            onChange={(e) => setSmtpHost(e.target.value)}
                                            placeholder="e.g. smtp.gmail.com"
                                            className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${smtpErrors.smtpHost ? 'border-red-400' : 'border-gray-200'}`}
                                        />
                                        {smtpErrors.smtpHost && <p className="text-xs text-red-500">{smtpErrors.smtpHost}</p>}
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-gray-700">SMTP Port</label>
                                        <input
                                            type="number"
                                            value={smtpPort}
                                            onChange={(e) => setSmtpPort(e.target.value)}
                                            placeholder="e.g. 587"
                                            min={1}
                                            max={65535}
                                            className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${smtpErrors.smtpPort ? 'border-red-400' : 'border-gray-200'}`}
                                        />
                                        {smtpErrors.smtpPort && <p className="text-xs text-red-500">{smtpErrors.smtpPort}</p>}
                                        <p className="text-xs text-gray-400">Note: Standard ports (587, 465) are blocked on Render Free Tier. Use port 2525 (e.g. via Brevo) to bypass.</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-gray-700">SMTP Email (From Address)</label>
                                        <input
                                            type="email"
                                            value={smtpEmail}
                                            onChange={(e) => setSmtpEmail(e.target.value)}
                                            placeholder="your-email@example.com"
                                            className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${smtpErrors.smtpEmail ? 'border-red-400' : 'border-gray-200'}`}
                                        />
                                        {smtpErrors.smtpEmail && <p className="text-xs text-red-500">{smtpErrors.smtpEmail}</p>}
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-gray-700 flex items-center">
                                            SMTP Password / App Password
                                            {smtpPassword === '********' ? (
                                                hasSavedPassword && (
                                                    <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium border border-green-200">
                                                        saved
                                                    </span>
                                                )
                                            ) : (
                                                <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium border border-amber-200">
                                                    editing...
                                                </span>
                                            )}
                                        </label>
                                        <input
                                            type="password"
                                            value={smtpPassword}
                                            onChange={(e) => setSmtpPassword(e.target.value)}
                                            onFocus={() => { if (smtpPassword === '********') setSmtpPassword(''); }}
                                            onBlur={() => { if (smtpPassword === '' && hasSavedPassword) setSmtpPassword('********'); }}
                                            placeholder={smtpPassword === '********' ? 'Click here and type new password to change' : 'Enter your Gmail App Password'}
                                            className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${smtpErrors.smtpPassword ? 'border-red-400' : smtpPassword === '********' ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}
                                        />
                                        {smtpErrors.smtpPassword && <p className="text-xs text-red-500">{smtpErrors.smtpPassword}</p>}
                                        <p className="text-xs text-gray-400">For Gmail, use an App Password (not your account password). Spaces in the password are OK.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Inline Save Feedback Banner */}
                        {saveStatus && (
                            <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${saveStatus === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                                {saveStatus === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                {saveMessage}
                            </div>
                        )}

                        {/* Save Actions */}
                        <div className="flex justify-end pt-2">
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Saving...' : <><Save size={18} className="mr-2" /> Save Changes</>}
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
