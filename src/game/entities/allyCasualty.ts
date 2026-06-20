/**
 * 判定一个点是否在以另一个点为中心的矩形范围内。
 * 纯几何函数，不依赖 Phaser，可独立单测。
 */
export const isAllyWithinRange = (
  allyX: number,
  allyY: number,
  originX: number,
  originY: number,
  rangeX: number,
  rangeY: number,
): boolean => Math.abs(allyX - originX) < rangeX && Math.abs(allyY - originY) < rangeY;
