export type ClueId = 'wound' | 'blackScaleToken' | 'burnedScabbard' | 'threatenedVillagers';

export type StoryPhase =
  | 'funeralRain'
  | 'investigating'
  | 'studyUnlocked'
  | 'secretChamber'
  | 'wuzhenDefeated'
  | 'departure';

/** 道德事件记录（为后续剧情分支预留，第一章先记录不改写流程）。 */
export type MoralChoiceId =
  | 'sparedScout' // 放过求饶的探子（守心）
  | 'killedScout' // 处决求饶的探子（戾气）
  | 'protectedVillager'; // 保护村民（守心）

const REQUIRED_CLUES: ClueId[] = [
  'wound',
  'blackScaleToken',
  'burnedScabbard',
  'threatenedVillagers',
];

export class StoryFlags {
  private readonly clues = new Set<ClueId>();
  private readonly choices = new Set<MoralChoiceId>();

  phase: StoryPhase = 'funeralRain';

  get discoveredClueCount() {
    return this.clues.size;
  }

  /** 已做出的道德选择（供后续章节分支读取）。 */
  get moralChoices(): readonly MoralChoiceId[] {
    return [...this.choices];
  }

  hasChoice(choice: MoralChoiceId): boolean {
    return this.choices.has(choice);
  }

  /** 记录一次道德选择（幂等）。 */
  recordChoice(choice: MoralChoiceId) {
    this.choices.add(choice);
  }

  discoverClue(clue: ClueId) {
    this.clues.add(clue);
    if (this.clues.size > 0 && this.phase === 'funeralRain') {
      this.phase = 'investigating';
    }
  }

  hasClue(clue: ClueId) {
    return this.clues.has(clue);
  }

  canOpenStudyMechanism() {
    return REQUIRED_CLUES.every((clue) => this.clues.has(clue));
  }

  openStudyMechanism() {
    if (!this.canOpenStudyMechanism()) {
      return false;
    }
    this.phase = 'studyUnlocked';
    return true;
  }

  enterSecretChamber() {
    if (this.phase !== 'studyUnlocked') {
      return false;
    }
    this.phase = 'secretChamber';
    return true;
  }

  defeatWuzhen() {
    this.phase = 'wuzhenDefeated';
  }

  leaveVillage() {
    if (this.phase !== 'wuzhenDefeated') {
      return false;
    }
    this.phase = 'departure';
    return true;
  }
}
