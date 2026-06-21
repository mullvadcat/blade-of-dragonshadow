import Phaser from 'phaser';
import { Hud } from './ui/Hud';
import { Player } from './player/Player';
import { StoryFlags } from './story/StoryFlags';
import { AudioDirector, type SfxName } from './audio/AudioDirector';
import { WorldBuilder } from './world/WorldBuilder';
import { EnemyDirector } from './director/EnemyDirector';
import { CombatDirector } from './director/CombatDirector';
import { AudioController } from './director/AudioController';
import { FlowController } from './flow/FlowController';
import { DialogSystem, type DialogContext } from './dialog/DialogSystem';
import { DialogUi } from './dialog/DialogUi';
import type { Npc } from './entities/Npc';
import type { Destructible } from './entities/Destructible';

/**
 * 第一章·雨夜疑案 主场景。
 *
 * 重构后本类只负责：生命周期（create/update）、装配各子系统、维护每局可变状态归位
 * （resetRunState）。世界搭建、敌人调度、战斗结算、流程控制、音频分别由 WorldBuilder /
 * EnemyDirector / CombatDirector / FlowController / AudioController 承担。
 */
export class GameScene extends Phaser.Scene {
  private player!: Player;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private hud!: Hud;
  private story = new StoryFlags();
  private audioDirector = new AudioDirector();
  private sfx: (name: SfxName) => void = () => {};

  private world!: WorldBuilder;
  private enemyDirector!: EnemyDirector;
  private combatDirector!: CombatDirector;
  private audioController!: AudioController;
  private flow!: FlowController;
  private dialogSystem!: DialogSystem;
  private dialogUi!: DialogUi;
  private npcs: Npc[] = [];
  private destructibles: Destructible[] = [];

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
    this.audioDirector.setMode('explore');
  }

  preload() {
    this.world = new WorldBuilder(this);
    this.world.createGeneratedTextures();
  }

  create() {
    this.resetRunState();
    this.physics.world.setBounds(0, 0, 4400, 720);
    this.cameras.main.setBounds(0, 0, 4400, 720);

    this.sfx = (name: SfxName) => this.audioDirector.playSfx(name);

    // 世界：背景、平台、调查点。
    this.world.drawWorld();
    const ground = this.world.buildPlatforms();
    const points = this.world.createInvestigationPoints();
    this.npcs = this.world.createNpcs();
    this.destructibles = this.world.createDestructibles();

    // 玩家与输入。
    this.player = new Player(this, 130, 560, this.sfx);
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.physics.add.collider(this.player, ground);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(260, 120);

    // 子系统装配（顺序有依赖：FlowController 需要 enemies，CombatDirector 需要 enemies + flow）。
    this.enemyDirector = new EnemyDirector(this, ground, this.sfx);
    this.enemyDirector.createEnemies();

    this.hud = new Hud(this);

    const dialogContext: DialogContext = {
      moral: this.player.moral,
      story: this.story,
      surrenderEnemy: null,
      rewardSoul: (amount) => this.player.machine.addSoul(amount),
    };
    this.dialogSystem = new DialogSystem(dialogContext);
    this.dialogUi = new DialogUi(this, this.dialogSystem);

    this.flow = new FlowController(
      this,
      this.player,
      this.hud,
      this.story,
      this.enemyDirector,
      this.audioDirector,
      points,
      this.npcs,
      this.dialogSystem,
    );
    this.combatDirector = new CombatDirector(
      this,
      this.player,
      this.enemyDirector,
      this.hud,
      this.sfx,
      this.npcs,
      this.destructibles,
      () => {
        if (!this.flow.endingStarted) {
          this.flow.startEnding();
        }
      },
    );
    this.audioController = new AudioController(this, this.audioDirector, this.hud, this.player, this.enemyDirector, this.flow);
    this.audioController.bindWakeInput();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.audioDirector.stop());

    this.hud.setAudioStatus(this.audioDirector.isStarted, this.audioDirector.isMuted);
    this.hud.showSubtitle('雨没有停。父亲的棺木刚入土，陆家旧宅却还藏着未冷的刀声。');

    this.add
      .text(22, 690, '移动WASD 闪避Space 轻斩J 重斩K 格挡L 刀气U 潜龙I 裂鳞O 对话/调查E', {
        color: '#8fa9b0',
        fontFamily: 'serif',
        fontSize: '14px',
      })
      .setScrollFactor(0)
      .setDepth(100);
    this.add
      .text(22, 708, '游龙回身=闪避后按J/K  龙魂靠命中/击杀/完美格挡积累  R重开 M静音', {
        color: '#6a8196',
        fontFamily: 'serif',
        fontSize: '13px',
      })
      .setScrollFactor(0)
      .setDepth(100);
  }

  update(time: number) {
    // 对话进行时：冻结世界，只处理对话输入与 UI
    if (this.dialogSystem.isActive) {
      this.flow.handleDialogInput();
      this.dialogUi.update();
      return;
    }

    this.player.update(time, this.cursors);
    this.hud.update(this.player, this.story, time, this.combatDirector.skillState);
    this.audioController.update();

    if (this.player.machine.isDead()) {
      this.flow.handleGameOverInput();
      if (!this.flow.gameOverStarted && !this.flow.endingStarted) {
        this.flow.startGameOver();
      }
      return;
    }

    this.flow.handleNpcDialog();
    this.flow.handleSurrender();
    this.flow.handleInvestigation();
    this.flow.handleStudyGate();
    this.flow.handleProtectEvent();

    // 玩家攻击与技能并行处理：consumeAttack 返回普通斩击或游龙回身派生标记。
    // 每帧都轮询技能键(I/O)，避免同帧按攻击+技能时 JustDown 标志被帧末清除导致技能丢失。
    const attackStrike = this.player.consumeAttack(time);
    if (attackStrike && attackStrike.staminaDamage === -1) {
      this.combatDirector.handleSkills(time, attackStrike);
    } else {
      if (attackStrike) {
        this.combatDirector.applyPlayerAttack(attackStrike, time);
      }
      this.combatDirector.handleSkills(time, null);
    }
    this.combatDirector.handleBladeAura(time);

    const enemyStrikes = this.enemyDirector.advanceEnemies(time, this.player.x);
    for (const strike of enemyStrikes) {
      if (this.flow.endingStarted || this.flow.gameOverStarted) {
        break;
      }
      this.combatDirector.applyEnemyStrike(strike, time);
    }

    const bossStrike = this.enemyDirector.advanceBoss(time, this.player.x);
    if (bossStrike && !this.flow.endingStarted && !this.flow.gameOverStarted) {
      this.combatDirector.applyEnemyStrike(bossStrike, time);
    }

    const threat = this.enemyDirector.activeThreat;
    if (threat?.active && !this.flow.protectResolved) {
      threat.update(time, this.flow.threatenedVillagerX);
      const threatStrike = threat.advanceAttack(time, this.flow.threatenedVillagerX);
      if (threatStrike && !this.flow.endingStarted && !this.flow.gameOverStarted) {
        this.combatDirector.applyEnemyStrike(threatStrike, time);
      }
    }

    for (const npc of this.npcs) {
      npc.update();
    }
  }
}
