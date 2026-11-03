import React from 'react';
import { CasinoProvider, useCasino } from './context/CasinoContext';
import { Navigation } from './components/Navigation';
import { HomeView } from './views/HomeView';
import { GamesView } from './views/GamesView';
import { AchievementsView } from './views/AchievementsView';
import { SettingsView } from './views/SettingsView';
import { CharacterCreationView } from './views/CharacterCreationView';
import { GameDetailView } from './views/GameDetailView';
import { DailyBonusModal } from './components/DailyBonusModal';

const AppContent: React.FC = () => {
  const { profile, activeGame, currentTab } = useCasino();

  // If no player profile exists yet, show First-Time Character Creation screen
  if (!profile) {
    return <CharacterCreationView />;
  }

  const renderView = () => {
    // If a dedicated game table is open, display its screen
    if (activeGame) {
      return <GameDetailView />;
    }

    switch (currentTab) {
      case 'home':
        return <HomeView />;
      case 'games':
        return <GamesView />;
      case 'achievements':
        return <AchievementsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <HomeView />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0d12] text-slate-100 flex flex-col relative selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Background Luxury Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[350px] bg-gradient-to-b from-emerald-950/20 via-transparent to-transparent blur-3xl opacity-60" />
        <div className="absolute top-1/4 -right-48 w-96 h-96 bg-amber-950/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Main Header & Navigation */}
      <Navigation />

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 lg:pb-14">
        {renderView()}
      </main>

      {/* Global Modals */}
      <DailyBonusModal />
    </div>
  );
};

export default function App() {
  return (
    <CasinoProvider>
      <AppContent />
    </CasinoProvider>
  );
}
