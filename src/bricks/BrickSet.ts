import {
  BoxGeometry, Color, DynamicDrawUsage, Group, InstancedMesh, MeshBasicMaterial, MeshStandardMaterial,
  Quaternion, Sphere, Vector3, type Ray,
} from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { EventQueue, RigidBody, World as RapierWorld } from '@dimforge/rapier3d-compat'
import { chunked, PALETTE, PLATE, type Grid } from './voxel.ts'

export interface Physics {
  R: typeof RAPIER
  world: RapierWorld
  events: EventQueue
}

/** A grid plus where it sits relative to the first part, in cells of that grid. */
export interface Part {
  grid: Grid
  at?: [number, number, number]
}

// Chunk states.
const HOME = 0 // in the model (its voxels may still be dropping in)
const LOOSE = 1 // owned by the physics engine
const RETURNING = 2 // flying back to its place
const HIDDEN = 3 // buried inside the model: nothing to draw or move, but it holds its neighbours up

const FALL = 0.3 // share of the whole build one voxel spends dropping
const BREAK_SPEED = 16 // a loose chunk flying faster than this knocks out what it hits
const RETURN_TIME = 0.7
const UP = new Vector3(0, 1, 0)
const WHITE = new Color(1, 1, 1)
const KINDS = ['solid', 'trans', 'glow'] as const

const cube = new BoxGeometry()
const materials = {
  solid: new MeshStandardMaterial({ roughness: 0.9 }),
  trans: new MeshStandardMaterial({ roughness: 0.25, transparent: true, opacity: 0.6 }),
  glow: new MeshBasicMaterial({ toneMapped: false }),
}
/** Shared by every emissive voxel, so the world can make them all breathe at once. */
export const glowMaterial = materials.glow
const kindOf = (color: string) => (color.startsWith('trans') ? 1 : color.startsWith('glow') ? 2 : 0)

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const rnd = () => Math.random() * 2 - 1

const _o = new Vector3()
const _d = new Vector3()
const _q = new Quaternion()
const _c = new Color()

/**
 * One model. Its voxels drop into place one by one; once built, it can be knocked apart
 * chunk by chunk (a chunk is one stud-sized block of voxels) and flies back together.
 */
export class BrickSet {
  readonly group = new Group()
  /** Footprint of the first part and overall height, in studs. */
  readonly size = new Vector3()
  readonly origin: Vector3
  readonly rotY: number
  /** Number of chunks currently owned by physics. */
  loose = 0
  /** Height (0..1 of the model) of whatever landed or clattered most recently, -1 once it has been heard. */
  landed = -1
  /** One body per visible chunk while the model is armed. */
  bodies?: (RigidBody | undefined)[]

  // Per voxel.
  private count: number
  private home: Float32Array // world position
  private local: Float32Array // offset from the centre of its chunk, before the model's turn
  private chunkOf: Uint32Array
  private order: Float32Array
  private seed: Float32Array
  private prog: Float32Array
  private meshOf: Uint8Array
  private slotOf: Uint32Array
  private tint: Float32Array // rgb, for un-highlighting

  // Per chunk.
  private chunks: number
  private state: Uint8Array
  private start: Uint32Array
  private end: Uint32Array
  private cHome: Float32Array // world centre
  private cLocal: Float32Array // centre before the model's turn and position
  private half: Float32Array
  private pos: Float32Array
  private quat: Float32Array
  private fromPos: Float32Array
  private fromQuat: Float32Array
  private vel: Float32Array
  private stamp: Float32Array // start time of a return flight
  private delay: Float32Array // 0..1 by height: lower chunks fly home first
  private grounded: Uint8Array
  private neighbors: number[][] = []

  private meshes: InstancedMesh[] = []
  private matrices: Float32Array[] = []
  private dirty: boolean[] = []
  private returning: number[] = []
  private breaks: number[][] = []
  private byCollider = new Map<number, number>()
  private ph?: Physics
  private progress = -1
  private unsettled = false
  private lit = -1
  private yaw = new Quaternion()
  private cos: number
  private sin: number
  private vx: number // width of a voxel in studs
  private vy: number // height of a voxel in studs

  constructor(parts: Part[], origin: Vector3, rotY: number) {
    this.origin = origin
    this.rotY = rotY
    this.yaw.setFromAxisAngle(UP, rotY)
    const cos = (this.cos = Math.cos(rotY))
    const sin = (this.sin = Math.sin(rotY))
    const first = parts[0].grid
    const vx = (this.vx = PLATE / first.aspect)
    const vy = (this.vy = PLATE)
    const W = first.sx * vx
    const D = first.sz * vx

    const pieces = parts.map((part) => chunked(part.grid))
    const count = (this.count = pieces.reduce((n, p) => n + p.voxels.length, 0))
    const chunks = (this.chunks = pieces.reduce((n, p) => n + p.chunks.length, 0))
    this.home = new Float32Array(count * 3)
    this.local = new Float32Array(count * 3)
    this.chunkOf = new Uint32Array(count)
    this.order = new Float32Array(count)
    this.seed = new Float32Array(count)
    this.prog = new Float32Array(count)
    this.meshOf = new Uint8Array(count)
    this.slotOf = new Uint32Array(count)
    this.tint = new Float32Array(count * 3)
    this.state = new Uint8Array(chunks)
    this.start = new Uint32Array(chunks)
    this.end = new Uint32Array(chunks)
    this.cHome = new Float32Array(chunks * 3)
    this.cLocal = new Float32Array(chunks * 3)
    this.half = new Float32Array(chunks * 3)
    this.pos = new Float32Array(chunks * 3)
    this.quat = new Float32Array(chunks * 4)
    this.fromPos = new Float32Array(chunks * 3)
    this.fromQuat = new Float32Array(chunks * 4)
    this.vel = new Float32Array(chunks * 3)
    this.stamp = new Float32Array(chunks)
    this.delay = new Float32Array(chunks)
    this.grounded = new Uint8Array(chunks)

    const perKind = [0, 0, 0]
    const kinds = new Uint8Array(count)
    const keys = new Float32Array(count)
    let v0 = 0
    let c0 = 0
    let top = 0
    parts.forEach((part, p) => {
      const at = part.at ?? [0, 0, 0]
      const { voxels, chunks: list } = pieces[p]
      list.forEach((chunk, k) => {
        const c = c0 + k
        const x = (at[0] + chunk.x + chunk.w / 2) * vx - W / 2
        const y = (at[1] + chunk.y + chunk.h / 2) * vy
        const z = (at[2] + chunk.z + chunk.d / 2) * vx - D / 2
        this.cLocal.set([x, y, z], c * 3)
        this.cHome.set([origin.x + cos * x + sin * z, origin.y + y, origin.z - sin * x + cos * z], c * 3)
        this.half.set([(chunk.w * vx) / 2, (chunk.h * vy) / 2, (chunk.d * vx) / 2], c * 3)
        this.start[c] = v0 + chunk.start
        this.end[c] = v0 + chunk.end
        this.state[c] = chunk.end > chunk.start ? HOME : HIDDEN
        this.grounded[c] = chunk.grounded ? 1 : 0
        this.neighbors.push(chunk.neighbors.map((other) => c0 + other))
        top = Math.max(top, at[1] + chunk.y + chunk.h)
      })
      voxels.forEach((voxel, k) => {
        const v = v0 + k
        const x = (at[0] + voxel.x + 0.5) * vx - W / 2
        const y = (at[1] + voxel.y + 0.5) * vy
        const z = (at[2] + voxel.z + 0.5) * vx - D / 2
        this.home.set([origin.x + cos * x + sin * z, origin.y + y, origin.z - sin * x + cos * z], v * 3)
        const c = (this.chunkOf[v] = c0 + voxel.chunk)
        this.local.set([x - this.cLocal[c * 3], y - this.cLocal[c * 3 + 1], z - this.cLocal[c * 3 + 2]], v * 3)
        this.seed[v] = Math.random()
        keys[v] = y + this.seed[v] * 2.2
        const kind = (kinds[v] = kindOf(voxel.color))
        this.slotOf[v] = perKind[kind]++
        _c.set(PALETTE[voxel.color])
        // No two voxels are quite the same shade: that speckle is what makes a flat wall read as cubes.
        if (kind === 0) _c.offsetHSL(0, rnd() * 0.02, rnd() * 0.02)
        if (kind === 2) _c.multiplyScalar(1.7)
        _c.toArray(this.tint, v * 3)
      })
      v0 += voxels.length
      c0 += list.length
    })
    this.size.set(W, top * vy, D)
    for (let c = 0; c < chunks; c++) this.delay[c] = this.cLocal[c * 3 + 1] / this.size.y

    // Build order: bottom layers first, a little shuffled.
    const rank = Array.from({ length: count }, (_, v) => v).sort((a, b) => keys[a] - keys[b])
    rank.forEach((v, i) => (this.order[v] = count > 1 ? i / (count - 1) : 0))

    const bounds = new Sphere(new Vector3(origin.x, this.size.y / 2, origin.z), Math.max(W, D) + this.size.y + 40)
    const meshOfKind = [-1, -1, -1]
    perKind.forEach((n, kind) => {
      if (!n) return
      const mesh = new InstancedMesh(cube, materials[KINDS[kind]], n)
      mesh.instanceMatrix.setUsage(DynamicDrawUsage)
      mesh.instanceMatrix.array.fill(0) // every voxel starts out invisible
      mesh.castShadow = kind === 0
      mesh.receiveShadow = true
      mesh.boundingSphere = bounds
      meshOfKind[kind] = this.meshes.length
      this.meshes.push(mesh)
      this.matrices.push(mesh.instanceMatrix.array as Float32Array)
      this.dirty.push(true)
      this.group.add(mesh)
    })
    for (let v = 0; v < count; v++) {
      const m = (this.meshOf[v] = meshOfKind[kinds[v]])
      this.meshes[m].setColorAt(this.slotOf[v], _c.fromArray(this.tint, v * 3))
    }
  }

  /** Move the whole model: its origin goes to `to`, turned by `turn` radians around its own vertical axis. */
  moveTo(to: Vector3, turn: number) {
    const { position, quaternion } = this.group
    quaternion.setFromAxisAngle(UP, turn)
    position.copy(this.origin).applyQuaternion(quaternion).negate().add(to)
  }

  /** True once every voxel has dropped in (some chunks may since have been knocked loose). */
  get ready() {
    return this.progress >= 1
  }

  isLoose(chunk: number) {
    return this.state[chunk] === LOOSE
  }

  /** Voxel v, upright at (x, y, z), scaled by k. This is the hot path of a build, so it writes the matrix by hand. */
  private put(v: number, x: number, y: number, z: number, k: number) {
    const m = this.meshOf[v]
    const a = this.matrices[m]
    const o = this.slotOf[v] * 16
    const w = this.vx * k * 1.01
    a[o] = this.cos * w
    a[o + 2] = -this.sin * w
    a[o + 5] = this.vy * k * 1.01
    a[o + 8] = this.sin * w
    a[o + 10] = this.cos * w
    a[o + 12] = x
    a[o + 13] = y
    a[o + 14] = z
    a[o + 15] = 1
    a[o + 1] = a[o + 4] = a[o + 6] = a[o + 9] = 0
    this.dirty[m] = true
  }

  /** Voxel v where it is `l` (0..1) of the way through its drop. */
  private drop(v: number, l: number) {
    const h = this.home
    if (l >= 1) this.put(v, h[v * 3], h[v * 3 + 1], h[v * 3 + 2], 1)
    else if (l <= 0) this.put(v, 0, 0, 0, 0)
    else {
      const air = 1 - l * l // falls like a dropped thing: slow first, fastest on landing
      this.put(v, h[v * 3], h[v * 3 + 1] + air * (7 + this.seed[v] * 9), h[v * 3 + 2], Math.min(1, l * 5))
    }
  }

  /** All voxels of a chunk, carried along by its current position and rotation. */
  private carry(c: number) {
    const { pos, quat, local } = this
    const x = quat[c * 4]
    const y = quat[c * 4 + 1]
    const z = quat[c * 4 + 2]
    const w = quat[c * 4 + 3]
    const m00 = 1 - 2 * (y * y + z * z)
    const m01 = 2 * (x * y - z * w)
    const m02 = 2 * (x * z + y * w)
    const m10 = 2 * (x * y + z * w)
    const m11 = 1 - 2 * (x * x + z * z)
    const m12 = 2 * (y * z - x * w)
    const m20 = 2 * (x * z - y * w)
    const m21 = 2 * (y * z + x * w)
    const m22 = 1 - 2 * (x * x + y * y)
    const sx = this.vx * 1.01
    const sy = this.vy * 1.01
    for (let v = this.start[c]; v < this.end[c]; v++) {
      const m = this.meshOf[v]
      const a = this.matrices[m]
      const o = this.slotOf[v] * 16
      const lx = local[v * 3]
      const ly = local[v * 3 + 1]
      const lz = local[v * 3 + 2]
      a[o] = m00 * sx
      a[o + 1] = m10 * sx
      a[o + 2] = m20 * sx
      a[o + 4] = m01 * sy
      a[o + 5] = m11 * sy
      a[o + 6] = m21 * sy
      a[o + 8] = m02 * sx
      a[o + 9] = m12 * sx
      a[o + 10] = m22 * sx
      a[o + 12] = pos[c * 3] + m00 * lx + m01 * ly + m02 * lz
      a[o + 13] = pos[c * 3 + 1] + m10 * lx + m11 * ly + m12 * lz
      a[o + 14] = pos[c * 3 + 2] + m20 * lx + m21 * ly + m22 * lz
      a[o + 15] = 1
      this.dirty[m] = true
    }
  }

  /**
   * @param progress 0..1 build progress: voxels drop in from the bottom layer up
   * @param time seconds, monotonic
   */
  update(progress: number, time: number) {
    const { count, state, prog, order, chunkOf } = this
    if (progress !== this.progress) {
      this.progress = progress
      const p = progress * (1 + FALL)
      for (let v = 0; v < count; v++) {
        const raw = (p - order[v]) / FALL
        const l = raw < 0 ? 0 : raw > 1 ? 1 : raw
        const before = prog[v]
        if (l === before) continue
        prog[v] = l
        if (state[chunkOf[v]] !== HOME) continue
        this.drop(v, l)
        if (l >= 1 && before > 0) this.landed = (this.home[v * 3 + 1] - this.origin.y) / this.size.y
      }
    }

    for (let k = this.returning.length - 1; k >= 0; k--) {
      const c = this.returning[k]
      const u = clamp01((time - this.stamp[c]) / RETURN_TIME)
      const e = u * u * (3 - 2 * u)
      for (let a = 0; a < 3; a++) this.pos[c * 3 + a] = this.fromPos[c * 3 + a] + (this.cHome[c * 3 + a] - this.fromPos[c * 3 + a]) * e
      this.pos[c * 3 + 1] += Math.sin(Math.PI * u) * 4
      _q.fromArray(this.fromQuat, c * 4).slerp(this.yaw, e).toArray(this.quat, c * 4)
      if (u < 1) this.carry(c)
      else {
        state[c] = HOME
        for (let v = this.start[c]; v < this.end[c]; v++) this.drop(v, prog[v])
        this.landed = this.delay[c]
        this.returning.splice(k, 1)
      }
    }

    this.meshes.forEach((mesh, m) => {
      if (!this.dirty[m]) return
      mesh.instanceMatrix.needsUpdate = true
      this.dirty[m] = false
    })
  }

  /** Nearest chunk under the ray, or -1. `out.x` receives the distance along the ray. */
  pick(ray: Ray, out?: Vector3) {
    let best = -1
    let bestT = Infinity
    for (let c = 0; c < this.chunks; c++) {
      const s = this.state[c]
      if (s === HIDDEN) continue
      if (s === HOME) {
        _o.copy(ray.origin).sub(_d.fromArray(this.cHome, c * 3)).applyQuaternion(_q.copy(this.yaw).invert())
        _d.copy(ray.direction).applyQuaternion(_q)
      } else {
        _q.fromArray(this.quat, c * 4).invert()
        _o.copy(ray.origin).sub(_d.fromArray(this.pos, c * 3)).applyQuaternion(_q)
        _d.copy(ray.direction).applyQuaternion(_q)
      }
      let t0 = 0
      let t1 = bestT
      for (let a = 0; a < 3 && t0 <= t1; a++) {
        const h = this.half[c * 3 + a]
        const o = _o.getComponent(a)
        const d = _d.getComponent(a)
        if (Math.abs(d) < 1e-8) {
          if (Math.abs(o) > h) t0 = Infinity
        } else {
          const a0 = (-h - o) / d
          const a1 = (h - o) / d
          t0 = Math.max(t0, Math.min(a0, a1))
          t1 = Math.min(t1, Math.max(a0, a1))
        }
      }
      if (t0 <= t1 && t0 < bestT) {
        bestT = t0
        best = c
      }
    }
    out?.setX(bestT)
    return best
  }

  /** Brighten one chunk (the one under the cursor), or none with -1. */
  highlight(chunk: number) {
    if (chunk === this.lit) return
    for (const [c, amount] of [[this.lit, 0], [chunk, 0.35]]) {
      if (c < 0) continue
      for (let v = this.start[c]; v < this.end[c]; v++) {
        const mesh = this.meshes[this.meshOf[v]]
        mesh.setColorAt(this.slotOf[v], _c.fromArray(this.tint, v * 3).lerp(WHITE, amount))
        mesh.instanceColor!.needsUpdate = true
      }
    }
    this.lit = chunk
  }

  // --- physics, chunk by chunk -------------------------------------------------------------

  /** Give every visible chunk a body. They stay fixed in place until something frees them. */
  arm(ph: Physics) {
    if (this.bodies) return
    this.ph = ph
    const { R, world } = ph
    const { cHome: p, yaw, half } = this
    this.bodies = Array.from({ length: this.chunks }, (_, c) => {
      if (this.state[c] === HIDDEN) return undefined
      const body = world.createRigidBody(
        R.RigidBodyDesc.fixed()
          .setTranslation(p[c * 3], p[c * 3 + 1], p[c * 3 + 2])
          .setRotation(yaw)
          .setLinearDamping(0.25)
          .setAngularDamping(0.5),
      )
      const collider = world.createCollider(
        R.ColliderDesc.cuboid(
          Math.max(half[c * 3] - 0.02, 0.05),
          Math.max(half[c * 3 + 1] - 0.01, 0.05),
          Math.max(half[c * 3 + 2] - 0.02, 0.05),
        )
          .setFriction(0.7)
          .setRestitution(0.25)
          .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
        body,
      )
      this.byCollider.set(collider.handle, c)
      return body
    })
  }

  /** Remove the bodies again. Loose chunks fly home first. */
  disarm(time: number) {
    this.rebuild(time)
    if (!this.bodies || !this.ph) return
    for (const body of this.bodies) if (body) this.ph.world.removeRigidBody(body)
    this.bodies = undefined
    this.byCollider.clear()
  }

  /** Hand a chunk over to physics with a starting velocity. */
  free(c: number, vx = 0, vy = 0, vz = 0) {
    const body = this.bodies?.[c]
    if (!body || this.state[c] !== HOME || this.progress < 1) return
    this.state[c] = LOOSE
    this.loose++
    for (let a = 0; a < 3; a++) this.pos[c * 3 + a] = this.cHome[c * 3 + a]
    this.yaw.toArray(this.quat, c * 4)
    body.setBodyType(this.ph!.R.RigidBodyType.Dynamic, true)
    body.setLinvel({ x: vx, y: vy, z: vz }, true)
    body.setAngvel({ x: rnd() * 5, y: rnd() * 5, z: rnd() * 5 }, true)
    this.vel.set([vx, vy, vz], c * 3)
    this.unsettled = true
  }

  /** Blow the whole model apart, away from a point. */
  smash(from: Vector3, power = 25) {
    for (let c = 0; c < this.chunks; c++) {
      _d.fromArray(this.cHome, c * 3).sub(from)
      _d.y = Math.abs(_d.y) + 3 + Math.random() * 6
      _d.normalize().multiplyScalar(power * (0.45 + Math.random() * 0.75))
      this.free(c, _d.x, _d.y, _d.z)
    }
  }

  /** Pop a chunk and its close neighbours out of the model. */
  burst(chunk: number, radius = 2.6, power = 15) {
    const at = this.state[chunk] === HOME ? this.cHome : this.pos
    const x = at[chunk * 3]
    const y = at[chunk * 3 + 1]
    const z = at[chunk * 3 + 2]
    for (let c = 0; c < this.chunks; c++) {
      const loose = this.state[c] === LOOSE
      const p = loose ? this.pos : this.cHome
      _d.set(p[c * 3] - x, p[c * 3 + 1] - y, p[c * 3 + 2] - z)
      if (_d.length() > radius) continue
      _d.y = Math.abs(_d.y) + 1.5
      _d.normalize().multiplyScalar(power * (0.6 + Math.random() * 0.6))
      if (loose) this.bodies?.[c]?.setLinvel(_d, true)
      else this.free(c, _d.x, _d.y, _d.z)
    }
  }

  /** Every loose chunk flies back to where it belongs, bottom layers first. */
  rebuild(time: number) {
    for (let c = 0; c < this.chunks; c++) {
      if (this.state[c] !== LOOSE) continue
      this.state[c] = RETURNING
      this.stamp[c] = time + this.delay[c] * 0.9
      for (let k = 0; k < 3; k++) this.fromPos[c * 3 + k] = this.pos[c * 3 + k]
      for (let k = 0; k < 4; k++) this.fromQuat[c * 4 + k] = this.quat[c * 4 + k]
      this.returning.push(c)
      const body = this.bodies?.[c]
      if (body) {
        const p = this.cHome
        body.setBodyType(this.ph!.R.RigidBodyType.Fixed, false)
        body.setTranslation({ x: p[c * 3], y: p[c * 3 + 1], z: p[c * 3 + 2] }, false)
        body.setRotation(this.yaw, false)
      }
    }
    this.loose = 0
  }

  /** Called for every contact that started this step. */
  contact(colliderA: number, colliderB: number) {
    const a = this.byCollider.get(colliderA)
    const b = this.byCollider.get(colliderB)
    if (a === undefined || b === undefined) return
    for (const [mover, target] of [[a, b], [b, a]]) {
      if (this.state[mover] !== LOOSE || this.state[target] !== HOME) continue
      // Falling does not count, or one dropped chunk would bring the whole model down.
      const v = this.vel
      const speed = Math.hypot(v[mover * 3], Math.max(v[mover * 3 + 1], 0), v[mover * 3 + 2])
      if (speed > 4) this.landed = Math.random() * 0.45
      if (speed > BREAK_SPEED) this.breaks.push([target, v[mover * 3] * 0.55, v[mover * 3 + 1] * 0.55 + 3, v[mover * 3 + 2] * 0.55])
    }
  }

  /** Call after the physics step: applies knock-outs and moves the voxels of every loose chunk. */
  afterStep() {
    for (const [c, x, y, z] of this.breaks) this.free(c, x, y, z)
    this.breaks.length = 0
    if (this.unsettled) this.dropUnsupported()
    if (!this.bodies || !this.loose) return
    for (let c = 0; c < this.chunks; c++) {
      if (this.state[c] !== LOOSE) continue
      const body = this.bodies[c]!
      if (body.isSleeping()) {
        this.vel.fill(0, c * 3, c * 3 + 3)
        continue
      }
      const t = body.translation()
      const r = body.rotation()
      const v = body.linvel()
      this.pos.set([t.x, t.y, t.z], c * 3)
      this.quat.set([r.x, r.y, r.z, r.w], c * 4)
      this.vel.set([v.x, v.y, v.z], c * 3)
      this.carry(c)
    }
  }

  /** Anything no longer connected to the ground through its neighbours falls. */
  private dropUnsupported() {
    const { chunks, state } = this
    const held = new Uint8Array(chunks)
    const stack: number[] = []
    for (let c = 0; c < chunks; c++)
      if (state[c] !== LOOSE && this.grounded[c]) {
        held[c] = 1
        stack.push(c)
      }
    while (stack.length)
      for (const c of this.neighbors[stack.pop()!])
        if (!held[c] && state[c] !== LOOSE) {
          held[c] = 1
          stack.push(c)
        }
    for (let c = 0; c < chunks; c++) if (!held[c] && state[c] === HOME) this.free(c)
    this.unsettled = false
  }

  dispose() {
    for (const mesh of this.meshes) mesh.dispose()
  }
}
