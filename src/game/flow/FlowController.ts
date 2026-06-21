import Phaser from 'phaser';
import type { Player } from '../player/Player';
import type { Hud } from '../ui/Hud';
import type { StoryFlags } from '../story/StoryFlags';
import type { EnemyDirector } from '../director/EnemyDirector';
import type { AudioDirector } from '../audio/AudioDirector';
import type { InvestigationPoint } from '../world/WorldBuilder';
import { VILLAGER_DIALOG, SCOUT_SURRENDER_DIALOG, AMBIENT_VILLAGER_DIALOG } from '../dialog/dialogDefs';
import { endingMoralSuffix } from './endingMoralSuffix';
import { shouldTriggerProtectEvent, resolveProtectOutcome } from './protectEvent';
import { COMBAT_BALANCE } from '../combat/combatBalance';
import type { DialogSystem } from '../dialog/DialogSystem';
import type { Npc } from '../entities/Npc';
import type { DialogDef } from '../dialog/dialogDefs';

/**
 * 第一章流程控制：调查取证、书房暗门、死亡结算、胜利结局。
 * 持有 endingStarted / gameOverStarted / chamberOpened 三个每局状态，
 * 在场景 restart 时由 GameScene.resetRunState() 重建本实例以归位。
 */
export class FlowController {
  endingStarted = false;
  gameOverStarted = false;
  chamberOpened = false;
  /** 保护村民事件是否已触发（spawnThreat 已调用）。 */
  protectTriggered = false;
  /** 保护村民事件是否已解析（成功或失败），GameScene 据此停止推进威胁者。 */
  protectResolved = false;
  private threatenedVillager: Npc | null = null;

  private readonly restartKey: Phaser.Input.Keyboard.Key;
  private readonly npcs: Npc[];
  private readonly dialog: DialogSystem;
  private readonly dialogUp: Phaser.Input.Keyboard.Key;
  private readonly dialogDown: Phaser.Input.Keyboard.Key;
  private readonly dialogConfirm: Phaser.Input.Keyboard.Key;
  private readonly dialogClose: Phaser.Input.Keyboard.Key;
  private readonly dialogDefsById: Record<string, DialogDef>;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly hud: Hud,
    private readonly story: StoryFlags,
    private readonly enemies: EnemyDirector,
    private readonly audioDirector: AudioDirector,
    private readonly points: InvestigationPoint[],
    npcs: Npc[],
    dialog: DialogSystem,
  ) {
    this.restartKey = scene.input.keyboard!.addKey('R');
    this.npcs = npcs;
    this.dialog = dialog;
    this.dialogUp = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.dialogDown = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.dialogConfirm = scene.input.keyboard!.addKey('E');
    this.dialogClose = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.dialogDefsById = {
      [VILLAGER_DIALOG.id]: VILLAGER_DIALOG,
      [SCOUT_SURRENDER_DIALOG.id]: SCOUT_SURRENDER_DIALOG,
      [AMBIENT_VILLAGER_DIALOG.id]: AMBIENT_VILLAGER_DIALOG,
    };

    this.registerDialogActions();
    this.threatenedVillager = npcs.find((npc) => npc.dialogId === 'villager') ?? null;
  }

  private registerDialogActions() {
    this.dialog.registerAction('revealThreatenedClue', (ctx) => {
      ctx.story.discoverClue('threatenedVillagers');
      for (const npc of this.npcs) {
        if (npc.dialogId === 'villager') {
          npc.markTalked();
        }
      }
    });

    this.dialog.registerAction('spareScout', (ctx) => {
      ctx.moral.addShouxin(15);
      ctx.story.recordChoice('sparedScout');
      ctx.surrenderEnemy?.escape();
    });

    this.dialog.registerAction('executeScout', (ctx) => {
      ctx.moral.addLiqi(20);
      ctx.story.recordChoice('killedScout');
      ctx.surrenderEnemy?.execute();
      ctx.rewardSoul(8);
    });
  }

  /** 对话进行时：处理选项导航/确认/关闭输入。返回是否正在对话中。 */
  handleDialogInput(): boolean {
    if (!this.dialog.isActive) {
      return false;
    }
    if (Phaser.Input.Keyboard.JustDown(this.dialogUp)) {
      this.dialog.handleInput('up');
    }
    if (Phaser.Input.Keyboard.JustDown(this.dialogDown)) {
      this.dialog.handleInput('down');
    }
    if (Phaser.Input.Keyboard.JustDown(this.dialogConfirm)) {
      this.dialog.handleInput('confirm');
    }
    if (Phaser.Input.Keyboard.JustDown(this.dialogClose)) {
      this.dialog.handleInput('close');
    }
    return true;
  }

  /** 每帧：检测玩家是否靠近 NPC 并按 E 触发对话。 */
  handleNpcDialog() {
    if (this.dialog.isActive) {
      return;
    }
    for (const npc of this.npcs) {
      if (!npc.active) {
        continue;
      }
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y);
      if (dist < 86) {
        this.hud.showPrompt('E 对话');
        if (this.player.wantsInteract()) {
          const def = this.dialogDefsById[npc.dialogId];
          if (def) {
            this.dialog.start(def);
          }
        }
        return;
      }
    }
  }

  /** 每帧：检测是否有求饶的 scout 靠近玩家并按 E 触发求饶对话。 */
  handleSurrender() {
    if (this.dialog.isActive) {
      return;
    }
    for (const enemy of this.enemies.activeEnemies) {
      if (!enemy.active || !enemy.isSurrendered) {
        continue;
      }
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (dist < 80) {
        this.hud.showPrompt('E 处置求饶者');
        if (this.player.wantsInteract()) {
          this.dialog.setSurrenderTarget(enemy);
          this.dialog.start(SCOUT_SURRENDER_DIALOG);
        }
        return;
      }
    }
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

  /** 受威胁村民 x 坐标（GameScene 推进威胁者朝村民移动用）。无村民则返回 0。 */
  get threatenedVillagerX(): number {
    return this.threatenedVillager?.x ?? 0;
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

  /** 每帧：检测保护村民事件触发与成败（威胁者 update/Strike 由 GameScene 统一推进）。 */
  handleProtectEvent() {
    if (this.protectResolved || !this.threatenedVillager?.active) {
      return;
    }

    if (!this.protectTriggered) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.threatenedVillager.x,
        this.threatenedVillager.y,
      );
      if (
        shouldTriggerProtectEvent({
          hasThreatenedClue: this.story.hasClue('threatenedVillagers'),
          playerToVillagerDist: dist,
          protectResolved: this.protectResolved,
        })
      ) {
        this.protectTriggered = true;
        this.enemies.spawnThreat(2300);
        this.hud.showSubtitle('山匪逼近村民，刀光在雨里发寒。');
      }
      return;
    }

    const threat = this.enemies.activeThreat;
    if (!threat) {
      return;
    }

    const outcome = resolveProtectOutcome({
      threatActive: threat.active,
      threatToVillagerDist: Math.abs(threat.x - this.threatenedVillager.x),
    });

    if (outcome === 'success') {
      this.protectResolved = true;
      this.story.recordChoice('protectedVillager');
      this.player.moral.addShouxin(COMBAT_BALANCE.shouxinReward.protectVillager);
      this.hud.showSubtitle('村民望着你收刀，眼里有泪。');
    } else if (outcome === 'failure') {
      this.protectResolved = true;
      this.threatenedVillager.takeDamage();
      this.hud.showSubtitle('你慢了一步，村民倒在血水里。');
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
    const moralSuffix = endingMoralSuffix(this.story.moralChoices);
    const endingBody = `密室中，三样遗物静静等待：\n《龙影刀经》、龙刃刀、父亲遗书。\n\n${moralSuffix}“刀可以杀人，也可以救人。\n若有一日你拔出龙刃，记住，不要让仇恨替你握刀。”\n\n雨夜未尽，少年带刀离家。\n他还不懂何时收刀，却已踏入江湖。`;
    const text = this.scene.add
      .text(
        640,
        260,
        endingBody,
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
