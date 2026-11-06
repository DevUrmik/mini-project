import React, { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { getHealth } from '../services/api';

interface NavbarProps {
  onToggleMobileMenu?: () => void;
  mobileMenuOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileMenu, mobileMenuOpen }) => {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        const res = await getHealth();
        setIsOnline(res.status === 'healthy');
      } catch (err) {
        setIsOnline(false);
      }
    };
    checkServerHealth();
    const interval = setInterval(checkServerHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-14 border-b border-[#E5E7E1] bg-white sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 rounded-md hover:bg-[#F0F2ED] text-[#252923] transition"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}

        <div className="flex items-baseline gap-2.5">
          <span className="font-semibold text-sm tracking-tight text-[#252923]">
            Road Safety Analytics
          </span>
          <span className="hidden sm:inline-block text-xs text-[#777D78] border-l border-[#E5E7E1] pl-2.5">
            US Accidents Dataset (2016–2023)
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-[#777D78]">
          <span
            className={`w-2 h-2 rounded-full ${
              isOnline ? 'bg-[#28634D]' : 'bg-[#D69A43]'
            }`}
          />
          <span className="hidden xs:inline">
            {isOnline ? 'API connected' : 'Connecting to API'}
          </span>
        </div>
      </div>
    </header>
  );
};
