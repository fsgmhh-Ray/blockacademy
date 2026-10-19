/** 3D teaching-demo player: plays a built DemoDef in its own scene, with subtitles, narration and step controls */
import * as THREE from 'three';
import { DEMO_BY_ID, type DemoDef } from '../edu/demos';
import { say, stopSpeaking } from '../npc/npcActor';
import { speechEnabled } from './speech';

export interface ShowcaseHooks {
  onFrame: (info: { title: string; step: number; steps: number; text: string; progress: number }) => void;
  onEnd: (demoId: string) => void;
}

export class ShowcasePlayer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
  active = false;
  private demo: DemoDef | null = null;
  private objs: Record<string, THREE.Object3D> = {};
  private t = 0;
  private step = 0;
  private stepClock = 0;
  private hook!: ShowcaseHooks;
  private lights: THREE.Object3D[] = [];

  constructor() {
    this.scene.fog = new THREE.FogExp2(0x000000, 0.02);
  }

  init(hook: ShowcaseHooks): void {
    this.hook = hook;
  }

  get demoId(): string | null {
    return this.demo?.id ?? null;
  }

  play(id: string): boolean {
    const d = DEMO_BY_ID.get(id);
    if (!d) return false;
    this.stop(true);
    this.demo = d;
    this.t = 0;
    this.step = 0;
    this.stepClock = 0;
    this.scene.background = new THREE.Color(d.bg);
    (this.scene.fog as THREE.FogExp2).color.setHex(d.fog ?? d.bg);
    (this.scene.fog as THREE.FogExp2).density = d.fog ? 0.012 : 0.02;
    this.objs = d.build();
    this.scene.add(this.objs.root);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x404060, 1.05);
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(6, 12, 8);
    this.scene.add(hemi, dir);
    this.lights = [hemi, dir];
    this.active = true;
    this.announce();
    return true;
  }

  private announce(): void {
    if (!this.demo) return;
    const stepDef = this.demo.steps[this.step];
    this.hook.onFrame({
      title: `${this.demo.icon} ${this.demo.title}`,
      step: this.step,
      steps: this.demo.steps.length,
      text: stepDef.text,
      progress: 0,
    });
    if (speechEnabled()) {
      const voice = { voiceRate: 0.94, voicePitch: 1.0, id: 'narrator' } as never;
      say(voice, stepDef.text);
    }
  }

  next(): void {
    if (!this.demo) return;
    if (this.step < this.demo.steps.length - 1) {
      this.step++;
      this.stepClock = 0;
      this.announce();
    } else {
      this.end();
    }
  }

  prev(): void {
    if (!this.demo || this.step <= 0) return;
    this.step--;
    this.stepClock = 0;
    this.announce();
  }

  skip(): void {
    this.end();
  }

  private end(): void {
    const id = this.demo?.id ?? '';
    this.stop(true);
    this.hook.onEnd(id);
  }

  stop(silent = false): void {
    if (!this.active) return;
    stopSpeaking();
    if (this.objs.root) this.scene.remove(this.objs.root);
    for (const l of this.lights) this.scene.remove(l);
    this.lights = [];
    this.objs = {};
    this.demo = null;
    this.active = false;
    if (!silent) this.hook.onEnd('');
  }

  update(dt: number, aspect: number): void {
    if (!this.active || !this.demo) return;
    this.t += dt;
    this.stepClock += dt;
    const cur = this.demo.steps[this.step];
    if (this.stepClock >= cur.dur) {
      if (this.step < this.demo.steps.length - 1) {
        this.step++;
        this.stepClock = 0;
        this.announce();
      } else {
        this.end();
        return;
      }
    }
    if (aspect !== this.camera.aspect) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
    this.demo.tick(this.objs, this.t, this.step);
    this.demo.cam(this.objs, this.t, this.step, this.camera);
    const progress = this.demo.steps.slice(0, this.step).reduce((a, s) => a + s.dur, 0) + this.stepClock;
    const total = this.demo.steps.reduce((a, s) => a + s.dur, 0);
    this.hook.onFrame({
      title: `${this.demo.icon} ${this.demo.title}`,
      step: this.step,
      steps: this.demo.steps.length,
      text: this.demo.steps[this.step].text,
      progress: Math.min(1, progress / total),
    });
  }
}
