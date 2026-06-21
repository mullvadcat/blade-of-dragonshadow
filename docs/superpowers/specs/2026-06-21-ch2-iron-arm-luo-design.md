# 第二章·龙刃初鸣 设计规格（M7）

> 聚焦：破防系统 + 铁臂罗 Boss 垂直切片。单场景 chapter 参数路由，现有 Ch1 代码不改动。

---

## 1. 范围

| 包含 | 排除 |
|------|------|
| WorldBuilderCh2（荒废驿站地图） | 弩手弓箭道德惩罚逻辑 |
| EnemyDirectorCh2（波次 + 铁臂罗调度） | 近失手旁观者道德事件 |
| BossIronArmLuo（两阶段 Boss） | 玄松老人登场 |
| FlowControllerCh2（波次推进 + 章节结束） | 章节间场景跳转体系 |
| poiseState.ts（破防纯函数） | Ch1 任何代码改动（只加 isPoiseBreaker 字段） |
| Hud 破防条 UI（Phase 1 金色条） | 可破坏环境物（destructibles） |

---

## 2. 架构：章节路由

### 2.1 GameScene 改动（最小）

`GameScene.create()` 头部读取章节参数，if/else 分支装配不同子系统：

```typescript
const chapter = (this.scene.settings.data as { chapter?: number })?.chapter ?? 1;

if (chapter === 2) {
  this.world    = new WorldBuilderCh2(this);
  // ground 从 WorldBuilderCh2 获取
  this.enemies  = new EnemyDirectorCh2(this, ground, this.sfx) as unknown as EnemyDirector;
  this.flow     = new FlowControllerCh2(this.enemies as unknown as EnemyDirectorCh2, ...);
} else {
  // 现有 Ch1 装配，一字不改
}
// CombatDirector 两章共用（接口兼容）
```

> `EnemyDirectorCh2` 实现与 `EnemyDirector` 相同的公共 API（结构子类型），CombatDirector
> 构造参数类型改为 `IEnemyDirector` 接口（见 §2.2），无逻辑改动。

### 2.2 IEnemyDirector 接口

提取到 `src/game/director/IEnemyDirector.ts`：

```typescript
import type { Enemy } from '../entities/Enemy';
import type { CombatActor } from '../entities/CombatActor';

export interface IEnemyDirector {
  readonly activeEnemies: readonly Enemy[];
  readonly activeBoss: CombatActor | null;
  readonly activeThreat: Enemy | null;
}
```

`EnemyDirector` 和 `EnemyDirectorCh2` 均满足此接口。`CombatDirector` 构造参数
`enemies: EnemyDirector` → `enemies: IEnemyDirector`（仅类型声明，无逻辑改动）。

### 2.3 Strike 类型扩展

`CombatSystem.ts` 中 `Strike` 加一个可选字段：

```typescript
export type Strike = {
  damage: number;
  guardDamage: number;
  staminaDamage: number;
  blockDamageMultiplier: number;
  staggerDuration: number;
  isPoiseBreaker?: boolean;   // 仅裂鳞破甲设为 true
};
```

`SkillSystem.tryRelease()` 中，skillId === 'break' 的 strike 设 `isPoiseBreaker: true`。
CombatDirector 不感知此字段，由 BossIronArmLuo 内部消费。

### 2.4 新增文件清单

| 路径 | 职责 |
|------|------|
| `src/game/director/IEnemyDirector.ts` | 共享接口 |
| `src/game/world/WorldBuilderCh2.ts` | Ch2 地图搭建 |
| `src/game/director/EnemyDirectorCh2.ts` | Ch2 敌人/Boss 调度 |
| `src/game/entities/BossIronArmLuo.ts` | 铁臂罗实体 |
| `src/game/flow/FlowControllerCh2.ts` | Ch2 流程控制 |
| `src/game/flow/poiseState.ts` | 破防值纯函数 |
| `tests/poise-state.test.ts` | 破防纯函数单测 |

---

## 3. 破防值系统（poiseState.ts）

### 3.1 类型与纯函数

```typescript
// src/game/flow/poiseState.ts
export type PoiseState = {
  readonly current: number;
  readonly max: number;
  readonly brokenAt: number;       // 破防时刻（ms）；0 = 未破防
  readonly staggerDuration: number; // 固定 1500 ms
};

export function createPoise(max: number): PoiseState;
export function takePoiseDamage(state: PoiseState, amount: number): PoiseState;
export function resetPoise(state: PoiseState): PoiseState;      // 硬直结束后重置
export function isPoiseBreaking(state: PoiseState): boolean;    // current <= 0
export function isStaggering(state: PoiseState, now: number): boolean;
```

### 3.2 数值常量（combatBalance.ts 追加）

```typescript
ch2Boss: {
  hp: 300,
  poiseMax: 100,
  poiseDamageBreak: 40,     // 裂鳞破甲每次破防伤害（3 次触发）
  guardDamageReduction: 0.70, // 护甲态普攻减免
  staggerDuration: 1500,
  phaseThreshold: 0.40,     // Phase 2 触发 HP 百分比
  heavyPunchDamage: 25,     // 占玩家 HP 百分比（实际伤害值另算）
  grabDamage: 20,
  rushPunchDamage: 18,
}
```

### 3.3 单元测试覆盖（poise-state.test.ts）

- `createPoise` 初始值正确
- `takePoiseDamage` 累积减少 current
- `takePoiseDamage` 不低于 0
- `isPoiseBreaking` 在 current === 0 时为 true
- `isStaggering` 在 brokenAt > 0 且未超时时为 true
- `isStaggering` 在硬直结束后为 false
- `resetPoise` 重置 current 为 max、清除 brokenAt

---

## 4. 地图：WorldBuilderCh2

**尺寸**：3200 × 720，physics bounds 同步设置。

### 4.1 横向分区

| X 范围 | 区域 | 内容 |
|--------|------|------|
| 0–400 | 入口竹林 | 玩家出生 x=130，过场提示文字 |
| 400–900 | 一号战斗区 | 第一波小怪区域 |
| 900–1500 | 驿站庭院 | 可站立二层平台 |
| 1500–2100 | 二号战斗区 | 第二波小怪区域 |
| 2100–2600 | 驿站正堂 | 2 个村夫 NPC（环境对话） |
| 2600–3200 | Boss 场地 | 空旷格斗场，铁臂罗 x=2900 |

### 4.2 平台

- **地面层**：全段连通（y=600）
- **二层平台**：x=950–1350，y=380（弩手站位）
- **残破墙台**：x=1600–1800，y=430

### 4.3 NPC

- 2 名村夫（dialogId: `'bystander'`），x=2200 / 2350，无道德事件绑定
- 环境对话内容：「黑鳞会的人昨夜刚过……」

### 4.4 背景 & 美术（程序生成）

- 背景色：深灰蓝（#1a1f2e），竹影剪影层
- 地面：暗棕（#3d2b1f）
- 月光打光效果（半透明白色矩形叠层）

---

## 5. 敌人调度：EnemyDirectorCh2

### 5.1 公共接口

实现 `IEnemyDirector`，额外暴露：

```typescript
get activeBossIronArm(): BossIronArmLuo | null;
spawnWave1(): void;   // x≈500、600 各一匪兵
spawnWave2(): void;   // x≈1600、1800 匪兵 + x=2020 弩手（作普通匪兵处理）
spawnBoss(): void;    // x=2900
advanceBoss(time: number, playerX: number): Strike | null;
```

### 5.2 Boss 类型

`activeBoss` 返回 `BossIronArmLuo | null`（满足 `CombatActor | null` 接口）。

---

## 6. Boss：BossIronArmLuo

继承 `CombatActor extends Phaser.Physics.Arcade.Sprite`，与 `BossWuzhen` 并列。

### 6.1 内部状态

```typescript
private poise: PoiseState;
private phase: 1 | 2 = 1;
private aiState: 'idle' | 'windup' | 'active' | 'staggered' | 'rage_idle' | 'rush' | 'grab';
private stateTimer = 0;
private isGuarding = true;
```

### 6.2 receiveStrike 逻辑

```
if phase === 1 && isGuarding:
  if strike.isPoiseBreaker:
    poise = takePoiseDamage(poise, ch2Boss.poiseDamageBreak)
    if isPoiseBreaking(poise): → 进入 STAGGERED，brokenAt = time
    deal 0 HP damage（破防攻击仅伤护甲，不伤血）
  else:
    deal damage * (1 - guardDamageReduction)
else:
  deal full damage（硬直中或 Phase 2 无护甲）
  check phase transition (HP ≤ 40% → enterPhase2)
```

### 6.3 Phase 1 AI 状态机

```
GUARD_IDLE
  → 玩家进入 melee range (<160px) → HEAVY_PUNCH_WINDUP（800ms）
  → WINDUP 结束 → HEAVY_PUNCH_ACTIVE（判定帧，产出 Strike）→ GUARD_IDLE
  → poise break → STAGGERED（1500ms）→ GUARD_IDLE（poise 重置）

STAGGERED 中 isGuarding = false，伤害倍率 ×2
```

### 6.4 Phase 2 AI 状态机（HP ≤ 40%，不可逆）

`isGuarding` 永久 = false，破防条隐藏。

```
RAGE_IDLE
  → 近距 (<160px)    → RUSH_PUNCH（400ms 前摇 + 判定）→ RAGE_IDLE
  → 极近 (<80px)     → GRAB_WINDUP（600ms）→ GRAB_ACTIVE（判定：推飞 + 伤害）→ RAGE_IDLE
  → 中距 (160–350px) → 缓步逼近
```

### 6.5 advanceAttack(time, playerX): Strike | null

每帧由 `EnemyDirectorCh2.advanceBoss` 调用，推进 AI 状态机，返回落招时的 Strike（或 null）。

---

## 7. 流程控制：FlowControllerCh2

### 7.1 字段

```typescript
private wave1Spawned = false;
private wave2Spawned = false;
private bossSpawned  = false;
bossDefeated         = false;  // 公开，GameScene 读取
private endStarted   = false;
```

### 7.2 handleWaveProgression(playerX, time)

| 条件 | 动作 |
|------|------|
| `!wave1Spawned && playerX > 400` | `enemies.spawnWave1(); wave1Spawned=true` |
| `!wave2Spawned && playerX > 1500` | `enemies.spawnWave2(); wave2Spawned=true` |
| `!bossSpawned && playerX > 2600` | `enemies.spawnBoss(); bossSpawned=true` |
| `bossSpawned && activeBoss?.hp <= 0` | `bossDefeated=true` |

### 7.3 handleChapterEnd(time)

```
if bossDefeated && !endStarted:
  endStarted = true
  sfx('victory')
  delayedCall(1200, fadeOut(800))
  → camera fadeOut 完成后显示结束文字：
    「铁臂罗，授首。」
    「然而黑鳞会的影子，比预想的更深……」
  delayedCall(4000, scene.restart())
```

### 7.4 GameScene Ch2 update 变化

```typescript
// 替换 Ch1 的 flow.handleStudyGate / flow.handleProtectEvent
this.flow2.handleWaveProgression(this.player.x, time);
this.flow2.handleChapterEnd(time);

// Boss 推进
const bossStrike = this.enemies2.advanceBoss(time, this.player.x);
if (bossStrike && !this.flow2.bossDefeated) {
  this.combatDirector.applyEnemyStrike(bossStrike, time);
}
```

---

## 8. HUD：破防条

- **位置**：Boss 血条下方 4px
- **颜色**：金色 `#f5c518`（Phase 1 可见）；Phase 2 隐藏
- **宽度**：与 Boss 血条等宽，按 `poise.current / poise.max` 比例缩放
- **硬直闪烁**：`isStaggering` 期间金色条闪烁（alpha 0.4 ↔ 1.0，200ms 周期）
- **实现位置**：`Hud.ts` 新增 `updatePoise(current, max, staggering)` 方法

---

## 9. 测试策略

| 文件 | 测试内容 |
|------|---------|
| `tests/poise-state.test.ts` | poiseState 所有纯函数（≥7 个用例） |
| 无集成测试 | BossIronArmLuo AI 通过实机验证，不单测 Phaser 实体 |

---

## 10. 实现顺序（供 writing-plans 参考）

1. `IEnemyDirector` 接口 + `CombatDirector` 类型参数改动（最小）
2. `Strike.isPoiseBreaker` 字段 + `SkillSystem` 设标记
3. `poiseState.ts` 纯函数 + `poise-state.test.ts`（TDD）
4. `WorldBuilderCh2`（地图搭建）
5. `BossIronArmLuo`（实体 + AI）
6. `EnemyDirectorCh2`（波次 + Boss 调度）
7. `FlowControllerCh2`（流程）
8. `GameScene` 章节路由装配
9. `Hud` 破防条 UI
10. 文档同步（PROGRESS / GDD / PRD）
