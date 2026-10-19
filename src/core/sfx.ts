/**
 * 程序化音效引擎
 * 所有声音都用 WebAudio 实时合成，不加载任何音频文件，保证离线可用、包体为零。
 */

interface ToneOpt {
  freq: number;
  to?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  attack?: number;
  curve?: 'exp' | 'lin';
}

interface NoiseOpt {
  dur?: number;
  freq?: number;
  to?: number;
  q?: number;
  gain?: number;
  delay?: number;
  type?: BiquadFilterType;
}

export type SoundName =
  | 'step'
  | 'jump'
  | 'land'
  | 'mine'
  | 'place'
  | 'break'
  | 'splash'
  | 'fart'
  | 'click'
  | 'ding'
  | 'moo'
  | 'oink'
  | 'baa'
  | 'cluck'
  | 'woof'
  | 'meow'
  | 'thunder'
  | 'portal'
  | 'eat'
  | 'pop'
  | 'xp'
  | 'hurt'
  | 'craft'
  | 'equip'
  | 'levelup'
  | 'open'
  | 'close';

export class SfxEngine {
  enabled = true;
  volume = 0.55;

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private lastPlay = new Map<string, number>();

  /** 必须在一次真实用户手势里调用（浏览器要求），否则首次播放会被静音 */
  unlock(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null;
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      // 预生成 2 秒白噪声，反复复用
      const len = Math.floor(this.ctx.sampleRate * 2);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (this.master) this.master.gain.value = v ? this.volume : 0;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.enabled) this.master.gain.value = this.volume;
  }

  private tone(o: ToneOpt): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const dur = o.dur ?? 0.16;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.to !== undefined) {
      if (o.curve === 'lin') osc.frequency.linearRampToValueAtTime(o.to, t0 + dur);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t0 + dur);
    }
    const peak = o.gain ?? 0.2;
    const atk = o.attack ?? 0.008;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(o: NoiseOpt): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.noiseBuf) return;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const dur = o.dur ?? 0.14;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = o.type ?? 'bandpass';
    filt.frequency.setValueAtTime(o.freq ?? 900, t0);
    if (o.to !== undefined) filt.frequency.exponentialRampToValueAtTime(Math.max(40, o.to), t0 + dur);
    filt.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    const peak = o.gain ?? 0.16;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /** 同名音效的最小间隔，避免脚步声糊成一片 */
  private throttle(name: string, ms: number): boolean {
    const now = performance.now();
    const last = this.lastPlay.get(name) ?? -1e9;
    if (now - last < ms) return false;
    this.lastPlay.set(name, now);
    return true;
  }

  play(name: SoundName, variant = 0): void {
    if (!this.enabled) return;
    if (this.ensure()?.state === 'suspended') return; // 还没被用户手势解锁
    const v = variant;
    switch (name) {
      case 'step':
        if (!this.throttle('step', 90)) return;
        this.noise({ dur: 0.07, freq: 420 + v * 60, to: 200, q: 0.8, gain: 0.07, type: 'lowpass' });
        break;
      case 'jump':
        this.tone({ freq: 300, to: 520, dur: 0.1, type: 'triangle', gain: 0.12 });
        break;
      case 'land':
        this.noise({ dur: 0.12, freq: 260, to: 90, q: 0.7, gain: 0.13, type: 'lowpass' });
        this.tone({ freq: 120, to: 70, dur: 0.1, type: 'sine', gain: 0.1 });
        break;
      case 'mine':
        this.noise({ dur: 0.09, freq: 1100 + v * 120, to: 500, q: 1.4, gain: 0.11 });
        this.tone({ freq: 180 + v * 22, to: 120, dur: 0.07, type: 'square', gain: 0.05 });
        break;
      case 'place':
        this.noise({ dur: 0.08, freq: 700, to: 260, q: 1, gain: 0.1, type: 'lowpass' });
        this.tone({ freq: 240, to: 180, dur: 0.06, type: 'triangle', gain: 0.07 });
        break;
      case 'break':
        this.noise({ dur: 0.24, freq: 1500, to: 280, q: 0.9, gain: 0.16 });
        this.tone({ freq: 300, to: 110, dur: 0.18, type: 'triangle', gain: 0.09 });
        break;
      case 'splash':
        this.noise({ dur: 0.34, freq: 2400, to: 380, q: 0.6, gain: 0.15 });
        this.tone({ freq: 900, to: 300, dur: 0.2, type: 'sine', gain: 0.06 });
        break;
      case 'fart': {
        // 分段：先是憋住的颤音，然后一声长屁，最后拖个尾音
        const wobble = 0.055;
        for (let i = 0; i < 5; i++) {
          this.tone({
            freq: 105 - i * 4 + v * 8,
            to: 88 - i * 4,
            dur: wobble,
            type: 'sawtooth',
            gain: 0.075,
            delay: i * wobble,
            curve: 'lin',
          });
        }
        this.noise({ dur: 0.42, freq: 420, to: 130, q: 2.2, gain: 0.14, delay: 0.02, type: 'bandpass' });
        this.tone({ freq: 78, to: 52, dur: 0.5, type: 'sawtooth', gain: 0.09, delay: 0.02, curve: 'lin' });
        this.noise({ dur: 0.3, freq: 260, to: 90, q: 1.4, gain: 0.07, delay: 0.5, type: 'lowpass' });
        break;
      }
      case 'click':
        this.tone({ freq: 700, to: 900, dur: 0.05, type: 'square', gain: 0.06 });
        break;
      case 'open':
        this.tone({ freq: 520, to: 760, dur: 0.09, type: 'triangle', gain: 0.07 });
        break;
      case 'close':
        this.tone({ freq: 700, to: 420, dur: 0.09, type: 'triangle', gain: 0.07 });
        break;
      case 'ding':
        this.tone({ freq: 880, dur: 0.18, type: 'sine', gain: 0.13 });
        this.tone({ freq: 1320, dur: 0.22, type: 'sine', gain: 0.08, delay: 0.06 });
        break;
      case 'levelup':
        [523, 659, 784, 1047].forEach((f, i) =>
          this.tone({ freq: f, dur: 0.24, type: 'triangle', gain: 0.1, delay: i * 0.09 }),
        );
        break;
      case 'moo':
        this.tone({ freq: 150, to: 128, dur: 0.42, type: 'sawtooth', gain: 0.09, curve: 'lin' });
        this.tone({ freq: 76, dur: 0.5, type: 'sine', gain: 0.07 });
        break;
      case 'oink':
        this.tone({ freq: 420, to: 300, dur: 0.09, type: 'sawtooth', gain: 0.07 });
        this.tone({ freq: 380, to: 260, dur: 0.09, type: 'sawtooth', gain: 0.07, delay: 0.13 });
        break;
      case 'baa':
        this.tone({ freq: 430, to: 400, dur: 0.34, type: 'square', gain: 0.05, curve: 'lin' });
        this.noise({ dur: 0.3, freq: 1300, to: 900, q: 3, gain: 0.03, delay: 0.02 });
        break;
      case 'cluck':
        this.tone({ freq: 900, to: 700, dur: 0.06, type: 'square', gain: 0.05 });
        this.tone({ freq: 820, to: 1100, dur: 0.07, type: 'square', gain: 0.05, delay: 0.1 });
        break;
      case 'woof':
        this.noise({ dur: 0.12, freq: 700, to: 300, q: 1.2, gain: 0.09 });
        this.tone({ freq: 260, to: 190, dur: 0.13, type: 'sawtooth', gain: 0.07 });
        break;
      case 'meow':
        this.tone({ freq: 620, to: 900, dur: 0.16, type: 'sine', gain: 0.06 });
        this.tone({ freq: 880, to: 620, dur: 0.22, type: 'sine', gain: 0.055, delay: 0.14 });
        break;
      case 'thunder':
        this.noise({ dur: 1.5, freq: 260, to: 45, q: 0.5, gain: 0.2, type: 'lowpass' });
        this.noise({ dur: 0.6, freq: 900, to: 200, q: 0.7, gain: 0.1, delay: 0.05, type: 'lowpass' });
        this.tone({ freq: 60, to: 34, dur: 1.2, type: 'sine', gain: 0.11, curve: 'lin' });
        break;
      case 'portal':
        this.tone({ freq: 300, to: 900, dur: 0.5, type: 'sine', gain: 0.08 });
        this.tone({ freq: 600, to: 1500, dur: 0.5, type: 'sine', gain: 0.05, delay: 0.05 });
        break;
      case 'eat':
        this.noise({ dur: 0.1, freq: 500, to: 220, q: 1.6, gain: 0.09 });
        this.noise({ dur: 0.1, freq: 460, to: 200, q: 1.6, gain: 0.08, delay: 0.16 });
        break;
      case 'pop':
        this.tone({ freq: 500, to: 1100, dur: 0.07, type: 'sine', gain: 0.09 });
        break;
      case 'xp':
        this.tone({ freq: 1200, to: 1800, dur: 0.1, type: 'triangle', gain: 0.06 });
        this.tone({ freq: 1600, to: 2400, dur: 0.11, type: 'triangle', gain: 0.05, delay: 0.07 });
        break;
      case 'hurt':
        this.tone({ freq: 330, to: 150, dur: 0.2, type: 'square', gain: 0.09 });
        break;
      case 'craft':
        this.noise({ dur: 0.14, freq: 1800, to: 700, q: 2, gain: 0.09 });
        this.tone({ freq: 520, to: 780, dur: 0.12, type: 'triangle', gain: 0.07, delay: 0.05 });
        break;
      case 'equip':
        this.noise({ dur: 0.09, freq: 1600, to: 900, q: 2.4, gain: 0.07 });
        break;
      default:
        break;
    }
  }
}

export const sfx = new SfxEngine();
