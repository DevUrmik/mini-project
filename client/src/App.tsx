import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { HotspotExplorer } from './pages/HotspotExplorer';
import { ModelComparison } from './pages/ModelComparison';
import { SeverityPredictor } from './pages/SeverityPredictor';
import { Analytics } from './pages/Analytics';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  const renderActivePage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'hotspots':
        return <HotspotExplorer />;
      case 'models':
        return <ModelComparison />;
      case 'predictor':
        return <SeverityPredictor />;
      case 'analytics':
        return <Analytics />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1d] flex flex-col font-sans">
      <Navbar />
      <div className="flex-1 flex flex-col md:flex-row">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          {renderActivePage()}
        </main>
      </div>
    </div>
  );
};

export default App;

