/**
 * Shared wager validation helper against table limits and patron bankroll.
 */

export function isValidBet(
  bet: number,
  minBet: number,
  maxBet: number,
  balance: number
): { valid: boolean; reason?: string } {
  if (bet <= 0) {
    return { valid: false, reason: 'Wager must be greater than zero.' };
  }
  if (bet > balance) {
    return { valid: false, reason: 'Insufficient credits for this wager.' };
  }
  if (bet < minBet) {
    return { valid: false, reason: `Wager must be at least ${minBet} credits.` };
  }
  if (bet > maxBet) {
    return { valid: false, reason: `Wager cannot exceed ${maxBet} credits.` };
  }
  if (bet % 10 !== 0) {
    return { valid: false, reason: 'Wagers must be in steps of 10.' };
  }
  return { valid: true };
}
