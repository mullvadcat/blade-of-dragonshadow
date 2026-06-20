import { describe, expect, it } from 'vitest';
import { CHARACTER_ART_SPECS } from '../src/game/art/CharacterArt';

describe('CHARACTER_ART_SPECS', () => {
  it('defines readable silhouettes for every playable demo character', () => {
    expect(Object.keys(CHARACTER_ART_SPECS).sort()).toEqual([
      'bandit',
      'player',
      'scout',
      'villager',
      'wuzhen',
    ]);

    for (const spec of Object.values(CHARACTER_ART_SPECS)) {
      expect(spec.width).toBeGreaterThanOrEqual(48);
      expect(spec.height).toBeGreaterThanOrEqual(76);
      expect(spec.features.length).toBeGreaterThanOrEqual(3);
      expect(spec.transparentBackground).toBe(true);
    }
  });
});
