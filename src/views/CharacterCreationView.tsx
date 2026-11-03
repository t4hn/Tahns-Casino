import React, { useState } from 'react';
import { Shield, Sparkles, Check, ArrowRight, Coins, Trophy } from 'lucide-react';
import { useCasino } from '../context/CasinoContext';
import { AVATAR_OPTIONS, DEFAULT_CHARACTER_NAME, STARTING_CREDITS } from '../data/initialData';
import { soundManager } from '../utils/sound';

export const CharacterCreationView: React.FC = () => {
  const { createCharacter } = useCasino();
  const [name, setName] = useState(DEFAULT_CHARACTER_NAME);
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0].url);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createCharacter(name.trim(), selectedAvatar);
  };

  return (
    <div className="min-h-screen bg-[#0a0d12] text-slate-100 flex flex-col justify-center items-center px-4 py-8 sm:py-12 relative overflow-hidden selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Ambient background atmosphere */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-emerald-950/30 via-transparent to-transparent blur-3xl opacity-70 pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-amber-950/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-lg rounded-2xl bg-[#0f141d] border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header / Brand Mark */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-slate-950 font-display font-bold text-2xl shadow-lg shadow-emerald-500/20 border border-emerald-400/40 mb-2">
            T
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-100 tracking-tight">
            Welcome to Tahn&apos;s Casino
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
            Enter our virtual gaming salon. Create your patron profile to claim your complimentary starting chips and begin your journey.
          </p>
        </div>

        {/* Character Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Character Name Input */}
          <div className="space-y-1.5">
            <label
              htmlFor="character-name"
              className="block text-xs uppercase tracking-wider text-slate-400 font-medium"
            >
              Character Name
            </label>
            <input
              id="character-name"
              type="text"
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter character name"
              required
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
            <p className="text-[11px] text-slate-500">
              You can personalize this name anytime in Settings.
            </p>
          </div>

          {/* Predefined Avatar Selection */}
          <div className="space-y-2">
            <label className="block text-xs uppercase tracking-wider text-slate-400 font-medium">
              Choose Your Patron Avatar
            </label>
            <div className="grid grid-cols-4 gap-3">
              {AVATAR_OPTIONS.map((avatar) => {
                const isSelected = selectedAvatar === avatar.url;
                return (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => {
                      soundManager.playClick();
                      setSelectedAvatar(avatar.url);
                    }}
                    className={`group relative aspect-square rounded-xl overflow-hidden border-2 transition-all p-0.5 focus:outline-none ${
                      isSelected
                        ? 'border-emerald-400 ring-2 ring-emerald-500/30 scale-102 shadow-md'
                        : 'border-slate-800 hover:border-slate-600 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={avatar.url}
                      alt={avatar.label}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover rounded-lg"
                    />
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-xs">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}
                    <span className="sr-only">{avatar.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clear Starting Package Box */}
          <div className="rounded-xl bg-gradient-to-r from-amber-950/20 via-slate-900 to-emerald-950/20 border border-amber-500/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-mono tracking-wider text-amber-300/90 font-medium flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-400" />
                <span>Patron Starter Package</span>
              </span>
              <span className="text-[11px] font-mono text-emerald-400">Level 1 (Bronze)</span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300">
                  <Coins size={18} />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Starting Virtual Credits</span>
                  <span className="font-mono text-base font-bold text-amber-200">
                    {STARTING_CREDITS.toLocaleString()} Credits
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">Starting XP</span>
                <span className="font-mono text-sm font-semibold text-emerald-400">
                  0 XP
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-1">
              <Shield size={12} className="text-emerald-500 shrink-0" />
              <span>Complimentary house chips. 100% virtual currency.</span>
            </div>
          </div>

          {/* Action CTA */}
          <button
            type="submit"
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all min-h-[48px] cursor-pointer"
          >
            <span>Create Character &amp; Enter Casino</span>
            <ArrowRight size={16} />
          </button>
        </form>

        <p className="text-center text-[10px] text-slate-500">
          Tahn&apos;s Casino is a virtual entertainment app. No real money gambling.
        </p>
      </div>
    </div>
  );
};
