import Phaser from 'phaser';
import type { Player } from '../player/Player';
import type { StoryFlags } from '../story/StoryFlags';
import { HealthBar } from './HealthBar';

export class Hud {
  private readonly status: Phaser.GameObjects.Text;
  private readonly healthBar: HealthBar;
  private readonly staminaBar: HealthBar;
  private readonly prompt: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly audioStatus: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    scene.add
      .text(24, 18, '陆云川', {
        color: '#f0e0ba',
        fontFamily: 'serif',
        fontSize: '18px',
        stroke: '#050608',
        strokeThickness: 4,
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.healthBar = new HealthBar(scene, 92, 28, {
      width: 190,
      height: 12,
      fillColor: 0xc94747,
      lowColor: 0x8d1424,
      borderColor: 0xd7bf83,
      depth: 100,
    }).setScrollFactor(0);

    this.staminaBar = new HealthBar(scene, 92, 46, {
      width: 148,
      height: 9,
      fillColor: 0x81c789,
      lowColor: 0xb99652,
      borderColor: 0x4b614f,
      depth: 100,
    }).setScrollFactor(0);

    this.status = scene.add
      .text(300, 22, '', {
        color: '#f0e0ba',
        fontFamily: 'serif',
        fontSize: '15px',
        stroke: '#050608',
        strokeThickness: 4,
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.prompt = scene.add
      .text(640, 640, '', {
        color: '#aef6ff',
        fontFamily: 'serif',
        fontSize: '20px',
        stroke: '#050608',
        strokeThickness: 5,
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);

    this.subtitle = scene.add
      .text(640, 580, '', {
        color: '#f7e3bb',
        fontFamily: 'serif',
        fontSize: '22px',
        stroke: '#050608',
        strokeThickness: 5,
        align: 'center',
        wordWrap: { width: 900 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);

    this.audioStatus = scene.add
      .text(1256, 684, '音律：待唤醒  M 静音', {
        color: '#8fa9b0',
        fontFamily: 'serif',
        fontSize: '15px',
        stroke: '#050608',
        strokeThickness: 3,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);
  }

  update(player: Player, story: StoryFlags) {
    const state = player.machine.state;
    this.healthBar.update(state.health, state.maxHealth);
    this.staminaBar.update(state.stamina, state.maxStamina);
    this.status.setText(
      `血 ${Math.ceil(state.health)}/${state.maxHealth}  体 ${Math.ceil(
        state.stamina,
      )}/${state.maxStamina}  线索 ${story.discoveredClueCount}/4`,
    );
  }

  showPrompt(text: string) {
    this.prompt.setText(text);
  }

  showSubtitle(text: string, duration = 3600) {
    this.subtitle.setText(text);
    this.subtitle.scene.time.delayedCall(duration, () => {
      if (this.subtitle.text === text) {
        this.subtitle.setText('');
      }
    });
  }

  setAudioStatus(started: boolean, muted: boolean) {
    const soundState = muted ? '静音' : started ? '有声' : '待唤醒';
    this.audioStatus.setText(`音律：${soundState}  M ${muted ? '开声' : '静音'}`);
  }
}
