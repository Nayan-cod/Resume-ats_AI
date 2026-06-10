import React, { useEffect, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import { Users, AlertCircle } from 'lucide-react';
import { API_URL } from '../lib/config';

/**
 * Candidates Database page — shows all screened candidates across all jobs.
 * Displays loading skeletons, an error state with retry, and an empty state.
 */
export default function Candidates() {
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchCandidates();
    }, []);

    /**
     * Fetch all candidate records from the API and update local state.
     * Handles network errors and non-OK responses gracefully.
     */
    const fetchCandidates = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_URL}/api/candidates`);
            if (!response.ok) {
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            setCandidates(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error fetching candidates:', err);
            setError('Failed to load candidate data. Please check your connection and try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans">
            <Sidebar />
            <main className="flex-1 ml-64 p-8">
                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Candidates Database</h1>
                        <p className="text-sm text-gray-500">All screened candidates across all job postings</p>
                    </div>
                </header>

                {/* Error state */}
                {error && (
                    <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">
                        <AlertCircle size={20} className="shrink-0" />
                        <div>
                            <p className="font-medium text-sm">{error}</p>
                            <button onClick={fetchCandidates} className="text-xs underline mt-1 hover:text-red-900">
                                Try again
                            </button>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 uppercase">
                                <tr>
                                    <th className="px-6 py-4 font-medium">ID</th>
                                    <th className="px-6 py-4 font-medium">Name</th>
                                    <th className="px-6 py-4 font-medium">Role</th>
                                    <th className="px-6 py-4 font-medium">Score</th>
                                    <th className="px-6 py-4 font-medium">Decision</th>
                                    <th className="px-6 py-4 font-medium">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    /* Loading skeleton rows */
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td className="px-6 py-4"><div className="h-3 bg-gray-100 rounded w-8"></div></td>
                                            <td className="px-6 py-4"><div className="h-3 bg-gray-100 rounded w-32"></div></td>
                                            <td className="px-6 py-4"><div className="h-3 bg-gray-100 rounded w-24"></div></td>
                                            <td className="px-6 py-4"><div className="h-5 bg-gray-100 rounded-full w-12"></div></td>
                                            <td className="px-6 py-4"><div className="h-3 bg-gray-100 rounded w-16"></div></td>
                                            <td className="px-6 py-4"><div className="h-3 bg-gray-100 rounded w-20"></div></td>
                                        </tr>
                                    ))
                                ) : candidates.length === 0 && !error ? (
                                    /* Empty state */
                                    <tr>
                                        <td colSpan="6" className="text-center py-16 text-gray-400">
                                            <Users className="mx-auto mb-3 text-gray-300" size={40} />
                                            <p className="font-medium text-gray-500">No candidates yet</p>
                                            <p className="text-sm mt-1">Candidates will appear here after they apply to jobs and are screened by AI.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    candidates.map((c) => (
                                        <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 text-gray-500">#{c.id}</td>
                                            <td className="px-6 py-4 font-medium text-gray-900">{c.candidate_name || 'Unknown'}</td>
                                            <td className="px-6 py-4 text-gray-600">{c.candidate_role || 'N/A'}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                                    ${c.score >= 80 ? 'bg-green-100 text-green-800' :
                                                      c.score >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                                    {c.score ?? 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">{c.decision || '—'}</td>
                                            <td className="px-6 py-4 text-gray-500">
                                                {c.timestamp ? new Date(c.timestamp).toLocaleDateString() : '—'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
