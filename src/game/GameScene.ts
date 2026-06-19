import Phaser from 'phaser';
import { BossWuzhen } from './entities/BossWuzhen';
import { Enemy } from './entities/Enemy';
import { Hud } from './ui/Hud';
import { Player } from './player/Player';
import { StoryFlags, type ClueId } from './story/StoryFlags';
import { createCharacterTextures } from './art/CharacterArt';
import { AudioDirector } from './audio/AudioDirector';

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
  private readonly story = new StoryFlags();
  private readonly enemies: Enemy[] = [];
  private boss: BossWuzhen | null = null;
  private points: InvestigationPoint[] = [];
  private ground!: Phaser.Physics.Arcade.StaticGroup;
  private chamberOpened = false;
  private endingStarted = false;
  private gameOverStarted = false;
  private restartKey!: Phaser.Input.Keyboard.Key;
  private muteKey!: Phaser.Input.Keyboard.Key;
  private readonly audioDirector = new AudioDirector();

  constructor() {
    super('GameScene');
  }

  preload() {
    this.createGeneratedTextures();
  }

  create() {
    this.physics.world.setBounds(0, 0, 4400, 720);
    this.cameras.main.setBounds(0, 0, 4400, 720);

    this.createWorld();
    this.player = new Player(this, 130, 560);
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.restartKey = this.input.keyboard!.addKey('R');
    this.muteKey = this.input.keyboard!.addKey('M');
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      void this.startAudio();
      if (this.gameOverStarted && event.key.toLowerCase() === 'r') {
        this.scene.restart();
      }
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
      new Enemy(this, 1240, 580, 'scout'),
      new Enemy(this, 1740, 580, 'bandit'),
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
    this.boss = new BossWuzhen(this, 3300, 580);
    this.physics.add.collider(this.boss, this.ground);
    this.audioDirector.setMode('boss');
    this.hud.showSubtitle('乌针：龙刃刀经，终究还是要归黑鳞会。');
  }

  private handleAttacks(time: number) {
    const strike = this.player.consumeAttack(time);
    if (!strike) {
      return;
    }

    this.showSlash();
    for (const enemy of this.enemies) {
      if (enemy.active && Math.abs(enemy.x - this.player.x) < 92 && Math.abs(enemy.y - this.player.y) < 86) {
        enemy.receiveStrike(strike, time);
      }
    }

    if (
      this.boss?.active &&
      Math.abs(this.boss.x - this.player.x) < 112 &&
      Math.abs(this.boss.y - this.player.y) < 94
    ) {
      this.boss.receiveStrike(strike, time);
      if (!this.boss.active && !this.endingStarted) {
        this.startEnding();
      }
    }
  }

  private showSlash() {
    const x = this.player.x + this.player.facing * 48;
    const slash = this.add
      .rectangle(x, this.player.y - 8, 74, 9, 0xaefaff, 0.9)
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
      if (enemy.canAttack(time, this.player.x)) {
        this.applyEnemyStrike(enemy.makeStrike(time), time);
      }
    }
  }

  private handleBoss(time: number) {
    if (!this.boss?.active) {
      return;
    }

    this.boss.update(time, this.player.x);
    if (this.boss.canAttack(time, this.player.x)) {
      this.applyEnemyStrike(this.boss.makeStrike(time), time);
    }
  }

  private applyEnemyStrike(strike: ReturnType<Enemy['makeStrike']>, time: number) {
    if (this.endingStarted || this.gameOverStarted || this.player.machine.isDead()) {
      return;
    }

    const result = this.player.machine.state.isBlocking
      ? this.resolveBlockedHit(strike, time)
      : this.resolveDirectHit(strike, time);

    if (result) {
      this.player.setTint(0xff5964);
      this.cameras.main.shake(90, 0.003);
      this.time.delayedCall(90, () => this.player.clearTint());
    }
  }

  private resolveDirectHit(strike: ReturnType<Enemy['makeStrike']>, time: number) {
    const state = this.player.machine.state;
    if (time < state.invulnerableUntil) {
      return false;
    }
    this.player.machine.takeDamage(strike.damage);
    state.guard = Math.min(state.maxGuard, state.guard + strike.guardDamage);
    return true;
  }

  private resolveBlockedHit(strike: ReturnType<Enemy['makeStrike']>, time: number) {
    const state = this.player.machine.state;
    if (time <= state.perfectGuardUntil) {
      this.hud.showSubtitle('听风断影的影子还未成形，但你挡住了这一击。', 1800);
      return false;
    }
    this.player.machine.takeDamage(Math.floor(strike.damage * 0.35));
    state.stamina = Math.max(0, state.stamina - strike.staminaDamage);
    return true;
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
