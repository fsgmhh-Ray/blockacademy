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
    const house = nameplateSprite('🏠 Grayson 小屋', '#8fd8ff', '作者之一 · Co-author Grayson');
    house.position.set(78.5, w.groundY(78, 90) + 9.6, 90.5);
    house.scale.multiplyScalar(1.25);
    // 雕像在广场西北角 (54, 76)，头顶名牌
    const statue = nameplateSprite('💙 Grayson', '#8fd8ff', '小小作者之一');
    statue.position.set(54.5, w.groundY(54, 76) + 6.6, 76.5);
    statue.scale.multiplyScalar(1.1);
    this.group.add(house, statue);
  }

  get current(): string {
    return this.builtFor;
  }

  /** 数理学院：各区域的中英双语名牌 */
  buildMath(w: World): void {
    this.clear();
    this.builtFor = 'math';
    const spots: [string, string, number, number, number, number][] = [
      // [主标题, 副标题, x, y, z, 缩放]
      ['🍕 Fraction Parlor 分数披萨店', '1/2 = 2/4 = 4/8 · 等值分数', 42, 0, 52, 1.1],
      ['📐 Geometry Garden 几何花园', '角度 · 对称 · 图形', 86, 0, 52, 1.1],
      ['📊 Stat Tower 数据统计塔', '平均数 · 中位数 · 概率', 64, 0, 40, 1.1],
      ['🌉 Ratio Bridge 比例大桥', '1:2 · 比与比例', 64, 0, 88, 1.1],
      ['🧮 Number Plaza 数阵广场', '坐标 · 小数 · 时钟角度', 64, 0, 58, 1.2],
    ];
    for (const [title, sub, x, _y, z, scale] of spots) {
      const sp = nameplateSprite(title, '#c9b8ff', sub);
      sp.position.set(x + 0.5, w.groundY(x, z) + 7.2, z + 0.5);
      sp.scale.multiplyScalar(scale);
      this.group.add(sp);
    }
  }
}
