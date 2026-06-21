import Phaser from 'phaser';
import { type Strike, type StrikeResult } from '../combat/CombatSystem';
import { CombatActor } from './CombatActor';
import { COMBAT_BALANCE } from '../combat/combatBalance';
import {
  createPoise,
  takePoiseDamage,
  resetPoise,
  isPoiseBreaking,
  isStaggering,
  type PoiseState,
} from '../flow/poiseState';
import type { SfxName } from '../audio/AudioDirector';

type Phase2AiState = 'rage_idle' | 'rush_windup' | 'grab_windup';

export class BossIronArmLuo extends CombatActor {
  private phase: 1 | 2 = 1;
  private isGuarding = true;
  private poise: PoiseState;
  private phase2State: Phase2AiState = 'rage_idle';
  private phase2WindupUntil = 0;
  private phase2NextAttackAt = 0;
  private readonly poiseBar: Phaser.GameObjects.Graphics;
  private readonly poiseBarBg: Phaser.GameObjects.Graphics;
  private readonly POISE_BAR_W = 156;
  private readonly POISE_BAR_H = 5;

  constructor(scene: Phaser.Scene, x: number, y: number, playSfx?: (name: SfxName) => void) {
    const bal = COMBAT_BALANCE.ch2Boss;
    super(scene, x, y, {
      texture: 'boss-iron-arm',
      combatState: {
        health: bal.hp,
        maxHealth: bal.hp,
        guard: 0,
        maxGuard: 0,
        stamina: 100,
        maxStamina: 100,
        soul: 0,
        maxSoul: 0,
        isBlocking: false,
        perfectGuardUntil: 0,
        invulnerableUntil: 0,
        staggeredUntil: 0,
      },
      bodySize: [52, 80],
      depth: 11,
      attackRange: 160,
      hitTint: 0xff8030,
      hitFlashMs: 100,
      telegraphColor: 0xff6600,
      strikeColor: 0xff4400,
      defeatSfx: 'bossDown',
      playSfx,
      nameplate: {
        text: '铁臂罗',
        style: {
          color: '#f5c518',
          fontFamily: 'serif',
          fontSize: '18px',
          stroke: '#2a1800',
          strokeThickness: 4,
        },
        offsetY: -80,
      },
      healthBar: {
        width: 156,
        height: 8,
        fillColor: 0xd27020,
        lowColor: 0xff4400,
        borderColor: 0x2a1800,
        depth: 22,
        offsetX: -78,
        offsetY: -62,
      },
    });

    this.poise = createPoise(bal.poiseMax);
    this.poiseBarBg = scene.add.graphics().setDepth(22);
    this.poiseBar = scene.add.graphics().setDepth(23);
  }

  update(time: number, playerX: number) {
    if (!this.active) return;

    const bal = COMBAT_BALANCE.ch2Boss;

    // Phase 转换（不可逆）
    if (this.phase === 1 && this.combatState.health <= this.combatState.maxHealth * bal.phaseThreshold) {
      this.enterPhase2();
    }

    // 硬直结束后重置破防（Phase 1）
    if (this.phase === 1 && this.poise.brokenAt > 0 && !isStaggering(this.poise, time)) {
      this.poise = resetPoise(this.poise);
      this.isGuarding = true;
      this.clearTint();
    }

    const speed = this.phase === 2 ? 110 : 80;
    this.chase(time, playerX, speed, 74, 460);

    if (this.phase === 1 && this.isGuarding) {
      this.setTint(0xd4a020);
    } else if (this.phase === 2) {
      this.setTint(0xff5500);
    }

    this.followUi();
    this.updatePoiseBarGfx(time);
  }

  override advanceAttack(time: number, playerX: number): Strike | null {
    if (!this.active) return null;
    if (this.phase === 1) return super.advanceAttack(time, playerX);
    return this.advancePhase2Attack(time, playerX);
  }

  override receiveStrike(strike: Strike, time: number): StrikeResult {
    const effective = this.adjustStrikeForGuard(strike, time);
    const result = super.receiveStrike(effective, time);
    this.checkPhaseTransition();
    return result;
  }

  protected buildStrike(): Strike {
    const bal = COMBAT_BALANCE.ch2Boss;
    return {
      damage: bal.heavyPunchDamage,
      guardDamage: bal.heavyPunchGuardDamage,
      staminaDamage: 8,
      blockDamageMultiplier: 0.45,
      staggerDuration: 280,
    };
  }

  protected attackInterval(): number {
    return 2800;
  }

  protected telegraphMs(): number {
    return 800;
  }

  private adjustStrikeForGuard(strike: Strike, time: number): Strike {
    if (this.phase !== 1 || !this.isGuarding) return strike;

    if (strike.isPoiseBreaker) {
      this.poise = takePoiseDamage(this.poise, COMBAT_BALANCE.ch2Boss.poiseDamageBreak);
      if (isPoiseBreaking(this.poise)) {
        this.poise = { ...this.poise, brokenAt: time };
        this.isGuarding = false;
        this.combatState.staggeredUntil = time + COMBAT_BALANCE.ch2Boss.staggerDuration;
      }
      return { ...strike, damage: 0, guardDamage: 0, staggerDuration: 0 };
    }

    // 普通攻击：减免 70%
    return {
      ...strike,
      damage: Math.round(strike.damage * (1 - COMBAT_BALANCE.ch2Boss.guardDamageReduction)),
      staggerDuration: 0,
    };
  }

  private checkPhaseTransition() {
    const bal = COMBAT_BALANCE.ch2Boss;
    if (
      this.phase === 1 &&
      this.combatState.health > 0 &&
      this.combatState.health <= this.combatState.maxHealth * bal.phaseThreshold
    ) {
      this.enterPhase2();
    }
  }

  private enterPhase2() {
    this.phase = 2;
    this.isGuarding = false;
    this.poiseBar.setVisible(false);
    this.poiseBarBg.setVisible(false);
  }

  private advancePhase2Attack(time: number, playerX: number): Strike | null {
    const dist = Math.abs(playerX - this.x);
    const bal = COMBAT_BALANCE.ch2Boss;

    if (this.phase2WindupUntil > 0) {
      if (time < this.phase2WindupUntil) return null;

      const state = this.phase2State;
      this.phase2WindupUntil = 0;
      this.phase2State = 'rage_idle';
      this.phase2NextAttackAt = time + 2000;

      if (state === 'grab_windup') {
        return {
          damage: bal.grabDamage,
          guardDamage: bal.grabGuardDamage,
          staminaDamage: 16,
          blockDamageMultiplier: 0.6,
          staggerDuration: 400,
        };
      }
      return {
        damage: bal.rushPunchDamage,
        guardDamage: bal.rushPunchGuardDamage,
        staminaDamage: 10,
        blockDamageMultiplier: 0.4,
        staggerDuration: 260,
      };
    }

    if (time < this.phase2NextAttackAt) return null;

    if (dist < 80 && this.phase2State === 'rage_idle') {
      this.phase2State = 'grab_windup';
      this.phase2WindupUntil = time + 600;
      this.playSfx('enemyAttack');
    } else if (dist < 160 && this.phase2State === 'rage_idle') {
      this.phase2State = 'rush_windup';
      this.phase2WindupUntil = time + 400;
      this.playSfx('enemyAttack');
    }

    return null;
  }

  private updatePoiseBarGfx(now: number) {
    if (this.phase !== 1) return;

    const barX = this.x - 78;
    const barY = this.y - 72;
    const ratio = this.poise.current / this.poise.max;
    const staggering = isStaggering(this.poise, now);

    this.poiseBarBg.clear();
    this.poiseBarBg
      .fillStyle(0x2a1800, 0.8)
      .fillRect(barX - 1, barY - 1, this.POISE_BAR_W + 2, this.POISE_BAR_H + 2);

    this.poiseBar.clear();
    if (ratio > 0) {
      const color = staggering ? 0xffffff : 0xf5c518;
      const alpha = staggering ? (Math.floor(now / 200) % 2 === 0 ? 0.4 : 1.0) : 1.0;
      this.poiseBar
        .fillStyle(color, alpha)
        .fillRect(barX, barY, Math.round(this.POISE_BAR_W * ratio), this.POISE_BAR_H);
    }
  }

  protected override onDefeat() {
    this.poiseBar.destroy();
    this.poiseBarBg.destroy();
  }
}
