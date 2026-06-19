import { describe, expect, it } from 'vitest';
import { StoryFlags } from '../src/game/story/StoryFlags';

describe('StoryFlags', () => {
  it('keeps the study mechanism locked until all four clues are found', () => {
    const story = new StoryFlags();

    story.discoverClue('wound');
    story.discoverClue('blackScaleToken');
    story.discoverClue('burnedScabbard');

    expect(story.discoveredClueCount).toBe(3);
    expect(story.canOpenStudyMechanism()).toBe(false);
  });

  it('allows the study mechanism to open after all four clues are found', () => {
    const story = new StoryFlags();

    story.discoverClue('wound');
    story.discoverClue('blackScaleToken');
    story.discoverClue('burnedScabbard');
    story.discoverClue('threatenedVillagers');

    expect(story.discoveredClueCount).toBe(4);
    expect(story.canOpenStudyMechanism()).toBe(true);
  });
});
