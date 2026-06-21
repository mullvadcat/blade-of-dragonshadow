import { describe, expect, it } from 'vitest';
import { isDestructibleInRange } from '../src/game/entities/destructibleTarget';

describe('isDestructibleInRange', () => {
  it('returns true when target is within range', () => {
    expect(isDestructibleInRange(100, 100, 100, 100, 92, 86)).toBe(true);
    expect(isDestructibleInRange(180, 150, 100, 100, 92, 86)).toBe(true);
  });

  it('returns false when target is outside range horizontally', () => {
    expect(isDestructibleInRange(200, 100, 100, 100, 92, 86)).toBe(false);
    expect(isDestructibleInRange(0, 100, 100, 100, 92, 86)).toBe(false);
  });

  it('returns false when target is outside range vertically', () => {
    expect(isDestructibleInRange(100, 200, 100, 100, 92, 86)).toBe(false);
    expect(isDestructibleInRange(100, 0, 100, 100, 92, 86)).toBe(false);
  });

  it('returns false at exact boundary (strict less-than)', () => {
    expect(isDestructibleInRange(192, 100, 100, 100, 92, 86)).toBe(false);
    expect(isDestructibleInRange(100, 186, 100, 100, 92, 86)).toBe(false);
  });

  it('handles negative direction (target to the left/up)', () => {
    expect(isDestructibleInRange(20, 100, 100, 100, 92, 86)).toBe(true);
    expect(isDestructibleInRange(100, 20, 100, 100, 92, 86)).toBe(true);
  });
});
