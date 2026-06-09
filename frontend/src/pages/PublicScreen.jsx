import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import ScreeningWidget from '../components/dashboard/ScreeningWidget';
import { Bot, ArrowLeft } from 'lucide-react';

export default function PublicScreen() {
    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <Navbar />

            <div className="max-w-3xl mx-auto px-4 py-12">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 mb-3">
                        <Bot className="text-blue-600" size={28} />
                        <h1 className="text-2xl font-bold text-gray-900">AI Resume Screener</h1>
                    </div>
                    <p className="text-gray-500 text-sm max-w-lg mx-auto">
                        Paste any Job Description and upload a resume to get an instant AI-powered match score with detailed justification. No login required.
                    </p>
                </div>

                {/* Screening Widget */}
                <ScreeningWidget />

                {/* Back Link */}
                <div className="text-center mt-8">
                    <Link to="/" className="text-sm text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1">
                        <ArrowLeft size={14} /> Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
