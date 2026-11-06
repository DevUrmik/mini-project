import React from 'react';
import {
  LayoutDashboard,
  MapPin,
  Cpu,
  Gauge,
  BarChart3,
  BookOpen,
  Info
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Overview Dashboard',
      subtitle: 'Key Metrics & Distribution',
      icon: LayoutDashboard,
      day: 'Day 1'
    },
    {
      id: 'hotspots',
      label: 'Hotspot Explorer',
      subtitle: 'K-Means & DBSCAN Maps',
      icon: MapPin,
      day: 'Day 2'
    },
    {
      id: 'models',
      label: 'ML Model Comparison',
      subtitle: 'LR vs DT vs Random Forest',
      icon: Cpu,
      day: 'Day 3-4'
    },
    {
      id: 'predictor',
      label: 'Severity Predictor',
      subtitle: 'Live Inference Pipeline',
      icon: Gauge,
      day: 'Day 5'
    },
    {
      id: 'analytics',
      label: 'Safety Intelligence',
      subtitle: 'Temporal & Weather Insights',
      icon: BarChart3,
      day: 'Day 6'
    },
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-[#090d18] flex flex-col justify-between shrink-0 min-h-[calc(100vh-4rem)]">
      <div className="p-4 space-y-1">
        <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Intelligence Modules
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all duration-150 group ${
                isActive
                  ? 'bg-sky-500/15 border border-sky-500/30 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              <div
                className={`p-2 rounded-lg transition ${
                  isActive
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className={`text-xs font-semibold truncate ${isActive ? 'text-sky-300' : 'text-slate-300'}`}>
                    {item.label}
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {item.day}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                  {item.subtitle}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Academic Viva Card */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/30">
        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-2 text-sky-400 font-semibold mb-1">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Python ML Lab Project</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Severity scale (1–4) indicates traffic delay duration, not injury severity. Haversine distance applied for spatial fidelity.
          </p>
        </div>
      </div>
    </aside>
  );
};

