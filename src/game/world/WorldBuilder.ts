import Phaser from 'phaser';
import type { ClueId } from '../story/StoryFlags';
import { createCharacterTextures } from '../art/CharacterArt';
import { Npc } from '../entities/Npc';

export type InvestigationPoint = {
  x: number;
  y: number;
  label: string;
  clue: ClueId;
  text: string;
  object: Phaser.GameObjects.Zone;
  marker: Phaser.GameObjects.Text;
};

/**
 * 构建第一章世界：生成纹理、绘制天空 / 雨线 / 火光、铺设地面与平台、创建调查点。
 * 只负责"把世界搭出来并返回可交互对象集合"，不处理流程逻辑（由 FlowController 接管）。
 */
export class WorldBuilder {
  readonly points: InvestigationPoint[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  /** 生成全部程序化纹理（角色、地面、纸、刀光）。必须在 create() 早期调用一次。 */
  createGeneratedTextures() {
    const createRect = (key: string, width: number, height: number, color: number) => {
      const gfx = this.scene.make.graphics({ x: 0, y: 0 }, false);
      gfx.fillStyle(color, 1);
      gfx.fillRect(0, 0, width, height);
      gfx.generateTexture(key, width, height);
      gfx.destroy();
    };

    createCharacterTextures(this.scene);
    this.createDestructibleTextures();
    createRect('ground', 96, 28, 0x15151a);
    createRect('paper', 28, 28, 0xd2b777);
    createRect('blade', 72, 8, 0xaaf7ff);
  }

  /** 生成 4 种可破坏物纹理：货摊(棕褐长方)/灯笼(暗红圆)/木桶(深棕矮方)/水缸(青灰椭圆)。 */
  private createDestructibleTextures() {
    const make = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void, w: number, h: number) => {
      const gfx = this.scene.make.graphics({ x: 0, y: 0 }, false);
      draw(gfx);
      gfx.generateTexture(key, w, h);
      gfx.destroy();
    };

    make('destructible-stall', (g) => {
      g.fillStyle(0x4a3520, 1);
      g.fillRect(0, 28, 60, 36);
      g.fillStyle(0x6a4a28, 1);
      g.fillRect(4, 8, 52, 24);
      g.fillStyle(0x3a2a18, 1);
      g.fillRect(0, 60, 60, 6);
    }, 60, 66);

    make('destructible-lantern', (g) => {
      g.fillStyle(0x6a1818, 1);
      g.fillCircle(12, 18, 12);
      g.fillStyle(0xd09742, 0.9);
      g.fillRect(8, 14, 8, 8);
      g.fillStyle(0x2a1a0a, 1);
      g.fillRect(10, 2, 4, 6);
    }, 24, 32);

    make('destructible-barrel', (g) => {
      g.fillStyle(0x4a3520, 1);
      g.fillRect(2, 4, 28, 40);
      g.fillStyle(0x2a1a0a, 1);
      g.fillRect(0, 12, 32, 3);
      g.fillRect(0, 32, 32, 3);
      g.fillStyle(0x6a4a28, 1);
      g.fillRect(2, 4, 28, 2);
    }, 32, 48);

    make('destructible-urn', (g) => {
      g.fillStyle(0x3a4a55, 1);
      g.fillEllipse(20, 24, 32, 40);
      g.fillStyle(0x5a6a75, 0.8);
      g.fillEllipse(20, 14, 24, 10);
      g.fillStyle(0x2a3a45, 1);
      g.fillRect(14, 4, 12, 4);
    }, 40, 48);
  }

  /** 绘制背景、区域标签、雨线、火光。 */
  drawWorld() {
    const sky = this.scene.add.graphics().setDepth(-20);
    sky.fillGradientStyle(0x06080d, 0x06080d, 0x111823, 0x111823, 1);
    sky.fillRect(0, 0, 4400, 720);

    this.addZoneLabel(130, '村口雨夜');
    this.addZoneLabel(780, '祠堂');
    this.addZoneLabel(1490, '陆家旧宅');
    this.addZoneLabel(2230, '父亲书房');
    this.addZoneLabel(3300, '地下密室');

    for (let x = 0; x < 4400; x += 180) {
      this.scene.add.rectangle(x + 80, 600, 130, 180, 0x0b0d12, 0.72).setDepth(-5);
      this.scene.add.rectangle(x + 70, 512, 42, 10, 0x49391f, 0.9).setDepth(-4);
    }

    for (let i = 0; i < 90; i += 1) {
      const x = Phaser.Math.Between(0, 4400);
      const y = Phaser.Math.Between(0, 560);
      this.scene.add.line(x, y, 0, 0, -18, 42, 0x6a8196, 0.28).setDepth(50).setScrollFactor(1);
    }

    for (const x of [700, 1460, 2160, 3190, 3820]) {
      this.scene.add.circle(x, 515, 10, 0xd09742, 0.92).setDepth(2);
      this.scene.add.circle(x, 515, 38, 0xd09742, 0.12).setDepth(1);
    }
  }

  /** 铺设地面与平台，返回静态物理组（已加入碰撞体）。 */
  buildPlatforms(): Phaser.Physics.Arcade.StaticGroup {
    const ground = this.scene.physics.add.staticGroup();
    for (let x = 48; x < 4400; x += 96) {
      const tile = ground.create(x, 660, 'ground');
      tile.refreshBody();
    }
    for (const [x, y, width] of [
      [720, 570, 240],
      [1510, 552, 300],
      [2200, 528, 260],
      [3160, 590, 320],
      [3700, 540, 240],
    ]) {
      const platform = this.scene.add.rectangle(x as number, y as number, width as number, 18, 0x202027, 1);
      this.scene.physics.add.existing(platform, true);
      ground.add(platform);
    }
    return ground;
  }

  /** 创建三个调查点并赋予静态物理体。返回的点同时存于 this.points。 */
  createInvestigationPoints(): InvestigationPoint[] {
    this.points.length = 0;
    this.points.push(
      {
        x: 520,
        y: 605,
        label: '父亲伤痕',
        clue: 'wound',
        text: '伤口细而深，不像山路坠亡，更像黑夜里的短刃。',
        object: this.scene.add.zone(520, 604, 92, 96),
        marker: this.addMarker(520, 552, '伤'),
      },
      {
        x: 950,
        y: 605,
        label: '黑鳞令牌',
        clue: 'blackScaleToken',
        text: '泥水里压着一枚黑鳞令。村里没人敢说它从何而来。',
        object: this.scene.add.zone(950, 604, 92, 96),
        marker: this.addMarker(950, 552, '鳞'),
      },
      {
        x: 1590,
        y: 590,
        label: '烧灼刀鞘',
        clue: 'burnedScabbard',
        text: '刀鞘边缘有红黑灼痕，像被妖气舔过。',
        object: this.scene.add.zone(1590, 590, 110, 96),
        marker: this.addMarker(1590, 536, '鞘'),
      },
    );

    for (const point of this.points) {
      this.scene.physics.add.existing(point.object, true);
    }
    return this.points;
  }

  /** 创建村民 NPC：第四线索"沉默村民"（揭示 threatenedVillagers）+ 1 个氛围村民。 */
  createNpcs(): Npc[] {
    const npcs: Npc[] = [
      new Npc(this.scene, 1990, 590, { dialogId: 'villager', name: '沉默村民' }),
      new Npc(this.scene, 620, 605, { dialogId: 'ambientVillager', name: '老村民' }),
    ];
    // Npc 构造内已 scene.physics.add.existing；此处只设不可推动
    for (const npc of npcs) {
      const body = npc.body as Phaser.Physics.Arcade.Body;
      body.setImmovable(true);
    }
    return npcs;
  }

  private addZoneLabel(x: number, label: string) {
    this.scene.add
      .text(x, 104, label, {
        color: '#c7b078',
        fontFamily: 'serif',
        fontSize: '24px',
        stroke: '#050608',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(5);
  }

  private addMarker(x: number, y: number, text: string) {
    return this.scene.add
      .text(x, y, text, {
        color: '#08090c',
        backgroundColor: '#d2b777',
        fontFamily: 'serif',
        fontSize: '18px',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(30);
  }
}
