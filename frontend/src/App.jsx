import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CandidateDashboard from './pages/CandidateDashboard';
import Candidates from './pages/Candidates';
import JobPostings from './pages/JobPostings';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import PublicScreen from './pages/PublicScreen';
import Chatbot from './components/layout/Chatbot';

// Protected Route wrapper
function ProtectedRoute({ children, requiredRole }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// Dashboard router — shows different dashboard based on role
function DashboardRouter() {
  const { user } = useAuth();
  if (user?.role === 'hr') return <Dashboard />;
  return <CandidateDashboard />;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/screen" element={<PublicScreen />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      
      {/* Protected — Both roles */}
      <Route path="/dashboard" element={
        <ProtectedRoute><DashboardRouter /></ProtectedRoute>
      } />

      {/* Protected — HR Only */}
      <Route path="/jobs" element={
        <ProtectedRoute requiredRole="hr"><JobPostings /></ProtectedRoute>
      } />
      <Route path="/candidates" element={
        <ProtectedRoute requiredRole="hr"><Candidates /></ProtectedRoute>
      } />
      <Route path="/analytics" element={
        <ProtectedRoute requiredRole="hr"><Analytics /></ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute requiredRole="hr"><Settings /></ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Chatbot />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
