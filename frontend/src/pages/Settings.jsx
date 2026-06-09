import React, { useState, useEffect } from 'react';
import Sidebar from '../components/layout/Sidebar';
import { User, Bell, Lock, Save, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
    const { user, authFetch } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(false);
    
    // SMTP States
    const [smtpEmail, setSmtpEmail] = useState('');
    const [smtpHost, setSmtpHost] = useState('');
    const [smtpPort, setSmtpPort] = useState(587);
    const [smtpPassword, setSmtpPassword] = useState('');

    // Fetch SMTP settings if the user is an HR
    useEffect(() => {
        if (user?.role === 'hr') {
            const fetchSmtp = async () => {
                try {
                    const res = await authFetch('/api/hr/smtp-settings');
                    if (res.ok) {
                        const data = await res.json();
                        setSmtpEmail(data.smtp_email || '');
                        setSmtpHost(data.smtp_host || '');
                        setSmtpPort(data.smtp_port || 587);
                        setSmtpPassword(data.smtp_password || '');
                    }
                } catch (err) {
                    console.error("Error fetching SMTP settings:", err);
                }
            };
            fetchSmtp();
        }
    }, [user]);

    const handleSave = async () => {
        setLoading(true);
        try {
            if (activeTab === 'smtp') {
                const res = await authFetch('/api/hr/smtp-settings', {
                    method: 'PUT',
                    body: JSON.stringify({
                        smtp_email: smtpEmail,
                        smtp_host: smtpHost,
                        smtp_port: parseInt(smtpPort, 10),
                        smtp_password: smtpPassword
                    })
                });
                if (res.ok) {
                    alert("SMTP settings saved successfully!");
                } else {
                    const data = await res.json();
                    alert(data.detail || "Failed to save SMTP settings.");
                }
            } else {
                // Mock API call for other tabs
                await new Promise(resolve => setTimeout(resolve, 1000));
                alert("Settings saved successfully!");
            }
        } catch (err) {
            alert("An error occurred while saving: " + err.message);
        } finally {
            setLoading(false);
        }
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
                             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animation-fade-in">
                                 <h2 className="text-lg font-bold text-gray-900 mb-6">Profile Information</h2>
                                 <div className="grid grid-cols-2 gap-6">
                                     <div className="space-y-2">
                                         <label className="text-sm font-medium text-gray-700">Full Name</label>
                                         <input type="text" defaultValue="Admin User" className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                                     </div>
                                     <div className="space-y-2">
                                         <label className="text-sm font-medium text-gray-700">Email Address</label>
                                         <input type="email" defaultValue="admin@resumeai.com" className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                                     </div>
                                     <div className="space-y-2 col-span-2">
                                         <label className="text-sm font-medium text-gray-700">Company Name</label>
                                         <input type="text" defaultValue="Tech Corp Inc." className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                                     </div>
                                 </div>
                             </div>
                        )}

                        {activeTab === 'notifications' && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animation-fade-in">
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
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-medium text-gray-900">Fraud Detection Alerts</h4>
                                            <p className="text-sm text-gray-500">Get notified immediately if high-risk fraud is detected.</p>
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
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animation-fade-in">
                                <h2 className="text-lg font-bold text-gray-900 mb-6">Security Settings</h2>
                                <div className="space-y-4">
                                    <button className="text-blue-600 font-medium hover:underline text-sm block">Change Password</button>
                                    <button className="text-blue-600 font-medium hover:underline text-sm block">Enable Two-Factor Authentication</button>
                                    <button className="text-red-600 font-medium hover:underline text-sm block">Deactivate Account</button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'smtp' && user?.role === 'hr' && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animation-fade-in">
                                <h2 className="text-lg font-bold text-gray-900 mb-2">Custom SMTP Settings</h2>
                                <p className="text-xs text-gray-500 mb-6">
                                    Configure your custom SMTP settings to send candidate status decision emails from your own domain.
                                </p>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">SMTP Host</label>
                                        <input 
                                            type="text" 
                                            value={smtpHost} 
                                            onChange={(e) => setSmtpHost(e.target.value)} 
                                            placeholder="e.g. smtp.gmail.com" 
                                            className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">SMTP Port</label>
                                        <input 
                                            type="number" 
                                            value={smtpPort} 
                                            onChange={(e) => setSmtpPort(e.target.value)} 
                                            placeholder="e.g. 587" 
                                            className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">SMTP Email</label>
                                        <input 
                                            type="email" 
                                            value={smtpEmail} 
                                            onChange={(e) => setSmtpEmail(e.target.value)} 
                                            placeholder="your-email@example.com" 
                                            className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">SMTP Password</label>
                                        <input 
                                            type="password" 
                                            value={smtpPassword} 
                                            onChange={(e) => setSmtpPassword(e.target.value)} 
                                            placeholder={smtpPassword === "********" ? "********" : "Enter SMTP Password"} 
                                            className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" 
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Save Actions */}
                        <div className="flex justify-end pt-4">
                            <button 
                                onClick={handleSave}
                                disabled={loading}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center shadow-lg hover:shadow-xl"
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
