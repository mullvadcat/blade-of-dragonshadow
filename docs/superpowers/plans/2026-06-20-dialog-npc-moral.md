# 对话系统 + 村民 NPC + 求饶探子道德事件 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在第一章落地分支对话框系统 + 村民 NPC（揭示第四线索）+ 求饶探子道德事件（放过/处决），让"力量的克制"主题在交互层可玩。

**Architecture:** 新增独立 `src/game/dialog/` 子系统（DialogSystem 状态机 + dialogDefs 纯数据 + DialogUi 渲染），与现有 SkillSystem/EnemyDirector 同款"每职责一独立可测模块"模式。DialogSystem 通过 DialogContext（moral/story/surrenderTarget/rewardSoul 回调）与游戏状态解耦，可纯单测。Enemy 新增求饶状态（CombatActor 加 onStrikeResolved protected hook + defeat 改 protected），求饶阈值判定抽成纯函数 shouldSurrender 可测。FlowController 编排对话触发与结局文案变体。对话进行时 GameScene 冻结世界（跳过敌人/玩家/战斗更新）。

**Tech Stack:** TypeScript strict、Phaser 3.90、vitest（globals 已开，但遵循现有测试惯例显式 `import { describe, expect, it } from 'vitest'`）。

**验证基线：** 完成每个任务后跑 `npm run lint && npm run typecheck && npm test`，三者全绿方可继续。最终跑运行时端到端验证。

---

## 文件结构

**新增：**
- `src/game/dialog/dialogDefs.ts` — 对话树纯数据类型 + 3 棵对话树（村民/求饶/氛围村民）
- `src/game/dialog/DialogSystem.ts` — 对话状态机：节点导航/选项切换/action 派发/暂停信号，含 SurrenderTarget 接口与 DialogContext
- `src/game/dialog/DialogUi.ts` — 底部对话框渲染（说话人/台词/选项高亮）
- `src/game/entities/Npc.ts` — 村民实体（不战斗，靠近按 E 触发对话）
- `tests/dialog-system.test.ts` — DialogSystem 状态机单测
- `tests/enemy-surrender.test.ts` — shouldSurrender 纯函数单测
- `tests/ending-moral-suffix.test.ts` — 结局文案变体纯函数单测

**修改：**
- `src/game/entities/CombatActor.ts` — 加 protected `onStrikeResolved` hook；`defeat` 改 protected
- `src/game/entities/Enemy.ts` — scout 求饶状态（shouldSurrender 纯函数 + surrendered 标志 + onStrikeResolved/advanceAttack/update/escape/execute/markSurrendered）
- `src/game/director/EnemyDirector.ts` — hasEnemyNearby 排除已求饶敌人
- `src/game/art/CharacterArt.ts` — 新增村民纹理 `'npc-villager'`
- `src/game/flow/FlowController.ts` — handleNpcDialog/handleSurrender/结局文案变体（endingMoralSuffix 纯函数）
- `src/game/world/WorldBuilder.ts` — 第 4 线索改 Npc + 氛围村民 + createNpcs
- `src/game/GameScene.ts` — 装配 DialogSystem/DialogUi/Npc + 对话时暂停世界分支

---

## Task 1: dialogDefs — 对话树纯数据

**Files:**
- Create: `src/game/dialog/dialogDefs.ts`

- [ ] **Step 1: 创建 dialogDefs.ts**

```typescript
/** 对话选项：next（跳节点）与 action（执行命名动作后关闭）互斥。 */
export type DialogOption = {
  label: string;
  next?: string;
  action?: string;
};

/** 对话节点：无 options 表示末节点（按 E 关闭）。 */
export type DialogNode = {
  speaker: string;
  text: string;
  options?: DialogOption[];
};

export type DialogDef = {
  id: string;
  startNode: string;
  nodes: Record<string, DialogNode>;
};

/** 沉默村民对话：追问那夜的灯 → 揭示第四线索 threatenedVillagers。 */
export const VILLAGER_DIALOG: DialogDef = {
  id: 'villager',
  startNode: 'greet',
  nodes: {
    greet: {
      speaker: '沉默村民',
      text: '……你父亲的坟，我看过。别再问了，这村子什么都不知道。',
      options: [
        { label: '追问那夜的灯', next: 'press' },
        { label: '不再打扰', next: 'leave' },
      ],
    },
    press: {
      speaker: '沉默村民',
      text: '……那夜，所有灯都被人逼着熄了。黑鳞会的人守在每家门口，谁点灯，谁就没命。你父亲……是为了我们才没出那刀。',
      options: [{ label: '记下这话', action: 'revealThreatenedClue' }],
    },
    leave: {
      speaker: '陆云川',
      text: '……打扰了。',
    },
  },
};

/** 求饶探子对话：放过（守心+）或处决（戾气+）。 */
export const SCOUT_SURRENDER_DIALOG: DialogDef = {
  id: 'scoutSurrender',
  startNode: 'plead',
  nodes: {
    plead: {
      speaker: '黑鳞探子',
      text: '别……别杀我！我只是奉命盯梢，乌针就在地下密室！放过我，我消失，再也不回黑鳞会！',
      options: [
        { label: '放过', action: 'spareScout' },
        { label: '处决', action: 'executeScout' },
      ],
    },
  },
};

/** 氛围村民对话：纯增沉浸感，不给线索。 */
export const AMBIENT_VILLAGER_DIALOG: DialogDef = {
  id: 'ambientVillager',
  startNode: 'talk',
  nodes: {
    talk: {
      speaker: '老村民',
      text: '雨下了三天了……这世道，连雨都像在哭。孩子，你父亲是个好人。',
      options: [{ label: '告辞', next: 'bye' }],
    },
    bye: {
      speaker: '陆云川',
      text: '……多保重。',
    },
  },
};
```

- [ ] **Step 2: 运行 typecheck 验证类型无误**

Run: `npm run typecheck`
Expected: 通过（新文件无引用，不破坏现有代码）

- [ ] **Step 3: Commit**

```bash
git add src/game/dialog/dialogDefs.ts
git commit -m "feat(dialog): add data-driven dialog tree definitions"
```

---

## Task 2: DialogSystem — 对话状态机（TDD）

**Files:**
- Test: `tests/dialog-system.test.ts`
- Create: `src/game/dialog/DialogSystem.ts`

- [ ] **Step 1: 写失败测试 tests/dialog-system.test.ts**

```typescript
import { describe, expect, it } from 'vitest';
import { DialogSystem, type DialogContext } from '../src/game/dialog/DialogSystem';
import { MoralState } from '../src/game/moral/MoralState';
import { StoryFlags } from '../src/game/story/StoryFlags';
import type { DialogDef } from '../src/game/dialog/dialogDefs';

const makeContext = (): DialogContext => ({
  moral: new MoralState(),
  story: new StoryFlags(),
  surrenderEnemy: null,
  rewardSoul: () => {},
});

const linearDef: DialogDef = {
  id: 'test',
  startNode: 'a',
  nodes: {
    a: { speaker: 'A', text: 'hello', options: [{ label: 'next', next: 'b' }] },
    b: { speaker: 'B', text: 'bye' },
  },
};

describe('DialogSystem', () => {
  it('start sets active and exposes start node with first option selected', () => {
    const ds = new DialogSystem(makeContext());
    ds.start(linearDef);
    expect(ds.isActive).toBe(true);
    expect(ds.state?.speaker).toBe('A');
    expect(ds.state?.text).toBe('hello');
    expect(ds.state?.options).toEqual([{ label: 'next', selected: true }]);
  });

  it('terminal node without options: confirm closes', () => {
    const ds = new DialogSystem(makeContext());
    ds.start(linearDef);
    ds.handleInput('confirm'); // a -> b
    expect(ds.state?.speaker).toBe('B');
    ds.handleInput('confirm'); // b has no options -> close
    expect(ds.isActive).toBe(false);
    expect(ds.state).toBeNull();
  });

  it('down cycles options forward and wraps', () => {
    const ds = new DialogSystem(makeContext());
    ds.start({
      id: 't',
      startNode: 'n',
      nodes: {
        n: {
          speaker: 'X',
          text: 'pick',
          options: [{ label: '1', next: 'n' }, { label: '2', next: 'n' }, { label: '3', next: 'n' }],
        },
      },
    });
    ds.handleInput('down');
    expect(ds.state?.options[1].selected).toBe(true);
    ds.handleInput('down');
    expect(ds.state?.options[2].selected).toBe(true);
    ds.handleInput('down');
    expect(ds.state?.options[0].selected).toBe(true);
  });

  it('up cycles options backward and wraps', () => {
    const ds = new DialogSystem(makeContext());
    ds.start({
      id: 't',
      startNode: 'n',
      nodes: {
        n: {
          speaker: 'X',
          text: 'pick',
          options: [{ label: '1', next: 'n' }, { label: '2', next: 'n' }],
        },
      },
    });
    ds.handleInput('up');
    expect(ds.state?.options[1].selected).toBe(true);
    ds.handleInput('up');
    expect(ds.state?.options[0].selected).toBe(true);
  });

  it('option with next jumps node and resets selection', () => {
    const ds = new DialogSystem(makeContext());
    ds.start(linearDef);
    ds.handleInput('confirm');
    expect(ds.state?.speaker).toBe('B');
  });

  it('option with action runs handler then closes', () => {
    const ds = new DialogSystem(makeContext());
    let called = false;
    ds.registerAction('doThing', () => {
      called = true;
    });
    ds.start({
      id: 't',
      startNode: 'n',
      nodes: { n: { speaker: 'X', text: 'go', options: [{ label: 'do', action: 'doThing' }] } },
    });
    ds.handleInput('confirm');
    expect(called).toBe(true);
    expect(ds.isActive).toBe(false);
  });

  it('action handler receives context', () => {
    const ctx = makeContext();
    const ds = new DialogSystem(ctx);
    let received: DialogContext | null = null;
    ds.registerAction('grab', (c) => {
      received = c;
    });
    ds.start({
      id: 't',
      startNode: 'n',
      nodes: { n: { speaker: 'X', text: 'go', options: [{ label: 'do', action: 'grab' }] } },
    });
    ds.handleInput('confirm');
    expect(received).toBe(ctx);
  });

  it('option with both next and action throws (mutual exclusion)', () => {
    const ds = new DialogSystem(makeContext());
    ds.start({
      id: 't',
      startNode: 'n',
      nodes: {
        n: {
          speaker: 'X',
          text: 'go',
          options: [{ label: 'bad', next: 'n', action: 'noop' }],
        },
      },
    });
    expect(() => ds.handleInput('confirm')).toThrow();
  });

  it('unregistered action throws', () => {
    const ds = new DialogSystem(makeContext());
    ds.start({
      id: 't',
      startNode: 'n',
      nodes: { n: { speaker: 'X', text: 'go', options: [{ label: 'do', action: 'missing' }] } },
    });
    expect(() => ds.handleInput('confirm')).toThrow();
  });

  it('close clears state', () => {
    const ds = new DialogSystem(makeContext());
    ds.start(linearDef);
    ds.handleInput('close');
    expect(ds.isActive).toBe(false);
    expect(ds.state).toBeNull();
  });

  it('up/down on node without options does nothing', () => {
    const ds = new DialogSystem(makeContext());
    ds.start(linearDef);
    ds.handleInput('confirm'); // -> b (no options)
    ds.handleInput('down');
    expect(ds.state?.speaker).toBe('B');
    ds.handleInput('up');
    expect(ds.state?.speaker).toBe('B');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- dialog-system`
Expected: FAIL — `Cannot find module '../src/game/dialog/DialogSystem'`

- [ ] **Step 3: 实现 DialogSystem.ts**

```typescript
import type { MoralState } from '../moral/MoralState';
import type { StoryFlags } from '../story/StoryFlags';
import type { DialogDef, DialogNode, DialogOption } from './dialogDefs';

/** 求饶目标：放过时逃跑、处决时死亡。Enemy 实现此接口。 */
export type SurrenderTarget = {
  /** 放过：敌人逃跑（淡出消失，不计击杀）。 */
  escape(): void;
  /** 处决：敌人死亡。 */
  execute(): void;
};

/** 对话动作执行上下文：解耦于 Player/Enemy 具体类型，便于单测。 */
export type DialogContext = {
  moral: MoralState;
  story: StoryFlags;
  /** 求饶对话时关联的敌人；普通对话为 null。触发前由调用方赋值。 */
  surrenderEnemy: SurrenderTarget | null;
  /** 处决时给予玩家龙魂奖励的回调（由 FlowController 注入 player.machine.addSoul）。 */
  rewardSoul: (amount: number) => void;
};

export type DialogInput = 'up' | 'down' | 'confirm' | 'close';

export type DialogOptionView = { label: string; selected: boolean };

export type DialogViewState = {
  speaker: string;
  text: string;
  options: DialogOptionView[];
};

export type DialogActionHandler = (ctx: DialogContext) => void;

/**
 * 对话状态机：管理当前节点、选项导航、动作派发。
 * 不渲染、不决定何时触发——由 DialogUi 读 state 渲染，由 FlowController 决定触发时机。
 * 通过 DialogContext 与游戏状态解耦，可纯单测。
 */
export class DialogSystem {
  private active = false;
  private def: DialogDef | null = null;
  private currentNodeId = '';
  private selectedOptionIndex = 0;
  private readonly actions = new Map<string, DialogActionHandler>();

  constructor(private readonly context: DialogContext) {}

  get isActive(): boolean {
    return this.active;
  }

  /** 当前对话视图状态（供 DialogUi 渲染）；未激活返回 null。 */
  get state(): DialogViewState | null {
    if (!this.active || !this.def) {
      return null;
    }
    const node = this.def.nodes[this.currentNodeId];
    const options = (node.options ?? []).map((opt, i) => ({
      label: opt.label,
      selected: i === this.selectedOptionIndex,
    }));
    return { speaker: node.speaker, text: node.text, options };
  }

  registerAction(name: string, handler: DialogActionHandler) {
    this.actions.set(name, handler);
  }

  start(def: DialogDef) {
    this.def = def;
    this.currentNodeId = def.startNode;
    this.selectedOptionIndex = 0;
    this.active = true;
  }

  handleInput(input: DialogInput) {
    if (!this.active || !this.def) {
      return;
    }
    const node = this.def.nodes[this.currentNodeId];
    const options = node.options ?? [];

    if (input === 'close') {
      this.close();
      return;
    }

    if (input === 'up' || input === 'down') {
      if (options.length > 0) {
        const dir = input === 'down' ? 1 : -1;
        this.selectedOptionIndex =
          (this.selectedOptionIndex + dir + options.length) % options.length;
      }
      return;
    }

    if (input === 'confirm') {
      if (options.length === 0) {
        this.close();
        return;
      }
      const option = options[this.selectedOptionIndex];
      this.confirmOption(option);
    }
  }

  close() {
    this.active = false;
    this.def = null;
    this.currentNodeId = '';
    this.selectedOptionIndex = 0;
  }

  private confirmOption(option: DialogOption) {
    if (option.next && option.action) {
      throw new Error(`DialogOption "${option.label}" 不能同时定义 next 与 action（互斥）`);
    }
    if (option.action) {
      const handler = this.actions.get(option.action);
      if (!handler) {
        throw new Error(`未注册的对话动作: ${option.action}`);
      }
      handler(this.context);
      this.close();
      return;
    }
    if (option.next) {
      this.gotoNode(option.next);
      return;
    }
    // 既无 next 也无 action：关闭
    this.close();
  }

  private gotoNode(nodeId: string) {
    if (!this.def) {
      return;
    }
    const node: DialogNode | undefined = this.def.nodes[nodeId];
    if (!node) {
      throw new Error(`对话节点不存在: ${nodeId}`);
    }
    this.currentNodeId = nodeId;
    this.selectedOptionIndex = 0;
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- dialog-system`
Expected: PASS — 11 tests

- [ ] **Step 5: 跑 lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: 全绿

- [ ] **Step 6: Commit**

```bash
git add src/game/dialog/DialogSystem.ts tests/dialog-system.test.ts
git commit -m "feat(dialog): add DialogSystem state machine with node navigation and action dispatch"
```

---

## Task 3: CombatActor — onStrikeResolved hook + defeat 改 protected

**Files:**
- Modify: `src/game/entities/CombatActor.ts`

- [ ] **Step 1: 把 defeat 方法从 private 改为 protected**

将 `private defeat() {` 改为 `protected defeat() {`。

- [ ] **Step 2: 加 onStrikeResolved protected hook**

在 `receiveStrike` 方法中，`Object.assign(this.combatState, result.target);` 之后、`if (this.combatState.health <= 0) {` 之前，插入 hook 调用：

```typescript
  receiveStrike(strike: Strike, time: number): StrikeResult {
    const result = CombatSystem.resolveStrike(strike, this.combatState, time);
    Object.assign(this.combatState, result.target);

    this.onStrikeResolved(result, time);

    if (this.combatState.health <= 0) {
      this.defeat();
      return result;
    }
```

在 `protected onDefeat() {}` 附近新增空 hook：

```typescript
  /** 子类可覆写：受击结算后、死亡判定前的扩展点（如求饶保底）。 */
  protected onStrikeResolved(_result: StrikeResult, _time: number) {}
```

- [ ] **Step 3: 跑 lint + typecheck + test 确认无破坏**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 全绿（hook 默认空实现，不影响现有 Enemy/BossWuzhen 行为）

- [ ] **Step 4: Commit**

```bash
git add src/game/entities/CombatActor.ts
git commit -m "refactor(combat): add onStrikeResolved hook and expose defeat to subclasses"
```

---

## Task 4: Enemy 求饶状态 — shouldSurrender 纯函数（TDD）

**Files:**
- Test: `tests/enemy-surrender.test.ts`
- Modify: `src/game/entities/Enemy.ts`

- [ ] **Step 1: 写失败测试 tests/enemy-surrender.test.ts**

```typescript
import { describe, expect, it } from 'vitest';
import { shouldSurrender, SCOUT_SURRENDER_HEALTH_RATIO } from '../src/game/entities/Enemy';

describe('shouldSurrender', () => {
  it('returns true when health is below ratio threshold but above zero', () => {
    expect(shouldSurrender(1, 42)).toBe(true);
    expect(shouldSurrender(10, 42)).toBe(true);
  });

  it('returns false when health is above threshold', () => {
    expect(shouldSurrender(11, 42)).toBe(false);
    expect(shouldSurrender(42, 42)).toBe(false);
  });

  it('returns false when dead (health <= 0)', () => {
    expect(shouldSurrender(0, 42)).toBe(false);
    expect(shouldSurrender(-5, 42)).toBe(false);
  });

  it('ratio is 0.25', () => {
    expect(SCOUT_SURRENDER_HEALTH_RATIO).toBe(0.25);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- enemy-surrender`
Expected: FAIL — `shouldSurrender is not a function`（未导出）

- [ ] **Step 3: 在 Enemy.ts 顶部加纯函数与常量**

在 `import` 之后、`export type EnemyKind` 之前，新增：

```typescript
/** scout 进入求饶状态的血量比例阈值（血量 ≤ maxHealth × 此值 且 > 0 时触发）。 */
export const SCOUT_SURRENDER_HEALTH_RATIO = 0.25;

/** 纯函数：判定当前血量是否应进入求饶状态。供 Enemy 调用，亦可独立单测。 */
export const shouldSurrender = (health: number, maxHealth: number): boolean =>
  health > 0 && health <= maxHealth * SCOUT_SURRENDER_HEALTH_RATIO;
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- enemy-surrender`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/game/entities/Enemy.ts tests/enemy-surrender.test.ts
git commit -m "feat(enemy): add shouldSurrender pure function with 0.25 health threshold"
```

---

## Task 5: Enemy 求饶状态 — 类行为（surrendered 标志 + hook + 视觉 + escape/execute）

**Files:**
- Modify: `src/game/entities/Enemy.ts`

- [ ] **Step 1: 在 Enemy 类加 surrendered 字段与求饶标记方法**

在 `readonly kind: EnemyKind;` 之后新增字段：

```typescript
  /** 是否已进入求饶状态（仅 scout 会触发）。求饶后停止出招与追击。 */
  private surrendered = false;

  /** 求饶标记精灵（"求"字标），求饶时显示。 */
  private surrenderMarker: Phaser.GameObjects.Text | null = null;
```

在类内新增方法：

```typescript
  get isSurrendered(): boolean {
    return this.surrendered;
  }

  /** 标记求饶：停步、跪地视觉、显"求"标记。 */
  private markSurrendered() {
    if (this.surrendered) {
      return;
    }
    this.surrendered = true;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(0);
    this.setScale(0.82, 0.78);
    this.setTint(0x9a8c7a);
    this.surrenderMarker = this.scene.add
      .text(this.x, this.y - 56, '求', {
        color: '#f2dfb8',
        fontFamily: 'serif',
        fontSize: '18px',
        backgroundColor: '#3a1208',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(25);
  }

  /** 放过：淡出后销毁（不计击杀，不给龙魂）。实现 SurrenderTarget.escape。 */
  escape() {
    if (!this.active) {
      return;
    }
    this.surrenderMarker?.destroy();
    this.surrenderMarker = null;
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 500,
      onComplete: () => {
        this.nameplate.destroy();
        this.healthBar.destroy();
        this.disableBody(true, true);
        this.destroy();
      },
    });
  }

  /** 处决：直接死亡（走 defeat 流程）。实现 SurrenderTarget.execute。 */
  execute() {
    if (!this.active) {
      return;
    }
    this.surrenderMarker?.destroy();
    this.surrenderMarker = null;
    this.combatState.health = 0;
    this.defeat();
  }
```

- [ ] **Step 2: 覆写 onStrikeResolved — scout 进入求饶区间时保底 1 血**

在类内新增覆写方法：

```typescript
  protected onStrikeResolved() {
    if (this.kind !== 'scout' || this.surrendered) {
      return;
    }
    if (this.combatState.health <= 0) {
      // 本会致死但 scout 未求饶过：保底 1 血给玩家选择机会
      this.combatState.health = 1;
    }
    if (shouldSurrender(this.combatState.health, this.combatState.maxHealth)) {
      this.markSurrendered();
    }
  }
```

- [ ] **Step 3: 覆写 advanceAttack — 求饶后停止出招**

在类内新增覆写方法（CombatActor.advanceAttack 是 public，覆写保持 public）：

```typescript
  advanceAttack(time: number, playerX: number): Strike | null {
    if (this.surrendered) {
      return null;
    }
    return super.advanceAttack(time, playerX);
  }
```

- [ ] **Step 4: 覆写 update — 求饶后停止追击**

将现有 `update` 方法改为：

```typescript
  update(time: number, playerX: number) {
    if (!this.active) {
      return;
    }

    if (this.surrendered) {
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.setVelocityX(0);
      this.followUi();
      this.surrenderMarker?.setPosition(this.x, this.y - 56);
      return;
    }

    this.chase(time, playerX, this.kind === 'scout' ? 82 : 62, 54, 360);
    this.followUi();
  }
```

- [ ] **Step 5: 跑 lint + typecheck + test**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 全绿（新方法未被调用，不影响现有测试；shouldSurrender 测试仍通过）

- [ ] **Step 6: Commit**

```bash
git add src/game/entities/Enemy.ts
git commit -m "feat(enemy): add scout surrender state with 1hp mercy floor, escape/execute, visual"
```

---

## Task 6: EnemyDirector — hasEnemyNearby 排除求饶敌人

**Files:**
- Modify: `src/game/director/EnemyDirector.ts`

- [ ] **Step 1: 修改 hasEnemyNearby，排除已求饶敌人**

将 `hasEnemyNearby` 方法改为：

```typescript
  hasEnemyNearby(playerX: number, playerY: number, radiusX = 420, radiusY = 140): boolean {
    return this.enemies.some(
      (enemy) =>
        enemy.active &&
        !enemy.isSurrendered &&
        Math.abs(enemy.x - playerX) < radiusX &&
        Math.abs(enemy.y - playerY) < radiusY,
    );
  }
```

- [ ] **Step 2: 跑 lint + typecheck + test**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 全绿

- [ ] **Step 3: Commit**

```bash
git add src/game/director/EnemyDirector.ts
git commit -m "feat(director): exclude surrendered enemies from nearby combat detection"
```

---

## Task 7: CharacterArt — 新增村民纹理

**Files:**
- Modify: `src/game/art/CharacterArt.ts`

- [ ] **Step 1: 在 CharacterArtKey 类型加 'villager'**

将 `export type CharacterArtKey = ...` 改为：

```typescript
export type CharacterArtKey = 'player' | 'scout' | 'bandit' | 'wuzhen' | 'villager';
```

- [ ] **Step 2: 在 CHARACTER_ART_SPECS 加 villager 规格**

在 `wuzhen: { ... },` 之后新增：

```typescript
  villager: {
    textureKey: 'npc-villager',
    width: 60,
    height: 84,
    transparentBackground: true,
    features: ['grey robe', 'straw hat', 'hunched frame', 'rain-soaked'],
  },
```

- [ ] **Step 3: 在 createCharacterTextures 调用 createVillagerTexture**

将 `createCharacterTextures` 改为：

```typescript
export const createCharacterTextures = (scene: Phaser.Scene) => {
  createPlayerTexture(scene);
  createScoutTexture(scene);
  createBanditTexture(scene);
  createWuzhenTexture(scene);
  createVillagerTexture(scene);
};
```

- [ ] **Step 4: 新增 createVillagerTexture 函数**

在 `createWuzhenTexture` 函数之后新增：

```typescript
const createVillagerTexture = (scene: Phaser.Scene) => {
  const spec = CHARACTER_ART_SPECS.villager;
  const gfx = makeGraphics(scene);

  // 斗笠
  drawPixelRect(gfx, 14, 14, 32, 6, 0x8a7a5a);
  drawPixelRect(gfx, 18, 10, 24, 8, 0x6b5d44);
  // 脸
  drawPixelRect(gfx, 22, 24, 16, 10, 0xc9a884);
  // 灰色长袍
  drawPixelRect(gfx, 16, 36, 28, 34, 0x5a5550);
  drawPixelRect(gfx, 12, 40, 10, 30, 0x3e3a36);
  drawPixelRect(gfx, 38, 40, 10, 30, 0x3e3a36);
  // 腰带
  drawPixelRect(gfx, 16, 54, 28, 5, 0x4a4540);
  // 腿
  drawPixelRect(gfx, 22, 70, 8, 12, 0x2a2622);
  drawPixelRect(gfx, 32, 70, 8, 12, 0x2a2622);
  drawPixelRect(gfx, 18, 82, 12, 2, 0x0c0b0a);
  drawPixelRect(gfx, 32, 82, 12, 2, 0x0c0b0a);
  // 雨湿质感（肩部高光）
  drawPixelRect(gfx, 16, 36, 28, 3, 0x7a7570, 0.5);

  gfx.generateTexture(spec.textureKey, spec.width, spec.height);
  gfx.destroy();
};
```

- [ ] **Step 5: 跑 lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: 全绿

- [ ] **Step 6: Commit**

```bash
git add src/game/art/CharacterArt.ts
git commit -m "feat(art): add villager character texture"
```

---

## Task 8: Npc 实体

**Files:**
- Create: `src/game/entities/Npc.ts`

- [ ] **Step 1: 创建 Npc.ts**

```typescript
import Phaser from 'phaser';

export type NpcOptions = {
  /** 关联的对话定义 id（由 FlowController 解析为 DialogDef）。 */
  dialogId: string;
  /** 名牌文字。 */
  name: string;
};

/**
 * 村民 NPC：不参与战斗，靠近按 E 触发对话。
 * 不继承 CombatActor（无战斗状态），仅做物理体 + 名牌。
 */
export class Npc extends Phaser.Physics.Arcade.Sprite {
  readonly dialogId: string;
  /** 对话是否已完成（用于线索村民标记，避免重复触发）。 */
  talked = false;
  private readonly nameplate: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, options: NpcOptions) {
    super(scene, x, y, 'npc-villager');
    this.dialogId = options.dialogId;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(30, 60);
    body.setImmovable(true);
    body.setAllowGravity(false);
    this.setDepth(10);

    this.nameplate = scene.add
      .text(x, y - 52, options.name, {
        color: '#c9b078',
        fontFamily: 'serif',
        fontSize: '13px',
        stroke: '#050608',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(20);
  }

  update() {
    if (!this.active) {
      return;
    }
    this.nameplate.setPosition(this.x, this.y - 52);
  }

  /** 对话完成后标记，名牌变灰。 */
  markTalked() {
    this.talked = true;
    this.nameplate.setColor('#6a6a6a');
  }

  destroy(fromScene?: boolean) {
    this.nameplate.destroy();
    super.destroy(fromScene);
  }
}
```

- [ ] **Step 2: 跑 lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: 全绿

- [ ] **Step 3: Commit**

```bash
git add src/game/entities/Npc.ts
git commit -m "feat(entities): add Npc entity for villager dialog triggers"
```

---

## Task 9: DialogUi — 底部对话框渲染

**Files:**
- Create: `src/game/dialog/DialogUi.ts`

- [ ] **Step 1: 创建 DialogUi.ts**

```typescript
import Phaser from 'phaser';
import type { DialogSystem } from './DialogSystem';

/**
 * 底部对话框渲染：读 DialogSystem.state 画说话人/台词/选项高亮。
 * 不持有对话逻辑，只负责视觉。depth 110（高于游戏低于结局面板 120/130）。
 */
export class DialogUi {
  private readonly box: Phaser.GameObjects.Rectangle;
  private readonly border: Phaser.GameObjects.Rectangle;
  private readonly speakerText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly optionsText: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly group: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, private readonly system: DialogSystem) {
    this.group = scene.add.container(0, 0).setScrollFactor(0).setDepth(110).setVisible(false);

    this.box = scene.add
      .rectangle(640, 560, 920, 150, 0x121319, 0.94)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0xd7bf83, 0.9);
    this.border = scene.add
      .rectangle(640, 560, 908, 138, 0x000000, 0)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x6b5d44, 0.6);
    this.speakerText = scene.add
      .text(200, 502, '', {
        color: '#d7bf83',
        fontFamily: 'serif',
        fontSize: '20px',
        stroke: '#050608',
        strokeThickness: 4,
      })
      .setOrigin(0, 0.5);
    this.bodyText = scene.add
      .text(200, 540, '', {
        color: '#f0e0ba',
        fontFamily: 'serif',
        fontSize: '20px',
        stroke: '#050608',
        strokeThickness: 4,
        wordWrap: { width: 860 },
      })
      .setOrigin(0, 0);
    this.optionsText = scene.add
      .text(200, 600, '', {
        color: '#a8a8a8',
        fontFamily: 'serif',
        fontSize: '18px',
        stroke: '#050608',
        strokeThickness: 3,
      })
      .setOrigin(0, 0);
    this.hint = scene.add
      .text(1080, 624, '', {
        color: '#8fa9b0',
        fontFamily: 'serif',
        fontSize: '15px',
        stroke: '#050608',
        strokeThickness: 3,
      })
      .setOrigin(1, 0.5);

    this.group.add([this.box, this.border, this.speakerText, this.bodyText, this.optionsText, this.hint]);
  }

  update() {
    const state = this.system.state;
    if (!state) {
      this.group.setVisible(false);
      return;
    }
    this.group.setVisible(true);
    this.speakerText.setText(state.speaker);
    this.bodyText.setText(state.text);

    if (state.options.length > 0) {
      const lines = state.options.map((opt) => `${opt.selected ? '▶ ' : '  '}${opt.label}`);
      this.optionsText.setText(lines.join('\n'));
      const selected = state.options.find((opt) => opt.selected);
      this.optionsText.setColor(selected ? '#d7bf83' : '#a8a8a8');
      this.hint.setText('↑/↓ 选 · E 定 · Esc 关');
    } else {
      this.optionsText.setText('');
      this.hint.setText('E 继续 · Esc 关');
    }
  }
}
```

- [ ] **Step 2: 跑 lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: 全绿

- [ ] **Step 3: Commit**

```bash
git add src/game/dialog/DialogUi.ts
git commit -m "feat(dialog): add DialogUi bottom dialog box renderer"
```

---

## Task 10: 结局文案变体纯函数（TDD）

**Files:**
- Test: `tests/ending-moral-suffix.test.ts`
- Modify: `src/game/flow/FlowController.ts`

- [ ] **Step 1: 写失败测试 tests/ending-moral-suffix.test.ts**

```typescript
import { describe, expect, it } from 'vitest';
import { endingMoralSuffix } from '../src/game/flow/FlowController';
import type { MoralChoiceId } from '../src/game/story/StoryFlags';

describe('endingMoralSuffix', () => {
  it('returns empty string when no moral choices recorded', () => {
    expect(endingMoralSuffix([])).toBe('');
  });

  it('returns mercy line when scout was spared (and not killed)', () => {
    const choices: MoralChoiceId[] = ['sparedScout'];
    expect(endingMoralSuffix(choices)).toContain('放过');
    expect(endingMoralSuffix(choices)).toContain('探子');
  });

  it('returns execution line when scout was killed', () => {
    const choices: MoralChoiceId[] = ['killedScout'];
    expect(endingMoralSuffix(choices)).toContain('血痕');
  });

  it('prefers execution line when both spared and killed exist', () => {
    const choices: MoralChoiceId[] = ['sparedScout', 'killedScout'];
    expect(endingMoralSuffix(choices)).toContain('血痕');
    expect(endingMoralSuffix(choices)).not.toContain('放过');
  });

  it('ignores unrelated choices', () => {
    const choices: MoralChoiceId[] = ['protectedVillager'];
    expect(endingMoralSuffix(choices)).toBe('');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- ending-moral-suffix`
Expected: FAIL — `endingMoralSuffix is not a function`

- [ ] **Step 3: 在 FlowController.ts 加 endingMoralSuffix 纯函数**

在文件顶部 import 区追加类型导入：

```typescript
import type { MoralChoiceId } from '../story/StoryFlags';
```

在 `import` 区之后、`export class FlowController` 之前，新增：

```typescript
/** 结局文案的道德选择变体段（根据本局道德记录追加）。 */
export const endingMoralSuffix = (choices: readonly MoralChoiceId[]): string => {
  if (choices.includes('killedScout')) {
    return '求饶的探子也死在刀下。龙刃又添一道血痕，雨水冲不净。\n\n';
  }
  if (choices.includes('sparedScout')) {
    return '他放过了求饶的探子。那探子消失在雨里，留下一句关于乌针的话。\n\n';
  }
  return '';
};
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- ending-moral-suffix`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/game/flow/FlowController.ts tests/ending-moral-suffix.test.ts
git commit -m "feat(flow): add endingMoralSuffix pure function for moral choice ending variant"
```

---

## Task 11: FlowController — 对话触发编排 + 结局文案接入

**Files:**
- Modify: `src/game/flow/FlowController.ts`

- [ ] **Step 1: 在 FlowController 顶部加 import**

在文件 import 区追加（注意：`endingMoralSuffix` 与 FlowController 同文件，直接调用，无需自 import）：

```typescript
import { DialogSystem } from '../dialog/DialogSystem';
import { VILLAGER_DIALOG, SCOUT_SURRENDER_DIALOG, AMBIENT_VILLAGER_DIALOG } from '../dialog/dialogDefs';
import type { Npc } from '../entities/Npc';
import type { Enemy } from '../entities/Enemy';
import type { DialogDef } from '../dialog/dialogDefs';
```

- [ ] **Step 2: 在 FlowController 类加字段与构造参数**

将构造函数签名改为接收 Npc 列表与 DialogSystem：

```typescript
export class FlowController {
  endingStarted = false;
  gameOverStarted = false;
  chamberOpened = false;

  private readonly restartKey: Phaser.Input.Keyboard.Key;
  private readonly npcs: Npc[];
  private readonly dialog: DialogSystem;
  private readonly dialogUp: Phaser.Input.Keyboard.Key;
  private readonly dialogDown: Phaser.Input.Keyboard.Key;
  private readonly dialogConfirm: Phaser.Input.Keyboard.Key;
  private readonly dialogClose: Phaser.Input.Keyboard.Key;
  private readonly dialogDefsById: Record<string, DialogDef>;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly hud: Hud,
    private readonly story: StoryFlags,
    private readonly enemies: EnemyDirector,
    private readonly audioDirector: AudioDirector,
    private readonly points: InvestigationPoint[],
    npcs: Npc[],
    dialog: DialogSystem,
  ) {
    this.restartKey = scene.input.keyboard!.addKey('R');
    this.npcs = npcs;
    this.dialog = dialog;
    this.dialogUp = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.dialogDown = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.dialogConfirm = scene.input.keyboard!.addKey('E');
    this.dialogClose = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.dialogDefsById = {
      [VILLAGER_DIALOG.id]: VILLAGER_DIALOG,
      [SCOUT_SURRENDER_DIALOG.id]: SCOUT_SURRENDER_DIALOG,
      [AMBIENT_VILLAGER_DIALOG.id]: AMBIENT_VILLAGER_DIALOG,
    };

    this.registerDialogActions();
  }
```

- [ ] **Step 3: 加 registerDialogActions — 注册对话动作 handler**

在类内新增方法：

```typescript
  private registerDialogActions() {
    this.dialog.registerAction('revealThreatenedClue', (ctx) => {
      ctx.story.discoverClue('threatenedVillagers');
      // 标记村民已问过
      for (const npc of this.npcs) {
        if (npc.dialogId === 'villager') {
          npc.markTalked();
        }
      }
    });

    this.dialog.registerAction('spareScout', (ctx) => {
      ctx.moral.addShouxin(15);
      ctx.story.recordChoice('sparedScout');
      ctx.surrenderEnemy?.escape();
    });

    this.dialog.registerAction('executeScout', (ctx) => {
      ctx.moral.addLiqi(20);
      ctx.story.recordChoice('killedScout');
      ctx.surrenderEnemy?.execute();
      ctx.rewardSoul(8);
    });
  }
```

- [ ] **Step 4: 加 handleDialogInput — 对话进行时处理输入**

在类内新增方法：

```typescript
  /** 对话进行时：处理选项导航/确认/关闭输入。返回是否正在对话中。 */
  handleDialogInput(): boolean {
    if (!this.dialog.isActive) {
      return false;
    }
    if (Phaser.Input.Keyboard.JustDown(this.dialogUp)) {
      this.dialog.handleInput('up');
    }
    if (Phaser.Input.Keyboard.JustDown(this.dialogDown)) {
      this.dialog.handleInput('down');
    }
    if (Phaser.Input.Keyboard.JustDown(this.dialogConfirm)) {
      this.dialog.handleInput('confirm');
    }
    if (Phaser.Input.Keyboard.JustDown(this.dialogClose)) {
      this.dialog.handleInput('close');
    }
    return true;
  }
```

- [ ] **Step 5: 加 handleNpcDialog — 村民对话触发**

在类内新增方法：

```typescript
  /** 每帧：检测玩家是否靠近 NPC 并按 E 触发对话。 */
  handleNpcDialog() {
    if (this.dialog.isActive) {
      return;
    }
    for (const npc of this.npcs) {
      if (!npc.active) {
        continue;
      }
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y);
      if (dist < 86) {
        this.hud.showPrompt('E 对话');
        if (this.player.wantsInteract()) {
          const def = this.dialogDefsById[npc.dialogId];
          if (def) {
            this.dialog.start(def);
          }
        }
        return;
      }
    }
  }
```

> 注意：对话导航用方向键 ↑/↓（与 WASD 移动键分离，避免冲突疑虑），E 确认，Esc 关闭。对话时 Player.update 不调用，WASD 无副作用，但用方向键更清晰。

- [ ] **Step 6: 加 handleSurrender — 求饶探子触发**

在类内新增方法：

```typescript
  /** 每帧：检测是否有求饶的 scout 靠近玩家并按 E 触发求饶对话。 */
  handleSurrender() {
    if (this.dialog.isActive) {
      return;
    }
    for (const enemy of this.enemies.activeEnemies) {
      if (!enemy.active || !enemy.isSurrendered) {
        continue;
      }
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (dist < 80) {
        this.hud.showPrompt('E 处置求饶者');
        if (this.player.wantsInteract()) {
          // 设置对话上下文的求饶目标，再启动对话
          this.dialog.setSurrenderTarget(enemy);
          this.dialog.start(SCOUT_SURRENDER_DIALOG);
        }
        return;
      }
    }
  }
```

> 注意：需在 DialogSystem 加 `setSurrenderTarget` 方法设置 context.surrenderEnemy。在 Task 2 的 DialogSystem 中补此方法。回 Task 2 Step 3 在 DialogSystem 类内加：

```typescript
  /** 触发求饶对话前设置求饶目标（写入 context.surrenderEnemy）。 */
  setSurrenderTarget(target: SurrenderTarget | null) {
    this.context.surrenderEnemy = target;
  }
```

- [ ] **Step 7: 修改 startEnding — 接入结局文案变体**

将 `startEnding` 方法中的 `text` 创建部分改为在原文案中插入道德变体段。找到原 `.text(640, 260, '密室中，三样遗物静静等待：\n...` 那段，改为：

```typescript
    const moralSuffix = endingMoralSuffix(this.story.moralChoices);
    const endingBody = `密室中，三样遗物静静等待：\n《龙影刀经》、龙刃刀、父亲遗书。\n\n${moralSuffix}“刀可以杀人，也可以救人。\n若有一日你拔出龙刃，记住，不要让仇恨替你握刀。”\n\n雨夜未尽，少年带刀离家。\n他还不懂何时收刀，却已踏入江湖。`;
    const text = this.scene.add
      .text(640, 260, endingBody, {
```

- [ ] **Step 8: 跑 lint + typecheck + test**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 全绿（FlowController 构造签名变了，但 GameScene 尚未更新调用——typecheck 会报错。本步先不跑 GameScene 改动，typecheck 预期 FAIL 于 GameScene 装配。因此本步推迟到 Task 12 GameScene 改完后一起验证。）

> 修正：本 Task 不单独跑 typecheck（因 GameScene 尚未适配新构造签名）。本 Task 只 Commit 代码，验证留到 Task 12 完成后统一跑。

- [ ] **Step 9: Commit**

```bash
git add src/game/flow/FlowController.ts
git commit -m "feat(flow): wire dialog triggers for villager NPC and scout surrender, moral ending variant"
```

---

## Task 12: GameScene — 装配 DialogSystem/DialogUi/Npc + 对话时暂停世界

**Files:**
- Modify: `src/game/GameScene.ts`
- Modify: `src/game/world/WorldBuilder.ts`

- [ ] **Step 1: 在 WorldBuilder.ts 加 createNpcs 方法**

在 `createInvestigationPoints` 方法之后新增：

```typescript
  /** 创建村民 NPC：第四线索"沉默村民"（揭示 threatenedVillagers）+ 1 个氛围村民。 */
  createNpcs(): Npc[] {
    const npcs: Npc[] = [
      new Npc(this.scene, 1990, 590, { dialogId: 'villager', name: '沉默村民' }),
      new Npc(this.scene, 620, 605, { dialogId: 'ambientVillager', name: '老村民' }),
    ];
    // Npc 构造内已 scene.physics.add.existing；此处只设不可推动
    for (const npc of npcs) {
      const body = npc.body as Phaser.Physics.Arcade.Body;
      body.setImmovable(true);
    }
    return npcs;
  }
```

在 WorldBuilder.ts 顶部 import 区加：

```typescript
import { Npc } from '../entities/Npc';
```

- [ ] **Step 2: 在 WorldBuilder.createInvestigationPoints 移除第 4 线索调查点**

将 `createInvestigationPoints` 中的第 4 个点（`threatenedVillagers` 那项）从 `this.points.push(...)` 中删除。修改后只保留 3 个调查点：

```typescript
  createInvestigationPoints(): InvestigationPoint[] {
    this.points.length = 0;
    this.points.push(
      {
        x: 520,
        y: 605,
        label: '父亲伤痕',
        clue: 'wound',
        text: '伤口细而深，不像山路坠亡，更像黑夜里的短刃。',
        object: this.scene.add.zone(520, 604, 92, 96),
        marker: this.addMarker(520, 552, '伤'),
      },
      {
        x: 950,
        y: 605,
        label: '黑鳞令牌',
        clue: 'blackScaleToken',
        text: '泥水里压着一枚黑鳞令。村里没人敢说它从何而来。',
        object: this.scene.add.zone(950, 604, 92, 96),
        marker: this.addMarker(950, 552, '鳞'),
      },
      {
        x: 1590,
        y: 590,
        label: '烧灼刀鞘',
        clue: 'burnedScabbard',
        text: '刀鞘边缘有红黑灼痕，像被妖气舔过。',
        object: this.scene.add.zone(1590, 590, 110, 96),
        marker: this.addMarker(1590, 536, '鞘'),
      },
    );

    for (const point of this.points) {
      this.scene.physics.add.existing(point.object, true);
    }
    return this.points;
  }
```

- [ ] **Step 3: 在 GameScene.ts 顶部加 import**

```typescript
import { DialogSystem, type DialogContext } from './dialog/DialogSystem';
import { DialogUi } from './dialog/DialogUi';
import type { Npc } from './entities/Npc';
```

- [ ] **Step 4: 在 GameScene 加字段**

在 `private flow!: FlowController;` 之后新增：

```typescript
  private dialogSystem!: DialogSystem;
  private dialogUi!: DialogUi;
  private npcs: Npc[] = [];
```

- [ ] **Step 5: 在 GameScene.create 装配 DialogSystem/DialogUi/Npc**

在 `const points = this.world.createInvestigationPoints();` 之后加：

```typescript
    this.npcs = this.world.createNpcs();
```

在 `this.hud = new Hud(this);` 之后、`this.flow = new FlowController(...)` 之前，加 DialogSystem 与 DialogUi 装配：

```typescript
    const dialogContext: DialogContext = {
      moral: this.player.moral,
      story: this.story,
      surrenderEnemy: null,
      rewardSoul: (amount) => this.player.machine.addSoul(amount),
    };
    this.dialogSystem = new DialogSystem(dialogContext);
    this.dialogUi = new DialogUi(this, this.dialogSystem);
```

- [ ] **Step 6: 修改 FlowController 构造调用，传入 npcs 与 dialogSystem**

将原 `this.flow = new FlowController(this, this.player, this.hud, this.story, this.enemyDirector, this.audioDirector, points);` 改为：

```typescript
    this.flow = new FlowController(
      this,
      this.player,
      this.hud,
      this.story,
      this.enemyDirector,
      this.audioDirector,
      points,
      this.npcs,
      this.dialogSystem,
    );
```

- [ ] **Step 7: 修改 GameScene.update — 对话时暂停世界分支**

将 `update` 方法改为：

```typescript
  update(time: number) {
    // 对话进行时：冻结世界，只处理对话输入与 UI
    if (this.dialogSystem.isActive) {
      this.flow.handleDialogInput();
      this.dialogUi.update();
      return;
    }

    this.player.update(time, this.cursors);
    this.hud.update(this.player, this.story, time, this.combatDirector.skillState);
    this.audioController.update();

    if (this.player.machine.isDead()) {
      this.flow.handleGameOverInput();
      if (!this.flow.gameOverStarted && !this.flow.endingStarted) {
        this.flow.startGameOver();
      }
      return;
    }

    this.flow.handleNpcDialog();
    this.flow.handleSurrender();
    this.flow.handleInvestigation();
    this.flow.handleStudyGate();

    // 玩家攻击与技能并行处理：consumeAttack 返回普通斩击或游龙回身派生标记。
    const attackStrike = this.player.consumeAttack(time);
    if (attackStrike && attackStrike.staminaDamage === -1) {
      this.combatDirector.handleSkills(time, attackStrike);
    } else {
      if (attackStrike) {
        this.combatDirector.applyPlayerAttack(attackStrike, time);
      }
      this.combatDirector.handleSkills(time, null);
    }
    this.combatDirector.handleBladeAura(time);

    const enemyStrikes = this.enemyDirector.advanceEnemies(time, this.player.x);
    for (const strike of enemyStrikes) {
      if (this.flow.endingStarted || this.flow.gameOverStarted) {
        break;
      }
      this.combatDirector.applyEnemyStrike(strike, time);
    }

    const bossStrike = this.enemyDirector.advanceBoss(time, this.player.x);
    if (bossStrike && !this.flow.endingStarted && !this.flow.gameOverStarted) {
      this.combatDirector.applyEnemyStrike(bossStrike, time);
    }

    // NPC 名牌跟随
    for (const npc of this.npcs) {
      npc.update();
    }
  }
```

- [ ] **Step 8: 跑 lint + typecheck + test**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 全绿

- [ ] **Step 9: Commit**

```bash
git add src/game/GameScene.ts src/game/world/WorldBuilder.ts
git commit -m "feat(scene): assemble DialogSystem/DialogUi/Npc, pause world during dialog"
```

---

## Task 13: 补 DialogSystem.setSurrenderTarget + 修复 Npc.name 暴露

**Files:**
- Modify: `src/game/dialog/DialogSystem.ts`
- Modify: `src/game/entities/Npc.ts`

> 前置依赖：Task 11 引用了 `dialog.setSurrenderTarget` 与 Npc 名牌文案。本 Task 补齐这两个遗漏点。

- [ ] **Step 1: 在 DialogSystem 类加 setSurrenderTarget 方法**

在 `start(def: DialogDef)` 方法之前新增：

```typescript
  /** 触发求饶对话前设置求饶目标（写入 context.surrenderEnemy）。 */
  setSurrenderTarget(target: SurrenderTarget | null) {
    this.context.surrenderEnemy = target;
  }
```

- [ ] **Step 2: 确认 Npc 名牌文案问题**

Task 11 Step 5 已改用固定文案 `'E 对话'`，不依赖 Npc.nameplate。确认 FlowController.handleNpcDialog 中使用的是 `this.hud.showPrompt('E 对话');`（已修正）。无需改 Npc。

- [ ] **Step 3: 跑 lint + typecheck + test**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 全绿

- [ ] **Step 4: Commit**

```bash
git add src/game/dialog/DialogSystem.ts
git commit -m "feat(dialog): add setSurrenderTarget for linking surrender enemy to dialog context"
```

---

## Task 14: 更新操作提示文本

**Files:**
- Modify: `src/game/GameScene.ts`

- [ ] **Step 1: 修改底部操作提示，加入对话说明**

将 create 中第一行提示：

```typescript
      .text(22, 690, '移动WASD 闪避Space 轻斩J 重斩K 格挡L 刀气U 潜龙I 裂鳞O 调查E', {
```

改为：

```typescript
      .text(22, 690, '移动WASD 闪避Space 轻斩J 重斩K 格挡L 刀气U 潜龙I 裂鳞O 对话/调查E', {
```

- [ ] **Step 2: 跑 lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: 全绿

- [ ] **Step 3: Commit**

```bash
git add src/game/GameScene.ts
git commit -m "docs(ui): update controls hint with dialog key"
```

---

## Task 15: 运行时端到端验证

**Files:**
- 无新文件；临时诊断脚本（验证后删除）

- [ ] **Step 1: 确认 dev 服务在跑**

Run: `curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:5173/`
Expected: HTTP 200（若非 200，`nohup npm run dev > /tmp/vite-dev.log 2>&1 &` 重启）

- [ ] **Step 2: 临时暴露 __game 并写诊断脚本**

在 `src/main.ts` 临时把 `new Phaser.Game(config);` 改为：

```typescript
const game = new Phaser.Game(config);
(window as unknown as { __game: Phaser.Game }).__game = game;
```

创建 `diagnose.mjs`（验证 DialogSystem、求饶触发、放过/处决动作、结局文案变体）：

```javascript
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-web-security', '--mute-audio'],
});
const page = await browser.newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message}`));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle0' });
await page.waitForFunction('window.__game.scene.getScene("GameScene").dialogSystem', { timeout: 8000 });

const result = await page.evaluate(() => {
  const scene = window.__game.scene.getScene('GameScene');
  const ds = scene.dialogSystem;
  const player = scene.player;
  const story = scene.story;

  // 1. 村民对话流程：启动 → 追问 → 揭示线索
  ds.start(scene.flow.dialogDefsById.villager);
  const s1 = ds.state;
  ds.handleInput('confirm'); // 选"追问那夜的灯" (index 0)
  const s2 = ds.state;
  ds.handleInput('confirm'); // 选"记下这话" -> revealThreatenedClue
  const hasClue = story.hasClue('threatenedVillagers');
  const afterClueActive = ds.isActive;

  // 2. 求饶流程：让 scout 从满血吃一次大伤害，触发保底 1 血 + 求饶
  const scout = scene.enemyDirector.activeEnemies.find((e) => e.kind === 'scout');
  scout.combatState.health = 42;
  // 45 伤害本会致死(-3)，onStrikeResolved 保底 1 血并求饶
  scout.receiveStrike({ damage: 45, guardDamage: 0, staminaDamage: 0, blockDamageMultiplier: 0, staggerDuration: 0 }, 9999);
  const surrendered = scout.isSurrendered;
  const hpFloor = scout.combatState.health;

  // 3. 放过动作
  ds.setSurrenderTarget(scout);
  ds.start(scene.flow.dialogDefsById.scoutSurrender);
  ds.handleInput('confirm'); // 选"放过" (index 0) -> spareScout
  const shouxin = player.moral.shouxin;
  const spared = story.hasChoice('sparedScout');

  return {
    s1Speaker: s1?.speaker,
    s2HasPressText: s2?.text.includes('灯'),
    hasClue,
    afterClueActive,
    surrendered,
    hpFloor,
    shouxin,
    spared,
  };
});

console.log(JSON.stringify(result, null, 2));
const ok =
  result.s1Speaker === '沉默村民' &&
  result.s2HasPressText &&
  result.hasClue === true &&
  result.afterClueActive === false &&
  result.surrendered === true &&
  result.hpFloor === 1 &&
  result.shouxin === 15 &&
  result.spared === true;
console.log(ok ? '\n✅ M4 端到端通过' : '\n❌ M4 异常');
if (logs.length) console.log(logs.join('\n'));
await browser.close();
```

Run: `node diagnose.mjs`
Expected: `✅ M4 端到端通过`

> 若 puppeteer-core 不可用，改用 playwright（项目已有 `.playwright-cli/`）。或手动浏览器开发者控制台执行上述 evaluate 内的逻辑。

- [ ] **Step 3: 移除调试代码**

将 `src/main.ts` 改回 `new Phaser.Game(config);`，删除 `diagnose.mjs`。

- [ ] **Step 4: 最终三件套验证**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 全绿

- [ ] **Step 5: Commit**

```bash
git add src/main.ts
git commit -m "chore: remove debug game instance exposure"
```

---

## Self-Review 已完成

- ✅ Spec 覆盖：对话系统（Task 1-3,9）、村民 NPC（Task 7,8,12）、求饶探子道德事件（Task 4,5,6,11,13）、结局文案变体（Task 10,11）、对话时暂停世界（Task 12）、端到端验证（Task 15）均有对应任务
- ✅ 无占位符：每步含完整代码与命令
- ✅ 类型一致：DialogSystem/DialogContext/SurrenderTarget/DialogInput/DialogViewState 跨任务命名一致；shouldSurrender/SCOUT_SURRENDER_HEALTH_RATIO 一致；endingMoralSuffix 一致
- ✅ TDD：DialogSystem（Task 2）、shouldSurrender（Task 4）、endingMoralSuffix（Task 10）均先写失败测试再实现
- ✅ DRY：对话动作用字符串标识集中在 handler，dialogDefs 纯数据可复用
