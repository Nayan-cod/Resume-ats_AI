import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import ScreeningWidget from '../components/dashboard/ScreeningWidget';
import { CheckCircle2, ArrowRight, Shield, Zap, FileText, X, Users, Award, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL, WS_URL } from '../lib/config';

function AnimatedNumber({ value }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = displayValue;
    const end = parseInt(value, 10) || 0;
    if (start === end) return;

    const duration = 800; // ms
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Quadratic ease out
      const easeProgress = progress * (2 - progress);
      const current = Math.floor(start + (end - start) * easeProgress);

      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(end);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return <>{displayValue}</>;
}

export default function Landing() {
  const [showWidget, setShowWidget] = useState(false);
  const [stats, setStats] = useState({
    total_candidates: 0,
    total_hrs: 0,
    total_jobs: 0,
    total_selected: 0
  });

  // Fetch initial stats & connect WebSocket
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_URL}/api/public-stats`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Failed to fetch public stats:", err);
      }
    };
    fetchStats();

    // WebSocket link
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'stats_update' && data.stats) {
          setStats(data.stats);
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-8"
            >
              <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight">
                AI-Powered Resume Screening for <span className="text-blue-600">MNC Companies</span>
              </h1>
              <p className="text-lg text-gray-600 leading-relaxed max-w-xl">
                Transform your hiring process with advanced AI that analyzes resumes, detects fraud, and ranks candidates based on semantic similarity to job requirements.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link 
                  to="/screen"
                  className="px-8 py-4 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group"
                >
                  Try AI Screening <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link to="/login" className="px-8 py-4 bg-white text-gray-700 border border-gray-200 rounded-lg font-bold text-lg hover:bg-gray-50 transition-all shadow-sm text-center">
                  Login / Register
                </Link>
              </div>

              <div className="flex gap-6 text-sm font-medium text-gray-500 pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-green-500" /> 95% Accuracy Rate
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-green-500" /> Fraud Detection
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-green-500" /> Instant Results
                </div>
              </div>
            </motion.div>

            {/* Hero Image / Dashboard Preview */}
            <motion.div 
               initial={{ opacity: 0, y: 50 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.8, delay: 0.2 }}
               className="relative"
            >
               <div className="relative rounded-xl overflow-hidden shadow-2xl border-4 border-white bg-white">
                  <img 
                    src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80" 
                    alt="Dashboard Preview" 
                    className="w-full h-auto object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/10 to-transparent pointer-events-none"></div>
               </div>
               
               <motion.div 
                 animate={{ y: [0, -10, 0] }}
                 transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                 className="absolute -bottom-6 -left-6 bg-white p-4 rounded-lg shadow-xl border border-gray-100 flex items-center gap-4"
               >
                 <div className="p-3 bg-green-100 rounded-full text-green-600">
                   <Shield size={24} />
                 </div>
                 <div>
                   <div className="text-xs text-gray-500">System Status</div>
                   <div className="text-sm font-bold text-gray-900">AI Model Active</div>
                 </div>
               </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Banner Section */}
      <section className="relative -mt-10 sm:-mt-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-20">
        <div className="bg-slate-900 rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none"></div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 relative z-10 text-center">
            {[
              { label: 'Candidates Registered', count: stats.total_candidates, color: 'from-blue-400 to-indigo-400', icon: <Users className="text-blue-400 w-5 h-5 mb-2 mx-auto" /> },
              { label: 'HR Professionals', count: stats.total_hrs, color: 'from-purple-400 to-pink-400', icon: <Award className="text-purple-400 w-5 h-5 mb-2 mx-auto" /> },
              { label: 'Jobs Posted', count: stats.total_jobs, color: 'from-emerald-400 to-teal-400', icon: <Briefcase className="text-emerald-400 w-5 h-5 mb-2 mx-auto" /> },
              { label: 'Candidates Selected', count: stats.total_selected, color: 'from-amber-400 to-orange-400', icon: <CheckCircle2 className="text-amber-400 w-5 h-5 mb-2 mx-auto" /> }
            ].map((stat, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={{ scale: 1.05 }}
                className="flex flex-col items-center p-4 rounded-xl transition-all"
              >
                {stat.icon}
                <span className={`text-2xl sm:text-4xl font-extrabold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent mb-1`}>
                  <AnimatedNumber value={stat.count} />
                </span>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">
                  {stat.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white" id="features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Advanced AI Features</h2>
            <p className="text-gray-600 max-w-2xl mx-auto mb-16">
              Our AI-powered system goes beyond keyword matching to understand context, detect fraud, and provide explainable results.
            </p>

            <div className="grid md:grid-cols-3 gap-8">
               {[
                 { icon: <FileText className="text-blue-600" size={32} />, title: "Semantic Analysis", desc: "Uses NLP and vector embeddings to understand resume content beyond simple keyword matching." },
                 { icon: <Shield className="text-green-600" size={32} />, title: "Fraud Detection", desc: "Automatically identifies suspicious or exaggerated information in resumes using advanced ML algorithms." },
                 { icon: <Zap className="text-purple-600" size={32} />, title: "Explainable Results", desc: "Provides detailed explanations for rankings, highlighting strengths, weaknesses, and skill gaps." }
               ].map((feature, idx) => (
                  <div key={idx} className="p-8 rounded-2xl border border-gray-100 hover:shadow-lg transition-shadow bg-slate-50 hover:bg-white text-center">
                     <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-6">
                        {feature.icon}
                     </div>
                     <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                     <p className="text-gray-600 text-sm leading-relaxed">{feature.desc}</p>
                  </div>
               ))}
            </div>
        </div>
      </section>

       {/* Pricing Section (Dummy) */}
       <section className="py-24 bg-slate-50" id="pricing">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple Pricing</h2>
            <div className="grid md:grid-cols-3 gap-8 mt-12">
                 {[
                     { name: 'Starter', price: '$49', features: ['100 Resumes/mo', 'Basic Analysis', 'Email Support'] },
                     { name: 'Professional', price: '$149', features: ['500 Resumes/mo', 'Deep Analysis', 'Priority Support', 'Fraud Detection'], active: true },
                     { name: 'Enterprise', price: 'Custom', features: ['Unlimited', 'Custom Models', '24/7 Support', 'API Access'] }
                 ].map((plan, idx) => (
                     <div key={idx} className={`p-8 rounded-2xl border ${plan.active ? 'border-blue-600 shadow-xl bg-white scale-105' : 'border-gray-100 bg-white hover:shadow-lg'} transition-all`}>
                         <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                         <div className="text-4xl font-bold text-gray-900 my-4">{plan.price}</div>
                         <ul className="space-y-3 mb-8 text-left">
                             {plan.features.map((f, i) => (
                                 <li key={i} className="flex items-center text-gray-600 text-sm">
                                     <CheckCircle2 size={16} className="text-green-500 mr-2" /> {f}
                                 </li>
                             ))}
                         </ul>
                         <button className={`w-full py-3 rounded-lg font-bold transition-colors ${plan.active ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}>
                             Get Started
                         </button>
                     </div>
                 ))}
            </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12">
         <div className="max-w-7xl mx-auto px-4 text-center">
            <p>© 2024 ResumeAI. All rights reserved.</p>
         </div>
      </footer>

      {/* Screening Modal */}
      <AnimatePresence>
        {showWidget && (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
               onClick={() => setShowWidget(false)}
            >
                <motion.div 
                   initial={{ scale: 0.9, opacity: 0 }}
                   animate={{ scale: 1, opacity: 1 }}
                   exit={{ scale: 0.9, opacity: 0 }}
                   className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                   onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                        <h2 className="text-xl font-bold text-gray-900">Try AI Screening Live</h2>
                        <button onClick={() => setShowWidget(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100">
                            <X size={24} />
                        </button>
                    </div>
                    <div className="p-6">
                        <ScreeningWidget />
                    </div>
                    <div className="p-6 bg-gray-50 text-center text-sm text-gray-500">
                        This is a live demo using Qwen-3 AI. <Link to="/dashboard" className="text-blue-600 font-bold hover:underline">Go to Dashboard</Link> for full features.
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

