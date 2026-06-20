import Phaser from 'phaser';
import type { Player } from '../player/Player';
import type { Hud } from '../ui/Hud';
import type { StoryFlags } from '../story/StoryFlags';
import type { EnemyDirector } from '../director/EnemyDirector';
import type { AudioDirector } from '../audio/AudioDirector';
import type { InvestigationPoint } from '../world/WorldBuilder';

/**
 * 第一章流程控制：调查取证、书房暗门、死亡结算、胜利结局。
 * 持有 endingStarted / gameOverStarted / chamberOpened 三个每局状态，
 * 在场景 restart 时由 GameScene.resetRunState() 重建本实例以归位。
 */
export class FlowController {
  endingStarted = false;
  gameOverStarted = false;
  chamberOpened = false;

  private readonly restartKey: Phaser.Input.Keyboard.Key;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly hud: Hud,
    private readonly story: StoryFlags,
    private readonly enemies: EnemyDirector,
    private readonly audioDirector: AudioDirector,
    private readonly points: InvestigationPoint[],
  ) {
    this.restartKey = scene.input.keyboard!.addKey('R');
  }

  /** 每帧：处理调查点提示与拾取。 */
  handleInvestigation() {
    const activePoint = this.points.find(
      (point) => Phaser.Math.Distance.Between(this.player.x, this.player.y, point.x, point.y) < 86,
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

  /** 每帧：书房暗门触发与 Boss 生成。 */
  handleStudyGate() {
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
      this.enemies.spawnBoss();
      this.audioDirector.setMode('boss');
      this.hud.showSubtitle('乌针：龙刃刀经，终究还是要归黑鳞会。');
    }
  }

  /** 玩家死亡时显示结算面板。 */
  startGameOver() {
    this.gameOverStarted = true;
    this.audioDirector.setMode('gameOver');
    this.player.setTint(0x6c0d17);

    this.scene.add
      .rectangle(0, 0, 1280, 720, 0x18050a, 0.82)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(130);

    this.scene.add
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

    this.scene.add
      .text(640, 348, '仇恨还未教会你如何活下去。\n雨声吞没刀鸣，龙刃沉入泥水。', {
        color: '#f2dfb8',
        fontFamily: 'serif',
        fontSize: '26px',
        align: 'center',
        lineSpacing: 10,
        stroke: '#050608',
        strokeThickness: 5,
        wordWrap: { width: 860 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(131);

    this.scene.add
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

  /** 死亡结算面板上按 R 重开。 */
  handleGameOverInput() {
    if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
      this.scene.scene.restart();
    }
  }

  /** 击败乌针后显示结局面板。 */
  startEnding() {
    this.endingStarted = true;
    this.audioDirector.setMode('ending');
    this.story.defeatWuzhen();
    this.story.leaveVillage();

    const panel = this.scene.add
      .rectangle(0, 0, 1280, 720, 0x050608, 0.82)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(120);
    const text = this.scene.add
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

    this.scene.tweens.add({
      targets: [panel, text],
      alpha: { from: 0, to: 1 },
      duration: 900,
    });
  }
}
