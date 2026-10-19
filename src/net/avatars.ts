/**
 * 远程玩家化身：体素小人 + 名字牌 + 聊天气泡。
 * 只渲染与自己在同一场景的玩家；位置做指数插值，移动时有走路摆动。
 */
import * as THREE from 'three';
import type { ChatMsg, PlayerState } from './protocol';

interface Remote {
  state: PlayerState;
  group: THREE.Group;
  pos: THREE.Vector3;
  target: THREE.Vector3;
  yaw: number;
  tag: THREE.Sprite;
  bubble: THREE.Sprite | null;
  bubbleUntil: number;
  walkT: number;
  waveUntil: number;
  /** 四肢引用，用于摆动动画 */
  limbs: { armL: THREE.Mesh; armR: THREE.Mesh; legL: THREE.Mesh; legR: THREE.Mesh; body: THREE.Mesh };
}

function textSprite(
  text: string,
  opts: { bg: string; fg: string; w?: number; h?: number; font?: number; wrap?: boolean },
): THREE.Sprite {
  const w = opts.w ?? 256;
  const h = opts.h ?? 64;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  const font = opts.font ?? 34;
  ctx.font = `700 ${font}px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`;
  // 需要换行时按字符宽度断行（中英混排安全）
  const lines: string[] = [];
  if (opts.wrap) {
    let cur = '';
    for (const ch of text) {
      if (ctx.measureText(cur + ch).width > w - 28 && cur) {
        lines.push(cur);
        cur = ch;
      } else cur += ch;
    }
    if (cur) lines.push(cur);
  } else {
    lines.push(ctx.measureText(text).width > w - 28 ? text.slice(0, 24) + '…' : text);
  }
  const lineH = Math.ceil(font * 1.25);
  const totalH = lines.length * lineH;
  const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const pad = 10;
  const bx = Math.max(2, (w - tw) / 2 - pad);
  const bw = Math.min(w - 4, tw + pad * 2);
  const by = Math.max(2, (h - totalH) / 2 - pad / 2);
  ctx.fillStyle = opts.bg;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, totalH + pad, 12);
  ctx.fill();
  ctx.fillStyle = opts.fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, w / 2, by + pad / 2 + i * lineH + lineH / 2, w - 28));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, fog: false }));
  sp.scale.set((w / h) * 0.42, 0.42, 1);
  sp.renderOrder = 6;
  return sp;
}

function box(w: number, h: number, d: number, color: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
}

export class RemotePlayers {
  readonly group = new THREE.Group();
  private map = new Map<string, Remote>();

  attach(scene: THREE.Scene): void {
    scene.add(this.group);
  }

  /** 新建/更新一个远程玩家（upsert 语义） */
  upsert(st: PlayerState): void {
    let r = this.map.get(st.id);
    if (!r) {
      r = this.build(st);
      this.map.set(st.id, r);
      this.group.add(r.group);
    }
    r.state = st;
    r.target.set(st.x, st.y, st.z);
    // 朝向直接对齐（远程玩家的转头不需要插值）
    r.yaw = st.yaw;
    r.group.rotation.y = st.yaw;
  }

  remove(id: string): void {
    const r = this.map.get(id);
    if (!r) return;
    this.map.delete(id);
    this.group.remove(r.group);
    r.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as (THREE.Material & { map?: THREE.Texture }) | undefined;
      mat?.map?.dispose?.();
      mat?.dispose?.();
    });
  }

  clear(): void {
    for (const id of [...this.map.keys()]) this.remove(id);
  }

  /** 远程玩家说话：头顶气泡 4.5 秒 */
  say(m: ChatMsg): void {
    const r = this.map.get(m.id);
    if (!r) return;
    const text = `${m.avatar} ${m.name}: ${m.text}`;
    if (r.bubble) {
      r.group.remove(r.bubble);
      (r.bubble.material as THREE.SpriteMaterial).map?.dispose();
      (r.bubble.material as THREE.SpriteMaterial).dispose();
    }
    r.bubble = textSprite(text, { bg: 'rgba(10,16,28,0.88)', fg: '#eaf2ff', h: 96, font: 30, wrap: true });
    r.bubble.position.set(0, 2.55, 0);
    r.group.add(r.bubble);
    r.bubbleUntil = performance.now() + 4500;
  }

  /** 挥手：右臂举 1.2 秒 */
  wave(id: string): void {
    const r = this.map.get(id);
    if (r) r.waveUntil = performance.now() + 1200;
  }

  count(sceneId: string): number {
    let n = 0;
    for (const r of this.map.values()) if (r.state.scene === sceneId) n++;
    return n;
  }

  update(dt: number, now: number, sceneId: string): void {
    for (const r of this.map.values()) {
      const here = r.state.scene === sceneId;
      r.group.visible = here;
      if (!here) continue;
      // 指数插值；距离太远（传送/场景切换）直接贴过去
      const d = r.pos.distanceTo(r.target);
      if (d > 8) r.pos.copy(r.target);
      else if (d > 0.002) {
        const k = 1 - Math.exp(-12 * dt);
        r.pos.lerp(r.target, k);
      }
      r.group.position.copy(r.pos);
      // 走路摆动
      const moving = d > 0.01;
      r.walkT = moving ? r.walkT + dt * 9 : r.walkT * (1 - Math.min(1, dt * 6));
      const s = Math.sin(r.walkT) * Math.min(1, d * 6);
      r.limbs.legL.rotation.x = s * 0.7;
      r.limbs.legR.rotation.x = -s * 0.7;
      r.limbs.armL.rotation.x = -s * 0.5;
      // 挥手时右臂举起
      const waving = now < r.waveUntil;
      r.limbs.armR.rotation.x = waving ? -2.4 : s * 0.5;
      r.limbs.body.position.y = 1.02 + Math.abs(Math.sin(r.walkT)) * 0.05 * Math.min(1, d * 6);
      // 气泡过期
      if (r.bubble && now > r.bubbleUntil) {
        r.group.remove(r.bubble);
        (r.bubble.material as THREE.SpriteMaterial).map?.dispose();
        (r.bubble.material as THREE.SpriteMaterial).dispose();
        r.bubble = null;
      }
    }
  }

  private build(st: PlayerState): Remote {
    const g = new THREE.Group();
    const shirt = new THREE.Color(st.color || '#5ad1c9');
    const skin = 0xe9b98c;
    const pants = 0x3c4a63;

    const body = box(0.56, 0.72, 0.3, shirt.getHex());
    body.position.set(0, 1.02, 0);
    const head = box(0.5, 0.5, 0.5, skin);
    head.position.set(0, 1.56, 0);
    // 简单脸部（前面两眼）让小人有个"正面"
    const eye = box(0.08, 0.08, 0.02, 0x22303f);
    const eyeL = eye.clone();
    eyeL.position.set(-0.12, 1.6, 0.26);
    const eyeR = eye.clone();
    eyeR.position.set(0.12, 1.6, 0.26);
    const armL = box(0.17, 0.62, 0.22, shirt.clone().offsetHSL(0, 0, -0.08).getHex());
    armL.position.set(-0.38, 1.04, 0);
    const armR = armL.clone();
    armR.position.set(0.38, 1.04, 0);
    const legL = box(0.2, 0.64, 0.22, pants);
    legL.position.set(-0.14, 0.34, 0);
    const legR = legL.clone();
    legR.position.set(0.14, 0.34, 0);
    // 四肢绕自身顶端旋转：clone() 共享几何体，先各自复制再平移轴心
    for (const [m, top] of [
      [armL, 1.35],
      [armR, 1.35],
      [legL, 0.66],
      [legR, 0.66],
    ] as [THREE.Mesh, number][]) {
      m.geometry = m.geometry.clone();
      m.geometry.translate(0, -0.31, 0);
      m.position.y = top;
    }
    g.add(body, head, eyeL, eyeR, armL, armR, legL, legR);

    const tag = textSprite(`${st.avatar} ${st.name}`, { bg: 'rgba(10,16,28,0.75)', fg: '#dceaff', w: 256, h: 64, font: 32 });
    tag.position.set(0, 2.12, 0);
    g.add(tag);

    const r: Remote = {
      state: st,
      group: g,
      pos: new THREE.Vector3(st.x, st.y, st.z),
      target: new THREE.Vector3(st.x, st.y, st.z),
      yaw: st.yaw,
      tag,
      bubble: null,
      bubbleUntil: 0,
      walkT: 0,
      waveUntil: 0,
      limbs: { armL, armR, legL, legR, body },
    };
    g.position.copy(r.pos);
    g.rotation.y = st.yaw;
    return r;
  }
}
