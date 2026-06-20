/**
 * 戾气 / 守心双值系统（《龙刃归鞘》差异化核心）。
 *
 * 双值独立、互为拉扯（非单一滑条）：
 * - 涨戾气时守心轻微下降（反之亦然），但损耗小于增量（不对称，防刷值）。
 * - tendency 由两值之差判定，决定刀身颜色、画面边缘晕染、技能形态。
 *
 * PRD §7.3 红线：道德倾向优先通过刀身颜色 + 画面边缘红/青晕染呈现，弱化裸数字条。
 * 故本类对外提供 bladeColor() / edgeTint() 两个可视化接口。
 */
export type MoralTendency = 'wrath' | 'guard' | 'balance';

export type EdgeTint = {
  color: number;
  alpha: number;
};

const MAX = 100;
const WRATH_COLOR = 0xff3d4f;
const GUARD_COLOR = 0xaefaff;
const TENDENCY_THRESHOLD = 12; // 两值之差超过此值才脱离 balance
const TUG_RATIO = 0.25; // 涨一边时另一边损耗的比例（不对称：损耗 < 增量）

const clamp = (v: number) => Math.min(MAX, Math.max(0, v));

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const lerpColor = (c1: number, c2: number, t: number) => {
  const r = Math.round(lerp((c1 >> 16) & 0xff, (c2 >> 16) & 0xff, t));
  const g = Math.round(lerp((c1 >> 8) & 0xff, (c2 >> 8) & 0xff, t));
  const b = Math.round(lerp(c1 & 0xff, c2 & 0xff, t));
  return (r << 16) | (g << 8) | b;
};

export class MoralState {
  liqi = 0;
  shouxin = 0;

  /** 涨戾气：守心被轻微拉低（损耗 = 增量 × TUG_RATIO，不对称防刷值）。 */
  addLiqi(amount: number) {
    const gain = Math.max(0, amount);
    this.liqi = clamp(this.liqi + gain);
    this.shouxin = clamp(this.shouxin - gain * TUG_RATIO);
  }

  /** 涨守心：戾气被轻微拉低。 */
  addShouxin(amount: number) {
    const gain = Math.max(0, amount);
    this.shouxin = clamp(this.shouxin + gain);
    this.liqi = clamp(this.liqi - gain * TUG_RATIO);
  }

  get tendency(): MoralTendency {
    const diff = this.liqi - this.shouxin;
    if (diff > TENDENCY_THRESHOLD) return 'wrath';
    if (diff < -TENDENCY_THRESHOLD) return 'guard';
    return 'balance';
  }

  /**
   * 刀身 / 刀光颜色：根据戾气相对守心的优势，在青白(守) ↔ 红(怒)间插值。
   * 平衡态返回青白；戾气主导则向红偏移；守心主导则保持青白偏亮。
   */
  bladeColor(): number {
    const diff = this.liqi - this.shouxin;
    if (diff <= 0) {
      // 守心主导或平衡：青白（克制之色），守心越高不变红，仅保持青白
      return GUARD_COLOR;
    }
    // 戾气主导：青白 → 红
    const t = Math.min(1, diff / MAX);
    return lerpColor(GUARD_COLOR, WRATH_COLOR, t);
  }

  /**
   * 画面边缘晕染：戾气强 → 红色边缘，守心强 → 青色边缘，alpha 随强度增长（封顶 0.5）。
   */
  edgeTint(): EdgeTint {
    const diff = this.liqi - this.shouxin;
    if (diff > 0) {
      return { color: WRATH_COLOR, alpha: Math.min(0.5, (diff / MAX) * 0.5) };
    }
    if (diff < 0) {
      return { color: GUARD_COLOR, alpha: Math.min(0.5, (-diff / MAX) * 0.5) };
    }
    return { color: WRATH_COLOR, alpha: 0 };
  }

  reset() {
    this.liqi = 0;
    this.shouxin = 0;
  }
}
