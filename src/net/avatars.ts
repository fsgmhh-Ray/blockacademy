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
  /** 表情动画：类型 + 结束时间 */
  emote: string;
  emoteUntil: number;
  emoteIcon: THREE.Sprite | null;
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
    } else if (r.state.outfit !== st.outfit) {
      // 对方换装了：重建化身（保留位置和朝向，别把人瞬移走）
      const pos = r.pos.clone();
      const target = r.target.clone();
      const yaw = r.yaw;
      this.remove(st.id);
      r = this.build(st);
      r.pos.copy(pos);
      r.target.copy(target);
      r.yaw = yaw;
      r.group.rotation.y = yaw;
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

  /** 表情：播放一段动作，并在头顶冒一个 emoji */
  emote(id: string, anim: string, icon: string, dur: number): void {
    const r = this.map.get(id);
    if (!r) return;
    r.emote = anim;
    r.emoteUntil = performance.now() + dur * 1000;
    if (r.emoteIcon) {
      r.group.remove(r.emoteIcon);
      (r.emoteIcon.material as THREE.SpriteMaterial).map?.dispose();
      (r.emoteIcon.material as THREE.SpriteMaterial).dispose();
    }
    const sp = textSprite(icon, { bg: 'rgba(0,0,0,0)', fg: '#ffffff', w: 128, h: 128, font: 96 });
    sp.position.set(0, 2.45, 0);
    sp.scale.setScalar(0.6);
    r.emoteIcon = sp;
    r.group.add(sp);
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
      // 表情动作
      const emoting = now < r.emoteUntil;
      if (emoting) {
        const e = r.emote;
        const t = (performance.now() % 1000) / 1000;
        if (e === 'wave') {
          r.limbs.armR.rotation.x = -2.4 + Math.sin(t * Math.PI * 6) * 0.5;
          r.limbs.armR.rotation.z = 0.4;
        } else if (e === 'dance') {
          r.limbs.armR.rotation.x = -1.6 + Math.sin(t * Math.PI * 6) * 0.8;
          r.limbs.armL.rotation.x = -1.6 - Math.sin(t * Math.PI * 6) * 0.8;
          r.limbs.body.rotation.z = Math.sin(t * Math.PI * 4) * 0.18;
        } else if (e === 'jump') {
          r.limbs.body.position.y = 1.02 + Math.abs(Math.sin(t * Math.PI * 3)) * 0.45;
          r.limbs.legL.rotation.x = -0.5;
          r.limbs.legR.rotation.x = 0.5;
        } else if (e === 'sit') {
          r.limbs.legL.rotation.x = -1.4;
          r.limbs.legR.rotation.x = -1.4;
          r.limbs.body.position.y = 0.72;
        } else if (e === 'cheer') {
          r.limbs.armR.rotation.x = -2.8;
          r.limbs.armL.rotation.x = -2.8;
          r.limbs.body.position.y = 1.02 + Math.abs(Math.sin(t * Math.PI * 4)) * 0.2;
        } else if (e === 'point') {
          r.limbs.armR.rotation.x = -1.5;
          r.limbs.armR.rotation.z = -0.2;
        } else if (e === 'sleep') {
          r.limbs.armL.rotation.x = -1.2;
          r.limbs.armR.rotation.x = -1.2;
          r.limbs.body.rotation.x = 0.3;
        } else if (e === 'heart') {
          r.limbs.armR.rotation.x = -1.9;
          r.limbs.armL.rotation.x = -1.9;
        } else if (e === 'spin') {
          r.group.rotation.y = r.yaw + t * Math.PI * 2;
        }
      } else {
        r.limbs.body.rotation.z = 0;
        r.limbs.body.rotation.x = 0;
        r.limbs.armL.rotation.x = -s * 0.5;
        r.limbs.armR.rotation.x = s * 0.5;
        r.limbs.armL.rotation.z = 0;
        r.limbs.armR.rotation.z = 0;
        r.limbs.legL.rotation.x = s * 0.7;
        r.limbs.legR.rotation.x = -s * 0.7;
        r.group.rotation.y = r.yaw;
        if (r.emoteIcon) {
          r.group.remove(r.emoteIcon);
          (r.emoteIcon.material as THREE.SpriteMaterial).map?.dispose();
          (r.emoteIcon.material as THREE.SpriteMaterial).dispose();
          r.emoteIcon = null;
        }
      }
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
    // 外观：优先用玩家自己选的衣服，没有就退回房间颜色
    let skinHex = 0xe9b98c;
    let shirtHex = new THREE.Color(st.color || '#5ad1c9').getHex();
    let pantsHex = 0x3c4a63;
    let shoesHex = 0x2b3038;
    let hatEmoji = '';
    let hairEmoji = '';
    if (st.outfit) {
      try {
        const o = JSON.parse(st.outfit) as {
          skin?: string;
          shirt?: string;
          pants?: string;
          shoes?: string;
          hat?: string;
          hair?: string;
        };
        if (o.skin) skinHex = new THREE.Color(o.skin).getHex();
        if (o.shirt) shirtHex = new THREE.Color(o.shirt).getHex();
        if (o.pants) pantsHex = new THREE.Color(o.pants).getHex();
        if (o.shoes) shoesHex = new THREE.Color(o.shoes).getHex();
        hatEmoji = o.hat ?? '';
        hairEmoji = o.hair ?? '';
      } catch {
        /* ignore broken outfit payload */
      }
    }
    const shirt = new THREE.Color(shirtHex);
    const skin = skinHex;
    const pants = pantsHex;

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
    // 鞋子
    const shoeL = box(0.22, 0.12, 0.26, shoesHex);
    shoeL.position.set(-0.14, 0.05, 0.03);
    const shoeR = shoeL.clone();
    shoeR.position.set(0.14, 0.05, 0.03);
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
    g.add(body, head, eyeL, eyeR, armL, armR, legL, legR, shoeL, shoeR);

    // 帽子 / 发型：用小贴图精灵挂在头顶
    if (hatEmoji) {
      const hatTag = textSprite(hatEmoji, { bg: 'rgba(0,0,0,0)', fg: '#ffffff', w: 128, h: 128, font: 96 });
      hatTag.position.set(0, 1.98, 0);
      hatTag.scale.setScalar(0.55);
      g.add(hatTag);
    }
    if (hairEmoji) {
      const hairTag = textSprite(hairEmoji, { bg: 'rgba(0,0,0,0)', fg: '#ffffff', w: 128, h: 128, font: 96 });
      hairTag.position.set(0, 1.84, -0.06);
      hairTag.scale.setScalar(0.42);
      g.add(hairTag);
    }

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
      emote: '',
      emoteUntil: 0,
      emoteIcon: null,
      limbs: { armL, armR, legL, legR, body },
    };
    g.position.copy(r.pos);
    g.rotation.y = st.yaw;
    return r;
  }
}
