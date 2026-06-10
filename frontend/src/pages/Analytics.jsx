import React, { useState, useEffect } from 'react';
import Sidebar from '../components/layout/Sidebar';
import { useAuth } from '../context/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, UserCheck, Clock, AlertCircle } from 'lucide-react';

/**
 * Analytics Dashboard — displays recruitment metrics for the logged-in HR user.
 * Includes application trend charts, pipeline status pie chart, and top skills bar chart.
 * Handles loading (spinner), error (retry button), and empty (no-data placeholder) states.
 */
export default function Analytics() {
    const { authFetch } = useAuth();
    const [timelineData, setTimelineData] = useState([]);
    const [skillsData, setSkillsData] = useState([]);
    const [statusData, setStatusData] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const COLORS = ['#3b82f6', '#ef4444', '#eab308', '#10b981'];

    useEffect(() => {
        const fetchAnalytics = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await authFetch('/api/hr/analytics');
                if (!res.ok) {
                    throw new Error(`Failed to load analytics: ${res.statusText}`);
                }
                const data = await res.json();
                setStats(data.stats || {});
                setTimelineData(data.timeline || []);
                setSkillsData(data.skills || []);
                setStatusData(data.pipeline || []);
            } catch (err) {
                console.error('Error fetching analytics:', err);
                setError(err.message || 'An unexpected error occurred while loading analytics.');
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, []);

    const StatCard = ({ title, value, icon, colorClass }) => (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
                <p className="text-sm text-gray-500 font-medium">{title}</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
            </div>
            <div className={`p-3 rounded-full ${colorClass}`}>
                {icon}
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="flex min-h-screen bg-slate-50 font-sans">
                <Sidebar />
                <main className="flex-1 ml-64 p-8 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                        <p className="text-sm text-gray-500 font-medium">Loading analytics dashboard...</p>
                    </div>
                </main>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex min-h-screen bg-slate-50 font-sans">
                <Sidebar />
                <main className="flex-1 ml-64 p-8 flex items-center justify-center">
                    <div className="bg-white p-8 rounded-xl shadow-sm border border-red-100 max-w-md w-full text-center">
                        <AlertCircle className="mx-auto text-red-500 mb-3" size={40} />
                        <h3 className="text-lg font-bold text-gray-900 mb-1">Error Loading Analytics</h3>
                        <p className="text-sm text-gray-500 mb-4">{error}</p>
                        <button 
                            onClick={() => window.location.reload()}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans">
            <Sidebar />
            <main className="flex-1 ml-64 p-8">
                <header className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
                    <p className="text-sm text-gray-500">Recruitment metrics and AI insights</p>
                </header>

                <div className="space-y-8">
                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <StatCard 
                            title="Total Applications" 
                            value={stats.total_applications || 0} 
                            icon={<Users size={24} />} 
                            colorClass="bg-blue-100 text-blue-600" 
                        />
                        <StatCard 
                            title="Candidates Screened" 
                            value={stats.candidates_screened || 0} 
                            icon={<TrendingUp size={24} />} 
                            colorClass="bg-indigo-100 text-indigo-600" 
                        />
                        <StatCard 
                            title="Hired" 
                            value={stats.hired || 0} 
                            icon={<UserCheck size={24} />} 
                            colorClass="bg-green-100 text-green-600" 
                        />
                        <StatCard 
                            title="Avg. Time to Hire" 
                            value={`${stats.avg_time_to_hire || 12} Days`} 
                            icon={<Clock size={24} />} 
                            colorClass="bg-purple-100 text-purple-600" 
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Hiring Timeline */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
                             <h3 className="text-lg font-bold text-gray-900 mb-6">Application Trends</h3>
                             <div className="h-80 flex-1 flex items-center justify-center">
                                {timelineData.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400 text-sm">
                                        <Users className="mx-auto mb-2 text-gray-300" size={32} />
                                        No application trends data available yet.
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={timelineData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                            <YAxis axisLine={false} tickLine={false} />
                                            <Tooltip />
                                            <Line type="monotone" dataKey="apps" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
                                            <Line type="monotone" dataKey="hires" stroke="#16a34a" strokeWidth={3} dot={{ r: 4 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                             </div>
                        </div>

                        {/* Status Distribution */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
                             <h3 className="text-lg font-bold text-gray-900 mb-6">Pipeline Status</h3>
                             <div className="h-80 flex-1 flex items-center justify-center">
                                {statusData.every(item => item.value === 0) ? (
                                    <div className="text-center py-12 text-gray-400 text-sm">
                                        <TrendingUp className="mx-auto mb-2 text-gray-300" size={32} />
                                        No pipeline data available yet.
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={statusData}
                                                innerRadius={80}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {statusData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                )}
                             </div>
                             {!statusData.every(item => item.value === 0) && (
                                 <div className="flex justify-center gap-4 mt-4 flex-wrap">
                                    {statusData.map((entry, index) => (
                                        <div key={index} className="flex items-center gap-2 text-sm text-gray-500">
                                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }}></span>
                                            {entry.name} ({entry.value})
                                        </div>
                                    ))}
                                 </div>
                             )}
                        </div>
                    </div>

                    {/* Skills Breakdown */}
                     <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
                             <h3 className="text-lg font-bold text-gray-900 mb-6">Top Skills Detected</h3>
                             <div className="h-64 flex-1 flex items-center justify-center">
                                {skillsData.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400 text-sm">
                                        <AlertCircle className="mx-auto mb-2 text-gray-300" size={32} />
                                        No candidate skills data detected yet.
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={skillsData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                            <YAxis axisLine={false} tickLine={false} />
                                            <Tooltip cursor={{ fill: '#f8fafc' }} />
                                            <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={50} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                             </div>
                     </div>
                </div>
            </main>
        </div>
    );
}
