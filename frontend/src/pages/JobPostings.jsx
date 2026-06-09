import React, { useEffect, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import { Briefcase, FileText } from 'lucide-react';

export default function JobPostings() {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchJobs();
    }, []);

    const fetchJobs = async () => {
        setLoading(true);
        try {
            const response = await fetch('http://localhost:8001/jobs');
            if (response.ok) {
                 const data = await response.json();
                 setJobs(data);
            }
        } catch (error) {
            console.error("Error fetching jobs:", error);
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
                    <p className="text-sm text-gray-500">Unique job descriptions saved from analysis</p>
                </header>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {loading ? (
                        <div className="col-span-full text-center py-10">Loading jobs...</div>
                    ) : jobs.length === 0 ? (
                         <div className="col-span-full bg-white p-8 rounded-xl text-center border-dashed border-2 border-gray-200">
                            <div className="mx-auto w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                                <Briefcase className="text-gray-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900">No Job Postings Yet</h3>
                            <p className="text-gray-500 text-sm">Upload a resume with a new JD to see it here.</p>
                         </div>
                    ) : (
                        jobs.map((job) => (
                            <div key={job.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-2 bg-blue-50 rounded-lg">
                                        <FileText className="text-blue-600" size={20} />
                                    </div>
                                    <span className="text-xs text-gray-400">ID: #{job.id}</span>
                                </div>
                                <h3 className="font-bold text-gray-900 mb-2 line-clamp-1">
                                    {job.content.substring(0, 50)}...
                                </h3>
                                <p className="text-gray-500 text-sm mb-4 line-clamp-3 h-16">
                                    {job.content}
                                </p>
                                <div className="flex justify-between items-center text-xs text-gray-400 pt-4 border-t border-gray-50">
                                    <span>{new Date(job.timestamp).toLocaleDateString()}</span>
                                    <button className="text-blue-600 font-medium hover:underline">View Full JD</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
