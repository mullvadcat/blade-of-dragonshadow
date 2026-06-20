import Phaser from 'phaser';
import { PlayerStateMachine } from './PlayerStateMachine';
import { MoralState } from '../moral/MoralState';
import type { Strike } from '../combat/CombatSystem';
import type { SfxName } from '../audio/AudioDirector';

export class Player extends Phaser.Physics.Arcade.Sprite {
  readonly machine = new PlayerStateMachine();
  readonly moral = new MoralState();
  facing: -1 | 1 = 1;
  private attackCooldownUntil = 0;
  private dodgeUntil = 0;
  private readonly keys: Record<string, Phaser.Input.Keyboard.Key>;
  private wasBlocking = false;
  private readonly playSfx: (name: SfxName) => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    playSfx: (name: SfxName) => void = () => {},
  ) {
    super(scene, x, y, 'player');
    this.playSfx = playSfx;
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
      const raised = this.machine.startBlocking(time);
      this.playGuardFlash();
      if (raised) {
        this.playSfx('block');
      }
    } else if (!blocking && this.machine.state.isBlocking) {
      this.machine.stopBlocking();
    }
    this.wasBlocking = this.machine.state.isBlocking;

    if (Phaser.Input.Keyboard.JustDown(this.keys.dodge)) {
      const didDodge = this.machine.tryDodge(time);
      if (didDodge) {
        this.dodgeUntil = time + 220;
        this.playSfx('dodge');
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

    // 游龙回身派生：闪避后窗口内按轻/重攻击键 → 返回游龙回身标记 Strike。
    // 注意：此处不消费闪避后窗口——窗口由 CombatDirector 在释放成功后消费，
    // 避免龙魂不足时窗口被白白消耗且无反馈。
    if (this.machine.isInDodgeCounterWindow(time)) {
      const pressedLight = Phaser.Input.Keyboard.JustDown(this.keys.light);
      const pressedHeavy = Phaser.Input.Keyboard.JustDown(this.keys.heavy);
      if (pressedLight || pressedHeavy) {
        // 返回带标记的 Strike：staminaDamage=-1 作为游龙回身派生信号（CombatDirector 识别）
        return {
          damage: 0,
          guardDamage: 0,
          staminaDamage: -1,
          blockDamageMultiplier: 0,
          staggerDuration: 0,
        };
      }
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

  /** 公开的攻击缩放反馈，供 CombatDirector 在技能释放时调用（如游龙回身）。 */
  feedbackAttack(isHeavy: boolean) {
    this.playAttackFeedback(isHeavy);
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
