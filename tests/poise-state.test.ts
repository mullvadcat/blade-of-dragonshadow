import { describe, expect, it } from 'vitest';
import {
  createPoise,
  takePoiseDamage,
  resetPoise,
  isPoiseBreaking,
  isStaggering,
  type PoiseState,
} from '../src/game/flow/poiseState';

describe('createPoise', () => {
  it('初始化时 current === max，brokenAt === 0', () => {
    const state = createPoise(100);
    expect(state.current).toBe(100);
    expect(state.max).toBe(100);
    expect(state.brokenAt).toBe(0);
    expect(state.staggerDuration).toBe(1500);
  });
});

describe('takePoiseDamage', () => {
  it('减少 current 值', () => {
    const state = createPoise(100);
    const next = takePoiseDamage(state, 40);
    expect(next.current).toBe(60);
  });

  it('累积减少：两次 40 → current 为 20', () => {
    const state = takePoiseDamage(takePoiseDamage(createPoise(100), 40), 40);
    expect(state.current).toBe(20);
  });

  it('不低于 0', () => {
    const state = takePoiseDamage(createPoise(100), 999);
    expect(state.current).toBe(0);
  });

  it('不改变 max', () => {
    const state = takePoiseDamage(createPoise(100), 40);
    expect(state.max).toBe(100);
  });
});

describe('isPoiseBreaking', () => {
  it('current > 0 时为 false', () => {
    expect(isPoiseBreaking(createPoise(100))).toBe(false);
  });

  it('current === 0 时为 true', () => {
    expect(isPoiseBreaking(takePoiseDamage(createPoise(100), 100))).toBe(true);
  });
});

describe('isStaggering', () => {
  it('brokenAt === 0 时为 false（未破防）', () => {
    const state: PoiseState = { current: 0, max: 100, brokenAt: 0, staggerDuration: 1500 };
    expect(isStaggering(state, 500)).toBe(false);
  });

  it('brokenAt > 0 且 now 在硬直窗口内为 true', () => {
    const state: PoiseState = { current: 0, max: 100, brokenAt: 1000, staggerDuration: 1500 };
    expect(isStaggering(state, 1500)).toBe(true);
  });

  it('硬直结束后（now >= brokenAt + staggerDuration）为 false', () => {
    const state: PoiseState = { current: 0, max: 100, brokenAt: 1000, staggerDuration: 1500 };
    expect(isStaggering(state, 2500)).toBe(false);
  });
});

describe('resetPoise', () => {
  it('重置 current 为 max，清除 brokenAt', () => {
    const broken: PoiseState = { current: 0, max: 100, brokenAt: 1000, staggerDuration: 1500 };
    const reset = resetPoise(broken);
    expect(reset.current).toBe(100);
    expect(reset.brokenAt).toBe(0);
    expect(reset.max).toBe(100);
  });
});
