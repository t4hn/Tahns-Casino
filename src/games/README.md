# Casino Game Plug-in Architecture

Tahn's Casino provides a modular, decoupled plug-in architecture for casino mini-games. All games interact with the central economy layer through a standardized contract without managing balances, level calculations, or storage directly.

---

## The Game Interface Contract

Defined in `src/types/casino.ts`:

```typescript
export interface GameProps {
  /** Current player virtual credit bankroll */
  balance: number;
  /** Table minimum wager */
  minBet: number;
  /** Table maximum wager */
  maxBet: number;
  /**
   * Single-shot atomic round settlement callback.
   * Atomically debits bet, credits payout, updates wins/losses/XP,
   * checks for level-ups, and prevents overdraft.
   * NOTE: 'payout' is the TOTAL returned amount including the stake.
   * A push/tie returns payout === bet (net = 0).
   * A loss returns payout === 0 (net = -bet).
   */
  settle: (bet: number, payout: number) => RoundResult;
  /**
   * Escrow bet placement callback.
   * Immediately deducts the wager from patron bankroll before animations start.
   * Optionally accepts predetermined payout to persist for crash recovery.
   */
  placeBet: (bet: number, payout?: number) => { success: boolean; error?: string };
  /**
   * Escrow round resolution callback.
   * Credits payout, updates statistics, awards XP, and checks level-ups.
   * Called when animations conclude or on unmount mid-spin.
   */
  resolveRound: (bet: number, payout: number) => RoundResult;
  /** Whether visual animations are enabled in player preferences */
  animations: boolean;
}

export interface GameModule {
  /** Unique ID matching the game entry in DEFAULT_GAMES */
  id: string;
  /** The React game view component */
  component: React.FC<GameProps>;
}
```

---

## Rules for Game Components

1. **Never Depend on Callback Prop Identity in Effects**:
   - Callbacks passed to game components (`placeBet`, `resolveRound`, `settle`) are recreated when parent components re-render (e.g. when state changes during bet placement).
   - An effect whose cleanup has side effects (such as clearing timers or resolving escrow) **must never include callback props in its dependency array**. If it does, parent re-renders immediately trigger the cleanup, clearing running animation timers and leaving the UI stuck.
2. **Keep the Latest Callbacks in Refs**:
   - Store callback props in refs updated on every render (`resolveRoundRef.current = resolveRound; placeBetRef.current = placeBet; settleRef.current = settle;`).
   - Timers, animation loops, and unmount cleanup handlers must invoke `ref.current(...)` to guarantee the freshest context reference is used without causing stale closures or effect restarts.
3. **Games Must Finish a Round Even if the Parent Re-renders**:
   - Animation cycles and delayed resolutions must proceed to completion and resolve the round smoothly regardless of intermediate re-renders from bankroll, settings, or profile changes.
   - If the player navigates away while a round is resolving (component unmounts mid-spin), the unmount cleanup effect (with an empty dependency array `[]`) must resolve the round immediately using the predetermined payout to prevent dangling escrow or lost credits.

---

## How to Add a New Game

### 1. Create Your Game Component
Create a new file in `src/games/<your-game>/YourGame.tsx` that accepts `GameProps`:

```tsx
import React, { useState } from 'react';
import { GameProps } from '../../types/casino';

export const LuckySlotsGame: React.FC<GameProps> = ({ balance, minBet, maxBet, settle }) => {
  const [wager, setWager] = useState(minBet);

  const handleSpin = () => {
    // 1. Calculate game outcome logic (pure client-side or PRNG)
    const won = Math.random() < 0.45;
    const payout = won ? wager * 2 : 0;

    // 2. Atomically settle through the central economy
    const result = settle(wager, payout);

    if (!result.success) {
      console.error(result.error); // e.g. Insufficient balance or invalid wager
      return;
    }

    if (result.leveledUp) {
      console.log(`Promoted to Level ${result.newLevel}!`);
    }
  };

  return (
    <div className="p-6 bg-[#0c1118] rounded-2xl border border-emerald-500/30">
      {/* Game UI */}
    </div>
  );
};
```

### 2. Register the Game Module
In `src/games/registry.ts`, register your module with the registry:

```typescript
import { registerGameModule } from './registry';
import { SlotsGame } from './slots/SlotsGame';

registerGameModule({
  id: 'lucky-slots',
  component: SlotsGame,
});
```

### 3. Automatic Floor Mounting
Once registered:
- When a patron selects the game on the casino floor, `GameDetailView` detects the registered module and mounts it with the patron's live bankroll and `settle()` callback.
- If a game does not yet have a registered module, `GameDetailView` displays the polished **Table Under Preparation (Coming Soon)** showcase.

---

## Generic Slot Machine Engine

Tahn's Casino features a generic, config-driven slot engine in `src/games/slots/` supporting arbitrary reel counts, visible rows, paylines, and strip compositions.

### Adding a New Slot Machine in One Call:
Use `registerSlotMachine` in `src/games/registry.ts`:

```typescript
import { registerSlotMachine } from './registry';
import { SlotsConfig } from './slots/slotsConfig';

const MY_SLOT_CONFIG: SlotsConfig = {
  reelsCount: 3,
  visibleRows: 3,
  stopsPerReel: [20, 20, 20],
  reelStrips: [...],
  paylines: [
    { id: 'middle', name: 'Center Payline', rows: [1, 1, 1] },
  ],
  paytable: [...],
  ruleSet: 'classic-cherry-3reel',
};

registerSlotMachine(
  {
    id: 'my-custom-slot',
    name: 'Crown Jewels 3-Reel',
    description: 'Luxury high-roller slots with sparkling sapphire wilds.',
    imageUrl: '/images/game_lucky_slots_1793671235711.jpg',
    minLevel: 2,
    minBet: 20,
    maxBet: 1000,
    volatility: 'Medium',
  },
  MY_SLOT_CONFIG
);
```

`registerSlotMachine` automatically:
1. Calculates the theoretical payout rate (`payoutRate`) from the config using `calculateRtp(config)` or `calculateAnalyticalRtp(config)`.
2. Adds the machine to the casino floor catalog with level requirements and table limits.
3. Binds the generic `SlotMachine` component wrapped with the machine's configuration.

### Built-in Rule Sets:
1. `'classic-cherry-3reel'`: Used by Lucky Slots. 3-of-a-kind, 2-cherries anywhere, and 1-cherry on reel 1. Single center payline.
2. `'left-to-right-wild'`: Used by Nova Voyager. 5 reels x 3 rows with 10 fixed paylines. Symbols evaluate left-to-right starting from reel 1. Comet is WILD on reels 2, 3, and 4, substituting for any symbol to form runs of 3, 4, or 5. Only the longest run per payline is paid. Total payout is the sum of (line multiplier * bet per line) across all 10 active paylines.

### Custom Rule Sets
To register a new payout evaluation rule set, add a definition to `src/games/slots/ruleSets.ts`:

```typescript
import { registerRuleSet } from './ruleSets';

registerRuleSet({
  id: 'ways-to-win-rule-set',
  name: '243 Ways Rule Set',
  evaluateLine: (symbolsOnLine, config) => {
    // Return multiplier, matchId, matchDescription, won
  },
  calculateAnalyticalRtp: (config) => {
    // Optional fast analytical RTP calculation without permutation enumeration
  },
  calculateMatchOdds: (config) => {
    // Optional per-line match outcome counts for the paytable
  },
});
```

### Enumeration Safety Limit
`calculateRtp` and `calculateHitStats` include a strict safety cap of 200,000 spins. If called on larger machines (e.g., 5 reels x 24 stops = 7.9M spins) without `{ allowLarge: true }`, they throw an explicit error to prevent accidental browser/server freezing. Runtime code (`registry.ts`, `SlotMachine.tsx`) uses `calculateAnalyticalRtp` and `calculateMatchOdds` instead of full enumeration.

---

## Economy Rules & Invariants

1. **Total Payout Semantics**: `settle(bet, payout)` treats `payout` as the **TOTAL returned amount including the original stake**. A win at 2.3x returns `Math.round(bet * 2.3)`. A push returns `bet` (`payout === bet`). A loss returns `0` (`payout === 0`).
2. **Strict Non-Negative Balance**: `settle(bet, payout)` rejects any bet where `bet > balance` or `bet <= 0`. Credits can never go negative.
3. **Net Accounting**: Total winnings and losses are tracked strictly by net round results (`net = payout - bet`).
4. **Resolution Guard**: Mini-games must disable their Roll/Play buttons while a round is actively rolling or resolving (using ref guards to reject rapid double-taps).
5. **Atomic Progression**: XP is credited via `applyXp`, automatically awarding level promotion bonuses for every tier threshold crossed.
6. **Escrow & Mid-Spin Unmount Resolution**: Games with animations must place the wager into escrow via `placeBet(bet, predeterminedPayout?)` before starting animations. If the player leaves the game before the animation concludes, the component's unmount cleanup handler immediately invokes `resolveRound(wager, payout)` with the predetermined outcome so credits are never lost or left in dangling escrow.
7. **Round-in-Progress Crash & Interruption Recovery**: When `placeBet(gameId, gameName, bet, payout?)` is called, the round is atomically persisted to `localStorage` (`tahns_casino_v2_pending_round`). If the user refreshes, closes the tab, or crashes mid-spin, `CasinoContext` detects the interrupted round on initialization, settles it purely using the saved outcome (or as a settled completed round if payout was undetermined), updates achievement progress (`first_wager`, `high_roller`, `level_two`), logs an `"Interrupted round recovered"` activity item, and clears the pending record with guards against double-crediting.
8. **No Direct Context Access**: Games must remain decoupled from global state by receiving all bankroll parameters, callbacks (`settle`, `placeBet`, `resolveRound`), and `animations` through `GameProps`. Mini-games must not call `useCasino()`.
