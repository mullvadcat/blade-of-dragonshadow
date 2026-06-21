import Phaser from 'phaser';

export type DestructibleKind = 'stall' | 'lantern' | 'barrel' | 'urn';

export type DestructibleOptions = {
  kind: DestructibleKind;
  /** 字幕显示名（如"货摊""灯笼"）。 */
  label: string;
};

/**
 * 可破坏环境物体：被大范围招式波及时碎裂 + 永久标记。
 * 不参与战斗，无攻击行为。takeDamage() 幂等：首次破坏设 destroyed + 碎裂视觉，返回 true。
 */
export class Destructible extends Phaser.Physics.Arcade.Sprite {
  readonly kind: DestructibleKind;
  readonly label: string;
  private destroyed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, options: DestructibleOptions) {
    super(scene, x, y, `destructible-${options.kind}`);
    this.kind = options.kind;
    this.label = options.label;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(40, 48);
    body.setImmovable(true);
    body.setAllowGravity(false);
    this.setDepth(8);
  }

  /** 是否已被破坏（幂等标记，供破坏判定跳过已碎物体）。 */
  get isDestroyed(): boolean {
    return this.destroyed;
  }

  /**
   * 受破坏：首次破坏设 destroyed + 碎裂视觉（碎裂 tween + 灰化 + 碎片飞溅），返回 true；
   * 已破坏则返回 false（幂等，防刷值）。
   */
  takeDamage(): boolean {
    if (this.destroyed) {
      return false;
    }
    this.destroyed = true;
    this.setTint(0x4a3a2a);
    this.scene.tweens.add({
      targets: this,
      scaleX: 0.6,
      scaleY: 0.4,
      angle: Phaser.Math.Between(-12, 12),
      alpha: 0.7,
      duration: 220,
    });
    for (let i = 0; i < 6; i += 1) {
      const shard = this.scene.add
        .rectangle(this.x, this.y - 16, 6, 6, 0x6a5a3a, 0.9)
        .setDepth(12);
      this.scene.tweens.add({
        targets: shard,
        x: this.x + Phaser.Math.Between(-40, 40),
        y: this.y + Phaser.Math.Between(-20, 10),
        alpha: 0,
        duration: 400,
        onComplete: () => shard.destroy(),
      });
    }
    return true;
  }
}
