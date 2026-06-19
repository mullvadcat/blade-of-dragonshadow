import Phaser from 'phaser';
import { CombatSystem, type CombatantState, type Strike } from '../combat/CombatSystem';
import { HealthBar } from '../ui/HealthBar';

export type EnemyKind = 'scout' | 'bandit';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  readonly kind: EnemyKind;
  readonly combatState: CombatantState;
  private nextAttackAt = 0;
  private readonly label: Phaser.GameObjects.Text;
  private readonly healthBar: HealthBar;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: EnemyKind) {
    super(scene, x, y, kind === 'scout' ? 'enemy-scout' : 'enemy-bandit');
    this.kind = kind;
    this.combatState = {
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

    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(34, 60);
    body.setCollideWorldBounds(true);
    this.setDepth(10);

    this.label = scene.add
      .text(x, y - 52, kind === 'scout' ? '黑鳞探子' : '伪山匪', {
        color: '#d9c89e',
        fontFamily: 'serif',
        fontSize: '13px',
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.healthBar = new HealthBar(scene, x - 28, y - 38, {
      width: 56,
      height: 5,
      fillColor: kind === 'scout' ? 0x9e1828 : 0xb66b32,
      borderColor: 0x050608,
      depth: 22,
    });
  }

  update(time: number, playerX: number) {
    if (!this.active) {
      return;
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    const distance = playerX - this.x;

    if (time < this.combatState.staggeredUntil) {
      body.setVelocityX(0);
    } else if (Math.abs(distance) < 360 && Math.abs(distance) > 54) {
      body.setVelocityX(Math.sign(distance) * (this.kind === 'scout' ? 82 : 62));
      this.setFlipX(distance < 0);
    } else {
      body.setVelocityX(0);
    }

    this.label.setPosition(this.x, this.y - 52);
    this.healthBar.setPosition(this.x - 28, this.y - 38);
    this.healthBar.update(this.combatState.health, this.combatState.maxHealth);
  }

  canAttack(time: number, playerX: number) {
    return this.active && time >= this.nextAttackAt && Math.abs(playerX - this.x) < 62;
  }

  makeStrike(time: number): Strike {
    this.nextAttackAt = time + (this.kind === 'scout' ? 1050 : 1350);
    return this.kind === 'scout'
      ? CombatSystem.createLightStrike()
      : CombatSystem.createHeavyStrike();
  }

  receiveStrike(strike: Strike, time: number) {
    const result = CombatSystem.resolveStrike(strike, this.combatState, time);
    Object.assign(this.combatState, result.target);
    this.setTint(result.wasGuardBroken ? 0x9cf4ff : 0xff5b5b);
    this.scene.time.delayedCall(90, () => this.clearTint());

    if (this.combatState.health <= 0) {
      this.defeat();
    }

    return result;
  }

  private defeat() {
    this.label.destroy();
    this.healthBar.destroy();
    this.disableBody(true, true);
    this.destroy();
  }
}
