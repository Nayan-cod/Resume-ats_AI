import React from 'react';

const AnalysisResult = ({ result }) => {
  if (!result) return null;

  const isSelected = result.decision === 'Selected';
  const scoreColor = result.score >= 80 ? 'text-green-500' : result.score >= 60 ? 'text-yellow-500' : 'text-red-500';
  const borderColor = isSelected ? 'border-green-500/50' : 'border-red-500/50';

  return (
    <div className={`glass-panel p-6 border-2 ${borderColor} animation-fade-in`}>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Analysis Result
          </h2>
          <div className={`mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${isSelected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {result.decision}
          </div>
        </div>
        <div className="text-center">
          <div className={`text-5xl font-bold ${scoreColor}`}>
            {result.score}
          </div>
          <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider">Match Score</div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Justification</h3>
        <ul className="space-y-2">
          {Array.isArray(result.justification) ? (
            result.justification.map((point, index) => (
              <li key={index} className="flex items-start">
                <span className="mr-3 mb-1 mt-1 block w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-gray-700">{point}</span>
              </li>
            ))
          ) : (
             <li className="flex items-start">
                <span className="mr-3 mb-1 mt-1 block w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-gray-700">{String(result.justification)}</span>
              </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default AnalysisResult;
