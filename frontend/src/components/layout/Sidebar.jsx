import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, FileText, Users, BarChart2, Settings, LogOut, Bot, Briefcase } from 'lucide-react';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const hrNav = [
    { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/dashboard' },
    { icon: <FileText size={20} />, label: 'Job Postings', path: '/jobs' },
    { icon: <Users size={20} />, label: 'Candidates', path: '/candidates' },
    { icon: <BarChart2 size={20} />, label: 'Analytics', path: '/analytics' },
    { icon: <Settings size={20} />, label: 'Settings', path: '/settings' },
  ];

  const candidateNav = [
    { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/dashboard' },
    { icon: <Briefcase size={20} />, label: 'Browse Jobs', path: '/dashboard' },
  ];

  const navItems = user?.role === 'hr' ? hrNav : candidateNav;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col h-screen fixed left-0 top-0">
      <div className="h-16 flex items-center px-6 border-b border-gray-50">
        <Bot className="text-blue-600 mr-2" size={24} />
        <span className="text-xl font-bold text-gray-900">ResumeAI</span>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            {item.icon}
            <span className="ml-3">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User info + Logout */}
      <div className="p-4 border-t border-gray-50">
        {user && (
          <div className="px-3 mb-3">
            <div className="text-sm font-medium text-gray-900 truncate">{user.name}</div>
            <div className="text-xs text-gray-500 truncate">{user.email}</div>
            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
              user.role === 'hr' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {user.role === 'hr' ? 'HR Manager' : 'Candidate'}
            </span>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-3 py-2.5 text-sm font-medium text-gray-600 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
        >
          <LogOut size={20} />
          <span className="ml-3">Log Out</span>
        </button>
      </div>
    </aside>
  );
}
