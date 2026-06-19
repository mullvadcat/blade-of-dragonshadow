import { describe, expect, it } from 'vitest';
import { AudioDirector, type AudioEngine, type AudioMode } from '../src/game/audio/AudioDirector';

class FakeAudioEngine implements AudioEngine {
  startCalls = 0;
  stopCalls = 0;
  modes: AudioMode[] = [];
  mutedValues: boolean[] = [];

  async start() {
    this.startCalls += 1;
  }

  stop() {
    this.stopCalls += 1;
  }

  setMode(mode: AudioMode) {
    this.modes.push(mode);
  }

  setMuted(muted: boolean) {
    this.mutedValues.push(muted);
  }
}

describe('AudioDirector', () => {
  it('starts unmuted in explore mode', () => {
    const engine = new FakeAudioEngine();
    const director = new AudioDirector(() => engine);

    expect(director.isMuted).toBe(false);
    expect(director.currentMode).toBe('explore');
    expect(director.isStarted).toBe(false);
  });

  it('toggles mute and forwards the value to the engine', async () => {
    const engine = new FakeAudioEngine();
    const director = new AudioDirector(() => engine);
    await director.start();

    director.setMuted(true);
    director.setMuted(false);

    expect(director.isMuted).toBe(false);
    expect(engine.mutedValues).toEqual([false, true, false]);
  });

  it('sets supported modes and records the current mode', async () => {
    const engine = new FakeAudioEngine();
    const director = new AudioDirector(() => engine);
    await director.start();

    director.setMode('combat');
    director.setMode('boss');

    expect(director.currentMode).toBe('boss');
    expect(engine.modes).toEqual(['explore', 'combat', 'boss']);
  });

  it('rejects unsupported modes', () => {
    const director = new AudioDirector(() => new FakeAudioEngine());

    expect(() => director.setMode('silent' as AudioMode)).toThrow('Unsupported audio mode');
  });

  it('does not start more than one audio loop', async () => {
    const engine = new FakeAudioEngine();
    const director = new AudioDirector(() => engine);

    await director.start();
    await director.start();
    await director.start();

    expect(director.isStarted).toBe(true);
    expect(engine.startCalls).toBe(1);
  });
});
