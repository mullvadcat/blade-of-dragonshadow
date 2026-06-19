import { describe, expect, it } from 'vitest';
import {
  CombatSystem,
  type CombatantState,
  type Strike,
} from '../src/game/combat/CombatSystem';

const makeTarget = (overrides: Partial<CombatantState> = {}): CombatantState => ({
  health: 100,
  maxHealth: 100,
  guard: 0,
  maxGuard: 60,
  stamina: 40,
  maxStamina: 40,
  isBlocking: false,
  perfectGuardUntil: 0,
  invulnerableUntil: 0,
  staggeredUntil: 0,
  ...overrides,
});

describe('CombatSystem', () => {
  it('applies light attack damage to health', () => {
    const target = makeTarget();
    const strike: Strike = CombatSystem.createLightStrike();

    const result = CombatSystem.resolveStrike(strike, target, 1000);

    expect(result.damageDealt).toBe(12);
    expect(result.target.health).toBe(88);
    expect(result.target.guard).toBe(12);
    expect(result.wasPerfectGuard).toBe(false);
  });

  it('uses heavy attacks to break guard and stagger the target', () => {
    const target = makeTarget({ guard: 42 });
    const strike: Strike = CombatSystem.createHeavyStrike();

    const result = CombatSystem.resolveStrike(strike, target, 1000);

    expect(result.guardDamageDealt).toBe(28);
    expect(result.target.guard).toBe(0);
    expect(result.wasGuardBroken).toBe(true);
    expect(result.target.staggeredUntil).toBeGreaterThan(1000);
  });

  it('reduces damage when the target blocks from the front', () => {
    const target = makeTarget({ isBlocking: true });
    const strike: Strike = CombatSystem.createHeavyStrike();

    const result = CombatSystem.resolveStrike(strike, target, 1000);

    expect(result.damageDealt).toBe(7);
    expect(result.target.health).toBe(93);
    expect(result.target.stamina).toBe(26);
  });

  it('turns a perfect guard into a counter window without health damage', () => {
    const target = makeTarget({ isBlocking: true, perfectGuardUntil: 1050 });
    const strike: Strike = CombatSystem.createHeavyStrike();

    const result = CombatSystem.resolveStrike(strike, target, 1000);

    expect(result.wasPerfectGuard).toBe(true);
    expect(result.damageDealt).toBe(0);
    expect(result.target.health).toBe(100);
    expect(result.counterWindowUntil).toBe(1280);
  });
});
