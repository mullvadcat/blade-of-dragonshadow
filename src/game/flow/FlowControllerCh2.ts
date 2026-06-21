import Phaser from 'phaser';
import type { EnemyDirectorCh2 } from '../director/EnemyDirectorCh2';
import type { SfxName } from '../audio/AudioDirector';

/**
 * 第二章流程控制：波次敌人生成、铁臂罗 Boss 战、战胜后的章节结束序列。
 * 管理 bossDefeated 状态，GameScene 据此停止主循环并触发结束演出。
 */
export class FlowControllerCh2 {
  private wave1Spawned = false;
  private wave2Spawned = false;
  private bossSpawned = false;
  bossDefeated = false;
  private endStarted = false;

  constructor(
    private readonly enemies: EnemyDirectorCh2,
    private readonly scene: Phaser.Scene,
    private readonly sfx: (name: SfxName) => void,
  ) {}

  /**
   * 每帧：检测玩家进度触发波次生成与 Boss 生成，及 Boss 击败检查。
   */
  handleWaveProgression(playerX: number) {
    if (!this.wave1Spawned && playerX > 400) {
      this.enemies.spawnWave1();
      this.wave1Spawned = true;
    }
    if (!this.wave2Spawned && playerX > 1500) {
      this.enemies.spawnWave2();
      this.wave2Spawned = true;
    }
    if (!this.bossSpawned && playerX > 2600) {
      this.enemies.spawnBoss();
      this.bossSpawned = true;
    }
    if (this.bossSpawned && !this.bossDefeated) {
      const boss = this.enemies.activeBossIronArm;
      if (boss && !boss.active) {
        this.bossDefeated = true;
      }
    }
  }

  /**
   * 每帧：处理章节结束序列（bossDefeated 后播放音效、淡黑、显示结束文字、重启章节 1）。
   */
  handleChapterEnd() {
    if (!this.bossDefeated || this.endStarted) return;
    this.endStarted = true;
    this.sfx('bossDown');

    this.scene.time.delayedCall(1200, () => {
      this.scene.cameras.main.fadeOut(800, 0, 0, 0);
      this.scene.cameras.main.once(
        Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
        () => {
          this.showEndingText();
        },
      );
    });
  }

  /**
   * 显示章节结束文字（两行）并在 4000ms 后重启到第一章。
   */
  private showEndingText() {
    this.scene.add
      .text(640, 300, '铁臂罗，授首。', {
        color: '#f5c518',
        fontFamily: 'serif',
        fontSize: '36px',
        stroke: '#000000',
        strokeThickness: 6,
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(200);

    this.scene.add
      .text(640, 360, '然而黑鳞会的影子，比预想的更深……', {
        color: '#d0c0a0',
        fontFamily: 'serif',
        fontSize: '22px',
        stroke: '#000000',
        strokeThickness: 5,
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(200);

    this.scene.time.delayedCall(4000, () => {
      this.scene.scene.restart({ chapter: 1 });
    });
  }
}
