import type Phaser from 'phaser';
import { CombatSystem, type CombatantState, type Strike } from '../combat/CombatSystem';
import { CombatActor } from './CombatActor';
import type { SfxName } from '../audio/AudioDirector';

import { shouldSurrender } from './surrender';
export { shouldSurrender, SCOUT_SURRENDER_HEALTH_RATIO } from './surrender';

export type EnemyKind = 'scout' | 'bandit';

export class Enemy extends CombatActor {
  readonly kind: EnemyKind;

  /** 是否已进入求饶状态（仅 scout 会触发）。求饶后停止出招与追击。 */
  private surrendered = false;

  /** 求饶标记精灵（"求"字标），求饶时显示。 */
  private surrenderMarker: Phaser.GameObjects.Text | null = null;

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
      soul: 0,
      maxSoul: 0,
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

  get isSurrendered(): boolean {
    return this.surrendered;
  }

  /** 标记求饶：停步、跪地视觉、显"求"标记。 */
  private markSurrendered() {
    if (this.surrendered) {
      return;
    }
    this.surrendered = true;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(0);
    this.setScale(0.82, 0.78);
    this.setTint(0x9a8c7a);
    this.surrenderMarker = this.scene.add
      .text(this.x, this.y - 56, '求', {
        color: '#f2dfb8',
        fontFamily: 'serif',
        fontSize: '18px',
        backgroundColor: '#3a1208',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(25);
  }

  /** 放过：淡出后销毁（不计击杀，不给龙魂）。实现 SurrenderTarget.escape。 */
  escape() {
    if (!this.active) {
      return;
    }
    this.surrenderMarker?.destroy();
    this.surrenderMarker = null;
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 500,
      onComplete: () => {
        this.nameplate.destroy();
        this.healthBar.destroy();
        this.disableBody(true, true);
        this.destroy();
      },
    });
  }

  /** 处决：直接死亡（走 defeat 流程）。实现 SurrenderTarget.execute。 */
  execute() {
    if (!this.active) {
      return;
    }
    this.surrenderMarker?.destroy();
    this.surrenderMarker = null;
    this.combatState.health = 0;
    this.defeat();
  }

  protected onStrikeResolved() {
    if (this.kind !== 'scout' || this.surrendered) {
      return;
    }
    if (this.combatState.health <= 0) {
      // 本会致死但 scout 未求饶过：保底 1 血给玩家选择机会
      this.combatState.health = 1;
    }
    if (shouldSurrender(this.combatState.health, this.combatState.maxHealth)) {
      this.markSurrendered();
    }
  }

  advanceAttack(time: number, playerX: number): Strike | null {
    if (this.surrendered) {
      return null;
    }
    return super.advanceAttack(time, playerX);
  }

  update(time: number, playerX: number) {
    if (!this.active) {
      return;
    }

    if (this.surrendered) {
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.setVelocityX(0);
      this.followUi();
      this.surrenderMarker?.setPosition(this.x, this.y - 56);
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
