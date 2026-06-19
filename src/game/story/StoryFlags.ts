export type ClueId =
  | 'wound'
  | 'blackScaleToken'
  | 'burnedScabbard'
  | 'threatenedVillagers';

export type StoryPhase =
  | 'funeralRain'
  | 'investigating'
  | 'studyUnlocked'
  | 'secretChamber'
  | 'wuzhenDefeated'
  | 'departure';

const REQUIRED_CLUES: ClueId[] = [
  'wound',
  'blackScaleToken',
  'burnedScabbard',
  'threatenedVillagers',
];

export class StoryFlags {
  private readonly clues = new Set<ClueId>();

  phase: StoryPhase = 'funeralRain';

  get discoveredClueCount() {
    return this.clues.size;
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
