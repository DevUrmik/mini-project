import React, { useState, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface DigitalTimePickerProps {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
}

export const DigitalTimePicker: React.FC<DigitalTimePickerProps> = ({
  hour,
  minute,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const formatTime = (h: number, m: number) =>
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  const [textValue, setTextValue] = useState(formatTime(hour, minute));
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setTextValue(formatTime(hour, minute));
  }, [hour, minute]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const commitText = (raw: string) => {
    const cleaned = raw.trim().replace('.', ':');
    const match = cleaned.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
    if (!match) {
      setTextValue(formatTime(hour, minute));
      return;
    }
    const h = Math.min(23, Math.max(0, Number(match[1])));
    const m = Math.min(59, Math.max(0, match[2] !== undefined ? Number(match[2]) : 0));
    onChange(h, m);
    setTextValue(formatTime(h, m));
  };

  const quickMinutes = [0, 15, 30, 45];

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <input
          type="text"
          inputMode="numeric"
          placeholder="HH:MM"
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onBlur={() => commitText(textValue)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitText(textValue);
              setOpen(false);
            }
          }}
          className="w-full bg-[#F7F7F4] border border-[#E5E7E1] rounded-md px-3 py-2 pr-9 text-xs text-[#252923] font-mono font-medium focus:outline-none focus:border-[#28634D] focus:bg-white transition-colors"
        />
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Open digital clock"
          className="absolute right-2 p-1 rounded text-[#777D78] hover:text-[#28634D] hover:bg-[#F0F2ED] transition-colors"
        >
          <Clock className="w-3.5 h-3.5" />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-64 bg-white border border-[#E5E7E1] rounded-lg shadow-lg p-3 space-y-2.5">
          {/* Digital Readout */}
          <div className="flex items-center justify-between bg-[#F7F7F4] border border-[#E5E7E1] rounded-md px-3 py-1.5">
            <span className="text-[11px] text-[#777D78]">Selected Time</span>
            <span className="font-mono text-sm font-bold text-[#28634D] tracking-wider">
              {formatTime(hour, minute)}
            </span>
          </div>

          {/* Quick Minute Shortcuts */}
          <div className="grid grid-cols-4 gap-1">
            {quickMinutes.map((qm) => (
              <button
                key={qm}
                type="button"
                onClick={() => onChange(hour, qm)}
                className={`py-1 rounded text-[11px] font-mono font-medium border transition-colors ${
                  minute === qm
                    ? 'bg-[#EBF2EE] border-[#28634D] text-[#28634D]'
                    : 'bg-[#F7F7F4] border-[#E5E7E1] text-[#252923] hover:bg-[#F0F2ED]'
                }`}
              >
                :{String(qm).padStart(2, '0')}
              </button>
            ))}
          </div>

          {/* Digital Hour & Minute Columns */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#777D78] mb-1 text-center">
                Hour
              </div>
              <div className="h-40 overflow-y-auto border border-[#E5E7E1] rounded-md p-1 space-y-0.5 bg-[#FAFAF8]">
                {Array.from({ length: 24 }, (_, h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => onChange(h, minute)}
                    className={`w-full py-1 rounded text-xs font-mono transition-colors ${
                      hour === h
                        ? 'bg-[#28634D] text-white font-semibold'
                        : 'text-[#252923] hover:bg-[#F0F2ED]'
                    }`}
                  >
                    {String(h).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#777D78] mb-1 text-center">
                Minute
              </div>
              <div className="h-40 overflow-y-auto border border-[#E5E7E1] rounded-md p-1 space-y-0.5 bg-[#FAFAF8]">
                {Array.from({ length: 60 }, (_, m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onChange(hour, m)}
                    className={`w-full py-1 rounded text-xs font-mono transition-colors ${
                      minute === m
                        ? 'bg-[#28634D] text-white font-semibold'
                        : 'text-[#252923] hover:bg-[#F0F2ED]'
                    }`}
                  >
                    {String(m).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full py-1.5 rounded bg-[#28634D] hover:bg-[#1F4E3C] text-white text-xs font-medium transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
};
