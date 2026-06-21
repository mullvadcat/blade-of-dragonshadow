export type CombatantState = {
  health: number;
  maxHealth: number;
  guard: number;
  maxGuard: number;
  stamina: number;
  maxStamina: number;
  /** 龙魂值：玩家侧能量池，用于刀气与龙影九斩；敌人侧留 0。 */
  soul: number;
  maxSoul: number;
  isBlocking: boolean;
  perfectGuardUntil: number;
  invulnerableUntil: number;
  staggeredUntil: number;
};

export type Strike = {
  damage: number;
  guardDamage: number;
  staminaDamage: number;
  blockDamageMultiplier: number;
  staggerDuration: number;
  isPoiseBreaker?: boolean; // 仅裂鳞破甲设为 true，BossIronArmLuo 内部消费
};

export type StrikeResult = {
  target: CombatantState;
  damageDealt: number;
  guardDamageDealt: number;
  wasGuardBroken: boolean;
  wasPerfectGuard: boolean;
  counterWindowUntil: number | null;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export class CombatSystem {
  static createLightStrike(): Strike {
    return {
      damage: 12,
      guardDamage: 12,
      staminaDamage: 6,
      blockDamageMultiplier: 0.35,
      staggerDuration: 180,
    };
  }

  static createHeavyStrike(): Strike {
    return {
      damage: 24,
      guardDamage: 28,
      staminaDamage: 14,
      blockDamageMultiplier: 0.3,
      staggerDuration: 420,
    };
  }

  /** 刀气（远程斩击）：直线飞行，消耗龙魂，破邪术/远程压制。伤害介于轻斩与重斩之间。 */
  static createBladeAuraStrike(): Strike {
    return {
      damage: 18,
      guardDamage: 20,
      staminaDamage: 0,
      blockDamageMultiplier: 0.5,
      staggerDuration: 240,
    };
  }

  /** 释放刀气所需龙魂。 */
  static readonly BLADE_AURA_SOUL_COST = 25;

  static resolveStrike(strike: Strike, target: CombatantState, now: number): StrikeResult {
    const nextTarget = { ...target };

    if (now < nextTarget.invulnerableUntil) {
      return {
        target: nextTarget,
        damageDealt: 0,
        guardDamageDealt: 0,
        wasGuardBroken: false,
        wasPerfectGuard: false,
        counterWindowUntil: null,
      };
    }

    if (nextTarget.isBlocking && now <= nextTarget.perfectGuardUntil) {
      nextTarget.stamina = clamp(
        nextTarget.stamina - Math.ceil(strike.staminaDamage / 2),
        0,
        nextTarget.maxStamina,
      );

      return {
        target: nextTarget,
        damageDealt: 0,
        guardDamageDealt: 0,
        wasGuardBroken: false,
        wasPerfectGuard: true,
        counterWindowUntil: now + 280,
      };
    }

    const damageDealt = nextTarget.isBlocking
      ? Math.floor(strike.damage * strike.blockDamageMultiplier)
      : strike.damage;
    const guardDamageDealt = strike.guardDamage;

    nextTarget.health = clamp(nextTarget.health - damageDealt, 0, nextTarget.maxHealth);
    nextTarget.guard = clamp(nextTarget.guard + guardDamageDealt, 0, nextTarget.maxGuard);

    if (nextTarget.isBlocking) {
      nextTarget.stamina = clamp(
        nextTarget.stamina - strike.staminaDamage,
        0,
        nextTarget.maxStamina,
      );
    }

    const wasGuardBroken = nextTarget.guard >= nextTarget.maxGuard;
    if (wasGuardBroken) {
      nextTarget.guard = 0;
      nextTarget.staggeredUntil = now + strike.staggerDuration;
    }

    return {
      target: nextTarget,
      damageDealt,
      guardDamageDealt,
      wasGuardBroken,
      wasPerfectGuard: false,
      counterWindowUntil: null,
    };
  }
}
