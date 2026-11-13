import { BoxGeometry, Color, DynamicDrawUsage, Euler, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshDepthMaterial, MeshStandardMaterial, Quaternion, Sphere, Vector3, type BufferAttribute, type Material } from 'three'

export const unit = new BoxGeometry()

/**
 * Part of a list of numbers has changed: from `from`, `count` of them. Only the stretch between the first and the last
 * change goes to the graphics card when the next frame is drawn, instead of the whole list.
 */
export function dirty(list: BufferAttribute, from: number, count: number) {
  const range = list.updateRanges[0]
  if (!range) list.addUpdateRange(from, count)
  else {
    const end = Math.max(range.start + range.count, from + count)
    range.start = Math.min(range.start, from)
    range.count = end - range.start
  }
  list.needsUpdate = true
}

// The wind, in the shader that places every cube. Whatever gives in it is pushed over, the more the higher it stands above
// its ground: gently to and fro in calm air, and in waves that travel west once there is a wind. `sway` is, for each cube,
// how much it gives, the height of its ground, and the place the waves reach it (one place for the whole of a tree, so
// that it bends in one piece). In calm air only what gives a little moves at all: tree tops do, grass stands still.
const WIND = /* glsl */ `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition.xz += vec2( -0.97, 0.24 ) * max( mvPosition.y - sway.y, 0.0 ) * (
	min( sway.x, 0.15 ) * wind.x * sin( wind.z * 1.1 + sway.z * 0.31 + sway.w * 0.23 ) +
	sway.x * wind.y * ( 0.3 + 0.7 * sin( wind.z * 1.9 + sway.z * 1.1 + sway.w * 0.4 ) + 0.3 * sin( wind.z * 1.2 + sway.z * 0.5 - sway.w * 0.6 ) ) );
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;
`
// Water, in the same place. The top of every cube of it rises and falls, in waves that travel. Two cubes side by side
// have the corners between them in the same place, and so at the same height: the surface stays in one piece, with no
// step from one cube to the next. Here the wind is only how high the waves are, and the time.
const WAVES = /* glsl */ `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
if ( position.y > 0.0 ) mvPosition.y += wind.x * sin( wind.z * 1.4 + mvPosition.x * 0.9 + mvPosition.z * 0.6 );
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;
`
/**
 * How far the wind moves something that gives `give`, `rise` above its ground, at (x, z): the same sum the shader does,
 * for whoever sits on a tree top and has to go along with it.
 * @param wind how strong it is in calm air, how strong the waves are, and the time
 * @returns how far in x and in z
 */
export function blown(wind: Vector3, give: number, rise: number, x: number, z: number) {
  const calm = Math.min(give, 0.15) * wind.x * Math.sin(wind.z * 1.1 + x * 0.31 + z * 0.23)
  const waves = give * wind.y * (0.3 + 0.7 * Math.sin(wind.z * 1.9 + x * 1.1 + z * 0.4) + 0.3 * Math.sin(wind.z * 1.2 + x * 0.5 - z * 0.6))
  const push = Math.max(rise, 0) * (calm + waves)
  return [-0.97 * push, 0.24 * push]
}
const _m = new Matrix4()
const _p = new Vector3()
const _q = new Quaternion()
const _s = new Vector3()
const _e = new Euler()
const _c = new Color()

/** A pool of upright cubes that pop in and out on a spring and fade between colours. */
export class Cubes {
  readonly mesh: InstancedMesh
  /** Whatever each cube belongs to; the game decides what the numbers mean. */
  readonly owner: Int32Array
  count = 0
  private box: Float32Array // x y z sx sy sz
  private k: Float32Array // current scale, 0..1 and a little beyond
  private v: Float32Array
  private goal: Float32Array
  private wait: Float32Array
  private rgb: Float32Array
  private to: Float32Array
  private bend: Float32Array // how far it leans in x and z for every unit of height, and the height of the ground it stands on
  private sway?: InstancedBufferAttribute
  /** The wind its cubes move in, if they do: how strong it is in calm air, how strong its waves are, and the time. */
  readonly wind = { value: new Vector3() }

  /**
   * @param moves what the wind does to its cubes: with 'wind' some of them can be told to bend in it (see `bendy`);
   * 'waves' is for water, whose surface rises and falls
   */
  constructor(capacity: number, material: Material, moves?: 'wind' | 'waves') {
    this.mesh = new InstancedMesh(moves === 'wind' ? unit.clone() : unit, material, capacity)
    if (moves) {
      const patch: Material['onBeforeCompile'] = (shader) => {
        shader.uniforms.wind = this.wind
        shader.vertexShader = shader.vertexShader.replace('#include <common>', `${moves === 'wind' ? 'attribute vec4 sway;\n' : ''}uniform vec3 wind;\n#include <common>`).replace('#include <project_vertex>', moves === 'wind' ? WIND : WAVES)
      }
      Object.assign(material, { onBeforeCompile: patch, customProgramCacheKey: () => moves })
      if (moves === 'wind') {
        this.sway = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4)
        this.mesh.geometry.setAttribute('sway', this.sway)
        // Shadows are drawn with a material of their own, and bend the same way.
        this.mesh.customDepthMaterial = Object.assign(new MeshDepthMaterial(), { onBeforeCompile: patch, customProgramCacheKey: () => moves })
      }
    }
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    this.mesh.count = 0
    this.mesh.frustumCulled = false
    this.mesh.boundingSphere = new Sphere(new Vector3(), 80)
    this.mesh.castShadow = this.mesh.receiveShadow = true
    this.owner = new Int32Array(capacity).fill(-1)
    this.box = new Float32Array(capacity * 6)
    this.k = new Float32Array(capacity)
    this.v = new Float32Array(capacity)
    this.goal = new Float32Array(capacity)
    this.wait = new Float32Array(capacity)
    this.rgb = new Float32Array(capacity * 3)
    this.to = new Float32Array(capacity * 3)
    this.bend = new Float32Array(capacity * 3)
  }

  /** @returns the index of the new cube. (x, y, z) is its centre. */
  add(x: number, y: number, z: number, sx: number, sy: number, sz: number, color: number, owner = -1, shown = true) {
    const i = this.count++
    this.mesh.count = this.count
    this.box.set([x, y, z, sx, sy, sz], i * 6)
    this.k[i] = this.goal[i] = shown ? 1 : 0
    this.owner[i] = owner
    _c.set(color).toArray(this.rgb, i * 3)
    this.to.set(this.rgb.subarray(i * 3, i * 3 + 3), i * 3)
    this.mesh.setColorAt(i, _c)
    dirty(this.mesh.instanceColor!, i * 3, 3)
    this.write(i)
    return i
  }

  private write(i: number) {
    const b = this.box
    const k = this.k[i]
    _m.makeScale(b[i * 6 + 3] * k, b[i * 6 + 4] * k, b[i * 6 + 5] * k).setPosition(b[i * 6], b[i * 6 + 1], b[i * 6 + 2])
    const hx = this.bend[i * 3]
    const hz = this.bend[i * 3 + 1]
    if (hx || hz) {
      // Leaning: sheared about the ground it stands on, so that its foot stays put and its top goes with the lean.
      const e = _m.elements
      const up = b[i * 6 + 1] - this.bend[i * 3 + 2]
      e[4] = hx * b[i * 6 + 4] * k
      e[6] = hz * b[i * 6 + 4] * k
      e[12] += hx * up
      e[14] += hz * up
    }
    this.mesh.setMatrixAt(i, _m)
    dirty(this.mesh.instanceMatrix, i * 16, 16)
  }

  show(i: number, wait = 0) {
    this.goal[i] = 1
    this.wait[i] = wait
  }
  hide(i: number, wait = 0) {
    this.goal[i] = 0
    this.wait[i] = wait
  }
  /** A little jolt: the cube bulges and springs back. */
  poke(i: number, amount = 5) {
    if (this.goal[i]) this.v[i] += amount
  }
  /** @param gain above 1 makes the colour bright enough to glow */
  paint(i: number, color: number, gain = 1) {
    _c.set(color).multiplyScalar(gain).toArray(this.to, i * 3)
  }
  place(i: number, x: number, y: number, z: number) {
    const o = i * 6
    this.box[o] = x
    this.box[o + 1] = y
    this.box[o + 2] = z
    this.write(i)
  }
  /** A new size for it, about the middle it has. */
  size(i: number, sx: number, sy: number, sz: number) {
    const o = i * 6 + 3
    this.box[o] = sx
    this.box[o + 1] = sy
    this.box[o + 2] = sz
    this.write(i)
  }
  top(i: number) {
    return this.box[i * 6 + 1] + this.box[i * 6 + 4] / 2
  }
  /** Whether it is there, or on its way in. */
  on(i: number) {
    return this.goal[i] > 0
  }
  /** Whether it has come in: there to be seen, not only on its way. */
  up(i: number) {
    return this.k[i] > 0.5
  }
  /** Its box: x, y, z of its middle, then width, height and depth. */
  at(i: number) {
    return this.box.subarray(i * 6, i * 6 + 6)
  }
  /** It leans: by `hx` and `hz` for every unit of height above `ground`. */
  lean(i: number, hx: number, hz: number, ground: number) {
    this.bend.set([hx, hz, ground], i * 3)
    this.write(i)
  }
  /**
   * It bends in the wind from now on.
   * @param give how much: 1 for grass, a good deal less for a tree
   * @param ground the height it stands on: what is at that height stays put, and the rest goes the further the higher it is
   * @param x where the waves of the wind reach it; the same place for every cube of something that should bend in one piece
   */
  bendy(i: number, give: number, ground: number, x: number, z: number) {
    if (!this.sway) return
    this.sway.setXYZW(i, give, ground, x, z)
    dirty(this.sway, i * 4, 4)
  }
  /** Everything jumps to where it was going, with no spring and no fade: for a world put back together in one go. */
  settle() {
    for (let i = 0; i < this.count; i++) {
      this.wait[i] = this.v[i] = 0
      this.k[i] = this.goal[i]
      this.rgb.set(this.to.subarray(i * 3, i * 3 + 3), i * 3)
      this.mesh.setColorAt(i, _c.fromArray(this.rgb, i * 3))
      this.write(i)
    }
    if (this.count) dirty(this.mesh.instanceColor!, 0, this.count * 3)
  }
  /** A cube that is there goes away at once and springs back in after a wait: for a world that puts itself together. */
  drop(i: number, wait: number) {
    if (!this.goal[i]) return
    this.k[i] = this.v[i] = 0
    this.wait[i] = wait
    this.write(i)
  }

  update(dt: number) {
    const { k, v, goal, wait, rgb, to } = this
    for (let i = 0; i < this.count; i++) {
      if (wait[i] > 0) {
        wait[i] -= dt
        continue
      }
      const d = goal[i] - k[i]
      if (Math.abs(d) > 0.002 || Math.abs(v[i]) > 0.02) {
        v[i] += (d * 190 - v[i] * 15) * dt
        k[i] += v[i] * dt
        if (!goal[i] && k[i] < 0.03) k[i] = v[i] = 0
        this.write(i)
      }
      const o = i * 3
      if (rgb[o] === to[o] && rgb[o + 1] === to[o + 1] && rgb[o + 2] === to[o + 2]) continue
      for (let c = o; c < o + 3; c++) rgb[c] = Math.abs(to[c] - rgb[c]) < 0.004 ? to[c] : rgb[c] + (to[c] - rgb[c]) * Math.min(1, dt * 3.5)
      this.mesh.setColorAt(i, _c.fromArray(rgb, o))
      dirty(this.mesh.instanceColor!, o, 3)
    }
  }
}

const STRIDE = 12 // x y z vx vy vz size life floor bounce spin gravity

/** Loose little cubes that fly, fall and vanish: rubble, rain, splashes, petals, snow, steam. */
export class Bits {
  readonly mesh: InstancedMesh
  private n: number
  private next = 0
  private d: Float32Array
  /** No new ones for now. */
  off = false
  constructor(n: number) {
    this.n = n
    this.mesh = new InstancedMesh(unit, new MeshStandardMaterial({ roughness: 0.9 }), n)
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.mesh.castShadow = true
    this.d = new Float32Array(n * STRIDE)
    for (let i = 0; i < n; i++) this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0))
    this.mesh.setColorAt(0, _c.set(0xffffff))
  }

  /**
   * @param floor height at which it lands
   * @param bounce 0 = vanish on landing
   * @param gravity pull downwards; a little for snow and petals, below zero for steam and sparks
   * @param gain above 1 makes it bright enough to glow: fireflies, sparks
   */
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, color: number, life: number, floor: number, bounce = 0.35, gravity = 22, gain = 1) {
    if (this.off) return
    const i = this.next
    this.next = (i + 1) % this.n
    this.d.set([x, y, z, vx, vy, vz, size, life, floor, bounce, Math.random() * 6, gravity], i * STRIDE)
    this.mesh.setColorAt(i, _c.set(color).multiplyScalar(gain))
    this.mesh.instanceColor!.needsUpdate = true
  }

  update(dt: number) {
    const d = this.d
    let moved = false
    for (let i = 0; i < this.n; i++) {
      const o = i * STRIDE
      if (d[o + 7] <= 0) continue
      moved = true
      d[o + 7] -= dt
      d[o + 4] -= d[o + 11] * dt
      d[o] += d[o + 3] * dt
      d[o + 1] += d[o + 4] * dt
      d[o + 2] += d[o + 5] * dt
      if (d[o + 1] < d[o + 8]) {
        if (d[o + 9] > 0) {
          d[o + 1] = d[o + 8]
          d[o + 4] *= -d[o + 9]
          d[o + 3] *= 0.6
          d[o + 5] *= 0.6
        } else d[o + 7] = 0
      }
      const size = d[o + 7] <= 0 ? 0 : d[o + 6] * Math.min(1, d[o + 7] * 4)
      const spin = d[o + 10] + d[o + 7] * 5
      _m.compose(_p.set(d[o], d[o + 1], d[o + 2]), _q.setFromEuler(_e.set(spin, spin * 0.7, 0)), _s.setScalar(size))
      this.mesh.setMatrixAt(i, _m)
    }
    if (moved) this.mesh.instanceMatrix.needsUpdate = true // one that has just gone out is drawn once more, at no size
  }
}
