import { randomInt } from '../shared/rng';

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export const SUITS: readonly Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
export const RANKS: readonly Rank[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
] as const;

/**
 * Creates a fresh, unshuffled standard 52-card deck.
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${rank}_${suit}`,
        suit,
        rank,
      });
    }
  }
  return deck;
}

/**
 * Fisher-Yates shuffle using the shared cryptographically secure CSPRNG (or custom RNG for deterministic tests).
 * Returns a new shuffled deck without mutating the input array.
 */
export function shuffleDeck(deck: readonly Card[], customRng?: () => number): Card[] {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, customRng);
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

/**
 * Draws the top card from a deck immutably.
 */
export function drawCard(deck: readonly Card[]): { card: Card; remainingDeck: Card[] } {
  if (deck.length === 0) {
    throw new Error('Cannot draw from an empty deck.');
  }
  return {
    card: deck[0],
    remainingDeck: deck.slice(1),
  };
}

/**
 * Base point value of a card rank (Ace defaults to 11 before soft-hand adjustment).
 */
export function getCardPointValue(rank: Rank): number {
  if (rank === 'A') return 11;
  if (rank === 'K' || rank === 'Q' || rank === 'J') return 10;
  return parseInt(rank, 10);
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

export function getSuitSymbol(suit: Suit): string {
  switch (suit) {
    case 'spades':
      return '♠';
    case 'hearts':
      return '♥';
    case 'diamonds':
      return '♦';
    case 'clubs':
      return '♣';
  }
}

export function getSuitName(suit: Suit): string {
  switch (suit) {
    case 'spades':
      return 'Spades';
    case 'hearts':
      return 'Hearts';
    case 'diamonds':
      return 'Diamonds';
    case 'clubs':
      return 'Clubs';
  }
}

export function getRankLabel(rank: Rank): string {
  switch (rank) {
    case 'A':
      return 'Ace';
    case 'K':
      return 'King';
    case 'Q':
      return 'Queen';
    case 'J':
      return 'Jack';
    default:
      return rank;
  }
}

export function formatCard(card: Card): string {
  return `${card.rank}${getSuitSymbol(card.suit)}`;
}

export function formatCardAccessibleName(card: Card): string {
  return `${getRankLabel(card.rank)} of ${getSuitName(card.suit)}`;
}
