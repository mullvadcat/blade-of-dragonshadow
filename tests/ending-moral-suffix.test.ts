import { describe, expect, it } from 'vitest';
import { endingMoralSuffix } from '../src/game/flow/endingMoralSuffix';
import type { MoralChoiceId } from '../src/game/story/StoryFlags';

describe('endingMoralSuffix', () => {
  it('returns empty string when no moral choices recorded', () => {
    expect(endingMoralSuffix([])).toBe('');
  });

  it('returns mercy line when scout was spared (and not killed)', () => {
    const choices: MoralChoiceId[] = ['sparedScout'];
    expect(endingMoralSuffix(choices)).toContain('放过');
    expect(endingMoralSuffix(choices)).toContain('探子');
  });

  it('returns execution line when scout was killed', () => {
    const choices: MoralChoiceId[] = ['killedScout'];
    expect(endingMoralSuffix(choices)).toContain('血痕');
  });

  it('prefers execution line when both spared and killed exist', () => {
    const choices: MoralChoiceId[] = ['sparedScout', 'killedScout'];
    expect(endingMoralSuffix(choices)).toContain('血痕');
    expect(endingMoralSuffix(choices)).not.toContain('放过');
  });

  it('returns protection line when villager was protected', () => {
    const choices: MoralChoiceId[] = ['protectedVillager'];
    expect(endingMoralSuffix(choices)).toContain('护住');
    expect(endingMoralSuffix(choices)).toContain('村民');
  });

  it('prefers execution line over protection when both exist', () => {
    const choices: MoralChoiceId[] = ['protectedVillager', 'killedScout'];
    expect(endingMoralSuffix(choices)).toContain('血痕');
    expect(endingMoralSuffix(choices)).not.toContain('护住');
  });

  it('prefers protection line over mercy when both exist', () => {
    const choices: MoralChoiceId[] = ['protectedVillager', 'sparedScout'];
    expect(endingMoralSuffix(choices)).toContain('护住');
    expect(endingMoralSuffix(choices)).not.toContain('放过');
  });
});
