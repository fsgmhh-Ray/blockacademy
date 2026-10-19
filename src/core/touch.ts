/**
 * 移动端（BEDROCK EDITION）触控层
 * 虚拟摇杆 + 视角拖拽 + 按钮组，全部转译成与键鼠等价的输入信号，
 * 因此游戏内所有逻辑（挖掘、放置、飞行、对话、指令）在手机上完全一致。
 */
import type { Input } from './input';

export type TouchAction =
  | 'break'
  | 'place'
  | 'jump'
  | 'sneak'
  | 'fly'
  | 'fart'
  | 'inventory'
  | 'chat'
  | 'menu';

const HOLD = new Set<TouchAction>(['jump', 'sneak', 'break', 'place']);
const KEY_OF: Partial<Record<TouchAction, string>> = { jump: 'Space', sneak: 'ShiftLeft' };
const MOUSE_OF: Partial<Record<TouchAction, number>> = { break: 0, place: 2 };

export class TouchControls {
  private layer!: HTMLDivElement;
  private knob!: HTMLDivElement;
  private look!: HTMLDivElement;
  private stickId = -1;
  private cx = 0;
  private cy = 0;
  private radius = 58;
  private lookId = -1;
  private lx = 0;
  private ly = 0;
  /** 视角灵敏度倍率 */
  lookSens = 1.25;
  enabled = false;

  private held = new Set<TouchAction>();

  constructor(
    private root: HTMLElement,
    private input: Input,
    private onAction: (a: TouchAction) => void,
  ) {
    this.layer = document.createElement('div');
    this.layer.id = 'touch-layer';
    this.layer.innerHTML = `
      <div id="touch-look"></div>
      <div id="touch-stick"><div id="touch-knob"></div></div>
      <div id="touch-top">
        <button class="tbtn round" data-a="menu" type="button">☰</button>
        <button class="tbtn round" data-a="inventory" type="button">🎒</button>
        <button class="tbtn round" data-a="chat" type="button">💬</button>
      </div>
      <div id="touch-btns">
        <button class="tbtn" data-a="jump" type="button">⬆</button>
        <button class="tbtn" data-a="fart" type="button">💨</button>
        <button class="tbtn" data-a="break" type="button">⛏</button>
        <button class="tbtn" data-a="place" type="button">🧱</button>
        <button class="tbtn" data-a="fly" type="button">🪶</button>
        <button class="tbtn" data-a="sneak" type="button">⬇</button>
      </div>`;
    this.root.appendChild(this.layer);
    this.knob = this.layer.querySelector('#touch-knob') as HTMLDivElement;
    this.look = this.layer.querySelector('#touch-look') as HTMLDivElement;

    const stick = this.layer.querySelector('#touch-stick') as HTMLDivElement;
    stick.addEventListener('pointerdown', (e) => this.stickStart(e, stick));
    stick.addEventListener('pointermove', (e) => this.stickMove(e));
    stick.addEventListener('pointerup', (e) => this.stickEnd(e));
    stick.addEventListener('pointercancel', (e) => this.stickEnd(e));

    this.look.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      this.lookId = e.pointerId;
      this.lx = e.clientX;
      this.ly = e.clientY;
      this.look.setPointerCapture(e.pointerId);
    });
    this.look.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookId) return;
      const dx = e.clientX - this.lx;
      const dy = e.clientY - this.ly;
      this.lx = e.clientX;
      this.ly = e.clientY;
      this.input.addLook(dx * this.lookSens, dy * this.lookSens);
    });
    const endLook = (e: PointerEvent) => {
      if (e.pointerId !== this.lookId) return;
      this.lookId = -1;
    };
    this.look.addEventListener('pointerup', endLook);
    this.look.addEventListener('pointercancel', endLook);

    this.layer.querySelectorAll<HTMLButtonElement>('.tbtn').forEach((btn) => {
      const a = btn.dataset.a as TouchAction;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.add('down');
        if (HOLD.has(a)) {
          this.held.add(a);
          const k = KEY_OF[a];
          if (k) this.input.setVirtual(k, true);
          const mb = MOUSE_OF[a];
          if (mb !== undefined) this.input.setVirtualMouse(mb, true);
        }
        this.onAction(a);
      });
      const up = (e: PointerEvent) => {
        e.preventDefault();
        btn.classList.remove('down');
        if (HOLD.has(a)) {
          this.held.delete(a);
          const k = KEY_OF[a];
          if (k) this.input.setVirtual(k, false);
          const mb = MOUSE_OF[a];
          if (mb !== undefined) this.input.setVirtualMouse(mb, false);
        }
      };
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  private stickStart(e: PointerEvent, el: HTMLElement): void {
    if (!this.enabled) return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    this.cx = r.left + r.width / 2;
    this.cy = r.top + r.height / 2;
    this.radius = r.width / 2 - 6;
    this.stickId = e.pointerId;
    el.setPointerCapture(e.pointerId);
    this.stickMove(e);
  }

  private stickMove(e: PointerEvent): void {
    if (e.pointerId !== this.stickId) return;
    let dx = e.clientX - this.cx;
    let dy = e.clientY - this.cy;
    const d = Math.hypot(dx, dy);
    if (d > this.radius) {
      dx = (dx / d) * this.radius;
      dy = (dy / d) * this.radius;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / this.radius;
    const ny = dy / this.radius;
    this.input.setVirtual('KeyW', ny < -0.32);
    this.input.setVirtual('KeyS', ny > 0.32);
    this.input.setVirtual('KeyA', nx < -0.32);
    this.input.setVirtual('KeyD', nx > 0.32);
  }

  private stickEnd(e: PointerEvent): void {
    if (e.pointerId !== this.stickId) return;
    this.stickId = -1;
    this.knob.style.transform = 'translate(0px, 0px)';
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) this.input.setVirtual(k, false);
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    this.layer.classList.toggle('on', v);
    if (!v) {
      this.knob.style.transform = 'translate(0px, 0px)';
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft']) this.input.setVirtual(k, false);
      for (const b of [0, 2]) this.input.setVirtualMouse(b, false);
      this.held.clear();
    }
  }

  /** 给外部（如挖/放按钮）直接派发一次点击信号 */
  static click(input: Input, button: number): void {
    input.pushClick(button);
  }
}
