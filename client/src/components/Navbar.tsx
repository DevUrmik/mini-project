import React, { useEffect, useState } from 'react';
import { ShieldAlert, Activity, Database, CheckCircle2, AlertCircle } from 'lucide-react';
import { getHealth } from '../services/api';

export const Navbar: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [dataLoaded, setDataLoaded] = useState<boolean>(true);

  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        const res = await getHealth();
        setIsOnline(res.status === 'healthy');
        setDataLoaded(res.data_loaded);
      } catch (err) {
        setIsOnline(false);
      }
    };
    checkServerHealth();
    const interval = setInterval(checkServerHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 border-b border-slate-800 bg-[#0c1222]/90 backdrop-blur-md sticky top-0 z-50 px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-sky-500/20 to-indigo-500/20 rounded-lg border border-sky-500/30 text-sky-400">
          <ShieldAlert className="w-5 h-5 text-sky-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-white tracking-wide">
              ROAD SAFETY INTELLIGENCE PLATFORM
            </h1>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/60 font-semibold">
              v1.0 ML Lab
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Accident Hotspot Spatial Clustering & Severity Prediction System
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
          <Database className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-medium text-slate-300">US Accidents Dataset (Sobhan Moosavi)</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
          <div className="relative flex items-center justify-center">
            {isOnline ? (
              <>
                <span className="absolute w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-75"></span>
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              </>
            ) : (
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            )}
          </div>
          <span className="text-xs font-mono font-medium text-slate-300">
            {isOnline ? (dataLoaded ? 'API & Model Online' : 'Data Initializing') : 'Backend Offline'}
          </span>
        </div>
      </div>
    </header>
  );
};

