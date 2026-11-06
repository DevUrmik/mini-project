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
    <div className="bg-white border border-[#E5E7E1] rounded-lg p-4 shadow-subtle flex flex-col justify-between">
      <div>
        <span className="text-xs font-medium text-[#777D78] block">
          {label}
        </span>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-[#252923]">
            {value}
          </span>
          {detail && (
            <span className="text-xs text-[#28634D] font-medium">
              {detail}
            </span>
          )}
        </div>
      </div>
      {description && (
        <p className="mt-2 text-xs text-[#777D78] leading-normal border-t border-[#F0F2ED] pt-2">
          {description}
        </p>
      )}
    </div>
  );
};
