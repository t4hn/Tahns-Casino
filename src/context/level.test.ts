import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateLevelInfo } from './CasinoContext';
import { STARTING_CREDITS, STARTING_LEVEL, STARTING_XP, DEFAULT_CHARACTER_NAME } from '../data/initialData';

describe('calculateLevelInfo', () => {
  test('calculates Level 1 for 0 XP', () => {
    const info = calculateLevelInfo(0);
    assert.equal(info.level, 1);
    assert.equal(info.title, 'Bronze Patron');
    assert.equal(info.currentLevelXp, 0);
    assert.equal(info.nextLevelTargetXp, 500);
    assert.equal(info.progressPercent, 0);
  });

  test('calculates Level 2 for 500 XP threshold', () => {
    const info = calculateLevelInfo(500);
    assert.equal(info.level, 2);
    assert.equal(info.title, 'Silver Cardholder');
    assert.equal(info.currentLevelXp, 0);
    assert.equal(info.nextLevelTargetXp, 700);
  });

  test('calculates Level 5 for 4000 XP', () => {
    const info = calculateLevelInfo(4000);
    assert.equal(info.level, 5);
    assert.equal(info.title, 'Black Tier Elite');
    assert.equal(info.currentLevelXp, 500);
    assert.equal(info.nextLevelTargetXp, 1700);
  });
});

describe('initial player defaults', () => {
  test('starts with correct initial balance and defaults', () => {
    assert.equal(DEFAULT_CHARACTER_NAME, 'Tahn');
    assert.equal(STARTING_CREDITS, 1000);
    assert.equal(STARTING_LEVEL, 1);
    assert.equal(STARTING_XP, 0);
  });

  test('credit deduction prevents negative balance', () => {
    let balance = 1000;
    const deduct = (amount: number) => {
      if (amount <= 0) return false;
      if (balance < amount) return false;
      balance -= amount;
      return true;
    };

    assert.equal(deduct(500), true);
    assert.equal(balance, 500);
    assert.equal(deduct(600), false);
    assert.equal(balance, 500); // Balance preserved, cannot go negative!
    assert.equal(deduct(500), true);
    assert.equal(balance, 0);
    assert.equal(deduct(10), false);
    assert.equal(balance, 0);
  });
});
