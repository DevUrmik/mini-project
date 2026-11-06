import React from 'react';

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-[#111827] border border-slate-800 rounded-xl p-5 animate-pulse"
        >
          <div className="flex justify-between items-center mb-4">
            <div className="h-3 bg-slate-700/60 rounded w-1/3"></div>
            <div className="w-8 h-8 rounded-lg bg-slate-800"></div>
          </div>
          <div className="h-7 bg-slate-700/80 rounded w-1/2 mb-3"></div>
          <div className="h-3 bg-slate-800 rounded w-3/4"></div>
        </div>
      ))}
    </div>
  );
};

export const ChartSkeleton: React.FC<{ height?: string }> = ({ height = "h-80" }) => {
  return (
    <div className={`bg-[#111827] border border-slate-800 rounded-xl p-6 ${height} animate-pulse flex flex-col justify-between`}>
      <div className="h-4 bg-slate-700/60 rounded w-1/4 mb-4"></div>
      <div className="h-48 bg-slate-800/40 rounded w-full"></div>
      <div className="h-3 bg-slate-800 rounded w-1/2 mt-4"></div>
    </div>
  );
};

