# 狂暴误伤 NPC 判定 + 攻击致死求饶者 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地"力量失控波及无辜"玩法后果——狂暴形态大范围技能波及村民 NPC 记戾气 + NPC 受伤（保底不致死）；玩家直接攻击致死已求饶探子记 killedScout + 戾气。

**Architecture:** 新增纯模块 `allyCasualty.ts`（`isAllyWithinRange` 纯函数，无 Phaser 依赖，可单测），遵循现有 `surrender.ts`/`endingMoralSuffix.ts` 纯模块模式。`SkillFormModifier` 加 `hitsAllies?: boolean` 字段（仅 wrath 为 true），`SkillCastResult` 透传。`Npc` 加 `injured` 标志 + `takeDamage()` 幂等方法（保底不致死，首次返回 true）。`CombatDirector` 构造加 story + npcs 依赖，`executeSkillEffect` 加误伤判定（排除游龙回身）+ 求饶致死判定，`applyPlayerAttack` 加求饶致死判定。

**Tech Stack:** TypeScript strict、Phaser 3.90、vitest（遵循现有惯例显式 `import { describe, expect, it } from 'vitest'`）。

**验证基线：** 完成每个任务后跑 `npm run lint && npm run typecheck && npm test`，三者全绿方可继续。

---

## 文件结构

**新增：**
- `src/game/entities/allyCasualty.ts` — `isAllyWithinRange` 纯函数（无 Phaser 依赖）
- `tests/ally-casualty.test.ts` — 纯函数单测

**修改：**
- `src/game/skills/skillDefs.ts` — `SkillFormModifier` 加 `hitsAllies?: boolean`；wrath 形态加 `hitsAllies: true`
- `src/game/skills/SkillSystem.ts` — `SkillCastResult` 加 `hitsAllies: boolean`；`tryRelease` 透传
- `src/game/entities/Npc.ts` — 加 `injured` 字段 + `takeDamage()` 方法
- `src/game/director/CombatDirector.ts` — 构造加 story + npcs；executeSkillEffect 误伤 + 求饶致死；applyPlayerAttack 求饶致死
- `src/game/GameScene.ts` — CombatDirector 构造传入 story + npcs

---

## Task 1: allyCasualty 纯函数（TDD）

**Files:**
- Test: `tests/ally-casualty.test.ts`
- Create: `src/game/entities/allyCasualty.ts`

- [ ] **Step 1: 写失败测试 tests/ally-casualty.test.ts**

```typescript
import { describe, expect, it } from 'vitest';
import { isAllyWithinRange } from '../src/game/entities/allyCasualty';

describe('isAllyWithinRange', () => {
  it('returns true when ally is within range', () => {
    expect(isAllyWithinRange(100, 100, 100, 100, 92, 86)).toBe(true);
    expect(isAllyWithinRange(180, 150, 100, 100, 92, 86)).toBe(true);
  });

  it('returns false when ally is outside range horizontally', () => {
    expect(isAllyWithinRange(200, 100, 100, 100, 92, 86)).toBe(false);
    expect(isAllyWithinRange(0, 100, 100, 100, 92, 86)).toBe(false);
  });

  it('returns false when ally is outside range vertically', () => {
    expect(isAllyWithinRange(100, 200, 100, 100, 92, 86)).toBe(false);
    expect(isAllyWithinRange(100, 0, 100, 100, 92, 86)).toBe(false);
  });

  it('returns false at exact boundary (strict less-than)', () => {
    expect(isAllyWithinRange(192, 100, 100, 100, 92, 86)).toBe(false);
    expect(isAllyWithinRange(100, 186, 100, 100, 92, 86)).toBe(false);
  });

  it('handles negative direction (ally to the left/up)', () => {
    expect(isAllyWithinRange(20, 100, 100, 100, 92, 86)).toBe(true);
    expect(isAllyWithinRange(100, 20, 100, 100, 92, 86)).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- ally-casualty`
Expected: FAIL — `Cannot find module '../src/game/entities/allyCasualty'`

- [ ] **Step 3: 创建 src/game/entities/allyCasualty.ts**

```typescript
/**
 * 判定一个点是否在以另一个点为中心的矩形范围内。
 * 纯几何函数，不依赖 Phaser，可独立单测。
 */
export const isAllyWithinRange = (
  allyX: number,
  allyY: number,
  originX: number,
  originY: number,
  rangeX: number,
  rangeY: number,
): boolean => Math.abs(allyX - originX) < rangeX && Math.abs(allyY - originY) < rangeY;
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- ally-casualty`
Expected: PASS — 5 tests

- [ ] **Step 5: 跑 lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: 全绿

- [ ] **Step 6: Commit**

```bash
git add src/game/entities/allyCasualty.ts tests/ally-casualty.test.ts
git commit -m "feat(entities): add isAllyWithinRange pure function for ally casualty detection"
```

---

## Task 2: SkillFormModifier + SkillCastResult 加 hitsAllies

**Files:**
- Modify: `src/game/skills/skillDefs.ts`
- Modify: `src/game/skills/SkillSystem.ts`

- [ ] **Step 1: 在 skillDefs.ts 的 SkillFormModifier 加 hitsAllies 字段**

将 `SkillFormModifier` 类型定义改为：

```typescript
export type SkillFormModifier = {
  damageMultiplier: number;
  rangeMultiplier: number;
  /** 狂暴形态：释放者承受的自伤（占最大生命比例）。 */
  selfHarmRatio?: number;
  /** 守护形态：释放后减伤持续时间(ms)与减伤比例。 */
  guardReduceUntil?: { durationMs: number; ratio: number };
  /** 狂暴形态：大范围技能是否波及盟友（村民 NPC）。仅 wrath 为 true。 */
  hitsAllies?: boolean;
};
```

- [ ] **Step 2: 在 SKILL_FORM_MODIFIERS.wrath 加 hitsAllies: true**

将 wrath 形态定义改为：

```typescript
  wrath: { damageMultiplier: 1.4, rangeMultiplier: 1.3, selfHarmRatio: 0.08, hitsAllies: true },
```

- [ ] **Step 3: 在 SkillSystem.ts 的 SkillCastResult 加 hitsAllies 字段**

在 `SkillCastResult` 类型中，`form: SkillFormModifier;` 之前加：

```typescript
  /** 狂暴形态：本次释放是否波及盟友。供 CombatDirector 做误伤判定。 */
  hitsAllies: boolean;
```

- [ ] **Step 4: 在 SkillSystem.ts 的 tryRelease 返回值透传 hitsAllies**

在 `tryRelease` 方法的 return 对象中，`form,` 之前加：

```typescript
      hitsAllies: form.hitsAllies ?? false,
```

- [ ] **Step 5: 跑现有 skill-system 测试确认无破坏**

Run: `npm test -- skill-system`
Expected: PASS — 10 tests（现有测试不检查 hitsAllies，新增字段不影响）

- [ ] **Step 6: 跑 lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: 全绿

- [ ] **Step 7: Commit**

```bash
git add src/game/skills/skillDefs.ts src/game/skills/SkillSystem.ts
git commit -m "feat(skills): add hitsAllies to SkillFormModifier and SkillCastResult for wrath form"
```

---

## Task 3: Npc 加 injured 字段 + takeDamage 方法

**Files:**
- Modify: `src/game/entities/Npc.ts`

- [ ] **Step 1: 在 Npc 类加 injured 字段**

在 `talked = false;` 之后加：

```typescript
  /** 是否已被误伤（保底不致死，仅标记 + 视觉反馈）。 */
  injured = false;
```

- [ ] **Step 2: 在 Npc 类加 takeDamage 方法**

在 `markTalked()` 方法之后加：

```typescript
  /**
   * 受伤标记：首次受伤设 injured + 泛红视觉，返回 true；
   * 已受伤则仅刷新视觉，返回 false（幂等，防刷值）。
   */
  takeDamage(): boolean {
    if (this.injured) {
      return false;
    }
    this.injured = true;
    this.setTint(0xff5b5b);
    this.nameplate.setColor('#ff8a6a');
    return true;
  }
```

- [ ] **Step 3: 跑 lint + typecheck + test**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 全绿（新方法未被调用，不影响现有测试）

- [ ] **Step 4: Commit**

```bash
git add src/game/entities/Npc.ts
git commit -m "feat(npc): add injured flag and takeDamage method with mercy floor"
```

---

## Task 4: CombatDirector 加 story + npcs 依赖 + 误伤/求饶致死判定

**Files:**
- Modify: `src/game/director/CombatDirector.ts`

这是核心集成任务。改动分四部分：构造加依赖、import、applyPlayerAttack 求饶致死、executeSkillEffect 误伤 + 求饶致死。

- [ ] **Step 1: 在 CombatDirector.ts 顶部加 import**

在现有 import 区追加（注意 `isAllyWithinRange` 是值导入，`StoryFlags`/`Npc` 是类型导入）：

```typescript
import { isAllyWithinRange } from '../entities/allyCasualty';
import type { StoryFlags } from '../story/StoryFlags';
import type { Npc } from '../entities/Npc';
```

- [ ] **Step 2: 修改构造函数签名加 story + npcs 参数**

将现有构造函数：

```typescript
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly enemies: EnemyDirector,
    private readonly hud: Hud,
    sfx: (name: SfxName) => void,
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

改为（在 sfx 后、onBossDefeated 前插入 story + npcs）：

```typescript
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly enemies: EnemyDirector,
    private readonly hud: Hud,
    sfx: (name: SfxName) => void,
    private readonly story: StoryFlags,
    private readonly npcs: readonly Npc[],
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

> 注：`onBossDefeated` 当前是 `private onBossDefeated: () => void;` 字段 + 构造内 `this.onBossDefeated = onBossDefeated;` 赋值（因为它不是 `private readonly` 参数属性）。保持此模式不变——只插入两个新的 `private readonly` 参数（story/npcs 会自动成为类属性）。

- [ ] **Step 3: 在 applyPlayerAttack 的击杀判定加求饶致死**

将 `applyPlayerAttack` 中 enemies 循环的击杀块：

```typescript
        if (!enemy.active) {
          this.player.machine.addSoul(5);
          this.player.moral.addLiqi(10);
        }
```

改为：

```typescript
        if (!enemy.active) {
          this.player.machine.addSoul(5);
          this.player.moral.addLiqi(10);
          if (enemy.kind === 'scout' && enemy.isSurrendered) {
            this.story.recordChoice('killedScout');
            this.player.moral.addLiqi(20);
            this.hud.showSubtitle('求饶的探子死在你的刀下。');
          }
        }
```

- [ ] **Step 4: 在 executeSkillEffect 的击杀判定加求饶致死**

将 `executeSkillEffect` 中 enemies 循环的击杀块：

```typescript
        if (!enemy.active) {
          this.player.machine.addSoul(5);
          this.player.moral.addLiqi(10);
        }
```

改为：

```typescript
        if (!enemy.active) {
          this.player.machine.addSoul(5);
          this.player.moral.addLiqi(10);
          if (enemy.kind === 'scout' && enemy.isSurrendered) {
            this.story.recordChoice('killedScout');
            this.player.moral.addLiqi(20);
            this.hud.showSubtitle('求饶的探子死在你的刀下。');
          }
        }
```

- [ ] **Step 5: 在 executeSkillEffect 的 showSkillFx 前加误伤判定**

在 `if (landed) { this.sfx('hit'); }` 之后、`this.showSkillFx(cast.skillId);` 之前，插入误伤判定：

```typescript
    // 狂暴误伤判定：大范围技能波及村民 NPC（游龙回身是精准反击，不波及）
    if (cast.form.hitsAllies && cast.skillId !== 'dragonReturn') {
      let harmedNewAlly = false;
      for (const npc of this.npcs) {
        if (!npc.active) {
          continue;
        }
        if (isAllyWithinRange(npc.x, npc.y, this.player.x, this.player.y, range, 86)) {
          if (npc.takeDamage()) {
            harmedNewAlly = true;
          }
        }
      }
      if (harmedNewAlly) {
        this.player.moral.addLiqi(12);
        this.hud.showSubtitle('刀气擦过村民——你差点伤到了无辜的人。');
      }
    }

    this.showSkillFx(cast.skillId);
```

- [ ] **Step 6: 跑 lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: typecheck FAIL — GameScene 的 CombatDirector 构造调用还未更新（少了 story + npcs 参数）。这是预期的，Task 5 会修复。本步只确认 CombatDirector 自身类型无误（lint 应通过，typecheck 报错在 GameScene.ts）。

> 若 lint 也报错则需先修 lint。若仅 typecheck 报 GameScene 的参数不匹配，继续 Task 5。

- [ ] **Step 7: Commit（暂不跑全量 test，因 GameScene 未适配）**

```bash
git add src/game/director/CombatDirector.ts
git commit -m "feat(combat): add ally casualty detection and surrender-kill judgment to CombatDirector"
```

---

## Task 5: GameScene 适配 CombatDirector 新构造签名

**Files:**
- Modify: `src/game/GameScene.ts`

- [ ] **Step 1: 修改 CombatDirector 构造调用，传入 story + npcs**

将 GameScene.create 中现有的 CombatDirector 构造：

```typescript
    this.combatDirector = new CombatDirector(
      this,
      this.player,
      this.enemyDirector,
      this.hud,
      this.sfx,
      () => {
        if (!this.flow.endingStarted) {
          this.flow.startEnding();
        }
      },
    );
```

改为（在 this.sfx 后插入 this.story + this.npcs）：

```typescript
    this.combatDirector = new CombatDirector(
      this,
      this.player,
      this.enemyDirector,
      this.hud,
      this.sfx,
      this.story,
      this.npcs,
      () => {
        if (!this.flow.endingStarted) {
          this.flow.startEnding();
        }
      },
    );
```

- [ ] **Step 2: 跑全量验证**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 全绿（73 tests + 5 新 ally-casualty tests = 78 tests，10 files + 1 = 11 files）

- [ ] **Step 3: Commit**

```bash
git add src/game/GameScene.ts
git commit -m "feat(scene): pass story and npcs to CombatDirector for casualty and surrender-kill"
```

---

## Task 6: 运行时端到端验证

**Files:**
- 无新文件；临时诊断脚本（验证后删除）

- [ ] **Step 1: 确认 dev 服务在跑**

Run: `curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:5173/`
Expected: HTTP 200（若非 200，`nohup npm run dev > /tmp/vite-dev.log 2>&1 &` 重启）

- [ ] **Step 2: 临时暴露 __game**

在 `src/main.ts` 临时把 `new Phaser.Game(config);` 改为：

```typescript
const game = new Phaser.Game(config);
(window as unknown as { __game: Phaser.Game }).__game = game;
```

- [ ] **Step 3: 写诊断脚本 diagnose-m5.mjs**

```javascript
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--no-sandbox'] });
const page = await browser.newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') logs.push(`[CONSOLE] ${msg.text()}`);
});

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction('window.__game && window.__game.scene.getScene("GameScene").combatDirector', { timeout: 10000 });

const result = await page.evaluate(() => {
  const scene = window.__game.scene.getScene('GameScene');
  const player = scene.player;
  const story = scene.story;
  const combat = scene.combatDirector;
  const moral = player.moral;
  const npcs = scene.npcs;

  // 1. 误伤判定：切狂暴形态，对准 NPC 释放潜龙出渊
  moral.reset();
  moral.addLiqi(60); // wrath
  player.machine.state.soul = 100;

  const villagerNpc = npcs.find((n) => n.dialogId === 'villager');
  // 把村民移到玩家旁边确保在范围内
  villagerNpc.x = player.x + 50;
  villagerNpc.y = player.y;
  const injuredBefore = villagerNpc.injured;

  // 释放潜龙出渊（狂暴形态，hitsAllies=true）
  combat.skillSystem.recordCast('dragonLurk', 0); // 重置冷却
  const cast = combat.skillSystem.tryRelease('dragonLurk', 1000, player.machine.state.soul, player.machine.state.maxHealth);
  if (cast) {
    player.machine.spendSoul(cast.soulSpent);
    combat.executeSkillEffect(cast, 1000);
  }
  const injuredAfter = villagerNpc.injured;
  const liqiAfterWrath = moral.liqi;

  // 2. 平衡形态释放潜龙不应误伤（新 NPC 重置）
  moral.reset();
  villagerNpc.injured = false;
  villagerNpc.clearTint();
  player.machine.state.soul = 100;
  combat.skillSystem.recordCast('dragonLurk', 0);
  const cast2 = combat.skillSystem.tryRelease('dragonLurk', 2000, player.machine.state.soul, player.machine.state.maxHealth);
  if (cast2) {
    player.machine.spendSoul(cast2.soulSpent);
    combat.executeSkillEffect(cast2, 2000);
  }
  const injuredAfterBalance = villagerNpc.injured;

  // 3. 攻击致死求饶者：让 scout 求饶后用普攻砍死
  moral.reset();
  const scout = scene.enemyDirector.activeEnemies.find((e) => e.kind === 'scout');
  // 触发求饶（大伤害保底1血）
  scout.combatState.health = 42;
  scout.receiveStrike({ damage: 45, guardDamage: 0, staminaDamage: 0, blockDamageMultiplier: 0, staggerDuration: 0 }, 3000);
  const surrendered = scout.isSurrendered;
  // 移到玩家旁边并砍死
  scout.x = player.x + 50;
  scout.y = player.y;
  const killedBefore = story.hasChoice('killedScout');
  // 用重斩砍死（scout 已 1 血）
  const heavyStrike = { damage: 24, guardDamage: 28, staminaDamage: 14, blockDamageMultiplier: 0.3, staggerDuration: 420 };
  combat.applyPlayerAttack(heavyStrike, 3100);
  const killedAfter = story.hasChoice('killedScout');
  const liqiAfterKill = moral.liqi;

  return {
    injuredBefore,
    injuredAfter,
    liqiAfterWrath,
    injuredAfterBalance,
    surrendered,
    killedBefore,
    killedAfter,
    liqiAfterKill,
  };
});

console.log(JSON.stringify(result, null, 2));
const ok =
  result.injuredBefore === false &&
  result.injuredAfter === true &&
  result.liqiAfterWrath >= 12 &&
  result.injuredAfterBalance === false &&
  result.surrendered === true &&
  result.killedBefore === false &&
  result.killedAfter === true &&
  result.liqiAfterKill >= 20;
console.log(ok ? '\n✅ M5 端到端通过' : '\n❌ M5 异常');
if (logs.length) console.log(logs.join('\n'));
await browser.close();
process.exit(ok ? 0 : 1);
```

- [ ] **Step 4: 运行诊断脚本**

Run: `node diagnose-m5.mjs`
Expected: `✅ M5 端到端通过`

> 若 playwright 未安装，先 `npm install --no-save playwright && npx playwright install chromium`。

- [ ] **Step 5: 移除调试代码**

将 `src/main.ts` 改回 `new Phaser.Game(config);`，删除 `diagnose-m5.mjs`。

- [ ] **Step 6: 最终三件套验证**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 全绿

- [ ] **Step 7: Commit**

```bash
git add src/main.ts
git commit -m "chore: remove debug game instance exposure"
```

---

## Self-Review 已完成

- ✅ Spec 覆盖：allyCasualty 纯函数（Task 1）、SkillFormModifier+SkillCastResult hitsAllies（Task 2）、Npc takeDamage（Task 3）、CombatDirector 误伤+求饶致死（Task 4）、GameScene 装配（Task 5）、端到端验证（Task 6）均有对应任务
- ✅ 无占位符：每步含完整代码与命令
- ✅ 类型一致：isAllyWithinRange / hitsAllies / injured / takeDamage / isSurrendered / killedScout 跨任务命名一致
- ✅ TDD：allyCasualty 纯函数先写失败测试再实现
- ✅ 边界守住：保护村民留 M6、NPC 保底不致死、游龙回身排除误伤、killedScout 复用 M4 文案
