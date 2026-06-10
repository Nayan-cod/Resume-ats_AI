import React, { useEffect, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import { Search, Filter } from 'lucide-react';
import { API_URL } from '../lib/config';

export default function Candidates() {
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        fetchCandidates();
    }, []);

    const fetchCandidates = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/candidates`);
            if (response.ok) {
                 const data = await response.json();
                 setCandidates(data);
            }
        } catch (error) {
            console.error("Error fetching candidates:", error);
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
                        <p className="text-sm text-gray-500">View extracted candidate information stored in database</p>
                    </div>
                </header>

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
                                    <tr><td colSpan="6" className="text-center py-8">Loading...</td></tr>
                                ) : candidates.length === 0 ? (
                                    <tr><td colSpan="6" className="text-center py-8 text-gray-500">No candidates found in database</td></tr>
                                ) : (
                                    candidates.map((c) => (
                                        <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 text-gray-500">#{c.id}</td>
                                            <td className="px-6 py-4 font-medium text-gray-900">{c.candidate_name || "Unknown"}</td>
                                            <td className="px-6 py-4 text-gray-600">{c.candidate_role || "N/A"}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                                                    ${c.score >= 80 ? 'bg-green-100 text-green-800' : 
                                                      c.score >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                                    {c.score}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">{c.decision}</td>
                                            <td className="px-6 py-4 text-gray-500">{new Date(c.timestamp).toLocaleDateString()}</td>
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
