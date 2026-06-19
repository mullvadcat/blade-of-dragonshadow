export const AUDIO_MODES = ['explore', 'combat', 'boss', 'gameOver', 'ending'] as const;

export type AudioMode = (typeof AUDIO_MODES)[number];

export interface AudioEngine {
  start(): Promise<void>;
  stop(): void;
  setMode(mode: AudioMode): void;
  setMuted(muted: boolean): void;
}

type EngineFactory = () => AudioEngine;

const isAudioMode = (mode: AudioMode) => AUDIO_MODES.includes(mode);

export class AudioDirector {
  private readonly createEngine: EngineFactory;
  private engine: AudioEngine | null = null;
  private muted = false;
  private started = false;
  private mode: AudioMode = 'explore';
  private startPromise: Promise<void> | null = null;

  constructor(createEngine: EngineFactory = () => new WebAudioEngine()) {
    this.createEngine = createEngine;
  }

  get isMuted() {
    return this.muted;
  }

  get isStarted() {
    return this.started;
  }

  get currentMode() {
    return this.mode;
  }

  async start() {
    if (this.started) {
      return;
    }
    if (this.startPromise) {
      await this.startPromise;
      return;
    }

    this.startPromise = this.startEngine();
    await this.startPromise;
    this.startPromise = null;
  }

  stop() {
    this.engine?.stop();
    this.engine = null;
    this.started = false;
  }

  setMode(mode: AudioMode) {
    if (!isAudioMode(mode)) {
      throw new Error(`Unsupported audio mode: ${mode}`);
    }

    this.mode = mode;
    this.engine?.setMode(mode);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.engine?.setMuted(muted);
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private async startEngine() {
    this.engine = this.createEngine();
    await this.engine.start();
    this.engine.setMuted(this.muted);
    this.engine.setMode(this.mode);
    this.started = true;
  }
}

class WebAudioEngine implements AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private mode: AudioMode = 'explore';
  private muted = false;
  private timers: number[] = [];
  private started = false;

  async start() {
    if (this.started) {
      return;
    }

    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    this.context = new AudioContextCtor();
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    this.master = this.context.createGain();
    this.rainGain = this.context.createGain();
    this.droneGain = this.context.createGain();
    this.musicGain = this.context.createGain();

    this.master.gain.value = this.muted ? 0 : 0.28;
    this.rainGain.gain.value = 0.16;
    this.droneGain.gain.value = 0.04;
    this.musicGain.gain.value = 0.11;

    this.rainGain.connect(this.master);
    this.droneGain.connect(this.master);
    this.musicGain.connect(this.master);
    this.master.connect(this.context.destination);

    this.startRainNoise();
    this.startDrone();
    this.scheduleMusicLoop();
    this.started = true;
    this.setMode(this.mode);
  }

  stop() {
    for (const timer of this.timers) {
      window.clearInterval(timer);
    }
    this.timers = [];
    void this.context?.close();
    this.context = null;
    this.started = false;
  }

  setMode(mode: AudioMode) {
    this.mode = mode;
    if (!this.context || !this.rainGain || !this.droneGain || !this.musicGain) {
      return;
    }

    const now = this.context.currentTime;
    const rain = mode === 'gameOver' ? 0.045 : mode === 'ending' ? 0.09 : 0.16;
    const drone = mode === 'boss' ? 0.1 : mode === 'combat' ? 0.075 : mode === 'ending' ? 0.035 : 0.045;
    const music = mode === 'gameOver' ? 0.015 : mode === 'boss' ? 0.15 : mode === 'combat' ? 0.13 : 0.1;

    this.rainGain.gain.cancelScheduledValues(now);
    this.droneGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.cancelScheduledValues(now);
    this.rainGain.gain.linearRampToValueAtTime(rain, now + 0.6);
    this.droneGain.gain.linearRampToValueAtTime(drone, now + 0.6);
    this.musicGain.gain.linearRampToValueAtTime(music, now + 0.6);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (!this.context || !this.master) {
      return;
    }

    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.28, now + 0.18);
  }

  private startRainNoise() {
    if (!this.context || !this.rainGain) {
      return;
    }

    const bufferSize = this.context.sampleRate * 2;
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.42;
    }

    const noise = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    noise.buffer = buffer;
    noise.loop = true;
    filter.type = 'bandpass';
    filter.frequency.value = 1600;
    filter.Q.value = 0.55;
    noise.connect(filter);
    filter.connect(this.rainGain);
    noise.start();
  }

  private startDrone() {
    if (!this.context || !this.droneGain) {
      return;
    }

    for (const [frequency, gainValue] of [
      [73.42, 0.58],
      [110, 0.32],
    ] as const) {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.value = gainValue;
      osc.connect(gain);
      gain.connect(this.droneGain);
      osc.start();
    }
  }

  private scheduleMusicLoop() {
    this.playMusicalPhrase();
    this.timers.push(window.setInterval(() => this.playMusicalPhrase(), 5200));
    this.timers.push(window.setInterval(() => this.playPulse(), 1300));
  }

  private playMusicalPhrase() {
    if (!this.context || !this.musicGain || this.mode === 'gameOver') {
      return;
    }

    const pentatonic = [146.83, 164.81, 196, 220, 246.94, 293.66];
    const noteCount = this.mode === 'boss' ? 5 : this.mode === 'combat' ? 4 : 3;
    for (let i = 0; i < noteCount; i += 1) {
      const frequency = pentatonic[(i * 2 + Math.floor(Math.random() * 2)) % pentatonic.length];
      const delay = i * (this.mode === 'explore' ? 0.72 : 0.42);
      this.playPluck(frequency, this.context.currentTime + delay);
    }
  }

  private playPluck(frequency: number, when: number) {
    if (!this.context || !this.musicGain) {
      return;
    }

    const osc = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, when);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(this.mode === 'boss' ? 0.18 : 0.11, when + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 1.25);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc.start(when);
    osc.stop(when + 1.35);
  }

  private playPulse() {
    if (!this.context || !this.musicGain || this.mode === 'explore' || this.mode === 'ending') {
      return;
    }

    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = this.mode === 'boss' ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(this.mode === 'boss' ? 58 : 72, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.18);
    gain.gain.setValueAtTime(this.mode === 'boss' ? 0.2 : 0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(now);
    osc.stop(now + 0.34);
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
