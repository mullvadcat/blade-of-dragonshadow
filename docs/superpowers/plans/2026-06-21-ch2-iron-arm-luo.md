# M7 第二章·龙刃初鸣（破防 + 铁臂罗） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增第二章可玩垂直切片：荒废驿站地图、波次小怪、破防（架势）系统、铁臂罗两阶段 Boss。

**Architecture:** `GameScene.create()` 读取 `data.chapter` 参数，if/else 分支选择 Ch1（现有代码不改）或 Ch2 子系统（`WorldBuilderCh2` / `EnemyDirectorCh2` / `FlowControllerCh2` / `BossIronArmLuo`）。共用 `CombatDirector`（类型参数改为 `IEnemyDirector` 接口），破防逻辑完全封装在 `BossIronArmLuo` 内部，通过 `Strike.isPoiseBreaker` 字段传递破防信号。

**Tech Stack:** Phaser 3.90, TypeScript strict, Vite 6, vitest（纯函数单测）。

---

## 文件清单

| 操作 | 路径 | 职责 |
|------|------|------|
| Create | `src/game/director/IEnemyDirector.ts` | 共享接口（`activeEnemies` / `activeBoss` / `activeThreat`） |
| Modify | `src/game/director/CombatDirector.ts` | 构造参数 `enemies` 类型改为 `IEnemyDirector` |
| Modify | `src/game/combat/CombatSystem.ts` | `Strike` 加 `isPoiseBreaker?: boolean` |
| Modify | `src/game/skills/SkillSystem.ts` | `tryRelease` 对 `scaleBreak` 设 `isPoiseBreaker: true` |
| Modify | `src/game/combat/combatBalance.ts` | 追加 `ch2Boss` 数值常量 |
| Modify | `src/game/art/CharacterArt.ts` | 追加 `'iron-arm'` 与 `'bystander'` 纹理 |
| Create | `src/game/flow/poiseState.ts` | 破防值纯函数 |
| Create | `tests/poise-state.test.ts` | poiseState 单元测试 |
| Create | `src/game/world/WorldBuilderCh2.ts` | Ch2 荒废驿站地图 |
| Create | `src/game/entities/BossIronArmLuo.ts` | 铁臂罗实体（两阶段 AI + 破防） |
| Create | `src/game/director/EnemyDirectorCh2.ts` | Ch2 波次 + Boss 调度 |
| Create | `src/game/flow/FlowControllerCh2.ts` | Ch2 流程控制 |
| Modify | `src/game/GameScene.ts` | chapter 路由 + Ch2 装配 |
| Modify | `docs/PROGRESS.md` | M7 完成记录 |
| Modify | `docs/GDD.md` / `docs/PRD.md` | 里程碑更新 |

---

## Task 1：IEnemyDirector 接口 + CombatDirector 类型参数

**Files:**
- Create: `src/game/director/IEnemyDirector.ts`
- Modify: `src/game/director/CombatDirector.ts`

- [ ] **Step 1: 创建 IEnemyDirector.ts**

```typescript
// src/game/director/IEnemyDirector.ts
import type { Enemy } from '../entities/Enemy';
import type { CombatActor } from '../entities/CombatActor';

export interface IEnemyDirector {
  readonly activeEnemies: readonly Enemy[];
  readonly activeBoss: CombatActor | null;
  readonly activeThreat: Enemy | null;
}
```

- [ ] **Step 2: 修改 CombatDirector.ts 构造参数类型**

找到文件顶部 import 段，添加接口导入，并修改构造参数类型（不改任何逻辑）：

```typescript
// 在现有 import type { EnemyDirector } 行之后，添加：
import type { IEnemyDirector } from './IEnemyDirector';
```

将构造函数参数第 3 个：
```typescript
// 旧
private readonly enemies: EnemyDirector,
// 新
private readonly enemies: IEnemyDirector,
```

同时删除 `import type { EnemyDirector }` 那一行（已不再直接用该类型）。

- [ ] **Step 3: 验证 EnemyDirector 满足接口（结构子类型，无需 implements）**

`EnemyDirector` 已有 `activeEnemies: readonly Enemy[]`、`activeBoss: BossWuzhen | null`（满足 `CombatActor | null`）、`activeThreat: Enemy | null`——TypeScript 结构子类型自动满足。

- [ ] **Step 4: 运行现有测试 + 类型检查**

```bash
cd /Volumes/Macmini/project/game_lzc
npm run typecheck && npm test
```

Expected: 全部通过（绿灯）。

- [ ] **Step 5: 提交**

```bash
git add src/game/director/IEnemyDirector.ts src/game/director/CombatDirector.ts
git commit -m "refactor(combat): extract IEnemyDirector interface for chapter routing"
```

---

## Task 2：Strike.isPoiseBreaker + SkillSystem 标记

**Files:**
- Modify: `src/game/combat/CombatSystem.ts`
- Modify: `src/game/skills/SkillSystem.ts`

- [ ] **Step 1: CombatSystem.ts 的 Strike 类型追加字段**

找到 `export type Strike = {` 块，在 `staggerDuration: number;` 后添加一行：

```typescript
export type Strike = {
  damage: number;
  guardDamage: number;
  staminaDamage: number;
  blockDamageMultiplier: number;
  staggerDuration: number;
  isPoiseBreaker?: boolean; // 仅裂鳞破甲设为 true，BossIronArmLuo 内部消费
};
```

- [ ] **Step 2: SkillSystem.ts tryRelease 中对 scaleBreak 设标记**

找到 `return {` 块（约第 101 行），在 `strike,` 字段后，将 `strike` 对象根据 skillId 附加 `isPoiseBreaker`：

```typescript
// 在 const strike: Strike = { ... } 之后，添加：
if (id === 'scaleBreak') {
  strike.isPoiseBreaker = true;
}
```

具体插入位置在 `this.recordCast(id, now);` 后，`const form = ...` 之后，`const strike: Strike = { ... };` 之后，`return {` 之前。

- [ ] **Step 3: 运行测试 + 类型检查**

```bash
npm run typecheck && npm test
```

Expected: 全部通过。

- [ ] **Step 4: 提交**

```bash
git add src/game/combat/CombatSystem.ts src/game/skills/SkillSystem.ts
git commit -m "feat(combat): add Strike.isPoiseBreaker, mark scaleBreak skill"
```

---

## Task 3：poiseState.ts 纯函数（TDD）

**Files:**
- Create: `src/game/flow/poiseState.ts`
- Create: `tests/poise-state.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/poise-state.test.ts
import { describe, expect, it } from 'vitest';
import {
  createPoise,
  takePoiseDamage,
  resetPoise,
  isPoiseBreaking,
  isStaggering,
  type PoiseState,
} from '../src/game/flow/poiseState';

describe('createPoise', () => {
  it('初始化时 current === max，brokenAt === 0', () => {
    const state = createPoise(100);
    expect(state.current).toBe(100);
    expect(state.max).toBe(100);
    expect(state.brokenAt).toBe(0);
    expect(state.staggerDuration).toBe(1500);
  });
});

describe('takePoiseDamage', () => {
  it('减少 current 值', () => {
    const state = createPoise(100);
    const next = takePoiseDamage(state, 40);
    expect(next.current).toBe(60);
  });

  it('累积减少：两次 40 → current 为 20', () => {
    const state = takePoiseDamage(takePoiseDamage(createPoise(100), 40), 40);
    expect(state.current).toBe(20);
  });

  it('不低于 0', () => {
    const state = takePoiseDamage(createPoise(100), 999);
    expect(state.current).toBe(0);
  });

  it('不改变 max', () => {
    const state = takePoiseDamage(createPoise(100), 40);
    expect(state.max).toBe(100);
  });
});

describe('isPoiseBreaking', () => {
  it('current > 0 时为 false', () => {
    expect(isPoiseBreaking(createPoise(100))).toBe(false);
  });

  it('current === 0 时为 true', () => {
    expect(isPoiseBreaking(takePoiseDamage(createPoise(100), 100))).toBe(true);
  });
});

describe('isStaggering', () => {
  it('brokenAt === 0 时为 false（未破防）', () => {
    const state: PoiseState = { current: 0, max: 100, brokenAt: 0, staggerDuration: 1500 };
    expect(isStaggering(state, 500)).toBe(false);
  });

  it('brokenAt > 0 且 now 在硬直窗口内为 true', () => {
    const state: PoiseState = { current: 0, max: 100, brokenAt: 1000, staggerDuration: 1500 };
    expect(isStaggering(state, 1500)).toBe(true);
  });

  it('硬直结束后（now >= brokenAt + staggerDuration）为 false', () => {
    const state: PoiseState = { current: 0, max: 100, brokenAt: 1000, staggerDuration: 1500 };
    expect(isStaggering(state, 2500)).toBe(false);
  });
});

describe('resetPoise', () => {
  it('重置 current 为 max，清除 brokenAt', () => {
    const broken: PoiseState = { current: 0, max: 100, brokenAt: 1000, staggerDuration: 1500 };
    const reset = resetPoise(broken);
    expect(reset.current).toBe(100);
    expect(reset.brokenAt).toBe(0);
    expect(reset.max).toBe(100);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npm test -- poise-state
```

Expected: FAIL（`poiseState` 模块不存在）。

- [ ] **Step 3: 实现 poiseState.ts**

```typescript
// src/game/flow/poiseState.ts
export type PoiseState = {
  readonly current: number;
  readonly max: number;
  readonly brokenAt: number;
  readonly staggerDuration: number;
};

export function createPoise(max: number): PoiseState {
  return { current: max, max, brokenAt: 0, staggerDuration: 1500 };
}

export function takePoiseDamage(state: PoiseState, amount: number): PoiseState {
  return { ...state, current: Math.max(0, state.current - amount) };
}

export function resetPoise(state: PoiseState): PoiseState {
  return { ...state, current: state.max, brokenAt: 0 };
}

export function isPoiseBreaking(state: PoiseState): boolean {
  return state.current <= 0;
}

export function isStaggering(state: PoiseState, now: number): boolean {
  return state.brokenAt > 0 && now < state.brokenAt + state.staggerDuration;
}
```

- [ ] **Step 4: 运行测试，确认全部通过**

```bash
npm test -- poise-state
```

Expected: 8 tests passed.

- [ ] **Step 5: 类型检查 + 提交**

```bash
npm run typecheck && git add src/game/flow/poiseState.ts tests/poise-state.test.ts
git commit -m "feat(poise): add poiseState pure functions with unit tests (TDD)"
```

---

## Task 4：combatBalance.ts 追加 ch2Boss 常量

**Files:**
- Modify: `src/game/combat/combatBalance.ts`

- [ ] **Step 1: 在 COMBAT_BALANCE 尾部追加 ch2Boss 块**

在 `} as const;` 之前，添加：

```typescript
  ch2Boss: {
    hp: 300,
    poiseMax: 100,
    poiseDamageBreak: 40,
    guardDamageReduction: 0.70,
    staggerDuration: 1500,
    phaseThreshold: 0.40,
    heavyPunchDamage: 30,
    heavyPunchGuardDamage: 36,
    grabDamage: 24,
    grabGuardDamage: 40,
    rushPunchDamage: 22,
    rushPunchGuardDamage: 26,
  },
```

- [ ] **Step 2: 运行类型检查**

```bash
npm run typecheck
```

Expected: 通过。

- [ ] **Step 3: 提交**

```bash
git add src/game/combat/combatBalance.ts
git commit -m "feat(balance): add ch2Boss combat constants"
```

---

## Task 5：CharacterArt + WorldBuilderCh2

**Files:**
- Modify: `src/game/art/CharacterArt.ts`
- Create: `src/game/world/WorldBuilderCh2.ts`

- [ ] **Step 1: CharacterArt.ts 追加 iron-arm 与 bystander 类型**

在 `CharacterArtKey` 类型后追加（union 扩展）：

```typescript
// 旧
export type CharacterArtKey = 'player' | 'scout' | 'bandit' | 'wuzhen' | 'villager';
// 新
export type CharacterArtKey = 'player' | 'scout' | 'bandit' | 'wuzhen' | 'villager' | 'iron-arm' | 'bystander';
```

在 `CHARACTER_ART_SPECS` 对象中追加（villager 之后）：

```typescript
  'iron-arm': {
    textureKey: 'boss-iron-arm',
    width: 88,
    height: 108,
    transparentBackground: true,
    features: ['burly frame', 'iron right arm guard', 'bare left arm', 'grey heavy robe'],
  },
  bystander: {
    textureKey: 'npc-bystander',
    width: 58,
    height: 80,
    transparentBackground: true,
    features: ['brown robe', 'no hat', 'hunched posture'],
  },
```

在 `createCharacterTextures` 函数末尾追加调用：

```typescript
export const createCharacterTextures = (scene: Phaser.Scene) => {
  createPlayerTexture(scene);
  createScoutTexture(scene);
  createBanditTexture(scene);
  createWuzhenTexture(scene);
  createVillagerTexture(scene);
  createIronArmTexture(scene);    // 新增
  createBystanderTexture(scene);  // 新增
};
```

在文件末尾添加两个纹理生成函数：

```typescript
const createIronArmTexture = (scene: Phaser.Scene) => {
  const gfx = makeGraphics(scene);
  // 身体（暗灰宽体）
  drawPixelRect(gfx, 22, 30, 44, 52, 0x2a2830);
  // 头部
  drawPixelRect(gfx, 28, 12, 32, 22, 0xb07040);
  // 右臂铁甲（金棕色厚实）
  drawPixelRect(gfx, 60, 32, 20, 42, 0x7a6030);
  drawPixelRect(gfx, 58, 28, 22, 8, 0x8a7040);
  drawPixelRect(gfx, 62, 70, 18, 8, 0x5a4820);
  // 左臂（裸臂棕色）
  drawPixelRect(gfx, 8, 34, 16, 38, 0xb07040);
  // 下半身
  drawPixelRect(gfx, 24, 80, 40, 22, 0x1e1c24);
  // 腿
  drawPixelRect(gfx, 26, 98, 14, 10, 0x18161e);
  drawPixelRect(gfx, 48, 98, 14, 10, 0x18161e);
  gfx.generateTexture('boss-iron-arm', 88, 108);
  gfx.destroy();
};

const createBystanderTexture = (scene: Phaser.Scene) => {
  const gfx = makeGraphics(scene);
  drawPixelRect(gfx, 18, 14, 22, 18, 0xc89060);
  drawPixelRect(gfx, 15, 32, 28, 32, 0x6a5030);
  drawPixelRect(gfx, 12, 38, 10, 28, 0x5a4028);
  drawPixelRect(gfx, 36, 38, 10, 28, 0x5a4028);
  drawPixelRect(gfx, 20, 62, 10, 16, 0x3a2c1c);
  drawPixelRect(gfx, 32, 62, 10, 16, 0x3a2c1c);
  gfx.generateTexture('npc-bystander', 58, 80);
  gfx.destroy();
};
```

- [ ] **Step 2: 创建 WorldBuilderCh2.ts**

```typescript
// src/game/world/WorldBuilderCh2.ts
import Phaser from 'phaser';
import { createCharacterTextures } from '../art/CharacterArt';
import { Npc } from '../entities/Npc';

/**
 * 构建第二章世界：荒废驿站。3200×720 地图，黄昏竹林 + 破败建筑美术风格。
 * 无调查点、无可破坏物；含 2 名旁观村夫 NPC（有环境对话，无道德事件）。
 */
export class WorldBuilderCh2 {
  private ground!: Phaser.Physics.Arcade.StaticGroup;

  constructor(private readonly scene: Phaser.Scene) {}

  /** 生成 Ch2 所需程序化纹理（在 create() 早期调用）。 */
  createGeneratedTextures() {
    const createRect = (key: string, w: number, h: number, color: number) => {
      const gfx = this.scene.make.graphics({ x: 0, y: 0 }, false);
      gfx.fillStyle(color, 1);
      gfx.fillRect(0, 0, w, h);
      gfx.generateTexture(key, w, h);
      gfx.destroy();
    };
    createCharacterTextures(this.scene);
    createRect('ground-ch2', 96, 28, 0x2a2018);
    createRect('blade', 72, 8, 0xaaf7ff); // 刀气纹理（可能已存在，生成幂等）
    createRect('paper', 28, 28, 0xd2b777);
  }

  /** 绘制背景、竹影、月光等背景层。 */
  drawWorld() {
    const scene = this.scene;
    scene.physics.world.setBounds(0, 0, 3200, 720);
    scene.cameras.main.setBounds(0, 0, 3200, 720);

    // 深灰蓝天空
    scene.add.rectangle(1600, 360, 3200, 720, 0x1a1f2e).setDepth(0);

    // 竹影剪影（简单竖条，分批随机散布）
    const bambooXs = [80, 200, 340, 510, 660, 800, 920, 1060, 2700, 2820, 2950, 3100];
    for (const bx of bambooXs) {
      scene.add.rectangle(bx, 280, 8, 460, 0x0d1208, 0.7).setDepth(1);
      scene.add.rectangle(bx + 18, 300, 6, 420, 0x0d1208, 0.5).setDepth(1);
    }

    // 月光打光效果（半透明白色矩形，右上方）
    scene.add
      .rectangle(2800, 80, 600, 300, 0xfff8e0, 0.04)
      .setDepth(2);

    // 驿站建筑轮廓（区域标识，简单深色矩形）
    scene.add.rectangle(1200, 450, 640, 320, 0x16120e, 0.9).setDepth(1); // 庭院主楼
    scene.add.rectangle(1800, 470, 480, 280, 0x12100c, 0.9).setDepth(1); // 副楼

    // 地面（暗棕）
    scene.add.rectangle(1600, 658, 3200, 100, 0x3d2b1f).setDepth(3);
  }

  /** 铺设地面与平台，返回 StaticGroup。 */
  buildPlatforms(): Phaser.Physics.Arcade.StaticGroup {
    const ground = this.scene.physics.add.staticGroup();

    // 地面层（全段，每块 96px）
    for (let x = 48; x < 3200; x += 96) {
      ground.create(x, 614, 'ground-ch2');
    }

    // 二层平台（驿站庭院，弩手站位）
    for (let x = 998; x <= 1350; x += 96) {
      ground.create(x, 394, 'ground-ch2');
    }

    // 残破墙台
    for (let x = 1648; x <= 1800; x += 96) {
      ground.create(x, 444, 'ground-ch2');
    }

    this.ground = ground;
    return ground;
  }

  /** 创建 2 名旁观村夫 NPC（环境对话，无道德绑定）。 */
  createNpcs(): Npc[] {
    const npcs: Npc[] = [];
    const specs: Array<[number, string]> = [
      [2200, 'bystander'],
      [2350, 'bystander'],
    ];
    for (const [x, dialogId] of specs) {
      const npc = new Npc(this.scene, x, 580, 'npc-bystander', dialogId);
      this.scene.physics.add.collider(npc, this.ground);
      npcs.push(npc);
    }
    return npcs;
  }
}
```

- [ ] **Step 3: 运行类型检查**

```bash
npm run typecheck
```

Expected: 通过。

- [ ] **Step 4: 提交**

```bash
git add src/game/art/CharacterArt.ts src/game/world/WorldBuilderCh2.ts
git commit -m "feat(ch2): add CharacterArt textures and WorldBuilderCh2 relay-station map"
```

---

## Task 6：BossIronArmLuo 实体

**Files:**
- Create: `src/game/entities/BossIronArmLuo.ts`

> **说明：** 破防条（poise bar）作为 Boss 自有 UI 对象（`Phaser.GameObjects.Graphics`），
> 在 `update()` 中与 `followUi()` 一同更新位置。不放入 Hud（遵循 CombatActor 的血条模式）。

- [ ] **Step 1: 创建 BossIronArmLuo.ts**

```typescript
// src/game/entities/BossIronArmLuo.ts
import Phaser from 'phaser';
import { CombatSystem, type Strike } from '../combat/CombatSystem';
import { CombatActor } from './CombatActor';
import { COMBAT_BALANCE } from '../combat/combatBalance';
import {
  createPoise,
  takePoiseDamage,
  resetPoise,
  isPoiseBreaking,
  isStaggering,
  type PoiseState,
} from '../flow/poiseState';
import type { SfxName } from '../audio/AudioDirector';

type Phase2AiState = 'rage_idle' | 'rush_windup' | 'grab_windup';

/**
 * 铁臂罗：第二章 Boss。
 *
 * Phase 1（HP > 40%）：铁臂格挡 + 重拳。只有裂鳞破甲（isPoiseBreaker）能积累破防值；
 * 破防值归零触发硬直1500ms，期间受伤翻倍、护甲失效。硬直结束后破防重置、护甲恢复。
 *
 * Phase 2（HP ≤ 40%，不可逆）：移除护甲，改用冲拳（400ms前摇）与抓投（600ms前摇）。
 */
export class BossIronArmLuo extends CombatActor {
  private phase: 1 | 2 = 1;
  private isGuarding = true;
  private poise: PoiseState;
  private phase2State: Phase2AiState = 'rage_idle';
  private phase2WindupUntil = 0;
  private phase2NextAttackAt = 0;
  private readonly poiseBar: Phaser.GameObjects.Graphics;
  private readonly poiseBarBg: Phaser.GameObjects.Graphics;
  /** 破防条相对 Boss 位置（x 偏移为 -78，y 偏移为 -60）。 */
  private readonly POISE_BAR_W = 156;
  private readonly POISE_BAR_H = 5;

  constructor(scene: Phaser.Scene, x: number, y: number, playSfx?: (name: SfxName) => void) {
    const bal = COMBAT_BALANCE.ch2Boss;
    super(scene, x, y, {
      texture: 'boss-iron-arm',
      combatState: {
        health: bal.hp,
        maxHealth: bal.hp,
        guard: 0,
        maxGuard: 0,
        stamina: 100,
        maxStamina: 100,
        soul: 0,
        maxSoul: 0,
        isBlocking: false,
        perfectGuardUntil: 0,
        invulnerableUntil: 0,
        staggeredUntil: 0,
      },
      bodySize: [52, 80],
      depth: 11,
      attackRange: 160,
      hitTint: 0xff8030,
      hitFlashMs: 100,
      telegraphColor: 0xff6600,
      strikeColor: 0xff4400,
      defeatSfx: 'bossDown',
      playSfx,
      nameplate: {
        text: '铁臂罗',
        style: {
          color: '#f5c518',
          fontFamily: 'serif',
          fontSize: '18px',
          stroke: '#2a1800',
          strokeThickness: 4,
        },
        offsetY: -80,
      },
      healthBar: {
        width: 156,
        height: 8,
        fillColor: 0xd27020,
        lowColor: 0xff4400,
        borderColor: 0x2a1800,
        depth: 22,
        offsetX: -78,
        offsetY: -62,
      },
    });

    this.poise = createPoise(bal.poiseMax);

    // 破防条背景（深色）
    this.poiseBarBg = scene.add.graphics().setDepth(22);
    // 破防条前景（金色）
    this.poiseBar = scene.add.graphics().setDepth(23);
    this.updatePoiseBarGfx(0);
  }

  update(time: number, playerX: number) {
    if (!this.active) {
      return;
    }

    // Phase 转换（不可逆）
    if (
      this.phase === 1 &&
      this.combatState.health <= this.combatState.maxHealth * COMBAT_BALANCE.ch2Boss.phaseThreshold
    ) {
      this.enterPhase2();
    }

    // 硬直恢复后重置破防（Phase 1 only）
    if (
      this.phase === 1 &&
      this.poise.brokenAt > 0 &&
      !isStaggering(this.poise, time)
    ) {
      this.poise = resetPoise(this.poise);
      this.isGuarding = true;
      this.clearTint();
    }

    // 移动
    const speed = this.phase === 2 ? 110 : 80;
    this.chase(time, playerX, speed, 74, 460);

    // 视觉：护甲态金色 tint（非硬直时）
    if (this.phase === 1 && this.isGuarding) {
      this.setTint(0xd4a020);
    } else if (this.phase === 2) {
      this.setTint(0xff5500);
    }

    this.followUi();
    this.updatePoiseBarGfx(time);
  }

  /** 覆写父类出招：Phase 1 使用父类重拳机制；Phase 2 使用自定义 AI。 */
  override advanceAttack(time: number, playerX: number): Strike | null {
    if (!this.active) {
      return null;
    }
    if (this.phase === 1) {
      // 硬直中不出招（父类已处理）
      return super.advanceAttack(time, playerX);
    }
    return this.advancePhase2Attack(time, playerX);
  }

  /** 覆写受击：护甲态普攻减免，破防攻击积累 poise；Phase 2 全伤。 */
  override receiveStrike(strike: Strike, time: number) {
    const effective = this.adjustStrikeForGuard(strike, time);
    const result = super.receiveStrike(effective, time);
    this.checkPhaseTransition();
    return result;
  }

  // ---------- 父类抽象方法实现 ----------

  protected buildStrike(): Strike {
    const bal = COMBAT_BALANCE.ch2Boss;
    return {
      damage: bal.heavyPunchDamage,
      guardDamage: bal.heavyPunchGuardDamage,
      staminaDamage: 8,
      blockDamageMultiplier: 0.45,
      staggerDuration: 280,
    };
  }

  protected attackInterval(): number {
    return 2800;
  }

  protected telegraphMs(): number {
    return 800;
  }

  // ---------- 私有方法 ----------

  private adjustStrikeForGuard(strike: Strike, time: number): Strike {
    if (this.phase !== 1 || !this.isGuarding) {
      // Phase 2 或硬直中：全伤（硬直中伤害 ×2 由调用方/balance 控制，这里简单返回原始）
      return strike;
    }
    if (strike.isPoiseBreaker) {
      this.poise = takePoiseDamage(this.poise, COMBAT_BALANCE.ch2Boss.poiseDamageBreak);
      if (isPoiseBreaking(this.poise)) {
        this.poise = { ...this.poise, brokenAt: time };
        this.isGuarding = false;
        // 用 combatState.staggeredUntil 驱动父类硬直（停步、取消前摇）
        this.combatState.staggeredUntil = time + COMBAT_BALANCE.ch2Boss.staggerDuration;
      }
      // 破防攻击：归零 HP 伤害（仅伤 poise）
      return { ...strike, damage: 0, guardDamage: 0, staggerDuration: 0 };
    }
    // 普通攻击：减免 70%
    const reduction = COMBAT_BALANCE.ch2Boss.guardDamageReduction;
    return {
      ...strike,
      damage: Math.round(strike.damage * (1 - reduction)),
      staggerDuration: 0, // 护甲态不被打断
    };
  }

  private checkPhaseTransition() {
    if (
      this.phase === 1 &&
      this.combatState.health <= this.combatState.maxHealth * COMBAT_BALANCE.ch2Boss.phaseThreshold &&
      this.combatState.health > 0
    ) {
      this.enterPhase2();
    }
  }

  private enterPhase2() {
    this.phase = 2;
    this.isGuarding = false;
    this.poiseBar.setVisible(false);
    this.poiseBarBg.setVisible(false);
  }

  private advancePhase2Attack(time: number, playerX: number): Strike | null {
    const dist = Math.abs(playerX - this.x);
    const bal = COMBAT_BALANCE.ch2Boss;

    // 正在前摇中
    if (this.phase2WindupUntil > 0) {
      if (time < this.phase2WindupUntil) {
        return null;
      }
      // 前摇结束，落招
      const state = this.phase2State;
      this.phase2WindupUntil = 0;
      this.phase2State = 'rage_idle';
      this.phase2NextAttackAt = time + 2000;

      if (state === 'grab_windup') {
        return {
          damage: bal.grabDamage,
          guardDamage: bal.grabGuardDamage,
          staminaDamage: 16,
          blockDamageMultiplier: 0.6,
          staggerDuration: 400,
        };
      }
      // rush_windup
      return {
        damage: bal.rushPunchDamage,
        guardDamage: bal.rushPunchGuardDamage,
        staminaDamage: 10,
        blockDamageMultiplier: 0.4,
        staggerDuration: 260,
      };
    }

    if (time < this.phase2NextAttackAt) {
      return null;
    }

    // 选择攻击：极近距抓投，近距冲拳
    if (dist < 80 && this.phase2State === 'rage_idle') {
      this.phase2State = 'grab_windup';
      this.phase2WindupUntil = time + 600;
      this.playSfx('enemyAttack');
    } else if (dist < 160 && this.phase2State === 'rage_idle') {
      this.phase2State = 'rush_windup';
      this.phase2WindupUntil = time + 400;
      this.playSfx('enemyAttack');
    }

    return null;
  }

  private updatePoiseBarGfx(now: number) {
    if (this.phase !== 1) {
      return;
    }
    const barX = this.x - 78;
    const barY = this.y - 72;
    const ratio = this.poise.current / this.poise.max;
    const staggering = isStaggering(this.poise, now);

    this.poiseBarBg.clear();
    this.poiseBarBg
      .fillStyle(0x2a1800, 0.8)
      .fillRect(barX - 1, barY - 1, this.POISE_BAR_W + 2, this.POISE_BAR_H + 2);

    this.poiseBar.clear();
    if (ratio > 0) {
      const color = staggering ? 0xffffff : 0xf5c518;
      const alpha = staggering ? (Math.floor(now / 200) % 2 === 0 ? 0.4 : 1.0) : 1.0;
      this.poiseBar
        .fillStyle(color, alpha)
        .fillRect(barX, barY, Math.round(this.POISE_BAR_W * ratio), this.POISE_BAR_H);
    }
  }

  protected override onDefeat() {
    this.poiseBar.destroy();
    this.poiseBarBg.destroy();
  }
}
```

- [ ] **Step 2: 运行类型检查**

```bash
npm run typecheck
```

Expected: 通过。

- [ ] **Step 3: 提交**

```bash
git add src/game/entities/BossIronArmLuo.ts
git commit -m "feat(entities): add BossIronArmLuo two-phase boss with poise/guard system"
```

---

## Task 7：EnemyDirectorCh2

**Files:**
- Create: `src/game/director/EnemyDirectorCh2.ts`

- [ ] **Step 1: 创建 EnemyDirectorCh2.ts**

```typescript
// src/game/director/EnemyDirectorCh2.ts
import type Phaser from 'phaser';
import { Enemy, type EnemyKind } from '../entities/Enemy';
import { BossIronArmLuo } from '../entities/BossIronArmLuo';
import type { CombatActor } from '../entities/CombatActor';
import type { Strike } from '../combat/CombatSystem';
import type { IEnemyDirector } from './IEnemyDirector';
import type { SfxName } from '../audio/AudioDirector';

/**
 * 第二章敌人调度：管理波次小怪与铁臂罗 Boss。
 * 实现 IEnemyDirector 接口，供 CombatDirector 使用。
 */
export class EnemyDirectorCh2 implements IEnemyDirector {
  private readonly _enemies: Enemy[] = [];
  private boss: BossIronArmLuo | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly ground: Phaser.Physics.Arcade.StaticGroup,
    private readonly sfx: (name: SfxName) => void,
  ) {}

  get activeEnemies(): readonly Enemy[] {
    return this._enemies;
  }

  get activeBoss(): CombatActor | null {
    return this.boss;
  }

  get activeThreat(): Enemy | null {
    return null; // Ch2 无保护事件
  }

  get activeBossIronArm(): BossIronArmLuo | null {
    return this.boss;
  }

  /** 第一波：入口竹林区 2 名匪兵。 */
  spawnWave1() {
    this.spawnEnemies([[500, 'bandit'], [620, 'bandit']]);
  }

  /** 第二波：驿站二号战斗区 2 名匪兵 + 1 名弩手（作普通匪兵处理）。 */
  spawnWave2() {
    this.spawnEnemies([[1620, 'bandit'], [1800, 'bandit'], [2020, 'scout']]);
  }

  /** 在 Boss 场地生成铁臂罗。 */
  spawnBoss() {
    this.boss = new BossIronArmLuo(this.scene, 2900, 580, this.sfx);
    this.scene.physics.add.collider(this.boss, this.ground);
  }

  /** 推进所有存活小怪，返回本帧落招的 Strike 列表。 */
  advanceEnemies(time: number, playerX: number): Strike[] {
    const strikes: Strike[] = [];
    for (const enemy of this._enemies) {
      if (!enemy.active) {
        continue;
      }
      enemy.update(time, playerX);
      const strike = enemy.advanceAttack(time, playerX);
      if (strike) {
        strikes.push(strike);
      }
    }
    return strikes;
  }

  /** 推进铁臂罗 Boss，返回本帧落招的 Strike（无则 null）。 */
  advanceBoss(time: number, playerX: number): Strike | null {
    if (!this.boss?.active) {
      return null;
    }
    this.boss.update(time, playerX);
    return this.boss.advanceAttack(time, playerX);
  }

  /** 判断玩家附近是否有存活敌人（供音频模式切换使用）。 */
  hasEnemyNearby(playerX: number, playerY: number, radiusX = 420, radiusY = 140): boolean {
    const hasEnemy = this._enemies.some(
      (e) =>
        e.active &&
        Math.abs(e.x - playerX) < radiusX &&
        Math.abs(e.y - playerY) < radiusY,
    );
    const hasBoss = !!(this.boss?.active && Math.abs(this.boss.x - playerX) < radiusX);
    return hasEnemy || hasBoss;
  }

  private spawnEnemies(specs: Array<[number, EnemyKind]>) {
    for (const [x, kind] of specs) {
      const enemy = new Enemy(this.scene, x, 580, kind, this.sfx);
      this._enemies.push(enemy);
      this.scene.physics.add.collider(enemy, this.ground);
    }
  }
}
```

- [ ] **Step 2: 运行类型检查**

```bash
npm run typecheck
```

Expected: 通过。

- [ ] **Step 3: 提交**

```bash
git add src/game/director/EnemyDirectorCh2.ts
git commit -m "feat(director): add EnemyDirectorCh2 for wave management and BossIronArmLuo dispatch"
```

---

## Task 8：FlowControllerCh2

**Files:**
- Create: `src/game/flow/FlowControllerCh2.ts`

- [ ] **Step 1: 创建 FlowControllerCh2.ts**

```typescript
// src/game/flow/FlowControllerCh2.ts
import Phaser from 'phaser';
import type { EnemyDirectorCh2 } from '../director/EnemyDirectorCh2';
import type { SfxName } from '../audio/AudioDirector';

/**
 * 第二章流程控制：按玩家 X 轴位置触发波次，Boss 击败后播放胜利演出并重开。
 * 无调查解谜、无保护事件——纯战斗推进。
 */
export class FlowControllerCh2 {
  private wave1Spawned = false;
  private wave2Spawned = false;
  private bossSpawned = false;
  /** 公开字段：GameScene 每帧读取，用于跳过 Boss 推进。 */
  bossDefeated = false;
  private endStarted = false;

  constructor(
    private readonly enemies: EnemyDirectorCh2,
    private readonly scene: Phaser.Scene,
    private readonly sfx: (name: SfxName) => void,
  ) {}

  /** 每帧调用：根据玩家位置生成波次与 Boss。 */
  handleWaveProgression(playerX: number) {
    if (!this.wave1Spawned && playerX > 400) {
      this.enemies.spawnWave1();
      this.wave1Spawned = true;
    }
    if (!this.wave2Spawned && playerX > 1500) {
      this.enemies.spawnWave2();
      this.wave2Spawned = true;
    }
    if (!this.bossSpawned && playerX > 2600) {
      this.enemies.spawnBoss();
      this.bossSpawned = true;
    }
    if (this.bossSpawned && !this.bossDefeated) {
      const boss = this.enemies.activeBossIronArm;
      if (boss && !boss.active) {
        this.bossDefeated = true;
      }
    }
  }

  /** 每帧调用：Boss 被击败后启动胜利演出，最终 restart 场景。 */
  handleChapterEnd() {
    if (!this.bossDefeated || this.endStarted) {
      return;
    }
    this.endStarted = true;
    this.sfx('bossDown');

    this.scene.time.delayedCall(1200, () => {
      this.scene.cameras.main.fadeOut(800, 0, 0, 0);
      this.scene.cameras.main.once(
        Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
        () => {
          this.showEndingText();
        },
      );
    });
  }

  private showEndingText() {
    const cam = this.scene.cameras.main;
    this.scene.add
      .text(cam.scrollX + 640, cam.scrollY + 300, '铁臂罗，授首。', {
        color: '#f5c518',
        fontFamily: 'serif',
        fontSize: '36px',
        stroke: '#000000',
        strokeThickness: 6,
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(200);

    this.scene.add
      .text(cam.scrollX + 640, cam.scrollY + 360, '然而黑鳞会的影子，比预想的更深……', {
        color: '#d0c0a0',
        fontFamily: 'serif',
        fontSize: '22px',
        stroke: '#000000',
        strokeThickness: 5,
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(200);

    this.scene.time.delayedCall(4000, () => {
      this.scene.scene.restart({ chapter: 1 });
    });
  }
}
```

- [ ] **Step 2: 运行类型检查**

```bash
npm run typecheck
```

Expected: 通过。

- [ ] **Step 3: 提交**

```bash
git add src/game/flow/FlowControllerCh2.ts
git commit -m "feat(flow): add FlowControllerCh2 wave progression and chapter end sequence"
```

---

## Task 9：GameScene 章节路由装配

**Files:**
- Modify: `src/game/GameScene.ts`

- [ ] **Step 1: 添加 import**

在现有 import 段末尾追加：

```typescript
import { WorldBuilderCh2 } from './world/WorldBuilderCh2';
import { EnemyDirectorCh2 } from './director/EnemyDirectorCh2';
import { FlowControllerCh2 } from './flow/FlowControllerCh2';
```

- [ ] **Step 2: 添加 Ch2 字段**

在现有 `private destructibles: Destructible[] = [];` 后追加：

```typescript
private chapter: 1 | 2 = 1;
private enemyDirectorCh2: EnemyDirectorCh2 | null = null;
private flowCh2: FlowControllerCh2 | null = null;
```

- [ ] **Step 3: 修改 create() — 顶部读取 chapter，Ch2 分支装配**

在 `create()` 开头，`this.resetRunState();` 之后，`this.physics.world.setBounds` 之前，插入：

```typescript
this.chapter = ((this.scene.settings.data as Record<string, unknown>)?.chapter as 1 | 2) ?? 1;
```

然后将现有 `create()` 的主体（`this.physics.world.setBounds` 开始，到 `this.add.text(22, 708, ...)` 结束）用 if/else 包裹：

```typescript
if (this.chapter === 2) {
  // ── Ch2 装配 ──
  const wbCh2 = new WorldBuilderCh2(this);
  wbCh2.createGeneratedTextures();
  wbCh2.drawWorld();
  const groundCh2 = wbCh2.buildPlatforms();
  this.npcs = wbCh2.createNpcs();
  this.destructibles = [];

  this.player = new Player(this, 130, 540, this.sfx);
  this.cursors = this.input.keyboard!.createCursorKeys();
  this.physics.add.collider(this.player, groundCh2);
  this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
  this.cameras.main.setDeadzone(260, 120);

  this.enemyDirectorCh2 = new EnemyDirectorCh2(this, groundCh2, this.sfx);
  this.hud = new Hud(this);

  const dialogContextCh2: DialogContext = {
    moral: this.player.moral,
    story: this.story,
    surrenderEnemy: null,
    rewardSoul: (amount) => this.player.machine.addSoul(amount),
  };
  this.dialogSystem = new DialogSystem(dialogContextCh2);
  this.dialogUi = new DialogUi(this, this.dialogSystem);

  this.flowCh2 = new FlowControllerCh2(this.enemyDirectorCh2, this, this.sfx);

  this.combatDirector = new CombatDirector(
    this,
    this.player,
    this.enemyDirectorCh2,
    this.hud,
    this.sfx,
    this.npcs,
    [],
    () => { /* Boss 死亡由 FlowControllerCh2 检测 */ },
  );

  this.audioController = new AudioController(
    this, this.audioDirector, this.hud, this.player, this.enemyDirectorCh2, null as unknown as FlowController,
  );
  this.audioController.bindWakeInput();

  this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.audioDirector.stop());
  this.hud.setAudioStatus(this.audioDirector.isStarted, this.audioDirector.isMuted);
  this.hud.showSubtitle('荒废驿站的黄昏。黑鳞会的人马不知去向——只有铁臂罗守在正堂。');

  this.add
    .text(22, 690, '移动WASD 闪避Space 轻斩J 重斩K 格挡L 刀气U 潜龙I 裂鳞O', {
      color: '#8fa9b0', fontFamily: 'serif', fontSize: '14px',
    })
    .setScrollFactor(0).setDepth(100);

} else {
  // ── Ch1 装配（原始代码，一字不改） ──
  this.physics.world.setBounds(0, 0, 4400, 720);
  // ... 以下保留全部现有 Ch1 装配代码 ...
}
```

> **注意：** Ch1 分支中的现有代码**原封不动**移入 else 块，包括 `this.physics.world.setBounds(0, 0, 4400, 720)` 到末尾的 `this.add.text(22, 708, ...)` 全段。

- [ ] **Step 4: 修改 update() — chapter 分支**

在现有 `update(time: number)` 开头，`if (this.dialogSystem.isActive)` 之前，插入章节分支：

```typescript
update(time: number) {
  if (this.dialogSystem.isActive) {
    this.flow?.handleDialogInput();
    this.dialogUi.update();
    return;
  }

  this.player.update(time, this.cursors);
  this.hud.update(this.player, this.story, time, this.combatDirector.skillState);
  this.audioController.update();

  if (this.player.machine.isDead()) {
    if (this.chapter === 2) {
      // Ch2：简单重开
      if (!this.flowCh2?.bossDefeated) {
        this.scene.restart({ chapter: 2 });
      }
    } else {
      this.flow.handleGameOverInput();
      if (!this.flow.gameOverStarted && !this.flow.endingStarted) {
        this.flow.startGameOver();
      }
    }
    return;
  }

  if (this.chapter === 2) {
    this.updateCh2(time);
  } else {
    this.updateCh1(time);
  }
}
```

然后将现有 update() 的玩家死亡判断之后的全部代码提取为私有方法 `updateCh1(time: number)`，并添加 `updateCh2` 方法：

```typescript
private updateCh1(time: number) {
  // 原始 update() 中玩家死亡判断之后的全部代码原封移入此处
  this.flow.handleNpcDialog();
  this.flow.handleSurrender();
  this.flow.handleInvestigation();
  this.flow.handleStudyGate();
  this.flow.handleProtectEvent();

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
    if (this.flow.endingStarted || this.flow.gameOverStarted) break;
    this.combatDirector.applyEnemyStrike(strike, time);
  }

  const bossStrike = this.enemyDirector.advanceBoss(time, this.player.x);
  if (bossStrike && !this.flow.endingStarted && !this.flow.gameOverStarted) {
    this.combatDirector.applyEnemyStrike(bossStrike, time);
  }

  const threat = this.enemyDirector.activeThreat;
  if (threat?.active && !this.flow.protectResolved) {
    threat.update(time, this.flow.threatenedVillagerX);
    const threatStrike = threat.advanceAttack(time, this.flow.threatenedVillagerX);
    if (threatStrike && !this.flow.endingStarted && !this.flow.gameOverStarted) {
      this.combatDirector.applyEnemyStrike(threatStrike, time);
    }
  }

  for (const npc of this.npcs) {
    npc.update();
  }
}

private updateCh2(time: number) {
  if (!this.flowCh2 || !this.enemyDirectorCh2) return;

  this.flowCh2.handleWaveProgression(this.player.x);
  this.flowCh2.handleChapterEnd();

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

  const enemyStrikes = this.enemyDirectorCh2.advanceEnemies(time, this.player.x);
  for (const strike of enemyStrikes) {
    if (this.flowCh2.bossDefeated) break;
    this.combatDirector.applyEnemyStrike(strike, time);
  }

  const bossStrike = this.enemyDirectorCh2.advanceBoss(time, this.player.x);
  if (bossStrike && !this.flowCh2.bossDefeated) {
    this.combatDirector.applyEnemyStrike(bossStrike, time);
  }

  for (const npc of this.npcs) {
    npc.update();
  }
}
```

- [ ] **Step 5: 处理 AudioController 构造参数（Ch2 无 FlowController）**

`AudioController` 的构造器需要 `FlowController`，但 Ch2 没有。检查 `AudioController.ts`，如果 `flow` 参数只用于音频模式切换，可传 `null`（需用 `as unknown as FlowController` 或将参数改为可选）。

打开 `AudioController.ts`，查看 `flow` 参数的使用，若只访问 `flow.endingStarted`，则在 AudioController 内将其访问改为可选链：`this.flow?.endingStarted`，并将构造参数类型改为 `FlowController | null`。

- [ ] **Step 6: 运行类型检查 + 测试**

```bash
npm run typecheck && npm test
```

Expected: 全部通过。

- [ ] **Step 7: 手动验证 Ch2 启动**

在 `src/main.ts`（或场景启动处）临时修改 scene.start 传入 `{ chapter: 2 }`，启动开发服务器，确认：
- 驿站地图正常渲染（深灰蓝背景 + 竹影剪影）
- 玩家可正常移动、攻击、使用技能
- 走到 x>400 触发第一波匪兵
- 走到 x>2600 生成铁臂罗（金色 tint 表示护甲态）
- 裂鳞破甲（O 键）命中铁臂罗时破防条减少；三次破防后进入 1500ms 硬直（白色闪烁）
- 铁臂罗 HP < 40% 时进入 Phase 2（橙红 tint，攻击更快）
- 击败铁臂罗后显示胜利文字

恢复 main.ts 到默认 `{ chapter: 1 }`。

- [ ] **Step 8: 提交**

```bash
git add src/game/GameScene.ts
git commit -m "feat(scene): add chapter routing for Ch2 — WorldBuilderCh2/EnemyDirectorCh2/FlowControllerCh2"
```

---

## Task 10：文档同步

**Files:**
- Modify: `docs/PROGRESS.md`
- Modify: `docs/GDD.md`
- Modify: `docs/PRD.md`

- [ ] **Step 1: 更新 PROGRESS.md**

在 M6 行之后添加 M7 行，并更新总测试数（+8 条 poise 纯函数测试）：

```markdown
| M7 | 第二章·龙刃初鸣（破防 + 铁臂罗） | ✅ 完成 | `<commit-sha>` | +8 tests |
```

将 "当前总计" 中测试数更新（原 99 → 107 passed）。

添加 M7 段落：

```markdown
### M7 第二章·龙刃初鸣（破防 + 铁臂罗）
- **新增文件（6）**：IEnemyDirector.ts, WorldBuilderCh2.ts, BossIronArmLuo.ts, EnemyDirectorCh2.ts, FlowControllerCh2.ts, poiseState.ts
- **最小改动**：Strike.isPoiseBreaker, CombatDirector 类型参数, SkillSystem scaleBreak 标记, combatBalance ch2Boss, CharacterArt 2 纹理, GameScene 章节路由
- **游戏内容**：荒废驿站 3200×720 地图，2 波次小怪，铁臂罗两阶段 Boss，破防值系统，胜利演出
- **测试**：poise-state.test.ts（8 个纯函数用例）
```

在"可玩内容"表中追加两行：

```markdown
| 第二章 | 荒废驿站 | 波次小怪（3名） + 铁臂罗 Boss | 破防系统（裂鳞破甲）|
| 铁臂罗 | Phase 1 护甲 + 重拳 → Phase 2 冲拳/抓投 | 需用裂鳞破甲 3 次破防解锁全伤 |  |
```

- [ ] **Step 2: 更新 GDD.md**

在第二章相关行将 ⏳ 改为 ✅，并在 Boss 表中确认铁臂罗条目存在。

- [ ] **Step 3: 更新 PRD.md**

在已落地里程碑中追加 `M7 破防系统 + 铁臂罗 Boss`，并更新"下一步建议"：

```markdown
1. P1 — 第三章·七日练刀（训练关 / 技能解锁 / 心魔挑战）。
```

- [ ] **Step 4: 提交**

```bash
git add docs/PROGRESS.md docs/GDD.md docs/PRD.md
git commit -m "docs: sync M7 progress — Ch2 iron-arm-luo complete"
```

---

## 自审检查清单

| 规格要求 | 覆盖任务 |
|---------|---------|
| IEnemyDirector 接口 | Task 1 |
| Strike.isPoiseBreaker | Task 2 |
| SkillSystem scaleBreak 标记 | Task 2 |
| poiseState 纯函数（≥7 用例） | Task 3（8 用例）|
| ch2Boss 数值常量 | Task 4 |
| WorldBuilderCh2 3200×720，3 分区平台 | Task 5 |
| CharacterArt iron-arm / bystander | Task 5 |
| BossIronArmLuo Phase 1 护甲+重拳 | Task 6 |
| BossIronArmLuo Phase 2 冲拳+抓投 | Task 6 |
| poise 破防条（金色，Phase 1 显示，硬直闪烁） | Task 6 |
| EnemyDirectorCh2 波次 + Boss 调度 | Task 7 |
| FlowControllerCh2 波次推进 + 章节结束 | Task 8 |
| GameScene 章节路由（Ch1 不改） | Task 9 |
| 文档同步 | Task 10 |
