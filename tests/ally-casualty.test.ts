import { describe, expect, it } from 'vitest';
import { isAllyWithinRange } from '../src/game/entities/allyCasualty';

describe('isAllyWithinRange', () => {
  it('returns true when ally is within range', () => {
    expect(isAllyWithinRange(100, 100, 100, 100, 92, 86)).toBe(true);
    expect(isAllyWithinRange(180, 150, 100, 100, 92, 86)).toBe(true);
  });

  it('returns false when ally is outside range horizontally', () => {
    expect(isAllyWithinRange(200, 100, 100, 100, 92, 86)).toBe(false);
    expect(isAllyWithinRange(0, 100, 100, 100, 92, 86)).toBe(false);
  });

  it('returns false when ally is outside range vertically', () => {
    expect(isAllyWithinRange(100, 200, 100, 100, 92, 86)).toBe(false);
    expect(isAllyWithinRange(100, 0, 100, 100, 92, 86)).toBe(false);
  });

  it('returns false at exact boundary (strict less-than)', () => {
    expect(isAllyWithinRange(192, 100, 100, 100, 92, 86)).toBe(false);
    expect(isAllyWithinRange(100, 186, 100, 100, 92, 86)).toBe(false);
  });

  it('handles negative direction (ally to the left/up)', () => {
    expect(isAllyWithinRange(20, 100, 100, 100, 92, 86)).toBe(true);
    expect(isAllyWithinRange(100, 20, 100, 100, 92, 86)).toBe(true);
  });
});
