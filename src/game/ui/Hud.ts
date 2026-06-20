import Phaser from 'phaser';
import type { Player } from '../player/Player';
import type { StoryFlags } from '../story/StoryFlags';
import type { SkillSystem } from '../skills/SkillSystem';
import { SKILL_DEFS, type SkillId } from '../skills/skillDefs';
import { HealthBar } from './HealthBar';

const EDGE_BAND = 96; // 边缘晕染带宽度（像素）

const SKILL_ICON_DEFS: Array<{ id: SkillId; label: string; x: number }> = [
  { id: 'dragonLurk', label: '潜', x: 24 },
  { id: 'dragonReturn', label: '回', x: 74 },
  { id: 'scaleBreak', label: '裂', x: 124 },
];

export class Hud {
  private readonly status: Phaser.GameObjects.Text;
  private readonly healthBar: HealthBar;
  private readonly staminaBar: HealthBar;
  private readonly soulBar: HealthBar;
  private readonly prompt: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly audioStatus: Phaser.GameObjects.Text;
  /** 画面边缘红/青晕染：随戾气/守心强度变化的可视化心境指示器。 */
  private readonly edgeGfx: Phaser.GameObjects.Graphics;
  /** 技能状态图标：三式 + 冷却暗化 + 龙魂不足变灰。 */
  private readonly skillIcons: Array<{
    text: Phaser.GameObjects.Text;
    bg: Phaser.GameObjects.Rectangle;
    id: SkillId;
  }>;

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

    // 龙魂条（第三条资源）：黑金配色，GDD §12 色彩语言（黑金 = 龙刃刀/江湖旧时代）。
    this.soulBar = new HealthBar(scene, 92, 60, {
      width: 120,
      height: 7,
      fillColor: 0xd7bf83,
      lowColor: 0x4b3a1a,
      borderColor: 0x2a1f0a,
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

    // 边缘晕染层：置于所有 UI 之下（depth 90），不遮挡 HUD 信息。
    this.edgeGfx = scene.add.graphics().setScrollFactor(0).setDepth(90);

    // 技能状态条：左下角三式图标 + 冷却暗化
    this.skillIcons = SKILL_ICON_DEFS.map((s) => {
      const bg = scene.add
        .rectangle(s.x, 652, 42, 42, 0x121319, 0.85)
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(100);
      const text = scene.add
        .text(s.x + 21, 673, s.label, {
          color: '#d7bf83',
          fontFamily: 'serif',
          fontSize: '22px',
          stroke: '#050608',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(101);
      return { text, bg, id: s.id };
    });
  }

  update(player: Player, story: StoryFlags, time: number, skillSystem?: SkillSystem) {
    const state = player.machine.state;
    this.healthBar.update(state.health, state.maxHealth);
    this.staminaBar.update(state.stamina, state.maxStamina);
    this.soulBar.update(state.soul, state.maxSoul);
    this.status.setText(
      `血 ${Math.ceil(state.health)}/${state.maxHealth}  体 ${Math.ceil(
        state.stamina,
      )}/${state.maxStamina}  魂 ${Math.ceil(state.soul)}/${state.maxSoul}  线索 ${story.discoveredClueCount}/4`,
    );
    this.updateEdgeTint(player);
    if (skillSystem) {
      this.updateSkillIcons(player, skillSystem, time);
    }
  }

  /**
   * 根据 moral.edgeTint() 重画画面四边的渐变晕染。
   * 戾气强 → 红色边缘；守心强 → 青色边缘；平衡 → 透明。
   * 这是 PRD §7.3 红线：玩家通过边缘晕染感知心境，无需数字条。
   */
  private updateEdgeTint(player: Player) {
    const tint = player.moral.edgeTint();
    this.edgeGfx.clear();
    if (tint.alpha <= 0) {
      return;
    }
    const r = (tint.color >> 16) & 0xff;
    const g = (tint.color >> 8) & 0xff;
    const b = tint.color & 0xff;
    const inner = Phaser.Display.Color.GetColor(r, g, b);
    // 四条边各画一个从外缘（实色）向内（透明）的渐变带
    this.drawEdgeBand(0, 0, 1280, EDGE_BAND, inner, tint.alpha); // 上
    this.drawEdgeBand(0, 720 - EDGE_BAND, 1280, EDGE_BAND, inner, tint.alpha); // 下
    this.drawEdgeBand(0, 0, EDGE_BAND, 720, inner, tint.alpha); // 左
    this.drawEdgeBand(1280 - EDGE_BAND, 0, EDGE_BAND, 720, inner, tint.alpha); // 右
  }

  private drawEdgeBand(x: number, y: number, w: number, h: number, color: number, alpha: number) {
    // 用多层半透明矩形叠加模拟渐变（Phaser graphics 不支持逐像素 alpha 渐变 fill，
    // 用 4 层阶梯 alpha 近似，性能可接受且视觉柔和）
    const layers = 4;
    for (let i = 0; i < layers; i++) {
      const layerAlpha = alpha * (1 - i / layers);
      this.edgeGfx.fillStyle(color, layerAlpha);
      const inset = (EDGE_BAND / layers) * i;
      this.edgeGfx.fillRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
    }
  }

  /** 更新技能图标：冷却中暗化，龙魂不足变灰。 */
  private updateSkillIcons(player: Player, skillSystem: SkillSystem, time: number) {
    for (const icon of this.skillIcons) {
      const cost = SKILL_DEFS[icon.id].soulCost;
      const cd = skillSystem.cooldownRemaining(icon.id, time);
      const soulEnough = player.machine.state.soul >= cost;
      const dim = cd > 0 || !soulEnough;
      icon.bg.setFillStyle(0x121319, dim ? 0.95 : 0.85);
      icon.text.setAlpha(dim ? 0.4 : 1);
      icon.text.setColor(!soulEnough ? '#6a6a6a' : cd > 0 ? '#8a7a5a' : '#d7bf83');
    }
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
