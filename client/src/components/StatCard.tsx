import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  description?: string;
  detail?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  description,
  detail
}) => {
  return (
    <div className="bg-white border border-[#E5E7E1] rounded-md px-4 py-3.5 shadow-subtle">
      <span className="text-xs font-medium text-[#777D78] block">
        {label}
      </span>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tracking-tight text-[#252923] tabular-nums">
          {value}
        </span>
        {detail && (
          <span className="text-xs text-[#777D78] font-medium">
            {detail}
          </span>
        )}
      </div>
      {description && (
        <p className="mt-1 text-[11px] text-[#777D78]">
          {description}
        </p>
      )}
    </div>
  );
};
