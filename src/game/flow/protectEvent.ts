/** 保护事件触发条件（纯数据，不依赖 Phaser）。 */
export type ProtectTriggerContext = {
  hasThreatenedClue: boolean;
  playerToVillagerDist: number;
  protectResolved: boolean;
};

/** 保护事件是否应触发：有线索 + 玩家在村民附近 + 未解析过。 */
export const shouldTriggerProtectEvent = (ctx: ProtectTriggerContext): boolean =>
  ctx.hasThreatenedClue && !ctx.protectResolved && ctx.playerToVillagerDist < 160;

/** 保护事件成败判定（纯数据）。 */
export type ProtectOutcomeContext = {
  threatActive: boolean;
  threatToVillagerDist: number;
};

export type ProtectOutcome = 'success' | 'failure' | 'pending';

/** 判定保护事件当前结果：威胁者死→成功；威胁者接触村民→失败；否则进行中。 */
export const resolveProtectOutcome = (ctx: ProtectOutcomeContext): ProtectOutcome => {
  if (!ctx.threatActive) {
    return 'success';
  }
  if (ctx.threatToVillagerDist < 50) {
    return 'failure';
  }
  return 'pending';
};
