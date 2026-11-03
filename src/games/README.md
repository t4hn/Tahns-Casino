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
   * Atomic round settlement callback.
   * Atomically debits bet, credits payout, updates wins/losses/XP,
   * checks for level-ups, and prevents overdraft.
   * NOTE: 'payout' is the TOTAL returned amount including the stake.
   * A push/tie returns payout === bet (net = 0).
   * A loss returns payout === 0 (net = -bet).
   */
  settle: (bet: number, payout: number) => RoundResult;
}

export interface GameModule {
  /** Unique ID matching the game entry in DEFAULT_GAMES */
  id: string;
  /** The React game view component */
  component: React.FC<GameProps>;
}
```

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

## Economy Rules & Invariants

1. **Total Payout Semantics**: `settle(bet, payout)` treats `payout` as the **TOTAL returned amount including the original stake**. A win at 2.3x returns `Math.round(bet * 2.3)`. A push returns `bet` (`payout === bet`). A loss returns `0` (`payout === 0`).
2. **Strict Non-Negative Balance**: `settle(bet, payout)` rejects any bet where `bet > balance` or `bet <= 0`. Credits can never go negative.
3. **Net Accounting**: Total winnings and losses are tracked strictly by net round results (`net = payout - bet`).
4. **Resolution Guard**: Mini-games must disable their Roll/Play buttons while a round is actively rolling or resolving (using ref guards to reject rapid double-taps).
5. **Atomic Progression**: XP is credited via `applyXp`, automatically awarding level promotion bonuses for every tier threshold crossed.
