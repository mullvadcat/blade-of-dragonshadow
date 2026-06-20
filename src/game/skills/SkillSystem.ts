import type { Strike } from '../combat/CombatSystem';
import type { MoralState } from '../moral/MoralState';
import {
  SKILL_DEFS,
  SKILL_FORM_MODIFIERS,
  type SkillId,
  type SkillFormModifier,
} from './skillDefs';

export type SkillCastResult = {
  skillId: SkillId;
  /** 形态化后的最终 Strike（含伤害/破防调整）。 */
  strike: Strike;
  /** 实际消耗的龙魂。 */
  soulSpent: number;
  /** 突进距离（已按形态 rangeMultiplier 调整）。 */
  dashDistance: number;
  /** 命中范围倍率（供 CombatDirector 调整命中判定半径）。 */
  rangeMultiplier: number;
  /** 狂暴形态自伤（占最大生命的伤害值，已换算为绝对值）。0 表示无自伤。 */
  selfHarm: number;
  /** 守护形态减伤窗口结束时间；null 表示无减伤。 */
  guardReduceUntil: number | null;
  /** 守护形态减伤比例（如 0.3 表示减伤30%）；0 表示无减伤。供 CombatDirector 从结果读取，避免硬编码。 */
  guardReduceRatio: number;
  /** 狂暴形态：本次释放是否波及盟友。供 CombatDirector 做误伤判定。 */
  hitsAllies: boolean;
  /** 本次释放所用的形态修饰。 */
  form: SkillFormModifier;
};

/**
 * 龙影九斩技能系统：管理冷却、龙魂消耗、形态化释放。
 * 形态由玩家 MoralState.tendency 决定，自动调整伤害/范围/附加效果。
 */
export class SkillSystem {
  private lastCastAt: Record<SkillId, number> = {
    dragonLurk: 0,
    dragonReturn: 0,
    scaleBreak: 0,
  };

  constructor(private readonly moral: MoralState) {}

  /** 该技能当前是否可释放（冷却结束）。不检查龙魂。 */
  isReady(id: SkillId, now: number): boolean {
    const def = SKILL_DEFS[id];
    if (def.cooldownMs <= 0) {
      return true;
    }
    // lastCastAt=0 表示从未释放过，视为就绪（避免把 0 当成"上次释放时刻"）
    if (this.lastCastAt[id] === 0) {
      return true;
    }
    return now >= this.lastCastAt[id] + def.cooldownMs;
  }

  /** 冷却剩余毫秒（用于 HUD 暗化）。 */
  cooldownRemaining(id: SkillId, now: number): number {
    const def = SKILL_DEFS[id];
    if (def.cooldownMs <= 0 || this.lastCastAt[id] === 0) {
      return 0;
    }
    return Math.max(0, this.lastCastAt[id] + def.cooldownMs - now);
  }

  /** 记录一次释放（用于游龙回身派生等外部触发场景，跳过龙魂/冷却检查）。 */
  recordCast(id: SkillId, now: number) {
    this.lastCastAt[id] = now;
  }

  /**
   * 尝试释放技能：检查冷却 + 龙魂，通过则按当前形态化 Strike 并返回结果。
   * 调用方负责扣减龙魂（soulSpent 已在结果中给出）。
   * @param currentSoul 当前龙魂值
   * @param maxHealth 玩家最大生命（用于换算狂暴自伤绝对值）
   */
  tryRelease(id: SkillId, now: number, currentSoul: number, maxHealth: number): SkillCastResult | null {
    const def = SKILL_DEFS[id];
    if (!this.isReady(id, now)) {
      return null;
    }
    if (currentSoul < def.soulCost) {
      return null;
    }

    this.recordCast(id, now);
    const form = SKILL_FORM_MODIFIERS[this.moral.tendency];

    const strike: Strike = {
      ...def.strike,
      damage: Math.round(def.strike.damage * form.damageMultiplier),
      guardDamage: Math.round(def.strike.guardDamage * form.damageMultiplier),
    };

    const selfHarm = form.selfHarmRatio ? Math.round(maxHealth * form.selfHarmRatio) : 0;
    const guardReduceUntil = form.guardReduceUntil ? now + form.guardReduceUntil.durationMs : null;
    const guardReduceRatio = form.guardReduceUntil?.ratio ?? 0;
    const dashDistance = Math.round(def.dashDistance * form.rangeMultiplier);

    return {
      skillId: id,
      strike,
      soulSpent: def.soulCost,
      dashDistance,
      rangeMultiplier: form.rangeMultiplier,
      selfHarm,
      guardReduceUntil,
      guardReduceRatio,
      hitsAllies: form.hitsAllies ?? false,
      form,
    };
  }

  reset() {
    this.lastCastAt = { dragonLurk: 0, dragonReturn: 0, scaleBreak: 0 };
  }
}
