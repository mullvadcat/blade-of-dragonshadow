import Phaser from 'phaser';
import {
  CombatSystem,
  type CombatantState,
  type Strike,
  type StrikeResult,
} from '../combat/CombatSystem';
import { HealthBar, type HealthBarOptions } from '../ui/HealthBar';
import type { SfxName } from '../audio/AudioDirector';

export type CombatActorConfig = {
  texture: string;
  combatState: CombatantState;
  bodySize: [width: number, height: number];
  depth: number;
  attackRange: number;
  hitTint: number;
  hitFlashMs: number;
  /** 出招前摇预警的颜色（玩家据此判断"要被打了"）。 */
  telegraphColor: number;
  /** 斩击命中瞬间的刀光颜色。 */
  strikeColor: number;
  /** 死亡时播放的音效。 */
  defeatSfx: SfxName;
  nameplate: {
    text: string;
    style: Phaser.Types.GameObjects.Text.TextStyle;
    offsetY: number;
  };
  healthBar: HealthBarOptions & { offsetX: number; offsetY: number };
  /** 一次性音效回调（由场景注入，转发到 AudioDirector）。 */
  playSfx?: (name: SfxName) => void;
};

/**
 * Enemy 与 BossWuzhen 共享的敌方角色基类：封装物理体、名牌 / 血条的创建与跟随、
 * 追逐移动、**带前摇预警的出招流程**、受击结算与死亡清理。
 *
 * 出招分两拍：先 telegraph（蓄力预警，画面给出可见信号且冻步），到点后才真正落招并
 * 返回 Strike 交给场景结算。这样玩家能"看见"敌人出招，并有时间格挡 / 闪避。
 */
export abstract class CombatActor extends Phaser.Physics.Arcade.Sprite {
  readonly combatState: CombatantState;
  protected nextAttackAt = 0;
  protected readonly nameplate: Phaser.GameObjects.Text;
  protected readonly healthBar: HealthBar;
  protected readonly playSfx: (name: SfxName) => void;
  private readonly attackRange: number;
  private readonly hitTint: number;
  private readonly hitFlashMs: number;
  private readonly telegraphColor: number;
  private readonly strikeColor: number;
  private readonly defeatSfx: SfxName;
  private readonly nameplateOffsetY: number;
  private readonly healthBarOffsetX: number;
  private readonly healthBarOffsetY: number;
  private windupUntil = 0;
  private telegraphDir: -1 | 1 = 1;
  private telegraphGfx: Phaser.GameObjects.Arc | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, config: CombatActorConfig) {
    super(scene, x, y, config.texture);
    this.combatState = config.combatState;
    this.attackRange = config.attackRange;
    this.hitTint = config.hitTint;
    this.hitFlashMs = config.hitFlashMs;
    this.telegraphColor = config.telegraphColor;
    this.strikeColor = config.strikeColor;
    this.defeatSfx = config.defeatSfx;
    this.nameplateOffsetY = config.nameplate.offsetY;
    this.healthBarOffsetX = config.healthBar.offsetX;
    this.healthBarOffsetY = config.healthBar.offsetY;
    this.playSfx = config.playSfx ?? (() => {});

    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(config.bodySize[0], config.bodySize[1]);
    body.setCollideWorldBounds(true);
    this.setDepth(config.depth);

    this.nameplate = scene.add
      .text(x, y + config.nameplate.offsetY, config.nameplate.text, config.nameplate.style)
      .setOrigin(0.5)
      .setDepth(20);

    this.healthBar = new HealthBar(
      scene,
      x + config.healthBar.offsetX,
      y + config.healthBar.offsetY,
      config.healthBar,
    );
  }

  /** 子类提供：本次攻击的伤害数据。 */
  protected abstract buildStrike(): Strike;
  /** 子类提供：两次攻击之间的冷却（毫秒）。 */
  protected abstract attackInterval(): number;
  /** 子类提供：出招前摇预警时长（毫秒）。越长越好反应。 */
  protected abstract telegraphMs(): number;

  /** 是否处于出招前摇中（用于冻步，让预警更清晰）。 */
  protected isWindingUp(time: number) {
    return time < this.windupUntil;
  }

  /** 追逐玩家：硬直 / 出招前摇中停步，否则在 [minDist, maxDist] 区间内朝玩家移动。 */
  protected chase(time: number, playerX: number, speed: number, minDist: number, maxDist: number) {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const distance = playerX - this.x;

    if (time < this.combatState.staggeredUntil || this.isWindingUp(time)) {
      body.setVelocityX(0);
    } else if (Math.abs(distance) > minDist && Math.abs(distance) < maxDist) {
      body.setVelocityX(Math.sign(distance) * speed);
      this.setFlipX(distance < 0);
    } else {
      body.setVelocityX(0);
    }

    return distance;
  }

  /** 每帧让名牌、血条与预警特效跟随本体。 */
  protected followUi() {
    this.nameplate.setPosition(this.x, this.y + this.nameplateOffsetY);
    this.healthBar.setPosition(this.x + this.healthBarOffsetX, this.y + this.healthBarOffsetY);
    this.healthBar.update(this.combatState.health, this.combatState.maxHealth);
    this.telegraphGfx?.setPosition(this.x + this.telegraphDir * 26, this.y - 8);
  }

  /**
   * 推进出招状态机。返回非 null 表示本帧落招，场景应据此结算伤害。
   * 流程：就绪 → 起手预警(telegraph) → 到点落招(返回 Strike)。
   */
  advanceAttack(time: number, playerX: number): Strike | null {
    if (!this.active) {
      return null;
    }

    // 被打断硬直：取消正在蓄力的攻击。
    if (time < this.combatState.staggeredUntil) {
      this.cancelTelegraph();
      return null;
    }

    if (this.windupUntil > 0) {
      if (time >= this.windupUntil) {
        this.windupUntil = 0;
        this.nextAttackAt = time + this.attackInterval();
        this.showStrike(this.telegraphDir);
        return this.buildStrike();
      }
      return null; // 仍在前摇中。
    }

    if (time >= this.nextAttackAt && Math.abs(playerX - this.x) < this.attackRange) {
      this.telegraphDir = playerX >= this.x ? 1 : -1;
      this.setFlipX(this.telegraphDir < 0);
      this.windupUntil = time + this.telegraphMs();
      this.showTelegraph();
      this.playSfx('enemyAttack');
    }

    return null;
  }

  receiveStrike(strike: Strike, time: number): StrikeResult {
    const result = CombatSystem.resolveStrike(strike, this.combatState, time);
    Object.assign(this.combatState, result.target);

    if (this.combatState.health <= 0) {
      this.defeat();
      return result;
    }

    this.setTint(result.wasGuardBroken ? 0x9cf4ff : this.hitTint);
    this.scene.time.delayedCall(this.hitFlashMs, () => {
      if (this.active) {
        this.clearTint();
      }
    });

    return result;
  }

  /** 子类可覆写以清理额外的视觉对象（如 Boss 光环）。 */
  protected onDefeat() {}

  private clearTelegraphGfx() {
    if (this.telegraphGfx) {
      this.scene.tweens.killTweensOf(this.telegraphGfx);
      this.telegraphGfx.destroy();
      this.telegraphGfx = null;
    }
  }

  private showTelegraph() {
    // 只清理上一个未完成的预警图形，不能动 windupUntil——
    // 此处调用时 advanceAttack 刚把 windupUntil 设好，若用 cancelTelegraph()
    // 会被其首行的 this.windupUntil = 0 清掉，导致敌人永远进不了落招阶段。
    this.clearTelegraphGfx();
    const ring = this.scene.add
      .circle(this.x + this.telegraphDir * 26, this.y - 8, 26, this.telegraphColor, 0)
      .setStrokeStyle(3, this.telegraphColor, 0.95)
      .setDepth(this.depth + 5)
      .setScale(0.35);
    this.telegraphGfx = ring;
    this.scene.tweens.add({
      targets: ring,
      scale: 1.1,
      alpha: { from: 0.95, to: 0 },
      duration: this.telegraphMs(),
      onComplete: () => {
        ring.destroy();
        if (this.telegraphGfx === ring) {
          this.telegraphGfx = null;
        }
      },
    });
  }

  private showStrike(dir: -1 | 1) {
    const slash = this.scene.add
      .rectangle(this.x + dir * 40, this.y - 8, 72, 11, this.strikeColor, 0.9)
      .setAngle(dir > 0 ? -18 : 18)
      .setDepth(this.depth + 6);
    this.scene.tweens.add({
      targets: slash,
      alpha: 0,
      scaleX: 1.5,
      duration: 150,
      onComplete: () => slash.destroy(),
    });
  }

  private cancelTelegraph() {
    this.windupUntil = 0;
    this.clearTelegraphGfx();
  }

  private defeat() {
    this.cancelTelegraph();
    this.playSfx(this.defeatSfx);
    this.onDefeat();
    this.nameplate.destroy();
    this.healthBar.destroy();
    this.disableBody(true, true);
    this.destroy();
  }
}
