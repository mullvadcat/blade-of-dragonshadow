/**
 * 近战是否应命中该敌人：存活、未求饶、且在以攻击者为中心的矩形范围内。
 *
 * 求饶中的敌人不被近战 / 技能 / 刀气结算——其处置统一走 FlowController 的求饶对话
 * （放过 / 处决），避免被 AoE 无声击杀而绕过道德选择。纯几何，可独立单测。
 */
export const isMeleeHittable = (
  active: boolean,
  surrendered: boolean,
  enemyX: number,
  enemyY: number,
  originX: number,
  originY: number,
  rangeX: number,
  rangeY: number,
): boolean =>
  active &&
  !surrendered &&
  Math.abs(enemyX - originX) < rangeX &&
  Math.abs(enemyY - originY) < rangeY;
