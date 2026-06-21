// src/game/director/IEnemyDirector.ts
import type { Enemy } from '../entities/Enemy';
import type { CombatActor } from '../entities/CombatActor';

export interface IEnemyDirector {
  readonly activeEnemies: readonly Enemy[];
  readonly activeBoss: CombatActor | null;
  readonly activeThreat: Enemy | null;
}
