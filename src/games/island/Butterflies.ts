import { BoxGeometry, Color, DynamicDrawUsage, Euler, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three'

const WINGS = [0xffc2d9, 0xc4a4f0, 0xffd45c, 0x86b6f5, 0xffa552, 0xb5e0c4, 0xff9a85]
const BODY = 0x6b5a5a
const SIZE = 1.5

const _m = new Matrix4()
const _wing = new Matrix4()
const _hinge = new Matrix4()
const _p = new Vector3()
const _next = new Vector3()
const _q = new Quaternion()
const _e = new Euler()
const _s = new Vector3()

/** A few voxel butterflies that keep whatever the camera is looking at company. */
export class Butterflies {
  readonly mesh = new InstancedMesh(new BoxGeometry(), new MeshStandardMaterial({ roughness: 0.9 }), WINGS.length * 3)
  private centre = new Vector3()

  constructor() {
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    this.mesh.castShadow = true
    this.mesh.frustumCulled = false
    WINGS.forEach((wing, b) => {
      this.mesh.setColorAt(b * 3, new Color(BODY))
      this.mesh.setColorAt(b * 3 + 1, new Color(wing))
      this.mesh.setColorAt(b * 3 + 2, new Color(wing))
    })
  }

  /** Where butterfly b is at time t: a slow, lopsided loop around the centre. */
  private at(b: number, t: number, radius: number, out: Vector3) {
    const k = b * 2.399
    return out.set(
      this.centre.x + Math.cos(t * (0.21 + b * 0.017) + k) * radius * (0.55 + 0.4 * Math.sin(k * 1.7)),
      this.centre.y + 2 + (b % 4) * 2.2 + Math.sin(t * 0.9 + k) * 1.4,
      this.centre.z + Math.sin(t * (0.17 + b * 0.013) + k * 1.3) * radius * (0.55 + 0.4 * Math.cos(k)),
    )
  }

  /**
   * @param focus the point the camera looks at
   * @param radius how far from it they may wander
   */
  update(time: number, dt: number, focus: Vector3, radius: number) {
    this.centre.lerp(focus, 1 - Math.exp(-dt * 1.2))
    for (let b = 0; b < WINGS.length; b++) {
      this.at(b, time, radius, _p)
      this.at(b, time + 0.1, radius, _next)
      _q.setFromEuler(_e.set(0, Math.atan2(_next.x - _p.x, _next.z - _p.z), 0))
      _m.compose(_p, _q, _s.setScalar(SIZE))
      this.mesh.setMatrixAt(b * 3, _wing.makeScale(0.18, 0.18, 0.6).premultiply(_m))
      const flap = 0.15 + 0.95 * Math.abs(Math.sin(time * 9 + b * 1.9))
      for (const side of [1, -1]) {
        // Each wing is a thin slab hinged on the body.
        _wing.makeScale(0.55, 0.07, 0.5).setPosition(side * 0.32, 0, 0)
        _wing.premultiply(_hinge.makeRotationZ(side * flap)).premultiply(_m)
        this.mesh.setMatrixAt(b * 3 + (side > 0 ? 1 : 2), _wing)
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }
}
