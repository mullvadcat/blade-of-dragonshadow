import type Phaser from 'phaser';
import { BossWuzhen } from '../entities/BossWuzhen';
import { Enemy, type EnemyKind } from '../entities/Enemy';
import type { SfxName } from '../audio/AudioDirector';

/**
 * 敌人调度：创建小怪 / Boss、每帧推进其 update 与出招、把落招的 Strike 回传给调用方结算。
 * 不直接对玩家造成伤害（伤害结算在 CombatDirector.applyEnemyStrike），只负责"产生攻击"。
 */
export class EnemyDirector {
  private readonly enemies: Enemy[] = [];
  private boss: BossWuzhen | null = null;
  private threatEnemy: Enemy | null = null;
  private readonly ground: Phaser.Physics.Arcade.StaticGroup;
  private readonly sfx: (name: SfxName) => void;

  constructor(
    private readonly scene: Phaser.Scene,
    ground: Phaser.Physics.Arcade.StaticGroup,
    sfx: (name: SfxName) => void,
  ) {
    this.ground = ground;
    this.sfx = sfx;
  }

  get activeEnemies(): readonly Enemy[] {
    return this.enemies;
  }

  get activeBoss(): BossWuzhen | null {
    return this.boss;
  }

  /** 创建第一章固定编排的敌人。 */
  createEnemies() {
    const specs: Array<[number, number, EnemyKind]> = [
      [1240, 580, 'scout'],
      [1740, 580, 'bandit'],
    ];
    for (const [x, y, kind] of specs) {
      const enemy = new Enemy(this.scene, x, y, kind, this.sfx);
      this.enemies.push(enemy);
      this.scene.physics.add.collider(enemy, this.ground);
    }
  }

  /** 生成乌针 Boss。 */
  spawnBoss(): BossWuzhen {
    this.boss = new BossWuzhen(this.scene, 3300, 580, this.sfx);
    this.scene.physics.add.collider(this.boss, this.ground);
    return this.boss;
  }

  /** 脚本生成威胁村民的 bandit（保护事件用）。单独引用，不进 enemies 数组。 */
  spawnThreat(x: number): void {
    this.threatEnemy = new Enemy(this.scene, x, 580, 'bandit', this.sfx);
    this.scene.physics.add.collider(this.threatEnemy, this.ground);
  }

  /** 当前威胁者（保护事件用；可能已死亡，调用方需查 .active）。 */
  get activeThreat(): Enemy | null {
    return this.threatEnemy;
  }

  /**
   * 每帧推进全部敌人，返回本帧落招的 Strike 列表（场景据此对玩家结算伤害）。
   * 返回的 Strike 已附带来源（供 CombatDirector 做"哪只敌人打中"的判定，目前简化为统一结算）。
   */
  advanceEnemies(time: number, playerX: number) {
    const strikes = [];
    for (const enemy of this.enemies) {
      enemy.update(time, playerX);
      const strike = enemy.advanceAttack(time, playerX);
      if (strike) {
        strikes.push(strike);
      }
    }
    return strikes;
  }

  /** 推进 Boss，返回本帧落招的 Strike（无则 null）。 */
  advanceBoss(time: number, playerX: number) {
    if (!this.boss?.active) {
      return null;
    }
    this.boss.update(time, playerX);
    return this.boss.advanceAttack(time, playerX);
  }

  /** 判断是否有任意敌人处于玩家附近（用于音频模式切换）。 */
  hasEnemyNearby(playerX: number, playerY: number, radiusX = 420, radiusY = 140): boolean {
    return this.enemies.some(
      (enemy) =>
        enemy.active &&
        !enemy.isSurrendered &&
        Math.abs(enemy.x - playerX) < radiusX &&
        Math.abs(enemy.y - playerY) < radiusY,
    );
  }
}
