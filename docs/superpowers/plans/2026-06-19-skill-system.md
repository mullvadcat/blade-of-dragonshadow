# 龙影九斩前三式 + 技能形态切换 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有战斗循环上落地龙影九斩前三式（潜龙出渊/游龙回身/裂鳞破甲）与戾气/守心驱动的形态切换，让"力量的克制"在技能层可玩。

**Architecture:** 新增独立 `SkillSystem`（技能槽 + 冷却 + 龙魂消耗 + 形态化），数据定义集中在 `skillDefs.ts`。游龙回身通过闪避后窗口派生（改 PlayerStateMachine + Player），潜龙出渊/裂鳞破甲由 CombatDirector 读键调用 SkillSystem。形态根据 `MoralState.tendency` 自动调整伤害/范围/附加效果。

**Tech Stack:** TypeScript strict、Phaser 3.90、vitest（globals 已开，无需 import describe/expect/it）。

**验证基线：** 完成每个任务后跑 `npm run lint && npm run typecheck && npm test`，三者全绿方可继续。最终跑运行时端到端验证。

---

## 文件结构

**新增：**
- `src/game/skills/skillDefs.ts` — 三式技能数据定义（Strike 模板 + 突进/破防参数 + 形态修饰）
- `src/game/skills/SkillSystem.ts` — 技能槽、冷却门控、龙魂消耗、形态化释放，返回 SkillCastResult
- `tests/skill-system.test.ts` — SkillSystem 与游龙回身派生的单测

**修改：**
- `src/game/player/PlayerStateMachine.ts` — 闪避后设 `dodgeCounterWindowUntil`；暴露窗口消费方法
- `src/game/player/Player.ts` — `consumeAttack` 检测闪避后窗口，派生游龙回身 Strike
- `src/game/director/CombatDirector.ts` — 新增 `handleSkills` 接入 I/O 键 + 突进/命中/特效；守护形态减伤接入 applyEnemyStrike
- `src/game/ui/Hud.ts` — 左下角技能状态条（三式图标 + 冷却暗化 + 龙魂不足变灰）

---

## Task 1: skillDefs — 三式数据定义

**Files:**
- Create: `src/game/skills/skillDefs.ts`

- [ ] **Step 1: 创建 skillDefs.ts**

```typescript
import type { Strike } from '../combat/CombatSystem';
import type { MoralTendency } from '../moral/MoralState';

/** 龙影九斩技能标识（前三式）。 */
export type SkillId = 'dragonLurk' | 'dragonReturn' | 'scaleBreak';

/** 技能形态修饰：根据心境调整伤害/范围/附加。 */
export type SkillFormModifier = {
  damageMultiplier: number;
  rangeMultiplier: number;
  /** 狂暴形态：释放者承受的自伤（占最大生命比例）。 */
  selfHarmRatio?: number;
  /** 守护形态：释放后减伤持续时间(ms)与减伤比例。 */
  guardReduceUntil?: { durationMs: number; ratio: number };
};

/** 形态修饰表：tendency → 该形态的数值调整。 */
export const SKILL_FORM_MODIFIERS: Record<MoralTendency, SkillFormModifier> = {
  balance: { damageMultiplier: 1, rangeMultiplier: 1 },
  wrath: { damageMultiplier: 1.4, rangeMultiplier: 1.3, selfHarmRatio: 0.05 },
  guard: {
    damageMultiplier: 1,
    rangeMultiplier: 0.8,
    guardReduceUntil: { durationMs: 500, ratio: 0.3 },
  },
};

/** 基础技能定义（形态化前的模板）。 */
export type SkillDef = {
  id: SkillId;
  /** 显示名（用于 HUD 图标占位）。 */
  label: string;
  /** 龙魂消耗。 */
  soulCost: number;
  /** 冷却时长(ms)。0 表示无冷却（受其他机制限制，如游龙回身的闪避后窗口）。 */
  cooldownMs: number;
  /** 基础 Strike 模板（形态化前）。 */
  strike: Strike;
  /** 潜龙出渊的突进距离；其余为 0。 */
  dashDistance: number;
};

export const SKILL_DEFS: Record<SkillId, SkillDef> = {
  // 一斩·潜龙出渊：突进斩
  dragonLurk: {
    id: 'dragonLurk',
    label: '潜',
    soulCost: 15,
    cooldownMs: 3000,
    strike: {
      damage: 16,
      guardDamage: 18,
      staminaDamage: 0,
      blockDamageMultiplier: 0.4,
      staggerDuration: 220,
    },
    dashDistance: 220,
  },
  // 二斩·游龙回身：闪避后反击斩（无冷却，受闪避后窗口限制）
  dragonReturn: {
    id: 'dragonReturn',
    label: '回',
    soulCost: 10,
    cooldownMs: 0,
    strike: {
      damage: 20,
      guardDamage: 22,
      staminaDamage: 0,
      blockDamageMultiplier: 0.45,
      staggerDuration: 260,
    },
    dashDistance: 0,
  },
  // 三斩·裂鳞破甲：高破防重斩
  scaleBreak: {
    id: 'scaleBreak',
    label: '裂',
    soulCost: 25,
    cooldownMs: 4000,
    strike: {
      damage: 22,
      guardDamage: 45,
      staminaDamage: 0,
      blockDamageMultiplier: 0.5,
      staggerDuration: 380,
    },
    dashDistance: 0,
  },
};

/** 游龙回身派生窗口：闪避成功后可派生的时间(ms)。 */
export const DODGE_COUNTER_WINDOW_MS = 400;

/** 守护形态减伤增益的 key（供 PlayerStateMachine 记录减伤窗口结束时间）。 */
export const GUARD_FORM_REDUCE_KEY = 'guardFormReduceUntil';
```

- [ ] **Step 2: 运行 typecheck 验证类型无误**

Run: `npm run typecheck`
Expected: 通过（新文件无引用，不破坏现有代码）

- [ ] **Step 3: Commit**

```bash
git add src/game/skills/skillDefs.ts
git commit -m "feat(skills): add dragon-nine first three skill definitions"
```

---

## Task 2: SkillSystem — 冷却/龙魂/形态化释放（TDD）

**Files:**
- Create: `src/game/skills/SkillSystem.ts`
- Test: `tests/skill-system.test.ts`

- [ ] **Step 1: 写失败测试 tests/skill-system.test.ts**

```typescript
import { describe, expect, it } from 'vitest';
import { SkillSystem } from '../src/game/skills/SkillSystem';
import { SKILL_DEFS, SKILL_FORM_MODIFIERS } from '../src/game/skills/skillDefs';
import { MoralState } from '../src/game/moral/MoralState';
import { CombatSystem } from '../src/game/combat/CombatSystem';

describe('SkillSystem', () => {
  it('starts with all skills off cooldown', () => {
    const skills = new SkillSystem(new MoralState());
    expect(skills.isReady('dragonLurk', 1000)).toBe(true);
    expect(skills.isReady('dragonReturn', 1000)).toBe(true);
    expect(skills.isReady('scaleBreak', 1000)).toBe(true);
  });

  it('reports not ready during cooldown', () => {
    const skills = new SkillSystem(new MoralState());
    skills.recordCast('dragonLurk', 1000);
    expect(skills.isReady('dragonLurk', 1500)).toBe(false);
    expect(skills.isReady('dragonLurk', 1000 + SKILL_DEFS.dragonLurk.cooldownMs)).toBe(true);
  });

  it('tryRelease returns null when on cooldown', () => {
    const skills = new SkillSystem(new MoralState());
    skills.recordCast('dragonLurk', 1000);
    const result = skills.tryRelease('dragonLurk', 1200, 100, 120);
    expect(result).toBeNull();
  });

  it('tryRelease returns null when insufficient soul', () => {
    const skills = new SkillSystem(new MoralState());
    const result = skills.tryRelease('dragonLurk', 1000, 5, 100);
    expect(result).toBeNull();
  });

  it('tryRelease deducts soul and sets cooldown on success', () => {
    const moral = new MoralState();
    const skills = new SkillSystem(moral);
    const result = skills.tryRelease('dragonLurk', 1000, 50, 120);
    expect(result).not.toBeNull();
    expect(result!.soulSpent).toBe(SKILL_DEFS.dragonLurk.soulCost);
    expect(skills.isReady('dragonLurk', 1000)).toBe(false);
  });

  it('wrath form multiplies damage and applies self-harm', () => {
    const moral = new MoralState();
    moral.addLiqi(60); // wrath
    const skills = new SkillSystem(moral);
    const result = skills.tryRelease('dragonLurk', 1000, 50, 120);
    expect(result).not.toBeNull();
    const expectedDmg = Math.round(SKILL_DEFS.dragonLurk.strike.damage * 1.4);
    expect(result!.strike.damage).toBe(expectedDmg);
    expect(result!.selfHarm).toBeGreaterThan(0);
    expect(result!.selfHarm).toBe(Math.round(120 * 0.05));
  });

  it('guard form reduces range and grants damage reduction window', () => {
    const moral = new MoralState();
    moral.addShouxin(60); // guard
    const skills = new SkillSystem(moral);
    const result = skills.tryRelease('dragonLurk', 1000, 50, 120);
    expect(result).not.toBeNull();
    expect(result!.rangeMultiplier).toBeLessThan(1);
    expect(result!.guardReduceUntil).toBeGreaterThan(1000);
  });

  it('balance form uses base damage with no extras', () => {
    const moral = new MoralState();
    const skills = new SkillSystem(moral);
    const result = skills.tryRelease('scaleBreak', 1000, 50, 120);
    expect(result).not.toBeNull();
    expect(result!.strike.damage).toBe(SKILL_DEFS.scaleBreak.strike.damage);
    expect(result!.selfHarm).toBe(0);
    expect(result!.guardReduceUntil).toBeNull();
  });

  it('cooldown remaining reports time left for HUD', () => {
    const skills = new SkillSystem(new MoralState());
    skills.recordCast('dragonLurk', 1000);
    expect(skills.cooldownRemaining('dragonLurk', 2000)).toBe(2000); // 3000 - 1000 = 2000
    expect(skills.cooldownRemaining('dragonLurk', 4000)).toBe(0);
  });

  it('reset clears all cooldowns', () => {
    const skills = new SkillSystem(new MoralState());
    skills.recordCast('dragonLurk', 1000);
    skills.recordCast('scaleBreak', 1000);
    skills.reset();
    expect(skills.isReady('dragonLurk', 1000)).toBe(true);
    expect(skills.isReady('scaleBreak', 1000)).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- skill-system`
Expected: FAIL — `Cannot find module '../src/game/skills/SkillSystem'`

- [ ] **Step 3: 实现 SkillSystem.ts**

```typescript
import type { Strike } from '../combat/CombatSystem';
import type { MoralState } from '../moral/MoralState';
import {
  SKILL_DEFS,
  SKILL_FORM_MODIFIERS,
  type SkillId,
  type SkillFormModifier,
} from './skillDefs';

export type SkillCastResult = {
  skillId: SkillId;
  /** 形态化后的最终 Strike（含伤害/破防调整）。 */
  strike: Strike;
  /** 实际消耗的龙魂。 */
  soulSpent: number;
  /** 突进距离（已按形态 rangeMultiplier 调整）。 */
  dashDistance: number;
  /** 命中范围倍率（供 CombatDirector 调整命中判定半径）。 */
  rangeMultiplier: number;
  /** 狂暴形态自伤（占最大生命的伤害值，已换算为绝对值）。0 表示无自伤。 */
  selfHarm: number;
  /** 守护形态减伤窗口结束时间；null 表示无减伤。 */
  guardReduceUntil: number | null;
  /** 本次释放所用的形态修饰。 */
  form: SkillFormModifier;
};

/**
 * 龙影九斩技能系统：管理冷却、龙魂消耗、形态化释放。
 * 形态由玩家 MoralState.tendency 决定，自动调整伤害/范围/附加效果。
 */
export class SkillSystem {
  private lastCastAt: Record<SkillId, number> = {
    dragonLurk: 0,
    dragonReturn: 0,
    scaleBreak: 0,
  };

  constructor(private readonly moral: MoralState) {}

  /** 该技能当前是否可释放（冷却结束）。不检查龙魂。 */
  isReady(id: SkillId, now: number): boolean {
    const def = SKILL_DEFS[id];
    if (def.cooldownMs <= 0) {
      return true;
    }
    return now >= this.lastCastAt[id] + def.cooldownMs;
  }

  /** 冷却剩余毫秒（用于 HUD 暗化）。 */
  cooldownRemaining(id: SkillId, now: number): number {
    const def = SKILL_DEFS[id];
    if (def.cooldownMs <= 0) {
      return 0;
    }
    return Math.max(0, this.lastCastAt[id] + def.cooldownMs - now);
  }

  /** 记录一次释放（用于游龙回身派生等外部触发场景，跳过龙魂/冷却检查）。 */
  recordCast(id: SkillId, now: number) {
    this.lastCastAt[id] = now;
  }

  /**
   * 尝试释放技能：检查冷却 + 龙魂，通过则按当前形态化 Strike 并返回结果。
   * 调用方负责扣减龙魂（soulSpent 已在结果中给出）。
   * @param currentSoul 当前龙魂值
   * @param maxHealth 玩家最大生命（用于换算狂暴自伤绝对值）
   */
  tryRelease(id: SkillId, now: number, currentSoul: number, maxHealth: number): SkillCastResult | null {
    const def = SKILL_DEFS[id];
    if (!this.isReady(id, now)) {
      return null;
    }
    if (currentSoul < def.soulCost) {
      return null;
    }

    this.recordCast(id, now);
    const form = SKILL_FORM_MODIFIERS[this.moral.tendency];

    const strike: Strike = {
      ...def.strike,
      damage: Math.round(def.strike.damage * form.damageMultiplier),
      guardDamage: Math.round(def.strike.guardDamage * form.damageMultiplier),
    };

    const selfHarm = form.selfHarmRatio ? Math.round(maxHealth * form.selfHarmRatio) : 0;
    const guardReduceUntil = form.guardReduceUntil ? now + form.guardReduceUntil.durationMs : null;
    const dashDistance = Math.round(def.dashDistance * form.rangeMultiplier);

    return {
      skillId: id,
      strike,
      soulSpent: def.soulCost,
      dashDistance,
      rangeMultiplier: form.rangeMultiplier,
      selfHarm,
      guardReduceUntil,
      form,
    };
  }

  reset() {
    this.lastCastAt = { dragonLurk: 0, dragonReturn: 0, scaleBreak: 0 };
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- skill-system`
Expected: PASS — 9 tests

- [ ] **Step 5: 跑 lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: 全绿

- [ ] **Step 6: Commit**

```bash
git add src/game/skills/SkillSystem.ts tests/skill-system.test.ts
git commit -m "feat(skills): add SkillSystem with cooldown, soul cost, moral-form scaling"
```

---

## Task 3: 游龙回身派生 — 闪避后窗口（TDD）

**Files:**
- Modify: `src/game/player/PlayerStateMachine.ts:44-52` (tryDodge) + 新增字段与方法
- Modify: `tests/player-state.test.ts` (新增派生测试)

- [ ] **Step 1: 在 player-state.test.ts 末尾加游龙回身派生测试**

在 `tests/player-state.test.ts` 最后的 `});` 之前追加：

```typescript
  it('grants a dodge counter window after dodging for dragon-return derivation', () => {
    const player = new PlayerStateMachine({ stamina: 40 });

    player.tryDodge(1000);

    expect(player.isInDodgeCounterWindow(1100)).toBe(true);
    expect(player.isInDodgeCounterWindow(1500)).toBe(false);
  });

  it('consumeDodgeCounterWindow returns true only within window and once', () => {
    const player = new PlayerStateMachine({ stamina: 40 });
    player.tryDodge(1000);

    expect(player.consumeDodgeCounterWindow(1100)).toBe(true);
    expect(player.consumeDodgeCounterWindow(1100)).toBe(false);
  });

  it('reset clears dodge counter window', () => {
    const player = new PlayerStateMachine({ stamina: 40 });
    player.tryDodge(1000);

    player.reset();

    expect(player.isInDodgeCounterWindow(1100)).toBe(false);
  });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- player-state`
Expected: FAIL — `isInDodgeCounterWindow is not a function`

- [ ] **Step 3: 修改 PlayerStateMachine.ts**

在文件顶部 import 后追加常量（与 PERFECT_GUARD_WINDOW_MS 并列）：

```typescript
/** 闪避后可派生"游龙回身"的窗口时长。 */
export const DODGE_COUNTER_WINDOW_MS = 400;
```

> 注意：此常量与 skillDefs.ts 中的同名常量重复。为避免循环依赖与单一来源，从 PlayerStateMachine 导出，并让 skillDefs.ts 改为从 PlayerStateMachine 导入。Task 4 会处理这个去重；本步先在 PlayerStateMachine 定义。

在 `PlayerStateMachine` 类内，`counterWindowUntil` 字段下方新增：

```typescript
  private dodgeCounterWindowUntil = 0;
```

修改 `tryDodge` 方法（原 44-52 行），在 `return true` 前加一行设窗口：

```typescript
  tryDodge(now: number) {
    if (this.isDead() || this.state.stamina < 18 || this.state.isBlocking) {
      return false;
    }

    this.state.stamina -= 18;
    this.state.invulnerableUntil = now + 220;
    this.dodgeCounterWindowUntil = now + DODGE_COUNTER_WINDOW_MS;
    return true;
  }
```

在 `consumeCounterWindow` 方法后新增两个方法：

```typescript
  /** 当前是否处于闪避后派生窗口（游龙回身可用）。 */
  isInDodgeCounterWindow(now: number): boolean {
    return now < this.dodgeCounterWindowUntil;
  }

  /** 消费闪避后派生窗口；窗口内返回 true 并清零，否则 false。 */
  consumeDodgeCounterWindow(now: number): boolean {
    if (now < this.dodgeCounterWindowUntil) {
      this.dodgeCounterWindowUntil = 0;
      return true;
    }
    return false;
  }
```

在 `reset` 方法末尾（`this.counterWindowUntil = 0;` 后）加：

```typescript
    this.dodgeCounterWindowUntil = 0;
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- player-state`
Expected: PASS — 15 tests（原 12 + 新 3）

- [ ] **Step 5: Commit**

```bash
git add src/game/player/PlayerStateMachine.ts tests/player-state.test.ts
git commit -m "feat(player): add dodge counter window for dragon-return derivation"
```

---

## Task 4: skillDefs 去重 DODGE_COUNTER_WINDOW_MS

**Files:**
- Modify: `src/game/skills/skillDefs.ts`

- [ ] **Step 1: 修改 skillDefs.ts，删除本地常量改为从 PlayerStateMachine 导入**

将 skillDefs.ts 末尾的：

```typescript
/** 游龙回身派生窗口：闪避成功后可派生的时间(ms)。 */
export const DODGE_COUNTER_WINDOW_MS = 400;
```

替换为：

```typescript
import { DODGE_COUNTER_WINDOW_MS } from '../player/PlayerStateMachine';
export { DODGE_COUNTER_WINDOW_MS };
```

> 把 import 放到文件顶部其它 import 之间。删除底部的本地定义，改为 re-export，保持外部引用 `from '../skills/skillDefs'` 仍可用。

- [ ] **Step 2: 运行 typecheck + test 确认无破坏**

Run: `npm run typecheck && npm test`
Expected: 全绿

- [ ] **Step 3: Commit**

```bash
git add src/game/skills/skillDefs.ts
git commit -m "refactor(skills): dedupe DODGE_COUNTER_WINDOW_MS to single source"
```

---

## Task 5: Player.consumeAttack 派生游龙回身

**Files:**
- Modify: `src/game/player/Player.ts:96-124` (consumeAttack)

- [ ] **Step 1: 修改 consumeAttack，在轻/重斩判定前优先检测闪避后派生窗口**

在 `consumeAttack` 方法中，`if (time < this.attackCooldownUntil) return null;` 之后、`if (Phaser.Input.Keyboard.JustDown(this.keys.light))` 之前，插入派生检测：

```typescript
    // 游龙回身派生：闪避后窗口内按轻/重攻击键 → 返回游龙回身标记 Strike
    if (this.machine.isInDodgeCounterWindow(time)) {
      const pressedLight = Phaser.Input.Keyboard.JustDown(this.keys.light);
      const pressedHeavy = Phaser.Input.Keyboard.JustDown(this.keys.heavy);
      if (pressedLight || pressedHeavy) {
        if (this.machine.consumeDodgeCounterWindow(time)) {
          // 返回一个带标记的 Strike：damage=0 占位，实际由 SkillSystem 形态化
          // 用 staminaDamage=-1 作为游龙回身派生信号（CombatDirector 识别）
          return {
            damage: 0,
            guardDamage: 0,
            staminaDamage: -1,
            blockDamageMultiplier: 0,
            staggerDuration: 0,
          };
        }
      }
    }
```

- [ ] **Step 2: 跑 lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: 全绿

- [ ] **Step 3: Commit**

```bash
git add src/game/player/Player.ts
git commit -m "feat(player): derive dragon-return strike from dodge counter window"
```

---

## Task 6: CombatDirector.handleSkills — 潜龙出渊 + 裂鳞破甲

**Files:**
- Modify: `src/game/director/CombatDirector.ts`

- [ ] **Step 1: 在 CombatDirector 顶部加 import 与字段**

在文件 import 区追加：

```typescript
import { SkillSystem, type SkillCastResult } from '../skills/SkillSystem';
import { SKILL_DEFS, type SkillId } from '../skills/skillDefs';
```

在类字段区（`private readonly auras` 附近）新增：

```typescript
  private readonly skillSystem: SkillSystem;
  private readonly skillKeyLurk: Phaser.Input.Keyboard.Key;
  private readonly skillKeyBreak: Phaser.Input.Keyboard.Key;
  /** 守护形态减伤窗口结束时间；0 表示无减伤。 */
  private guardReduceUntil = 0;
```

在构造函数末尾（`this.auraKey = ...` 后）加：

```typescript
    this.skillSystem = new SkillSystem(player.moral);
    this.skillKeyLurk = scene.input.keyboard!.addKey('I');
    this.skillKeyBreak = scene.input.keyboard!.addKey('O');
```

- [ ] **Step 2: 在 handleBladeAura 方法后新增 handleSkills 方法**

```typescript
  /**
   * 每帧处理潜龙出渊(I)与裂鳞破甲(O)的释放，以及游龙回身派生 Strike 的识别与释放。
   * 游龙回身由 Player.consumeAttack 返回带标记的 Strike 触发，本方法识别并交给 SkillSystem 形态化。
   */
  handleSkills(time: number, rawAttackStrike: Strike | null) {
    if (this.player.machine.isDead()) {
      return;
    }

    // 游龙回身派生：识别 consumeAttack 返回的标记 Strike
    if (rawAttackStrike && rawAttackStrike.staminaDamage === -1) {
      this.castSkill('dragonReturn', time);
      return;
    }

    // 潜龙出渊
    if (Phaser.Input.Keyboard.JustDown(this.skillKeyLurk)) {
      this.castSkill('dragonLurk', time);
      return;
    }

    // 裂鳞破甲
    if (Phaser.Input.Keyboard.JustDown(this.skillKeyBreak)) {
      this.castSkill('scaleBreak', time);
    }
  }

  private castSkill(id: SkillId, time: number) {
    const result = this.skillSystem.tryRelease(
      id,
      time,
      this.player.machine.state.soul,
      this.player.machine.state.maxHealth,
    );
    if (!result) {
      return;
    }
    this.player.machine.spendSoul(result.soulSpent);

    // 狂暴反噬
    if (result.selfHarm > 0) {
      this.player.machine.takeDamage(result.selfHarm);
    }
    // 守护减伤窗口
    if (result.guardReduceUntil !== null) {
      this.guardReduceUntil = result.guardReduceUntil;
    }

    this.executeSkillEffect(result, time);
  }

  private executeSkillEffect(cast: SkillCastResult, time: number) {
    const def = SKILL_DEFS[cast.skillId];
    this.sfx(cast.strike.damage >= 20 ? 'slashHeavy' : 'slashLight');

    // 潜龙出渊：突进
    if (cast.dashDistance > 0) {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      body.setVelocityX(this.player.facing * 780);
      this.scene.time.delayedCall(220, () => {
        if (this.player.active) {
          body.setVelocityX(0);
        }
      });
    }

    // 命中判定：按形态 rangeMultiplier 调整范围
    const baseRange = 92;
    const range = Math.round(baseRange * cast.rangeMultiplier);
    let landed = false;
    for (const enemy of this.enemies.activeEnemies) {
      if (
        enemy.active &&
        Math.abs(enemy.x - this.player.x) < range &&
        Math.abs(enemy.y - this.player.y) < 86
      ) {
        enemy.receiveStrike(cast.strike, time);
        landed = true;
        this.player.machine.addSoul(3);
        if (!enemy.active) {
          this.player.machine.addSoul(5);
          this.player.moral.addLiqi(10);
        }
      }
    }
    const boss = this.enemies.activeBoss;
    if (
      boss?.active &&
      Math.abs(boss.x - this.player.x) < Math.round(112 * cast.rangeMultiplier) &&
      Math.abs(boss.y - this.player.y) < 94
    ) {
      boss.receiveStrike(cast.strike, time);
      landed = true;
      if (!boss.active) {
        this.onBossDefeated();
      }
    }

    if (landed) {
      this.sfx('hit');
    }

    // 特效
    this.showSkillFx(cast.skillId);
  }

  /** 技能特效：潜龙=龙形光痕，回身=残影，破甲=冲击波圆环。颜色读 moral.bladeColor()。 */
  private showSkillFx(id: SkillId) {
    const color = this.player.moral.bladeColor();
    const x = this.player.x + this.player.facing * 48;
    const y = this.player.y - 8;

    if (id === 'dragonLurk') {
      const trail = this.scene.add
        .rectangle(x, y, 120, 14, color, 0.85)
        .setAngle(this.player.facing > 0 ? -12 : 12)
        .setDepth(40);
      this.scene.tweens.add({
        targets: trail,
        alpha: 0,
        scaleX: 1.6,
        duration: 180,
        onComplete: () => trail.destroy(),
      });
    } else if (id === 'dragonReturn') {
      const echo = this.scene.add
        .rectangle(x - this.player.facing * 30, y, 80, 10, color, 0.5)
        .setAngle(this.player.facing > 0 ? 18 : -18)
        .setDepth(39);
      this.scene.tweens.add({
        targets: echo,
        alpha: 0,
        duration: 240,
        onComplete: () => echo.destroy(),
      });
    } else {
      // scaleBreak 破甲冲击波
      const ring = this.scene.add
        .circle(this.player.x, y, 30, color, 0)
        .setStrokeStyle(3, color, 0.9)
        .setDepth(40);
      this.scene.tweens.add({
        targets: ring,
        radius: 70,
        alpha: 0,
        scale: 2.2,
        duration: 260,
        onComplete: () => ring.destroy(),
      });
    }
  }

  /** 当前是否处于守护形态减伤窗口（供 applyEnemyStrike 查询）。 */
  isGuardReduced(now: number): boolean {
    return now < this.guardReduceUntil;
  }

  get skillState(): SkillSystem {
    return this.skillSystem;
  }
```

- [ ] **Step 3: 修改 applyEnemyStrike 接入守护减伤**

在 `applyEnemyStrike` 方法中，`const result = CombatSystem.resolveStrike(...)` 之后、`if (result.wasPerfectGuard)` 之前，插入减伤处理：

```typescript
    // 守护形态减伤：减伤窗口内的伤害按比例折减
    if (this.isGuardReduced(time) && result.damageDealt > 0) {
      const reduced = Math.round(result.damageDealt * 0.7);
      state.health = Math.min(state.maxHealth, state.health + (result.damageDealt - reduced));
      result.damageDealt = reduced;
    }
```

- [ ] **Step 4: 跑 lint + typecheck + test**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 全绿

- [ ] **Step 5: Commit**

```bash
git add src/game/director/CombatDirector.ts
git commit -m "feat(combat): integrate SkillSystem for dragon-nine skills with form effects"
```

---

## Task 7: GameScene 接入 handleSkills

**Files:**
- Modify: `src/game/GameScene.ts`

- [ ] **Step 1: 修改 update，把 consumeAttack 的结果传给 handleSkills**

在 GameScene.update 中，找到：

```typescript
    this.flow.handleInvestigation();
    this.flow.handleStudyGate();
    this.combatDirector.handlePlayerAttack(time);
    this.combatDirector.handleBladeAura(time);
```

改为先取 attackStrike 再分流：

```typescript
    this.flow.handleInvestigation();
    this.flow.handleStudyGate();

    // 玩家攻击：consumeAttack 可能返回普通斩击或游龙回身派生标记
    const attackStrike = this.player.consumeAttack(time);
    if (attackStrike && attackStrike.staminaDamage === -1) {
      // 游龙回身派生：交给技能系统
      this.combatDirector.handleSkills(time, attackStrike);
    } else if (attackStrike) {
      this.combatDirector.applyPlayerAttack(attackStrike, time);
    }
    // 非派生时也轮询 I/O 键技能
    if (!attackStrike) {
      this.combatDirector.handleSkills(time, null);
    }
    this.combatDirector.handleBladeAura(time);
```

> 注意：这要求把 CombatDirector.handlePlayerAttack 拆成"取 strike"和"应用 strike"两段。下一步处理。

- [ ] **Step 2: 在 CombatDirector 把 handlePlayerAttack 拆出 applyPlayerAttack**

在 CombatDirector 中，将原 `handlePlayerAttack` 重命名为 `applyPlayerAttack(strike, time)`，并去掉内部的 `consumeAttack` 调用，改为接收参数：

```typescript
  /** 应用玩家普通攻击（轻/重斩或完美格挡反击）的命中判定与刀光。 */
  applyPlayerAttack(strike: Strike, time: number) {
    const empowered = this.player.machine.consumeCounterWindow(time);
    const finalStrike: Strike = empowered
      ? { ...strike, damage: Math.round(strike.damage * 1.6), guardDamage: 999 }
      : strike;

    this.sfx(empowered ? 'slashEmpowered' : strike.damage >= 24 ? 'slashHeavy' : 'slashLight');
    this.showSlash(empowered);

    let landed = false;
    for (const enemy of this.enemies.activeEnemies) {
      if (
        enemy.active &&
        Math.abs(enemy.x - this.player.x) < 92 &&
        Math.abs(enemy.y - this.player.y) < 86
      ) {
        enemy.receiveStrike(finalStrike, time);
        landed = true;
        this.player.machine.addSoul(3);
        if (!enemy.active) {
          this.player.machine.addSoul(5);
          this.player.moral.addLiqi(10);
        }
      }
    }

    const boss = this.enemies.activeBoss;
    if (
      boss?.active &&
      Math.abs(boss.x - this.player.x) < 112 &&
      Math.abs(boss.y - this.player.y) < 94
    ) {
      boss.receiveStrike(finalStrike, time);
      landed = true;
      if (!boss.active) {
        this.onBossDefeated();
      }
    }

    if (landed) {
      this.sfx('hit');
    }
  }
```

- [ ] **Step 3: 跑 lint + typecheck + test**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 全绿

- [ ] **Step 4: Commit**

```bash
git add src/game/director/CombatDirector.ts src/game/GameScene.ts
git commit -m "feat(scene): route player attack and skill casts through GameScene update"
```

---

## Task 8: HUD 技能状态条

**Files:**
- Modify: `src/game/ui/Hud.ts`

- [ ] **Step 1: 在 Hud 类加技能状态字段与构造**

在 Hud 类字段区（`private readonly audioStatus` 附近）新增：

```typescript
  private readonly skillIcons: Array<{ text: Phaser.GameObjects.Text; bg: Phaser.GameObjects.Rectangle }>;
```

在构造函数末尾（edgeGfx 创建之后）加：

```typescript
    // 技能状态条：左下角三式图标 + 冷却暗化
    const skillIds: Array<{ label: string; x: number }> = [
      { label: '潜', x: 24 },
      { label: '回', x: 74 },
      { label: '裂', x: 124 },
    ];
    this.skillIcons = skillIds.map((s) => {
      const bg = scene.add.rectangle(s.x, 652, 42, 42, 0x121319, 0.85).setOrigin(0).setScrollFactor(0).setDepth(100);
      const text = scene.add
        .text(s.x + 21, 673, s.label, {
          color: '#d7bf83',
          fontFamily: 'serif',
          fontSize: '22px',
          stroke: '#050608',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(101);
      return { text, bg };
    });
```

- [ ] **Step 2: 在 update 方法末尾调用技能状态更新**

在 `updateEdgeTint(player)` 之后加：

```typescript
    this.updateSkillIcons(player, time);
```

并在 `update` 下方新增方法（需要给 update 加 time 参数）：

> 注意：Hud.update 原签名是 `update(player, story)`，需改为 `update(player, story, time)`，并同步修改 GameScene.update 里的调用 `this.hud.update(this.player, this.story, time)`。

```typescript
  /** 更新技能图标：冷却中暗化，龙魂不足变灰。 */
  private updateSkillIcons(player: Player, time: number) {
    const skillSystem = player.scene.registry.get('skillSystem') as
      | { cooldownRemaining: (id: string, now: number) => number }
      | undefined;
    // GameScene 会把 CombatDirector.skillSystem 注入 registry，供 HUD 读取
    // 若未注入则跳过（保持图标默认显示）
    if (!skillSystem) {
      return;
    }
    const ids = ['dragonLurk', 'dragonReturn', 'scaleBreak'] as const;
    const costs = [15, 10, 25];
    for (let i = 0; i < this.skillIcons.length; i++) {
      const icon = this.skillIcons[i];
      const cd = skillSystem.cooldownRemaining(ids[i], time);
      const soulEnough = player.machine.state.soul >= costs[i];
      const dim = cd > 0 || !soulEnough;
      icon.bg.setFillStyle(0x121319, dim ? 0.95 : 0.85);
      icon.text.setAlpha(dim ? 0.4 : 1);
      icon.text.setColor(!soulEnough ? '#6a6a6a' : cd > 0 ? '#8a7a5a' : '#d7bf83');
    }
  }
```

- [ ] **Step 3: 修改 Hud.update 签名加 time 参数**

将 `update(player: Player, story: StoryFlags)` 改为 `update(player: Player, story: StoryFlags, time: number)`。

- [ ] **Step 4: 修改 GameScene.update 的 hud 调用加 time**

将 `this.hud.update(this.player, this.story)` 改为 `this.hud.update(this.player, this.story, time)`。

- [ ] **Step 5: 在 GameScene.create 注入 skillSystem 到 registry**

在 GameScene.create 中 `this.hud = new Hud(this)` 之前加：

```typescript
    this.registry.set('skillSystem', this.combatDirector.skillState);
```

- [ ] **Step 6: 跑 lint + typecheck + test**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 全绿

- [ ] **Step 7: Commit**

```bash
git add src/game/ui/Hud.ts src/game/GameScene.ts
git commit -m "feat(hud): add skill status icons with cooldown dimming and soul gating"
```

---

## Task 9: 更新操作提示文本

**Files:**
- Modify: `src/game/GameScene.ts`

- [ ] **Step 1: 修改底部操作提示，加入 I/O 技能键**

将：

```typescript
      .text(22, 684, '移动 WASD/方向键  闪避 Space  轻斩 J  重斩 K  格挡 L  刀气 U  调查 E', {
```

改为：

```typescript
      .text(22, 700, '移动 WASD  闪避Space  轻斩J 重斩K 格挡L 刀气U 潜龙I 裂鳞O 调查E', {
```

- [ ] **Step 2: 跑 lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: 全绿

- [ ] **Step 3: Commit**

```bash
git add src/game/GameScene.ts
git commit -m "docs(ui): update controls hint with skill keys I/O"
```

---

## Task 10: 运行时端到端验证

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

创建 `diagnose.mjs`（验证 SkillSystem 释放、形态化、游龙回身派生、HUD 图标）：

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
await page.waitForFunction('window.__game.scene.getScene("GameScene").player', { timeout: 8000 });

const result = await page.evaluate(() => {
  const scene = window.__game.scene.getScene('GameScene');
  const player = scene.player;
  const combat = scene.combatDirector;
  const skills = combat.skillState;

  // 给足龙魂
  player.machine.addSoul(100);
  const soulBefore = player.machine.state.soul;

  // 1. 潜龙出渊（标准形态）
  const r1 = skills.tryRelease('dragonLurk', 1000, player.machine.state.soul, player.machine.state.maxHealth);
  player.machine.spendSoul(r1.soulSpent);

  // 2. 切狂暴形态后释放裂鳞
  player.moral.addLiqi(60);
  const r2 = skills.tryRelease('scaleBreak', 2000, player.machine.state.soul, player.machine.state.maxHealth);
  player.machine.spendSoul(r2.soulSpent);
  const hpAfterWrath = player.machine.state.health;

  // 3. 切守护形态后释放潜龙
  player.moral.reset();
  player.moral.addShouxin(60);
  player.machine.addSoul(50);
  const r3 = skills.tryRelease('dragonLurk', 3000, player.machine.state.soul, player.machine.state.maxHealth);
  player.machine.spendSoul(r3.soulSpent);

  // 4. 游龙回身派生：闪避后窗口
  player.moral.reset();
  player.machine.state.stamina = 40;
  player.machine.tryDodge(4000);
  const inWindow = player.machine.isInDodgeCounterWindow(4100);
  const consumed = player.machine.consumeDodgeCounterWindow(4100);

  return {
    soulBefore,
    lurkDamage: r1.strike.damage,
    wrathScaleDamage: r2.strike.damage,
    wrathSelfHarm: r2.selfHarm,
    hpAfterWrath,
    guardReduceUntil: r3.guardReduceUntil,
    inWindow,
    consumed,
  };
});

console.log(JSON.stringify(result, null, 2));
const ok =
  result.lurkDamage === 16 &&
  result.wrathScaleDamage === Math.round(22 * 1.4) &&
  result.wrathSelfHarm > 0 &&
  result.hpAfterWrath < 120 &&
  result.guardReduceUntil !== null &&
  result.inWindow && result.consumed;
console.log(ok ? '\n✅ M3 端到端通过' : '\n❌ M3 异常');
if (logs.length) console.log(logs.join('\n'));
await browser.close();
```

Run: `node diagnose.mjs`
Expected: `✅ M3 端到端通过`

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

- ✅ Spec 覆盖：三式、形态切换、游龙回身派生、UI、测试均有对应任务
- ✅ 无占位符：每步含完整代码与命令
- ✅ 类型一致：SkillId/SkillCastResult/SkillFormModifier 命名跨任务一致
- ✅ DRY：DODGE_COUNTER_WINDOW_MS 在 Task 4 去重为单一来源
