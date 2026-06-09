import React, { useState } from 'react';
import DragDropUpload from '../DragDropUpload';
import JobDescriptionInput from '../JobDescriptionInput';
import { RefreshCw } from 'lucide-react';

export default function ScreeningWidget() {
    const [file, setFile] = useState(null);
    const [jd, setJd] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleAnalyze = async () => {
        if (!file || !jd) {
            alert("Please provide both a resume and a job description.");
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        const formData = new FormData();
        formData.append('resume_file', file);
        formData.append('job_description', jd);

        try {
            const response = await fetch('http://localhost:8001/analyze', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Analysis failed. Server returned ' + response.status);
            }

            const data = await response.json();
            setResult(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const resetAnalysis = () => {
        setResult(null);
        setFile(null);
    };

    // Render one justification item — handles both plain strings and {point, details} objects
    const renderJustItem = (item, index) => {
        if (!item) return null;
        if (typeof item === 'string') {
            return (
                <li key={index} className="flex items-start gap-2">
                    <span className="mt-1.5 block w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                    <span className="text-gray-700 text-sm">{item}</span>
                </li>
            );
        }
        if (typeof item === 'object') {
            return (
                <li key={index} className="flex flex-col gap-0.5 pl-4 border-l-2 border-blue-200">
                    {item.point && <span className="text-sm font-semibold text-gray-800">{item.point}</span>}
                    {item.details && <span className="text-sm text-gray-600">{item.details}</span>}
                </li>
            );
        }
        return null;
    };

    // Show error result from backend
    if (result && result.error) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-900">Analysis Result</h2>
                    <button onClick={resetAnalysis} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
                        <RefreshCw size={16} /> Try Again
                    </button>
                </div>
                <div className="p-6">
                    <div className="p-6 rounded-xl border-2 border-red-200 bg-red-50">
                        <h3 className="text-lg font-bold text-red-700 mb-2">Analysis Failed</h3>
                        <p className="text-sm text-red-600">{String(result.error)}</p>
                    </div>
                </div>
            </div>
        );
    }

    // Show successful result
    if (result) {
        const decision = result.decision || 'Unknown';
        const score = result.score ?? 0;
        const isGood = decision === 'Select' || decision === 'Selected';
        const isHold = decision === 'Hold';
        const cardBorder = isGood ? 'border-green-200 bg-green-50' : isHold ? 'border-yellow-200 bg-yellow-50' : 'border-red-200 bg-red-50';
        const badgeStyle = isGood ? 'bg-green-100 text-green-700' : isHold ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
        const scoreColor = score >= 70 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600';

        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-900">Analysis Result</h2>
                    <button onClick={resetAnalysis} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
                        <RefreshCw size={16} /> Analyze Another
                    </button>
                </div>
                <div className="p-6">
                    <div className={`p-6 rounded-xl border-2 ${cardBorder}`}>
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">
                                    {result.candidate_name || 'Candidate'}
                                </h3>
                                {result.candidate_role && (
                                    <p className="text-sm text-gray-500 mt-0.5">{result.candidate_role}</p>
                                )}
                                <div className={`mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badgeStyle}`}>
                                    {decision}
                                </div>
                            </div>
                            <div className="text-center">
                                <div className={`text-5xl font-bold ${scoreColor}`}>
                                    {score}
                                </div>
                                <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider">Match Score</div>
                            </div>
                        </div>

                        {Array.isArray(result.justification) && result.justification.length > 0 && (
                            <div>
                                <h4 className="text-base font-semibold text-gray-800 mb-3">Justification</h4>
                                <ul className="space-y-3">
                                    {result.justification.map((item, index) => renderJustItem(item, index))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Default: Upload form
    return (
        <div className="grid lg:grid-cols-1 gap-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-50">
                    <h2 className="text-lg font-bold text-gray-900">Upload &amp; Screen Resumes</h2>
                    <p className="text-sm text-gray-500">Paste JD and upload PDF to get AI analysis</p>
                </div>
                <div className="p-6 space-y-6">
                    <JobDescriptionInput value={jd} onChange={setJd} />
                    <DragDropUpload onFileSelect={setFile} />

                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-100">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleAnalyze}
                        disabled={loading}
                        className={`w-full bg-blue-600 text-white flex justify-center items-center py-3 rounded-xl font-medium hover:bg-blue-700 transition-all shadow-md hover:shadow-lg ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                                Analyzing...
                            </div>
                        ) : "Start AI Screening"}
                    </button>
                </div>
            </div>
        </div>
    );
}
