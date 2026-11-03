/**
 * Cryptographically secure, unbiased random number generator for Dice.
 * Uses rejection sampling on Uint8Array to eliminate modulo bias.
 */

export function rollDie(customRng?: () => number): number {
  if (customRng) {
    const val = customRng();
    if (Number.isInteger(val) && val >= 1 && val <= 6) {
      return val;
    }
    return Math.min(6, Math.max(1, Math.floor(val * 6) + 1));
  }

  const buffer = new Uint8Array(1);
  while (true) {
    crypto.getRandomValues(buffer);
    const byte = buffer[0];
    // 252 is 42 * 6. Reject 252, 253, 254, 255 so 0-251 has equal 42 occurrences of each mod 6.
    if (byte < 252) {
      return (byte % 6) + 1;
    }
  }
}
