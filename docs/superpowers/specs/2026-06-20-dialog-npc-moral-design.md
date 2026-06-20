# M4 设计：对话系统 + 村民 NPC + 求饶探子道德事件

> 状态：已批准（2026-06-20）
> 上游里程碑：M0（架构重构）+ M1（戾气/守心）+ M2（龙魂/刀气）+ M3（龙影九斩前三式）已完成
> 下游：M5（保护村民道德事件 + 狂暴误伤 NPC 判定）

## 1. 目标

在第一章现有战斗/调查循环上落地"对话系统 + 村民 NPC + 求饶探子道德事件"，让"力量的克制"主题在交互层可玩：
- 把第四线索"沉默村民"从普通调查点升级为可对话 NPC，通过追问套出线索（GDD：集齐四线索方开暗门）。
- 黑鳞探子血量低于阈值进入求饶状态，玩家可放过（守心+）或处决（戾气+），即时反馈 + 结局文案微调让选择有分量。
- 建立可复用的数据驱动对话系统，为后续章节 NPC 对话与道德事件提供基础设施。

## 2. 关键决策（已与用户确认）

- **范围**：本批只做"对话系统+村民 NPC"与"求饶探子道德事件"；保护村民道德事件与狂暴误伤 NPC 判定留 M5。
- **对话形态**：分支对话框（说话人 + 台词 + 方向键选项 + E 确认），承载道德选择的"抉择仪式感"。
- **道德选择影响深度**：即时反馈（戾气/守心值变化、刀身颜色）+ 结局文案微调（变体附加段），结局走向不变（仍带刀离家）。
- **对话时游戏状态**：对话/道德选择开启时冻结敌人 AI 与玩家移动（暂停世界），关闭后恢复。经典 RPG 做法，保证抉择不被战斗打断。

## 3. 架构

新增独立 `src/game/dialog/` 子系统（与现有 SkillSystem / EnemyDirector 同款"每职责一独立可测模块"模式）：

```
src/game/dialog/
├── DialogSystem.ts   # 对话状态机：当前节点 / 选项导航 / 暂停世界 / 动作执行
├── dialogDefs.ts     # 数据驱动的对话树（纯数据 + 命名动作标识，可复用到后续章节）
└── DialogUi.ts       # 底部对话框渲染（说话人 + 台词 + 选项高亮）

src/game/entities/
└── Npc.ts            # 村民实体（不战斗，靠近按 E 触发对话）
```

**职责边界：**
- `DialogSystem`：只管"对话进行中"的状态机——当前节点、选项导航、暂停/恢复世界信号、动作回调派发。不渲染、不决定何时触发。
- `DialogUi`：只管渲染——读取 DialogSystem 当前状态画框、高亮、响应视觉。不持有对话逻辑。
- `dialogDefs`：纯数据。动作用字符串标识（`'spareScout'` 等），逻辑集中在 DialogSystem 注册的 handler，保持数据可复用、可由后续章节直接追加。
- `Npc`：实体 + 关联 `dialogId`。靠近按 E 启动对话。不参与战斗。
- `FlowController`：决定"何时触发对话"（村民/求饶），与现有调查/暗门/结算编排同处。
- `Enemy`/`EnemyDirector`：求饶状态。`Enemy` 维护 `surrendered` 标志与阈值判定，`EnemyDirector` 在求饶时停止该敌人的 `advanceAttack`。

**数据流：**
```
GameScene.update(time)
  ├─ if dialogSystem.active:
  │    dialogSystem.handleInput(time)   ← 方向键导航 / E 确认 / Esc 关闭
  │    dialogUi.update()
  │    return（跳过敌人推进 / 玩家移动 / 战斗 / 技能）
  ├─ else:
  │    player.update()
  │    flow.handleNpcDialog(time)       → DialogSystem.start(npcDialogDef)
  │    flow.handleSurrender(time)       → DialogSystem.start(scoutSurrenderDef, {surrenderEnemy})
  │    flow.handleInvestigation()       ← 前 3 线索点保持原逻辑
  │    flow.handleStudyGate()
  │    combatDirector.handleSkills / applyPlayerAttack / handleBladeAura
  │    enemyDirector.advanceEnemies / advanceBoss
  │    combatDirector.applyEnemyStrike
  └─ hud.update / dialogUi.update
```

## 4. 组件设计

### 4.1 DialogSystem（状态机，可单测）

```typescript
export type DialogContext = {
  moral: MoralState;
  story: StoryFlags;
  /** 求饶对话时关联的敌人；普通对话为 null。 */
  surrenderEnemy?: Enemy | null;
};

export type DialogActionHandler = (ctx: DialogContext) => void;

export class DialogSystem {
  private active = false;
  private def: DialogDef | null = null;
  private currentNodeId = '';
  private selectedOptionIndex = 0;
  private readonly actions = new Map<string, DialogActionHandler>();
  private readonly context: DialogContext;

  constructor(context: DialogContext) {}
  get isActive(): boolean {}
  get state(): { speaker: string; text: string; options: DialogOptionView[] } | null {}
  registerAction(name: string, handler: DialogActionHandler): void {}
  start(def: DialogDef): void {}
  handleInput(input: DialogInput): void {}  // up/down/confirm/close
  close(): void {}
}
```

- `start(def)`：设 active=true，跳到 `def.startNode`，重置选项到 0。调用方据此冻结世界。
- `handleInput`：
  - `up/down`：在当前节点 options 间循环切换 `selectedOptionIndex`（无 options 忽略）。
  - `confirm`：有 options → 取选中项；选项有 `next` → 跳节点并重置 index；选项有 `action` → 执行 handler 后 `close()`（`next` 与 `action` 互斥，不会同时存在，见 4.2 约束）。无 options（末节点）→ `close()`。
  - `close`：直接 `close()`。
- `close()`：active=false，清 def。调用方据此恢复世界。
- `state` getter：返回当前节点的说话人/台词/选项视图（含 `selected` 标记），供 DialogUi 渲染。无 active 返回 null。

### 4.2 dialogDefs（纯数据）

```typescript
export type DialogOption = {
  label: string;
  /** 跳转到下一节点。与 action 互斥（同一选项只能有一个）。 */
  next?: string;
  /** 执行命名动作（在 DialogSystem 注册的 handler），执行后关闭对话。与 next 互斥。 */
  action?: string;
};

export type DialogNode = {
  speaker: string;
  text: string;
  /** 无 options 表示末节点（按 E 关闭）。 */
  options?: DialogOption[];
};

export type DialogDef = {
  id: string;
  startNode: string;
  nodes: Record<string, DialogNode>;
};
```

**约束（在 DialogSystem 强制）：** 单个 `DialogOption` 的 `next` 与 `action` 互斥——action 是终结动作（执行后关闭对话），不与跳转并存。这避免"执行动作后还停在对话里"的歧义状态。

**本批对话树：**

1. **村民对话（沉默村民，揭示第四线索 threatenedVillagers）**
   - 玩家靠近按 E 触发。首节点村民回避；选项「追问那夜的灯」「不再打扰」。
   - 「追问」→ 揭示节点（那夜所有灯被黑鳞会逼着熄，村民受威胁不敢言）→ 末节点，`action: 'revealThreatenedClue'`（`story.discoverClue('threatenedVillagers')`，标记调查完成）。
   - 「不再打扰」→ 末节点关闭，不给线索（玩家可再对话，线索不丢）。

2. **求饶探子对话**
   - scout 血量 < 阈值进 `surrendered` 后，玩家靠近按 E 触发。首节点探子求饶台词；选项「放过」「处决」。
   - 「放过」→ 末节点（探子留下一句关于乌针的情报），`action: 'spareScout'`。
   - 「处决」→ 末节点（探子死），`action: 'executeScout'`。

3. **氛围村民（可选，纯增沉浸感，不给线索）**
   - 在村庄布置 1-2 个氛围村民，对话树为短线性台词（无选项或单一「告别」选项），丰富雨夜村庄氛围。非必需，优先级低于前两者。

### 4.3 DialogUi

- 底部对话框：半透明黑底 + 黑金边框（沿用 Hud `#d7bf83` / `0x121319` 配色），depth 110（高于游戏低于结局面板 120/130）。
- 上半显示「说话人 + 台词」（serif，wordWrap），下半显示选项列表；当前选项用「▶」前缀 + 金色高亮，其余灰色。
- 无 options 的末节点：只显示台词，提示「E 继续」。
- `update()`：读 `dialogSystem.state` 重绘；`active=false` 时隐藏。
- 键位：W/S 或 ↑/↓ 切换选项，E 确认，Esc 关闭。

### 4.4 Npc 实体

- 继承 `Phaser.Physics.Arcade.Sprite`（不继承 CombatActor——村民不战斗）。
- 字段：`dialogId: string`、`nameplate`。
- 外观：代码生成剪影纹理（沿用 `CharacterArt` 模式，新增村民纹理键如 `'npc-villager'`）。
- 靠近判定：与调查点同款距离阈值（86px），`FlowController.handleNpcDialog` 找最近 NPC。
- 第四线索村民：对话完成（`revealThreatenedClue`）后改名牌/标记为已问过，避免重复触发。

### 4.5 Enemy 求饶状态

- 仅 `scout` 启用（bandit 不求饶，体现敌人性格差异）。`Enemy` 覆写或新增 `checkSurrender` 逻辑。
- 阈值：`health < maxHealth * 0.25`（即 < 10.5，约 10 血）时进 `surrendered`，保留 1 血（不死），停止 `advanceAttack`，显「求」标记 + 跪地视觉（缩放 0.8 + tint 偏暗）。
- `surrendered` 后敌人仍可被攻击（`receiveStrike` 正常生效，可被砍死）。但**本批不把"直接攻击致死求饶探子"记为 `killedScout` 道德事件**——道德事件的戾气/守心结算只走求饶对话框的「放过/处决」选项。直接攻击致死求饶者的道德判定留 M5 统一处理（涉及 CombatDirector 命中后协调 surrendered 状态）。本批明确这条边界，避免实现越界。

### 4.6 求饶动作 handler

在 DialogSystem 注册：
- `'spareScout'`：`ctx.moral.addShouxin(15)`；`ctx.story.recordChoice('sparedScout')`；`ctx.surrenderEnemy` 逃跑（淡出 + destroy）。
- `'executeScout'`：`ctx.moral.addLiqi(20)`；`ctx.story.recordChoice('killedScout')`；`ctx.surrenderEnemy` 死亡（`defeat` + 龙魂奖励）。
- `'revealThreatenedClue'`：`ctx.story.discoverClue('threatenedVillagers')`；标记 NPC 已问过。

数值依据：M3 击杀敌人 `addLiqi(10)`、完美格挡 `addShouxin(8)`。处决求饶者戾气应明显高于普通击杀（20），放过守心应明显高于单次完美格挡（15），让道德选择在数值上有分量。

## 5. 结局文案变体

`FlowController.startEnding` 在现有结局文案后，根据 `story.moralChoices` 追加一段（在「雨夜未尽，少年带刀离家」之前插入）：

- `sparedScout`（有 sparedScout 且无 killedScout）：「他放过了求饶的探子。那探子消失在雨里，留下一句关于乌针的话。」
- `killedScout`：「求饶的探子也死在刀下。龙刃又添一道血痕，雨水冲不净。」
- 两者皆无：不追加（保持原结局文案）。

> 设计上 sparedScout 与 killedScout 互斥（同一局只能触发其一），文案判定以实际记录为准。

## 6. 测试（TDD）

**`tests/dialog-system.test.ts`：**
- `start` 设 active=true、跳到 startNode、selectedOptionIndex=0
- 无 options 末节点：confirm → close → active=false
- 有 options 节点：down 循环切换选项、up 反向循环
- 选项有 next：confirm 跳到目标节点、index 重置为 0
- 选项有 action：confirm 执行 handler 后 close、active=false
- next 与 action 互斥约束：构造非法选项时 DialogSystem 抛错或忽略（明确行为）
- registerAction 的 handler 收到正确 context（moral/story/surrenderEnemy）
- close 后 state 返回 null

**求饶（可并入 dialog-system.test 或 player/enemy 相关测试）：**
- scout 血量 < 阈值进 surrendered、停止 advanceAttack（返回 null）
- spareScout action：moral.shouxin 增加、story 记 sparedScout、敌人标记移除
- executeScout action：moral.liqi 增加、story 记 killedScout

**结局文案变体（FlowController 逻辑可单测提取）：**
- choices 含 sparedScout → 文案含放过段
- choices 含 killedScout → 文案含处决段
- choices 为空 → 原文案

## 7. 文件清单

**新增：**
- `src/game/dialog/DialogSystem.ts`
- `src/game/dialog/dialogDefs.ts`
- `src/game/dialog/DialogUi.ts`
- `src/game/entities/Npc.ts`
- `tests/dialog-system.test.ts`

**修改：**
- `src/game/entities/Enemy.ts` — scout 求饶状态 + 阈值判定 + 视觉
- `src/game/director/EnemyDirector.ts` — 求饶时停止该敌人 advanceAttack
- `src/game/flow/FlowController.ts` — handleNpcDialog / handleSurrender / 结局文案变体
- `src/game/world/WorldBuilder.ts` — 第 4 线索改 Npc + 村民纹理 + 氛围村民
- `src/game/GameScene.ts` — 装配 DialogSystem/DialogUi/Npc + 对话时暂停世界分支
- `src/game/ui/Hud.ts` — 交互提示兼容 NPC/求饶（"E 对话"/"E 处置"）

## 8. 边界与不做

- 不做保护村民道德事件（`protectedVillager` ChoiceId 已预留，留 M5）。
- 不做狂暴误伤 NPC 判定（SkillSystem 的 `hitsAllies` 接口留 M5）。
- 不做"直接攻击致死求饶探子记 killedScout"的判定（留 M5 统一处理"攻击致死求饶者"）。
- 不做多章节对话复用的运行时加载机制（dialogDefs 直接 import，后续章节新增 def 即可）。
- 结局走向不变（仍带刀离家），只做文案变体。
