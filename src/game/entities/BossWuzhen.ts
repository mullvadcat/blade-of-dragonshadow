import type Phaser from 'phaser';
import { CombatSystem, type Strike } from '../combat/CombatSystem';
import { CombatActor } from './CombatActor';
import type { SfxName } from '../audio/AudioDirector';

export class BossWuzhen extends CombatActor {
  private phase: 'needles' | 'smoke' = 'needles';
  private aura: Phaser.GameObjects.Arc | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, playSfx?: (name: SfxName) => void) {
    super(scene, x, y, {
      texture: 'boss-wuzhen',
      combatState: {
        health: 180,
        maxHealth: 180,
        guard: 0,
        maxGuard: 84,
        stamina: 70,
        maxStamina: 70,
        soul: 0,
        maxSoul: 0,
        isBlocking: false,
        perfectGuardUntil: 0,
        invulnerableUntil: 0,
        staggeredUntil: 0,
      },
      bodySize: [46, 70],
      depth: 11,
      attackRange: 86,
      hitTint: 0xff3d4f,
      hitFlashMs: 100,
      telegraphColor: 0xff5470,
      strikeColor: 0xff3d4f,
      defeatSfx: 'bossDown',
      playSfx,
      nameplate: {
        text: '乌针',
        style: {
          color: '#ffdfb2',
          fontFamily: 'serif',
          fontSize: '18px',
          stroke: '#310909',
          strokeThickness: 4,
        },
        offsetY: -68,
      },
      healthBar: {
        width: 156,
        height: 8,
        fillColor: 0xd22d42,
        lowColor: 0xff304c,
        borderColor: 0x310909,
        depth: 22,
        offsetX: -78,
        offsetY: -48,
      },
    });
  }

  update(time: number, playerX: number) {
    if (!this.active) {
      return;
    }

    this.phase = this.combatState.health < this.combatState.maxHealth * 0.48 ? 'smoke' : 'needles';
    this.chase(time, playerX, this.phase === 'smoke' ? 128 : 92, 74, 460);

    if (this.phase === 'smoke') {
      this.ensureAura();
      this.setTint(0xff9aa4);
    } else {
      this.aura?.setVisible(false);
      this.clearTint();
    }

    if (this.aura) {
      this.aura.setPosition(this.x, this.y - 8);
      this.aura.rotation += 0.018;
    }

    this.followUi();
  }

  protected buildStrike(): Strike {
    return this.phase === 'smoke'
      ? { ...CombatSystem.createLightStrike(), damage: 18, guardDamage: 18 }
      : { ...CombatSystem.createHeavyStrike(), damage: 22, guardDamage: 24 };
  }

  protected attackInterval(): number {
    return this.phase === 'smoke' ? 760 : 980;
  }

  protected telegraphMs(): number {
    // 狂暴(smoke)阶段出招更急，留给玩家的反应时间更短。
    return this.phase === 'smoke' ? 300 : 420;
  }

  protected override onDefeat() {
    this.aura?.destroy();
  }

  private ensureAura() {
    if (!this.aura) {
      this.aura = this.scene.add
        .arc(this.x, this.y - 8, 48, 0, 360, false)
        .setStrokeStyle(3, 0xff304c, 0.42)
        .setDepth(9);
    }
    this.aura.setVisible(true);
  }
}
