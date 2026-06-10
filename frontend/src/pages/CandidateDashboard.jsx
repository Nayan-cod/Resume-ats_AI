import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import Sidebar from '../components/layout/Sidebar';
import { Search, Upload, Briefcase, FileText, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Candidate Dashboard — job browsing and application tracking for candidates.
 * Real-time updates via WebSocket when HR makes decisions on applications.
 */
export default function CandidateDashboard() {
    const { authFetch, user } = useAuth();
    const [jobs, setJobs] = useState([]);
    const [myApps, setMyApps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(''); // Error for the initial data load
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('jobs'); // 'jobs' or 'applications'

    // Apply modal state
    const [showApply, setShowApply] = useState(null); // job object or null
    const [resumeFile, setResumeFile] = useState(null);
    const [applying, setApplying] = useState(false);
    const [applyMsg, setApplyMsg] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    // Real-time WebSocket listener — auto-refresh when HR makes decisions
    const handleWsMessage = useCallback((data) => {
        console.log('[Candidate] WS event:', data.type);
        if (data.type === 'status_update') {
            // HR approved/rejected — refresh My Applications
            fetchData();
        }
        if (data.type === 'new_job') {
            // New job posted — refresh job list
            fetchData();
        }
    }, []);
    useWebSocket(handleWsMessage);

    /**
     * Fetch available jobs and the candidate's own applications in parallel.
     * Stores results in state; shows an error message on failure.
     */
    const fetchData = async () => {
        setLoading(true);
        setFetchError('');
        try {
            const [jobsRes, appsRes] = await Promise.all([
                authFetch('/api/jobs'),
                authFetch('/api/my-applications')
            ]);
            if (jobsRes.ok) setJobs(await jobsRes.json());
            else setFetchError('Failed to load job listings. Please refresh.');
            if (appsRes.ok) setMyApps(await appsRes.json());
        } catch (err) {
            console.error(err);
            setFetchError('Network error loading data. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Submit a resume application for the selected job.
     * Validates file type (.pdf) and size (max 5 MB) before uploading.
     */
    const handleApply = async () => {
        if (!resumeFile || !showApply) return;

        // Client-side file validation
        if (!resumeFile.name.toLowerCase().endsWith('.pdf')) {
            setApplyMsg('Only PDF files are accepted.');
            return;
        }
        const MAX_SIZE_MB = 5;
        if (resumeFile.size > MAX_SIZE_MB * 1024 * 1024) {
            setApplyMsg(`File is too large. Maximum size is ${MAX_SIZE_MB} MB.`);
            return;
        }

        setApplying(true);
        setApplyMsg('');

        const formData = new FormData();
        formData.append('resume_file', resumeFile);

        try {
            const res = await authFetch(`/api/jobs/${showApply.id}/apply`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                setApplyMsg('Application submitted! AI is screening your resume...');
                setTimeout(() => { setShowApply(null); setResumeFile(null); setApplyMsg(''); fetchData(); }, 2000);
            } else {
                setApplyMsg(data.error?.message || data.detail || 'Failed to apply. Please try again.');
            }
        } catch (err) {
            setApplyMsg('Network error. Please check your connection and try again.');
        } finally {
            setApplying(false);
        }
    };

    const appliedJobIds = new Set(myApps.map(a => a.job_id));
    const filteredJobs = jobs.filter(j =>
        j.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        j.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const statusIcon = (status) => {
        switch(status) {
            case 'approved': return <CheckCircle2 size={16} className="text-green-500" />;
            case 'rejected': return <XCircle size={16} className="text-red-500" />;
            case 'pending': return <Clock size={16} className="text-yellow-500" />;
            default: return <AlertCircle size={16} className="text-gray-400" />;
        }
    };

    const statusBadge = (status) => {
        const styles = {
            approved: 'bg-green-100 text-green-700',
            rejected: 'bg-red-100 text-red-700',
            pending: 'bg-yellow-100 text-yellow-700',
        };
        return styles[status] || 'bg-gray-100 text-gray-600';
    };

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans">
            <Sidebar />
            <main className="flex-1 ml-64">
                {/* Header */}
                <header className="bg-white h-16 border-b border-gray-100 flex items-center justify-between px-8 sticky top-0 z-10">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Welcome, {user?.name || 'Candidate'}!</h1>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search jobs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>
                </header>

                <div className="p-8 max-w-7xl mx-auto">
                    {/* Tab Toggle */}
                    <div className="flex gap-2 mb-8">
                        <button
                            onClick={() => setActiveTab('jobs')}
                            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                activeTab === 'jobs' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            <Briefcase size={16} className="inline mr-2" />Available Jobs ({filteredJobs.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('applications')}
                            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                activeTab === 'applications' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            <FileText size={16} className="inline mr-2" />My Applications ({myApps.length})
                        </button>
                    </div>

                    {loading ? (
                        <div className="text-center py-16">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
                            <p className="text-gray-400 text-sm">Loading...</p>
                        </div>
                    ) : fetchError ? (
                        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm flex items-center gap-2">
                            <span>⚠️</span>
                            <div>
                                {fetchError}
                                <button onClick={fetchData} className="block underline text-xs mt-1">Retry</button>
                            </div>
                        </div>
                    ) : activeTab === 'jobs' ? (
                        /* ── JOB BOARD ── */
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {filteredJobs.length === 0 ? (
                                <div className="col-span-full bg-white p-12 rounded-xl text-center border border-dashed border-gray-200">
                                    <Briefcase className="mx-auto text-gray-300 mb-3" size={40} />
                                    <h3 className="text-lg font-medium text-gray-700">No jobs available yet</h3>
                                    <p className="text-gray-400 text-sm mt-1">Check back later for new opportunities.</p>
                                </div>
                            ) : (
                                filteredJobs.map(job => (
                                    <motion.div
                                        key={job.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all flex flex-col"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="p-2 bg-blue-50 rounded-lg">
                                                <Briefcase className="text-blue-600" size={20} />
                                            </div>
                                            {appliedJobIds.has(job.id) && (
                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Applied</span>
                                            )}
                                        </div>
                                        <h3 className="font-bold text-gray-900 mb-2">{job.title}</h3>
                                        <p className="text-gray-500 text-sm mb-4 line-clamp-3 flex-1">{job.description}</p>
                                        <div className="flex justify-between items-center pt-4 border-t border-gray-50">
                                            <span className="text-xs text-gray-400">
                                                {job.hr_name && `By ${job.hr_name}`}
                                            </span>
                                            {!appliedJobIds.has(job.id) ? (
                                                <button
                                                    onClick={() => setShowApply(job)}
                                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1"
                                                >
                                                    <Upload size={14} /> Apply
                                                </button>
                                            ) : (
                                                <span className="text-sm text-green-600 font-medium">Applied ✓</span>
                                            )}
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    ) : (
                        /* ── MY APPLICATIONS ── */
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 text-gray-500 uppercase">
                                        <tr>
                                            <th className="px-6 py-4 font-medium">Job Title</th>
                                            <th className="px-6 py-4 font-medium">AI Score</th>
                                            <th className="px-6 py-4 font-medium">AI Decision</th>
                                            <th className="px-6 py-4 font-medium">HR Status</th>
                                            <th className="px-6 py-4 font-medium">Applied</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {myApps.length === 0 ? (
                                            <tr><td colSpan="5" className="text-center py-12 text-gray-500">You haven't applied to any jobs yet.</td></tr>
                                        ) : (
                                            myApps.map(app => (
                                                <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4 font-medium text-gray-900">{app.job_title}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                            app.ai_score >= 70 ? 'bg-green-100 text-green-800' :
                                                            app.ai_score >= 40 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                                                        }`}>
                                                            {app.ai_score}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-600">{app.ai_decision}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusBadge(app.hr_status)}`}>
                                                            {statusIcon(app.hr_status)} {app.hr_status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-500 text-xs">{new Date(app.created_at).toLocaleDateString()}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Apply Modal */}
            <AnimatePresence>
                {showApply && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => { if (!applying) { setShowApply(null); setResumeFile(null); setApplyMsg(''); } }}
                    >
                        <motion.div
                            initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 className="text-xl font-bold text-gray-900 mb-1">Apply to {showApply.title}</h2>
                            <p className="text-sm text-gray-500 mb-6 line-clamp-2">{showApply.description}</p>

                            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-blue-400 transition-colors mb-4">
                                <Upload className="mx-auto text-gray-400 mb-2" size={32} />
                                <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={(e) => setResumeFile(e.target.files[0])}
                                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 cursor-pointer"
                                />
                                {resumeFile && (
                                    <p className="mt-2 text-sm text-green-600 font-medium">{resumeFile.name} selected</p>
                                )}
                            </div>

                            {applyMsg && (
                                <div className={`text-sm p-3 rounded-lg mb-4 ${applyMsg.includes('submitted') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                    {applyMsg}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setShowApply(null); setResumeFile(null); setApplyMsg(''); }}
                                    disabled={applying}
                                    className="flex-1 py-3 rounded-xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleApply}
                                    disabled={!resumeFile || applying}
                                    className="flex-1 py-3 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {applying ? (
                                        <><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span> Submitting...</>
                                    ) : (
                                        <><Upload size={16} /> Submit Application</>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
