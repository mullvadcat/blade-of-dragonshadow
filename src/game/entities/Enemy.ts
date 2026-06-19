import Phaser from 'phaser';
import { CombatSystem, type CombatantState, type Strike } from '../combat/CombatSystem';
import { CombatActor } from './CombatActor';

export type EnemyKind = 'scout' | 'bandit';

export class Enemy extends CombatActor {
  readonly kind: EnemyKind;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: EnemyKind) {
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

  makeStrike(time: number): Strike {
    this.nextAttackAt = time + (this.kind === 'scout' ? 1050 : 1350);
    return this.kind === 'scout'
      ? CombatSystem.createLightStrike()
      : CombatSystem.createHeavyStrike();
  }
}
