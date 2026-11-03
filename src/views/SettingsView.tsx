import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Music,
  Sliders,
  RotateCcw,
  User,
  Shield,
  FastForward,
  Check,
  Smartphone,
  Info,
} from 'lucide-react';
import { useCasino } from '../context/CasinoContext';
import { ConfirmResetModal } from '../components/ConfirmResetModal';
import { EditProfileModal } from '../components/EditProfileModal';
import { soundManager } from '../utils/sound';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    profile,
    levelInfo,
    fastForwardDailyBonus,
    isDailyBonusAvailable,
  } = useCasino();

  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [testNotification, setTestNotification] = useState<string | null>(null);

  if (!profile) return null;

  const handleTestSound = () => {
    soundManager.playBonusClaim();
    setTestNotification('Synthesized chime triggered successfully.');
    setTimeout(() => setTestNotification(null), 2500);
  };

  const handleFastForward = () => {
    fastForwardDailyBonus();
    setTestNotification('Daily bonus cooldown fast-forwarded! Ready to claim.');
    setTimeout(() => setTestNotification(null), 3000);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 max-w-3xl mx-auto">
      {/* ── Settings Header ── */}
      <div className="pt-2">
        <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono tracking-wider uppercase mb-1">
          <Sliders size={14} />
          <span>Patron Preferences</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-100">
          Casino Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Customize audio atmosphere, display layout, and manage patron credentials.
        </p>
      </div>

      {testNotification && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
          <Check size={16} className="text-emerald-400 shrink-0" />
          <span>{testNotification}</span>
        </div>
      )}

      {/* ── Patron Account Section ── */}
      <section className="rounded-2xl bg-[#0f141d] border border-slate-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs uppercase font-mono tracking-wider text-slate-400">
            <User size={15} className="text-emerald-400" />
            <span>Patron Credentials</span>
          </div>
          <span className="text-[11px] text-emerald-400 font-mono">
            {levelInfo.title}
          </span>
        </div>

        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
          <div className="flex items-center gap-3">
            <img
              src={profile.avatarUrl}
              alt={profile.name}
              referrerPolicy="no-referrer"
              className="h-12 w-12 rounded-xl object-cover border border-emerald-500/40"
            />
            <div>
              <p className="text-sm font-semibold text-slate-100">{profile.name}</p>
              <p className="text-xs text-slate-400 font-mono">
                Level {levelInfo.level} · {profile.xp.toLocaleString()} XP Total
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              soundManager.playClick();
              setIsEditProfileOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors min-h-[40px]"
          >
            Edit Profile
          </button>
        </div>
      </section>

      {/* ── Audio Settings Section ── */}
      <section className="rounded-2xl bg-[#0f141d] border border-slate-800 p-5 space-y-4">
        <div className="flex items-center gap-2 text-xs uppercase font-mono tracking-wider text-slate-400">
          <Volume2 size={15} className="text-emerald-400" />
          <span>Audio & Haptics</span>
        </div>

        <div className="divide-y divide-slate-800/80">
          {/* Sound Effects Toggle */}
          <div className="flex items-center justify-between py-3.5">
            <div>
              <p className="text-sm font-medium text-slate-200">Sound Effects</p>
              <p className="text-xs text-slate-400">
                Synthesized Web Audio chips, cards, coin chimes and level-up fanfares
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              {settings.soundEffects && (
                <button
                  onClick={handleTestSound}
                  className="px-2.5 py-1 text-[11px] font-mono text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 rounded-lg hover:bg-emerald-950/30 transition-colors"
                >
                  Test Sound
                </button>
              )}
              <button
                type="button"
                role="switch"
                aria-checked={settings.soundEffects}
                onClick={() => updateSettings({ soundEffects: !settings.soundEffects })}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.soundEffects ? 'bg-emerald-500' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    settings.soundEffects ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Music Toggle */}
          <div className="flex items-center justify-between py-3.5">
            <div>
              <p className="text-sm font-medium text-slate-200">Ambient Lounge Music</p>
              <p className="text-xs text-slate-400">
                Subtle low-key casino background melody
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={settings.music}
              onClick={() => updateSettings({ music: !settings.music })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.music ? 'bg-emerald-500' : 'bg-slate-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.music ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* ── Display Preferences ── */}
      <section className="rounded-2xl bg-[#0f141d] border border-slate-800 p-5 space-y-4">
        <div className="flex items-center gap-2 text-xs uppercase font-mono tracking-wider text-slate-400">
          <Smartphone size={15} className="text-emerald-400" />
          <span>Display Preferences</span>
        </div>

        <div className="divide-y divide-slate-800/80">
          {/* Currency Notation */}
          <div className="flex items-center justify-between py-3.5">
            <div>
              <p className="text-sm font-medium text-slate-200">Currency Notation</p>
              <p className="text-xs text-slate-400">
                Format credits as exact integers (25,000) or compact units (25k)
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
              <button
                onClick={() => updateSettings({ currencyNotation: 'standard' })}
                className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${
                  settings.currencyNotation === 'standard'
                    ? 'bg-emerald-600 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                25,000
              </button>
              <button
                onClick={() => updateSettings({ currencyNotation: 'abbreviated' })}
                className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${
                  settings.currencyNotation === 'abbreviated'
                    ? 'bg-emerald-600 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                25k
              </button>
            </div>
          </div>

          {/* Animations */}
          <div className="flex items-center justify-between py-3.5">
            <div>
              <p className="text-sm font-medium text-slate-200">Interface Animations</p>
              <p className="text-xs text-slate-400">
                Smooth transitions and card entrance feedback
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={settings.animations}
              onClick={() => updateSettings({ animations: !settings.animations })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.animations ? 'bg-emerald-500' : 'bg-slate-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.animations ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* ── Developer & Testing Tools ── */}
      <section className="rounded-2xl bg-[#0f141d] border border-slate-800 p-5 space-y-4">
        <div className="flex items-center gap-2 text-xs uppercase font-mono tracking-wider text-slate-400">
          <FastForward size={15} className="text-amber-400" />
          <span>Reviewer & Testing Utilities</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-200">Skip Daily Bonus 24h Cooldown</p>
            <p className="text-[11px] text-slate-400">
              Instantly refreshes the Daily Allowance so you can test bonus claims without waiting 24 hours.
            </p>
          </div>

          <button
            onClick={handleFastForward}
            className="px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors min-h-[40px] shrink-0"
          >
            <FastForward size={14} />
            <span>Fast-Forward Cooldown</span>
          </button>
        </div>
      </section>

      {/* ── Reset Game Progress Section ── */}
      <section className="rounded-2xl bg-red-950/10 border border-red-500/20 p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs uppercase font-mono tracking-wider text-red-400">
          <RotateCcw size={15} />
          <span>Reset Casino Progress</span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Restore default patron profile, reset all XP levels to Lv.1, clear achievement rewards, and replenish original credit bank.
        </p>

        <div className="pt-2">
          <button
            onClick={() => {
              soundManager.playClick();
              setIsResetOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-red-900/30 border border-red-500/40 hover:bg-red-900/50 text-red-300 text-xs font-semibold flex items-center gap-2 transition-colors min-h-[44px]"
          >
            <RotateCcw size={14} />
            <span>Reset All Progress...</span>
          </button>
        </div>
      </section>

      {/* ── Virtual Currency & Legal Disclaimer ── */}
      <div className="rounded-xl bg-slate-900/40 border border-slate-800/80 p-4 text-xs text-slate-400 space-y-1.5">
        <div className="flex items-center gap-2 text-slate-300 font-medium">
          <Shield size={14} className="text-emerald-400" />
          <span>Virtual Currency Notice</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Tahn&apos;s Casino is purely a recreational social casino simulation. All credits, balances, achievements, and rewards are 100% fictional virtual assets with no cash value. No deposits, withdrawals, or real-money wagering is supported or possible.
        </p>
      </div>

      <ConfirmResetModal isOpen={isResetOpen} onClose={() => setIsResetOpen(false)} />
      <EditProfileModal isOpen={isEditProfileOpen} onClose={() => setIsEditProfileOpen(false)} />
    </div>
  );
};
