import React, { useState } from 'react';
import {
  Home,
  Gamepad2,
  Trophy,
  Settings as SettingsIcon,
  Menu,
  X,
  Sparkles,
  Volume2,
  VolumeX,
  Shield,
  ChevronRight,
  User,
} from 'lucide-react';
import { useCasino } from '../context/CasinoContext';
import { NavTab } from '../types/casino';
import { CurrencyDisplay } from './CurrencyDisplay';
import { BrandMark } from './BrandMark';
import { soundManager } from '../utils/sound';

export const Navigation: React.FC = () => {
  const {
    currentTab,
    setCurrentTab,
    profile,
    levelInfo,
    isDailyBonusAvailable,
    openDailyBonusModal,
    settings,
    updateSettings,
  } = useCasino();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const fullNavItems: {
    id: NavTab;
    label: string;
    icon: React.FC<{ size?: number; className?: string }>;
  }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'games', label: 'Games', icon: Gamepad2 },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'achievements', label: 'Achievements', icon: Trophy },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const handleTabClick = (tab: NavTab) => {
    setCurrentTab(tab);
    setIsDrawerOpen(false);
  };

  const toggleSound = () => {
    updateSettings({ soundEffects: !settings.soundEffects });
  };

  const levelProgressWidth = `${Math.max(4, Math.min(100, levelInfo.progressPercent))}%`;

  return (
    <>
      {/* ── Desktop & Mobile Top Header ── */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#0a0d12]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand Zone (Left) */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                soundManager.playClick();
                setIsDrawerOpen(true);
              }}
              title="Open casino navigation menu"
              aria-label="Open menu drawer"
              className="lg:hidden min-h-[44px] min-w-[44px] -ml-2 text-slate-400 hover:text-white flex items-center justify-center rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              <Menu size={22} />
            </button>

            <button
              onClick={() => handleTabClick('home')}
              aria-label="Tahn's Casino Home"
              className="flex items-center gap-2.5 text-left focus:outline-none cursor-pointer"
            >
              <BrandMark size="md" />
              <div className="hidden lg:block">
                <span className="font-display font-bold text-base sm:text-lg tracking-wider text-slate-100 whitespace-nowrap block leading-tight">
                  Tahn&apos;s Casino
                </span>
                <span className="text-[10px] text-emerald-400/90 font-mono tracking-widest uppercase block">
                  Virtual Gaming Salon
                </span>
              </div>
            </button>
          </div>

          {/* Desktop Nav Links (Center Zone) */}
          <nav
            aria-label="Desktop Navigation"
            className="hidden lg:flex items-center gap-1 bg-[#0f141d] p-1 rounded-xl border border-slate-800"
          >
            {fullNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[36px] whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-300 shadow-xs border border-emerald-500/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                  {item.id === 'profile' && (
                    <span
                      className={`ml-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold leading-none ${
                        isActive
                          ? 'bg-emerald-400 text-slate-950'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      LV.{levelInfo.level}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Zone: Currency & Daily Bonus */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* On mobile: compact amount with coin icon; on desktop: full label */}
            <div className="block sm:hidden">
              <CurrencyDisplay
                size="sm"
                showLabel={false}
                onClick={openDailyBonusModal}
                className="cursor-pointer"
              />
            </div>
            <div className="hidden sm:block">
              <CurrencyDisplay
                size="md"
                showLabel={true}
                onClick={openDailyBonusModal}
                className="cursor-pointer"
              />
            </div>

            {isDailyBonusAvailable && (
              <button
                onClick={openDailyBonusModal}
                title="Claim complimentary daily allowance"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-semibold text-xs shadow-sm shadow-amber-500/20 active:scale-[0.98] transition-all min-h-[36px] cursor-pointer"
              >
                <Sparkles size={13} />
                <span>Daily Bonus</span>
              </button>
            )}

            <button
              onClick={toggleSound}
              title={settings.soundEffects ? 'Sound On' : 'Sound Off'}
              aria-label="Toggle sound effects"
              className="hidden lg:flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              {settings.soundEffects ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile Fixed Bottom Navigation Bar ── */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0d12]/95 backdrop-blur-md border-t border-slate-800/90 shadow-2xl pb-safe"
      >
        <div className="grid grid-cols-4 items-center h-16 max-w-lg mx-auto px-2">
          {/* 1. Home */}
          <button
            onClick={() => handleTabClick('home')}
            className={`flex flex-col items-center justify-center min-h-[48px] w-full py-1 transition-all cursor-pointer ${
              currentTab === 'home'
                ? 'text-emerald-400 font-semibold'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <div className="relative">
              <Home
                size={20}
                className={currentTab === 'home' ? 'text-emerald-400 scale-105 transition-transform' : ''}
              />
              {currentTab === 'home' && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-emerald-400" />
              )}
            </div>
            <span className="text-[11px] tracking-tight mt-1 whitespace-nowrap">Home</span>
          </button>

          {/* 2. Games */}
          <button
            onClick={() => handleTabClick('games')}
            className={`flex flex-col items-center justify-center min-h-[48px] w-full py-1 transition-all cursor-pointer ${
              currentTab === 'games'
                ? 'text-emerald-400 font-semibold'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <div className="relative">
              <Gamepad2
                size={20}
                className={currentTab === 'games' ? 'text-emerald-400 scale-105 transition-transform' : ''}
              />
              {currentTab === 'games' && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-emerald-400" />
              )}
            </div>
            <span className="text-[11px] tracking-tight mt-1 whitespace-nowrap">Games</span>
          </button>

          {/* 3. Player Level / Profile */}
          <button
            onClick={() => handleTabClick('profile')}
            aria-label={`Player Profile, Level ${levelInfo.level}`}
            className={`flex flex-col items-center justify-center min-h-[48px] w-full py-1 transition-all cursor-pointer ${
              currentTab === 'profile'
                ? 'text-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div
              className={`px-2.5 py-0.5 rounded-md font-mono font-bold text-[11px] leading-tight tracking-wider border transition-all ${
                currentTab === 'profile'
                  ? 'bg-emerald-400 text-slate-950 border-emerald-300 shadow-sm shadow-emerald-500/30'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
              }`}
            >
              LV. {levelInfo.level}
            </div>
            <div
              aria-hidden="true"
              className="mt-1 h-1 w-11 rounded-full bg-slate-800/90 border border-slate-700/60 overflow-hidden"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-500"
                style={{ width: levelProgressWidth }}
              />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 leading-none whitespace-nowrap">
              Profile
            </span>
          </button>

          {/* 4. Achievements */}
          <button
            onClick={() => handleTabClick('achievements')}
            className={`flex flex-col items-center justify-center min-h-[48px] w-full py-1 transition-all cursor-pointer ${
              currentTab === 'achievements'
                ? 'text-emerald-400 font-semibold'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <div className="relative">
              <Trophy
                size={20}
                className={
                  currentTab === 'achievements' ? 'text-emerald-400 scale-105 transition-transform' : ''
                }
              />
              {currentTab === 'achievements' && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-emerald-400" />
              )}
            </div>
            <span className="text-[11px] tracking-tight mt-1 whitespace-nowrap">Achievements</span>
          </button>
        </div>
      </nav>

      {/* ── Slide-Out Navigation Drawer ── */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            onClick={() => {
              soundManager.playClick();
              setIsDrawerOpen(false);
            }}
            className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
          />

          {/* Drawer Content */}
          <aside className="relative w-72 max-w-[85vw] bg-[#0c1118] border-r border-slate-800 p-5 flex flex-col justify-between shadow-2xl z-10 animate-in slide-in-from-left duration-250">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <BrandMark size="sm" />
                  <div>
                    <h3 className="font-display font-bold text-sm text-slate-100">Tahn&apos;s Casino</h3>
                    <span className="text-[10px] text-slate-400 font-mono">Virtual Patron Suite</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    soundManager.playClick();
                    setIsDrawerOpen(false);
                  }}
                  aria-label="Close navigation drawer"
                  className="min-h-[44px] min-w-[44px] -mr-2 text-slate-400 hover:text-white flex items-center justify-center rounded-lg cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Profile Summary Card in Drawer (links to Player Profile) */}
              {profile && (
                <button
                  type="button"
                  onClick={() => handleTabClick('profile')}
                  className="mt-4 w-full text-left p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={profile.avatarUrl}
                      alt={profile.name}
                      referrerPolicy="no-referrer"
                      className="h-10 w-10 rounded-lg object-cover border border-emerald-500/40"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-100 truncate">{profile.name}</p>
                      <p className="text-[11px] text-emerald-400 font-medium">
                        Lv.{levelInfo.level} · {levelInfo.title}
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-slate-500 shrink-0" />
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Balance</span>
                    <CurrencyDisplay size="sm" showLabel={false} />
                  </div>
                </button>
              )}

              {/* Navigation Links (includes Player Profile & Settings) */}
              <div className="mt-5 space-y-1">
                <p className="text-[10px] uppercase font-mono tracking-widest text-slate-400 px-3 mb-2 font-medium">
                  Navigation
                </p>
                {fullNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  const displayLabel = item.id === 'profile' ? 'Player Profile' : item.label;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTabClick(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all min-h-[44px] cursor-pointer ${
                        isActive
                          ? 'bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/30'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={16} className={isActive ? 'text-emerald-400' : 'text-slate-400'} />
                        <span>{displayLabel}</span>
                      </div>
                      <ChevronRight size={14} className="text-slate-600" />
                    </button>
                  );
                })}
              </div>

              {/* Quick Daily Bonus in Drawer */}
              <div className="mt-5 px-1">
                <button
                  onClick={() => {
                    soundManager.playClick();
                    setIsDrawerOpen(false);
                    openDailyBonusModal();
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-400/10 border border-amber-500/30 text-amber-300 hover:text-amber-200 text-xs font-medium flex items-center justify-between transition-colors min-h-[44px] cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles size={14} className="text-amber-400" />
                    <span>Daily Bonus</span>
                  </span>
                  <span className="text-[10px] font-mono text-amber-400/80">
                    {isDailyBonusAvailable ? 'Claim Ready' : 'Cooldown'}
                  </span>
                </button>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="pt-4 border-t border-slate-800/80 space-y-3">
              <button
                onClick={toggleSound}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/60 text-xs text-slate-300 hover:text-white min-h-[40px] cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  {settings.soundEffects ? <Volume2 size={14} /> : <VolumeX size={14} />}
                  <span>Sound Effects</span>
                </span>
                <span className="font-mono text-[11px] text-emerald-400">
                  {settings.soundEffects ? 'ON' : 'OFF'}
                </span>
              </button>

              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 px-1">
                <Shield size={12} className="text-emerald-500 shrink-0" />
                <span>Virtual currency only · Zero real money</span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
