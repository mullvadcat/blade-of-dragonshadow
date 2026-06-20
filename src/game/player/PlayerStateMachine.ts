import { CombatSystem, type CombatantState, type Strike } from '../combat/CombatSystem';

export type PlayerStateOptions = Partial<CombatantState>;

/** 举盾瞬间的完美格挡（听风断影）判定窗口。放宽以让格挡更从容。 */
export const PERFECT_GUARD_WINDOW_MS = 300;

/** 闪避后可派生"游龙回身"的窗口时长。 */
export const DODGE_COUNTER_WINDOW_MS = 400;

export class PlayerStateMachine {
  readonly state: CombatantState;
  private counterWindowUntil = 0;
  private dodgeCounterWindowUntil = 0;

  constructor(options: PlayerStateOptions = {}) {
    this.state = {
      health: 120,
      maxHealth: 120,
      guard: 0,
      maxGuard: 60,
      stamina: 60,
      maxStamina: 60,
      soul: 100,
      maxSoul: 100,
      isBlocking: false,
      perfectGuardUntil: 0,
      invulnerableUntil: 0,
      staggeredUntil: 0,
      ...options,
    };
  }

  /** 积累龙魂（战斗命中、完美格挡、击败精英）。clamp 到 maxSoul。 */
  addSoul(amount: number) {
    this.state.soul = Math.min(this.state.maxSoul, this.state.soul + Math.max(0, amount));
  }

  /** 消耗龙魂释放刀气/九斩。不足返回 false，足则扣除并返回 true。 */
  spendSoul(amount: number): boolean {
    if (this.state.soul < amount) {
      return false;
    }
    this.state.soul -= amount;
    return true;
  }

  tryDodge(now: number) {
    if (this.isDead() || this.state.stamina < 18 || this.state.isBlocking) {
      return false;
    }

    this.state.stamina -= 18;
    this.state.invulnerableUntil = now + 220;
    this.dodgeCounterWindowUntil = now + DODGE_COUNTER_WINDOW_MS;
    return true;
  }

  startBlocking(now: number) {
    if (this.isDead() || this.state.stamina <= 0) {
      return false;
    }

    this.state.isBlocking = true;
    this.state.perfectGuardUntil = now + PERFECT_GUARD_WINDOW_MS;
    return true;
  }

  stopBlocking() {
    this.state.isBlocking = false;
    this.state.perfectGuardUntil = 0;
  }

  tryLightAttack(_now: number): Strike | null {
    if (this.isDead() || this.state.isBlocking || this.state.stamina < 4) {
      return null;
    }

    this.state.stamina -= 4;
    return CombatSystem.createLightStrike();
  }

  tryHeavyAttack(_now: number): Strike | null {
    if (this.isDead() || this.state.isBlocking || this.state.stamina < 12) {
      return null;
    }

    this.state.stamina -= 12;
    return CombatSystem.createHeavyStrike();
  }

  /** 完美格挡（听风断影）后开启反击窗口，期间下一次攻击附带额外收益。 */
  grantCounterWindow(until: number) {
    this.counterWindowUntil = until;
  }

  /** 若仍在反击窗口内则消费之并返回 true，否则返回 false。 */
  consumeCounterWindow(now: number) {
    if (now <= this.counterWindowUntil) {
      this.counterWindowUntil = 0;
      return true;
    }
    return false;
  }

  /** 当前是否处于闪避后派生窗口（游龙回身可用）。 */
  isInDodgeCounterWindow(now: number): boolean {
    return now < this.dodgeCounterWindowUntil;
  }

  /** 消费闪避后派生窗口；窗口内返回 true 并清零，否则 false。 */
  consumeDodgeCounterWindow(now: number): boolean {
    if (now < this.dodgeCounterWindowUntil) {
      this.dodgeCounterWindowUntil = 0;
      return true;
    }
    return false;
  }

  recoverStamina(amount: number) {
    if (this.isDead()) {
      return;
    }
    this.state.stamina = Math.min(this.state.maxStamina, this.state.stamina + amount);
  }

  takeDamage(amount: number) {
    if (this.isDead()) {
      return 0;
    }

    const previousHealth = this.state.health;
    this.state.health = Math.max(0, this.state.health - Math.max(0, amount));
    if (this.isDead()) {
      this.state.isBlocking = false;
      this.state.perfectGuardUntil = 0;
      this.state.invulnerableUntil = 0;
      this.state.staggeredUntil = 0;
    }
    return previousHealth - this.state.health;
  }

  reset() {
    this.state.health = this.state.maxHealth;
    this.state.stamina = this.state.maxStamina;
    this.state.guard = 0;
    this.state.soul = 0;
    this.state.isBlocking = false;
    this.state.perfectGuardUntil = 0;
    this.state.invulnerableUntil = 0;
    this.state.staggeredUntil = 0;
    this.counterWindowUntil = 0;
    this.dodgeCounterWindowUntil = 0;
  }

  isDead() {
    return this.state.health <= 0;
  }
}
