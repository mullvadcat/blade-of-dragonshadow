import type Phaser from 'phaser';
import type { CombatActor } from '../entities/CombatActor';
import type { Strike } from './CombatSystem';
import type { SfxName } from '../audio/AudioDirector';

/**
 * 刀气（远程斩击）：从玩家朝向方向射出的直线飞行体。
 * 飞行中检测与敌人的重叠，命中即对其 receiveStrike 并消散。
 * 颜色取自玩家 moral.bladeColor()，与近战刀光一致（怒→红，守→青白）。
 */
export class BladeAura {
  private readonly projectile: Phaser.GameObjects.Rectangle;
  private readonly strike: Strike;
  private readonly targets: ReadonlyArray<CombatActor>;
  private readonly range: number;
  private readonly startX: number;
  private readonly dir: -1 | 1;
  private consumed = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    dir: -1 | 1,
    color: number,
    strike: Strike,
    targets: ReadonlyArray<CombatActor>,
    playSfx: (name: SfxName) => void,
    range = 520,
  ) {
    this.strike = strike;
    this.targets = targets;
    this.range = range;
    this.startX = x;
    this.dir = dir;

    this.projectile = scene.add
      .rectangle(x + dir * 40, y - 8, 90, 10, color, 0.92)
      .setAngle(dir > 0 ? -8 : 8)
      .setDepth(38);
    playSfx('slashHeavy');

    scene.tweens.add({
      targets: this.projectile,
      alpha: 0.6,
      duration: 80,
      yoyo: true,
    });
  }

  /**
   * 每帧推进：移动飞行体 + 检测命中。
   * 返回 true 表示已命中/飞出范围，调用方应停止更新并销毁。
   */
  update(time: number, onHit: (target: CombatActor) => void): boolean {
    if (this.consumed) {
      return true;
    }

    const speed = 14;
    this.projectile.x += this.dir * speed;

    // 命中检测：与任一活跃目标重叠即命中
    for (const target of this.targets) {
      if (
        target.active &&
        Math.abs(target.x - this.projectile.x) < 48 &&
        Math.abs(target.y - this.projectile.y) < 60
      ) {
        target.receiveStrike(this.strike, time);
        onHit(target);
        this.destroy();
        return true;
      }
    }

    // 飞出射程范围 → 消散
    if (Math.abs(this.projectile.x - this.startX) > this.range) {
      this.destroy();
      return true;
    }
    return false;
  }

  get active(): boolean {
    return !this.consumed;
  }

  destroy() {
    this.consumed = true;
    this.projectile.destroy();
  }
}
