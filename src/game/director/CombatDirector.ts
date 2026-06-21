import Phaser from 'phaser';
import { CombatSystem, type Strike } from '../combat/CombatSystem';
import { COMBAT_BALANCE } from '../combat/combatBalance';
import { BladeAura } from '../combat/BladeAura';
import { SkillSystem, type SkillCastResult } from '../skills/SkillSystem';
import { SKILL_DEFS, type SkillId } from '../skills/skillDefs';
import type { CombatActor } from '../entities/CombatActor';
import type { Player } from '../player/Player';
import type { EnemyDirector } from './EnemyDirector';
import type { Hud } from '../ui/Hud';
import type { SfxName } from '../audio/AudioDirector';
import { isAllyWithinRange } from '../entities/allyCasualty';
import { isDestructibleInRange } from '../entities/destructibleTarget';
import type { Destructible } from '../entities/Destructible';
import { isMeleeHittable } from '../entities/meleeTarget';
import type { Npc } from '../entities/Npc';

/**
 * 战斗调度：处理玩家攻击的命中判定与刀光、敌人落招对玩家的伤害结算与受击反馈、
 * 刀气（远程斩击）的释放与推进、龙影九斩技能的释放与形态化特效。
 *
 * 与 EnemyDirector 的分工：EnemyDirector 负责"敌人何时出招、产生 Strike"；
 * CombatDirector 负责"玩家何时打中敌人 / 敌人打中玩家后如何结算"。
 */
export class CombatDirector {
  private onBossDefeated: () => void;
  private readonly auraKey: Phaser.Input.Keyboard.Key;
  private readonly auras: BladeAura[] = [];
  private readonly skillSystem: SkillSystem;
  private readonly skillKeyLurk: Phaser.Input.Keyboard.Key;
  private readonly skillKeyBreak: Phaser.Input.Keyboard.Key;
  /** 守护形态减伤窗口结束时间；0 表示无减伤。 */
  private guardReduceUntil = 0;
  /** 守护形态减伤比例（从 SkillCastResult 透传，避免硬编码）。 */
  private guardReduceRatio = 0;

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

  private readonly sfx: (name: SfxName) => void;

  get skillState(): SkillSystem {
    return this.skillSystem;
  }

  /** 应用玩家普通攻击（轻/重斩或完美格挡反击）的命中判定与刀光。 */
  applyPlayerAttack(strike: Strike, time: number) {
    const empowered = this.player.machine.consumeCounterWindow(time);
    const finalStrike: Strike = empowered
      ? {
          ...strike,
          damage: Math.round(strike.damage * COMBAT_BALANCE.empoweredCounter.damageMultiplier),
          guardDamage: COMBAT_BALANCE.empoweredCounter.guardDamage,
        }
      : strike;

    this.sfx(empowered ? 'slashEmpowered' : strike.damage >= 24 ? 'slashHeavy' : 'slashLight');
    this.showSlash(empowered);

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
  }

  /**
   * 近战命中结算：对范围内的活跃敌人与 Boss 应用 strike，处理龙魂 / 戾气奖励与击杀回调。
   * 求饶中的敌人不结算（其处置统一走 FlowController 的求饶对话，避免被 AoE 无声击杀）。
   * @param enemyRange 小怪命中横向半径（技能形态会传入按 rangeMultiplier 缩放后的值）
   * @param bossRange Boss 命中横向半径（同上）
   * @returns 是否至少命中一个目标（用于命中音效）
   */
  private resolveMeleeHit(
    strike: Strike,
    enemyRange: number,
    bossRange: number,
    time: number,
  ): boolean {
    let landed = false;
    for (const enemy of this.enemies.activeEnemies) {
      if (
        !isMeleeHittable(
          enemy.active,
          enemy.isSurrendered,
          enemy.x,
          enemy.y,
          this.player.x,
          this.player.y,
          enemyRange,
          COMBAT_BALANCE.meleeRange.enemyY,
        )
      ) {
        continue;
      }
      enemy.receiveStrike(strike, time);
      landed = true;
      this.player.machine.addSoul(COMBAT_BALANCE.soulReward.meleeHit);
      if (!enemy.active) {
        this.player.machine.addSoul(COMBAT_BALANCE.soulReward.kill);
        this.player.moral.addLiqi(COMBAT_BALANCE.liqiReward.kill);
      }
    }

    const boss = this.enemies.activeBoss;
    if (
      boss?.active &&
      Math.abs(boss.x - this.player.x) < bossRange &&
      Math.abs(boss.y - this.player.y) < COMBAT_BALANCE.meleeRange.bossY
    ) {
      boss.receiveStrike(strike, time);
      landed = true;
      if (!boss.active) {
        this.onBossDefeated();
      }
    }

    return landed;
  }

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
    this.player.machine.addSoul(COMBAT_BALANCE.soulReward.meleeHit);
    if (!threat.active) {
      this.player.machine.addSoul(COMBAT_BALANCE.soulReward.kill);
      this.player.moral.addLiqi(COMBAT_BALANCE.liqiReward.kill);
    }
    return true;
  }

  /**
   * 每帧处理刀气释放（U 键）与已存在刀气的飞行/命中推进。
   * 释放需消耗龙魂（BLADE_AURA_SOUL_COST），不足则无反应。
   */
  handleBladeAura(time: number) {
    if (
      !this.player.machine.isDead() &&
      Phaser.Input.Keyboard.JustDown(this.auraKey) &&
      this.player.machine.spendSoul(CombatSystem.BLADE_AURA_SOUL_COST)
    ) {
      this.releaseBladeAura(time);
    }

    // 推进现存刀气；命中或飞出范围后从列表移除
    for (let i = this.auras.length - 1; i >= 0; i--) {
      const aura = this.auras[i];
      const done = aura.update(time, (target) => {
        this.player.machine.addSoul(COMBAT_BALANCE.soulReward.bladeAuraHit);
        if (!target.active) {
          this.player.moral.addLiqi(COMBAT_BALANCE.liqiReward.bladeAuraKill);
        }
      });
      if (done) {
        this.auras.splice(i, 1);
      }
    }
  }

  private releaseBladeAura(_time: number) {
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

  /**
   * 每帧处理潜龙出渊(I)与裂鳞破甲(O)的释放，以及游龙回身派生 Strike 的识别与释放。
   * 游龙回身由 Player.consumeAttack 返回带标记的 Strike 触发，本方法识别并交给 SkillSystem 形态化。
   */
  handleSkills(time: number, rawAttackStrike: Strike | null) {
    if (this.player.machine.isDead()) {
      return;
    }

    // 游龙回身派生：识别 consumeAttack 返回的标记 Strike；仅释放成功才消费闪避后窗口
    if (rawAttackStrike && rawAttackStrike.staminaDamage === -1) {
      const casted = this.castSkill('dragonReturn', time);
      if (casted) {
        this.player.machine.consumeDodgeCounterWindow(time);
      }
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

  /**
   * 释放技能：检查冷却与龙魂，通过则形态化并执行效果。
   * @returns 是否成功释放（用于派生窗口消费决策）
   */
  private castSkill(id: SkillId, time: number): boolean {
    // 冷却中：静默（避免刷屏），不算失败也不算成功
    if (!this.skillSystem.isReady(id, time)) {
      return false;
    }
    // 龙魂不足：给主动反馈，让玩家知道为什么按了没用
    const cost = SKILL_DEFS[id].soulCost;
    if (this.player.machine.state.soul < cost) {
      this.hud.showSubtitle('龙魂不足，无法施展', 900);
      return false;
    }

    const result = this.skillSystem.tryRelease(
      id,
      time,
      this.player.machine.state.soul,
      this.player.machine.state.maxHealth,
    );
    if (!result) {
      return false;
    }
    this.player.machine.spendSoul(result.soulSpent);

    // 狂暴反噬：自伤 + 视觉/听觉反馈（让玩家感知"力量在反噬自身"）
    if (result.selfHarm > 0) {
      this.player.machine.takeDamage(result.selfHarm);
      this.player.setTint(0xff3d4f);
      this.scene.cameras.main.shake(60, 0.002);
      this.scene.time.delayedCall(120, () => {
        if (this.player.active) {
          this.player.clearTint();
        }
      });
    }
    // 守护减伤窗口
    if (result.guardReduceUntil !== null) {
      this.guardReduceUntil = result.guardReduceUntil;
      this.guardReduceRatio = result.guardReduceRatio;
    }

    this.executeSkillEffect(result, time);
    return true;
  }

  private executeSkillEffect(cast: SkillCastResult, time: number) {
    // 技能统一用独立音效（龙吟感），与普攻区分
    this.sfx('skillCast');
    // 游龙回身：给玩家本体缩放反馈（普攻轻斩级别的反馈）
    if (cast.skillId === 'dragonReturn') {
      this.player.feedbackAttack(false);
    }

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
    const range = Math.round(COMBAT_BALANCE.meleeRange.enemyX * cast.rangeMultiplier);
    const bossRange = Math.round(COMBAT_BALANCE.meleeRange.bossX * cast.rangeMultiplier);
    if (this.resolveMeleeHit(cast.strike, range, bossRange, time)) {
      this.sfx('hit');
    }
    if (this.resolveThreatMeleeHit(cast.strike, range, time)) {
      this.sfx('hit');
    }

    // 狂暴误伤判定：大范围技能波及村民 NPC（游龙回身是精准反击，不波及）
    if (cast.hitsAllies && cast.skillId !== 'dragonReturn') {
      let harmedNewAlly = false;
      for (const npc of this.npcs) {
        if (!npc.active) {
          continue;
        }
        if (
          isAllyWithinRange(
            npc.x,
            npc.y,
            this.player.x,
            this.player.y,
            range,
            COMBAT_BALANCE.meleeRange.enemyY,
          )
        ) {
          if (npc.takeDamage()) {
            harmedNewAlly = true;
          }
        }
      }
      if (harmedNewAlly) {
        this.player.moral.addLiqi(COMBAT_BALANCE.liqiReward.allyHarm);
        this.hud.showSubtitle('刀气擦过村民——你差点伤到了无辜的人。');
      }
    }

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
        // 用 cast.hitsAllies 检测狂暴形态（顶层字段，与现有 NPC 误伤判定一致）
        const isWrath = cast.hitsAllies;
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

  /** 敌人 / Boss 本帧落招的 Strike 统一对玩家结算伤害与受击反馈。 */
  applyEnemyStrike(strike: Strike, time: number) {
    if (this.player.machine.isDead()) {
      return;
    }

    const state = this.player.machine.state;
    const result = CombatSystem.resolveStrike(strike, state, time);
    Object.assign(state, result.target);

    // 守护形态减伤：减伤窗口内的伤害按比例折减（回血差额）。比例从 SkillCastResult 透传，非硬编码。
    if (this.isGuardReduced(time) && result.damageDealt > 0) {
      const reduced = Math.round(result.damageDealt * this.guardReduceRatio);
      state.health = Math.min(state.maxHealth, state.health + reduced);
      result.damageDealt -= reduced;
    }

    if (result.wasPerfectGuard) {
      if (result.counterWindowUntil !== null) {
        this.player.machine.grantCounterWindow(result.counterWindowUntil);
      }
      // 完美格挡涨守心 + 积累龙魂：克制化解的双重奖励
      this.player.moral.addShouxin(COMBAT_BALANCE.shouxinReward.perfectGuard);
      this.player.machine.addSoul(COMBAT_BALANCE.soulReward.perfectGuard);
      this.sfx('perfectGuard');
      this.hud.showSubtitle('听风断影——你卸开这一击，反手已有破绽可乘。', 1500);
      return;
    }

    // 无敌帧内 / 无实际影响时不给受击反馈。
    if (result.damageDealt <= 0 && !result.wasGuardBroken) {
      return;
    }

    this.sfx(this.player.machine.state.isBlocking ? 'block' : 'playerHurt');
    this.player.setTint(0xff5964);
    this.scene.cameras.main.shake(90, 0.003);
    this.scene.time.delayedCall(90, () => {
      if (this.player.active) {
        this.player.clearTint();
      }
    });
  }

  /** 刀光特效：颜色随戾气/守心偏移（怒→红，守→青白）；反击窗口内为金黄。 */
  private showSlash(empowered = false) {
    const x = this.player.x + this.player.facing * 48;
    const bladeColor = this.player.moral.bladeColor();
    const slash = this.scene.add
      .rectangle(
        x,
        this.player.y - 8,
        empowered ? 96 : 74,
        empowered ? 13 : 9,
        empowered ? 0xfff1a8 : bladeColor,
        0.9,
      )
      .setAngle(this.player.facing > 0 ? -18 : 18)
      .setDepth(40);
    this.scene.tweens.add({
      targets: slash,
      alpha: 0,
      scaleX: 1.5,
      duration: 130,
      onComplete: () => slash.destroy(),
    });
  }
}
