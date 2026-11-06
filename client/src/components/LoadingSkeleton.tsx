import React from 'react';

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white border border-[#E5E7E1] rounded-lg p-4 animate-pulse space-y-3"
        >
          <div className="h-3 bg-[#F0F2ED] rounded w-2/5"></div>
          <div className="h-7 bg-[#F0F2ED] rounded w-1/2"></div>
          <div className="h-3 bg-[#F0F2ED] rounded w-4/5 pt-1"></div>
        </div>
      ))}
    </div>
  );
};

export const ChartSkeleton: React.FC<{ height?: string }> = ({ height = "h-72" }) => {
  return (
    <div className={`bg-white border border-[#E5E7E1] rounded-lg p-5 ${height} animate-pulse flex flex-col justify-between`}>
      <div className="h-4 bg-[#F0F2ED] rounded w-1/4"></div>
      <div className="h-44 bg-[#F0F2ED] rounded w-full my-4"></div>
      <div className="h-3 bg-[#F0F2ED] rounded w-1/3"></div>
    </div>
  );
};
