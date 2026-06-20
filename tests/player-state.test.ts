import { describe, expect, it } from 'vitest';
import { PlayerStateMachine } from '../src/game/player/PlayerStateMachine';

describe('PlayerStateMachine', () => {
  it('does not allow dodge when stamina is too low', () => {
    const player = new PlayerStateMachine({ stamina: 8 });

    const didDodge = player.tryDodge(1000);

    expect(didDodge).toBe(false);
    expect(player.state.stamina).toBe(8);
  });

  it('spends stamina and grants brief invulnerability when dodging', () => {
    const player = new PlayerStateMachine({ stamina: 40 });

    const didDodge = player.tryDodge(1000);

    expect(didDodge).toBe(true);
    expect(player.state.stamina).toBe(22);
    expect(player.state.invulnerableUntil).toBe(1220);
  });

  it('does not allow light attacks while blocking', () => {
    const player = new PlayerStateMachine({ stamina: 40 });
    player.startBlocking(1000);

    const strike = player.tryLightAttack(1010);

    expect(strike).toBeNull();
  });

  it('marks the player dead when damage reduces health to zero', () => {
    const player = new PlayerStateMachine({ health: 30 });

    const damageTaken = player.takeDamage(80);

    expect(damageTaken).toBe(30);
    expect(player.state.health).toBe(0);
    expect(player.isDead()).toBe(true);
  });

  it('prevents actions after death', () => {
    const player = new PlayerStateMachine({ health: 1, stamina: 60 });
    player.takeDamage(10);

    expect(player.tryDodge(1000)).toBe(false);
    expect(player.tryLightAttack(1000)).toBeNull();
    expect(player.tryHeavyAttack(1000)).toBeNull();
    expect(player.startBlocking(1000)).toBe(false);
  });

  it('consumes the counter window only within its window and only once', () => {
    const player = new PlayerStateMachine();
    player.grantCounterWindow(1280);

    expect(player.consumeCounterWindow(1300)).toBe(false);
    expect(player.consumeCounterWindow(1200)).toBe(true);
    // Already consumed → no longer available even within the window.
    expect(player.consumeCounterWindow(1200)).toBe(false);
  });

  it('clears the counter window on reset', () => {
    const player = new PlayerStateMachine();
    player.grantCounterWindow(5000);

    player.reset();

    expect(player.consumeCounterWindow(1000)).toBe(false);
  });

  it('resets health, stamina, guard, block and invulnerability state', () => {
    const player = new PlayerStateMachine({
      health: 0,
      stamina: 4,
      guard: 45,
      isBlocking: true,
      invulnerableUntil: 1200,
      perfectGuardUntil: 1100,
      staggeredUntil: 1400,
    });

    player.reset();

    expect(player.state.health).toBe(player.state.maxHealth);
    expect(player.state.stamina).toBe(player.state.maxStamina);
    expect(player.state.guard).toBe(0);
    expect(player.state.isBlocking).toBe(false);
    expect(player.state.invulnerableUntil).toBe(0);
    expect(player.state.perfectGuardUntil).toBe(0);
    expect(player.state.staggeredUntil).toBe(0);
    expect(player.isDead()).toBe(false);
  });

  it('accumulates soul up to maxSoul', () => {
    const player = new PlayerStateMachine({ soul: 0, maxSoul: 100 });

    player.addSoul(30);
    expect(player.state.soul).toBe(30);

    player.addSoul(200);
    expect(player.state.soul).toBe(100);
  });

  it('spends soul only when enough is available', () => {
    const player = new PlayerStateMachine({ soul: 20, maxSoul: 100 });

    expect(player.spendSoul(25)).toBe(false);
    expect(player.state.soul).toBe(20);

    expect(player.spendSoul(15)).toBe(true);
    expect(player.state.soul).toBe(5);
  });

  it('does not accumulate or spend soul when dead', () => {
    const player = new PlayerStateMachine({ health: 0, soul: 10, maxSoul: 100 });

    expect(player.isDead()).toBe(true);
    // addSoul 仍允许（复活场景外不常见，但逻辑上积累不致死）
    player.addSoul(5);
    expect(player.state.soul).toBe(15);
    // spendSoul 仍按数值判定（死亡状态由调用方拦截释放）
    expect(player.spendSoul(20)).toBe(false);
  });

  it('resets soul to zero', () => {
    const player = new PlayerStateMachine({ soul: 50, maxSoul: 100 });

    player.reset();

    expect(player.state.soul).toBe(0);
  });

  it('grants a dodge counter window after dodging for dragon-return derivation', () => {
    const player = new PlayerStateMachine({ stamina: 40 });

    player.tryDodge(1000);

    expect(player.isInDodgeCounterWindow(1100)).toBe(true);
    expect(player.isInDodgeCounterWindow(1500)).toBe(false);
  });

  it('consumeDodgeCounterWindow returns true only within window and once', () => {
    const player = new PlayerStateMachine({ stamina: 40 });
    player.tryDodge(1000);

    expect(player.consumeDodgeCounterWindow(1100)).toBe(true);
    expect(player.consumeDodgeCounterWindow(1100)).toBe(false);
  });

  it('reset clears dodge counter window', () => {
    const player = new PlayerStateMachine({ stamina: 40 });
    player.tryDodge(1000);

    player.reset();

    expect(player.isInDodgeCounterWindow(1100)).toBe(false);
  });
});
