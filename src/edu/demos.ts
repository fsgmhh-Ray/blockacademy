/**
 * 3D dynamic teaching demos (a stand-in for "storyline videos"):
 * pure voxel animation + camera moves + subtitle narration, works offline, interactive.
 * Each demo = a few steps + a per-frame tick function.
 */
import * as THREE from 'three';

export interface DemoStep {
  dur: number;
  text: string;
}

export interface DemoDef {
  id: string;
  title: string;
  icon: string;
  bg: number;
  fog?: number;
  steps: DemoStep[];
  build: () => Record<string, THREE.Object3D>;
  tick: (s: Record<string, THREE.Object3D>, time: number, step: number) => void;
  cam: (s: Record<string, THREE.Object3D>, time: number, step: number, camera: THREE.PerspectiveCamera) => void;
}

// ─────────── shared helpers ───────────
function mat(color: number, opts: Partial<THREE.MeshLambertMaterialParameters> = {}): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

export function vbox(
  color: number,
  w = 1,
  h = 1,
  d = 1,
  opts: Partial<THREE.MeshLambertMaterialParameters> = {},
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
}

export function vsphere(color: number, r: number, seg = 16): THREE.Mesh {
  return new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), mat(color, { emissive: new THREE.Color(color).multiplyScalar(0.12) }));
}

export function label(text: string, color = '#e8f0ff', size = 30): THREE.Sprite {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  ctx.font = `bold ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  c.width = Math.ceil(ctx.measureText(text).width) + 24;
  c.height = size + 18;
  const g = c.getContext('2d')!;
  g.font = `bold ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  g.fillStyle = 'rgba(10,14,24,0.6)';
  g.beginPath();
  g.roundRect?.(0, 0, c.width, c.height, 10);
  g.fill();
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(c.width / 32, c.height / 32, 1);
  sp.renderOrder = 999;
  return sp;
}

/** a ring of access-permission point particles */
export function particles(count: number, color: number, size = 0.16): THREE.Points {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  const p = new THREE.Points(
    g,
    new THREE.PointsMaterial({ color, size, sizeAttenuation: true, transparent: true, opacity: 0.95 }),
  );
  p.userData.n = count;
  return p;
}

export function setParticles(p: THREE.Points, fn: (i: number, out: THREE.Vector3) => void): void {
  const arr = p.geometry.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < arr.count; i++) {
    fn(i, v);
    arr.setXYZ(i, v.x, v.y, v.z);
  }
  arr.needsUpdate = true;
}

const ORBIT = (camera: THREE.PerspectiveCamera, cx: number, cy: number, cz: number, r: number, h: number, t: number): void => {
  camera.position.set(cx + Math.cos(t * 0.35) * r, cy + h, cz + Math.sin(t * 0.35) * r);
  camera.lookAt(cx, cy, cz);
};

/**
 * Make obj's localAxis point along worldDir in world space (accounting for parent rotation),
 * used to keep the "lit hemisphere" always facing the Sun.
 */
const UP_AXIS = new THREE.Vector3(0, 1, 0);
function orientTo(obj: THREE.Object3D, parentObj: THREE.Object3D, worldDir: THREE.Vector3, localAxis: THREE.Vector3): void {
  const pq = new THREE.Quaternion();
  parentObj.getWorldQuaternion(pq);
  const localDir = worldDir.clone().applyQuaternion(pq.clone().invert()).normalize();
  obj.quaternion.setFromUnitVectors(localAxis, localDir);
  void UP_AXIS;
}

// ─────────── Demo 1: Water Cycle ───────────
export const waterCycle: DemoDef = {
  id: 'water_cycle',
  title: "Water's Journey",
  icon: '💧',
  bg: 0x0a1830,
  steps: [
    { dur: 6, text: 'The Sun warms the sea, and water slowly turns into invisible vapor and rises into the sky — that is evaporation.' },
    { dur: 6, text: 'Higher up it gets colder; the vapor meets the cold and gathers into tiny droplets — that is a cloud. This step is condensation.' },
    { dur: 6, text: 'Droplets grow bigger and heavier until they can no longer hold on, and fall as rain or snow — that is precipitation.' },
    { dur: 6, text: 'The falling water joins streams and rivers, flows onward, and finally returns to the sea.' },
    { dur: 6, text: 'Evaporate → condense → precipitate → collect, round and round. That is Earth\'s never-stopping water cycle.' },
  ],
  build: () => {
    const root = new THREE.Group();
    // sea
    const sea = new THREE.Mesh(new THREE.BoxGeometry(24, 1.2, 14), mat(0x2f6fb8, { transparent: true, opacity: 0.9 }));
    sea.position.y = -3;
    // land
    const land = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 10), mat(0x4f8f3f));
    land.position.set(7, -4, 0);
    const hill = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 6), mat(0x6a9f4f));
    hill.position.set(9, -1.5, 0);
    const mountain = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 4), mat(0x8a8a8a));
    mountain.position.set(10, 1, -1);
    // sun
    const sun = vsphere(0xffd45a, 1.2);
    sun.position.set(-9, 7, -3);
    // cloud
    const cloud = new THREE.Group();
    for (const [x, y, z] of [[0, 0, 0], [1.4, 0.2, 0.4], [-1.3, -0.1, -0.3], [0.5, -0.3, -0.8]] as [number, number, number][]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 1.8), mat(0xe6f0ff));
      b.position.set(x, y, z);
      cloud.add(b);
    }
    cloud.position.set(-2, 6, 0);
    const evap = particles(160, 0x9fe0ff, 0.2);
    const rain = particles(220, 0x6fb8ff, 0.14);
    const river = new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, 1), mat(0x3f8fd8));
    river.position.set(4, -1.2, 3);
    root.add(sea, land, hill, mountain, sun, cloud, evap, rain, river);
    root.add(label('Ocean', '#bfe8ff', 26).translateY(-2.2).translateX(-6));
    root.add(label('Land', '#c8f0b0', 26).translateY(2).translateX(7));
    return { root, cloud, sun, evap, rain, river };
  },
  tick: (s, t, step) => {
    const cloud = s.cloud as THREE.Group;
    const sun = s.sun as THREE.Mesh;
    sun.position.x = -9 + Math.sin(t * 0.2) * 0.6;
    cloud.position.x = -2 + Math.sin(t * 0.25) * 3.2 + (step >= 3 ? 3 : 0);
    cloud.scale.setScalar(1 + Math.sin(t * 0.8) * 0.03 + (step === 2 ? 0.18 : 0));
    // evaporation particles
    const ev = s.evap as THREE.Points;
    const evActive = step <= 1;
    (ev.material as THREE.PointsMaterial).opacity = evActive ? 0.9 : 0.15;
    setParticles(ev, (i, v) => {
      const p = (t * 0.5 + i * 0.07) % 1;
      const x = -7 + ((i * 37) % 100) / 100 * 9;
      const z = -3 + ((i * 53) % 100) / 100 * 6;
      v.set(x, -2 + p * (step >= 1 ? 8 : 4), z);
    });
    // rain
    const rn = s.rain as THREE.Points;
    (rn.material as THREE.PointsMaterial).opacity = step === 2 || step === 3 ? 0.95 : 0.0;
    setParticles(rn, (i, v) => {
      const p = (t * 1.3 + i * 0.031) % 1;
      v.set(cloud.position.x - 2 + ((i * 71) % 100) / 100 * 4, 5.4 - p * 8, -1.5 + ((i * 29) % 100) / 100 * 3);
    });
    const rv = s.river as THREE.Mesh;
    rv.position.x = 4;
    rv.scale.x = step >= 3 ? 1 : 0.25;
  },
  cam: (s, t, step, camera) => {
    void s;
    const zoom = step === 2 ? 12 : 15;
    ORBIT(camera, 0, 1 + (step >= 1 ? 1.5 : 0), 0, zoom, 4 + (step >= 1 ? 2 : 0), t);
  },
};

// ─────────── Demo 2: Photosynthesis ───────────
export const photosynthesis: DemoDef = {
  id: 'photosynthesis',
  title: "The Leaf's Little Factory",
  icon: '🍃',
  bg: 0x0d2418,
  steps: [
    { dur: 6, text: 'A single leaf holds thousands of tiny "workshops" called chloroplasts, powered by sunlight.' },
    { dur: 6, text: 'Water pulled up from the soil travels along the stem all the way into the leaves.' },
    { dur: 6, text: 'The leaf also invites carbon dioxide in from the air — it sneaks through tiny holes on the leaf\'s back.' },
    { dur: 7, text: 'With sunlight as the energy, water and carbon dioxide are turned into glucose — the plant\'s own food.' },
    { dur: 6, text: 'The "waste" it gives off is exactly the oxygen we need. Every breath you take, thank these leaves.' },
  ],
  build: () => {
    const root = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7, 0.4), mat(0x6f8f3f));
    stem.position.y = -1;
    const leaf = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.4 - i * 0.2, 0.5, 1.6), mat(0x3f9f4f));
      b.position.set(i % 2 === 0 ? 1.2 : -1.2, i * 0.8, 0);
      leaf.add(b);
    }
    leaf.position.set(0, 3, 0);
    const soil = new THREE.Mesh(new THREE.BoxGeometry(10, 1.6, 10), mat(0x5a3a22));
    soil.position.y = -4.8;
    const sun = vsphere(0xffe066, 1.3);
    sun.position.set(-6, 6, -2);
    const water = particles(60, 0x7fd0ff, 0.18);
    const co2 = particles(60, 0xcfcf8f, 0.2);
    const o2 = particles(80, 0xaffff0, 0.2);
    const sugar = particles(40, 0xffd0a0, 0.22);
    const droplet = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat(0xffe0a0));
    droplet.position.set(0, 6.4, 0);
    root.add(stem, leaf, soil, sun, water, co2, o2, sugar, droplet);
    root.add(label('Sunlight', '#ffe08a', 26).translateY(6).translateX(-6));
    root.add(label('Oxygen', '#afffff', 26).translateY(-1).translateX(4.5));
    return { root, sun, water, co2, o2, sugar, droplet, leaf };
  },
  tick: (s, t, step) => {
    (s.leaf as THREE.Group).rotation.z = Math.sin(t * 1.1) * 0.04;
    const sun = s.sun as THREE.Mesh;
    sun.scale.setScalar(1 + Math.sin(t * 2) * 0.05);
    const w = s.water as THREE.Points;
    (w.material as THREE.PointsMaterial).opacity = step >= 1 ? 0.95 : 0.2;
    setParticles(w, (i, v) => {
      const p = ((t * 0.6 + i * 0.037) % 1);
      v.set(2.2 + ((i * 13) % 40) / 100, -4 + p * 8, ((i * 17) % 30) / 100);
    });
    const c = s.co2 as THREE.Points;
    (c.material as THREE.PointsMaterial).opacity = step >= 2 ? 0.95 : 0.2;
    setParticles(c, (i, v) => {
      const p = ((t * 0.5 + i * 0.041) % 1);
      v.set(-6 + p * 7, 1 + Math.sin(i + t) * 2.4, 1 + Math.cos(i) * 1.6);
    });
    const o = s.o2 as THREE.Points;
    (o.material as THREE.PointsMaterial).opacity = step >= 4 ? 0.95 : 0.15;
    setParticles(o, (i, v) => {
      const p = ((t * 0.7 + i * 0.029) % 1);
      v.set(2.4 + p * 4, 3 + p * 5 + Math.sin(i) * 0.4, Math.cos(i * 1.3) * 1.4);
    });
    const sg = s.sugar as THREE.Points;
    (sg.material as THREE.PointsMaterial).opacity = step === 3 ? 0.95 : 0.15;
    setParticles(sg, (i, v) => {
      const p = ((t * 0.4 + i * 0.055) % 1);
      v.set(0.2, 3 - p * 7, Math.sin(i) * 0.5);
    });
    (s.droplet as THREE.Mesh).position.y = step >= 3 ? 6.4 + Math.sin(t * 3) * 0.3 : 6.4;
  },
  cam: (s, t, step, camera) => {
    void s;
    const r = step === 0 ? 11 : 9;
    ORBIT(camera, 0, 1.5, 0, r, 2.5, t * 0.6);
  },
};

// ─────────── Demo 3: Day, Night & Seasons ───────────
export const earthMotion: DemoDef = {
  id: 'earth_motion',
  title: 'Day, Night & Seasons',
  icon: '🌍',
  bg: 0x05060f,
  steps: [
    { dur: 8, text: 'The Earth is a big ball that makes no light of its own; the Sun can only light up half of it — the half facing the Sun is daytime.' },
    { dur: 8, text: 'The Earth spins around its axis in about 24 hours, and that gives us one day and one night.' },
    { dur: 8, text: 'The Earth spins while also orbiting the Sun tilted, and one loop is a year.' },
    { dur: 9, text: 'Because the axis is tilted, through the year the Sun\'s angle over the same place changes, and that gives us spring, summer, autumn, winter.' },
    { dur: 8, text: 'Remember: day and night come from spinning; the seasons come from a TILTED orbit. The seasons are NOT because Earth is near or far from the Sun.' },
  ],
  build: () => {
    const root = new THREE.Group();
    const sun = vsphere(0xffd45a, 1.8);
    sun.add(new THREE.PointLight(0xffe8a0, 2.4, 60));
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(9.6, 9.75, 64),
      new THREE.MeshBasicMaterial({ color: 0x5a7fbf, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }),
    );
    ring.rotation.x = Math.PI / 2;
    const earthPivot = new THREE.Group();
    const earthHolder = new THREE.Group();
    earthHolder.position.x = 9;
    const earth = new THREE.Group();
    earth.rotation.z = 0.41; // tilted axis
    const globe = vsphere(0x4a8fdf, 1.1, 24);
    const land = vbox(0x5faf5f, 0.55, 0.5, 0.55);
    land.position.set(0.6, 0.35, 0.6);
    const litCap = new THREE.Mesh(new THREE.SphereGeometry(1.13, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf4faff));
    const darkCap = new THREE.Mesh(new THREE.SphereGeometry(1.15, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x0e1424));
    const axis = new THREE.Mesh(new THREE.BoxGeometry(0.07, 4.4, 0.07), mat(0xd8d8e0));
    earth.add(globe, land, litCap, darkCap, axis);
    earthHolder.add(earth);
    earthPivot.add(earthHolder);
    // season markers at four positions
    const seasons = new THREE.Group();
    ['Spring', 'Summer', 'Autumn', 'Winter'].forEach((nm, i) => {
      const a = (i / 4) * Math.PI * 2;
      const sp = label(nm, i % 2 === 0 ? '#c8f0c8' : '#ffe0b0', 26);
      sp.position.set(Math.cos(a) * 9.6, -0.2, Math.sin(a) * 9.6);
      seasons.add(sp);
    });
    root.add(sun, ring, earthPivot, seasons);
    root.add(label('Sun', '#ffe08a', 26).translateY(2.6));
    return { root, sun, earth, earthPivot, earthHolder, seasons, litCap, darkCap };
  },
  tick: (s, t, step) => {
    const earth = s.earth as THREE.Group;
    const pivot = s.earthPivot as THREE.Group;
    const root = s.root as THREE.Group;
    earth.rotation.y = t * (step >= 1 ? 1.5 : 0.12);
    pivot.rotation.y = step >= 2 ? t * 0.3 : -0.6;
    (s.seasons as THREE.Group).visible = step >= 3;
    root.updateMatrixWorld(true);
    const earthPos = new THREE.Vector3();
    earth.getWorldPosition(earthPos);
    const toSun = new THREE.Vector3().sub(earthPos).setY(0).normalize();
    orientTo(s.litCap as THREE.Mesh, earth, toSun, new THREE.Vector3(0, 1, 0));
    orientTo(s.darkCap as THREE.Mesh, earth, toSun.clone().negate(), new THREE.Vector3(0, 1, 0));
  },
  cam: (s, t, step, camera) => {
    void s;
    if (step >= 3) {
      camera.position.set(12, 7, 14);
      camera.lookAt(0, 0, 0);
    } else {
      ORBIT(camera, 0, 2, 0, 16 - step * 1.5, 7, t * 0.4);
    }
  },
};

// ─────────── Demo 4: Moon Phases ───────────
export const moonPhase: DemoDef = {
  id: 'moon_phase',
  title: 'The Moon Changes Its Face',
  icon: '🌙',
  bg: 0x060814,
  steps: [
    { dur: 7, text: 'The Moon makes no light of its own; it only bounces back the sunlight that falls on it.' },
    { dur: 7, text: 'Half of the Moon is always lit by the Sun, but which lit part we see depends on where the Moon has travelled to.' },
    { dur: 8, text: 'When the Moon sits between Earth and Sun, its lit side faces away from us and we barely see it — that is the new moon (start of the lunar month).' },
    { dur: 8, text: 'Halfway along its path we see half lit — the first quarter moon; when it swings behind Earth, the whole disc shines — the full moon (day 15).' },
    { dur: 7, text: 'From new moon back to new moon takes about 29 and a half days — that is one lunar month. So every month the Moon goes through its round of phases.' },
  ],
  build: () => {
    const root = new THREE.Group();
    const sun = vsphere(0xffd45a, 1.4);
    sun.position.set(-14, 0, 0);
    const sunLight = new THREE.PointLight(0xffeaa0, 2.6, 80);
    sun.add(sunLight);
    const earthPivot = new THREE.Group();
    const earth = vsphere(0x3f7fcf, 1.2, 20);
    earth.position.set(0, 0, 8);
    earthPivot.add(earth);
    const moonPivot = new THREE.Group();
    moonPivot.position.copy(earth.position);
    const moonHolder = new THREE.Group();
    moonHolder.position.set(4.4, 0, 0);
    const moonDark = vsphere(0x2a2c36, 0.55, 20);
    const moonLit = new THREE.Mesh(
      new THREE.SphereGeometry(0.57, 20, 20, 0, Math.PI * 2, 0, Math.PI / 2),
      mat(0xf5f0e0),
    );
    moonHolder.add(moonDark, moonLit);
    moonPivot.add(moonHolder);
    // side view: the phase we see
    const viewBoard = new THREE.Group();
    const phases = ['●', '◐', '○', '◑'] as const;
    viewBoard.add(label('Full Moon · Day 15', '#ffe8b0', 26).translateY(3.4));
    phases.forEach((p, i) => {
      const sp = label(p, '#f5f0e0', 40);
      sp.position.set((i - 1.5) * 2.6, 1.2, 12);
      sp.userData.phase = i;
      viewBoard.add(sp);
    });
    root.add(sun, earthPivot, moonPivot, viewBoard);
    root.add(label('Earth', '#9fd0ff', 24).translateZ(8).translateY(-1.9));
    return { root, moonPivot, moonLit, moonHolder, viewBoard, sun };
  },
  tick: (s, t, step) => {
    const phase = step >= 2 ? t * 0.8 : Math.PI; // start at new moon (Moon between Earth and Sun)
    (s.moonPivot as THREE.Group).rotation.y = phase;
    const root = s.root as THREE.Group;
    root.updateMatrixWorld(true);
    // lit hemisphere always faces the Sun (Sun is along -X)
    orientTo(s.moonLit as THREE.Mesh, s.moonHolder as THREE.Group, new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0));
    const vb = s.viewBoard as THREE.Group;
    vb.visible = step >= 3;
    vb.position.set(0, 0, 0);
  },
  cam: (s, t, step, camera) => {
    void s;
    const r = step >= 3 ? 20 : 15;
    camera.position.set(Math.cos(t * 0.3) * r, 11, Math.sin(t * 0.3) * r + 6);
    camera.lookAt(0, 0, 5);
  },
};

// ─────────── Demo 5: Solar System ───────────
export const solarSystem: DemoDef = {
  id: 'solar_system',
  title: 'A Tour of the Solar System',
  icon: '🪐',
  bg: 0x03040a,
  steps: [
    { dur: 7, text: 'The Sun is a star. It makes its own light and heat, and its mass is over 99% of the whole solar system.' },
    { dur: 9, text: 'Eight planets, from nearest to farthest: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune.' },
    { dur: 8, text: 'The farther out, the slower it goes: Mercury circles in just 88 days, but Neptune needs 165 years.' },
    { dur: 8, text: 'Planets do not shine by themselves; what we see is sunlight reflected off them, so they look like slow-moving dots.' },
    { dur: 7, text: 'A quick rhyme to remember them: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune.' },
  ],
  build: () => {
    const root = new THREE.Group();
    const sun = vsphere(0xffd45a, 2.2, 24);
    sun.add(new THREE.PointLight(0xffe8a0, 2.6, 120));
    root.add(sun);
    const planets: [string, number, number, number, number][] = [
      ['Mercury', 0.35, 4, 0x9a8f8f, 4.1],
      ['Venus', 0.5, 5.5, 0xd8b06a, 1.6],
      ['Earth', 0.55, 7.2, 0x4a8fdf, 1.0],
      ['Mars', 0.45, 9, 0xc4623f, 0.53],
      ['Jupiter', 1.25, 12.5, 0xd8a878, 0.28],
      ['Saturn', 1.05, 15.5, 0xe0cf9a, 0.2],
      ['Uranus', 0.75, 18, 0x8fd8e8, 0.14],
      ['Neptune', 0.72, 20.5, 0x4a6fd0, 0.11],
    ];
    const holders: Record<string, THREE.Object3D> = { root, sun };
    planets.forEach(([name, r, dist, color, speed], i) => {
      const ringMesh = new THREE.Mesh(
        new THREE.RingGeometry(dist - 0.02, dist + 0.02, 72),
        new THREE.MeshBasicMaterial({ color: 0x445f8f, side: THREE.DoubleSide, transparent: true, opacity: 0.35 }),
      );
      ringMesh.rotation.x = Math.PI / 2;
      root.add(ringMesh);
      const pivot = new THREE.Group();
      const body = vsphere(color, r, 18);
      body.position.x = dist;
      pivot.add(body);
      root.add(pivot);
      if (name === 'Saturn') {
        const ring2 = new THREE.Mesh(
          new THREE.RingGeometry(r * 1.6, r * 2.3, 40),
          new THREE.MeshBasicMaterial({ color: 0xe8dcb8, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }),
        );
        ring2.rotation.x = Math.PI / 2.2;
        body.add(ring2);
      }
      const lb = label(name, '#cfe8ff', 22);
      body.add(lb);
      holders[`p${i}`] = pivot;
      holders[`b${i}`] = body;
      (body.userData as { speed?: number }).speed = speed;
    });
    return holders;
  },
  tick: (s, t) => {
    for (let i = 0; i < 8; i++) {
      const p = s[`p${i}`] as THREE.Group | undefined;
      const b = s[`b${i}`] as THREE.Mesh | undefined;
      if (!p || !b) continue;
      p.rotation.y = t * ((b.userData as { speed: number }).speed ?? 1) * 0.9;
      const sp = b.children.find((c) => (c as THREE.Sprite).isSprite) as THREE.Sprite | undefined;
      if (sp) {
        sp.position.set(0, 0.9 + (b.geometry as THREE.SphereGeometry).parameters.radius, 0);
        sp.center.set(0.5, 0);
      }
    }
  },
  cam: (s, t, step, camera) => {
    void s;
    const r = step >= 2 ? 30 : 20;
    camera.position.set(Math.cos(t * 0.2) * r, 16, Math.sin(t * 0.2) * r);
    camera.lookAt(0, 0, 0);
  },
};

// ─────────── Demo 6: Electric Circuit ───────────
const circuitSteps = [-1, -1, 1, 0, 2]; // -1 open circuit / 1 closed / 0 open / 2 short
export const circuitDemo: DemoDef = {
  id: 'circuit',
  title: 'Lighting Up a Bulb',
  icon: '💡',
  bg: 0x141720,
  steps: [
    { dur: 7, text: 'To light a bulb you need four partners: a battery, wires, a switch, and the bulb itself.' },
    { dur: 8, text: 'The battery gives the "push" that makes electricity run along the wires. Current leaves the battery from its positive end.' },
    { dur: 7, text: 'When the switch closes, the whole loop connects — that is a closed circuit, and the bulb lights at once.' },
    { dur: 7, text: 'Flip the switch open and a gap stops the current — that is an open circuit, and the bulb goes dark.' },
    { dur: 8, text: 'If you join the two battery ends directly with a wire, current takes a "shortcut" past the bulb — that is a short circuit, and it is very dangerous!' },
  ],
  build: () => {
    const root = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(16, 0.6, 10), mat(0x2a3140));
    board.position.y = -2;
    // battery
    const battery = new THREE.Group();
    const bBody = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.2), mat(0x3a4a6a));
    const bPos = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat(0xd84a4a));
    bPos.position.set(0, 0.7, 0);
    const bNeg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat(0x4a4a4a));
    bNeg.position.set(0, -0.7, 0);
    battery.add(bBody, bPos, bNeg);
    battery.position.set(-6, -1, 3);
    // bulb
    const bulbGroup = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), mat(0x8a8a8a));
    const glassBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 18, 18),
      new THREE.MeshLambertMaterial({ color: 0x555a66, transparent: true, opacity: 0.55, emissive: 0x000000 }),
    );
    glassBall.position.y = 0.8;
    const filament = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), mat(0xff9a3a));
    filament.position.y = 0.7;
    const glow = new THREE.PointLight(0xffd489, 0, 22);
    glow.position.y = 1;
    bulbGroup.add(base, glassBall, filament, glow);
    bulbGroup.position.set(6, -1, 3);
    // switch
    const switchGroup = new THREE.Group();
    const sBase = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 1.2), mat(0x6a5230));
    const lever = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.22, 0.4), mat(0xc9a04a));
    lever.position.y = 0.4;
    const contact = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.6), mat(0xd8b84a));
    contact.position.set(1.1, 0.1, 0);
    switchGroup.add(sBase, lever, contact);
    switchGroup.position.set(0, -1, 3);
    // wires
    const wireMat = mat(0x8a4a3a);
    const wires = new THREE.Group();
    const w1 = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.25, 0.25), wireMat);
    w1.position.set(-3.6, -1.4, 3);
    const w2 = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.25, 0.25), wireMat);
    w2.position.set(3.6, -1.4, 3);
    const w3 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 5.2), wireMat);
    w3.position.set(-6, -1.4, 0.4);
    const w4 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 5.2), wireMat);
    w4.position.set(6, -1.4, 0.4);
    const w5 = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.25, 0.25), wireMat);
    w5.position.set(0, -1.4, -2.2);
    wires.add(w1, w2, w3, w4, w5);
    // current particles
    const flow = particles(70, 0xffe066, 0.26);
    root.add(board, battery, bulbGroup, switchGroup, wires, flow);
    root.add(label('Battery', '#ff9a9a', 22).translateY(-2.4).translateX(-6));
    root.add(label('Switch', '#ffd08a', 22).translateY(-2.4));
    root.add(label('Bulb', '#ffe08a', 22).translateY(-2.4).translateX(6));
    return { root, battery, bulbGroup, switchGroup, lever, flow, glassBall, glow, filament, contact };
  },
  tick: (s, t, step) => {
    const mode = circuitSteps[step] ?? -1; // 1 closed / 0 open / 2 short
    const sw = s.switchGroup as THREE.Group;
    const lever = s.lever as THREE.Mesh;
    lever.rotation.z = mode === 1 || mode === 2 ? 0 : -0.55;
    sw.position.x = 0;
    const shorted = mode === 2;
    const glow = s.glow as THREE.PointLight;
    const glass = s.glassBall as THREE.Mesh;
    const fil = s.filament as THREE.Mesh;
    const on = mode === 1;
    glow.intensity += (on ? 3.2 : 0) * 0.2;
    glow.intensity = THREE.MathUtils.lerp(glow.intensity, on ? 3.2 : 0, 0.15);
    const gmat = glass.material as THREE.MeshLambertMaterial;
    gmat.emissive.setHex(on ? 0x664e14 : 0x000000);
    gmat.color.setHex(on ? 0xffe9b0 : 0x555a66);
    (fil.material as THREE.MeshLambertMaterial).color.setHex(on ? 0xffd45a : 0x8a6a4a);
    const flow = s.flow as THREE.Points;
    const pn = flow.material as THREE.PointsMaterial;
    pn.opacity = THREE.MathUtils.lerp(pn.opacity, mode >= 0 && !shorted ? 0.95 : 0.12, 0.12);
    pn.color.setHex(shorted ? 0xff4a4a : 0xffe066);
    // walk one loop around the rectangle
    const path: THREE.Vector3[] = [];
    const push = (x: number, y: number, z: number) => path.push(new THREE.Vector3(x, y, z));
    // from battery positive -> switch -> bulb -> back to battery negative
    for (let i = 0; i <= 20; i++) push(-6 + (i / 20) * 6, -1.4, 3);
    for (let i = 0; i <= 20; i++) push(0 + (i / 20) * 6, -1.4, 3);
    for (let i = 0; i <= 20; i++) push(6, -1.4, 3 - (i / 20) * 5.2);
    for (let i = 0; i <= 40; i++) push(6 - (i / 40) * 12, -1.4, -2.2);
    for (let i = 0; i <= 20; i++) push(-6, -1.4, -2.2 + (i / 20) * 5.2);
    setParticles(flow, (i, v) => {
      const p = ((t * 0.25 + i / 70) % 1) * (path.length - 1);
      const idx = Math.floor(p);
      const nxt = Math.min(path.length - 1, idx + 1);
      v.copy(path[idx]).lerp(path[nxt], p - idx);
    });
    void sw;
  },
  cam: (s, t, step, camera) => {
    void s;
    if (step === 4) {
      camera.position.set(0, 6, 12);
      camera.lookAt(0, 0, 0);
    } else {
      camera.position.set(Math.sin(t * 0.25) * 12, 7, Math.cos(t * 0.25) * 12 + 3);
      camera.lookAt(0, -0.5, 1);
    }
  },
};

// ─────────── Demo 7: Rainbow ───────────
export const rainbowDemo: DemoDef = {
  id: 'rainbow',
  title: 'Seven Colors in Sunlight',
  icon: '🌈',
  bg: 0x101828,
  steps: [
    { dur: 7, text: 'Sunlight looks plain white, but it secretly mixes seven colors.' },
    { dur: 8, text: 'When light slants from air into a water drop it bends — that is refraction.' },
    { dur: 8, text: 'The seven colors bend by different amounts, so they split apart into a colored band.' },
    { dur: 7, text: 'The drop bounces the light back and bends it out again, and we see them clearly: red, orange, yellow, green, blue, indigo, violet.' },
    { dur: 7, text: 'So a rainbow always appears opposite the Sun. Turn your back to the Sun and look at the sky after rain for the best chance.' },
  ],
  build: () => {
    const root = new THREE.Group();
    const whiteIn = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 0.3), mat(0xffffff, { emissive: 0x333333 }));
    whiteIn.position.set(-6, 3, 0);
    const drop = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 24, 24),
      new THREE.MeshLambertMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.35 }),
    );
    const colors = [0xff4a4a, 0xff9a3a, 0xffe04a, 0x5fdf5f, 0x4a9fff, 0x4a4fd0, 0xa94ad0];
    const beams = new THREE.Group();
    colors.forEach((c, i) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(12, 0.16, 0.16), mat(c, { emissive: c, transparent: true, opacity: 0 }));
      b.position.set(3, 2 - i * 0.34, 0);
      beams.add(b);
    });
    const arc = new THREE.Group();
    colors.forEach((c, i) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(6 - i * 0.55, 0.12, 8, 60, Math.PI),
        mat(c, { emissive: c, transparent: true, opacity: 0 }),
      );
      ring.position.z = -2;
      arc.add(ring);
    });
    root.add(whiteIn, drop, beams, arc);
    const names = label('Red Orange Yellow Green Blue Indigo Violet', '#ffffff', 28);
    names.position.set(0, -4.5, 0);
    root.add(names);
    return { root, beams, arc, drop, whiteIn };
  },
  tick: (s, t, step) => {
    const beams = s.beams as THREE.Group;
    beams.children.forEach((b, i) => {
      const m = (b as THREE.Mesh).material as THREE.MeshLambertMaterial;
      const target = step >= 2 ? 0.95 : step === 1 ? 0.25 : 0.05;
      m.opacity += (target - m.opacity) * 0.06;
      b.position.y = 2 - i * 0.34 + Math.sin(t * 2 + i) * 0.04;
      (b as THREE.Mesh).rotation.z = step >= 2 ? -0.12 : 0;
    });
    const arc = s.arc as THREE.Group;
    arc.children.forEach((r, i) => {
      const m = (r as THREE.Mesh).material as THREE.MeshLambertMaterial;
      const target = step >= 3 ? 0.95 : 0;
      m.opacity += (target - m.opacity) * 0.05;
      r.rotation.z = Math.sin(t * 0.5) * 0.03;
      r.position.x = i * 0.02;
    });
    (s.whiteIn as THREE.Mesh).scale.x = 1 + Math.sin(t * 3) * 0.02;
    (s.drop as THREE.Mesh).rotation.y = t * 0.3;
  },
  cam: (s, t, step, camera) => {
    void s;
    if (step >= 3) {
      camera.position.set(0, 3, 20);
      camera.lookAt(0, 0, -2);
    } else {
      camera.position.set(Math.sin(t * 0.3) * 14, 5, 14);
      camera.lookAt(0, 1, 0);
    }
  },
};

// ─────────── Demo 8: Lever ───────────
export const leverDemo: DemoDef = {
  id: 'lever',
  title: 'Give Me a Lever',
  icon: '🔧',
  bg: 0x1c1a16,
  steps: [
    { dur: 7, text: 'A rigid bar that turns around a point is the simplest machine — a lever.' },
    { dur: 7, text: 'The fixed point is the fulcrum; where you push is the effort point, and the weight it lifts is the load.' },
    { dur: 8, text: 'Move the fulcrum nearer the load and your side gets longer, so the lifting gets easier.' },
    { dur: 8, text: 'Put the fulcrum near your side and it costs more force but saves distance — that is how chopsticks work.' },
    { dur: 7, text: 'Remember: easier lifting costs more distance. One of force or distance must always be paid.' },
  ],
  build: () => {
    const root = new THREE.Group();
    const ground = new THREE.Mesh(new THREE.BoxGeometry(24, 1, 12), mat(0x6a5230));
    ground.position.y = -3;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 0.7), mat(0x9a6b3f));
    bar.position.y = 0;
    const barPivot = new THREE.Group();
    barPivot.position.set(0, -1, 0);
    barPivot.add(bar);
    const fulcrum = new THREE.Mesh(new THREE.BoxGeometry(1, 2.4, 1), mat(0x4a5a6a));
    fulcrum.position.set(-4, -2.2, 0);
    const rock = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), mat(0x7a7a7a));
    rock.position.set(-6.4, -1.6, 0);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), mat(0xe8b08a));
    hand.position.set(6.4, 0.6, 0);
    root.add(ground, barPivot, fulcrum, rock, hand);
    root.add(label('Fulcrum', '#9fd8ff', 22).translateX(-4).translateY(-4.2));
    root.add(label('Load', '#ff9a9a', 22).translateX(-6.4).translateY(-0.2));
    root.add(label('Effort', '#afffaf', 22).translateX(6.4).translateY(2));
    return { root, barPivot, bar, fulcrum, rock, hand, ground };
  },
  tick: (s, t, step) => {
    const pivot = s.barPivot as THREE.Group;
    const fulcrum = s.fulcrum as THREE.Mesh;
    const near = step <= 2 ? -4 : step === 3 ? -4 : -1;
    fulcrum.position.x += (near - fulcrum.position.x) * 0.05;
    const rock = s.rock as THREE.Mesh;
    const hand = s.hand as THREE.Mesh;
    const rockBase = -1.6;
    const lift = step >= 1 ? Math.max(0, Math.sin(t * 1.2) * 0.5 + 0.5) * 1.6 : 0;
    rock.position.y = rockBase + lift;
    pivot.rotation.z = -lift * 0.06;
    rock.rotation.z = lift * 0.15;
    hand.position.y = 0.6 - lift * 0.9;
    hand.position.x += (7 - hand.position.x) * 0.05;
  },
  cam: (s, t, step, camera) => {
    void s;
    const r = step >= 3 ? 18 : 15;
    camera.position.set(Math.cos(t * 0.22) * 6, 6, Math.sin(t * 0.22) * r * 0.6 + r * 0.6);
    camera.lookAt(-1, 0, 0);
  },
};
let leverDemoRef: Record<string, THREE.Object3D> | null = null;

// ─────────── Demo 9: Rock Strata ───────────
export const strataDemo: DemoDef = {
  id: 'strata',
  title: 'The Timetable in Stone',
  icon: '🪨',
  bg: 0x181410,
  steps: [
    { dur: 7, text: 'Sand, mud and pebbles are washed by water into low places and spread out — that is sedimentation.' },
    { dur: 8, text: 'New layers pile on old ones. Over time, the lower layers are older and the upper ones newer.' },
    { dur: 8, text: 'Pressed tight they turn to rock, stacked like a thick book — scientists call it strata.' },
    { dur: 8, text: 'If a layer holds shells or leaf fossils, it tells us this place was once a seabed or a forest.' },
    { dur: 7, text: 'So by reading the order of layers, we can tell what happened here over billions of years.' },
  ],
  build: () => {
    const root = new THREE.Group();
    const layers: THREE.Mesh[] = [];
    const colors = [0x8a5a3a, 0xc9a86a, 0x8f8f6a, 0x6a7a5a, 0x7a8a9a, 0x9a8a7a];
    for (let i = 0; i < 6; i++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(18, 1.1, 10), mat(colors[i]));
      l.position.set(0, -4 + i * 1.1, 0);
      l.scale.y = 0;
      layers.push(l);
      root.add(l);
    }
    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.9), mat(0xe8d8c0));
    shell.position.set(-3, -3.4, 2);
    shell.visible = false;
    const water = new THREE.Mesh(new THREE.BoxGeometry(20, 0.4, 12), mat(0x3f7fd0, { transparent: true, opacity: 0.5 }));
    water.position.y = 3.5;
    const fall = particles(80, 0xc9a86a, 0.18);
    root.add(shell, water, fall);
    const tip = label('Lower layers are older', '#e8d8b0', 26);
    tip.position.set(8, -4, 0);
    tip.visible = false;
    root.add(tip);
    return { root, layers: root, water, shell, fall, tip, layerList: { children: layers } as unknown as THREE.Object3D };
  },
  tick: (s, t, step) => {
    const group = s.layerList as unknown as { children: THREE.Mesh[] };
    group.children.forEach((l, i) => {
      const target = step >= 1 ? 1 : step === 0 ? Math.max(0, Math.min(1, (t - i * 0.6) * 1.5)) : 1;
      l.scale.y += (target - l.scale.y) * 0.08;
    });
    const fall = s.fall as THREE.Points;
    (fall.material as THREE.PointsMaterial).opacity = step <= 1 ? 0.9 : 0.2;
    setParticles(fall, (i, v) => {
      const p = ((t * 0.8 + i * 0.037) % 1);
      v.set(-8 + ((i * 61) % 100) / 100 * 16, 3.4 - p * 8, -4 + ((i * 43) % 100) / 100 * 8);
    });
    const shell = s.shell as THREE.Mesh;
    shell.visible = step >= 3;
    shell.position.y = -3.4 + (step >= 3 ? Math.sin(t * 2) * 0.1 : 0);
    (s.tip as THREE.Sprite).visible = step >= 2;
  },
  cam: (s, t, step, camera) => {
    void s;
    const y = step >= 2 ? 3 : 2;
    camera.position.set(Math.cos(t * 0.25) * 16, y + 4, Math.sin(t * 0.25) * 16);
    camera.lookAt(0, -1, 0);
  },
};

// ───────── Opening story: BlockAcademy ─────────
export const introDemo: DemoDef = {
  id: 'intro',
  title: 'The Story of BlockAcademy',
  icon: '📖',
  bg: 0x14203a,
  steps: [
    { dur: 7, text: 'Out where the world ends, in a sea of clouds, stands an academy built of blocks.' },
    { dur: 7, text: 'No teachers live here — instead a band of curious residents who walk, chat, and sometimes forget things.' },
    { dur: 8, text: 'Nobody writes their lines. Ask them anything and they think and answer in their own way, right then and there.' },
    { dur: 8, text: 'Forest, river valley, crystal cave, starry sky, laboratory… each place hides a whole world of knowledge.' },
    { dur: 7, text: 'Set out with your questions. The answers matter less than learning how to think them through.' },
  ],
  build: () => {
    const root = new THREE.Group();
    const ground = new THREE.Mesh(new THREE.BoxGeometry(30, 1.2, 30), mat(0x5f9e4f));
    ground.position.y = -1.2;
    root.add(ground);
    const colors = [0xd8b48a, 0xe8c4a8, 0xd6a06a, 0xc99a70, 0xe86a8a];
    const shirts = [0x6b8f5a, 0x3a3a8a, 0x4f7a3a, 0xb8bcc4, 0x3f7fb0];
    const people = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group();
      const body = vbox(shirts[i], 0.55, 0.7, 0.35);
      body.position.y = 0.95;
      const head = vbox(colors[i], 0.5, 0.5, 0.5);
      head.position.y = 1.55;
      g.add(body, head);
      g.position.set(-6 + i * 3.2, 0, 2 + (i % 2) * 1.5);
      g.userData.base = g.position.y;
      people.add(g);
    }
    root.add(people);
    // little huts
    const hut = vbox(0xc09a63, 4, 3, 4);
    hut.position.set(-8, 1.5, -5);
    const roof = vbox(0x9d4b3c, 4.6, 0.6, 4.6);
    roof.position.set(-8, 3.3, -5);
    const hut2 = vbox(0x6f6f6f, 3.4, 2.6, 3.4);
    hut2.position.set(9, 1.3, -4);
    root.add(hut, roof, hut2);
    // trees
    for (let i = 0; i < 6; i++) {
      const tx = -12 + i * 4.6;
      const tz = -9 - (i % 2) * 3;
      const trunk = vbox(0x9a6b3f, 0.5, 2.4, 0.5);
      trunk.position.set(tx, 1.2, tz);
      const leaf = vbox(0x4f9d3a, 2.6, 1.8, 2.6);
      leaf.position.set(tx, 3.2, tz);
      root.add(trunk, leaf);
    }
    // stars
    const stars = particles(160, 0xfff6c9, 0.14);
    root.add(stars);
    const title = label('BlockAcademy', '#ffe08a', 46);
    title.position.set(0, 6.5, -2);
    root.add(title);
    return { root, people, stars };
  },
  tick: (s, t, step) => {
    const people = s.people as THREE.Group;
    people.children.forEach((p, i) => {
      p.position.y = Math.abs(Math.sin(t * 2.4 + i)) * 0.22;
      p.rotation.y = Math.sin(t * 0.7 + i) * 0.5;
    });
    setParticles(s.stars as THREE.Points, (i, v) => {
      const r = 18 + ((i * 17) % 60) / 10;
      const a = i * 0.31 + t * 0.02;
      v.set(Math.cos(a) * r, 8 + ((i * 13) % 100) / 8, Math.sin(a) * r);
    });
    (s.stars as THREE.Points).visible = step >= 4 || step <= 1;
  },
  cam: (s, t, step, camera) => {
    void s;
    const p = step / 4;
    const r = 26 - p * 16;
    const h = 14 - p * 9;
    camera.position.set(Math.cos(t * 0.18) * r, h, Math.sin(t * 0.18) * r + 4);
    camera.lookAt(0, 1.5, 0);
  },
};

export const DEMOS: DemoDef[] = [
  introDemo,
  waterCycle,
  photosynthesis,
  earthMotion,
  moonPhase,
  solarSystem,
  circuitDemo,
  rainbowDemo,
  leverDemo,
  strataDemo,
];

export const DEMO_BY_ID = new Map(DEMOS.map((d) => [d.id, d]));
