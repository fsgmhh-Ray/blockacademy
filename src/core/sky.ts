/**
 * 天空系统：太阳、月亮、星星、云
 * 所有天体都跟随相机做水平位移，保证永远"在天边"；材质关闭雾效，避免被场景雾吞掉。
 */
import * as THREE from 'three';

function radialTexture(core: string, mid: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, core);
  grd.addColorStop(0.35, mid);
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

interface Puff {
  rx: number;
  rz: number;
  y: number;
  s: number;
  sp: number;
}

export class Sky {
  readonly group = new THREE.Group();

  private sun = new THREE.Mesh();
  private moon = new THREE.Mesh();
  private sunGlow: THREE.Sprite;
  private moonGlow: THREE.Sprite;
  private clouds: THREE.InstancedMesh;
  private stars: THREE.Points;
  private dummy = new THREE.Object3D();

  private puffs: Puff[] = [];
  private drift = 0;
  private norm = 0;
  private radius = 250;
  private cloudsOn = true;
  private enabled = true;

  /** 0 = 正午，1 = 午夜 */
  private timeNorm = 0;
  private dir = new THREE.Vector3(0, 1, 0);
  /** 日月的基准位置（不含跟随相机的偏移） */
  private sunBase = new THREE.Vector3();
  private moonBase = new THREE.Vector3();

  constructor() {
    // ── 太阳：亮球 + 光晕
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff3b0, fog: false });
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(13, 20, 14), sunMat);
    this.sunGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: radialTexture('rgba(255,240,170,0.95)', 'rgba(255,200,90,0.35)'),
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    );
    this.sunGlow.scale.setScalar(110);
    this.sun.add(this.sunGlow);

    // ── 月亮：淡灰球带几个环形山斑点 + 冷光晕
    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(10, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0xdfe6f5, fog: false }),
    );
    const craters = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const r = 1.1 + Math.random() * 1.6;
      const dot = new THREE.Mesh(
        new THREE.CircleGeometry(r, 10),
        new THREE.MeshBasicMaterial({ color: 0xb9c2d6, fog: false, side: THREE.DoubleSide }),
      );
      const a = Math.random() * Math.PI * 2;
      const b = (Math.random() - 0.5) * 1.6;
      dot.position.set(Math.cos(a) * Math.cos(b) * 9.6, Math.sin(b) * 9.6, Math.sin(a) * Math.cos(b) * 9.6);
      dot.lookAt(0, 0, 0);
      craters.add(dot);
    }
    this.moon.add(craters);
    this.moonGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: radialTexture('rgba(226,236,255,0.75)', 'rgba(150,180,255,0.22)'),
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    );
    this.moonGlow.scale.setScalar(88);
    this.moon.add(this.moonGlow);

    // ── 星星
    const n = 1100;
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const elev = 0.12 + Math.random() * 0.85;
      const r = 230;
      arr[i * 3] = Math.cos(a) * Math.sqrt(1 - elev * elev) * r;
      arr[i * 3 + 1] = elev * r;
      arr[i * 3 + 2] = Math.sin(a) * Math.sqrt(1 - elev * elev) * r;
      const w = 0.75 + Math.random() * 0.25;
      col[i * 3] = w;
      col[i * 3 + 1] = w;
      col[i * 3 + 2] = w * (0.9 + Math.random() * 0.1);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.stars = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        size: 2.1,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
      }),
    );
    this.stars.frustumCulled = false;

    // ── 云：一堆球体实例，缓慢横向漂移
    const puffGeo = new THREE.SphereGeometry(1, 7, 5);
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      fog: false,
    });
    const CLOUDS = 26;
    const PER = 4;
    this.clouds = new THREE.InstancedMesh(puffGeo, cloudMat, CLOUDS * PER);
    this.clouds.frustumCulled = false;
    for (let c = 0; c < CLOUDS; c++) {
      const baseY = 62 + Math.random() * 46;
      for (let p = 0; p < PER; p++) {
        this.puffs.push({
          rx: (Math.random() * 2 - 1) * 210,
          rz: (Math.random() * 2 - 1) * 210,
          y: baseY + (Math.random() - 0.5) * 5,
          s: 5 + Math.random() * 7,
          sp: 1.1 + Math.random() * 1.6,
        });
      }
      // 让同一朵云的 4 个球靠在一起
      const bx = this.puffs[this.puffs.length - PER].rx;
      const bz = this.puffs[this.puffs.length - PER].rz;
      for (let p = 0; p < PER; p++) {
        const q = this.puffs[this.puffs.length - PER + p];
        q.rx = bx + (p % 2 === 0 ? p * 6 : -p * 5);
        q.rz = bz + (p < 2 ? p * 4.5 : -p * 3.5);
      }
    }

    this.group.add(this.sun, this.moon, this.stars, this.clouds);
  }

  attach(scene: THREE.Scene): void {
    scene.add(this.group);
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    this.group.visible = v;
  }

  setClouds(v: boolean): void {
    this.cloudsOn = v;
    this.clouds.visible = v;
  }

  /** 0=正午 0.5=黄昏 1=午夜 */
  setTime(norm: number): void {
    this.timeNorm = Math.max(0, Math.min(1, norm));
    const theta = (0.5 - this.timeNorm) * Math.PI;
    const R = this.radius;
    // 太阳沿一条倾斜轨道运行：正午在头顶，午夜沉到脚下
    const sy = Math.sin(theta) * R;
    const sh = Math.cos(theta) * R;
    this.sunBase.set(sh * 0.55, sy, sh * -0.83);
    this.moonBase.set(-sh * 0.55, -sy, -sh * -0.83);
    this.sun.visible = sy > -30;
    this.moon.visible = -sy > -30;

    const night = Math.max(0, (this.timeNorm - 0.42) / 0.34);
    this.norm = Math.min(1, night);
    (this.stars.material as THREE.PointsMaterial).opacity = this.norm * 0.95;
    // 夜色越深，云也跟着暗下来
    (this.clouds.material as THREE.MeshBasicMaterial).color.setRGB(
      1 - 0.55 * this.timeNorm,
      1 - 0.55 * this.timeNorm,
      1 - 0.42 * this.timeNorm,
    );
    this.dir.copy(this.sun.position).normalize();
  }

  /** 太阳（白天）或月亮（夜里）的照射方向，供方向光使用 */
  lightDirection(out: THREE.Vector3): THREE.Vector3 {
    if (this.timeNorm < 0.5) return out.copy(this.sunBase).normalize();
    return out.copy(this.moonBase).normalize();
  }

  update(dt: number, cam: THREE.Vector3): void {
    if (!this.enabled) return;
    // 天体永远以相机为中心：位置 = 基准 + 相机水平偏移（每帧重算，不做累加）
    this.sun.position.set(this.sunBase.x + cam.x, this.sunBase.y, this.sunBase.z + cam.z);
    this.moon.position.set(this.moonBase.x + cam.x, this.moonBase.y, this.moonBase.z + cam.z);

    this.stars.position.set(cam.x, 0, cam.z);
    this.stars.rotation.y += dt * 0.006;

    if (this.cloudsOn) {
      this.drift += dt;
      for (const p of this.puffs) {
        p.rx += p.sp * dt * 1.6;
        if (p.rx > 230) p.rx -= 460;
        if (p.rx < -230) p.rx += 460;
      }
      for (let i = 0; i < this.puffs.length; i++) {
        const p = this.puffs[i];
        this.dummy.position.set(cam.x + p.rx, p.y, cam.z + p.rz);
        this.dummy.scale.set(p.s, p.s * 0.62, p.s * 0.9);
        this.dummy.updateMatrix();
        this.clouds.setMatrixAt(i, this.dummy.matrix);
      }
      this.clouds.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    this.group.removeFromParent();
  }
}
