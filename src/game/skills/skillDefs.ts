import type { Strike } from '../combat/CombatSystem';
import type { MoralTendency } from '../moral/MoralState';
import { DODGE_COUNTER_WINDOW_MS } from '../player/PlayerStateMachine';

/** 龙影九斩技能标识（前三式）。 */
export type SkillId = 'dragonLurk' | 'dragonReturn' | 'scaleBreak';

/** 技能形态修饰：根据心境调整伤害/范围/附加。 */
export type SkillFormModifier = {
  damageMultiplier: number;
  rangeMultiplier: number;
  /** 狂暴形态：释放者承受的自伤（占最大生命比例）。 */
  selfHarmRatio?: number;
  /** 守护形态：释放后减伤持续时间(ms)与减伤比例。 */
  guardReduceUntil?: { durationMs: number; ratio: number };
};

/** 形态修饰表：tendency → 该形态的数值调整。 */
export const SKILL_FORM_MODIFIERS: Record<MoralTendency, SkillFormModifier> = {
  balance: { damageMultiplier: 1, rangeMultiplier: 1 },
  wrath: { damageMultiplier: 1.4, rangeMultiplier: 1.3, selfHarmRatio: 0.08 },
  guard: {
    damageMultiplier: 1,
    rangeMultiplier: 0.8,
    guardReduceUntil: { durationMs: 500, ratio: 0.3 },
  },
};

/** 基础技能定义（形态化前的模板）。 */
export type SkillDef = {
  id: SkillId;
  /** 显示名（用于 HUD 图标占位）。 */
  label: string;
  /** 龙魂消耗。 */
  soulCost: number;
  /** 冷却时长(ms)。0 表示无冷却（受其他机制限制，如游龙回身的闪避后窗口）。 */
  cooldownMs: number;
  /** 基础 Strike 模板（形态化前）。 */
  strike: Strike;
  /** 潜龙出渊的突进距离；其余为 0。 */
  dashDistance: number;
};

export const SKILL_DEFS: Record<SkillId, SkillDef> = {
  // 一斩·潜龙出渊：突进斩
  dragonLurk: {
    id: 'dragonLurk',
    label: '潜',
    soulCost: 15,
    cooldownMs: 3000,
    strike: {
      damage: 16,
      guardDamage: 18,
      staminaDamage: 0,
      blockDamageMultiplier: 0.4,
      staggerDuration: 220,
    },
    dashDistance: 220,
  },
  // 二斩·游龙回身：闪避后反击斩（无冷却，受闪避后窗口限制）
  dragonReturn: {
    id: 'dragonReturn',
    label: '回',
    soulCost: 10,
    cooldownMs: 0,
    strike: {
      damage: 20,
      guardDamage: 22,
      staminaDamage: 0,
      blockDamageMultiplier: 0.45,
      staggerDuration: 260,
    },
    dashDistance: 0,
  },
  // 三斩·裂鳞破甲：高破防重斩
  scaleBreak: {
    id: 'scaleBreak',
    label: '裂',
    soulCost: 25,
    cooldownMs: 4000,
    strike: {
      damage: 22,
      guardDamage: 45,
      staminaDamage: 0,
      blockDamageMultiplier: 0.5,
      staggerDuration: 380,
    },
    dashDistance: 0,
  },
};

/** 游龙回身派生窗口：闪避成功后可派生的时间(ms)。单一来源：PlayerStateMachine。 */
export { DODGE_COUNTER_WINDOW_MS };

/** 守护形态减伤增益的 key（供 PlayerStateMachine 记录减伤窗口结束时间）。 */
export const GUARD_FORM_REDUCE_KEY = 'guardFormReduceUntil';
