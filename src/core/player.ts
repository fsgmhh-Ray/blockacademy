/** 第一人称玩家：移动、重力、AABB 体素碰撞、飞行模式 */
import * as THREE from 'three';
import type { World } from './world';
import type { Input } from './input';

const HALF = 0.32;
const HEIGHT = 1.78;
const EYE = 1.62;
const GRAVITY = 26;
const JUMP = 8.4;
const WALK = 4.8;
const SPRINT = 7.6;
const FLY = 16;
const SWIM = 3.2;

export class Player {
  position = new THREE.Vector3(64, 20, 64);
  velocity = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  onGround = false;
  fly = false;
  /** 旁观模式：穿过方块 */
  noclip = false;
  inWater = false;
  /** 上一帧是否移动，用于 NPC 是否转头看你 */
  moving = false;

  private bob = 0;

  get eyePosition(): THREE.Vector3 {
    return new THREE.Vector3(this.position.x, this.position.y + EYE, this.position.z);
  }

  teleport(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
  }

  update(dt: number, input: Input, world: World, frozen: boolean): void {
    const look = input.takeLook();
    this.yaw -= look.dx * 0.0022;
    this.pitch -= look.dy * 0.0022;
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));

    let fx = 0;
    let fz = 0;
    if (!frozen) {
      if (input.down('KeyW')) fz += 1;
      if (input.down('KeyS')) fz -= 1;
      if (input.down('KeyA')) fx -= 1;
      if (input.down('KeyD')) fx += 1;
      if (input.pressed('KeyF')) this.fly = !this.fly;
    }

    const len = Math.hypot(fx, fz);
    this.moving = len > 0;
    let wishX = 0;
    let wishZ = 0;
    if (len > 0) {
      fx /= len;
      fz /= len;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      // yaw=0 时朝向 -Z
      wishX = fx * cos - fz * sin;
      wishZ = -fx * sin - fz * cos;
    }

    const sprinting = input.down('ShiftLeft') || input.down('ShiftRight');
    let speed = this.fly ? FLY : this.inWater ? SWIM : sprinting && this.moving ? SPRINT : WALK;
    if (frozen) speed = 0;

    // 旁观模式：无重力、Space 上升 / Ctrl 下降、移动更快
    if (this.noclip) {
      const nsp = frozen ? 0 : sprinting ? FLY * 2.2 : FLY * 1.5;
      let nvy = 0;
      if (!frozen) {
        if (input.down('Space')) nvy += 1;
        if (input.down('ControlLeft') || input.down('KeyQ')) nvy -= 1;
      }
      this.velocity.set(wishX * nsp, nvy * FLY, wishZ * nsp);
      this.move(world, this.velocity.x * dt, this.velocity.y * dt, this.velocity.z * dt);
      if (this.position.y < -8) {
        this.position.set(64, world.groundY(64, 64) + 2, 64);
        this.velocity.set(0, 0, 0);
      }
      this.bob += dt * 1.5;
      return;
    }

    const accel = this.onGround || this.fly ? 42 : 14;
    this.velocity.x += (wishX * speed - this.velocity.x) * Math.min(1, accel * dt);
    this.velocity.z += (wishZ * speed - this.velocity.z) * Math.min(1, accel * dt);

    if (this.fly) {
      let vy = 0;
      if (!frozen) {
        if (input.down('Space')) vy += 1;
        if (input.down('ControlLeft') || input.down('KeyQ')) vy -= 1;
      }
      this.velocity.y += (vy * FLY - this.velocity.y) * Math.min(1, 20 * dt);
    } else if (this.inWater) {
      this.velocity.y -= GRAVITY * 0.28 * dt;
      if (!frozen && (input.down('Space') || input.down('KeyW'))) this.velocity.y = Math.max(this.velocity.y, 2.6);
      this.velocity.y = Math.max(this.velocity.y, -2.2);
      this.velocity.y *= 1 - Math.min(1, 4 * dt);
    } else {
      this.velocity.y -= GRAVITY * dt;
      if (!frozen && input.down('Space') && this.onGround) {
        this.velocity.y = JUMP;
        this.onGround = false;
      }
      this.velocity.y = Math.max(this.velocity.y, -48);
    }

    this.move(world, this.velocity.x * dt, this.velocity.y * dt, this.velocity.z * dt);

    // 阻尼
    const damp = this.onGround ? 12 : 1.2;
    this.velocity.x -= this.velocity.x * Math.min(1, damp * dt);
    this.velocity.z -= this.velocity.z * Math.min(1, damp * dt);
    if (Math.abs(this.velocity.x) < 0.002) this.velocity.x = 0;
    if (Math.abs(this.velocity.z) < 0.002) this.velocity.z = 0;

    // 是否处于水中
    const feet = Math.floor(this.position.y + 0.4);
    this.inWater =
      world.get(Math.floor(this.position.x), feet, Math.floor(this.position.z)) === 7 ||
      world.get(Math.floor(this.position.x), Math.floor(this.position.y + 0.1), Math.floor(this.position.z)) === 7;

    // 防止掉出世界
    if (this.position.y < -8) {
      this.position.set(64, world.groundY(64, 64) + 2, 64);
      this.velocity.set(0, 0, 0);
    }

    if (this.onGround && len > 0 && !this.fly) {
      this.bob += dt * (sprinting ? 13 : 9);
    } else {
      this.bob += dt * 1.5;
    }
  }

  /** 分轴推进 + 滑动 */
  private move(world: World, dx: number, dy: number, dz: number): void {
    if (this.noclip) {
      this.position.x += dx;
      this.position.y += dy;
      this.position.z += dz;
      this.onGround = false;
      return;
    }
    if (dx !== 0) {
      const nx = this.position.x + dx;
      if (!this.collides(world, nx, this.position.y, this.position.z)) this.position.x = nx;
      else this.velocity.x = 0;
    }
    if (dz !== 0) {
      const nz = this.position.z + dz;
      if (!this.collides(world, this.position.x, this.position.y, nz)) this.position.z = nz;
      else this.velocity.z = 0;
    }
    if (dy !== 0) {
      const ny = this.position.y + dy;
      if (!this.collides(world, this.position.x, ny, this.position.z)) {
        this.position.y = ny;
        this.onGround = false;
      } else {
        if (dy < 0) this.onGround = true;
        this.velocity.y = 0;
      }
    }
  }

  collides(world: World, px: number, py: number, pz: number): boolean {
    return world.boxIntersects(px - HALF, py, pz - HALF, px + HALF, py + HEIGHT, pz + HALF);
  }

  /** 站立判断是否真的踩在地上（判定是否贴地 0.05） */
  groundedCheck(world: World): boolean {
    return this.collides(world, this.position.x, this.position.y - 0.05, this.position.z);
  }

  applyCamera(camera: THREE.PerspectiveCamera): void {
    camera.position.set(this.position.x, this.position.y + EYE + Math.sin(this.bob) * 0.035, this.position.z);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(this.yaw);
    camera.rotateX(this.pitch);
  }

  forwardVector(): THREE.Vector3 {
    const v = new THREE.Vector3(0, 0, -1);
    v.applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    return v;
  }
}

export const PLAYER_HALF = HALF;
export const PLAYER_HEIGHT = HEIGHT;
