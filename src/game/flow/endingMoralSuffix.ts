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
