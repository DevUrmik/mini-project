import React from 'react';
import {
  LayoutDashboard,
  Map,
  BarChart2,
  Sliders
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  mobileMenuOpen?: boolean;
  onCloseMobileMenu?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  mobileMenuOpen,
  onCloseMobileMenu,
}) => {
  const navItems = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
    },
    {
      id: 'map',
      label: 'Hotspot Explorer',
      icon: Map,
    },
    {
      id: 'models',
      label: 'ML Model Analysis',
      icon: BarChart2,
    },
    {
      id: 'predict',
      label: 'Severity Prediction',
      icon: Sliders,
    },
  ];

  const handleSelect = (id: string) => {
    setActiveTab(id);
    if (onCloseMobileMenu) {
      onCloseMobileMenu();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={onCloseMobileMenu}
          className="fixed inset-0 bg-black/20 z-20 md:hidden transition-opacity"
        />
      )}

      <aside
        className={`fixed md:static top-14 bottom-0 left-0 w-60 bg-white border-r border-[#E5E7E1] z-30 flex flex-col justify-between transition-transform duration-200 ease-in-out shrink-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-3 space-y-1">
          <div className="px-3 pt-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-[#777D78]">
            Navigation
          </div>

          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#EBF2EE] text-[#28634D] font-semibold'
                      : 'text-[#777D78] hover:text-[#252923] hover:bg-[#F0F2ED]'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[#28634D]' : 'text-[#777D78]'
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-[#E5E7E1]">
          <div className="text-[11px] text-[#777D78] leading-relaxed">
            Severity scores (1–4) reflect recorded traffic delay duration, not injury severity.
          </div>
        </div>
      </aside>
    </>
  );
};
