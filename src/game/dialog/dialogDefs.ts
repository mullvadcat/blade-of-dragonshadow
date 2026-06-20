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
