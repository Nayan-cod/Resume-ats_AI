import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/layout/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { Search, Bell, Plus, Briefcase, Users, CheckCircle2, XCircle, ChevronDown, ChevronUp, FileText, TrendingUp, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../lib/config';

export default function Dashboard() {
    const { authFetch, user } = useAuth();
    const [jobs, setJobs] = useState([]);
    const [selectedJob, setSelectedJob] = useState(null);
    const [applications, setApplications] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [loadingApps, setLoadingApps] = useState(false);
    const [expandedApp, setExpandedApp] = useState(null);

    // New Job Modal
    const [showNewJob, setShowNewJob] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [creatingJob, setCreatingJob] = useState(false);

    // Email Confirmation Modal States
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmingApp, setConfirmingApp] = useState(null);
    const [confirmingStatus, setConfirmingStatus] = useState('');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');

    const triggerConfirmModal = (app, status) => {
        setConfirmingApp(app);
        setConfirmingStatus(status);
        
        const candidateName = app.candidate_name || app.applicant_name || 'Candidate';
        const jobTitle = selectedJob?.title || 'the position';

        if (status === 'approved') {
            setEmailSubject(`Congratulations! You've been selected for ${jobTitle}`);
            setEmailBody(
`Hi ${candidateName},

We are thrilled to inform you that your application for the position of ${jobTitle} has been approved!

Our HR team will reach out to you shortly with the next steps regarding the interview process.

Best regards,
The Recruitment Team
ResumeAI ATS Platform`
            );
        } else {
            setEmailSubject(`Application Update for ${jobTitle}`);
            setEmailBody(
`Hi ${candidateName},

Thank you for your interest in the ${jobTitle} position and for taking the time to apply.

After careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current needs.

We encourage you to apply for future openings that match your skills and experience. We wish you the very best in your career journey.

Best regards,
The Recruitment Team
ResumeAI ATS Platform`
            );
        }
        setShowConfirmModal(true);
    };

    useEffect(() => {
        fetchDashboard();
    }, []);

    // Real-time WebSocket listener — auto-refresh when events arrive
    const handleWsMessage = useCallback((data) => {
        console.log('[HR Dashboard] WS event:', data.type);
        if (data.type === 'new_application') {
            // A candidate just applied — refresh the job list & current applications
            fetchDashboard();
            if (selectedJob) fetchApplications(selectedJob.id);
        }
        if (data.type === 'status_update') {
            // Another HR tab made a change — refresh
            if (selectedJob) fetchApplications(selectedJob.id);
            fetchDashboard();
        }
    }, [selectedJob]);
    useWebSocket(handleWsMessage);

    const fetchDashboard = async () => {
        setLoading(true);
        try {
            const [jobsRes, statsRes] = await Promise.all([
                authFetch('/api/hr/jobs'),
                authFetch('/api/hr/stats')
            ]);
            if (jobsRes.ok) {
                const jobsData = await jobsRes.json();
                setJobs(jobsData);
                if (jobsData.length > 0 && !selectedJob) {
                    setSelectedJob(jobsData[0]);
                    fetchApplications(jobsData[0].id);
                }
            }
            if (statsRes.ok) setStats(await statsRes.json());
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchApplications = async (jobId) => {
        setLoadingApps(true);
        try {
            const res = await authFetch(`/api/hr/jobs/${jobId}/applications`);
            if (res.ok) setApplications(await res.json());
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingApps(false);
        }
    };

    const selectJob = (job) => {
        setSelectedJob(job);
        fetchApplications(job.id);
        setExpandedApp(null);
    };

    const handleStatusUpdate = async (appId, status) => {
        setLoadingApps(true);
        try {
            const res = await authFetch(`/api/applications/${appId}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ 
                    status,
                    email_subject: emailSubject,
                    email_body: emailBody
                })
            });
            if (res.ok) {
                fetchApplications(selectedJob.id);
                fetchDashboard();
                setShowConfirmModal(false);
                setConfirmingApp(null);
                setConfirmingStatus('');
                setEmailSubject('');
                setEmailBody('');
            } else {
                const data = await res.json();
                alert(data.detail || "Failed to update candidate status.");
            }
        } catch (err) {
            console.error(err);
            alert("An error occurred: " + err.message);
        } finally {
            setLoadingApps(false);
        }
    };

    const handleCreateJob = async (e) => {
        e.preventDefault();
        if (!newTitle.trim() || !newDesc.trim()) return;
        setCreatingJob(true);
        try {
            const res = await authFetch('/api/jobs', {
                method: 'POST',
                body: JSON.stringify({ title: newTitle, description: newDesc })
            });
            if (res.ok) {
                setShowNewJob(false);
                setNewTitle('');
                setNewDesc('');
                fetchDashboard();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setCreatingJob(false);
        }
    };

    const parseJustification = (justStr) => {
        try {
            const parsed = JSON.parse(justStr);
            return Array.isArray(parsed) ? parsed : [justStr];
        } catch {
            return [justStr];
        }
    };

    const scoreColor = (score) => {
        if (score >= 70) return 'text-green-600 bg-green-50 border-green-200';
        if (score >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
        return 'text-red-600 bg-red-50 border-red-200';
    };

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans">
            <Sidebar />
            <main className="flex-1 ml-64">
                {/* Topbar */}
                <header className="bg-white h-16 border-b border-gray-100 flex items-center justify-between px-8 sticky top-0 z-10">
                    <h1 className="text-xl font-bold text-gray-900">HR Dashboard</h1>
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => setShowNewJob(true)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 transition-colors"
                        >
                            <Plus size={16} /> New Job Posting
                        </button>
                    </div>
                </header>

                <div className="p-8 max-w-7xl mx-auto space-y-8">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {[
                            { label: 'Total Jobs', val: stats.total_jobs || 0, icon: <Briefcase size={20} />, color: 'blue' },
                            { label: 'Total Applications', val: stats.total_applications || 0, icon: <FileText size={20} />, color: 'purple' },
                            { label: 'AI Shortlisted', val: stats.shortlisted || 0, icon: <TrendingUp size={20} />, color: 'green' },
                            { label: 'Approved', val: stats.approved || 0, icon: <CheckCircle2 size={20} />, color: 'emerald' },
                        ].map((stat, i) => (
                            <div key={i} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="text-gray-500 text-sm font-medium">{stat.label}</div>
                                    <div className={`p-2 rounded-lg bg-${stat.color}-50 text-${stat.color}-600`}>{stat.icon}</div>
                                </div>
                                <div className="text-3xl font-bold text-gray-900">{stat.val}</div>
                            </div>
                        ))}
                    </div>

                    {/* Job Selector Tabs */}
                    {jobs.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {jobs.map(job => (
                                <button
                                    key={job.id}
                                    onClick={() => selectJob(job)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                                        selectedJob?.id === job.id
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    <Briefcase size={14} />
                                    {job.title}
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                        selectedJob?.id === job.id ? 'bg-white/20' : 'bg-gray-100'
                                    }`}>
                                        {job.application_count || 0}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Applications Table */}
                    {selectedJob ? (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">Applications for: {selectedJob.title}</h2>
                                    <p className="text-sm text-gray-500">Sorted by AI score (highest first)</p>
                                </div>
                                <span className="text-sm text-gray-500">{applications.length} applicants</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 text-gray-500 uppercase">
                                        <tr>
                                            <th className="px-6 py-4 font-medium">Candidate</th>
                                            <th className="px-6 py-4 font-medium">AI Score</th>
                                            <th className="px-6 py-4 font-medium">AI Decision</th>
                                            <th className="px-6 py-4 font-medium">HR Status</th>
                                            <th className="px-6 py-4 font-medium">Actions</th>
                                            <th className="px-6 py-4 font-medium"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {loadingApps ? (
                                            <tr><td colSpan="6" className="text-center py-8 text-gray-500">Loading applications...</td></tr>
                                        ) : applications.length === 0 ? (
                                            <tr><td colSpan="6" className="text-center py-12 text-gray-400">
                                                <Users className="mx-auto mb-2" size={32} />
                                                No applications yet for this job.
                                            </td></tr>
                                        ) : (
                                            applications.map(app => (
                                                <React.Fragment key={app.id}>
                                                    <tr className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="font-bold text-gray-900">{app.candidate_name || app.applicant_name || 'Unknown'}</div>
                                                            <div className="text-xs text-gray-500">{app.applicant_email}</div>
                                                            {app.candidate_role && <div className="text-xs text-blue-600 mt-0.5">{app.candidate_role}</div>}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border ${scoreColor(app.ai_score)}`}>
                                                                {app.ai_score}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`text-sm font-medium ${
                                                                app.ai_decision === 'Select' || app.ai_decision === 'Selected' ? 'text-green-600' :
                                                                app.ai_decision === 'Hold' ? 'text-yellow-600' : 'text-red-600'
                                                            }`}>
                                                                {app.ai_decision}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                                                                app.hr_status === 'approved' ? 'bg-green-100 text-green-700' :
                                                                app.hr_status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                                'bg-yellow-100 text-yellow-700'
                                                            }`}>
                                                                {app.hr_status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {app.hr_status === 'pending' ? (
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => triggerConfirmModal(app, 'approved')}
                                                                        className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 transition-colors flex items-center gap-1"
                                                                    >
                                                                        <CheckCircle2 size={14} /> Approve
                                                                    </button>
                                                                    <button
                                                                        onClick={() => triggerConfirmModal(app, 'rejected')}
                                                                        className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 transition-colors flex items-center gap-1"
                                                                    >
                                                                        <XCircle size={14} /> Reject
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-gray-400">Decision made</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <button
                                                                onClick={() => setExpandedApp(expandedApp === app.id ? null : app.id)}
                                                                className="text-blue-600 hover:text-blue-800 p-1"
                                                            >
                                                                {expandedApp === app.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    {/* Expanded Justification */}
                                                    {expandedApp === app.id && (
                                                         <tr>
                                                             <td colSpan="6" className="px-6 py-4 bg-blue-50/50">
                                                                 <div className="max-w-3xl">
                                                                     <h4 className="text-sm font-bold text-gray-800 mb-3">AI Justification</h4>
                                                                     <ul className="space-y-2">
                                                                         {parseJustification(app.ai_justification).map((item, idx) => (
                                                                             <li key={idx} className="text-sm text-gray-700">
                                                                                 {typeof item === 'object' ? (
                                                                                     <div className="border-l-2 border-blue-300 pl-3">
                                                                                         <span className="font-semibold">{item.point}: </span>
                                                                                         <span>{item.details}</span>
                                                                                     </div>
                                                                                 ) : (
                                                                                     <div className="flex items-start gap-2">
                                                                                         <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-400 shrink-0"></span>
                                                                                         {String(item)}
                                                                                     </div>
                                                                                 )}
                                                                             </li>
                                                                         ))}
                                                                     </ul>
                                                                     <div className="mt-3 text-xs text-gray-500">
                                                                         Resume: {app.resume_path ? (
                                                                             <a
                                                                                 href={app.resume_path.startsWith('http') ? app.resume_path : `${API_URL}/${app.resume_path}`}
                                                                                 target="_blank"
                                                                                 rel="noopener noreferrer"
                                                                                 className="text-blue-600 hover:text-blue-800 underline font-medium cursor-pointer"
                                                                             >
                                                                                 {app.resume_filename}
                                                                             </a>
                                                                         ) : (
                                                                             <span className="text-gray-400 italic font-medium">Deleted (Decision Made)</span>
                                                                         )}
                                                                     </div>
                                                                 </div>
                                                             </td>
                                                         </tr>
                                                     )}
                                                </React.Fragment>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : !loading && (
                        <div className="bg-white p-12 rounded-xl text-center border border-dashed border-gray-200">
                            <Briefcase className="mx-auto text-gray-300 mb-3" size={40} />
                            <h3 className="text-lg font-medium text-gray-700">No Job Postings Yet</h3>
                            <p className="text-gray-400 text-sm mt-1 mb-4">Create your first job posting to start receiving applications.</p>
                            <button
                                onClick={() => setShowNewJob(true)}
                                className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                            >
                                <Plus size={16} className="inline mr-1" /> Create Job Posting
                            </button>
                        </div>
                    )}
                </div>
            </main>

            {/* New Job Modal */}
            <AnimatePresence>
                {showNewJob && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => !creatingJob && setShowNewJob(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 className="text-xl font-bold text-gray-900 mb-6">Create New Job Posting</h2>
                            <form onSubmit={handleCreateJob} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                                    <input
                                        type="text"
                                        value={newTitle}
                                        onChange={(e) => setNewTitle(e.target.value)}
                                        placeholder="e.g. Senior Python Developer"
                                        required
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Job Description</label>
                                    <textarea
                                        value={newDesc}
                                        onChange={(e) => setNewDesc(e.target.value)}
                                        placeholder="Describe the role, requirements, skills needed..."
                                        required
                                        rows={6}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                                    ></textarea>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => setShowNewJob(false)} disabled={creatingJob}
                                        className="flex-1 py-3 rounded-xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={creatingJob}
                                        className="flex-1 py-3 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50">
                                        {creatingJob ? 'Creating...' : 'Create Job'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Email Confirmation Modal */}
            <AnimatePresence>
                {showConfirmModal && confirmingApp && (
                    <motion.div
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => !loadingApps && setShowConfirmModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9 }} 
                            animate={{ scale: 1 }} 
                            exit={{ scale: 0.9 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-8"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Confirm Candidate Decision</h2>
                            <p className="text-sm text-gray-500 mb-6">
                                You are {confirmingStatus === 'approved' ? 'approving' : 'rejecting'} <strong>{confirmingApp.candidate_name || confirmingApp.applicant_name}</strong>.
                                The following email will be sent immediately:
                            </p>

                            {/* Email Preview & Edit Area */}
                            <div className="bg-slate-50 border border-gray-200 rounded-xl overflow-hidden mb-6 text-sm">
                                <div className="bg-gray-100 p-3 border-b border-gray-200 text-xs text-gray-600 space-y-2">
                                    <div><span className="font-semibold">From:</span> {user?.email || 'hr@resumeai.com'}</div>
                                    <div><span className="font-semibold">To:</span> {confirmingApp.applicant_email}</div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold shrink-0">Subject:</span>
                                        <input
                                            type="text"
                                            value={emailSubject}
                                            onChange={(e) => setEmailSubject(e.target.value)}
                                            className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                                <div className="p-3 bg-white">
                                    <textarea
                                        value={emailBody}
                                        onChange={(e) => setEmailBody(e.target.value)}
                                        rows={10}
                                        className="w-full border border-gray-200 rounded-lg p-3 text-xs leading-relaxed text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none font-sans"
                                        placeholder="Type email body here..."
                                    ></textarea>
                                </div>
                            </div>

                            {/* Modal Action Buttons */}
                            <div className="flex gap-3">
                                <button 
                                    type="button" 
                                    onClick={() => setShowConfirmModal(false)} 
                                    disabled={loadingApps}
                                    className="flex-1 py-3 rounded-xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => handleStatusUpdate(confirmingApp.id, confirmingStatus)} 
                                    disabled={loadingApps}
                                    className={`flex-1 py-3 rounded-xl font-medium text-white transition-colors disabled:opacity-50 ${
                                        confirmingStatus === 'approved' 
                                            ? 'bg-green-600 hover:bg-green-700' 
                                            : 'bg-red-600 hover:bg-red-700'
                                    }`}
                                >
                                    {loadingApps ? 'Sending...' : `Confirm & Send Email`}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
