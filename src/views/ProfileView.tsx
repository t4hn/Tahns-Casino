import React, { useState, useEffect } from 'react';
import {
  User,
  ShieldCheck,
  Edit3,
  Check,
  X,
  TrendingUp,
  Coins,
  Flame,
  Gamepad2,
  Trophy,
  Award,
  Sparkles,
  Calendar,
  ChevronRight,
  Lock,
  CheckCircle2,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useCasino } from '../context/CasinoContext';
import { AVATAR_OPTIONS } from '../data/initialData';
import { getLevelRoadmap } from '../economy/wallet';
import { soundManager } from '../utils/sound';
import { CasinoRecordSection } from '../components/CasinoRecordSection';

export const ProfileView: React.FC = () => {
  const {
    profile,
    levelInfo,
    achievements,
    activities,
    isDailyBonusAvailable,
    openDailyBonusModal,
    updateProfile,
    setCurrentTab,
  } = useCasino();

  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(profile?.name || '');
  const [avatarInput, setAvatarInput] = useState(profile?.avatarUrl || AVATAR_OPTIONS[0].url);
  const [saveBanner, setSaveBanner] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (profile) {
      setNameInput(profile.name);
      setAvatarInput(profile.avatarUrl);
      setImageError(false);
    }
  }, [profile]);

  if (!profile) return null;

  const roadmap = getLevelRoadmap();
  const maxTierLevel = roadmap[roadmap.length - 1]?.level ?? 6;
  const isMaxTier = levelInfo.level >= maxTierLevel && levelInfo.progressPercent >= 100;
  const xpToNextLevel = Math.max(0, levelInfo.nextLevelTargetXp - levelInfo.currentLevelXp);

  const unlockedAchievements = achievements.filter((a) => a.unlocked);
  const claimedAchievements = achievements.filter((a) => a.claimed);
  const unclaimedReadyCount = unlockedAchievements.filter((a) => !a.claimed).length;
  const achievementProgressPct =
    achievements.length > 0
      ? Math.round((unlockedAchievements.length / achievements.length) * 100)
      : 0;

  const levelUpActivities = activities.filter((act) => act.type === 'level_up').slice(0, 4);

  const memberSince = new Date(profile.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const handleOpenEdit = () => {
    soundManager.playClick();
    setNameInput(profile.name);
    setAvatarInput(profile.avatarUrl);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    soundManager.playClick();
    setNameInput(profile.name);
    setAvatarInput(profile.avatarUrl);
    setIsEditing(false);
  };

  const handleSaveIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    updateProfile(trimmed, avatarInput);
    setIsEditing(false);
    setSaveBanner(true);
    setTimeout(() => setSaveBanner(false), 3000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl mx-auto">
      {/* ── Contextual Green Breadcrumb ── */}
      <div className="pt-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono tracking-wider uppercase">
          <User size={14} />
          <span>Patron Dossier</span>
          <span aria-hidden="true" className="text-slate-700">/</span>
          <span>Player Profile</span>
        </div>

        <button
          onClick={() => setCurrentTab('settings')}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800/60 transition-colors"
        >
          <SettingsIcon size={13} />
          <span>Settings</span>
        </button>
      </div>

      {saveBanner && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in"
        >
          <Check size={16} className="text-emerald-400 shrink-0" />
          <span>Patron identity updated successfully.</span>
        </div>
      )}

      {/* ── Section 1: Player Identity ── */}
      <section
        aria-label="Player Identity"
        className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#131922] to-[#0d1219] border border-slate-800/90 p-5 sm:p-6 shadow-xl"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-amber-500/5 blur-3xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative shrink-0">
              <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl overflow-hidden border-2 border-emerald-500/45 bg-[#0a0d12] shadow-lg shadow-emerald-950/30">
                {!imageError && (isEditing ? avatarInput : profile.avatarUrl) ? (
                  <img
                    src={isEditing ? avatarInput : profile.avatarUrl}
                    alt={profile.name}
                    referrerPolicy="no-referrer"
                    onError={() => setImageError(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#121c24] to-[#081017] text-emerald-400 font-display text-2xl font-bold">
                    {profile.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 flex h-6 items-center justify-center rounded-md bg-emerald-500 px-2 border border-emerald-300/60 shadow-sm text-[11px] font-mono font-bold text-slate-950">
                LV.{levelInfo.level}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold font-display text-slate-100 truncate tracking-tight">
                  {profile.name}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-400 mt-1">
                <span className="text-emerald-400 font-medium inline-flex items-center gap-1">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  <span>{levelInfo.title}</span>
                </span>
                <span aria-hidden="true" className="text-slate-700">·</span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <Calendar size={12} className="text-slate-500" />
                  <span>Member since {memberSince}</span>
                </span>
              </div>
              <p className="mt-1.5 text-[11px] font-mono text-slate-500">
                Patron ID: {profile.id}
              </p>
            </div>
          </div>

          {!isEditing && (
            <button
              type="button"
              onClick={handleOpenEdit}
              className="self-start sm:self-center px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500/40 text-xs font-semibold text-slate-200 flex items-center gap-2 transition-all min-h-[44px] shrink-0 cursor-pointer"
            >
              <Edit3 size={14} className="text-emerald-400" />
              <span>Edit Identity</span>
            </button>
          )}
        </div>

        {/* Inline Identity Editor (Display Name & Preset Avatars) */}
        {isEditing && (
          <form
            onSubmit={handleSaveIdentity}
            className="relative mt-6 pt-5 border-t border-slate-800/80 space-y-5 animate-in fade-in duration-200"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="profile-display-name"
                  className="block text-xs uppercase tracking-wider text-slate-400 font-medium mb-1.5"
                >
                  Display Name
                </label>
                <input
                  id="profile-display-name"
                  type="text"
                  value={nameInput}
                  maxLength={20}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter patron name"
                  required
                  className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors min-h-[44px]"
                />
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Up to 20 characters displayed across your dossier and floor tables.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="block text-xs uppercase tracking-wider text-slate-400 font-medium">
                    Patron Avatar
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {AVATAR_OPTIONS.find((a) => a.url === avatarInput)?.label || 'Custom Avatar'}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                  {AVATAR_OPTIONS.map((avatar) => {
                    const isSelected = avatarInput === avatar.url;
                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        aria-label={`Select ${avatar.label} avatar`}
                        aria-pressed={isSelected}
                        onClick={() => {
                          soundManager.playClick();
                          setAvatarInput(avatar.url);
                        }}
                        className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all p-0.5 cursor-pointer ${
                          isSelected
                            ? 'border-emerald-400 ring-2 ring-emerald-500/25 scale-[1.03]'
                            : 'border-slate-800 hover:border-slate-600 opacity-75 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={avatar.url}
                          alt={avatar.label}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover rounded-lg"
                        />
                        {isSelected && (
                          <div className="absolute top-1 right-1 h-4 w-4 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-xs">
                            <Check size={10} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl hover:bg-slate-800/70 transition-colors min-h-[44px] flex items-center gap-1.5 cursor-pointer"
              >
                <X size={14} />
                <span>Cancel</span>
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl shadow-sm shadow-emerald-500/20 transition-all min-h-[44px] flex items-center gap-1.5 cursor-pointer"
              >
                <Check size={14} strokeWidth={2.5} />
                <span>Save Identity</span>
              </button>
            </div>
          </form>
        )}
      </section>

      {/* ── Section 2: Player Statistics ── */}
      <section aria-label="Player Statistics" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={openDailyBonusModal}
          className="text-left rounded-2xl bg-[#0f141d] border border-slate-800 hover:border-amber-500/40 p-4 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
            <span>Credit Balance</span>
            <Coins size={15} className="text-amber-400" />
          </div>
          <p className="text-lg sm:text-xl font-bold font-mono tabular-nums text-amber-200">
            {profile.credits.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {isDailyBonusAvailable ? 'Daily allowance ready' : 'Virtual credits'}
          </p>
        </button>

        <div className="rounded-2xl bg-[#0f141d] border border-slate-800 p-4">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
            <span>Membership Tier</span>
            <ShieldCheck size={15} className="text-emerald-400" />
          </div>
          <p className="text-base sm:text-lg font-bold font-display text-slate-100 truncate">
            {levelInfo.title}
          </p>
          <p className="text-[11px] font-mono text-emerald-400 mt-1">
            Level {levelInfo.level} Status
          </p>
        </div>

        <div className="rounded-2xl bg-[#0f141d] border border-slate-800 p-4">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
            <span>Login Streak</span>
            <Flame size={15} className="text-amber-400" />
          </div>
          <p className="text-lg sm:text-xl font-bold font-mono tabular-nums text-slate-100">
            {profile.dailyStreak} {profile.dailyStreak === 1 ? 'Day' : 'Days'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {profile.dailyStreak > 0 ? 'Consecutive daily claims' : 'Claim daily bonus to start'}
          </p>
        </div>

        <div className="rounded-2xl bg-[#0f141d] border border-slate-800 p-4">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
            <span>Rounds Played</span>
            <Gamepad2 size={15} className="text-emerald-400" />
          </div>
          <p className="text-lg sm:text-xl font-bold font-mono tabular-nums text-slate-100">
            {profile.gamesPlayed.toLocaleString()}
          </p>
          <p className="text-[11px] font-mono text-slate-500 mt-1 truncate">
            +{profile.totalWinnings.toLocaleString()} / -{profile.totalLosses.toLocaleString()} Cr
          </p>
        </div>
      </section>

      {/* ── Section 3: XP Progression & Level Meter ── */}
      <section
        aria-label="Level Progression"
        className="rounded-2xl bg-[#0f141d] border border-slate-800 p-5 sm:p-6 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <TrendingUp size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold font-display text-slate-100">
                Patron Progression
              </h3>
              <p className="text-xs text-slate-400">
                Level {levelInfo.level} · {levelInfo.title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
              Total: {profile.xp.toLocaleString()} XP
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
              {Math.round(levelInfo.progressPercent)}%
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium">
              {isMaxTier
                ? 'Maximum Patron Tier Attained'
                : `${xpToNextLevel.toLocaleString()} XP needed for Level ${levelInfo.level + 1}`}
            </span>
            <span className="font-mono text-slate-400 tabular-nums">
              <span className="text-emerald-400 font-semibold">
                {levelInfo.currentLevelXp.toLocaleString()}
              </span>
              <span className="text-slate-600 mx-1">/</span>
              <span>{levelInfo.nextLevelTargetXp.toLocaleString()} XP</span>
            </span>
          </div>

          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800 p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400 transition-all duration-500 ease-out shadow-xs shadow-emerald-500/30"
              style={{ width: `${levelInfo.progressPercent}%` }}
            />
          </div>
        </div>

        {/* Tier Ladder & Promotion Rewards */}
        <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-mono tracking-wider text-slate-400">
              Tier Ladder &amp; Promotion Rewards
            </span>
            {levelInfo.level < maxTierLevel && (
              <span className="text-[11px] font-mono text-amber-300/90">
                Next Bonus: +{((levelInfo.level + 1) * 500).toLocaleString()} Cr
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {roadmap.map((tier) => {
              const isCurrent = tier.level === levelInfo.level;
              const isCompleted = tier.level < levelInfo.level;
              return (
                <div
                  key={tier.level}
                  className={`rounded-xl border p-3 flex items-center justify-between gap-2 transition-colors ${
                    isCurrent
                      ? 'bg-emerald-950/30 border-emerald-500/40'
                      : isCompleted
                      ? 'bg-slate-900/70 border-slate-800'
                      : 'bg-[#0b0f16] border-slate-800/70 opacity-75'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          isCurrent
                            ? 'bg-emerald-400 text-slate-950'
                            : isCompleted
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        LV.{tier.level}
                      </span>
                      <span className="text-xs font-semibold text-slate-200 truncate">
                        {tier.title}
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-slate-500 mt-1">
                      {tier.minXp.toLocaleString()} XP
                      {tier.promotionBonus > 0 ? ` · +${tier.promotionBonus.toLocaleString()} Cr` : ' · Entry Tier'}
                    </p>
                  </div>

                  <div className="shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 size={15} className="text-emerald-400" />
                    ) : isCurrent ? (
                      <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                        Active
                      </span>
                    ) : (
                      <Lock size={14} className="text-slate-600" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Section 4: Achievement Summary & Membership Info ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Achievement Summary */}
        <section
          aria-label="Achievement Summary"
          className="rounded-2xl bg-[#0f141d] border border-slate-800 p-5 flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs uppercase font-mono tracking-wider text-slate-400">
                <Trophy size={15} className="text-amber-400" />
                <span>Achievement Summary</span>
              </div>
              {unclaimedReadyCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-[10px] font-mono font-semibold text-amber-300">
                  {unclaimedReadyCount} Ready to Claim
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] uppercase font-mono text-slate-500 block">
                  Unlocked
                </span>
                <span className="text-base font-bold font-mono text-amber-300">
                  {unlockedAchievements.length} / {achievements.length}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] uppercase font-mono text-slate-500 block">
                  Rewards Claimed
                </span>
                <span className="text-base font-bold font-mono text-emerald-400">
                  {claimedAchievements.length} / {achievements.length}
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Completion</span>
                <span>{achievementProgressPct}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300"
                  style={{ width: `${achievementProgressPct}%` }}
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCurrentTab('achievements')}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/40 text-xs font-semibold text-slate-200 flex items-center justify-between transition-colors min-h-[44px] cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Award size={15} className="text-amber-400" />
              <span>View Patron Honors</span>
            </span>
            <ChevronRight size={15} className="text-slate-500" />
          </button>
        </section>

        {/* Membership Information & Recent Promotions */}
        <section
          aria-label="Membership Information"
          className="rounded-2xl bg-[#0f141d] border border-slate-800 p-5 flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs uppercase font-mono tracking-wider text-slate-400">
              <Sparkles size={15} className="text-emerald-400" />
              <span>Membership &amp; History</span>
            </div>

            <div className="divide-y divide-slate-800/80 text-xs">
              <div className="py-2 flex items-center justify-between">
                <span className="text-slate-400">Patron Standing</span>
                <span className="text-emerald-400 font-medium">{levelInfo.title}</span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-slate-400">Daily Allowance</span>
                <span className={isDailyBonusAvailable ? 'text-amber-300 font-mono font-semibold' : 'text-slate-400 font-mono'}>
                  {isDailyBonusAvailable ? 'Available Now' : 'On 24h Cooldown'}
                </span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-slate-400">Enrolled Date</span>
                <span className="text-slate-200 font-mono">{memberSince}</span>
              </div>
            </div>

            {levelUpActivities.length > 0 && (
              <div className="pt-2 space-y-1.5">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block">
                  Recent Level Promotions
                </span>
                {levelUpActivities.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-900/70 border border-slate-800/80"
                  >
                    <span className="text-slate-200 truncate">{act.title}</span>
                    {act.creditsDelta ? (
                      <span className="font-mono text-emerald-400 shrink-0 ml-2">
                        +{act.creditsDelta.toLocaleString()} Cr
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={openDailyBonusModal}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500/15 to-amber-400/10 hover:from-amber-500/25 hover:to-amber-400/15 border border-amber-500/30 text-xs font-semibold text-amber-300 flex items-center justify-between transition-colors min-h-[44px] cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Sparkles size={15} className="text-amber-400" />
              <span>Daily Patron Allowance</span>
            </span>
            <span className="font-mono text-[11px]">
              {isDailyBonusAvailable ? 'Claim Ready' : 'View Status'}
            </span>
          </button>
        </section>
      </div>

      {/* ── Section 5: Casino Record (Stats & Round History) ── */}
      <CasinoRecordSection />
    </div>
  );
};
