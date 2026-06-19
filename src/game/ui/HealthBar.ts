import Phaser from 'phaser';

export type HealthBarOptions = {
  width: number;
  height: number;
  fillColor: number;
  lowColor?: number;
  backColor?: number;
  borderColor?: number;
  depth?: number;
};

export class HealthBar {
  private readonly back: Phaser.GameObjects.Rectangle;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly border: Phaser.GameObjects.Rectangle;
  private readonly width: number;
  private readonly fillColor: number;
  private readonly lowColor: number;

  constructor(scene: Phaser.Scene, x: number, y: number, options: HealthBarOptions) {
    this.width = options.width;
    this.fillColor = options.fillColor;
    this.lowColor = options.lowColor ?? 0x9e1828;

    this.back = scene.add
      .rectangle(x, y, options.width, options.height, options.backColor ?? 0x121319, 0.88)
      .setOrigin(0, 0.5)
      .setDepth(options.depth ?? 30);
    this.fill = scene.add
      .rectangle(x, y, options.width, options.height, options.fillColor, 0.96)
      .setOrigin(0, 0.5)
      .setDepth((options.depth ?? 30) + 1);
    this.border = scene.add
      .rectangle(x, y, options.width, options.height, options.borderColor ?? 0x050608, 0)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1, options.borderColor ?? 0x050608, 0.95)
      .setDepth((options.depth ?? 30) + 2);
  }

  setScrollFactor(x: number, y?: number) {
    this.back.setScrollFactor(x, y);
    this.fill.setScrollFactor(x, y);
    this.border.setScrollFactor(x, y);
    return this;
  }

  setVisible(visible: boolean) {
    this.back.setVisible(visible);
    this.fill.setVisible(visible);
    this.border.setVisible(visible);
  }

  setPosition(x: number, y: number) {
    this.back.setPosition(x, y);
    this.fill.setPosition(x, y);
    this.border.setPosition(x, y);
  }

  update(current: number, max: number) {
    const ratio = max <= 0 ? 0 : Phaser.Math.Clamp(current / max, 0, 1);
    this.fill.width = Math.max(0, this.width * ratio);
    this.fill.setFillStyle(ratio <= 0.28 ? this.lowColor : this.fillColor, 0.96);
  }

  destroy() {
    this.back.destroy();
    this.fill.destroy();
    this.border.destroy();
  }
}
