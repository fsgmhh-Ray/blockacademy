/**
 * 教育场景定义：每个场景是一片独立生成的 128×128 体素地图，
 * 含专属 NPC、3D 演示台、传送座与任务主题。
 */
import type { World } from '../core/world';
import { blocks } from './blockIds';
import { box, carveCaves, column, groundAt, house, paintTerrain, platform, rimShape, scatter, tree, vein, heightField } from './worldBuilders';
import { mulberry32, ValueNoise2D } from '../core/noise';

export interface Pad {
  x: number;
  z: number;
  label: string;
  demo?: string;
  goto?: string;
  /** 显式站立高度：洞窟等有顶的场景必须指定，否则会被算到天花板顶上 */
  y?: number;
}

export interface SceneNpc {
  p: string;
  x: number;
  z: number;
  roam?: number;
  y?: number;
}

export interface SceneDef {
  id: string;
  name: string;
  icon: string;
  subtitle: string;
  brief: string;
  topics: string[];
  sky: number;
  fogColor: number;
  fogDensity: number;
  ambient: number;
  sun: number;
  stars: boolean;
  night: boolean;
  spawn: [number, number];
  /** 指定时优先于自动测地，用于有顶/多层的场景 */
  groundY?: number;
  build: (w: World) => void;
  npcs: SceneNpc[];
  pads: Pad[];
}

const GRID_PAD = 34;

function gardens(w: World, center = 64, size = 18): void {
  for (let x = center - size; x <= center + size; x++)
    for (let z = center - size; z <= center + size; z++) {
      const g = groundAt(w, x, z);
      w.putFast(x, g - 1, z, blocks.farmland);
      if ((x * z) % 3 === 0) w.putFast(x, g, z, blocks.wheat);
    }
}

function pathLine(w: World, x0: number, z0: number, x1: number, z1: number, id: number): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(x0 + (x1 - x0) * t);
    const z = Math.round(z0 + (z1 - z0) * t);
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        const px = x + dx;
        const pz = z + dz;
        const g = groundAt(w, px, pz);
        if (g > 1) w.putFast(px, g - 1, pz, id);
      }
  }
}

/** 圆形小球（做星球模型） */
function ball(w: World, cx: number, cy: number, cz: number, r: number, id: number): void {
  for (let x = -r; x <= r; x++)
    for (let y = -r; y <= r; y++)
      for (let z = -r; z <= r; z++) {
        const d = Math.round(Math.hypot(x, y, z));
        if (d <= r) w.putFast(cx + x, cy + y, cz + z, id);
      }
}

export const SCENES: SceneDef[] = [
  // ───────────────── 1. 村庄广场 ─────────────────
  {
    id: 'village',
    name: 'Dawnlight Village',
    icon: '🏘️',
    subtitle: 'Where Life Begins',
    brief: 'The gateway to BlockAcademy. Meet two old friends here, and learn how plants grow and why the weather changes.',
    topics: ['plant_parts', 'photosynthesis', 'seed_germination', 'weather', 'earth_revolution'],
    sky: 0x9fd8ff,
    fogColor: 0xcfe8ff,
    fogDensity: 0.006,
    ambient: 0.75,
    sun: 0.9,
    stars: false,
    night: false,
    spawn: [64, 64],
    npcs: [
      { p: 'stone_pine', x: 64, z: 58, roam: 4 },
      { p: 'ling', x: 70, z: 68, roam: 8 },
    ],
    pads: [
      { x: 64, z: 74, label: '🌱 Watch leaves make food', demo: 'photosynthesis' },
      { x: 40, z: 64, label: '🗺️ To: Lively Forest', goto: 'forest' },
      { x: 88, z: 64, label: '🗺️ To: Wandering River', goto: 'river' },
      { x: 64, z: 40, label: '🗺️ To: Crystal Caverns', goto: 'cave' },
    ],
    build: (w) => {
      const field = heightField(w.sx, { base: 15, amp: 3.2, scale: 0.028, seed: 3, shape: rimShape });
      paintTerrain(w, field, { water: 9 });
      // 中央广场
      for (let x = 52; x <= 78; x++)
        for (let z = 52; z <= 78; z++) {
          const g = groundAt(w, x, z);
          w.putFast(x, g - 1, z, (x + z) % 6 < 3 ? blocks.stoneBrick : blocks.quartz);
          for (let y = g; y < g + 6; y++) w.putFast(x, y, z, 0);
        }
      // 喷泉
      box(w, 63, 15, 63, 67, 16, 67, blocks.cobble);
      for (let x = 63; x <= 67; x++) for (let z = 63; z <= 67; z++) w.putFast(x, 16, z, blocks.water);
      column(w, 65, 65, 17, 20, blocks.quartz);
      w.putFast(65, 21, 65, blocks.lamp);
      // 房子
      house(w, 44, 48, 9, 8, 4, blocks.plank, blocks.brick);
      house(w, 80, 46, 8, 9, 4, blocks.plank, blocks.woolRed);
      house(w, 46, 82, 8, 8, 4, blocks.plank, blocks.woolYellow);
      house(w, 82, 80, 9, 8, 5, blocks.stoneBrick, blocks.brick);
      // 农田
      gardens(w, 64, 12);
      // 小河
      const n = new ValueNoise2D(9);
      for (let z = 8; z < w.sz - 8; z++) {
        const cx = Math.round(24 + n.fbm(z * 0.05, 0, 3) * 8);
        for (let x = cx - 2; x <= cx + 2; x++) {
          const g = groundAt(w, x, z);
          for (let y = g - 2; y < g; y++) w.putFast(x, y, z, blocks.water);
          for (let y = g; y < g + 3; y++) w.putFast(x, y, z, 0);
        }
      }
      // 树林与花草
      scatter(w, 46, 21, (x, z) => {
        const g = groundAt(w, x, z);
        if (g < 12 || (Math.abs(x - 64) < 16 && Math.abs(z - 64) < 16)) return;
        tree(w, x, z, 4 + Math.floor(Math.random() * 3));
      });
      scatter(w, 90, 5, (x, z) => {
        const g = groundAt(w, x, z);
        if (g > 10) w.putFast(x, g, z, Math.random() < 0.5 ? blocks.flowerRed : blocks.flowerYellow);
      });
      pathLine(w, 64, 64, 64, 90, blocks.gravel);
      pathLine(w, 64, 64, 36, 64, blocks.gravel);
      pathLine(w, 64, 64, 92, 64, blocks.gravel);
      // 传送座
      for (const p of [{ x: 40, z: 64 }, { x: 88, z: 64 }, { x: 64, z: 40 }]) {
        const g = groundAt(w, p.x, p.z);
        platform(w, p.x, p.z, 2, g - 1, blocks.portal);
        column(w, p.x, p.z, g, g + 1, blocks.portal);
      }
      const gp = groundAt(w, 64, 74);
      platform(w, 64, 74, 2, gp - 1, blocks.woolGreen);
      w.putFast(64, gp, 74, blocks.board);
    },
  },

  // ───────────────── 2. 生机森林 ─────────────────
  {
    id: 'forest',
    name: 'Lively Forest',
    icon: '🌳',
    subtitle: 'Who Eats Whom',
    brief: 'A complete food chain hides in the thick woods. Find the ranger and the seed keeper, and see how many neighbors live around one tree.',
    topics: ['food_chain', 'ecosystem', 'adaptation', 'seed_germination', 'animal_class', 'plant_parts'],
    sky: 0x8fd0a8,
    fogColor: 0xbfe0c8,
    fogDensity: 0.012,
    ambient: 0.62,
    sun: 0.7,
    stars: false,
    night: false,
    spawn: [64, 96],
    npcs: [
      { p: 'lu_ming', x: 64, z: 88, roam: 6 },
      { p: 'xiao_man', x: 88, z: 72, roam: 3 },
    ],
    pads: [
      { x: 64, z: 76, label: '🍃 The leaf\'s secret factory', demo: 'photosynthesis' },
      { x: 40, z: 96, label: '🗺️ Back to Village', goto: 'village' },
      { x: 92, z: 96, label: '🗺️ To: Wandering River', goto: 'river' },
    ],
    build: (w) => {
      const field = heightField(w.sx, { base: 17, amp: 5, scale: 0.03, seed: 21, shape: rimShape });
      paintTerrain(w, field, { water: 11 });
      const en = new ValueNoise2D(41);
      for (let x = 1; x < w.sx - 1; x++)
        for (let z = 1; z < w.sz - 1; z++) {
          const g = groundAt(w, x, z);
          if (en.fbm(x * 0.06, z * 0.06, 3) > 0.05 && g > 12) w.putFast(x, g - 1, z, blocks.grass);
        }
      // 密集树林
      scatter(w, 150, 77, (x, z) => {
        const g = groundAt(w, x, z);
        if (g < 13) return;
        tree(w, x, z, 6 + Math.floor(Math.random() * 5));
      });
      // 林间池塘
      for (let x = 34; x <= 50; x++)
        for (let z = 40; z <= 56; z++) {
          if (Math.hypot(x - 42, z - 48) > 9) continue;
          const g = groundAt(w, x, z);
          for (let y = g - 4; y < g; y++) w.putFast(x, y, z, blocks.water);
        }
      // 树屋观测平台
      const treeX = 88;
      const treeZ = 72;
      for (let y = 15; y < 30; y++) w.putFast(treeX, y, treeZ, blocks.wood);
      for (let y = 24; y < 30; y++)
        for (let dx = -3; dx <= 3; dx++)
          for (let dz = -3; dz <= 3; dz++) if (Math.hypot(dx, dz) < 3.2) w.putFast(treeX + dx, y, treeZ + dz, blocks.leaves);
      platform(w, treeX, treeZ, 4, 24, blocks.plank);
      for (let dx = -4; dx <= 4; dx++)
        for (let dz = -4; dz <= 4; dz++) if (Math.abs(dx) === 4 || Math.abs(dz) === 4) w.putFast(treeX + dx, 25, treeZ + dz, blocks.plank);
      // 种子图书馆
      house(w, 92, 60, 9, 9, 5, blocks.plank, blocks.leaves);
      // 小径
      pathLine(w, 64, 96, 64, 60, blocks.gravel);
      pathLine(w, 64, 80, 88, 72, blocks.gravel);
      pathLine(w, 64, 84, 42, 60, blocks.gravel);
      scatter(w, 60, 13, (x, z) => {
        const g = groundAt(w, x, z);
        if (g > 12 && Math.random() < 0.5) w.putFast(x, g, z, Math.random() < 0.5 ? blocks.mushroom : blocks.flowerYellow);
      });
      // 演示台
      const gp = groundAt(w, 64, 76);
      platform(w, 64, 76, 2, gp - 1, blocks.woolGreen);
      const p1 = groundAt(w, 40, 96);
      platform(w, 40, 96, 2, p1 - 1, blocks.portal);
      const p2 = groundAt(w, 92, 96);
      platform(w, 92, 96, 2, p2 - 1, blocks.portal);
    },
  },

  // ───────────────── 3. 循环河谷 ─────────────────
  {
    id: 'river',
    name: 'Wandering River',
    icon: '💧',
    subtitle: "Water's Journey",
    brief: 'From the snowy mountain all the way to the sea, water never rests. Follow Granny Lan and Bubbles and walk a full loop of the water cycle.',
    topics: ['water_cycle', 'states_of_water', 'evaporation', 'condensation', 'dissolve', 'buoyancy', 'sink_float'],
    sky: 0x8fc8ff,
    fogColor: 0xd0e8ff,
    fogDensity: 0.009,
    ambient: 0.8,
    sun: 1.0,
    stars: false,
    night: false,
    spawn: [64, 100],
    npcs: [
      { p: 'lan_po', x: 60, z: 92, roam: 5 },
      { p: 'pao', x: 70, z: 84, roam: 7 },
    ],
    pads: [
      { x: 64, z: 70, label: '💧 Watch a full cycle', demo: 'water_cycle' },
      { x: 40, z: 100, label: '🗺️ Back to Village', goto: 'village' },
      { x: 88, z: 100, label: '🗺️ To: Crystal Caverns', goto: 'cave' },
    ],
    build: (w) => {
      const n = new ValueNoise2D(77);
      const field = heightField(w.sx, {
        base: 14,
        amp: 7,
        scale: 0.03,
        seed: 55,
        shape: (h, x, z, size) => {
          // 中间是河谷，两侧抬高
          const cx = 64 + n.fbm(z * 0.02, 3, 2) * 16;
          const d = Math.abs(x - cx);
          let nh = h;
          if (d < 12) nh = 12 - (12 - d) * 0.55;
          else nh = h + (d - 12) * 0.42;
          nh += rimShape(0, x, z, size);
          return Math.min(42, nh);
        },
      });
      paintTerrain(w, field, { top: blocks.sand, sub: blocks.sandstone, water: 13 });
      // 雪山源头
      for (let x = 40; x <= 88; x++)
        for (let z = 4; z <= 22; z++) {
          const g = groundAt(w, x, z);
          for (let y = g - 1; y > g - 8; y--) w.putFast(x, y, z, blocks.snow);
        }
      // 河道换水 + 清除上方遮挡
      for (let z = 4; z < w.sz - 6; z++) {
        const cx = Math.round(64 + n.fbm(z * 0.022, 3, 3) * 14);
        for (let x = cx - 4; x <= cx + 4; x++) {
          const g = groundAt(w, x, z);
          if (Math.hypot(x - cx) > 4) continue;
          for (let y = g - 3; y <= 12; y++) w.putFast(x, y, z, blocks.water);
          for (let y = 13; y < g + 5; y++) w.putFast(x, y, z, 0);
        }
      }
      // 木桥
      for (let x = 56; x <= 74; x++) {
        const g = Math.max(13, groundAt(w, x, 88) - 1);
        for (let z = 87; z <= 89; z++) {
          w.putFast(x, g, z, blocks.plank);
          for (let y = g + 1; y < g + 4; y++) w.putFast(x, y, z, 0);
        }
        if (x % 4 === 0) {
          w.putFast(x, g + 1, 87, blocks.plank);
          w.putFast(x, g + 1, 89, blocks.plank);
        }
      }
      // 码头 + 小船
      for (let x = 40; x <= 54; x++)
        for (let z = 70; z <= 76; z++) {
          const g = Math.max(13, groundAt(w, x, z));
          w.putFast(x, g, z, blocks.plank);
        }
      box(w, 44, 14, 72, 50, 15, 74, blocks.plank, true);
      // 河滩、芦苇
      scatter(w, 120, 91, (x, z) => {
        const g = groundAt(w, x, z);
        if (g > 12 && g < 17) w.putFast(x, g, z, blocks.wheat);
      });
      scatter(w, 40, 17, (x, z) => {
        const g = groundAt(w, x, z);
        if (g > 15) tree(w, x, z, 4);
      });
      const gp = groundAt(w, 64, 70);
      platform(w, 64, 70, 2, gp - 1, blocks.woolBlue);
      w.putFast(64, gp, 70, blocks.board);
      for (const p of [{ x: 40, z: 100 }, { x: 88, z: 100 }]) {
        const g = groundAt(w, p.x, p.z);
        platform(w, p.x, p.z, 2, g - 1, blocks.portal);
      }
    },
  },

  // ───────────────── 4. 晶脉矿洞 ─────────────────
  {
    id: 'cave',
    name: 'Crystal Caverns',
    icon: '💎',
    subtitle: 'Time Pressed into Stone',
    brief: 'Dig down through layer after layer of rock — every stone tells a story from long ago. Mind your step in the dark.',
    topics: ['rock_soil', 'fossil', 'materials', 'disaster', 'measurement', 'observation'],
    sky: 0x12121c,
    fogColor: 0x181826,
    fogDensity: 0.014,
    ambient: 0.5,
    sun: 0.35,
    stars: false,
    night: true,
    spawn: [64, 64],
    /** 洞窟内部地面统一在 y=6，顶部有封层，必须显式指定高度 */
    groundY: 6,
    npcs: [
      { p: 'pick', x: 58, z: 60, roam: 5, y: 6 },
      { p: 'vein', x: 70, z: 66, roam: 3, y: 6 },
    ],
    pads: [
      { x: 64, z: 50, label: '🪨 How layers stack up', demo: 'strata', y: 6 },
      { x: 64, z: 86, label: '🗺️ To: Starry Observatory', goto: 'observatory', y: 6 },
      { x: 40, z: 64, label: '🗺️ Back to Village', goto: 'village', y: 6 },
    ],
    build: (w) => {
      // 实心岩体
      for (let x = 0; x < w.sx; x++)
        for (let z = 0; z < w.sz; z++) {
          const nz = Math.sin(x * 0.12) * 2 + Math.cos(z * 0.1) * 2;
          for (let y = 0; y <= 30 + nz; y++) {
            const id = y < 3 ? blocks.obsidian : y < 10 ? blocks.stone : y % 7 === 0 ? blocks.gravel : blocks.stone;
            w.putFast(x, y, z, id);
          }
        }
      // 矿脉
      const rnd = mulberry32(2026);
      for (let i = 0; i < 26; i++) {
        const x = 8 + Math.floor(rnd() * (w.sx - 16));
        const z = 8 + Math.floor(rnd() * (w.sz - 16));
        const y = 5 + Math.floor(rnd() * 22);
        const pick = rnd();
        vein(w, x, y, z, 3 + rnd() * 3, pick < 0.4 ? blocks.coalOre : pick < 0.7 ? blocks.ironOre : pick < 0.86 ? blocks.goldOre : blocks.crystalOre, x + z);
      }
      // 挖空洞穴
      carveCaves(w, 88, 0.085, 3, 28);
      // 主厅：一个大厅 + 走廊
      box(w, 52, 6, 52, 78, 18, 78, 0);
      for (let x = 50; x <= 80; x++) for (let z = 50; z <= 80; z++) w.putFast(x, 5, z, blocks.cobble);
      box(w, 62, 6, 78, 68, 11, 112, 0);
      box(w, 30, 6, 62, 54, 11, 66, 0);
      // 顶封
      for (let x = 0; x < w.sx; x++) for (let z = 0; z < w.sz; z++) for (let y = 32; y < w.sy; y++) w.putFast(x, y, z, blocks.obsidian);
      // 支撑柱与灯
      for (const [cx, cz] of [[56, 56], [74, 56], [56, 74], [74, 74], [64, 96]] as [number, number][]) {
        column(w, cx, cz, 6, 18, blocks.wood);
        w.putFast(cx, 19, cz, blocks.lamp);
      }
      for (let i = 0; i < 60; i++) {
        const x = 8 + Math.floor(rnd() * (w.sx - 16));
        const z = 8 + Math.floor(rnd() * (w.sz - 16));
        for (let y = 26; y > 4; y--) {
          if (w.get(x, y, z) !== 0) {
            if (w.get(x, y + 1, z) === 0 && w.get(x, y, z) !== blocks.obsidian) {
              const use = rnd() < 0.45 ? blocks.lamp : blocks.crystalOre;
              w.putFast(x, y + 1, z, use);
            }
            break;
          }
        }
      }
      // 岩浆小池
      for (let x = 34; x <= 42; x++)
        for (let z = 58; z <= 66; z++) {
          if (Math.hypot(x - 38, z - 62) > 4) continue;
          w.putFast(x, 5, z, 0);
          w.putFast(x, 4, z, blocks.lava);
        }
      // 化石展厅
      box(w, 84, 6, 84, 104, 14, 104, blocks.stoneBrick, true);
      for (let x = 84; x <= 104; x++) for (let z = 84; z <= 104; z++) w.putFast(x, 6, z, blocks.plank);
      for (let i = 0; i < 5; i++) {
        const fx = 88 + i * 4;
        column(w, fx, 92, 7, 11, blocks.quartz);
        w.putFast(fx, 12, 92, blocks.coalOre);
      }
      w.putFast(94, 13, 92, blocks.lamp);
      // 出口传送座
      for (const p of [{ x: 64, z: 86 }, { x: 40, z: 64 }]) {
        for (let y = 6; y < 9; y++) w.putFast(p.x, y, p.z, 0);
        platform(w, p.x, p.z, 2, 5, blocks.portal);
      }
      const gp = groundAt(w, 64, 50);
      platform(w, 64, 50, 2, gp - 1, blocks.crystalOre);
      // 演示台与传送座必须落在洞底
      platform(w, 64, 50, 2, 5, blocks.crystalOre);
      for (const p of [{ x: 58, z: 60 }, { x: 70, z: 66 }, { x: 64, z: 64 }]) {
        for (let y = 6; y < 9; y++) w.putFast(p.x, y, p.z, 0);
      }
    },
  },

  // ───────────────── 5. 星空天文台 ─────────────────
  {
    id: 'observatory',
    name: 'Starry Observatory',
    icon: '🔭',
    subtitle: 'Letters From Light-Years Away',
    brief: 'At night the brightest thing is not only the stars. Here you find out why there is day and night, the turning of the seasons, and the moon\'s changing face.',
    topics: ['earth_rotation', 'earth_revolution', 'moon_phase', 'solar_system', 'constellation', 'eclipse'],
    sky: 0x070a18,
    fogColor: 0x0d1226,
    fogDensity: 0.007,
    ambient: 0.55,
    sun: 0.5,
    stars: true,
    night: true,
    spawn: [64, 92],
    npcs: [
      { p: 'star_see', x: 64, z: 80, roam: 4 },
      { p: 'compass', x: 70, z: 84, roam: 3 },
    ],
    pads: [
      { x: 64, z: 68, label: '🌍 Day, Night & Seasons', demo: 'earth_motion' },
      { x: 48, z: 68, label: '🌙 How the Moon changes', demo: 'moon_phase' },
      { x: 80, z: 68, label: '🪐 A tour of the Solar System', demo: 'solar_system' },
      { x: 40, z: 92, label: '🗺️ To: Wonder Lab', goto: 'lab' },
      { x: 88, z: 92, label: '🗺️ Back to Village', goto: 'village' },
    ],
    build: (w) => {
      const field = heightField(w.sx, { base: 20, amp: 2.2, scale: 0.02, seed: 101, shape: rimShape, terrace: false });
      paintTerrain(w, field, { top: blocks.stoneBrick, sub: blocks.stone, deep: blocks.stone });
      // 观测平台
      for (let x = 40; x <= 92; x++)
        for (let z = 56; z <= 100; z++) {
          const g = groundAt(w, x, z);
          w.putFast(x, g - 1, z, (x + z) % 4 < 2 ? blocks.quartz : blocks.stoneBrick);
          for (let y = g; y < g + 12; y++) w.putFast(x, y, z, 0);
        }
      // 圆顶天文台
      const cx = 64;
      const cz = 80;
      for (let y = 21; y <= 26; y++) {
        const r = 9 - (y - 21) * 0.5;
        for (let x = -10; x <= 10; x++)
          for (let z = -10; z <= 10; z++) {
            const d = Math.hypot(x, z);
            if (d <= r + 0.5 && d > r - 1.5) w.putFast(cx + x, y, cz + z, blocks.quartz);
          }
      }
      for (let x = -11; x <= 11; x++)
        for (let z = -11; z <= 11; z++) if (Math.hypot(x, z) <= 10) w.putFast(cx + x, 20, cz + z, blocks.quartz);
      // 望远镜
      for (let y = 21; y <= 27; y++) w.putFast(cx, y, cz, blocks.metal);
      w.putFast(cx, 28, cz, blocks.glass);
      ball(w, cx, 29, cz, 1, blocks.lamp);
      // 星球模型（太阳系）
      const planets: [number, number, number, number][] = [
        [1, blocks.woolYellow, 12, 0],
        [1, blocks.woolRed, 16, 60],
        [2, blocks.woolBlue, 22, 130],
        [1, blocks.woolRed, 26, 200],
        [4, blocks.woolYellow, 34, 260],
        [3, blocks.woolWhite, 44, 320],
        [2, blocks.woolPurple, 52, 30],
        [2, blocks.woolBlue, 58, 100],
      ];
      planets.forEach(([r, id, dist, ang], i) => {
        const a = (ang * Math.PI) / 180;
        const px = Math.round(64 + Math.cos(a) * dist * 0.55);
        const pz = Math.round(104 + Math.sin(a) * dist * 0.35);
        ball(w, px, 26 + (i % 3), pz, r, id);
        w.putFast(px, 27 + (i % 3) + r, pz, blocks.lamp);
      });
      // 星轨装饰
      scatter(w, 120, 55, (x, z) => {
        if (Math.random() < 0.35) {
          const y = 30 + Math.floor(Math.random() * 10);
          w.putFast(x, y, z, blocks.star);
        }
      });
      // 北斗七星
      const bigDipper: [number, number][] = [
        [24, 26],
        [32, 24],
        [40, 25],
        [47, 28],
        [52, 24],
        [57, 27],
        [60, 22],
      ];
      bigDipper.forEach(([x, z]) => ball(w, x, 34, z, 1, blocks.star));
      // 演示台与传送
      const put = (x: number, z: number, id: number) => {
        const g = groundAt(w, x, z);
        platform(w, x, z, 2, g - 1, id);
      };
      put(64, 68, blocks.woolBlue);
      put(48, 68, blocks.woolPurple);
      put(80, 68, blocks.woolYellow);
      put(40, 92, blocks.portal);
      put(88, 92, blocks.portal);
      // 楼梯到 main platform
      for (let i = 0; i < 10; i++) {
        box(w, 62, 10 + i, 104 - i, 66, 10 + i, 104 - i, blocks.quartz);
      }
    },
  },

  // ───────────────── 6. 万象实验园 ─────────────────
  {
    id: 'lab',
    name: 'Wonder Lab',
    icon: '⚡',
    subtitle: 'Making the Invisible Visible',
    brief: 'Electricity, heat, force, and light all hide behind everyday things. Come run an experiment — first think clearly about why, then get your hands dirty.',
    topics: ['circuit', 'conductor', 'magnet', 'fire_triangle', 'change_types', 'lever', 'pulley', 'energy_forms', 'renewable', 'friction'],
    sky: 0xffd9a8,
    fogColor: 0xffe8cc,
    fogDensity: 0.006,
    ambient: 0.85,
    sun: 1.0,
    stars: false,
    night: false,
    spawn: [64, 96],
    npcs: [
      { p: 'quark', x: 56, z: 84, roam: 5 },
      { p: 'ember', x: 74, z: 84, roam: 3 },
      { p: 'archie', x: 64, z: 74, roam: 6 },
    ],
    pads: [
      { x: 50, z: 92, label: '⚡ Light up a bulb', demo: 'circuit' },
      { x: 66, z: 92, label: '🌈 Splitting light', demo: 'rainbow' },
      { x: 82, z: 92, label: '🔧 Does a lever save effort?', demo: 'lever' },
      { x: 40, z: 96, label: '🗺️ Back to Village', goto: 'village' },
      { x: 88, z: 96, label: '🗺️ To: Starry Observatory', goto: 'observatory' },
    ],
    build: (w) => {
      const field = heightField(w.sx, { base: 18, amp: 1.6, scale: 0.02, seed: 202, shape: rimShape, terrace: false });
      paintTerrain(w, field, { top: blocks.grass, sub: blocks.dirt, deep: blocks.stone });
      // 实验场地坪
      for (let x = 36; x <= 92; x++)
        for (let z = 64; z <= 106; z++) {
          const g = groundAt(w, x, z);
          w.putFast(x, g - 1, z, ((x >> 2) + (z >> 2)) % 2 === 0 ? blocks.quartz : blocks.stoneBrick);
          for (let y = g; y < g + 14; y++) w.putFast(x, y, z, 0);
        }
      // 电学屋
      house(w, 46, 66, 11, 10, 5, blocks.metal, blocks.woolBlue);
      // 化学屋（带烟囱）
      const chx = 74;
      const chz = 66;
      house(w, chx, chz, 10, 10, 5, blocks.brick, blocks.brick);
      column(w, chx + 8, chz + 8, 23, 30, blocks.brick);
      for (let x = chx + 2; x <= chx + 8; x++)
        for (let z = chz + 2; z <= chz + 8; z++) for (let y = 23; y <= 24; y++) w.putFast(x, y, z, blocks.woolRed);
      // 机械区：杠杆装置
      const lx = 64;
      const lz = 74;
      column(w, lx, lz, 19, 23, blocks.cobble);
      for (let dx = -6; dx <= 6; dx++) w.putFast(lx + dx, 24, lz, blocks.wood);
      w.putFast(lx - 6, 25, lz, blocks.metal);
      w.putFast(lx + 6, 25, lz, blocks.woolYellow);
      // 斜面展示
      for (let i = 0; i < 10; i++) column(w, 40, 80 + i, 19 + Math.floor(i / 2), 19 + Math.floor(i / 2), blocks.plank);
      // 风车（可再生能源）
      const wx = 92;
      const wz = 100;
      column(w, wx, wz, 19, 34, blocks.cobble);
      ball(w, wx, 36, wz, 1, blocks.plank);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        for (let r = 1; r <= 5; r++) {
          const px = Math.round(wx + Math.cos(a) * r);
          const py = Math.round(36 + Math.sin(a) * r);
          w.putFast(px, py, wz, blocks.woolWhite);
        }
      }
      // 水轮
      for (let x = 48; x <= 58; x++) for (let z = 102; z <= 104; z++) w.putFast(x, 19, z, blocks.water);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const px = Math.round(53 + Math.cos(a) * 4);
        const py = Math.round(23 + Math.sin(a) * 4);
        column(w, px, 100, py, py, blocks.plank);
      }
      // 彩虹装置
      for (let i = 0; i < 7; i++) {
        const rising = i;
        for (let j = 0; j < 12; j++) {
          const x = 62 + j;
          const y = 26 + rising;
          if (Math.abs(j - 6) < 6 - rising * 0.4) w.putFast(x, y, 92, blocks.quartz);
        }
      }
      // 演示台
      const put = (x: number, z: number, id: number) => platform(w, x, z, 2, groundAt(w, x, z) - 1, id);
      put(50, 92, blocks.woolBlue);
      put(66, 92, blocks.woolRed);
      put(82, 92, blocks.woolYellow);
      put(40, 96, blocks.portal);
      put(88, 96, blocks.portal);
      scatter(w, 24, 333, (x, z) => {
        const g = groundAt(w, x, z);
        if (g > 19 && (x < 36 || x > 92 || z < 64 || z > 106)) tree(w, x, z, 4);
      });
      for (let x = 40; x <= 88; x += 12)
        for (let z = 68; z <= 104; z += 12) {
          const g = groundAt(w, x, z);
          w.putFast(x, g, z, blocks.lamp);
        }
    },
  },
];

export const SCENE_BY_ID = new Map(SCENES.map((s) => [s.id, s]));
export { GRID_PAD };
