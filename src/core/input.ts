/** 键盘鼠标输入 + 指针锁定 */
export class Input {
  keys = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  locked = false;
  private wheel = 0;
  private clicks: number[] = [];

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
      if (this.locked) e.preventDefault();
    });
    canvas.addEventListener('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
      if (this.locked) e.preventDefault();
    }, { passive: false });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.keys.clear();
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
  }

  requestLock(): void {
    this.canvas.requestPointerLock();
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
