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

  /** 触发求饶对话前设置求饶目标（写入 context.surrenderEnemy）。 */
  setSurrenderTarget(target: SurrenderTarget | null) {
    this.context.surrenderEnemy = target;
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
