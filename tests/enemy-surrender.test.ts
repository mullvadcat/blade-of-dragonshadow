import { describe, expect, it } from 'vitest';
import { shouldSurrender, SCOUT_SURRENDER_HEALTH_RATIO } from '../src/game/entities/surrender';

describe('shouldSurrender', () => {
  it('returns true when health is below ratio threshold but above zero', () => {
    expect(shouldSurrender(1, 42)).toBe(true);
    expect(shouldSurrender(10, 42)).toBe(true);
  });

  it('returns false when health is above threshold', () => {
    expect(shouldSurrender(11, 42)).toBe(false);
    expect(shouldSurrender(42, 42)).toBe(false);
  });

  it('returns false when dead (health <= 0)', () => {
    expect(shouldSurrender(0, 42)).toBe(false);
    expect(shouldSurrender(-5, 42)).toBe(false);
  });

  it('ratio is 0.25', () => {
    expect(SCOUT_SURRENDER_HEALTH_RATIO).toBe(0.25);
  });
});
