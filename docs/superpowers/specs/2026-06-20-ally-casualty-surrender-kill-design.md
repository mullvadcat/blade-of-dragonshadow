# M5 设计：狂暴误伤 NPC 判定 + 攻击致死求饶者

> 状态：已批准（2026-06-20）
> 上游里程碑：M0-M4 已完成
> 下游：M6（保护村民道德事件，与 GDD 第五章"保护 NPC + 限场地破坏"机制契合）

## 1. 目标

落地"力量失控波及无辜"的玩法后果，深化"力量的克制"主题：
- 狂暴形态释放大范围技能（潜龙出渊 / 裂鳞破甲）波及村民 NPC 时，NPC 受伤（保底不致死）+ 记戾气 + 视觉/字幕反馈，让玩家感知"追求伤害的大范围招式会伤及无辜"。
- 玩家直接攻击致死已求饶的探子时，记 `killedScout` + 戾气（复用 M4 对话处决的 ChoiceId 与结局文案，不新增变体）。

## 2. 关键决策（已与用户确认）

- **范围**：误伤 NPC 判定 + 攻击致死求饶者；保护村民道德事件（`protectedVillager`）留 M6。
- **误伤伤害模型**：NPC 受伤但不致死——用 `injured: boolean` 标志（非生命值），`takeDamage()` 幂等（返回是否首次受伤），泛红视觉 + 惊叫字幕反馈。避免破坏线索流程（第四线索村民不能死）。
- **误伤判定架构**：纯模块 `allyCasualty.ts`（`isAllyWithinRange` 纯函数，无 Phaser 依赖，可单测）+ `SkillFormModifier` 加 `hitsAllies` 字段 + `CombatDirector.executeSkillEffect` 调用。遵循现有 `surrender.ts` / `endingMoralSuffix.ts` 纯模块模式。
- **误伤触发条件**：仅狂暴形态（`hitsAllies: true`）+ 大范围技能（潜龙出渊 / 裂鳞破甲）。游龙回身（闪避后精准反击，不追求大范围）和普攻不误伤——主题上是"追求伤害的大范围招式"才波及无辜。
- **攻击致死求饶者**：复用 `killedScout` ChoiceId（与 M4 对话处决同一记录），戾气 +20（等同对话处决，分量在"杀了求饶者"事实而非路径）。结局文案不新增变体（M4 的 killedScout 段已覆盖）。

## 3. 架构

```
src/game/entities/
├── allyCasualty.ts   # 新增：isAllyWithinRange 纯函数（无 Phaser 依赖，可单测）
├── Npc.ts            # 修改：加 injured 标志 + takeDamage() 方法
└── Enemy.ts          # 无改动（isSurrendered/kind 已就绪）

src/game/skills/
├── skillDefs.ts      # 修改：SkillFormModifier 加 hitsAllies?: boolean；wrath 形态设 true
└── SkillSystem.ts    # 修改：SkillCastResult 透传 hitsAllies

src/game/director/
└── CombatDirector.ts # 修改：构造加 story + npcs；executeSkillEffect 误伤判定；击杀求饶 scout 判定

src/game/
└── GameScene.ts      # 修改：CombatDirector 构造传入 story + npcs
```

**职责边界：**
- `allyCasualty.ts`：纯几何判定——一个点是否在以另一个点为中心的矩形范围内。不依赖 Phaser，不依赖 Npc 类型。
- `SkillFormModifier.hitsAllies`：形态级标记——该形态的技能是否会波及盟友。数据定义在 skillDefs。
- `Npc.takeDamage()`：NPC 受伤状态机——首次受伤设 injured + 泛红视觉，返回是否首次（供调用方决定是否记戾气）。幂等：重复调用只刷新视觉，不重复返回 true。
- `CombatDirector`：编排——在技能命中阶段调用纯函数判定误伤，在击杀阶段判定求饶者致死。需要 story（记 choice）和 npcs（误伤判定）两个新依赖。

**数据流：**
```
CombatDirector.executeSkillEffect(cast, time)
  ├─ 命中 enemies/boss（现有逻辑不变）
  ├─ 误伤判定（新增）：
  │    if cast.form.hitsAllies && cast.skillId !== 'dragonReturn':
  │      let harmedNewAlly = false
  │      for npc of npcs:
  │        if npc.active && isAllyWithinRange(npc.x, npc.y, player.x, player.y, range, 86):
  │          if npc.takeDamage():  // 首次受伤返回 true
  │            harmedNewAlly = true
  │      if harmedNewAlly:
  │        player.moral.addLiqi(12)
  │        hud.showSubtitle('刀气擦过村民——你差点伤到了无辜的人。')
  ├─ 击杀求饶 scout 判定（新增，见下）
  └─ showSkillFx（现有）

CombatDirector.applyPlayerAttack(strike, time)  // 普通攻击
  └─ 命中 enemy 后：
       enemy.receiveStrike(...)
       if !enemy.active:  // 击杀
         player.machine.addSoul(5) / moral.addLiqi(10)  // 现有
         if enemy.kind === 'scout' && enemy.isSurrendered:  // 新增
           story.recordChoice('killedScout')
           player.moral.addLiqi(20)
           hud.showSubtitle('求饶的探子死在你的刀下。')

CombatDirector.executeSkillEffect(cast, time)  // 技能攻击
  └─ 命中 enemy 后（循环内）：
       enemy.receiveStrike(...)
       if !enemy.active:  // 击杀
         player.machine.addSoul(5) / moral.addLiqi(10)  // 现有
         if enemy.kind === 'scout' && enemy.isSurrendered:  // 新增
           story.recordChoice('killedScout')
           player.moral.addLiqi(20)
           hud.showSubtitle('求饶的探子死在你的刀下。')
```

> 注：`enemy.isSurrendered` 在 `defeat()`（含 `destroy()`）后仍可读——`surrendered` 是普通 boolean 字段，Phaser destroy 只移除显示/物理体，不清除 JS 对象属性。现有代码已在 `!enemy.active` 后访问 `enemy`（读 active/addSoul），同一模式。

## 4. 组件设计

### 4.1 allyCasualty.ts（纯模块，可单测）

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

### 4.2 skillDefs.ts 扩展

`SkillFormModifier` 加可选字段：
```typescript
export type SkillFormModifier = {
  damageMultiplier: number;
  rangeMultiplier: number;
  selfHarmRatio?: number;
  guardReduceUntil?: { durationMs: number; ratio: number };
  /** 狂暴形态：大范围技能是否波及盟友（村民 NPC）。仅 wrath 为 true。 */
  hitsAllies?: boolean;
};
```

`SKILL_FORM_MODIFIERS.wrath` 加 `hitsAllies: true`：
```typescript
wrath: { damageMultiplier: 1.4, rangeMultiplier: 1.3, selfHarmRatio: 0.08, hitsAllies: true },
```

balance / guard 不加此字段（undefined， falsy）。

### 4.3 SkillSystem.ts 透传

`SkillCastResult` 加字段：
```typescript
/** 狂暴形态：本次释放是否波及盟友。供 CombatDirector 做误伤判定。 */
hitsAllies: boolean;
```

`tryRelease` 返回值加：
```typescript
hitsAllies: form.hitsAllies ?? false,
```

### 4.4 Npc.ts 扩展

加字段与方法：
```typescript
  /** 是否已被误伤（保底不致死，仅标记 + 视觉反馈）。 */
  injured = false;

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

### 4.5 CombatDirector.ts 扩展

**构造加 story + npcs 参数：**

现有构造：
```typescript
constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly enemies: EnemyDirector,
    private readonly hud: Hud,
    sfx: (name: SfxName) => void,
    onBossDefeated: () => void,
)
```

改为：
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
)
```

需在顶部加 `import type { StoryFlags } from '../story/StoryFlags';` 和 `import type { Npc } from '../entities/Npc';` 和 `import { isAllyWithinRange } from '../entities/allyCasualty';`。

**executeSkillEffect 加误伤判定 + 求饶致死判定：**

在现有命中 enemies 循环中，击杀 enemy 后加求饶判定。在 enemies/boss 命中后、`showSkillFx` 前，加误伤判定。

误伤判定（仅 `cast.form.hitsAllies && cast.skillId !== 'dragonReturn'`）：
```typescript
    // 狂暴误伤判定：大范围技能波及村民 NPC
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
```

求饶致死判定（在 enemies 循环内，`if (!enemy.active)` 块中追加）：
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

**applyPlayerAttack 加求饶致死判定：**

在现有 enemies 循环的 `if (!enemy.active)` 块中追加同样的求饶判定。

### 4.6 GameScene.ts 适配

CombatDirector 构造调用传入 story + npcs：
```typescript
    this.combatDirector = new CombatDirector(
      this,
      this.player,
      this.enemyDirector,
      this.hud,
      this.sfx,
      this.story,
      this.npcs,
      () => { ... },
    );
```

## 5. 测试（TDD）

**`tests/ally-casualty.test.ts`：**
- `isAllyWithinRange` 范围内返回 true
- 范围外返回 false
- 边界值（刚好等于 rangeX/rangeY）返回 false（严格小于）
- 不同象限（左/右/上/下）均正确

**无新增 endingMoralSuffix 测试**——killedScout 复用 M4 文案，现有 5 tests 已覆盖（`choices.includes('killedScout')` 段已测）。

## 6. 文件清单

**新增：**
- `src/game/entities/allyCasualty.ts`
- `tests/ally-casualty.test.ts`

**修改：**
- `src/game/skills/skillDefs.ts` — SkillFormModifier 加 hitsAllies；wrath 形态加 hitsAllies: true
- `src/game/skills/SkillSystem.ts` — SkillCastResult 加 hitsAllies；tryRelease 透传
- `src/game/entities/Npc.ts` — 加 injured 字段 + takeDamage() 方法
- `src/game/director/CombatDirector.ts` — 构造加 story + npcs；executeSkillEffect 误伤 + 求饶致死判定；applyPlayerAttack 求饶致死判定
- `src/game/GameScene.ts` — CombatDirector 构造传入 story + npcs

## 7. 边界与不做

- 不做保护村民道德事件（`protectedVillager` 留 M6，与 GDD 第五章"保护 NPC + 限场地破坏"机制契合）
- 不做 NPC 真伤害致死（保底 injured 不死，避免破坏第四线索流程）
- 不做普攻 / 游龙回身误伤（仅狂暴形态大范围技能：潜龙出渊 / 裂鳞破甲）
- 不做误伤 NPC 的结局文案变体（NPC 受伤是即时反馈，不进结局记录）
- 结局文案不新增变体（killedScout 复用 M4 的"求饶的探子也死在刀下"段）
