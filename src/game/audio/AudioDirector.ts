export const AUDIO_MODES = ['explore', 'combat', 'boss', 'gameOver', 'ending'] as const;

export type AudioMode = (typeof AUDIO_MODES)[number];

export const SFX_NAMES = [
  'slashLight',
  'slashHeavy',
  'slashEmpowered',
  'skillCast',
  'hit',
  'block',
  'perfectGuard',
  'dodge',
  'enemyAttack',
  'playerHurt',
  'enemyDown',
  'bossDown',
] as const;

export type SfxName = (typeof SFX_NAMES)[number];

/** 主音量。背景音乐 / 环境声经多级增益后整体偏弱，这里整体抬高到可听水平。 */
const MASTER_VOLUME = 0.5;

export interface AudioEngine {
  start(): Promise<void>;
  stop(): void;
  setMode(mode: AudioMode): void;
  setMuted(muted: boolean): void;
  playSfx(name: SfxName): void;
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

  /** 播放一次性战斗音效。未启动或静音时静默忽略，避免无谓创建音频节点。 */
  playSfx(name: SfxName) {
    if (!this.started || this.muted) {
      return;
    }
    this.engine?.playSfx(name);
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
  private sfxGain: GainNode | null = null;
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
    this.sfxGain = this.context.createGain();

    this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
    this.rainGain.gain.value = 0.16;
    this.droneGain.gain.value = 0.05;
    this.musicGain.gain.value = 0.5;
    this.sfxGain.gain.value = 0.8;

    this.rainGain.connect(this.master);
    this.droneGain.connect(this.master);
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
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
    const drone =
      mode === 'boss' ? 0.12 : mode === 'combat' ? 0.09 : mode === 'ending' ? 0.05 : 0.06;
    const music =
      mode === 'gameOver'
        ? 0.12
        : mode === 'boss'
          ? 0.8
          : mode === 'combat'
            ? 0.7
            : mode === 'ending'
              ? 0.45
              : 0.55;

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
    this.master.gain.linearRampToValueAtTime(muted ? 0 : MASTER_VOLUME, now + 0.18);
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
    gain.gain.exponentialRampToValueAtTime(this.mode === 'boss' ? 0.4 : 0.34, when + 0.025);
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

  playSfx(name: SfxName) {
    if (!this.context || !this.sfxGain) {
      return;
    }

    switch (name) {
      case 'slashLight':
        this.sfxNoise(0.09, 'highpass', 2600, 0.7, 0.5);
        this.sfxTone('triangle', 880, 320, 0.1, 0.18);
        break;
      case 'slashHeavy':
        this.sfxNoise(0.16, 'bandpass', 1500, 0.8, 0.6);
        this.sfxTone('sawtooth', 440, 150, 0.18, 0.22);
        break;
      case 'slashEmpowered':
        this.sfxNoise(0.18, 'bandpass', 2000, 0.9, 0.55);
        this.sfxTone('triangle', 1320, 620, 0.22, 0.2);
        this.sfxTone('sine', 660, 990, 0.26, 0.16, 0.04);
        break;
      case 'skillCast':
        // 龙吟感：低频 sine 上扬 + 带通噪声余韵，区别于普攻的短促
        this.sfxTone('sine', 220, 880, 0.28, 0.18, 0.02);
        this.sfxTone('triangle', 440, 1320, 0.32, 0.12, 0.06);
        this.sfxNoise(0.14, 'bandpass', 1800, 0.6, 0.4);
        break;
      case 'hit':
        this.sfxNoise(0.05, 'bandpass', 2400, 1.2, 0.5);
        this.sfxTone('square', 320, 160, 0.07, 0.16);
        break;
      case 'block':
        this.sfxTone('triangle', 1500, 1100, 0.06, 0.18);
        this.sfxNoise(0.04, 'highpass', 3200, 0.8, 0.35);
        break;
      case 'perfectGuard':
        this.sfxTone('sine', 988, 988, 0.45, 0.16, 0.01);
        this.sfxTone('sine', 1318, 1318, 0.5, 0.13, 0.07);
        break;
      case 'dodge':
        this.sfxNoise(0.14, 'lowpass', 900, 0.7, 0.4);
        break;
      case 'enemyAttack':
        this.sfxTone('sawtooth', 196, 110, 0.18, 0.16);
        this.sfxNoise(0.08, 'lowpass', 600, 0.6, 0.25);
        break;
      case 'playerHurt':
        this.sfxTone('square', 180, 70, 0.16, 0.2);
        this.sfxNoise(0.07, 'lowpass', 500, 0.7, 0.3);
        break;
      case 'enemyDown':
        this.sfxTone('sawtooth', 300, 90, 0.32, 0.2);
        break;
      case 'bossDown':
        this.sfxTone('sawtooth', 220, 55, 0.6, 0.26);
        this.sfxNoise(0.4, 'lowpass', 700, 0.5, 0.3);
        break;
    }
  }

  private sfxTone(
    type: OscillatorType,
    freqStart: number,
    freqEnd: number,
    duration: number,
    peak: number,
    delay = 0,
  ) {
    if (!this.context || !this.sfxGain) {
      return;
    }

    const when = this.context.currentTime + delay;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, when);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), when + duration);
    }
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(when);
    osc.stop(when + duration + 0.02);
  }

  private sfxNoise(
    duration: number,
    filterType: BiquadFilterType,
    frequency: number,
    q: number,
    peak: number,
  ) {
    if (!this.context || !this.sfxGain) {
      return;
    }

    const when = this.context.currentTime;
    const bufferSize = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    gain.gain.setValueAtTime(peak, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    source.start(when);
    source.stop(when + duration + 0.02);
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
