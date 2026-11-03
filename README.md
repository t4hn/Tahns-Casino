# Tahn's Casino

A responsive, mobile-first virtual casino game hub featuring virtual currency, patron progression, honors/achievements, daily allowance rewards, and an extensible plug-in architecture for casino mini-games.

Built with React 19, TypeScript, Tailwind CSS, and Vitest.

---

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm

### Installation
```bash
npm install
```

### Development Server
Starts the Vite development server on port 3000:
```bash
npm run dev
```

### Running Tests
Executes the Vitest test suite testing pure wallet logic and economy invariants:
```bash
npm test
```

### Type Checking & Linting
Validates TypeScript types across the entire project:
```bash
npm run lint
```

### Production Build
Compiles the production web bundle into `dist/`:
```bash
npm run build
```

---

## Project Structure

```
├── public/
│   └── images/              # Static game artwork and patron avatar assets
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── CharacterCard.tsx        # Patron identity card, level progress, and XP
│   │   ├── ConfirmResetModal.tsx    # Modal to confirm career reset
│   │   ├── CurrencyDisplay.tsx      # Formatted virtual credit bankroll
│   │   ├── DailyBonusCountdown.tsx  # Isolated 1-second countdown component
│   │   ├── DailyBonusModal.tsx      # Daily allowance claim modal
│   │   ├── EditProfileModal.tsx     # Patron name and avatar customizer modal
│   │   ├── GameCard.tsx             # Casino floor game showcase & launch card
│   │   └── Navigation.tsx           # Responsive header, desktop links, mobile bottom bar & drawer
│   ├── context/             # Global application state
│   │   └── CasinoContext.tsx        # useReducer state with decoupled side effects
│   ├── data/                # Initial baseline configuration
│   │   └── initialData.ts           # Avatars, starter settings, and achievements
│   ├── economy/             # Pure wallet & economy engine (no React / side-effects)
│   │   ├── wallet.ts                # applyWager, applyPayout, applyXp, settleRound
│   │   └── wallet.test.ts           # Comprehensive Vitest test suite (15 unit tests)
│   ├── games/               # Mini-game plug-in layer
│   │   ├── shared/                  # Shared game utilities
│   │   │   ├── rng.ts               # Unbiased crypto randomInt & rollDie with rejection sampling
│   │   │   └── betValidation.ts     # Standardized wager boundary validator
│   │   ├── dice/                    # Dice mini-game plug-in
│   │   │   ├── diceRules.ts         # Pure game rules, bet types, payouts, RTP
│   │   │   ├── diceRules.test.ts    # 17 unit/integration tests for dice combinations & rules
│   │   │   ├── rng.ts               # Re-exports rollDie from shared RNG
│   │   │   └── DiceGame.tsx         # Interactive dice table UI (implements GameProps)
│   │   ├── slots/                   # Lucky Slots mini-game plug-in (3-reel, single payline)
│   │   │   ├── slotsConfig.ts       # 20-stop reel strips, paylines, and paytable configuration
│   │   │   ├── slotsRules.ts        # Pure window generator, line evaluator, and 8,000 combo RTP
│   │   │   ├── slotsRules.test.ts   # 8 unit/integration tests for all 8,000 combinations
│   │   │   └── SlotsGame.tsx        # Interactive slots machine UI (implements GameProps)
│   │   ├── registry.ts              # Game module registry and level-based table derivation
│   │   ├── types.ts                 # CasinoGameMetadata, GameFloorItem
│   │   └── README.md                # Guide on implementing and plugging in new games
│   ├── types/               # TypeScript domain interfaces
│   │   └── casino.ts                # GameProps, GameModule, RoundResult, PlayerProfile
│   ├── utils/               # Audio and helper utilities
│   │   └── sound.ts                 # Web Audio API sound generator
│   ├── views/               # Top-level screen views
│   │   ├── AchievementsView.tsx     # Honors, milestones, and reward claims
│   │   ├── CharacterCreationView.tsx# First-time patron onboarding
│   │   ├── GameDetailView.tsx       # Mounts registered GameModules or "Coming Soon"
│   │   ├── GamesView.tsx            # Casino floor game catalog
│   │   ├── HomeView.tsx             # Lounge overview and recent activity
│   │   └── SettingsView.tsx         # Preferences, sound toggles, and reset
│   ├── App.tsx              # Root application shell
│   ├── index.css            # Tailwind CSS styling and theme
│   └── main.tsx             # React DOM entrypoint
├── package.json             # Scripts and dependencies
├── tsconfig.json            # TypeScript compiler configuration
└── vite.config.ts           # Vite build and preview configuration
```

---

## Economy Rules & Invariants

All virtual credits and progression in Tahn's Casino obey strict financial invariants defined in `src/economy/wallet.ts`:

1. **Strict Non-Negative Balance & Overdraft Rejection**
   - Any wager where `bet > profile.credits` or `bet <= 0` is rejected immediately.
   - Patron credit balances never drop below zero.

2. **Atomic Settlement (`settleRound`)**
   - Debiting the wager, crediting the payout, incrementing round count, calculating net results, and awarding XP happen in a single pure atomic function.
   - `newCredits = profile.credits - bet + payout`.

3. **Net Win/Loss Accounting**
   - Total winnings and losses are computed strictly from net outcomes (`net = payout - bet`):
     - `net > 0`: `totalWinnings += net`
     - `net < 0`: `totalLosses += Math.abs(net)`
     - `net === 0`: Push round; totals remain unchanged.

4. **Universal XP & Level Promotion**
   - All XP grants (gameplay wagers, daily allowance, achievement rewards) pass through `applyXp`.
   - Crossing a tier threshold triggers promotion credits (`500 * newLevel`) credited to patron bankroll.

5. **Derived Level & Title**
   - Level and VIP title are derived dynamically from total XP (`calculateLevelInfo`), preventing stale synchronization issues in persistent storage.

---

## Game Plug-in Interface

Interactive mini-games can be plugged in without modifying context or economy logic:

```typescript
export interface GameProps {
  balance: number;
  minBet: number;
  maxBet: number;
  settle: (bet: number, payout: number) => RoundResult;
}

export interface GameModule {
  id: string;
  component: React.FC<GameProps>;
}
```

Register any module in `src/games/registry.ts`:
```typescript
registerGameModule({
  id: 'lucky-slots',
  component: LuckySlotsComponent,
});
```

See [src/games/README.md](src/games/README.md) for full instructions.
