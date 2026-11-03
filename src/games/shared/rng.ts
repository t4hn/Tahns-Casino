/**
 * Shared cryptographically secure, unbiased random integer generator.
 * Uses rejection sampling to eliminate modulo bias.
 */

export function randomInt(maxExclusive: number, customRng?: () => number): number {
  if (maxExclusive <= 1) return 0;

  if (customRng) {
    const val = customRng();
    // If the custom generator returns integers directly within range [0, maxExclusive - 1]
    if (Number.isInteger(val) && val >= 0 && val < maxExclusive) {
      return val;
    }
    // If it returns standard float in [0, 1)
    return Math.min(maxExclusive - 1, Math.max(0, Math.floor(val * maxExclusive)));
  }

  // Uint8Array rejection sampling for maxExclusive <= 256
  if (maxExclusive <= 256) {
    const buffer = new Uint8Array(1);
    const limit = 256 - (256 % maxExclusive);
    while (true) {
      crypto.getRandomValues(buffer);
      const byte = buffer[0];
      if (byte < limit) {
        return byte % maxExclusive;
      }
    }
  }

  // Uint32Array rejection sampling for larger ranges
  const buffer32 = new Uint32Array(1);
  const maxUint32 = 0x100000000; // 2^32
  const limit32 = maxUint32 - (maxUint32 % maxExclusive);
  while (true) {
    crypto.getRandomValues(buffer32);
    const val = buffer32[0];
    if (val < limit32) {
      return val % maxExclusive;
    }
  }
}

/**
 * Standard 6-sided die roll (1-6) without modulo bias.
 * Preserves custom RNG integer returns (1-6) for deterministic tests.
 */
export function rollDie(customRng?: () => number): number {
  if (customRng) {
    const val = customRng();
    if (Number.isInteger(val) && val >= 1 && val <= 6) {
      return val;
    }
    return Math.min(6, Math.max(1, Math.floor(val * 6) + 1));
  }
  return randomInt(6) + 1;
}
