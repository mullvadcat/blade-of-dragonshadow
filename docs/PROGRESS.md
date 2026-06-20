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
| M5 | 狂暴误伤 NPC 判定 + 攻击致死求饶者 | ✅ 完成 | `65b734d` → `b2e2efa` | 5 |
| M6 | 保护村民道德事件 + 限场地破坏机制 | ⏳ 待开发 | — | — |

**当前测试总计**：78 passed（11 test files） — `npm run lint && npm run typecheck && npm test` 三件套全绿。

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

## M5 · 狂暴误伤 NPC 判定 + 攻击致死求饶者

**目标**：落地"力量失控波及无辜"玩法后果——狂暴形态大范围技能波及村民 NPC 记戾气 + NPC 受伤（保底不致死）；玩家直接攻击致死已求饶探子记 killedScout + 戾气。

**关键交付**：
- `src/game/entities/allyCasualty.ts` — `isAllyWithinRange` 纯函数（无 Phaser 依赖，可单测）
- `src/game/skills/skillDefs.ts` — `SkillFormModifier` 加 `hitsAllies?: boolean`；wrath 形态设 true
- `src/game/skills/SkillSystem.ts` — `SkillCastResult` 透传 `hitsAllies`
- `src/game/entities/Npc.ts` — `injured` 标志 + `takeDamage()` 幂等方法（保底不致死，首次返回 true）
- `src/game/director/CombatDirector.ts` — 构造加 story + npcs；`executeSkillEffect` 狂暴误伤判定（排除游龙回身，每次释放最多 +12 戾气）；击杀求饶 scout 记 killedScout（+20 戾气，复用 M4 结局文案）
- `src/game/GameScene.ts` — CombatDirector 构造传入 story + npcs

**道德事件数值**：
- 误伤村民（狂暴形态技能范围内，每 NPC 首次）→ 戾气 +12
- 攻击致死求饶探子 → 戾气 +20 + `killedScout`（复用 M4 结局文案段）

**测试**：`tests/ally-casualty.test.ts`（5 tests）— 纯函数范围/边界/方向

**提交范围**：`65b734d` → `b2e2efa`（6 个提交，TDD + 集成）

**设计文档**：
- Spec：[`docs/superpowers/specs/2026-06-20-ally-casualty-surrender-kill-design.md`](./superpowers/specs/2026-06-20-ally-casualty-surrender-kill-design.md)
- Plan：[`docs/superpowers/plans/2026-06-20-ally-casualty-surrender-kill.md`](./superpowers/plans/2026-06-20-ally-casualty-surrender-kill.md)

**运行时验证**：playwright 端到端脚本通过（狂暴形态误伤 NPC + 戾气上涨、平衡形态不误伤、攻击致死求饶探子记 killedScout + 戾气）。

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
| 求饶探子道德事件（放过 / 处决 / 攻击致死） | ✅ | `entities/Enemy.ts`、`flow/FlowController.ts`、`director/CombatDirector.ts` |
| 狂暴误伤 NPC 判定（保底不致死） | ✅ | `entities/allyCasualty.ts`、`entities/Npc.ts`、`director/CombatDirector.ts` |
| 结局文案道德变体 | ✅ | `flow/endingMoralSuffix.ts` |
| 乌针 Boss（针刺 / 烟遁两阶段） | ✅ | `entities/BossWuzhen.ts` |
| 程序化音频（雨声 / 悬疑旋律 / 战斗音效） | ✅ | `audio/AudioDirector.ts` |
| 程序化美术（角色 / 场景 / 刀光） | ✅ | `art/CharacterArt.ts`、`world/WorldBuilder.ts` |

**操作**：WASD 移动 · Space 闪避 · J 轻斩 · K 重斩 · L 格挡 · U 刀气 · I 潜龙 · O 裂鳞 · E 对话/调查 · R 重开 · M 静音

---

## 下一步：M6 · 保护村民道德事件 + 限场地破坏机制

**待开发内容**：
- **保护村民道德事件**：村民被敌人威胁时玩家介入保护 → `protectedVillager` ChoiceId（StoryFlags 已预留）→ 守心 +
- **限场地破坏机制**：GDD 第五章"保护无辜 NPC + 限制场地破坏"——首次把"克制"做成硬性战斗机制（狂暴大范围技能破坏环境/伤及 NPC 会有硬性惩罚）

**前置依赖**：M4 对话系统 + M5 误伤判定已就绪。M6 需新建"敌人威胁 NPC"AI 行为或脚本事件，工作量较大，与 GDD 第五章机制契合度高，可考虑合并到第五章开发或独立做第一章完整化收尾。

**备选方向**：若暂不开发 M6，可转向 **第二章·龙刃初鸣**（GDD §6）——系统化刀法教学、首次精英战（铁臂罗）、戾气值第一次显现（差点误伤无辜路人 + 龙刃首次泛红），引入新场景与敌人类型。

---

## 开发约定

- **验证基线**（见 [AGENTS.md](../AGENTS.md)）：`npm run lint && npm run typecheck && npm test` 三件套全绿方可声明完成
- **技术栈**：Phaser 3.90 + TypeScript（strict）+ Vite 6 · vitest · ESLint flat config · Prettier
- **美术 / 音频**：全部代码生成，无外部资源目录
- **流程**：每个里程碑走 brainstorming → spec → writing-plans → subagent-driven-development（TDD）
