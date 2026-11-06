import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorBannerProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message = "Unable to reach the server. Please check your connection.",
  onRetry
}) => {
  return (
    <div className="bg-[#FDFBF7] border border-[#D69A43]/40 rounded-lg p-4 text-[#252923] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-subtle">
      <div className="flex items-center gap-2.5">
        <AlertCircle className="w-4 h-4 text-[#D69A43] shrink-0" />
        <div>
          <p className="text-xs font-medium text-[#252923]">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white border border-[#E5E7E1] hover:bg-[#F0F2ED] text-[#252923] transition shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#777D78]" />
          Retry
        </button>
      )}
    </div>
  );
};
