# M3 设计：龙影九斩前三式 + 技能形态切换

> 状态：已批准（2026-06-19）
> 上游里程碑：M0（架构重构）+ M1（戾气/守心）+ M2（龙魂/刀气）已完成
> 下游：M4（对话/NPC/道德事件）

## 1. 目标

在现有战斗循环（轻/重斩、闪避、格挡、完美格挡、刀气）基础上，落地龙影九斩前三式与形态切换，让"力量的克制"主题在技能层面可玩。

## 2. 关键决策（已与用户确认）

- **解锁策略**：默认全解锁前三式（demo 可玩优先，不按 GDD 章节锁）
- **游龙回身触发**：闪避后 400ms 窗口内按攻击键派生（非独立按键）
- **狂暴形态深度**：数值差异 + 反噬（5% 最大生命自伤），误伤 NPC 判定留接口到 M4
- **资源模型**：龙魂消耗 + 短冷却（3-4s），避免连续释放又不至于攒很久

## 3. 架构

```
src/game/skills/
├── SkillSystem.ts      # 技能槽、冷却、龙魂消耗、形态化释放
└── skillDefs.ts        # 三式数据定义
```

独立 SkillSystem 而非塞进 CombatSystem：技能有冷却、形态、位移状态，比纯函数 Strike 复杂；集中管理可测，CombatDirector 只负责调用 + 命中。

数据流：
```
GameScene.update
  → CombatDirector.handleSkills(time)
    → SkillSystem.tryRelease(skillId, time)
      → 检查龙魂/冷却 → 按 moral.tendency 形态化 → 返回 SkillCastResult
    → CombatDirector 执行突进/命中判定/特效
```

## 4. 三式技能定义

| 式 | 键 | 触发 | 龙魂 | 冷却 | 核心效果 |
|---|---|---|---|---|---|
| 潜龙出渊 | I | 独立按键 | 15 | 3s | 向朝向突进 220px 并斩击，命中伤害 16 |
| 游龙回身 | 派生 | 闪避后 400ms 窗口内按 J/K | 10 | 无（受窗口限） | 反击斩，伤害 20，附短暂无敌 |
| 裂鳞破甲 | O | 独立按键 | 25 | 4s | 高破防重斩，guardDamage 45，伤害 22，前摇稍大 |

游龙回身派生：`PlayerStateMachine.tryDodge` 成功后设 `dodgeCounterWindowUntil = now + 400`；`Player.consumeAttack` 检测窗口内按攻击键 → 返回游龙回身 Strike。

## 5. 形态切换（自动随心境）

根据 `player.moral.tendency` 自动调整，无需手动切换：

| 形态 | 触发 | 伤害 | 波及范围 | 附加 |
|---|---|---|---|---|
| 标准 | balance | ×1.0 | ×1.0 | 无 |
| 狂暴 | wrath | ×1.4 | ×1.3 | 反噬 5% 最大生命自伤；颜色偏红 |
| 守护 | guard | ×1.0 | ×0.8 | 释放后 500ms 减伤 30%；颜色青白 |

误伤 NPC：SkillSystem 预留 `hitsAllies: boolean`（狂暴为 true），实际判定 M4 接入。

## 6. 视觉特效

- 潜龙出渊：玩家 tween 突进 + 龙形光痕（读 `moral.bladeColor()`）
- 游龙回身：回身斩 + 半透明残影
- 裂鳞破甲：重斩 + 破甲冲击波圆环
- 颜色统一读 `moral.bladeColor()`，与近战刀光、刀气一致

## 7. UI 增强

HUD 左下角技能状态条：
- 三式图标占位（文字「潜」「回」「裂」）+ 冷却进度暗化
- 龙魂不足时图标变灰
- 复用 HealthBar 渐变暗化思路

## 8. 测试

- SkillSystem：冷却门控、龙魂消耗、形态化参数（wrath ×1.4、guard 减伤窗口）
- 游龙回身派生：闪避后窗口内/外触发判定
- 各式 Strike 数据正确性

## 9. 文件清单

新增：
- `src/game/skills/SkillSystem.ts`
- `src/game/skills/skillDefs.ts`
- `tests/skill-system.test.ts`

修改：
- `PlayerStateMachine.ts` — 闪避后窗口 + 游龙回身派生
- `Player.ts` — consumeAttack 检测派生窗口
- `CombatDirector.ts` — handleSkills 接入 + 命中/特效
- `Hud.ts` — 技能状态条
