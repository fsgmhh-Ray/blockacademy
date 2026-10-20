/**
 * 场景静态地标铭牌：给「Grayson 小屋」和「Grayson 雕像」挂悬浮名牌。
 * 复用 NPC 的 nameplateSprite；随场景重建，离开场景即清理，避免串景。
 */
import * as THREE from 'three';
import { nameplateSprite } from '../npc/npcActor';
import type { World } from '../core/world';

export class Landmarks {
  private group = new THREE.Group();
  private builtFor = '';

  attach(scene: THREE.Scene): void {
    this.group.name = 'landmarks';
    scene.add(this.group);
  }

  clear(): void {
    for (const c of [...this.group.children]) {
      this.group.remove(c);
      const sp = c as THREE.Sprite;
      (sp.material as THREE.SpriteMaterial | undefined)?.map?.dispose?.();
      (sp.material as THREE.Material | undefined)?.dispose?.();
    }
    this.builtFor = '';
  }

  /** 村庄：Grayson 小屋（东北角）+ Grayson 雕像（广场西北角） */
  buildVillage(w: World): void {
    this.clear();
    this.builtFor = 'village';
    // 小屋中心 (78, 90)，石英墙 8×8、屋顶到 groundY+7，名牌放屋顶上方
    const house = nameplateSprite('🏠 Grayson\'s Cottage', '#8fd8ff', 'Grayson — co-author of BlockAcademy');
    house.position.set(78.5, w.groundY(78, 90) + 9.6, 90.5);
    house.scale.multiplyScalar(1.25);
    // 雕像在广场西北角 (54, 76)，头顶名牌
    const statue = nameplateSprite('💙 Grayson', '#8fd8ff', 'One of our young authors');
    statue.position.set(54.5, w.groundY(54, 76) + 6.6, 76.5);
    statue.scale.multiplyScalar(1.1);
    this.group.add(house, statue);
  }

  get current(): string {
    return this.builtFor;
  }

  /** Math Academy: floating nameplates for each zone */
  buildMath(w: World): void {
    this.clear();
    this.builtFor = 'math';
    const spots: [string, string, number, number, number, number][] = [
      // [主标题, 副标题, x, y, z, 缩放]
      ['🍕 Fraction Pizza Parlor', '1/2 = 2/4 = 4/8 · Equivalent fractions', 42, 0, 52, 1.1],
      ['📐 Geometry Garden', 'Angles · Symmetry · Shapes', 86, 0, 52, 1.1],
      ['📊 Stats Tower', 'Mean · Median · Probability', 64, 0, 40, 1.1],
      ['🌉 Ratio Bridge', '1:2 · Ratios & Proportions', 64, 0, 88, 1.1],
      ['🧮 Number Plaza', 'Coordinates · Decimals · Clock Angles', 64, 0, 58, 1.2],
    ];
    for (const [title, sub, x, _y, z, scale] of spots) {
      const sp = nameplateSprite(title, '#c9b8ff', sub);
      sp.position.set(x + 0.5, w.groundY(x, z) + 7.2, z + 0.5);
      sp.scale.multiplyScalar(scale);
      this.group.add(sp);
    }
  }
}
