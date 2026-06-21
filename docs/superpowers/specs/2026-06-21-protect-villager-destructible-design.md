# M6 设计：保护村民道德事件 + 限场地破坏机制

> 状态：已批准（2026-06-21）
> 上游里程碑：M0-M5 + R1 评审重构已完成
> 下游：第二章·龙刃初鸣（或第五章"保护 NPC + 限场地破坏"机制深化）

## 1. 目标

落地第一章"力量的克制"主题的最后两块拼图，让第一章成为完整垂直切片：

1. **保护村民道德事件**：村民被敌人威胁时玩家介入保护 → `protectedVillager` ChoiceId（StoryFlags 已预留）→ 守心 +。把"克制"做成主动守护的玩法选择，而非仅"不滥杀"的被动克制。
2. **限场地破坏机制**：GDD 第五章"保护无辜 NPC + 限制场地破坏"的第一章前导——狂暴大范围技能破坏环境物体有硬性戾气惩罚（区别于 M5 误伤 NPC 的软惩罚），让"招式越强波及越大"从"伤人"扩展到"伤物"。

## 2. 关键决策（已与用户确认）

- **保护事件触发方式（A1 脚本事件式）**：FlowController 在固定条件触发演出——玩家通过村民对话获得第四线索 `threatenedVillagers` 后，停留在村民附近时，EnemyDirector 脚本生成一个 bandit 从右侧逼近村民。玩家在 bandit 接触村民前击败它则保护成功。与现有 `handleStudyGate` 脚本模式一致，易测试。
- **受威胁村民复用现有沉默村民**：第四线索村民（1990, `dialogId: 'villager'`）正是"被威胁村民"（clue: `threatenedVillagers`），主题一致。她刚说完"那夜灯被逼熄、父亲为我们没出刀"，随即真的被威胁——玩家就地保护，形成叙事闭环。不新增 NPC 实体。
- **威胁者攻击结算**：威胁者用现有 chase AI 朝村民移动（targetX = 村民 x），对靠近的玩家仍有正常攻击。FlowController 每帧检测威胁者 x 接近村民 x（距离 < 50）→ 触发失败（村民 `takeDamage()` + 字幕）。不改动 Enemy 的 Strike 结算机制（现有敌人 Strike 统一结算到玩家，威胁者攻击村民走脚本判定而非 Strike，避免改动核心战斗管线）。
- **限场地破坏形态（B1 新增可破坏物）**：在世界中放置可破坏环境物体（货摊/灯笼/水缸/木桶，程序化纹理），每件有小 hp，被摧毁后永久碎裂。破坏规则绑定"招式越强波及越大"主题。
- **两机制轻联动（C3）**：保护事件区域（村民附近）放 2-3 件可破坏物，破坏只走破坏惩罚（戾气），**不影响**保护成败；保护成败只看是否在 bandit 接触村民前击败它。主题张力：玩家若用狂暴技能驱赶 bandit，会劈碎村民身边物件（戾气上涨），但保护仍可成功——"力量能救人也会伤物"的视觉并置。
- **结局文案变体**：`endingMoralSuffix` 加 `protectedVillager` 分支，优先级在 `killedScout` 之后、`sparedScout` 之前。

## 3. 架构

```
src/game/entities/
├── Destructible.ts         # 新增：可破坏环境物体（物理体+hp+碎裂视觉）
├── destructibleTarget.ts   # 新增：isDestructibleInRange 纯函数（无 Phaser 依赖，可单测）
├── Npc.ts                  # 无改动（takeDamage/injured 已就绪，复用 M5）
└── Enemy.ts                # 无改动（chase AI 已支持任意 targetX）

src/game/flow/
├── protectEvent.ts         # 新增：shouldTriggerProtectEvent / resolveProtectOutcome 纯函数（可单测）
├── FlowController.ts       # 修改：新增 handleProtectEvent 每帧检测 + protectResolved 状态
└── endingMoralSuffix.ts    # 修改：加 protectedVillager 文案分支

src/game/director/
├── EnemyDirector.ts        # 修改：新增 spawnThreat() 生成威胁 bandit + threatEnemy 引用
└── CombatDirector.ts       # 修改：构造加 destructibles；executeSkillEffect + releaseBladeAura 加破坏判定

src/game/world/
└── WorldBuilder.ts         # 修改：新增 createDestructibles() + createThreatenedVillager 复用现有村民

src/game/
└── GameScene.ts            # 修改：装配 destructibles 传给 CombatDirector；update 调用 handleProtectEvent

src/game/combat/
└── combatBalance.ts        # 修改：新增 destructiblePenalty / protectReward 数值
```

**职责边界：**
- `Destructible.ts`：可破坏物实体——物理体 + hp + 碎裂视觉。暴露 `takeDamage(): boolean`（首次破坏返回 true，幂等）和 `active`（Phaser Sprite 内置）。
- `destructibleTarget.ts`：纯几何判定——可破坏物是否在以攻击者为中心的矩形范围内。不依赖 Phaser，不依赖 Destructible 类型。仿 `allyCasualty.ts` / `meleeTarget.ts` 模式。
- `protectEvent.ts`：纯逻辑判定——`shouldTriggerProtectEvent`（阶段/线索/距离/一次性）+ `resolveProtectOutcome`（威胁者死 vs 村民受伤 → 成功/失败）。不依赖 Phaser，可单测。
- `EnemyDirector.spawnThreat()`：脚本生成威胁 bandit，存 `threatEnemy` 引用，每帧 update 传村民 x 作为 targetX。
- `FlowController.handleProtectEvent()`：每帧编排——检测触发条件 → 调 EnemyDirector.spawnThreat → 检测成败 → 记 choice + 守心 + 字幕。
- `CombatDirector`：在技能命中阶段和刀气释放阶段调用纯函数判定破坏可破坏物。需要 destructibles 新依赖。

**数据流：**

```
FlowController.handleProtectEvent()  // 每帧（handleNpcDialog/handleSurrender 之后）
  ├─ 未触发且 shouldTriggerProtectEvent(story, player, villager, protectResolved):
  │    enemyDirector.spawnThreat()  // 生成 bandit 从 ~2300 朝村民 1990 移动
  │    hud.showSubtitle('山匪逼近村民，刀光在雨里发寒。')
  ├─ 已触发未解析:
  │    if !threatEnemy.active:  // 玩家击败威胁者
  │      resolveProtectOutcome → 'success'
  │      story.recordChoice('protectedVillager')
  │      player.moral.addShouxin(18)
  │      hud.showSubtitle('村民望着你收刀，眼里有泪。')
  │    else if |threatEnemy.x - villager.x| < 50:  // 威胁者接触村民
  │      resolveProtectOutcome → 'failure'
  │      villager.takeDamage()
  │      hud.showSubtitle('你慢了一步，村民倒在血水里。')
  └─ 已解析: 跳过

CombatDirector.releaseBladeAura(time)  // 刀气释放
  ├─ 现有：创建 BladeAura 朝玩家朝向飞出
  └─ 新增：检测刀气路径上的可破坏物
       for d of destructibles:
         if d.active && isDestructibleInRange(d.x, d.y, player.x, player.y, range, 86):
           if d.takeDamage():
             player.moral.addLiqi(5)
       // 碎裂视觉由 Destructible.takeDamage 内部处理

CombatDirector.executeSkillEffect(cast, time)  // 技能
  ├─ 现有：命中 enemies/boss + 狂暴误伤 NPC
  └─ 新增：可破坏物破坏判定（游龙回身跳过）
       if cast.skillId !== 'dragonReturn':
         for d of destructibles:
           if d.active && isDestructibleInRange(d.x, d.y, player.x, player.y, range, 86):
             if d.takeDamage():
               penalty = cast.form === 'wrath' ? 8 : 6
               player.moral.addLiqi(penalty)
         if anyDestroyed && cast.form === 'wrath':
           hud.showSubtitle('刀气失控，劈碎了身侧之物——你不该对无辜之物下重手。')
```

## 4. 组件设计

### 4.1 destructibleTarget.ts（纯模块，可单测）

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

### 4.2 Destructible.ts（实体）

```typescript
import Phaser from 'phaser';

export type DestructibleKind = 'stall' | 'lantern' | 'barrel' | 'urn';

export type DestructibleOptions = {
  kind: DestructibleKind;
  /** 名牌/字幕显示名（如"货摊""灯笼"）。 */
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
   * 受破坏：首次破坏设 destroyed + 碎裂视觉（碎裂 tween + 灰化），返回 true；
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
    // 碎片粒子（简单矩形飞溅）
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

**程序化纹理**：在 `WorldBuilder.createGeneratedTextures` 中新增 4 种可破坏物纹理（`destructible-stall` / `destructible-lantern` / `destructible-barrel` / `destructible-urn`），每种用 graphics 绘制对应色彩剪影（货摊=棕褐长方、灯笼=暗红圆、木桶=深棕矮方、水缸=青灰椭圆）。

### 4.3 protectEvent.ts（纯模块，可单测）

```typescript
import type { StoryFlags } from '../story/StoryFlags';

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
  ctx.hasThreatenedClue &&
  !ctx.protectResolved &&
  ctx.playerToVillagerDist < 160;

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

### 4.4 EnemyDirector.ts 扩展

新增字段与方法：

```typescript
  private threatEnemy: Enemy | null = null;

  /** 脚本生成威胁村民的 bandit（保护事件用）。从指定 x 朝村民移动。 */
  spawnThreat(x: number, _villagerX: number): Enemy {
    this.threatEnemy = new Enemy(this.scene, x, 580, 'bandit', this.sfx);
    this.scene.physics.add.collider(this.threatEnemy, this.ground);
    return this.threatEnemy;
  }

  get activeThreat(): Enemy | null {
    return this.threatEnemy;
  }
```

**威胁者 update**：威胁者不在 `enemies` 数组里（单独 `threatEnemy` 引用），不进入 `advanceEnemies` 循环。由 **GameScene.update 统一推进**（仿 bossStrike 模式）：每帧调用 `threat.update(time, villagerX)` + `threat.advanceAttack(time, villagerX)`，产生的 Strike 交 `CombatDirector.applyEnemyStrike` 结算（威胁者对靠近的玩家有正常攻击）。这样保持职责分离：FlowController 管触发与成败判定，GameScene 管实体推进，CombatDirector 管战斗结算。详见 4.5 修订与 4.10。

**威胁者与普通敌人区别**：威胁者不出现在 `enemies` 数组里（单独 `threatEnemy` 引用），不被 `hasEnemyNearby` 统计（避免音频模式误判），不被 `releaseBladeAura` 的 `activeEnemies.filter` 包含——需在 `releaseBladeAura` 目标列表中额外加入威胁者（若 active 且未求饶）。具体：

```typescript
  private releaseBladeAura(_time: number) {
    const targets: CombatActor[] = this.enemies.activeEnemies.filter(
      (enemy) => !enemy.isSurrendered,
    );
    if (this.threatEnemy?.active && !this.threatEnemy.isSurrendered) {
      targets.push(this.threatEnemy);
    }
    // ... 现有 boss + 创建 aura
  }
```

`resolveMeleeHit` 的 enemies 循环也需包含威胁者——但威胁者不在 `activeEnemies`。方案：`resolveMeleeHit` 后额外检测威胁者是否在近战范围内被命中。新增私有 `resolveThreatMeleeHit`：

```typescript
  private resolveThreatMeleeHit(strike: Strike, enemyRange: number, time: number): boolean {
    const t = this.enemies.activeThreat;
    if (!t?.active || t.isSurrendered) {
      return false;
    }
    if (
      !isMeleeHittable(
        t.active,
        t.isSurrendered,
        t.x,
        t.y,
        this.player.x,
        this.player.y,
        enemyRange,
        COMBAT_BALANCE.meleeRange.enemyY,
      )
    ) {
      return false;
    }
    t.receiveStrike(strike, time);
    if (!t.active) {
      this.player.machine.addSoul(COMBAT_BALANCE.soulRewards.kill);
      this.player.moral.addLiqi(COMBAT_BALANCE.liqiReward.kill);
    }
    return true;
  }
```

在 `applyPlayerAttack` 和 `executeSkillEffect` 的 `resolveMeleeHit` 后调用 `resolveThreatMeleeHit`。

### 4.5 FlowController.ts 扩展

新增字段与每帧检测：

```typescript
  protectResolved = false;
  protectTriggered = false;
  private threatenedVillager: Npc | null = null;
```

构造函数中找出 `dialogId === 'villager'` 的 NPC 存为 `threatenedVillager`。

```typescript
  /** 每帧：检测保护村民事件触发与成败（威胁者推进由 GameScene.update 统一处理）。 */
  handleProtectEvent(_time: number) {
    if (this.protectResolved || !this.threatenedVillager?.active) {
      return;
    }

    // 触发
    if (!this.protectTriggered) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.threatenedVillager.x, this.threatenedVillager.y,
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

    // 已触发：仅检测成败（威胁者 update/Strike 由 GameScene 推进）
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

**FlowController 不依赖 CombatDirector**（保持职责分离）。威胁者 update/Strike 推进由 GameScene.update 统一处理（仿 bossStrike 模式，见 4.10）。FlowController 暴露 `get threatenedVillagerX(): number`（村民 x，GameScene 推进威胁者用）。`protectTriggered` / `protectResolved` 改 public（GameScene 据此决定是否推进威胁者）。

### 4.6 endingMoralSuffix.ts 扩展

```typescript
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

优先级：killedScout > protectedVillager > sparedScout（处决最重，覆盖一切；保护与放过并列展示保护更主动）。

### 4.7 combatBalance.ts 扩展

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

### 4.8 CombatDirector.ts 扩展

**构造加 destructibles 参数：**

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
  )
```

需加 `import { Destructible } from '../entities/Destructible';` 和 `import { isDestructibleInRange } from '../entities/destructibleTarget';`。

**releaseBladeAura 加破坏判定**：刀气是瞬发直线突进，在释放时立即检测路径上的可破坏物（视觉上用 delayedCall 按距离错峰碎裂）：

```typescript
  private releaseBladeAura(time: number) {
    // ... 现有：创建 BladeAura（目标列表加威胁者，见 4.4）

    // 新增：刀气路径破坏判定
    const auraRange = 520;  // BladeAura 默认射程
    const dir = this.player.facing;
    for (const d of this.destructibles) {
      if (!d.active || d.isDestroyed) {
        continue;
      }
      // 刀气沿玩家朝向直线飞行：x 在路径上 + y 接近
      const dx = d.x - this.player.x;
      if (Math.sign(dx) !== dir && dx !== 0) {
        continue;
      }
      if (Math.abs(dx) < auraRange && Math.abs(d.y - this.player.y) < 60) {
        const delay = (Math.abs(dx) / 14) * 16;  // 按距离错峰（刀气速度 14/帧）
        this.scene.time.delayedCall(delay, () => {
          if (d.active && d.takeDamage()) {
            this.player.moral.addLiqi(COMBAT_BALANCE.liqiReward.destructibleBladeAura);
          }
        });
      }
    }
  }
```

**executeSkillEffect 加破坏判定**（游龙回身跳过）：

```typescript
    // 新增：可破坏物破坏判定（游龙回身是精准反击，不破坏）
    if (cast.skillId !== 'dragonReturn') {
      let destroyedCount = 0;
      for (const d of this.destructibles) {
        if (!d.active || d.isDestroyed) {
          continue;
        }
        if (isDestructibleInRange(d.x, d.y, this.player.x, this.player.y, range, COMBAT_BALANCE.meleeRange.enemyY)) {
          if (d.takeDamage()) {
            destroyedCount += 1;
          }
        }
      }
      if (destroyedCount > 0) {
        const isWrath = cast.form.hitsAllies === true;  // 狂暴形态识别（hitsAllies 仅 wrath 为 true，语义准）
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

**resolveThreatMeleeHit**（见 4.4）：在 `applyPlayerAttack` 和 `executeSkillEffect` 的 `resolveMeleeHit` 后调用，让玩家普攻和技能能命中威胁者。

### 4.9 WorldBuilder.ts 扩展

**createGeneratedTextures 加可破坏物纹理**：4 种 kind 各一个纹理。

**新增 createDestructibles()**：

```typescript
  createDestructibles(): Destructible[] {
    const specs: Array<[number, number, DestructibleKind, string]> = [
      // 保护事件区域（村民 1990 附近，C3 轻联动）
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
    return specs.map(([x, y, kind, label]) => new Destructible(this.scene, x, y, { kind, label }));
  }
```

**createNpcs() 无改动**：受威胁村民复用现有 `dialogId: 'villager'` 的 NPC（1990），FlowController 据此引用。

### 4.10 GameScene.ts 适配

```typescript
  private destructibles: Destructible[] = [];

  // create() 中：
  this.destructibles = this.world.createDestructibles();

  this.combatDirector = new CombatDirector(
    this,
    this.player,
    this.enemyDirector,
    this.hud,
    this.sfx,
    this.npcs,
    this.destructibles,
    () => { ... },
  );

  // update() 中，handleStudyGate 后新增：
  this.flow.handleProtectEvent(time);

  // bossStrike 处理后新增威胁者推进（见 4.5 修订）：
  const threat = this.enemyDirector.activeThreat;
  if (threat?.active && !this.flow.protectResolved) {
    threat.update(time, this.flow.threatenedVillagerX);
    const threatStrike = threat.advanceAttack(time, this.flow.threatenedVillagerX);
    if (threatStrike && !this.flow.endingStarted && !this.flow.gameOverStarted) {
      this.combatDirector.applyEnemyStrike(threatStrike, time);
    }
  }

  // resetRunState() 无需改动（FlowController 在 create() 重建，protectResolved 归位）
```

## 5. 测试（TDD）

**`tests/destructible-target.test.ts`：**
- `isDestructibleInRange` 范围内返回 true
- 范围外返回 false
- 边界值（刚好等于 rangeX/rangeY）返回 false（严格小于）
- 不同象限（左/右/上/下）均正确

**`tests/protect-event.test.ts`：**
- `shouldTriggerProtectEvent`：
  - 有线索 + 近距离 + 未解析 → true
  - 无线索 → false
  - 距离过远 → false
  - 已解析 → false
- `resolveProtectOutcome`：
  - 威胁者不活跃 → 'success'
  - 威胁者接触村民（距离 < 50）→ 'failure'
  - 威胁者活跃但未接触 → 'pending'
  - 边界值（距离 = 50）→ 'pending'（严格小于）

**`tests/ending-moral-suffix.test.ts` 修改：**
- 现有第 27-30 行用例（`protectedVillager` 返回空）改为：含"护住"或"村民"文案
- 新增优先级用例：
  - `['killedScout', 'protectedVillager']` → 含"血痕"，不含"护住"（处决覆盖保护）
  - `['protectedVillager', 'sparedScout']` → 含"护住"（保护优先于放过）

## 6. 文件清单

**新增：**
- `src/game/entities/Destructible.ts`
- `src/game/entities/destructibleTarget.ts`
- `src/game/flow/protectEvent.ts`
- `tests/destructible-target.test.ts`
- `tests/protect-event.test.ts`

**修改：**
- `src/game/world/WorldBuilder.ts` — createGeneratedTextures 加 4 种可破坏物纹理；新增 createDestructibles()
- `src/game/director/EnemyDirector.ts` — 新增 spawnThreat() + activeThreat getter
- `src/game/director/CombatDirector.ts` — 构造加 destructibles；releaseBladeAura 路径破坏判定；executeSkillEffect 范围破坏判定；resolveThreatMeleeHit + 调用点
- `src/game/flow/FlowController.ts` — 新增 protectResolved/protectTriggered 字段 + threatenedVillager 引用 + handleProtectEvent + threatenedVillagerX getter
- `src/game/flow/endingMoralSuffix.ts` — 加 protectedVillager 分支
- `src/game/combat/combatBalance.ts` — 加 destructiblePenalty / protectVillager 数值
- `src/game/GameScene.ts` — 装配 destructibles；update 调用 handleProtectEvent + 威胁者推进
- `tests/ending-moral-suffix.test.ts` — 改 protectedVillager 用例 + 新增优先级用例

## 7. 边界与不做

- 不做保护村民事件失败导致 NPC 死亡（保底 `takeDamage()` 不死，复用 M5 机制，避免破坏第四线索流程）
- 不做威胁者攻击村民的 Strike 结算（走脚本距离判定，避免改动核心战斗管线）
- 不做可破坏物阻挡玩家/敌人移动（物理体 `setImmovable(true)` 但不与玩家/敌人加 collider，仅作视觉与破坏判定目标）
- 不做普攻破坏可破坏物（轻/重斩/反击是精准斩击，不波及环境——主题上"克制的刀法不伤物"）
- 不做游龙回身破坏（闪避后精准反击，不追求大范围）
- 不做可破坏物破坏的结局文案变体（破坏是即时戾气惩罚，不进结局记录）
- 不做保护事件失败的额外戾气惩罚（村民受伤已是后果，失败不双重惩罚）
- 不做破坏可破坏物的独立音效（复用现有 `hit` 或 `slashHeavy`，避免音频膨胀）
- 不做威胁者求饶（bandit 无求饶逻辑，仅 scout 会求饶——威胁者是 bandit kind）
