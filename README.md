# Tahn's Casino

A virtual casino web application featuring playable casino mini-games, a unified virtual credit economy, patron profiles, XP and membership tier progression, daily rewards, achievements, and persistent client-side storage.

> **Disclaimer:** Tahn's Casino is a 100% virtual entertainment application using virtual casino credits. No real-money gambling, deposits, or withdrawals exist.

---

## Project Overview

Tahn's Casino is designed as a cohesive, mobile-friendly virtual gaming salon built around a shared economy and progression layer:

- Create a patron identity with a customizable display name and avatar.
- Start with **1,000 complimentary virtual credits** and progress across **6 VIP membership tiers**.
- Launch any open casino game from the floor catalog using a single shared bankroll, unified XP engine, and crash-safe escrow settlement system.
- Track lifetime statistics, recent activity, honors/achievements, and persistent European Roulette and Keno history.

---

## Current Game Catalogue

All games currently implemented and registered as open playable modules (`Table Open`) in `src/games/registry.ts`:

| Game | ID | Category | RTP / Payout Rate | Table Limits (Credits) | Volatility | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Blackjack** | `blackjack` | Cards | `99.5%` | `25 – 1,000` | Low | Table Open |
| **Video Poker Deluxe** | `video-poker` | Cards | `99.2%` | `20 – 1,000` | Medium | Table Open |
| **Roulette (European)** | `roulette` | Table | `97.3%` | `10 – 1,500` | Medium | Table Open |
| **Keno** | `keno` | Table | `94.0%` (avg `1–10` spots) | `10 – 1,000` | High | Table Open |
| **Dice** | `dice` | Dice | `83.3% – 97.2%` | `10 – 800` | Medium | Table Open |
| **Lucky Slots** | `lucky-slots` | Slots | Analytical config RTP (`~91.2%`) | `10 – 500` | Medium | Table Open |
| **Nova Voyager** | `nova-voyager` | Slots | Analytical config RTP (`~94.3%`) | `10 – 200` | High | Table Open |

> **Floor Catalog Note:** `High-Roller Baccarat` (`baccarat-vip`) appears on the casino floor catalog as **Coming Soon** (`hasPlayableModule: false`) and opens a preview showcase rather than a playable table.

---

## Core Features

All features listed below are verified in the application source code (`src/economy/`, `src/context/`, `src/views/`, `src/components/`, `src/data/`):

- **Virtual Credit Economy (`src/economy/wallet.ts`)**: Pure wallet engine enforcing strict non-negative balances, overdraft rejection, atomic round settlement (`newCredits = credits - bet + payout`), net win/loss accounting (`net = payout - bet`), and two-phase escrow settlement (`placeBet` -> `resolveRound`).
- **Patron Profiles (`src/views/ProfileView.tsx`, `src/components/EditProfileModal.tsx`)**: Dedicated profile view displaying patron identity, avatar (6 preset portraits), membership since date, current tier progress, achievement completion, promotion history, inline profile editing, and career progress reset.
- **XP & Level Progression (`src/economy/wallet.ts`)**: Rounds award `10` base XP plus a `+10` XP bonus on wins (`20 XP` total for a winning round). Level and title are always derived dynamically from total XP rather than stored separately.
- **Membership Tiers (`getLevelRoadmap`)**: Six progression tiers with automatic credit promotion bonuses (`500 × newLevel`) when leveling up:
  1. **Level 1**: Bronze Patron (`0 – 500 XP`)
  2. **Level 2**: Silver Cardholder (`500 – 1,200 XP`, `+1,000 Cr`)
  3. **Level 3**: Gold Member (`1,200 – 2,200 XP`, `+1,500 Cr`)
  4. **Level 4**: Platinum Roller (`2,200 – 3,500 XP`, `+2,000 Cr`)
  5. **Level 5**: Black Tier Elite (`3,500 – 5,200 XP`, `+2,500 Cr`)
  6. **Level 6**: Casino Royalty (`5,200 – 7,500 XP`, `+3,000 Cr`)
- **Daily Rewards & Login Streaks (`src/components/DailyBonusModal.tsx`, `wallet.ts`)**: Claims **+1,000 Credits** and **+200 XP** once every 24 hours with a live countdown and consecutive daily streak tracking (preserved within a 36-hour claim window).
- **Achievement System (`src/data/initialData.ts`, `src/views/AchievementsView.tsx`)**: Six tracked milestones (*First Steps*, *Place Your Bet*, *Dedicated Patron*, *Rising Star*, *Floor Explorer*, and *High Roller*) with filter tabs (`all` / `unlocked` / `locked`) and claimable credit and XP rewards.
- **Career & Game Statistics**: Tracks `gamesPlayed`, `totalWinnings` (sum of positive nets), `totalLosses` (sum of negative nets), an interactive 20-item recent activity feed on the Home Lounge, persistent 15-spin history in European Roulette, and persistent 15-round history and session stats in Keno.
- **Persistent Player Data & Crash Recovery (`src/context/CasinoContext.tsx`)**: Persists patron profile, achievements, activities, settings, visited games, pending escrow rounds, European Roulette history, and Keno history/stats to `localStorage` under the `tahns_casino_v2_*` key namespace. Interrupted rounds in flight are automatically recovered on startup without double-crediting.
- **Responsive Mobile Interface & Audio/Visual Controls (`src/components/Navigation.tsx`, `src/utils/sound.ts`)**: Persistent global header (brand home link, live wallet balance, daily bonus trigger), desktop navigation bar, mobile slide-out hamburger drawer, and fixed mobile bottom tab bar (`Home`, `Games`, `Profile` with live level badge, `Achievements`) provide seamless navigation across views and back to the Casino Floor from any active game without redundant in-game back bars. Includes synthesized Web Audio API sound effects, animation toggle (`settings.animations`), compact view, and currency formatting options.

---

## Game Mechanics

### Blackjack (`src/games/blackjack/`)
- Standard shuffled 52-card single deck using cryptographically secure shared RNG.
- Player actions: **Hit**, **Stand**, **Double Down** (on initial 2-card hands when balance allows), and **Insurance** (when dealer's upcard is an Ace).
- Dealer hits below 17 and stands on all 17s; natural Blackjack pays **3:2**, standard wins pay **1:1**, Insurance pays **2:1**.

### Video Poker Deluxe (`src/games/video-poker/`)
- Standard 52-card **9/6 Jacks or Better** 5-card draw rules.
- Deal 5 cards, toggle **HOLD** on any combination of cards, draw replacements for unheld slots, and evaluate the final 5-card poker hand against the full paytable (up to **800:1** on Royal Flush when qualifying / **250:1** standard).

### European Roulette (`src/games/roulette/`)
- **European Single-Zero Format**: Authentic 37-pocket wheel (`0` green, 18 red, 18 black) in standard European wheel order (`0, 32, 15, 19, 4, ...`).
- **Inside & Outside Betting**: Interactive emerald felt supporting **Straight Up (`35:1`)**, **Split (`17:1`, including `0-1`/`0-2`/`0-3`)**, **Street (`11:1`, including zero trios `0-1-2`/`0-2-3`)**, **Corner (`8:1`)**, **Six Line (`5:1`)**, **Dozen (`2:1`)**, **Column (`2:1`)**, and even-money **Red/Black**, **Even/Odd**, and **Low 1–18 / High 19–36 (`1:1`)**. Green `0` loses standard outside bets while honoring inside zero bets.
- **Virtual Chip Denominations**: `[5, 10, 25, 50, 100, 500]` Credits with chip stacking, individual spot removal (`Remove` mode, right-click, or bet tag `×`), `Clear`, and `Repeat` last round bets.
- **Standard Payouts**: Winning bets return original stake plus profit odds (`gross = wager * (1 + odds)`).
- **Animated SVG Wheel**: Precomputes the cryptographic RNG pocket outcome before animation begins, rotating the 37-pocket rotor counter-clockwise while the ivory ball orbits clockwise and drops into the winning pocket (`animations` and `prefers-reduced-motion` aware).
- **Mobile Touch & Scroll UX**: Compact mobile wheel sizing, horizontal scroll table with left/right edge indicators and preserved scroll offset during multi-bet placement, plus directional non-overlapping inside touch targets and dedicated inside bet mode filters (`Table (All)`, `Straight`, `Split`, `Street`, `Corner`, `Six Line`).
- **Persistent Recent-Results History**: Persists the **15 most recent** settled spins (`tahns_casino_v2_roulette_history`) with pocket number, color, wager, payout, net, round ID, and timestamp, deduplicated against remount or recovery duplicates and displayed strictly for informational reference.

### Dice (`src/games/dice/`)
- Two 6-sided virtual dice rolled with unbiased crypto RNG.
- Three bet markets: **Low (2–6)** at `1.8x` payout, **High (8–12)** at `1.8x`, **Lucky 7** at `5x`, and **Doubles** at `5.2x`.

### Keno (`src/games/keno/`)
- **80-Number Uniform Draw Engine**: Select `1–10` unique numbers on an `8 × 10` board (`1–80`); each round draws exactly `20` unique numbers uniformly without replacement using partial Fisher-Yates over the shared cryptographically secure `randomInt` helper.
- **Ticket & Wager Controls**: Includes `Quick Pick` (configurable `1–10` spot count), `Clear Selection`, `Repeat Bet`, chip presets (`10, 20, 50, 100, 250`) and `±10` steppers within table limits (`10–1,000` Credits).
- **Draw Chamber & Dynamic Paytable**: Sequential 20-ball reveal chamber (`animations` and `prefers-reduced-motion` aware), live hit counter, dynamic spot-specific payout schedule (up to **25,000x** for 10/10 hits), atomic escrow & crash recovery, and persistent 15-round history/stats (`tahns_casino_v2_keno_history`, `tahns_casino_v2_keno_stats`) deduplicated by `roundId`.

### Lucky Slots & Nova Voyager (`src/games/slots/`)
- Built on a shared, config-driven N-reel slot machine engine (`ruleSets.ts`, `slotsConfig.ts`, `slotsRules.ts`, `SlotMachine.tsx`):
  - **Lucky Slots**: Classic 3-reel × 1-payline machine (`classic-cherry-3reel` rule set).
  - **Nova Voyager**: 5-reel × 3-row space-themed machine with 10 fixed paylines and roaming Comet Wilds (`left-to-right-wild` rule set).

---

## Technology Stack

Verified directly from `package.json`:

- **UI Framework**: React `19.0.1` & React DOM `19.0.1`
- **Language**: TypeScript (`~7.0.2`, typechecked via `tsc --noEmit`)
- **Build Tool & Dev Server**: Vite (`^8.3.0`) with `@vitejs/plugin-react` (`^6.1.1`)
- **Styling**: Tailwind CSS (`^4.3.3`) via `@tailwindcss/vite`
- **Icons & Motion**: `lucide-react` (`^0.546.0`), `motion` (`^12.23.24`)
- **Testing**: Vitest (`^5.1.0`), `@testing-library/react` (`^16.3.3`), `jsdom` (`^31.0.0`), `tsx` (`^4.21.0`)

---

## Project Structure

```text
├── public/
│   └── images/                  # Static casino floor artwork & patron avatars
├── src/
│   ├── components/              # Shared UI shell, modals, cards, navigation & currency display
│   ├── context/                 # CasinoContext (global reducer, localStorage sync, crash recovery)
│   │   ├── CasinoContext.tsx
│   │   └── recovery.test.ts
│   ├── data/                    # Starter profile, achievements, avatars & initial settings
│   ├── economy/                 # Pure wallet & progression rules (zero React/DOM coupling)
│   │   ├── wallet.ts
│   │   └── wallet.test.ts
│   ├── games/                   # Decoupled mini-game plug-in modules & registry
│   │   ├── blackjack/           # Deck, Blackjack rules, state machine, card UI & tests
│   │   ├── dice/                # Dice rules, UI component & unit/component tests
│   │   ├── keno/                # 80-ball Keno rules, state, persistence, board, draw chamber & tests
│   │   ├── roulette/            # European Roulette rules, state, history storage, SVG wheel, felt table & tests
│   │   ├── slots/               # Configurable N-reel engine, rule sets, configs, SlotMachine UI & tests
│   │   ├── video-poker/         # Jacks or Better rules, state machine, UI & tests
│   │   ├── shared/              # Unbiased crypto RNG (rng.ts) & shared wager validators
│   │   ├── registry.ts          # Game catalog metadata, GameRegistry, registerSlotMachine
│   │   ├── types.ts             # CasinoGameMetadata & GameFloorItem interfaces
│   │   └── README.md            # Developer guide for adding new game plug-ins
│   ├── types/                   # Core domain TypeScript contracts (GameProps, PlayerProfile, etc.)
│   ├── utils/                   # Web Audio API synthesized sound engine (sound.ts)
│   ├── views/                   # Top-level views (Home, Games, Profile, Achievements, Settings, GameDetail, Onboarding)
│   ├── App.tsx                  # Root layout shell & view router
│   ├── index.css                # Tailwind v4 imports & casino palette utilities
│   └── main.tsx                 # React DOM entrypoint
├── package.json                 # Dependencies and npm scripts
├── tsconfig.json                # TypeScript compiler configuration
└── vite.config.ts               # Vite + Vitest environment configuration
```

---

## Development and Build Instructions

### Prerequisites
- Node.js (v18+ recommended) and `npm`

### Install Dependencies
```bash
npm install
```

### Start Development Server
Runs the Vite dev server on `http://localhost:3000`:
```bash
npm run dev
```

### Run Test Suite
Executes all Vitest unit and component tests across pure game engines, economy invariants, recovery, navigation, and UI components:
```bash
npm test
```

### Type Check / Lint
Runs TypeScript strict type verification (`tsc --noEmit`):
```bash
npm run lint
```

### Production Build & Preview
Builds the optimized static bundle into `dist/` and optionally previews it locally:
```bash
npm run build
npm run preview
```

---

## Architecture and Development Conventions

1. **Central Game Registry (`src/games/registry.ts`)**:
   - Floor metadata lives in `DEFAULT_GAMES` (or via `registerSlotMachine`), while interactive components register via `registerGameModule({ id, component })`.
   - Floor status (`Table Open` vs `Coming Soon`) is derived purely from whether a module is registered—never stored in `localStorage`.
2. **Decoupled `GameProps` Contract (`src/types/casino.ts`)**:
   - Mini-games receive `{ balance, minBet, maxBet, settle, placeBet, resolveRound, updatePendingRound, animations }`.
   - Games **must not** import `useCasino()`, manage independent wallets, award XP directly, or invent separate progression tiers.
3. **Escrow & Crash Recovery**:
   - Animated or multi-step games (Blackjack, Video Poker, Slots, Dice, Roulette, Keno) call `placeBet(wager, predeterminedPayout, meta)` to deduct wager into escrow before starting animations, settle once via `resolveRound`, and implement an unmount-only cleanup effect (`useEffect(..., [])`) backed by refs so mid-round navigation never strands wagers.
4. **Pure Rules Separation**:
   - Deterministic game math, RNG wrappers, and state machines live in pure `.ts` modules (`*Rules.ts`, `*State.ts`) testable under Node without React/DOM dependencies.
5. **Storage Conventions**:
   - Client persistence uses `localStorage` keys prefixed with `tahns_casino_v2_` (`_profile`, `_achievements`, `_activities`, `_settings`, `_visited_games`, `_pending_round`, `_roulette_history`, `_keno_history`, `_keno_stats`), handled defensively with `try/catch` and schema sanitization.

See [`src/games/README.md`](src/games/README.md) for detailed plug-in implementation guidelines.

---

## Project Roadmap (Planned / Future)

The items below are **planned enhancements** and are **not yet implemented**:

### Potential Future Games
- **High-Roller Baccarat**: Implement a playable Punto Banco table module for the existing `baccarat-vip` *Coming Soon* catalog entry.
- **Craps**: Multi-stage pass/don't-pass and odds table experience.
- **Additional Slot Machines**: New multi-line themes leveraging `registerSlotMachine`.

### Potential Future Features
- Expanded per-game win/loss analytics and return tracking.
- Additional patron honors and game-specific achievements.
- Expanded cross-game session and bet ledger history.
- Additional casino table felt and chip customization options.

---

## Design Philosophy

- **Deep Charcoal Surfaces**: Dark salon backdrop (`#0a0d12`) layered with subtle charcoal-slate panels (`#0f141d` / `#131b26`) and low-contrast hairline borders.
- **Emerald Primary Accents**: Luxury casino felt emerald (`#083525` felt tables, emerald CTAs and active navigation highlights).
- **Gold Secondary Accents**: Warm brass/amber highlights for chip denominations, winning borders, table limits, and VIP milestones.
- **Restrained Luxury Typography**: Display serif titles paired with crisp UI sans-serif copy and tabular monospace (`tabular-nums`) for all credit amounts, RTP figures, timers, and odds.
- **Mobile-First Usability**: Touch-sized controls (`>= 44px` action buttons), sticky thumb navigation bar on mobile, and clean horizontal scrolling without breaking vertical page flow.
- **Consistent Player Interface**: Unified currency badges, status strips, collapsible Rules & Payouts drawers, and uniform settlement feedback across every game table.
