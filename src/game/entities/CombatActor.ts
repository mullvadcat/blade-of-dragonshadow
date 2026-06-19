import Phaser from 'phaser';
import { CombatSystem, type CombatantState, type Strike, type StrikeResult } from '../combat/CombatSystem';
import { HealthBar, type HealthBarOptions } from '../ui/HealthBar';

export type CombatActorConfig = {
  texture: string;
  combatState: CombatantState;
  bodySize: [width: number, height: number];
  depth: number;
  attackRange: number;
  hitTint: number;
  hitFlashMs: number;
  nameplate: {
    text: string;
    style: Phaser.Types.GameObjects.Text.TextStyle;
    offsetY: number;
  };
  healthBar: HealthBarOptions & { offsetX: number; offsetY: number };
};

/**
 * Enemy 与 BossWuzhen 共享的敌方角色基类：封装物理体、名牌 / 血条的创建与跟随、
 * 追逐移动、受击结算与死亡清理。子类只需提供配置并实现各自的 update 行为与 makeStrike。
 */
export abstract class CombatActor extends Phaser.Physics.Arcade.Sprite {
  readonly combatState: CombatantState;
  protected nextAttackAt = 0;
  protected readonly nameplate: Phaser.GameObjects.Text;
  protected readonly healthBar: HealthBar;
  private readonly attackRange: number;
  private readonly hitTint: number;
  private readonly hitFlashMs: number;
  private readonly nameplateOffsetY: number;
  private readonly healthBarOffsetX: number;
  private readonly healthBarOffsetY: number;

  constructor(scene: Phaser.Scene, x: number, y: number, config: CombatActorConfig) {
    super(scene, x, y, config.texture);
    this.combatState = config.combatState;
    this.attackRange = config.attackRange;
    this.hitTint = config.hitTint;
    this.hitFlashMs = config.hitFlashMs;
    this.nameplateOffsetY = config.nameplate.offsetY;
    this.healthBarOffsetX = config.healthBar.offsetX;
    this.healthBarOffsetY = config.healthBar.offsetY;

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

  /** 追逐玩家：硬直中停步，在 [minDist, maxDist] 区间内朝玩家移动。返回带符号水平距离。 */
  protected chase(time: number, playerX: number, speed: number, minDist: number, maxDist: number) {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const distance = playerX - this.x;

    if (time < this.combatState.staggeredUntil) {
      body.setVelocityX(0);
    } else if (Math.abs(distance) > minDist && Math.abs(distance) < maxDist) {
      body.setVelocityX(Math.sign(distance) * speed);
      this.setFlipX(distance < 0);
    } else {
      body.setVelocityX(0);
    }

    return distance;
  }

  /** 每帧让名牌与血条跟随本体。 */
  protected followUi() {
    this.nameplate.setPosition(this.x, this.y + this.nameplateOffsetY);
    this.healthBar.setPosition(this.x + this.healthBarOffsetX, this.y + this.healthBarOffsetY);
    this.healthBar.update(this.combatState.health, this.combatState.maxHealth);
  }

  canAttack(time: number, playerX: number) {
    return this.active && time >= this.nextAttackAt && Math.abs(playerX - this.x) < this.attackRange;
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

  /** 子类可覆写以清理额外的视觉对象（如 Boss 光环），随后调用 super.onDefeat()。 */
  protected onDefeat() {}

  private defeat() {
    this.onDefeat();
    this.nameplate.destroy();
    this.healthBar.destroy();
    this.disableBody(true, true);
    this.destroy();
  }
}
