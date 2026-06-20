import Phaser from 'phaser';

export type NpcOptions = {
  /** 关联的对话定义 id（由 FlowController 解析为 DialogDef）。 */
  dialogId: string;
  /** 名牌文字。 */
  name: string;
};

/**
 * 村民 NPC：不参与战斗，靠近按 E 触发对话。
 * 不继承 CombatActor（无战斗状态），仅做物理体 + 名牌。
 */
export class Npc extends Phaser.Physics.Arcade.Sprite {
  readonly dialogId: string;
  /** 对话是否已完成（用于线索村民标记，避免重复触发）。 */
  talked = false;
  /** 是否已被误伤（保底不致死，仅标记 + 视觉反馈）。 */
  injured = false;
  private readonly nameplate: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, options: NpcOptions) {
    super(scene, x, y, 'npc-villager');
    this.dialogId = options.dialogId;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(30, 60);
    body.setImmovable(true);
    body.setAllowGravity(false);
    this.setDepth(10);

    this.nameplate = scene.add
      .text(x, y - 52, options.name, {
        color: '#c9b078',
        fontFamily: 'serif',
        fontSize: '13px',
        stroke: '#050608',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(20);
  }

  update() {
    if (!this.active) {
      return;
    }
    this.nameplate.setPosition(this.x, this.y - 52);
  }

  /** 对话完成后标记，名牌变灰。 */
  markTalked() {
    this.talked = true;
    this.nameplate.setColor('#6a6a6a');
  }

  /**
   * 受伤标记：首次受伤设 injured + 泛红视觉，返回 true；
   * 已受伤则仅刷新视觉，返回 false（幂等，防刷值）。
   */
  takeDamage(): boolean {
    if (this.injured) {
      return false;
    }
    this.injured = true;
    this.setTint(0xff5b5b);
    this.nameplate.setColor('#ff8a6a');
    return true;
  }

  destroy(fromScene?: boolean) {
    this.nameplate.destroy();
    super.destroy(fromScene);
  }
}
