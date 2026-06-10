import React, { useEffect, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import { Briefcase, FileText, AlertCircle } from 'lucide-react';
import { API_URL } from '../lib/config';

/**
 * Job Postings page — displays all HR-posted jobs in a card grid.
 * Shows loading, error, and empty states.
 *
 * NOTE (Bug Fix): Previously used job.content and job.timestamp which don't exist
 * on the API response. Corrected to job.title, job.description, and job.created_at.
 */
export default function JobPostings() {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchJobs();
    }, []);

    /**
     * Fetch all public job postings from the API and update local state.
     * Handles network errors and non-OK responses with a user-friendly message.
     */
    const fetchJobs = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_URL}/api/jobs`);
            if (!response.ok) {
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            setJobs(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error fetching jobs:', err);
            setError('Failed to load job postings. Please check your connection and try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans">
            <Sidebar />
            <main className="flex-1 ml-64 p-8">
                <header className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900">Job Postings</h1>
                    <p className="text-sm text-gray-500">All active job listings on the platform</p>
                </header>

                {/* Error state */}
                {error && (
                    <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">
                        <AlertCircle size={20} className="shrink-0" />
                        <div>
                            <p className="font-medium text-sm">{error}</p>
                            <button onClick={fetchJobs} className="text-xs underline mt-1 hover:text-red-900">
                                Try again
                            </button>
                        </div>
                    </div>
                )}

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {loading ? (
                        /* Loading skeleton cards */
                        Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animate-pulse">
                                <div className="w-10 h-10 bg-gray-100 rounded-lg mb-4"></div>
                                <div className="h-4 bg-gray-100 rounded w-3/4 mb-2"></div>
                                <div className="h-3 bg-gray-100 rounded w-full mb-1"></div>
                                <div className="h-3 bg-gray-100 rounded w-5/6 mb-1"></div>
                                <div className="h-3 bg-gray-100 rounded w-4/6"></div>
                            </div>
                        ))
                    ) : jobs.length === 0 && !error ? (
                        /* Empty state */
                        <div className="col-span-full bg-white p-8 rounded-xl text-center border-dashed border-2 border-gray-200">
                            <div className="mx-auto w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                                <Briefcase className="text-gray-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900">No Job Postings Yet</h3>
                            <p className="text-gray-500 text-sm mt-1">HR managers haven't posted any jobs yet. Check back soon!</p>
                        </div>
                    ) : (
                        jobs.map((job) => (
                            <div key={job.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex flex-col">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-2 bg-blue-50 rounded-lg">
                                        <FileText className="text-blue-600" size={20} />
                                    </div>
                                    <span className="text-xs text-gray-400">#{job.id}</span>
                                </div>
                                {/* Fixed: was job.content — API returns job.title */}
                                <h3 className="font-bold text-gray-900 mb-2 line-clamp-1">
                                    {job.title || 'Untitled Position'}
                                </h3>
                                {/* Fixed: was job.content — API returns job.description */}
                                <p className="text-gray-500 text-sm mb-4 line-clamp-3 flex-1">
                                    {job.description || 'No description provided.'}
                                </p>
                                <div className="flex justify-between items-center text-xs text-gray-400 pt-4 border-t border-gray-50">
                                    {/* Fixed: was job.timestamp — API returns job.created_at */}
                                    <span>{job.created_at ? new Date(job.created_at).toLocaleDateString() : ''}</span>
                                    {job.hr_name && <span className="text-gray-400">By {job.hr_name}</span>}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
