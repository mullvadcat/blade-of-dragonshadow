import { describe, expect, it } from 'vitest';
import { SkillSystem } from '../src/game/skills/SkillSystem';
import { SKILL_DEFS } from '../src/game/skills/skillDefs';
import { MoralState } from '../src/game/moral/MoralState';

describe('SkillSystem', () => {
  it('starts with all skills off cooldown', () => {
    const skills = new SkillSystem(new MoralState());
    expect(skills.isReady('dragonLurk', 1000)).toBe(true);
    expect(skills.isReady('dragonReturn', 1000)).toBe(true);
    expect(skills.isReady('scaleBreak', 1000)).toBe(true);
  });

  it('reports not ready during cooldown', () => {
    const skills = new SkillSystem(new MoralState());
    skills.recordCast('dragonLurk', 1000);
    expect(skills.isReady('dragonLurk', 1500)).toBe(false);
    expect(skills.isReady('dragonLurk', 1000 + SKILL_DEFS.dragonLurk.cooldownMs)).toBe(true);
  });

  it('tryRelease returns null when on cooldown', () => {
    const skills = new SkillSystem(new MoralState());
    skills.recordCast('dragonLurk', 1000);
    const result = skills.tryRelease('dragonLurk', 1200, 100, 120);
    expect(result).toBeNull();
  });

  it('tryRelease returns null when insufficient soul', () => {
    const skills = new SkillSystem(new MoralState());
    const result = skills.tryRelease('dragonLurk', 1000, 5, 120);
    expect(result).toBeNull();
  });

  it('tryRelease deducts soul and sets cooldown on success', () => {
    const moral = new MoralState();
    const skills = new SkillSystem(moral);
    const result = skills.tryRelease('dragonLurk', 1000, 50, 120);
    expect(result).not.toBeNull();
    expect(result!.soulSpent).toBe(SKILL_DEFS.dragonLurk.soulCost);
    expect(skills.isReady('dragonLurk', 1000)).toBe(false);
  });

  it('wrath form multiplies damage and applies self-harm', () => {
    const moral = new MoralState();
    moral.addLiqi(60); // wrath
    const skills = new SkillSystem(moral);
    const result = skills.tryRelease('dragonLurk', 1000, 50, 120);
    expect(result).not.toBeNull();
    const expectedDmg = Math.round(SKILL_DEFS.dragonLurk.strike.damage * 1.4);
    expect(result!.strike.damage).toBe(expectedDmg);
    expect(result!.selfHarm).toBeGreaterThan(0);
    expect(result!.selfHarm).toBe(Math.round(120 * 0.08));
  });

  it('guard form reduces range and grants damage reduction window', () => {
    const moral = new MoralState();
    moral.addShouxin(60); // guard
    const skills = new SkillSystem(moral);
    const result = skills.tryRelease('dragonLurk', 1000, 50, 120);
    expect(result).not.toBeNull();
    expect(result!.rangeMultiplier).toBeLessThan(1);
    expect(result!.guardReduceUntil).toBeGreaterThan(1000);
  });

  it('balance form uses base damage with no extras', () => {
    const moral = new MoralState();
    const skills = new SkillSystem(moral);
    const result = skills.tryRelease('scaleBreak', 1000, 50, 120);
    expect(result).not.toBeNull();
    expect(result!.strike.damage).toBe(SKILL_DEFS.scaleBreak.strike.damage);
    expect(result!.selfHarm).toBe(0);
    expect(result!.guardReduceUntil).toBeNull();
  });

  it('cooldown remaining reports time left for HUD', () => {
    const skills = new SkillSystem(new MoralState());
    skills.recordCast('dragonLurk', 1000);
    expect(skills.cooldownRemaining('dragonLurk', 2000)).toBe(2000);
    expect(skills.cooldownRemaining('dragonLurk', 4000)).toBe(0);
  });

  it('reset clears all cooldowns', () => {
    const skills = new SkillSystem(new MoralState());
    skills.recordCast('dragonLurk', 1000);
    skills.recordCast('scaleBreak', 1000);
    skills.reset();
    expect(skills.isReady('dragonLurk', 1000)).toBe(true);
    expect(skills.isReady('scaleBreak', 1000)).toBe(true);
  });
});
