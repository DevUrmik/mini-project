import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { HotspotExplorer } from './pages/HotspotExplorer';
import { ModelComparison } from './pages/ModelComparison';
import { SeverityPredictor } from './pages/SeverityPredictor';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const renderActivePage = () => {
    switch (activeTab) {
      case 'overview':
        return <Dashboard />;
      case 'map':
        return <HotspotExplorer />;
      case 'models':
        return <ModelComparison />;
      case 'predict':
        return <SeverityPredictor />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F4] text-[#252923] flex flex-col font-sans antialiased selection:bg-[#28634D]/15 selection:text-[#28634D]">
      <Navbar
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
      />
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          mobileMenuOpen={mobileMenuOpen}
          onCloseMobileMenu={() => setMobileMenuOpen(false)}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          {renderActivePage()}
        </main>
      </div>
    </div>
  );
};

export default App;
