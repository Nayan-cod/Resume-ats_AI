import React from 'react';
import { Link } from 'react-router-dom';
import { Bot, Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-100 relative z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                <Bot size={20} />
              </div>
              <span className="text-xl font-bold text-gray-900">ResumeAI</span>
            </Link>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-gray-600 hover:text-blue-600 transition-colors">Home</Link>
            <Link to="/screen" className="text-gray-600 hover:text-blue-600 transition-colors">AI Screener</Link>
            <a href="#features" className="text-gray-600 hover:text-blue-600 transition-colors">Features</a>
            <a href="#pricing" className="text-gray-600 hover:text-blue-600 transition-colors">Pricing</a>
            
            <div className="flex items-center space-x-4">
              <Link to="/login" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">Login</Link>
               <Link 
                to="/screen" 
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium transition-colors shadow-sm hover:shadow-md"
              >
                Try AI Screening
              </Link>
            </div>
          </div>

          <div className="md:hidden flex items-center">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-600 hover:text-gray-900 p-2"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden absolute w-full bg-white border-b border-gray-100 shadow-lg">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link to="/" className="block px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md">Home</Link>
            <Link to="/screen" className="block px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md">AI Screener</Link>
            <a href="#features" className="block px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md">Features</a>
            <Link to="/login" className="block px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md">Login</Link>
            <Link to="/screen" className="block w-full text-center mt-4 bg-blue-600 text-white px-5 py-3 rounded-lg font-medium">
              Try AI Screening
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
