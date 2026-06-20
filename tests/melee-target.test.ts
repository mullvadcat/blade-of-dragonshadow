import { describe, expect, it } from 'vitest';
import { isMeleeHittable } from '../src/game/entities/meleeTarget';

describe('isMeleeHittable', () => {
  it('hits an active, non-surrendered enemy within range', () => {
    expect(isMeleeHittable(true, false, 100, 100, 80, 100, 92, 86)).toBe(true);
  });

  it('does not hit a surrendered enemy even within range', () => {
    expect(isMeleeHittable(true, true, 100, 100, 80, 100, 92, 86)).toBe(false);
  });

  it('does not hit an inactive enemy', () => {
    expect(isMeleeHittable(false, false, 100, 100, 80, 100, 92, 86)).toBe(false);
  });

  it('does not hit an enemy outside horizontal range', () => {
    expect(isMeleeHittable(true, false, 300, 100, 80, 100, 92, 86)).toBe(false);
  });

  it('does not hit an enemy outside vertical range', () => {
    expect(isMeleeHittable(true, false, 100, 300, 80, 100, 92, 86)).toBe(false);
  });
});
