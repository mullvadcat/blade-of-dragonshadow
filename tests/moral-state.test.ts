import { describe, expect, it } from 'vitest';
import { MoralState } from '../src/game/moral/MoralState';

describe('MoralState', () => {
  it('starts at zero liqi and shouxin with balance tendency', () => {
    const moral = new MoralState();

    expect(moral.liqi).toBe(0);
    expect(moral.shouxin).toBe(0);
    expect(moral.tendency).toBe('balance');
  });

  it('adds liqi and clamps to max', () => {
    const moral = new MoralState();

    moral.addLiqi(30);
    expect(moral.liqi).toBe(30);

    moral.addLiqi(200);
    expect(moral.liqi).toBe(100);
  });

  it('adds shouxin and clamps to max', () => {
    const moral = new MoralState();

    moral.addShouxin(40);
    expect(moral.shouxin).toBe(40);

    moral.addShouxin(200);
    expect(moral.shouxin).toBe(100);
  });

  it('rising liqi slightly erodes shouxin (mutual tug, asymmetric)', () => {
    const moral = new MoralState();
    moral.addShouxin(60);
    expect(moral.shouxin).toBe(60);

    moral.addLiqi(20);
    // 戾气上涨会拉低守心，但损耗小于戾气增量（不对称，防刷值）
    expect(moral.shouxin).toBeLessThan(60);
    expect(moral.shouxin).toBeGreaterThan(40);
    expect(moral.liqi).toBe(20);
  });

  it('rising shouxin slightly erodes liqi (mutual tug, asymmetric)', () => {
    const moral = new MoralState();
    moral.addLiqi(50);
    expect(moral.liqi).toBe(50);

    moral.addShouxin(30);
    expect(moral.liqi).toBeLessThan(50);
    expect(moral.liqi).toBeGreaterThan(30);
    expect(moral.shouxin).toBe(30);
  });

  it('tendency becomes wrath when liqi dominates', () => {
    const moral = new MoralState();
    moral.addLiqi(60);

    expect(moral.tendency).toBe('wrath');
  });

  it('tendency becomes guard when shouxin dominates', () => {
    const moral = new MoralState();
    moral.addShouxin(60);

    expect(moral.tendency).toBe('guard');
  });

  it('tendency stays balance when liqi and shouxin are close', () => {
    const moral = new MoralState();
    moral.addLiqi(20);
    moral.addShouxin(18);

    expect(moral.tendency).toBe('balance');
  });

  it('bladeColor interpolates from cyan (balance) to red (wrath)', () => {
    const balance = new MoralState();
    expect(balance.bladeColor()).toBe(0xaefaff);

    const wrath = new MoralState();
    wrath.addLiqi(100);
    expect(wrath.bladeColor()).toBe(0xff3d4f);

    const partial = new MoralState();
    partial.addLiqi(50);
    const c = partial.bladeColor();
    // 偏红但不是纯红：R 分量高，G/B 介于中间
    expect((c >> 16) & 0xff).toBeGreaterThan(0xae);
    expect((c >> 8) & 0xff).toBeLessThan(0xfa);
  });

  it('bladeColor shifts toward cyan-white when guard dominates', () => {
    const guard = new MoralState();
    guard.addShouxin(100);
    // 守心主导：青白偏亮，不变红
    const c = guard.bladeColor();
    expect((c >> 16) & 0xff).toBeLessThanOrEqual(0xae);
  });

  it('edgeTint returns red color with alpha scaled by liqi strength', () => {
    const balance = new MoralState();
    expect(balance.edgeTint().color).toBe(0xff3d4f);
    expect(balance.edgeTint().alpha).toBe(0);

    const wrath = new MoralState();
    wrath.addLiqi(100);
    expect(wrath.edgeTint().color).toBe(0xff3d4f);
    expect(wrath.edgeTint().alpha).toBeGreaterThan(0);
    expect(wrath.edgeTint().alpha).toBeLessThanOrEqual(0.5);
  });

  it('edgeTint returns cyan color when guard dominates', () => {
    const guard = new MoralState();
    guard.addShouxin(80);
    expect(guard.edgeTint().color).toBe(0xaefaff);
    expect(guard.edgeTint().alpha).toBeGreaterThan(0);
  });

  it('reset clears both values', () => {
    const moral = new MoralState();
    moral.addLiqi(50);
    moral.addShouxin(40);

    moral.reset();

    expect(moral.liqi).toBe(0);
    expect(moral.shouxin).toBe(0);
    expect(moral.tendency).toBe('balance');
  });
});
