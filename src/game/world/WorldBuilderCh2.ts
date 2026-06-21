import Phaser from 'phaser';
import { createCharacterTextures } from '../art/CharacterArt';
import { Npc } from '../entities/Npc';

/**
 * 构建第二章世界：荒废驿站。3200×720 地图。
 * 无调查点、无可破坏物；含 2 名旁观村夫 NPC。
 */
export class WorldBuilderCh2 {
  private ground!: Phaser.Physics.Arcade.StaticGroup;

  constructor(private readonly scene: Phaser.Scene) {}

  /** 生成全部程序化纹理。必须在 create() 早期调用一次。 */
  createGeneratedTextures() {
    const createRect = (key: string, w: number, h: number, color: number) => {
      if (this.scene.textures.exists(key)) return;
      const gfx = this.scene.make.graphics({ x: 0, y: 0 }, false);
      gfx.fillStyle(color, 1);
      gfx.fillRect(0, 0, w, h);
      gfx.generateTexture(key, w, h);
      gfx.destroy();
    };
    if (!this.scene.textures.exists('player')) {
      createCharacterTextures(this.scene);
    }
    createRect('ground-ch2', 96, 28, 0x2a2018);
    // blade 和 paper 可能已由 Ch1 生成，做幂等检查
    createRect('blade', 72, 8, 0xaaf7ff);
    createRect('paper', 28, 28, 0xd2b777);
  }

  /** 绘制背景层：天空、竹影、月光、建筑轮廓、地面色块。 */
  drawWorld() {
    const scene = this.scene;
    scene.physics.world.setBounds(0, 0, 3200, 720);
    scene.cameras.main.setBounds(0, 0, 3200, 720);

    // 深灰蓝天空
    scene.add.rectangle(1600, 360, 3200, 720, 0x1a1f2e).setDepth(0);

    // 竹影剪影
    const bambooXs = [80, 200, 340, 510, 660, 800, 920, 1060, 2700, 2820, 2950, 3100];
    for (const bx of bambooXs) {
      scene.add.rectangle(bx, 280, 8, 460, 0x0d1208, 0.7).setDepth(1);
      scene.add.rectangle(bx + 18, 300, 6, 420, 0x0d1208, 0.5).setDepth(1);
    }

    // 月光效果
    scene.add.rectangle(2800, 80, 600, 300, 0xfff8e0, 0.04).setDepth(2);

    // 驿站建筑轮廓
    scene.add.rectangle(1200, 450, 640, 320, 0x16120e, 0.9).setDepth(1);
    scene.add.rectangle(1800, 470, 480, 280, 0x12100c, 0.9).setDepth(1);

    // 地面（暗棕）
    scene.add.rectangle(1600, 658, 3200, 100, 0x3d2b1f).setDepth(3);
  }

  /** 铺设地面与平台，返回静态物理组。 */
  buildPlatforms(): Phaser.Physics.Arcade.StaticGroup {
    const ground = this.scene.physics.add.staticGroup();

    // 地面层
    for (let x = 48; x < 3200; x += 96) {
      ground.create(x, 614, 'ground-ch2');
    }
    // 二层平台（驿站庭院）
    for (let x = 998; x <= 1350; x += 96) {
      ground.create(x, 394, 'ground-ch2');
    }
    // 残破墙台
    for (let x = 1648; x <= 1800; x += 96) {
      ground.create(x, 444, 'ground-ch2');
    }

    this.ground = ground;
    return ground;
  }

  /** 创建旁观村夫 NPC，并与地面添加碰撞。 */
  createNpcs(): Npc[] {
    const npcs: Npc[] = [];
    const specs: Array<{ x: number; dialogId: string; name: string }> = [
      { x: 2200, dialogId: 'bystander-1', name: '旁观者' },
      { x: 2350, dialogId: 'bystander-2', name: '旁观者' },
    ];
    for (const spec of specs) {
      const npc = new Npc(this.scene, spec.x, 580, {
        dialogId: spec.dialogId,
        name: spec.name,
      });
      // Npc 默认纹理为 npc-villager，此处替换为旁观者纹理
      npc.setTexture('npc-bystander');
      this.scene.physics.add.collider(npc, this.ground);
      npcs.push(npc);
    }
    return npcs;
  }
}
