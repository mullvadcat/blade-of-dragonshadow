import Phaser from 'phaser';
import { CombatSystem, type CombatantState, type Strike } from '../combat/CombatSystem';
import { HealthBar } from '../ui/HealthBar';

export class BossWuzhen extends Phaser.Physics.Arcade.Sprite {
  readonly combatState: CombatantState;
  private nextAttackAt = 0;
  private phase: 'needles' | 'smoke' = 'needles';
  private readonly nameplate: Phaser.GameObjects.Text;
  private readonly healthBar: HealthBar;
  private aura: Phaser.GameObjects.Arc | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'boss-wuzhen');
    this.combatState = {
      health: 180,
      maxHealth: 180,
      guard: 0,
      maxGuard: 84,
      stamina: 70,
      maxStamina: 70,
      isBlocking: false,
      perfectGuardUntil: 0,
      invulnerableUntil: 0,
      staggeredUntil: 0,
    };

    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(46, 70);
    body.setCollideWorldBounds(true);
    this.setDepth(11);

    this.nameplate = scene.add
      .text(x, y - 68, '乌针', {
        color: '#ffdfb2',
        fontFamily: 'serif',
        fontSize: '18px',
        stroke: '#310909',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.healthBar = new HealthBar(scene, x - 78, y - 48, {
      width: 156,
      height: 8,
      fillColor: 0xd22d42,
      lowColor: 0xff304c,
      borderColor: 0x310909,
      depth: 22,
    });
  }

  update(time: number, playerX: number) {
    if (!this.active) {
      return;
    }

    this.phase =
      this.combatState.health < this.combatState.maxHealth * 0.48 ? 'smoke' : 'needles';
    const body = this.body as Phaser.Physics.Arcade.Body;
    const distance = playerX - this.x;

    if (time < this.combatState.staggeredUntil) {
      body.setVelocityX(0);
    } else if (Math.abs(distance) > 74 && Math.abs(distance) < 460) {
      body.setVelocityX(Math.sign(distance) * (this.phase === 'smoke' ? 128 : 92));
      this.setFlipX(distance < 0);
    } else {
      body.setVelocityX(0);
    }

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

    this.nameplate.setPosition(this.x, this.y - 68);
    this.healthBar.setPosition(this.x - 78, this.y - 48);
    this.healthBar.update(this.combatState.health, this.combatState.maxHealth);
  }

  canAttack(time: number, playerX: number) {
    return this.active && time >= this.nextAttackAt && Math.abs(playerX - this.x) < 86;
  }

  makeStrike(time: number): Strike {
    this.nextAttackAt = time + (this.phase === 'smoke' ? 760 : 980);
    return this.phase === 'smoke'
      ? { ...CombatSystem.createLightStrike(), damage: 18, guardDamage: 18 }
      : { ...CombatSystem.createHeavyStrike(), damage: 22, guardDamage: 24 };
  }

  receiveStrike(strike: Strike, time: number) {
    const result = CombatSystem.resolveStrike(strike, this.combatState, time);
    Object.assign(this.combatState, result.target);
    this.setTint(result.wasGuardBroken ? 0x9cf4ff : 0xff3d4f);
    this.scene.time.delayedCall(100, () => this.clearTint());

    if (this.combatState.health <= 0) {
      this.aura?.destroy();
      this.healthBar.destroy();
      this.nameplate.destroy();
      this.disableBody(true, true);
      this.destroy();
    }

    return result;
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
