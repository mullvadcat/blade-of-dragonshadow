import { describe, expect, it } from 'vitest';
import {
  shouldTriggerProtectEvent,
  resolveProtectOutcome,
  type ProtectTriggerContext,
  type ProtectOutcomeContext,
} from '../src/game/flow/protectEvent';

describe('shouldTriggerProtectEvent', () => {
  const baseCtx: ProtectTriggerContext = {
    hasThreatenedClue: true,
    playerToVillagerDist: 50,
    protectResolved: false,
  };

  it('returns true when has clue, player near, not resolved', () => {
    expect(shouldTriggerProtectEvent(baseCtx)).toBe(true);
  });

  it('returns false when missing threatened clue', () => {
    expect(shouldTriggerProtectEvent({ ...baseCtx, hasThreatenedClue: false })).toBe(false);
  });

  it('returns false when player too far', () => {
    expect(shouldTriggerProtectEvent({ ...baseCtx, playerToVillagerDist: 200 })).toBe(false);
  });

  it('returns false when already resolved', () => {
    expect(shouldTriggerProtectEvent({ ...baseCtx, protectResolved: true })).toBe(false);
  });

  it('uses 160 as trigger distance threshold', () => {
    expect(shouldTriggerProtectEvent({ ...baseCtx, playerToVillagerDist: 159 })).toBe(true);
    expect(shouldTriggerProtectEvent({ ...baseCtx, playerToVillagerDist: 161 })).toBe(false);
  });
});

describe('resolveProtectOutcome', () => {
  const baseCtx: ProtectOutcomeContext = {
    threatActive: true,
    threatToVillagerDist: 110,
  };

  it('returns success when threat inactive (defeated)', () => {
    expect(resolveProtectOutcome({ ...baseCtx, threatActive: false })).toBe('success');
  });

  it('returns failure when threat reaches villager (dist < 50)', () => {
    expect(resolveProtectOutcome({ ...baseCtx, threatToVillagerDist: 30 })).toBe('failure');
  });

  it('returns pending when threat active but not yet at villager', () => {
    expect(resolveProtectOutcome(baseCtx)).toBe('pending');
  });

  it('returns pending at exact boundary (dist = 50, strict less-than)', () => {
    expect(resolveProtectOutcome({ ...baseCtx, threatToVillagerDist: 50 })).toBe('pending');
  });
});
