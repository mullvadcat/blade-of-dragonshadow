# 保护村民道德事件 + 限场地破坏机制 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地第一章"力量的克制"主题最后两块拼图——保护村民道德事件（`protectedVillager` ChoiceId，脚本式触发，击败威胁者得守心+）+ 限场地破坏机制（可破坏环境物体，狂暴大范围招式破坏加戾气硬性惩罚），让第一章成为完整垂直切片。

**Architecture:** 新增纯模块 `destructibleTarget.ts`（`isDestructibleInRange` 纯函数，仿 `allyCasualty.ts`/`meleeTarget.ts` 模式）+ `protectEvent.ts`（`shouldTriggerProtectEvent`/`resolveProtectOutcome` 纯函数，可单测）。新增 `Destructible` 实体（物理体+hp+碎裂视觉，程序化纹理）。`EnemyDirector` 加 `spawnThreat()` 生成威胁 bandit（单独引用，不进 enemies 数组）。`CombatDirector` 加 destructibles 依赖，`releaseBladeAura`/`executeSkillEffect` 加破坏判定 + `resolveThreatMeleeHit` 让普攻/技能命中威胁者。`FlowController.handleProtectEvent` 管触发与成败判定，威胁者 update/Strike 由 `GameScene.update` 统一推进（仿 bossStrike 模式）。`endingMoralSuffix` 加 protectedVillager 分支。

**Tech Stack:** TypeScript strict、Phaser 3.90、vitest（遵循现有惯例显式 `import { describe, expect, it } from 'vitest'`）。

**验证基线：** 完成每个任务后跑 `npm run lint && npm run typecheck && npm test`，三者全绿方可继续。

**Spec：** [`docs/superpowers/specs/2026-06-21-protect-villager-destructible-design.md`](../specs/2026-06-21-protect-villager-destructible-design.md)

---

## 文件结构

**新增：**
- `src/game/entities/destructibleTarget.ts` — `isDestructibleInRange` 纯函数（无 Phaser 依赖，可单测）
- `src/game/entities/Destructible.ts` — 可破坏环境物体实体（物理体+hp+碎裂视觉）
- `src/game/flow/protectEvent.ts` — `shouldTriggerProtectEvent`/`resolveProtectOutcome` 纯函数（可单测）
- `tests/destructible-target.test.ts` — 纯函数单测
- `tests/protect-event.test.ts` — 纯函数单测

**修改：**
- `src/game/flow/endingMoralSuffix.ts` — 加 protectedVillager 文案分支
- `tests/ending-moral-suffix.test.ts` — 改 protectedVillager 用例 + 新增优先级用例
- `src/game/combat/combatBalance.ts` — 加 destructible/protect 数值
- `src/game/world/WorldBuilder.ts` — createGeneratedTextures 加 4 种可破坏物纹理；新增 createDestructibles()
- `src/game/director/EnemyDirector.ts` — 新增 spawnThreat() + activeThreat getter
- `src/game/director/CombatDirector.ts` — 构造加 destructibles；releaseBladeAura 路径破坏+目标加威胁者；executeSkillEffect 范围破坏；resolveThreatMeleeHit + 调用点
- `src/game/flow/FlowController.ts` — 新增 protectResolved/protectTriggered + threatenedVillager + handleProtectEvent + threatenedVillagerX getter
- `src/game/GameScene.ts` — 装配 destructibles；update 调用 handleProtectEvent + 威胁者推进

---

## Task 1: destructibleTarget 纯函数（TDD）

**Files:**
- Test: `tests/destructible-target.test.ts`
- Create: `src/game/entities/destructibleTarget.ts`

- [ ] **Step 1: 写失败测试 tests/destructible-target.test.ts**

```typescript
import { describe, expect, it } from 'vitest';
import { isDestructibleInRange } from '../src/game/entities/destructibleTarget';

describe('isDestructibleInRange', () => {
  it('returns true when target is within range', () => {
    expect(isDestructibleInRange(100, 100, 100, 100, 92, 86)).toBe(true);
    expect(isDestructibleInRange(180, 150, 100, 100, 92, 86)).toBe(true);
  });

  it('returns false when target is outside range horizontally', () => {
    expect(isDestructibleInRange(200, 100, 100, 100, 92, 86)).toBe(false);
    expect(isDestructibleInRange(0, 100, 100, 100, 92, 86)).toBe(false);
  });

  it('returns false when target is outside range vertically', () => {
    expect(isDestructibleInRange(100, 200, 100, 100, 92, 86)).toBe(false);
    expect(isDestructibleInRange(100, 0, 100, 100, 92, 86)).toBe(false);
  });

  it('returns false at exact boundary (strict less-than)', () => {
    expect(isDestructibleInRange(192, 100, 100, 100, 92, 86)).toBe(false);
    expect(isDestructibleInRange(100, 186, 100, 100, 92, 86)).toBe(false);
  });

  it('handles negative direction (target to the left/up)', () => {
    expect(isDestructibleInRange(20, 100, 100, 100, 92, 86)).toBe(true);
    expect(isDestructibleInRange(100, 20, 100, 100, 92, 86)).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- destructible-target`
Expected: FAIL — `Cannot find module '../src/game/entities/destructibleTarget'`

- [ ] **Step 3: 创建 src/game/entities/destructibleTarget.ts**

```typescript
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- destructible-target`
Expected: PASS — 5 tests

- [ ] **Step 5: 跑 lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: 全绿

- [ ] **Step 6: Commit**

```bash
git add src/game/entities/destructibleTarget.ts tests/destructible-target.test.ts
git commit -m "feat(entities): add isDestructibleInRange pure function for destructible targeting"
```

---

## Task 2: protectEvent 纯函数（TDD）

**Files:**
- Test: `tests/protect-event.test.ts`
- Create: `src/game/flow/protectEvent.ts`

- [ ] **Step 1: 写失败测试 tests/protect-event.test.ts**

```typescript
import { describe, expect, it } from 'vitest';
import {
  shouldTriggerProtectEvent,
  resolveProtectOutcome,
  type ProtectTriggerContext,
  type ProtectOutcomeContext,
} from '../src/game/flow/protectEvent';

describe('shouldTriggerProtectEvent', () => {
  const baseCtx: ProtectTriggerContext = {
    hasThreatenedClue: true,
    playerX: 1990,
    villagerX: 1990,
    playerToVillagerDist: 50,
    protectResolved: false,
  };

  it('returns true when has clue, player near, not resolved', () => {
    expect(shouldTriggerProtectEvent(baseCtx)).toBe(true);
  });

  it('returns false when missing threatened clue', () => {
    expect(shouldTriggerProtectEvent({ ...baseCtx, hasThreatenedClue: false })).toBe(false);
  });

  it('returns false when player too far', () => {
    expect(shouldTriggerProtectEvent({ ...baseCtx, playerToVillagerDist: 200 })).toBe(false);
  });

  it('returns false when already resolved', () => {
    expect(shouldTriggerProtectEvent({ ...baseCtx, protectResolved: true })).toBe(false);
  });

  it('uses 160 as trigger distance threshold', () => {
    expect(shouldTriggerProtectEvent({ ...baseCtx, playerToVillagerDist: 159 })).toBe(true);
    expect(shouldTriggerProtectEvent({ ...baseCtx, playerToVillagerDist: 161 })).toBe(false);
  });
});

describe('resolveProtectOutcome', () => {
  const baseCtx: ProtectOutcomeContext = {
    threatActive: true,
    threatX: 2100,
    villagerX: 1990,
    threatToVillagerDist: 110,
  };

  it('returns success when threat inactive (defeated)', () => {
    expect(resolveProtectOutcome({ ...baseCtx, threatActive: false })).toBe('success');
  });

  it('returns failure when threat reaches villager (dist < 50)', () => {
    expect(resolveProtectOutcome({ ...baseCtx, threatToVillagerDist: 30 })).toBe('failure');
  });

  it('returns pending when threat active but not yet at villager', () => {
    expect(resolveProtectOutcome(baseCtx)).toBe('pending');
  });

  it('returns pending at exact boundary (dist = 50, strict less-than)', () => {
    expect(resolveProtectOutcome({ ...baseCtx, threatToVillagerDist: 50 })).toBe('pending');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- protect-event`
Expected: FAIL — `Cannot find module '../src/game/flow/protectEvent'`

- [ ] **Step 3: 创建 src/game/flow/protectEvent.ts**

```typescript
/** 保护事件触发条件（纯数据，不依赖 Phaser）。 */
export type ProtectTriggerContext = {
  hasThreatenedClue: boolean;
  playerX: number;
  villagerX: number;
  playerToVillagerDist: number;
  protectResolved: boolean;
};

/** 保护事件是否应触发：有线索 + 玩家在村民附近 + 未解析过。 */
export const shouldTriggerProtectEvent = (ctx: ProtectTriggerContext): boolean =>
  ctx.hasThreatenedClue && !ctx.protectResolved && ctx.playerToVillagerDist < 160;

/** 保护事件成败判定（纯数据）。 */
export type ProtectOutcomeContext = {
  threatActive: boolean;
  threatX: number;
  villagerX: number;
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- protect-event`
Expected: PASS — 9 tests

- [ ] **Step 5: 跑 lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: 全绿

- [ ] **Step 6: Commit**

```bash
git add src/game/flow/protectEvent.ts tests/protect-event.test.ts
git commit -m "feat(flow): add protectEvent pure functions for villager protection event"
```

---

## Task 3: endingMoralSuffix 加 protectedVillager 分支（TDD）

**Files:**
- Modify: `src/game/flow/endingMoralSuffix.ts`
- Test: `tests/ending-moral-suffix.test.ts`

- [ ] **Step 1: 改测试——把"protectedVillager 返回空"用例改为含保护文案，并加优先级用例**

将 `tests/ending-moral-suffix.test.ts` 中最后一个用例（`ignores unrelated choices`）替换为以下三个用例：

```typescript
  it('returns protection line when villager was protected', () => {
    const choices: MoralChoiceId[] = ['protectedVillager'];
    expect(endingMoralSuffix(choices)).toContain('护住');
    expect(endingMoralSuffix(choices)).toContain('村民');
  });

  it('prefers execution line over protection when both exist', () => {
    const choices: MoralChoiceId[] = ['protectedVillager', 'killedScout'];
    expect(endingMoralSuffix(choices)).toContain('血痕');
    expect(endingMoralSuffix(choices)).not.toContain('护住');
  });

  it('prefers protection line over mercy when both exist', () => {
    const choices: MoralChoiceId[] = ['protectedVillager', 'sparedScout'];
    expect(endingMoralSuffix(choices)).toContain('护住');
    expect(endingMoralSuffix(choices)).not.toContain('放过');
  });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- ending-moral-suffix`
Expected: FAIL — `expected '' to contain '护住'`（现有实现未处理 protectedVillager）

- [ ] **Step 3: 修改 src/game/flow/endingMoralSuffix.ts 加 protectedVillager 分支**

将整个文件改为：

```typescript
import type { MoralChoiceId } from '../story/StoryFlags';

/** 结局文案的道德选择变体段（根据本局道德记录追加）。 */
export const endingMoralSuffix = (choices: readonly MoralChoiceId[]): string => {
  if (choices.includes('killedScout')) {
    return '求饶的探子也死在刀下。龙刃又添一道血痕，雨水冲不净。\n\n';
  }
  if (choices.includes('protectedVillager')) {
    return '雨夜里他护住了一个村民。那村民没敢问他名字，只在门后望着他带刀远去。\n\n';
  }
  if (choices.includes('sparedScout')) {
    return '他放过了求饶的探子。那探子消失在雨里，留下一句关于乌针的话。\n\n';
  }
  return '';
};
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- ending-moral-suffix`
Expected: PASS — 7 tests（原 4 + 新增 3，移除原 1 个"ignores unrelated"）

- [ ] **Step 5: 跑 lint + typecheck + 全量测试**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 全绿（注意原第 5 个用例"prefers execution line when both spared and killed exist"仍保留）

- [ ] **Step 6: Commit**

```bash
git add src/game/flow/endingMoralSuffix.ts tests/ending-moral-suffix.test.ts
git commit -m "feat(ending): add protectedVillager moral suffix branch with priority ordering"
```

---

## Task 4: combatBalance 加新数值

**Files:**
- Modify: `src/game/combat/combatBalance.ts`

- [ ] **Step 1: 在 liqiReward 加破坏可破坏物数值，shouxinReward 加保护村民数值**

将 `src/game/combat/combatBalance.ts` 的 `liqiReward` 和 `shouxinReward` 块改为：

```typescript
  /** 戾气积累。 */
  liqiReward: {
    kill: 10,
    bladeAuraKill: 8,
    allyHarm: 12,
    /** 破坏可破坏物（刀气路径）。 */
    destructibleBladeAura: 5,
    /** 破坏可破坏物（技能，平衡/守护形态）。 */
    destructibleSkill: 6,
    /** 破坏可破坏物（技能，狂暴形态）。 */
    destructibleSkillWrath: 8,
  },
  /** 守心积累。 */
  shouxinReward: {
    perfectGuard: 8,
    /** 保护村民成功。 */
    protectVillager: 18,
  },
```

- [ ] **Step 2: 跑 typecheck + 全量测试（确认未破坏现有引用）**

Run: `npm run typecheck && npm test`
Expected: 全绿（现有代码未引用新字段，仅新增字段）

- [ ] **Step 3: 跑 lint**

Run: `npm run lint`
Expected: 全绿

- [ ] **Step 4: Commit**

```bash
git add src/game/combat/combatBalance.ts
git commit -m "feat(balance): add destructible penalty and protect-villager reward values"
```

---

## Task 5: Destructible 实体 + 纹理生成

**Files:**
- Create: `src/game/entities/Destructible.ts`
- Modify: `src/game/world/WorldBuilder.ts`（仅 createGeneratedTextures 加纹理）

- [ ] **Step 1: 创建 src/game/entities/Destructible.ts**

```typescript
import Phaser from 'phaser';

export type DestructibleKind = 'stall' | 'lantern' | 'barrel' | 'urn';

export type DestructibleOptions = {
  kind: DestructibleKind;
  /** 字幕显示名（如"货摊""灯笼"）。 */
  label: string;
};

/**
 * 可破坏环境物体：被大范围招式波及时碎裂 + 永久标记。
 * 不参与战斗，无攻击行为。takeDamage() 幂等：首次破坏设 destroyed + 碎裂视觉，返回 true。
 */
export class Destructible extends Phaser.Physics.Arcade.Sprite {
  readonly kind: DestructibleKind;
  readonly label: string;
  private destroyed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, options: DestructibleOptions) {
    super(scene, x, y, `destructible-${options.kind}`);
    this.kind = options.kind;
    this.label = options.label;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(40, 48);
    body.setImmovable(true);
    body.setAllowGravity(false);
    this.setDepth(8);
  }

  /** 是否已被破坏（幂等标记，供破坏判定跳过已碎物体）。 */
  get isDestroyed(): boolean {
    return this.destroyed;
  }

  /**
   * 受破坏：首次破坏设 destroyed + 碎裂视觉（碎裂 tween + 灰化 + 碎片飞溅），返回 true；
   * 已破坏则返回 false（幂等，防刷值）。
   */
  takeDamage(): boolean {
    if (this.destroyed) {
      return false;
    }
    this.destroyed = true;
    this.setTint(0x4a3a2a);
    this.scene.tweens.add({
      targets: this,
      scaleX: 0.6,
      scaleY: 0.4,
      angle: Phaser.Math.Between(-12, 12),
      alpha: 0.7,
      duration: 220,
    });
    for (let i = 0; i < 6; i += 1) {
      const shard = this.scene.add
        .rectangle(this.x, this.y - 16, 6, 6, 0x6a5a3a, 0.9)
        .setDepth(12);
      this.scene.tweens.add({
        targets: shard,
        x: this.x + Phaser.Math.Between(-40, 40),
        y: this.y + Phaser.Math.Between(-20, 10),
        alpha: 0,
        duration: 400,
        onComplete: () => shard.destroy(),
      });
    }
    return true;
  }
}
```

- [ ] **Step 2: 在 WorldBuilder.createGeneratedTextures 末尾加 4 种可破坏物纹理**

在 `src/game/world/WorldBuilder.ts` 的 `createGeneratedTextures()` 方法中，`createCharacterTextures(this.scene);` 之后、`createRect('ground', ...)` 之前，加入可破坏物纹理生成。将方法改为：

```typescript
  createGeneratedTextures() {
    const createRect = (key: string, width: number, height: number, color: number) => {
      const gfx = this.scene.make.graphics({ x: 0, y: 0 }, false);
      gfx.fillStyle(color, 1);
      gfx.fillRect(0, 0, width, height);
      gfx.generateTexture(key, width, height);
      gfx.destroy();
    };

    createCharacterTextures(this.scene);
    this.createDestructibleTextures();
    createRect('ground', 96, 28, 0x15151a);
    createRect('paper', 28, 28, 0xd2b777);
    createRect('blade', 72, 8, 0xaaf7ff);
  }
```

- [ ] **Step 3: 在 WorldBuilder 加 createDestructibleTextures 私有方法**

在 `WorldBuilder` 类中（`createGeneratedTextures` 之后）加：

```typescript
  /** 生成 4 种可破坏物纹理：货摊(棕褐长方)/灯笼(暗红圆)/木桶(深棕矮方)/水缸(青灰椭圆)。 */
  private createDestructibleTextures() {
    const make = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void, w: number, h: number) => {
      const gfx = this.scene.make.graphics({ x: 0, y: 0 }, false);
      draw(gfx);
      gfx.generateTexture(key, w, h);
      gfx.destroy();
    };

    make('destructible-stall', (g) => {
      g.fillStyle(0x4a3520, 1);
      g.fillRect(0, 28, 60, 36);
      g.fillStyle(0x6a4a28, 1);
      g.fillRect(4, 8, 52, 24);
      g.fillStyle(0x3a2a18, 1);
      g.fillRect(0, 60, 60, 6);
    }, 60, 66);

    make('destructible-lantern', (g) => {
      g.fillStyle(0x6a1818, 1);
      g.fillCircle(12, 18, 12);
      g.fillStyle(0xd09742, 0.9);
      g.fillRect(8, 14, 8, 8);
      g.fillStyle(0x2a1a0a, 1);
      g.fillRect(10, 2, 4, 6);
    }, 24, 32);

    make('destructible-barrel', (g) => {
      g.fillStyle(0x4a3520, 1);
      g.fillRect(2, 4, 28, 40);
      g.fillStyle(0x2a1a0a, 1);
      g.fillRect(0, 12, 32, 3);
      g.fillRect(0, 32, 32, 3);
      g.fillStyle(0x6a4a28, 1);
      g.fillRect(2, 4, 28, 2);
    }, 32, 48);

    make('destructible-urn', (g) => {
      g.fillStyle(0x3a4a55, 1);
      g.fillEllipse(20, 24, 32, 40);
      g.fillStyle(0x5a6a75, 0.8);
      g.fillEllipse(20, 14, 24, 10);
      g.fillStyle(0x2a3a45, 1);
      g.fillRect(14, 4, 12, 4);
    }, 40, 48);
  }
```

- [ ] **Step 4: 跑 lint + typecheck（无单测，确认编译通过）**

Run: `npm run lint && npm run typecheck`
Expected: 全绿

- [ ] **Step 5: 跑全量测试（确认未破坏现有）**

Run: `npm test`
Expected: 全绿

- [ ] **Step 6: Commit**

```bash
git add src/game/entities/Destructible.ts src/game/world/WorldBuilder.ts
git commit -m "feat(entities): add Destructible entity with procedural textures and shatter fx"
```

---

## Task 6: WorldBuilder createDestructibles

**Files:**
- Modify: `src/game/world/WorldBuilder.ts`

- [ ] **Step 1: 在 WorldBuilder 加 createDestructibles 方法**

在 `WorldBuilder` 类中（`createNpcs()` 之后）加：

```typescript
  /** 创建可破坏环境物体：保护事件区域 3 件（C3 轻联动）+ 祠堂前 2 件 + 旧宅前 2 件。 */
  createDestructibles(): Destructible[] {
    const specs: Array<[number, number, DestructibleKind, string]> = [
      // 保护事件区域（村民 1990 附近）
      [1880, 612, 'stall', '货摊'],
      [2100, 612, 'lantern', '灯笼'],
      [2150, 612, 'barrel', '木桶'],
      // 祠堂前
      [820, 612, 'urn', '水缸'],
      [880, 612, 'lantern', '灯笼'],
      // 旧宅前
      [1420, 612, 'stall', '货摊'],
      [1620, 612, 'barrel', '木桶'],
    ];
    return specs.map(
      ([x, y, kind, label]) => new Destructible(this.scene, x, y, { kind, label }),
    );
  }
```

- [ ] **Step 2: 在 WorldBuilder.ts 顶部加 Destructible 导入**

在 `src/game/world/WorldBuilder.ts` 顶部 `import { Npc } from '../entities/Npc';` 之后加：

```typescript
import { Destructible, type DestructibleKind } from '../entities/Destructible';
```

- [ ] **Step 3: 跑 lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: 全绿

- [ ] **Step 4: 跑全量测试**

Run: `npm test`
Expected: 全绿

- [ ] **Step 5: Commit**

```bash
git add src/game/world/WorldBuilder.ts
git commit -m "feat(world): add createDestructibles placing 7 breakable objects across ch1"
```

---

## Task 7: EnemyDirector spawnThreat

**Files:**
- Modify: `src/game/director/EnemyDirector.ts`

- [ ] **Step 1: 在 EnemyDirector 加 threatEnemy 字段 + spawnThreat + activeThreat getter**

在 `src/game/director/EnemyDirector.ts` 的 `EnemyDirector` 类中，`private boss: BossWuzhen | null = null;` 之后加字段：

```typescript
  private threatEnemy: Enemy | null = null;
```

在 `spawnBoss()` 方法之后加：

```typescript
  /** 脚本生成威胁村民的 bandit（保护事件用）。单独引用，不进 enemies 数组。 */
  spawnThreat(x: number, _villagerX: number): Enemy {
    this.threatEnemy = new Enemy(this.scene, x, 580, 'bandit', this.sfx);
    this.scene.physics.add.collider(this.threatEnemy, this.ground);
    return this.threatEnemy;
  }

  /** 当前威胁者（保护事件用；可能已死亡，调用方需查 .active）。 */
  get activeThreat(): Enemy | null {
    return this.threatEnemy;
  }
```

- [ ] **Step 2: 跑 lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: 全绿

- [ ] **Step 3: 跑全量测试**

Run: `npm test`
Expected: 全绿

- [ ] **Step 4: Commit**

```bash
git add src/game/director/EnemyDirector.ts
git commit -m "feat(director): add spawnThreat for scripted villager-protection event"
```

---

## Task 8: CombatDirector 破坏判定 + 威胁者命中 + 刀气目标

**Files:**
- Modify: `src/game/director/CombatDirector.ts`

- [ ] **Step 1: 在 CombatDirector.ts 顶部加导入**

在 `src/game/director/CombatDirector.ts` 顶部 `import { isAllyWithinRange } from '../entities/allyCasualty';` 之后加：

```typescript
import { isDestructibleInRange } from '../entities/destructibleTarget';
import { Destructible } from '../entities/Destructible';
```

- [ ] **Step 2: 构造加 destructibles 参数**

将构造函数改为（在 `npcs` 之后、`onBossDefeated` 之前加 `destructibles`）：

```typescript
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly enemies: EnemyDirector,
    private readonly hud: Hud,
    sfx: (name: SfxName) => void,
    private readonly npcs: readonly Npc[],
    private readonly destructibles: readonly Destructible[],
    onBossDefeated: () => void,
  ) {
    this.sfx = sfx;
    this.onBossDefeated = onBossDefeated;
    this.auraKey = scene.input.keyboard!.addKey('U');
    this.skillSystem = new SkillSystem(player.moral);
    this.skillKeyLurk = scene.input.keyboard!.addKey('I');
    this.skillKeyBreak = scene.input.keyboard!.addKey('O');
  }
```

- [ ] **Step 3: 在 applyPlayerAttack 的 resolveMeleeHit 后加 resolveThreatMeleeHit 调用**

将 `applyPlayerAttack` 方法中 `resolveMeleeHit(...)` 块改为（在原有命中判定后加威胁者命中）：

```typescript
    if (
      this.resolveMeleeHit(
        finalStrike,
        COMBAT_BALANCE.meleeRange.enemyX,
        COMBAT_BALANCE.meleeRange.bossX,
        time,
      )
    ) {
      this.sfx('hit');
    }
    if (this.resolveThreatMeleeHit(finalStrike, COMBAT_BALANCE.meleeRange.enemyX, time)) {
      this.sfx('hit');
    }
```

- [ ] **Step 4: 加 resolveThreatMeleeHit 私有方法**

在 `resolveMeleeHit` 方法之后加：

```typescript
  /**
   * 威胁者近战命中结算：威胁 bandit 不在 enemies 数组，需单独判定。
   * 求饶中的威胁者不结算（与普通敌人一致）。击败给龙魂+戾气（同普攻击杀）。
   * @returns 是否命中（用于命中音效）
   */
  private resolveThreatMeleeHit(strike: Strike, enemyRange: number, time: number): boolean {
    const threat = this.enemies.activeThreat;
    if (
      !threat?.active ||
      !isMeleeHittable(
        threat.active,
        threat.isSurrendered,
        threat.x,
        threat.y,
        this.player.x,
        this.player.y,
        enemyRange,
        COMBAT_BALANCE.meleeRange.enemyY,
      )
    ) {
      return false;
    }
    threat.receiveStrike(strike, time);
    if (!threat.active) {
      this.player.machine.addSoul(COMBAT_BALANCE.soulRewards.kill);
      this.player.moral.addLiqi(COMBAT_BALANCE.liqiReward.kill);
    }
    return true;
  }
```

- [ ] **Step 5: 在 releaseBladeAura 目标列表加威胁者 + 路径破坏判定**

将 `releaseBladeAura` 方法改为：

```typescript
  private releaseBladeAura(time: number) {
    // 求饶者不被刀气结算（统一走求饶对话处置）。
    const targets: CombatActor[] = this.enemies.activeEnemies.filter(
      (enemy) => !enemy.isSurrendered,
    );
    const threat = this.enemies.activeThreat;
    if (threat?.active && !threat.isSurrendered) {
      targets.push(threat);
    }
    const boss = this.enemies.activeBoss;
    if (boss?.active) {
      targets.push(boss);
    }
    const strike = CombatSystem.createBladeAuraStrike();
    const aura = new BladeAura(
      this.scene,
      this.player.x,
      this.player.y,
      this.player.facing,
      this.player.moral.bladeColor(),
      strike,
      targets,
      this.sfx,
    );
    this.auras.push(aura);

    // 刀气路径破坏判定：沿玩家朝向直线，y 接近的可破坏物按距离错峰碎裂。
    const auraRange = 520;
    const dir = this.player.facing;
    for (const d of this.destructibles) {
      if (!d.active || d.isDestroyed) {
        continue;
      }
      const dx = d.x - this.player.x;
      if (dx !== 0 && Math.sign(dx) !== dir) {
        continue;
      }
      if (Math.abs(dx) < auraRange && Math.abs(d.y - this.player.y) < 60) {
        const delay = (Math.abs(dx) / 14) * 16;
        this.scene.time.delayedCall(delay, () => {
          if (d.active && d.takeDamage()) {
            this.player.moral.addLiqi(COMBAT_BALANCE.liqiReward.destructibleBladeAura);
          }
        });
      }
    }
  }
```

- [ ] **Step 6: 在 executeSkillEffect 加破坏判定 + 威胁者命中**

在 `executeSkillEffect` 方法中，现有 `resolveMeleeHit` 调用块改为（加威胁者命中）：

```typescript
    if (this.resolveMeleeHit(cast.strike, range, bossRange, time)) {
      this.sfx('hit');
    }
    if (this.resolveThreatMeleeHit(cast.strike, range, time)) {
      this.sfx('hit');
    }
```

在现有"狂暴误伤判定"块之后、`this.showSkillFx(cast.skillId);` 之前，加可破坏物破坏判定：

```typescript
    // 可破坏物破坏判定：游龙回身是精准反击，不破坏；其余技能按形态范围波及。
    if (cast.skillId !== 'dragonReturn') {
      let destroyedCount = 0;
      for (const d of this.destructibles) {
        if (!d.active || d.isDestroyed) {
          continue;
        }
        if (
          isDestructibleInRange(
            d.x,
            d.y,
            this.player.x,
            this.player.y,
            range,
            COMBAT_BALANCE.meleeRange.enemyY,
          )
        ) {
          if (d.takeDamage()) {
            destroyedCount += 1;
          }
        }
      }
      if (destroyedCount > 0) {
        const isWrath = cast.form.hitsAllies === true;
        const penalty = isWrath
          ? COMBAT_BALANCE.liqiReward.destructibleSkillWrath
          : COMBAT_BALANCE.liqiReward.destructibleSkill;
        for (let i = 0; i < destroyedCount; i += 1) {
          this.player.moral.addLiqi(penalty);
        }
        if (isWrath) {
          this.hud.showSubtitle('刀气失控，劈碎了身侧之物——你不该对无辜之物下重手。');
        }
      }
    }
```

- [ ] **Step 7: 在 GameScene.ts 临时传空 destructibles 数组（Task 10 替换为真实数组）**

因 CombatDirector 构造签名已加 `destructibles` 参数，需同步改 GameScene 构造调用，否则 typecheck 失败。将 `src/game/GameScene.ts` 中 `CombatDirector` 构造调用改为（在 `this.npcs` 之后加 `[]` 占位）：

```typescript
    this.combatDirector = new CombatDirector(
      this,
      this.player,
      this.enemyDirector,
      this.hud,
      this.sfx,
      this.npcs,
      [],
      () => {
        if (!this.flow.endingStarted) {
          this.flow.startEnding();
        }
      },
    );
```

> Task 10 会把 `[]` 替换为 `this.destructibles` 并在 create() 中生成真实数组。

- [ ] **Step 8: 跑 lint + typecheck + 全量测试**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 全绿（destructibles 传空数组，破坏判定循环不执行，不影响现有行为）

- [ ] **Step 9: Commit**

```bash
git add src/game/director/CombatDirector.ts src/game/GameScene.ts
git commit -m "feat(combat): add destructible destruction + threat enemy melee hit in skill/aura"
```

---

## Task 9: FlowController handleProtectEvent

**Files:**
- Modify: `src/game/flow/FlowController.ts`

- [ ] **Step 1: 在 FlowController.ts 顶部加导入**

在 `src/game/flow/FlowController.ts` 顶部 `import { endingMoralSuffix } from './endingMoralSuffix';` 之后加：

```typescript
import { shouldTriggerProtectEvent, resolveProtectOutcome } from './protectEvent';
import { COMBAT_BALANCE } from '../combat/combatBalance';
```

- [ ] **Step 2: 在 FlowController 加 protect 字段 + threatenedVillager 引用**

在 `FlowController` 类的 `endingStarted = false;` / `gameOverStarted = false;` / `chamberOpened = false;` 字段块之后加：

```typescript
  /** 保护村民事件是否已触发（spawnThreat 已调用）。 */
  protectTriggered = false;
  /** 保护村民事件是否已解析（成功或失败），GameScene 据此停止推进威胁者。 */
  protectResolved = false;
  private threatenedVillager: Npc | null = null;
```

- [ ] **Step 3: 在构造函数中找出 villager NPC 存为 threatenedVillager**

在构造函数末尾（`this.registerDialogActions();` 之前）加：

```typescript
    this.threatenedVillager = npcs.find((npc) => npc.dialogId === 'villager') ?? null;
```

- [ ] **Step 4: 加 threatenedVillagerX getter（供 GameScene 推进威胁者用）**

在 `handleDialogInput` 方法之前加：

```typescript
  /** 受威胁村民 x 坐标（GameScene 推进威胁者朝村民移动用）。无村民则返回 0。 */
  get threatenedVillagerX(): number {
    return this.threatenedVillager?.x ?? 0;
  }
```

- [ ] **Step 5: 加 handleProtectEvent 方法**

在 `handleStudyGate` 方法之后加：

```typescript
  /** 每帧：检测保护村民事件触发与成败（威胁者 update/Strike 由 GameScene 统一推进）。 */
  handleProtectEvent() {
    if (this.protectResolved || !this.threatenedVillager?.active) {
      return;
    }

    if (!this.protectTriggered) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.threatenedVillager.x,
        this.threatenedVillager.y,
      );
      if (
        shouldTriggerProtectEvent({
          hasThreatenedClue: this.story.hasClue('threatenedVillagers'),
          playerX: this.player.x,
          villagerX: this.threatenedVillager.x,
          playerToVillagerDist: dist,
          protectResolved: this.protectResolved,
        })
      ) {
        this.protectTriggered = true;
        this.enemies.spawnThreat(2300, this.threatenedVillager.x);
        this.hud.showSubtitle('山匪逼近村民，刀光在雨里发寒。');
      }
      return;
    }

    const threat = this.enemies.activeThreat;
    if (!threat) {
      return;
    }

    const outcome = resolveProtectOutcome({
      threatActive: threat.active,
      threatX: threat.x,
      villagerX: this.threatenedVillager.x,
      threatToVillagerDist: Math.abs(threat.x - this.threatenedVillager.x),
    });

    if (outcome === 'success') {
      this.protectResolved = true;
      this.story.recordChoice('protectedVillager');
      this.player.moral.addShouxin(COMBAT_BALANCE.shouxinReward.protectVillager);
      this.hud.showSubtitle('村民望着你收刀，眼里有泪。');
    } else if (outcome === 'failure') {
      this.protectResolved = true;
      this.threatenedVillager.takeDamage();
      this.hud.showSubtitle('你慢了一步，村民倒在血水里。');
    }
  }
```

- [ ] **Step 6: 跑 lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: 全绿（handleProtectEvent 尚未被 GameScene 调用，但不影响编译）

- [ ] **Step 7: 跑全量测试**

Run: `npm test`
Expected: 全绿

- [ ] **Step 8: Commit**

```bash
git add src/game/flow/FlowController.ts
git commit -m "feat(flow): add handleProtectEvent for villager protection event orchestration"
```

---

## Task 10: GameScene 装配 + 威胁者推进

**Files:**
- Modify: `src/game/GameScene.ts`

- [ ] **Step 1: 在 GameScene 加 destructibles 字段**

在 `src/game/GameScene.ts` 的 `private npcs: Npc[] = [];` 字段之后加：

```typescript
  private destructibles: Destructible[] = [];
```

并在顶部 `import type { Npc } from './entities/Npc';` 之后加：

```typescript
import { Destructible } from './entities/Destructible';
```

- [ ] **Step 2: 在 create() 生成 destructibles 并传给 CombatDirector**

在 `create()` 方法中 `this.npcs = this.world.createNpcs();` 之后加：

```typescript
    this.destructibles = this.world.createDestructibles();
```

将 `CombatDirector` 构造调用改为（在 `this.npcs` 之后加 `this.destructibles`）：

```typescript
    this.combatDirector = new CombatDirector(
      this,
      this.player,
      this.enemyDirector,
      this.hud,
      this.sfx,
      this.npcs,
      this.destructibles,
      () => {
        if (!this.flow.endingStarted) {
          this.flow.startEnding();
        }
      },
    );
```

> 若 Task 8 Step 7 用 `[]` 占位，此处替换为 `this.destructibles`。

- [ ] **Step 3: 在 update() 调用 handleProtectEvent**

在 `update()` 方法中 `this.flow.handleStudyGate();` 之后加：

```typescript
    this.flow.handleProtectEvent();
```

- [ ] **Step 4: 在 update() 加威胁者推进（仿 bossStrike 模式）**

在 `update()` 方法中 bossStrike 处理块之后加：

```typescript
    const threat = this.enemyDirector.activeThreat;
    if (threat?.active && !this.flow.protectResolved) {
      threat.update(time, this.flow.threatenedVillagerX);
      const threatStrike = threat.advanceAttack(time, this.flow.threatenedVillagerX);
      if (threatStrike && !this.flow.endingStarted && !this.flow.gameOverStarted) {
        this.combatDirector.applyEnemyStrike(threatStrike, time);
      }
    }
```

- [ ] **Step 5: 跑 lint + typecheck + 全量测试**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 全绿

- [ ] **Step 6: 启动 dev server 做冒烟验证**

Run: `npm run dev`（后台启动，访问 http://127.0.0.1:5173/）
手动验证：
1. 开局走到沉默村民(1990)对话，获第四线索
2. 字幕"山匪逼近村民"出现，bandit 从右侧来
3. 击败 bandit → 字幕"村民望着你收刀" + 守心上涨（刀身偏青白）
4. 狂暴形态（多杀涨戾气）下用技能(I/O)劈向可破坏物 → 物体碎裂 + 戾气上涨 + 字幕"刀气失控"
5. 刀气(U)射向可破坏物 → 碎裂 + 戾气小幅上涨
6. 通关后结局文案含"护住了一个村民"段

- [ ] **Step 7: Commit**

```bash
git add src/game/GameScene.ts
git commit -m "feat(scene): wire destructibles + protect event + threat enemy update into GameScene"
```

---

## Task 11: 文档同步（PROGRESS / PRD / GDD）

**Files:**
- Modify: `docs/PROGRESS.md`
- Modify: `docs/PRD.md`
- Modify: `docs/GDD.md`

- [ ] **Step 1: 更新 docs/PROGRESS.md 里程碑总表**

将里程碑总表中 M6 行改为：

```markdown
| M6 | 保护村民道德事件 + 限场地破坏机制 | ✅ 完成 | `<本任务提交hash>` | 14 |
```

（测试数 = Task1 的 5 + Task2 的 9 + Task3 新增 3 - 移除 1 = 净 +2，加现有 78 → 约 83，按实际 `npm test` 输出填写）

- [ ] **Step 2: 在 PROGRESS.md 加 M6 小节（在 R1 小节之前插入）**

```markdown
## M6 · 保护村民道德事件 + 限场地破坏机制

**目标**：第一章完整化收尾——保护村民道德事件（脚本式触发，击败威胁者得守心+）+ 限场地破坏机制（可破坏环境物体，狂暴大范围招式破坏加戾气硬性惩罚）。

**关键交付**：
- `src/game/entities/destructibleTarget.ts` — `isDestructibleInRange` 纯函数（无 Phaser 依赖，可单测）
- `src/game/entities/Destructible.ts` — 可破坏物实体（物理体+hp+碎裂视觉，4 种程序化纹理）
- `src/game/flow/protectEvent.ts` — `shouldTriggerProtectEvent` / `resolveProtectOutcome` 纯函数（可单测）
- `src/game/world/WorldBuilder.ts` — `createDestructibles()`（7 件可破坏物）+ `createDestructibleTextures()`
- `src/game/director/EnemyDirector.ts` — `spawnThreat()` 脚本生成威胁 bandit + `activeThreat` getter
- `src/game/director/CombatDirector.ts` — 构造加 destructibles；`releaseBladeAura` 路径破坏+目标加威胁者；`executeSkillEffect` 范围破坏；`resolveThreatMeleeHit` 让普攻/技能命中威胁者
- `src/game/flow/FlowController.ts` — `handleProtectEvent` 每帧检测触发与成败 + `protectTriggered`/`protectResolved` 状态 + `threatenedVillagerX` getter
- `src/game/flow/endingMoralSuffix.ts` — 加 `protectedVillager` 文案分支
- `src/game/combat/combatBalance.ts` — 加破坏惩罚/保护奖励数值
- `src/game/GameScene.ts` — 装配 destructibles；update 调用 handleProtectEvent + 威胁者推进

**道德事件数值**：
- 保护村民成功 → 守心 +18（`protectedVillager`）
- 破坏可破坏物（刀气路径）→ 戾气 +5/件
- 破坏可破坏物（技能平衡/守护形态）→ 戾气 +6/件
- 破坏可破坏物（技能狂暴形态）→ 戾气 +8/件 + 字幕警示
- 普攻/游龙回身不破坏（精准斩击不波及环境）

**测试**：
- `tests/destructible-target.test.ts`（5 tests）— 纯函数范围/边界/方向
- `tests/protect-event.test.ts`（9 tests）— 触发条件 + 成败判定
- `tests/ending-moral-suffix.test.ts`（7 tests）— 加 protectedVillager 分支 + 优先级

**设计文档**：
- Spec：[`docs/superpowers/specs/2026-06-21-protect-villager-destructible-design.md`](./superpowers/specs/2026-06-21-protect-villager-destructible-design.md)
- Plan：[`docs/superpowers/plans/2026-06-21-protect-villager-destructible.md`](./superpowers/plans/2026-06-21-protect-villager-destructible.md)

**运行时验证**：playwright 端到端（保护事件触发+击败 bandit+守心上涨、狂暴技能破坏可破坏物+戾气上涨、刀气破坏路径可破坏物、结局文案含保护变体）。
```

- [ ] **Step 3: 更新 PROGRESS.md"当前可玩内容概览"表 + "下一步"小节**

在"当前可玩内容概览"表加两行（在"狂暴误伤 NPC 判定"行之后）：

```markdown
| 保护村民道德事件（脚本式，击败威胁者得守心+） | ✅ | `flow/protectEvent.ts`、`flow/FlowController.ts`、`director/EnemyDirector.ts` |
| 限场地破坏机制（可破坏物 + 狂暴招式破坏加戾气） | ✅ | `entities/Destructible.ts`、`entities/destructibleTarget.ts`、`director/CombatDirector.ts` |
```

将"下一步：M6..."小节标题改为"下一步：第二章·龙刃初鸣"，内容更新为：

```markdown
## 下一步：第二章·龙刃初鸣

**待开发内容**（GDD §6 第二章）：
- 系统化刀法教学（轻/重/闪避/格挡）
- 首次精英战：铁臂罗（重甲+抓投，教学"破防"）
- 戾气值第一次显现：差点误伤无辜路人 + 龙刃首次泛红
- 玄松老人登场阻止，带主角离开
- 新场景：荒废驿站、竹林小道、山神庙、断桥

**前置依赖**：第一章 M0-M6 已完成，第一章成为完整垂直切片。
```

- [ ] **Step 4: 更新 docs/PRD.md 第 14 节"当前实现状态"**

将 PRD.md 第 210 行附近"已落地里程碑"行加 M6：

```markdown
- M0 架构重构 · M1 戾气/守心双值系统 · M2 龙魂/刀气 · M3 龙影九斩前三式 + 技能形态切换 · M4 对话系统 + 村民 NPC + 求饶探子道德事件 · M5 狂暴误伤 NPC 判定 · R1 评审重构（近战命中去重 + 求饶者处置统一为对话） · M6 保护村民道德事件 + 限场地破坏机制
```

将"已实装功能"段落末尾加：

```markdown
、保护村民道德事件（脚本式触发，击败威胁者得守心+）、限场地破坏机制（可破坏环境物体，狂暴大范围招式破坏加戾气硬性惩罚）、结局文案 protectedVillager 变体。
```

将"下一步建议优先级"改为：

```markdown
**下一步建议优先级**：
1. P1 — 第二章·龙刃初鸣（系统化刀法教学、首次精英战铁臂罗、戾气首次显现警示）。
```

- [ ] **Step 5: 更新 docs/GDD.md 附表**

将 GDD.md 末尾附表中两行 ⏳ 改为 ✅：

```markdown
| 保护村民道德事件    | ✅（M6，脚本式触发，击败威胁者得守心+）| `flow/protectEvent.ts`、`flow/FlowController.ts` |
| 限场地破坏机制      | ✅（M6，可破坏物 + 狂暴招式破坏加戾气）| `entities/Destructible.ts`、`director/CombatDirector.ts` |
```

- [ ] **Step 6: 跑全量验证**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 全绿

- [ ] **Step 7: Commit**

```bash
git add docs/PROGRESS.md docs/PRD.md docs/GDD.md
git commit -m "docs: sync PROGRESS/PRD/GDD with M6 completion (protect villager + destructibles)"
```

---

## 完成验证

全部 Task 完成后：

- [ ] **最终验证**：`npm run lint && npm run typecheck && npm test` 三件套全绿
- [ ] **运行时验证**：`npm run dev` 启动，手动/playwright 跑通保护事件 + 破坏机制 + 结局文案变体
- [ ] **提交历史**：11 个 Task 提交 + 1 个 spec 提交，commit message 清晰
