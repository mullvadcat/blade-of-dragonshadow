/**
 * 第一章战斗数值集中表。
 *
 * 把原先散落在 CombatDirector 各处的调参常量（命中判定范围、龙魂/戾气/守心奖励、
 * 完美格挡反击增幅）收到一处，便于平衡调整与对照。不含纯表现值（tween 时长、tint
 * 颜色、镜头抖动）——那些属于演出，留在使用处。
 */
export const COMBAT_BALANCE = {
  /** 近战命中判定半径（矩形，以攻击者为中心）。技能形态会再乘 rangeMultiplier。 */
  meleeRange: {
    enemyX: 92,
    enemyY: 86,
    bossX: 112,
    bossY: 94,
  },
  /** 龙魂积累。 */
  soulReward: {
    meleeHit: 3,
    kill: 5,
    bladeAuraHit: 2,
    perfectGuard: 6,
  },
  /** 戾气积累。 */
  liqiReward: {
    kill: 10,
    bladeAuraKill: 8,
    allyHarm: 12,
  },
  /** 守心积累。 */
  shouxinReward: {
    perfectGuard: 8,
  },
  /** 完美格挡反击增幅：伤害倍率与破防量（999 视为必破）。 */
  empoweredCounter: {
    damageMultiplier: 1.6,
    guardDamage: 999,
  },
} as const;
