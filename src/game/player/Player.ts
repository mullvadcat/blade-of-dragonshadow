import Phaser from 'phaser';
import { PlayerStateMachine } from './PlayerStateMachine';
import type { Strike } from '../combat/CombatSystem';

export class Player extends Phaser.Physics.Arcade.Sprite {
  readonly machine = new PlayerStateMachine();
  facing: -1 | 1 = 1;
  private attackCooldownUntil = 0;
  private dodgeUntil = 0;
  private readonly keys: Record<string, Phaser.Input.Keyboard.Key>;
  private wasBlocking = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(34, 66);
    body.setCollideWorldBounds(true);
    this.setDepth(12);

    this.keys = scene.input.keyboard!.addKeys({
      up: 'W',
      left: 'A',
      down: 'S',
      right: 'D',
      dodge: 'SPACE',
      light: 'J',
      heavy: 'K',
      block: 'L',
      interact: 'E',
    }) as Record<string, Phaser.Input.Keyboard.Key>;
  }

  update(time: number, cursors: Phaser.Types.Input.Keyboard.CursorKeys) {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.machine.isDead()) {
      body.setVelocity(0, body.velocity.y);
      this.setAngle(0);
      this.machine.stopBlocking();
      return;
    }

    const left = cursors.left?.isDown || this.keys.left.isDown;
    const right = cursors.right?.isDown || this.keys.right.isDown;
    const blocking = this.keys.block.isDown;

    if (blocking && !this.machine.state.isBlocking) {
      this.machine.startBlocking(time);
      this.playGuardFlash();
    } else if (!blocking && this.machine.state.isBlocking) {
      this.machine.stopBlocking();
    }
    this.wasBlocking = this.machine.state.isBlocking;

    if (Phaser.Input.Keyboard.JustDown(this.keys.dodge)) {
      const didDodge = this.machine.tryDodge(time);
      if (didDodge) {
        this.dodgeUntil = time + 220;
      }
    }

    if (left) {
      this.facing = -1;
      this.setFlipX(true);
    } else if (right) {
      this.facing = 1;
      this.setFlipX(false);
    }

    const speed = time < this.dodgeUntil ? 430 : this.machine.state.isBlocking ? 90 : 210;
    body.setVelocityX(left ? -speed : right ? speed : 0);
    this.setAngle(left ? -3 : right ? 3 : 0);

    if (body.blocked.down && (Phaser.Input.Keyboard.JustDown(this.keys.up) || cursors.up?.isDown)) {
      body.setVelocityY(-470);
    }

    this.machine.recoverStamina(0.13);
  }

  consumeAttack(time: number): Strike | null {
    if (this.machine.isDead()) {
      return null;
    }

    if (time < this.attackCooldownUntil) {
      return null;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.light)) {
      const strike = this.machine.tryLightAttack(time);
      if (strike) {
        this.attackCooldownUntil = time + 220;
        this.playAttackFeedback(false);
      }
      return strike;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.heavy)) {
      const strike = this.machine.tryHeavyAttack(time);
      if (strike) {
        this.attackCooldownUntil = time + 420;
        this.playAttackFeedback(true);
      }
      return strike;
    }

    return null;
  }

  wantsInteract() {
    if (this.machine.isDead()) {
      return false;
    }

    return Phaser.Input.Keyboard.JustDown(this.keys.interact);
  }

  private playAttackFeedback(isHeavy: boolean) {
    this.scene.tweens.killTweensOf(this);
    this.setScale(isHeavy ? 1.16 : 1.1, isHeavy ? 0.9 : 0.94);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      duration: isHeavy ? 180 : 110,
      ease: 'Back.Out',
    });
  }

  private playGuardFlash() {
    if (this.wasBlocking) {
      return;
    }

    const arc = this.scene.add
      .arc(this.x + this.facing * 30, this.y - 8, 34, 290, 70, false)
      .setStrokeStyle(4, 0xaefaff, 0.92)
      .setDepth(45);
    this.scene.tweens.add({
      targets: arc,
      alpha: 0,
      scaleX: 1.25,
      scaleY: 1.25,
      duration: 180,
      onComplete: () => arc.destroy(),
    });
  }
}
