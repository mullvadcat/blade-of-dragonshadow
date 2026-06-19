import Phaser from 'phaser';
import { CombatSystem, type CombatantState, type Strike } from '../combat/CombatSystem';
import { CombatActor } from './CombatActor';
import type { SfxName } from '../audio/AudioDirector';

export type EnemyKind = 'scout' | 'bandit';

export class Enemy extends CombatActor {
  readonly kind: EnemyKind;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    kind: EnemyKind,
    playSfx?: (name: SfxName) => void,
  ) {
    const combatState: CombatantState = {
      health: kind === 'scout' ? 42 : 58,
      maxHealth: kind === 'scout' ? 42 : 58,
      guard: 0,
      maxGuard: kind === 'scout' ? 42 : 54,
      stamina: 30,
      maxStamina: 30,
      isBlocking: false,
      perfectGuardUntil: 0,
      invulnerableUntil: 0,
      staggeredUntil: 0,
    };

    super(scene, x, y, {
      texture: kind === 'scout' ? 'enemy-scout' : 'enemy-bandit',
      combatState,
      bodySize: [34, 60],
      depth: 10,
      attackRange: 62,
      hitTint: 0xff5b5b,
      hitFlashMs: 90,
      telegraphColor: 0xffd166,
      strikeColor: 0xff7b5b,
      defeatSfx: 'enemyDown',
      playSfx,
      nameplate: {
        text: kind === 'scout' ? '黑鳞探子' : '伪山匪',
        style: { color: '#d9c89e', fontFamily: 'serif', fontSize: '13px' },
        offsetY: -52,
      },
      healthBar: {
        width: 56,
        height: 5,
        fillColor: kind === 'scout' ? 0x9e1828 : 0xb66b32,
        borderColor: 0x050608,
        depth: 22,
        offsetX: -28,
        offsetY: -38,
      },
    });

    this.kind = kind;
  }

  update(time: number, playerX: number) {
    if (!this.active) {
      return;
    }

    this.chase(time, playerX, this.kind === 'scout' ? 82 : 62, 54, 360);
    this.followUi();
  }

  protected buildStrike(): Strike {
    return this.kind === 'scout'
      ? CombatSystem.createLightStrike()
      : CombatSystem.createHeavyStrike();
  }

  protected attackInterval(): number {
    return this.kind === 'scout' ? 1050 : 1350;
  }

  protected telegraphMs(): number {
    // 山匪重斩前摇更长，更好预判；探子轻快但仍给出可见信号。
    return this.kind === 'scout' ? 340 : 460;
  }
}
