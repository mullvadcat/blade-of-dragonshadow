/**
 * 判定可破坏物是否在以攻击者为中心的矩形范围内。
 * 纯几何函数，不依赖 Phaser，可独立单测。仿 allyCasualty.ts 模式。
 */
export const isDestructibleInRange = (
  targetX: number,
  targetY: number,
  originX: number,
  originY: number,
  rangeX: number,
  rangeY: number,
): boolean => Math.abs(targetX - originX) < rangeX && Math.abs(targetY - originY) < rangeY;
