# 开发进度

> 项目：《龙刃归鞘》(longren-guixiao-demo) — 暗黑东方武侠动作 RPG Demo
> 设计基准见 [PRD.md](./PRD.md) / [GDD.md](./GDD.md)；本文档记录实际落地进度与代码映射。
> 更新约定：每完成一个里程碑，追加/更新对应小节，并同步里程碑总表。

---

## 里程碑总表

| 里程碑 | 名称 | 状态 | 关键提交 | 测试数 |
| --- | --- | --- | --- | --- |
| M0 | 架构重构 | ✅ 完成 | `e022888` | — |
| M1 | 戾气 / 守心双值系统 | ✅ 完成 | `e022888` | 13 |
| M2 | 龙魂 / 刀气 | ✅ 完成 | `e022888` | （含于 M1 提交） |
| M3 | 龙影九斩前三式 + 技能形态切换 | ✅ 完成 | `e022888` | 10 |
| M4 | 对话系统 + 村民 NPC + 求饶探子道德事件 | ✅ 完成 | `ef4b74c` → `4ecb498` | 20 |
| M5 | 保护村民道德事件 + 狂暴误伤 NPC 判定 | ⏳ 待开发 | — | — |

**当前测试总计**：73 passed（10 test files） — `npm run lint && npm run typecheck && npm test` 三件套全绿。

---

## M0 · 架构重构

**目标**：把初始单文件 demo 拆分为职责清晰的子系统，奠定后续开发的基础架构。

**关键交付**：
- `src/game/GameScene.ts` — 主场景，只负责生命周期与子系统装配
- `src/game/director/` — EnemyDirector / CombatDirector / AudioController
- `src/game/flow/FlowController.ts` — 第一章流程控制
- `src/game/world/WorldBuilder.ts` — 世界搭建
- `src/game/audio/AudioDirector.ts` — 程序化音频引擎

**提交**：`e022888`（与 M1/M2/M3 同提交）

---

## M1 · 戾气 / 守心双值系统

**目标**：落地"力量的克制"差异化核心——双值独立、互为拉扯的道德系统。

**关键交付**：
- `src/game/moral/MoralState.ts` — 双值（liqi/shouxin）、tendency 判定、bladeColor() / edgeTint() 可视化接口
- `src/game/ui/Hud.ts` — 画面边缘红/青晕染（PRD §7.3 红线：弱化裸数字条）

**测试**：`tests/moral-state.test.ts`（13 tests）

**设计文档**：无独立 spec（M0-M3 合并在 `e022888` 提交）

---

## M2 · 龙魂 / 刀气

**目标**：引入龙魂能量池与远程刀气斩击，为九斩技能铺路。

**关键交付**：
- `src/game/combat/BladeAura.ts` — 刀气（远程斩击）实体与飞行/命中
- `src/game/combat/CombatSystem.ts` — `createBladeAuraStrike()` + `BLADE_AURA_SOUL_COST`
- `src/game/player/PlayerStateMachine.ts` — 龙魂字段 + `addSoul` / `spendSoul`
- `src/game/ui/Hud.ts` — 龙魂条（黑金配色，GDD §12 色彩语言）

**提交**：`e022888`（与 M0/M1/M3 同提交）

---

## M3 · 龙影九斩前三式 + 技能形态切换

**目标**：落地潜龙出渊 / 游龙回身 / 裂鳞破甲三式，形态随心境自动切换（狂暴 ×1.4 伤害+反噬 / 守护减伤 / 标准）。

**关键交付**：
- `src/game/skills/skillDefs.ts` — 三式数据定义 + 形态修饰表（SKILL_FORM_MODIFIERS）
- `src/game/skills/SkillSystem.ts` — 冷却门控、龙魂消耗、形态化释放，返回 SkillCastResult
- `src/game/player/PlayerStateMachine.ts` — 闪避后派生窗口（游龙回身触发）
- `src/game/player/Player.ts` — consumeAttack 检测派生窗口
- `src/game/director/CombatDirector.ts` — `handleSkills` 接入突进/命中/特效；守护形态减伤接入 applyEnemyStrike
- `src/game/ui/Hud.ts` — 左下角技能状态条（三式图标 + 冷却暗化 + 龙魂不足变灰）

**测试**：`tests/skill-system.test.ts`（10 tests）

**设计文档**：
- Spec：[`docs/superpowers/specs/2026-06-19-skill-system-design.md`](./superpowers/specs/2026-06-19-skill-system-design.md)
- Plan：[`docs/superpowers/plans/2026-06-19-skill-system.md`](./superpowers/plans/2026-06-19-skill-system.md)

---

## M4 · 对话系统 + 村民 NPC + 求饶探子道德事件

**目标**：把"力量的克制"主题落地到交互层——分支对话框、第四线索由村民对话揭示、求饶探子可放过/处决。

**关键交付**：
- `src/game/dialog/DialogSystem.ts` — 对话状态机（节点导航 / 选项切换 / 动作派发），通过 DialogContext 与游戏状态解耦
- `src/game/dialog/dialogDefs.ts` — 数据驱动对话树（村民 / 求饶探子 / 氛围村民三棵）
- `src/game/dialog/DialogUi.ts` — 底部对话框渲染（说话人 / 台词 / 选项高亮）
- `src/game/entities/Npc.ts` — 村民 NPC（不战斗，靠近按 E 触发对话）
- `src/game/entities/Enemy.ts` — scout 求饶状态（血量 < 25% 保底 1 血 + 停攻 + 跪地视觉）
- `src/game/entities/surrender.ts` — `shouldSurrender` 纯函数（独立可测）
- `src/game/entities/CombatActor.ts` — `onStrikeResolved` hook + `defeat` 改 protected（求饶保底扩展点）
- `src/game/flow/FlowController.ts` — handleNpcDialog / handleSurrender / 结局文案变体
- `src/game/flow/endingMoralSuffix.ts` — 结局文案道德变体段纯函数
- `src/game/art/CharacterArt.ts` — 村民纹理 `'npc-villager'`
- `src/game/GameScene.ts` — 装配 DialogSystem/DialogUi/Npc + 对话时冻结世界
- `src/game/world/WorldBuilder.ts` — 第 4 线索改 Npc + 氛围村民 + createNpcs

**道德事件数值**：
- 放过探子 → 守心 +15（`sparedScout`）
- 处决探子 → 戾气 +20 + 龙魂 +8（`killedScout`）
- 结局文案追加对应变体段（走向不变，仍带刀离家）

**测试**：
- `tests/dialog-system.test.ts`（11 tests）— 状态机导航 / 选项切换 / 动作派发 / 互斥约束
- `tests/enemy-surrender.test.ts`（4 tests）— shouldSurrender 纯函数阈值
- `tests/ending-moral-suffix.test.ts`（5 tests）— 结局文案变体

**提交范围**：`ef4b74c` → `4ecb498`（11 个提交，TDD 逐步落地）

**设计文档**：
- Spec：[`docs/superpowers/specs/2026-06-20-dialog-npc-moral-design.md`](./superpowers/specs/2026-06-20-dialog-npc-moral-design.md)
- Plan：[`docs/superpowers/plans/2026-06-20-dialog-npc-moral.md`](./superpowers/plans/2026-06-20-dialog-npc-moral.md)

**运行时验证**：playwright 端到端脚本通过（村民对话→线索获得、scout 保底 1 血求饶、放过+15 守心、2 NPC、3 调查点）。

---

## 当前可玩内容概览（第一章·雨夜疑案）

| 功能 | 状态 | 代码位置 |
| --- | --- | --- |
| 基础移动 / 跳跃 / 闪避 | ✅ | `player/Player.ts` |
| 轻斩 / 重斩 / 格挡 / 完美格挡反击 | ✅ | `combat/CombatSystem.ts`、`PlayerStateMachine.ts` |
| 戾气 / 守心双值 + 刀身颜色 + 边缘晕染 | ✅ | `moral/MoralState.ts`、`ui/Hud.ts` |
| 龙魂能量池 + 刀气远程斩击 | ✅ | `combat/BladeAura.ts`、`PlayerStateMachine.ts` |
| 龙影九斩前三式 + 形态切换 | ✅ | `skills/SkillSystem.ts`、`skills/skillDefs.ts` |
| 四线索调查解谜 | ✅ | `story/StoryFlags.ts`（前 3 调查点 + 第 4 由村民对话揭示） |
| 对话系统（分支对话框） | ✅ | `dialog/DialogSystem.ts`、`dialog/DialogUi.ts` |
| 村民 NPC（沉默村民 / 氛围村民） | ✅ | `entities/Npc.ts`、`world/WorldBuilder.ts` |
| 求饶探子道德事件（放过 / 处决） | ✅ | `entities/Enemy.ts`、`flow/FlowController.ts` |
| 结局文案道德变体 | ✅ | `flow/endingMoralSuffix.ts` |
| 乌针 Boss（针刺 / 烟遁两阶段） | ✅ | `entities/BossWuzhen.ts` |
| 程序化音频（雨声 / 悬疑旋律 / 战斗音效） | ✅ | `audio/AudioDirector.ts` |
| 程序化美术（角色 / 场景 / 刀光） | ✅ | `art/CharacterArt.ts`、`world/WorldBuilder.ts` |

**操作**：WASD 移动 · Space 闪避 · J 轻斩 · K 重斩 · L 格挡 · U 刀气 · I 潜龙 · O 裂鳞 · E 对话/调查 · R 重开 · M 静音

---

## 下一步：M5 · 保护村民道德事件 + 狂暴误伤 NPC 判定

**待开发内容**（M4 spec §8 已明确边界）：
- **保护村民道德事件**：村民被敌人威胁时玩家介入保护 → `protectedVillager` ChoiceId（StoryFlags 已预留）→ 守心 +
- **狂暴误伤 NPC 判定**：接入 SkillSystem 预留的 `hitsAllies` 接口——狂暴形态大范围技能（潜龙 / 裂鳞）波及村民 NPC 时记戾气 +
- **攻击致死求饶者判定**：直接攻击致死已求饶探子时记 `killedScout`（M4 只做了对话处决路径，攻击致死路径留 M5）

**前置依赖**：M4 对话系统与 NPC 实体已就绪，M5 在此基础上扩展。

---

## 开发约定

- **验证基线**（见 [AGENTS.md](../AGENTS.md)）：`npm run lint && npm run typecheck && npm test` 三件套全绿方可声明完成
- **技术栈**：Phaser 3.90 + TypeScript（strict）+ Vite 6 · vitest · ESLint flat config · Prettier
- **美术 / 音频**：全部代码生成，无外部资源目录
- **流程**：每个里程碑走 brainstorming → spec → writing-plans → subagent-driven-development（TDD）
