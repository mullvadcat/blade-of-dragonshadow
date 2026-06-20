import type Phaser from 'phaser';
import type { DialogSystem } from './DialogSystem';

/**
 * 底部对话框渲染：读 DialogSystem.state 画说话人/台词/选项高亮。
 * 不持有对话逻辑，只负责视觉。depth 110（高于游戏低于结局面板 120/130）。
 */
export class DialogUi {
  private readonly box: Phaser.GameObjects.Rectangle;
  private readonly border: Phaser.GameObjects.Rectangle;
  private readonly speakerText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly optionsText: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly group: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    private readonly system: DialogSystem,
  ) {
    this.group = scene.add.container(0, 0).setScrollFactor(0).setDepth(110).setVisible(false);

    this.box = scene.add
      .rectangle(640, 560, 920, 150, 0x121319, 0.94)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0xd7bf83, 0.9);
    this.border = scene.add
      .rectangle(640, 560, 908, 138, 0x000000, 0)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x6b5d44, 0.6);
    this.speakerText = scene.add
      .text(200, 502, '', {
        color: '#d7bf83',
        fontFamily: 'serif',
        fontSize: '20px',
        stroke: '#050608',
        strokeThickness: 4,
      })
      .setOrigin(0, 0.5);
    this.bodyText = scene.add
      .text(200, 540, '', {
        color: '#f0e0ba',
        fontFamily: 'serif',
        fontSize: '20px',
        stroke: '#050608',
        strokeThickness: 4,
        wordWrap: { width: 860 },
      })
      .setOrigin(0, 0);
    this.optionsText = scene.add
      .text(200, 600, '', {
        color: '#a8a8a8',
        fontFamily: 'serif',
        fontSize: '18px',
        stroke: '#050608',
        strokeThickness: 3,
      })
      .setOrigin(0, 0);
    this.hint = scene.add
      .text(1080, 624, '', {
        color: '#8fa9b0',
        fontFamily: 'serif',
        fontSize: '15px',
        stroke: '#050608',
        strokeThickness: 3,
      })
      .setOrigin(1, 0.5);

    this.group.add([
      this.box,
      this.border,
      this.speakerText,
      this.bodyText,
      this.optionsText,
      this.hint,
    ]);
  }

  update() {
    const state = this.system.state;
    if (!state) {
      this.group.setVisible(false);
      return;
    }
    this.group.setVisible(true);
    this.speakerText.setText(state.speaker);
    this.bodyText.setText(state.text);

    if (state.options.length > 0) {
      const lines = state.options.map((opt) => `${opt.selected ? '▶ ' : '  '}${opt.label}`);
      this.optionsText.setText(lines.join('\n'));
      const selected = state.options.find((opt) => opt.selected);
      this.optionsText.setColor(selected ? '#d7bf83' : '#a8a8a8');
      this.hint.setText('↑/↓ 选 · E 定 · Esc 关');
    } else {
      this.optionsText.setText('');
      this.hint.setText('E 继续 · Esc 关');
    }
  }
}
