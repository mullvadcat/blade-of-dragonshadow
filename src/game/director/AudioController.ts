import Phaser from 'phaser';
import type { AudioDirector } from '../audio/AudioDirector';
import type { Hud } from '../ui/Hud';
import type { Player } from '../player/Player';
import type { EnemyDirector } from './EnemyDirector';
import type { FlowController } from '../flow/FlowController';

/**
 * 音频控制：唤醒 AudioContext（首次用户手势）、静音键、根据战斗状态切换音频模式。
 * 与 FlowController 共享 endingStarted/gameOverStarted 以避免结局后切模式。
 */
export class AudioController {
  private readonly muteKey: Phaser.Input.Keyboard.Key;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly audioDirector: AudioDirector,
    private readonly hud: Hud,
    private readonly player: Player,
    private readonly enemies: EnemyDirector,
    private readonly flow: FlowController,
  ) {
    this.muteKey = scene.input.keyboard!.addKey('M');
  }

  /** 首次键盘 / 指针输入时唤醒 AudioContext（浏览器自动播放策略要求用户手势）。 */
  bindWakeInput() {
    this.scene.input.keyboard!.on('keydown', () => {
      void this.startAudio();
    });
    this.scene.input.on('pointerdown', () => {
      void this.startAudio();
    });
  }

  /** 每帧：静音键 + 音频模式切换。 */
  update() {
    this.handleMute();
    this.updateMode();
  }

  private async startAudio() {
    await this.audioDirector.start();
    this.hud?.setAudioStatus(this.audioDirector.isStarted, this.audioDirector.isMuted);
  }

  private handleMute() {
    if (Phaser.Input.Keyboard.JustDown(this.muteKey)) {
      this.audioDirector.toggleMuted();
      this.hud.setAudioStatus(this.audioDirector.isStarted, this.audioDirector.isMuted);
    }
  }

  private updateMode() {
    if (this.flow.endingStarted || this.flow.gameOverStarted || this.enemies.activeBoss?.active) {
      return;
    }

    const enemyNearby = this.enemies.hasEnemyNearby(this.player.x, this.player.y);
    this.audioDirector.setMode(enemyNearby ? 'combat' : 'explore');
  }
}
