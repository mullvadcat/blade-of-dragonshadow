// src/game/director/EnemyDirectorCh2.ts
import type Phaser from 'phaser';
import { Enemy, type EnemyKind } from '../entities/Enemy';
import { BossIronArmLuo } from '../entities/BossIronArmLuo';
import type { CombatActor } from '../entities/CombatActor';
import type { Strike } from '../combat/CombatSystem';
import type { IEnemyDirector } from './IEnemyDirector';
import type { SfxName } from '../audio/AudioDirector';

/**
 * 敌人调度（第二章）：波次生成小怪、召唤铁臂罗 Boss、每帧推进 update 与出招。
 * Ch2 无保护村民威胁事件，activeThreat 始终返回 null。
 */
export class EnemyDirectorCh2 implements IEnemyDirector {
  private readonly _enemies: Enemy[] = [];
  private boss: BossIronArmLuo | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly ground: Phaser.Physics.Arcade.StaticGroup,
    private readonly sfx: (name: SfxName) => void,
  ) {}

  get activeEnemies(): readonly Enemy[] {
    return this._enemies;
  }

  get activeBoss(): CombatActor | null {
    return this.boss;
  }

  /** Ch2 无威胁事件，始终返回 null。 */
  get activeThreat(): Enemy | null {
    return null;
  }

  /** 供 FlowControllerCh2 检查 boss.active 状态。 */
  get activeBossIronArm(): BossIronArmLuo | null {
    return this.boss;
  }

  /** 第一波：两名 bandit（x=500、620，y=580）。 */
  spawnWave1(): void {
    this.spawnEnemies([
      [500, 'bandit'],
      [620, 'bandit'],
    ]);
  }

  /** 第二波：两名 bandit + 一名 scout（x=1620、1800、2020，y=580）。 */
  spawnWave2(): void {
    this.spawnEnemies([
      [1620, 'bandit'],
      [1800, 'bandit'],
      [2020, 'scout'],
    ]);
  }

  /** 生成铁臂罗 Boss（x=2900，y=580）。 */
  spawnBoss(): void {
    this.boss = new BossIronArmLuo(this.scene, 2900, 580, this.sfx);
    this.scene.physics.add.collider(this.boss, this.ground);
  }

  /**
   * 每帧推进全部小怪，返回本帧落招的 Strike 列表。
   */
  advanceEnemies(time: number, playerX: number): Strike[] {
    const strikes: Strike[] = [];
    for (const enemy of this._enemies) {
      if (!enemy.active) continue;
      enemy.update(time, playerX);
      const strike = enemy.advanceAttack(time, playerX);
      if (strike) strikes.push(strike);
    }
    return strikes;
  }

  /**
   * 每帧推进铁臂罗，返回本帧落招的 Strike（无则 null）。
   */
  advanceBoss(time: number, playerX: number): Strike | null {
    if (!this.boss?.active) return null;
    this.boss.update(time, playerX);
    return this.boss.advanceAttack(time, playerX);
  }

  /**
   * 判断是否有任意敌人（小怪或 boss）处于玩家附近（用于音频模式切换）。
   */
  hasEnemyNearby(playerX: number, playerY: number, radiusX = 420, radiusY = 140): boolean {
    const hasEnemy = this._enemies.some(
      (e) => e.active && Math.abs(e.x - playerX) < radiusX && Math.abs(e.y - playerY) < radiusY,
    );
    const hasBoss =
      this.boss?.active === true && Math.abs(this.boss.x - playerX) < radiusX;
    return hasEnemy || hasBoss;
  }

  private spawnEnemies(specs: Array<[number, EnemyKind]>): void {
    for (const [x, kind] of specs) {
      const enemy = new Enemy(this.scene, x, 580, kind, this.sfx);
      this._enemies.push(enemy);
      this.scene.physics.add.collider(enemy, this.ground);
    }
  }
}
