import Phaser from 'phaser';
import { BossWuzhen } from './entities/BossWuzhen';
import { Enemy } from './entities/Enemy';
import { Hud } from './ui/Hud';
import { Player } from './player/Player';
import { StoryFlags, type ClueId } from './story/StoryFlags';
import { createCharacterTextures } from './art/CharacterArt';
import { AudioDirector, type SfxName } from './audio/AudioDirector';
import { CombatSystem, type Strike } from './combat/CombatSystem';

type InvestigationPoint = {
  x: number;
  y: number;
  label: string;
  clue: ClueId;
  text: string;
  object: Phaser.GameObjects.Zone;
  marker: Phaser.GameObjects.Text;
};

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private hud!: Hud;
  private story = new StoryFlags();
  private enemies: Enemy[] = [];
  private boss: BossWuzhen | null = null;
  private points: InvestigationPoint[] = [];
  private ground!: Phaser.Physics.Arcade.StaticGroup;
  private chamberOpened = false;
  private endingStarted = false;
  private gameOverStarted = false;
  private restartKey!: Phaser.Input.Keyboard.Key;
  private muteKey!: Phaser.Input.Keyboard.Key;
  private audioDirector = new AudioDirector();
  private sfx: (name: SfxName) => void = () => {};

  constructor() {
    super('GameScene');
  }

  /**
   * Phaser 在 scene.restart() 时复用同一实例并重跑 create()，但不会重跑构造函数 /
   * 字段初始化器。所有每局可变的进度状态必须在这里显式归位，否则会跨重开残留
   * （例如 gameOverStarted 残留为 true 会让玩家无敌、线索 / 暗门状态残留会破坏流程）。
   */
  private resetRunState() {
    this.story = new StoryFlags();
    this.enemies = [];
    this.boss = null;
    this.points = [];
    this.chamberOpened = false;
    this.endingStarted = false;
    this.gameOverStarted = false;
    this.audioDirector.setMode('explore');
  }

  preload() {
    this.createGeneratedTextures();
  }

  create() {
    this.resetRunState();
    this.physics.world.setBounds(0, 0, 4400, 720);
    this.cameras.main.setBounds(0, 0, 4400, 720);

    this.sfx = (name: SfxName) => this.audioDirector.playSfx(name);

    this.createWorld();
    this.player = new Player(this, 130, 560, this.sfx);
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.restartKey = this.input.keyboard!.addKey('R');
    this.muteKey = this.input.keyboard!.addKey('M');
    // 首次键盘输入用于唤醒 AudioContext（浏览器自动播放策略要求用户手势）。
    // 重开统一由 handleGameOverInput() 处理，这里不再重复触发 restart。
    this.input.keyboard!.on('keydown', () => {
      void this.startAudio();
    });
    this.input.on('pointerdown', () => {
      void this.startAudio();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.audioDirector.stop());
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(260, 120);

    this.ground = this.physics.add.staticGroup();
    this.createPlatforms();
    this.physics.add.collider(this.player, this.ground);

    this.createInvestigationPoints();
    this.createEnemies();

    this.hud = new Hud(this);
    this.hud.setAudioStatus(this.audioDirector.isStarted, this.audioDirector.isMuted);
    this.hud.showSubtitle('雨没有停。父亲的棺木刚入土，陆家旧宅却还藏着未冷的刀声。');

    this.add
      .text(22, 684, '移动 WASD/方向键  闪避 Space  轻斩 J  重斩 K  格挡 L  调查 E', {
        color: '#8fa9b0',
        fontFamily: 'serif',
        fontSize: '15px',
      })
      .setScrollFactor(0)
      .setDepth(100);
  }

  update(time: number) {
    this.player.update(time, this.cursors);
    this.hud.update(this.player, this.story);
    this.handleAudioControls();
    this.updateAudioMode();

    if (this.player.machine.isDead()) {
      this.handleGameOverInput();
      if (!this.gameOverStarted && !this.endingStarted) {
        this.startGameOver();
      }
      return;
    }

    this.handleInvestigation();
    this.handleStudyGate();
    this.handleAttacks(time);
    this.updateEnemies(time);
    this.handleBoss(time);
  }

  private createGeneratedTextures() {
    const createRect = (key: string, width: number, height: number, color: number) => {
      const gfx = this.make.graphics({ x: 0, y: 0 }, false);
      gfx.fillStyle(color, 1);
      gfx.fillRect(0, 0, width, height);
      gfx.generateTexture(key, width, height);
      gfx.destroy();
    };

    createCharacterTextures(this);
    createRect('ground', 96, 28, 0x15151a);
    createRect('paper', 28, 28, 0xd2b777);
    createRect('blade', 72, 8, 0xaaf7ff);
  }

  private createWorld() {
    const sky = this.add.graphics().setDepth(-20);
    sky.fillGradientStyle(0x06080d, 0x06080d, 0x111823, 0x111823, 1);
    sky.fillRect(0, 0, 4400, 720);

    this.addZoneLabel(130, '村口雨夜');
    this.addZoneLabel(780, '祠堂');
    this.addZoneLabel(1490, '陆家旧宅');
    this.addZoneLabel(2230, '父亲书房');
    this.addZoneLabel(3300, '地下密室');

    for (let x = 0; x < 4400; x += 180) {
      this.add.rectangle(x + 80, 600, 130, 180, 0x0b0d12, 0.72).setDepth(-5);
      this.add.rectangle(x + 70, 512, 42, 10, 0x49391f, 0.9).setDepth(-4);
    }

    for (let i = 0; i < 90; i += 1) {
      const x = Phaser.Math.Between(0, 4400);
      const y = Phaser.Math.Between(0, 560);
      this.add
        .line(x, y, 0, 0, -18, 42, 0x6a8196, 0.28)
        .setDepth(50)
        .setScrollFactor(1);
    }

    for (const x of [700, 1460, 2160, 3190, 3820]) {
      this.add.circle(x, 515, 10, 0xd09742, 0.92).setDepth(2);
      this.add.circle(x, 515, 38, 0xd09742, 0.12).setDepth(1);
    }
  }

  private addZoneLabel(x: number, label: string) {
    this.add
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

  private createPlatforms() {
    for (let x = 48; x < 4400; x += 96) {
      const tile = this.ground.create(x, 660, 'ground');
      tile.refreshBody();
    }
    for (const [x, y, width] of [
      [720, 570, 240],
      [1510, 552, 300],
      [2200, 528, 260],
      [3160, 590, 320],
      [3700, 540, 240],
    ]) {
      const platform = this.add.rectangle(x, y, width, 18, 0x202027, 1);
      this.physics.add.existing(platform, true);
      this.ground.add(platform);
    }
  }

  private createInvestigationPoints() {
    this.points = [
      {
        x: 520,
        y: 605,
        label: '父亲伤痕',
        clue: 'wound',
        text: '伤口细而深，不像山路坠亡，更像黑夜里的短刃。',
        object: this.add.zone(520, 604, 92, 96),
        marker: this.addMarker(520, 552, '伤'),
      },
      {
        x: 950,
        y: 605,
        label: '黑鳞令牌',
        clue: 'blackScaleToken',
        text: '泥水里压着一枚黑鳞令。村里没人敢说它从何而来。',
        object: this.add.zone(950, 604, 92, 96),
        marker: this.addMarker(950, 552, '鳞'),
      },
      {
        x: 1590,
        y: 590,
        label: '烧灼刀鞘',
        clue: 'burnedScabbard',
        text: '刀鞘边缘有红黑灼痕，像被妖气舔过。',
        object: this.add.zone(1590, 590, 110, 96),
        marker: this.addMarker(1590, 536, '鞘'),
      },
      {
        x: 1990,
        y: 590,
        label: '沉默村民',
        clue: 'threatenedVillagers',
        text: '老人避开你的眼睛，只说那夜所有灯都被人逼着熄了。',
        object: this.add.zone(1990, 590, 120, 96),
        marker: this.addMarker(1990, 536, '证'),
      },
    ];

    for (const point of this.points) {
      this.physics.add.existing(point.object, true);
    }
  }

  private addMarker(x: number, y: number, text: string) {
    return this.add
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

  private createEnemies() {
    for (const enemy of [
      new Enemy(this, 1240, 580, 'scout', this.sfx),
      new Enemy(this, 1740, 580, 'bandit', this.sfx),
    ]) {
      this.enemies.push(enemy);
      this.physics.add.collider(enemy, this.ground);
    }
  }

  private handleInvestigation() {
    const activePoint = this.points.find((point) =>
      Phaser.Math.Distance.Between(this.player.x, this.player.y, point.x, point.y) < 86,
    );

    if (!activePoint) {
      this.hud.showPrompt('');
      return;
    }

    this.hud.showPrompt(`E 调查：${activePoint.label}`);
    if (!this.player.wantsInteract()) {
      return;
    }

    this.story.discoverClue(activePoint.clue);
    activePoint.marker.setBackgroundColor('#8fb9bd');
    activePoint.marker.setText('✓');
    this.hud.showSubtitle(activePoint.text);
  }

  private handleStudyGate() {
    const nearStudy = Phaser.Math.Distance.Between(this.player.x, this.player.y, 2380, 590) < 110;
    if (!nearStudy || this.chamberOpened) {
      return;
    }

    if (!this.story.canOpenStudyMechanism()) {
      this.hud.showPrompt('书房机关紧闭：还缺父亲死亡的线索');
      return;
    }

    this.hud.showPrompt('E 开启书房暗门');
    if (this.player.wantsInteract()) {
      this.chamberOpened = true;
      this.story.openStudyMechanism();
      this.story.enterSecretChamber();
      this.hud.showSubtitle('墙后机括低响，暗门裂开，潮湿的地下风带着铁锈味扑面而来。');
      this.spawnBoss();
    }
  }

  private spawnBoss() {
    this.boss = new BossWuzhen(this, 3300, 580, this.sfx);
    this.physics.add.collider(this.boss, this.ground);
    this.audioDirector.setMode('boss');
    this.hud.showSubtitle('乌针：龙刃刀经，终究还是要归黑鳞会。');
  }

  private handleAttacks(time: number) {
    const strike = this.player.consumeAttack(time);
    if (!strike) {
      return;
    }

    const empowered = this.player.machine.consumeCounterWindow(time);
    const finalStrike: Strike = empowered
      ? { ...strike, damage: Math.round(strike.damage * 1.6), guardDamage: 999 }
      : strike;

    this.sfx(empowered ? 'slashEmpowered' : strike.damage >= 24 ? 'slashHeavy' : 'slashLight');
    this.showSlash(empowered);

    let landed = false;
    for (const enemy of this.enemies) {
      if (enemy.active && Math.abs(enemy.x - this.player.x) < 92 && Math.abs(enemy.y - this.player.y) < 86) {
        enemy.receiveStrike(finalStrike, time);
        landed = true;
      }
    }

    if (
      this.boss?.active &&
      Math.abs(this.boss.x - this.player.x) < 112 &&
      Math.abs(this.boss.y - this.player.y) < 94
    ) {
      this.boss.receiveStrike(finalStrike, time);
      landed = true;
      if (!this.boss.active && !this.endingStarted) {
        this.startEnding();
      }
    }

    if (landed) {
      this.sfx('hit');
    }
  }

  private showSlash(empowered = false) {
    const x = this.player.x + this.player.facing * 48;
    const slash = this.add
      .rectangle(
        x,
        this.player.y - 8,
        empowered ? 96 : 74,
        empowered ? 13 : 9,
        empowered ? 0xfff1a8 : 0xaefaff,
        0.9,
      )
      .setAngle(this.player.facing > 0 ? -18 : 18)
      .setDepth(40);
    this.tweens.add({
      targets: slash,
      alpha: 0,
      scaleX: 1.5,
      duration: 130,
      onComplete: () => slash.destroy(),
    });
  }

  private updateEnemies(time: number) {
    for (const enemy of this.enemies) {
      enemy.update(time, this.player.x);
      const strike = enemy.advanceAttack(time, this.player.x);
      if (strike) {
        this.applyEnemyStrike(strike, time);
      }
    }
  }

  private handleBoss(time: number) {
    if (!this.boss?.active) {
      return;
    }

    this.boss.update(time, this.player.x);
    const strike = this.boss.advanceAttack(time, this.player.x);
    if (strike) {
      this.applyEnemyStrike(strike, time);
    }
  }

  private applyEnemyStrike(strike: Strike, time: number) {
    if (this.endingStarted || this.gameOverStarted || this.player.machine.isDead()) {
      return;
    }

    const state = this.player.machine.state;
    const result = CombatSystem.resolveStrike(strike, state, time);
    Object.assign(state, result.target);

    if (result.wasPerfectGuard) {
      if (result.counterWindowUntil !== null) {
        this.player.machine.grantCounterWindow(result.counterWindowUntil);
      }
      this.sfx('perfectGuard');
      this.hud.showSubtitle('听风断影——你卸开这一击，反手已有破绽可乘。', 1500);
      return;
    }

    // 无敌帧内 / 无实际影响时不给受击反馈。
    if (result.damageDealt <= 0 && !result.wasGuardBroken) {
      return;
    }

    this.sfx(this.player.machine.state.isBlocking ? 'block' : 'playerHurt');
    this.player.setTint(0xff5964);
    this.cameras.main.shake(90, 0.003);
    this.time.delayedCall(90, () => {
      if (this.player.active) {
        this.player.clearTint();
      }
    });
  }

  private startGameOver() {
    this.gameOverStarted = true;
    this.audioDirector.setMode('gameOver');
    this.player.setTint(0x6c0d17);

    this.add
      .rectangle(0, 0, 1280, 720, 0x18050a, 0.82)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(130);

    this.add
      .text(640, 242, '雨夜断刃', {
        color: '#ffccd0',
        fontFamily: 'serif',
        fontSize: '56px',
        stroke: '#220006',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(131);

    this.add
      .text(
        640,
        348,
        '仇恨还未教会你如何活下去。\n雨声吞没刀鸣，龙刃沉入泥水。',
        {
          color: '#f2dfb8',
          fontFamily: 'serif',
          fontSize: '26px',
          align: 'center',
          lineSpacing: 10,
          stroke: '#050608',
          strokeThickness: 5,
          wordWrap: { width: 860 },
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(131);

    this.add
      .text(640, 482, '按 R 从雨夜重来', {
        color: '#aefaff',
        fontFamily: 'serif',
        fontSize: '24px',
        stroke: '#050608',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(131);
  }

  private handleGameOverInput() {
    if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
      this.scene.restart();
    }
  }

  private startEnding() {
    this.endingStarted = true;
    this.audioDirector.setMode('ending');
    this.story.defeatWuzhen();
    this.story.leaveVillage();

    const panel = this.add
      .rectangle(0, 0, 1280, 720, 0x050608, 0.82)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(120);
    const text = this.add
      .text(
        640,
        260,
        '密室中，三样遗物静静等待：\n《龙影刀经》、龙刃刀、父亲遗书。\n\n“刀可以杀人，也可以救人。\n若有一日你拔出龙刃，记住，不要让仇恨替你握刀。”\n\n雨夜未尽，少年带刀离家。\n他还不懂何时收刀，却已踏入江湖。',
        {
          color: '#f2dfb8',
          fontFamily: 'serif',
          fontSize: '28px',
          align: 'center',
          lineSpacing: 12,
          wordWrap: { width: 980 },
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(121);

    this.tweens.add({
      targets: [panel, text],
      alpha: { from: 0, to: 1 },
      duration: 900,
    });
  }

  private async startAudio() {
    await this.audioDirector.start();
    this.hud?.setAudioStatus(this.audioDirector.isStarted, this.audioDirector.isMuted);
  }

  private handleAudioControls() {
    if (Phaser.Input.Keyboard.JustDown(this.muteKey)) {
      this.audioDirector.toggleMuted();
      this.hud.setAudioStatus(this.audioDirector.isStarted, this.audioDirector.isMuted);
    }
  }

  private updateAudioMode() {
    if (this.endingStarted || this.gameOverStarted || this.boss?.active) {
      return;
    }

    const enemyNearby = this.enemies.some(
      (enemy) =>
        enemy.active &&
        Math.abs(enemy.x - this.player.x) < 420 &&
        Math.abs(enemy.y - this.player.y) < 140,
    );
    this.audioDirector.setMode(enemyNearby ? 'combat' : 'explore');
  }
}
