/** scout 进入求饶状态的血量比例阈值（血量 ≤ maxHealth × 此值 且 > 0 时触发）。 */
export const SCOUT_SURRENDER_HEALTH_RATIO = 0.25;

/** 纯函数：判定当前血量是否应进入求饶状态。供 Enemy 调用，亦可独立单测。 */
export const shouldSurrender = (health: number, maxHealth: number): boolean =>
  health > 0 && health <= maxHealth * SCOUT_SURRENDER_HEALTH_RATIO;
