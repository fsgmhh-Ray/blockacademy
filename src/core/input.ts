/** 键盘鼠标输入 + 指针锁定；移动端通过虚拟输入接口注入同样的信号 */
export class Input {
  keys = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  private _locked = false;
  /** 触屏模式没有指针锁定，用这个开关让引擎认为"一直在操作" */
  virtualLock = false;
  private wheel = 0;
  private clicks: number[] = [];
  private buttons = new Set<number>();

  get locked(): boolean {
    return this.virtualLock || this._locked;
  }
  /** 真实的指针锁定状态（不含触屏模式的虚拟值） */
  get realLocked(): boolean {
    return this._locked;
  }

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      this.keys.add(e.code);
      if (['Space', 'Tab', 'F1'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousedown', (e) => {
      this.clicks.push(e.button);
      this.buttons.add(e.button);
      if (this.locked) e.preventDefault();
    });
    window.addEventListener('mouseup', (e) => this.buttons.delete(e.button));
    window.addEventListener('blur', () => this.buttons.clear());
    canvas.addEventListener('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
      if (this.locked) e.preventDefault();
    }, { passive: false });

    document.addEventListener('pointerlockchange', () => {
      this._locked = document.pointerLockElement === canvas;
      if (!this._locked) this.keys.clear();
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
  }

  // ───────── 虚拟输入（触屏 / 手柄注入，与真实键盘鼠标等价） ─────────
  /** 按住 / 松开一个虚拟按键，例如 'KeyW'、'Space' */
  setVirtual(code: string, on: boolean): void {
    if (on) this.keys.add(code);
    else this.keys.delete(code);
  }
  addLook(dx: number, dy: number): void {
    this.mouseDX += dx;
    this.mouseDY += dy;
  }
  pushClick(button: number): void {
    this.clicks.push(button);
  }
  /** 触屏按钮可以长按挖/放 */
  setVirtualMouse(button: number, on: boolean): void {
    if (on) this.buttons.add(button);
    else this.buttons.delete(button);
  }
  mouseHeld(button: number): boolean {
    return this.buttons.has(button);
  }
  addWheel(n: number): void {
    this.wheel += n;
  }

  requestLock(): void {
    if (this.virtualLock) return;
    try {
      // 刚按过 ESC 时浏览器会短暂拒绝锁定，这里把异常和 Promise rejection 都吞掉
      const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (p && typeof p.then === 'function') p.then(undefined, () => undefined);
    } catch {
      /* ignore */
    }
  }
  exitLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  down(code: string): boolean {
    return this.keys.has(code);
  }

  /** 取出本帧累计的鼠标位移并清零 */
  takeLook(): { dx: number; dy: number } {
    const d = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return d;
  }

  takeWheel(): number {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  takeClick(button: number): boolean {
    const i = this.clicks.indexOf(button);
    if (i >= 0) {
      this.clicks.splice(i, 1);
      return true;
    }
    return false;
  }

  /** 本帧是否按下某键（按下瞬间） */
  private pressedOnce = new Set<string>();
  pressed(code: string): boolean {
    if (this.keys.has(code) && !this.pressedOnce.has(code)) {
      this.pressedOnce.add(code);
      return true;
    }
    return false;
  }
  endFrame(): void {
    for (const k of [...this.pressedOnce]) if (!this.keys.has(k)) this.pressedOnce.delete(k);
    this.clicks.length = 0;
  }
}
