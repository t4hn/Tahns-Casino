import React, { useState } from 'react';
import { Gamepad2, Search, SlidersHorizontal, Lock, Check } from 'lucide-react';
import { useCasino } from '../context/CasinoContext';
import { GameCard } from '../components/GameCard';
import { GameCategory } from '../types/casino';
import { soundManager } from '../utils/sound';

export const GamesView: React.FC = () => {
  const { games } = useCasino();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = ['All', 'Slots', 'Cards', 'Table', 'Dice'];

  const filteredGames = games.filter((game) => {
    const matchesCategory =
      selectedCategory === 'All' || game.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ── Games Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-2">
        <div>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono tracking-wider uppercase mb-1">
            <Gamepad2 size={14} />
            <span>Casino Floor</span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span>{games.length} Floor Tables</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-100">
            Casino Games
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Select a table to inspect limits, payouts, and seat your patron avatar.
          </p>
        </div>
      </div>

      {/* ── Filters & Search ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 bg-[#0f141d] border border-slate-800 rounded-2xl">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  soundManager.playClick();
                  setSelectedCategory(cat);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap min-h-[40px] ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search floor games..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 min-h-[40px]"
          />
        </div>
      </div>

      {/* ── Game Grid ── */}
      {filteredGames.length === 0 ? (
        <div className="rounded-2xl bg-[#0f141d] border border-slate-800 p-12 text-center">
          <p className="text-sm text-slate-400">No casino games matched your filter criteria.</p>
          <button
            onClick={() => {
              setSelectedCategory('All');
              setSearchQuery('');
            }}
            className="mt-3 text-xs text-emerald-400 underline underline-offset-4"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredGames.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}

      {/* Floor Notice */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>Player Progression: Attain higher character XP to earn prestige titles and tier promotion bonuses.</span>
        <span className="font-mono text-emerald-400/90 text-[11px]">Virtual Table Gaming</span>
      </div>
    </div>
  );
};
