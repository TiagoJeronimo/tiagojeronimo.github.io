import {
  CanvasTexture, CircleGeometry, Color, DirectionalLight, Fog, Group, HemisphereLight, Mesh, MeshBasicMaterial,
  PMREMGenerator, Raycaster, ShadowMaterial, Vector2, Vector3,
  type PerspectiveCamera, type Scene, type WebGLRenderer, type WebGLRenderTarget,
} from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { BrickSet, glowMaterial, type Part, type Physics } from './bricks/BrickSet.ts'
import { Butterflies } from './Butterflies.ts'
import { assemble, SLAB, type Model } from './bricks/voxel.ts'
import { chapters, type Chapter } from './content.ts'
import { note, thump } from './sound.ts'
import { actions, CALM, scroll, ui } from './store.ts'

export const FOV = 30
const DEG = Math.PI / 180
const LAST = chapters.length - 1
const RING = 100 // radius of the circle the chapter models stand on, around the name
const GATHER = 60 // ...and the radius they close in to for the group photo at the end
const HOLD = 0.3 // share of each scroll stop the camera rests on a model before travelling on

const models = import.meta.glob<Model>('./sets/*.ts', { eager: true })

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (v: number) => v * v * (3 - 2 * v)
const mix = (a: number, b: number, t: number) => a + (b - a) * t

interface Pose {
  target: Vector3
  yaw: number
  pitch: number
  dist: number
  /** Where the subject sits on screen, as a shift from the centre in screen fractions (+x right, +y down). */
  cx: number
  cy: number
}
const newPose = (): Pose => ({ target: new Vector3(), yaw: 0, pitch: 0, dist: 1, cx: 0, cy: 0 })

let physics: Promise<Physics> | undefined
function loadPhysics() {
  return (physics ??= import('@dimforge/rapier3d-compat').then(async ({ default: R }) => {
    await R.init()
    const world = new R.World({ x: 0, y: -55, z: 0 })
    world.numSolverIterations = 2 // toy physics: a couple of thousand tumbling cubes matter more than accuracy
    world.createCollider(R.ColliderDesc.cuboid(4000, 2, 4000).setTranslation(0, -2, 0).setFriction(0.8))
    return { R, world, events: new R.EventQueue(true) }
  }))
}

function glow() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)')
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.35)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 256, 256)
  return new CanvasTexture(canvas)
}

const SAVE_DATA = (navigator as { connection?: { saveData?: boolean } }).connection?.saveData === true

const _v = new Vector3()
const CENTRE = new Vector2()

/** The whole 3D side of the site: models on a ring, a camera that follows the scroll, and the toy physics. */
export class World {
  /** Point the camera looks at: depth of field focuses here, and stays sharp for `focusRange` around it. */
  readonly focus = new Vector3()
  focusRange = 40

  private group = new Group()
  private sets: (BrickSet | undefined)[] = chapters.slice(0, LAST).map(() => undefined)
  private fine: number
  private key = new DirectionalLight(0xffe9cf, 3.3)
  private pool: Mesh
  private butterflies = new Butterflies()
  private bg = new Color()
  private colors = chapters.map((c) => new Color(c.bg))
  private fog = new Fog(0xffffff, 100, 600)
  private time = 0
  private built = chapters.map(() => 0)
  private gather = 0
  private a = newPose()
  private b = newPose()
  private camera?: PerspectiveCamera
  private raycaster = new Raycaster()
  private ndc = new Vector2(2, 2)
  private look = new Vector2()
  private mouse = false
  private hit = new Vector3()
  private active?: BrickSet
  private armed?: BrickSet
  private ph?: Physics
  private press?: { i: number; x: number; y: number; t: number }
  private drag?: { set: BrickSet; i: number; dist: number }
  /** The visitor's own view of the model in front of them: turned by dragging the background, zoomed by pinching. */
  private view = { yaw: 0, pitch: 0, zoom: 1, pan: new Vector3() }
  private turning?: { x: number; y: number }
  private css = ''
  private scene: Scene
  private environment: WebGLRenderTarget

  /** @param fine 3 for cube voxels a third of a stud across, 1 for the coarse models as drawn (slow devices) */
  constructor(scene: Scene, gl: WebGLRenderer, fine: number) {
    this.scene = scene
    this.fine = fine
    this.set(0) // the name is on screen from the first frame; the rest are built one per frame after it

    const { key } = this
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.05
    key.shadow.camera.near = 1
    key.shadow.camera.far = 600
    key.shadow.radius = 5
    this.group.add(key, key.target, new HemisphereLight(0xe6efff, 0xffd9c4, 1.25))

    // The floor only shows shadows, so the page colour is the backdrop.
    const floor = new Mesh(new CircleGeometry(4000, 48), new ShadowMaterial({ color: 0x6d4a7a, opacity: 0.3 }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.pool = new Mesh(
      new CircleGeometry(1, 48),
      new MeshBasicMaterial({ map: glow(), transparent: true, depthWrite: false, opacity: 0.5 }),
    )
    this.pool.rotation.x = -Math.PI / 2
    this.pool.position.y = 0.02
    this.group.add(floor, this.pool, this.butterflies.mesh)

    const pmrem = new PMREMGenerator(gl)
    this.environment = pmrem.fromScene(new RoomEnvironment(), 0.04)
    pmrem.dispose()
    scene.environment = this.environment.texture
    scene.environmentIntensity = 0.35
    scene.background = this.bg
    scene.fog = this.fog
    scene.add(this.group)

    actions.smash = () => {
      const set = this.active
      if (set)
        this.withPhysics((ph) => {
          if (this.active !== set) return
          this.take(set, ph)
          set.smash(_v.set(set.origin.x, set.size.y * 0.25, set.origin.z))
          thump()
        })
    }
    actions.rebuild = () => this.armed?.rebuild(this.time)

    addEventListener('pointermove', this.onMove)
    addEventListener('pointerdown', this.onDown)
    addEventListener('pointerup', this.onUp)
    addEventListener('pointercancel', this.onCancel)
    addEventListener('wheel', this.onWheel, { passive: false })
  }

  /** The model of chapter k, built the first time it is asked for. */
  private set(k: number) {
    const made = this.sets[k]
    if (made) return made
    const { fine } = this
    const grid = (id: string, slab: Chapter['slab'] | null = ['brown', 'mediumNougat']) => assemble(models[`./sets/${id}.ts`], slab, fine)
    const angle = ((k - 1) * 2 * Math.PI) / (LAST - 1)
    // The figure stands on the name's ground, next to the sign.
    const parts: Part[] =
      k === 0
        ? [{ grid: grid('name') }, { grid: grid('figure', null), at: [34 * fine, SLAB + 1, 6 * fine] }]
        : [{ grid: grid(chapters[k].set, chapters[k].slab) }]
    const origin = k === 0 ? new Vector3() : new Vector3(RING * Math.sin(angle), 0, -RING * Math.cos(angle))
    const set = (this.sets[k] = new BrickSet(parts, origin, k === 0 ? 0 : -angle))
    this.group.add(set.group)
    this.gather = -1 // place it for the group photo if that is where we are
    return set
  }

  dispose() {
    removeEventListener('pointermove', this.onMove)
    removeEventListener('pointerdown', this.onDown)
    removeEventListener('pointerup', this.onUp)
    removeEventListener('pointercancel', this.onCancel)
    removeEventListener('wheel', this.onWheel)
    this.armed?.disarm(this.time)
    for (const set of this.sets) set?.dispose()
    this.environment.dispose()
    this.scene.remove(this.group)
    this.scene.environment = this.scene.background = this.scene.fog = null
    document.body.style.cursor = ''
  }

  private withPhysics(run: (ph: Physics) => void) {
    if (this.ph) run(this.ph)
    else void loadPhysics().then((ph) => run((this.ph = ph)))
  }

  /** Make `set` the one the physics engine knows about. */
  private take(set: BrickSet, ph: Physics) {
    if (this.armed === set) return
    this.armed?.disarm(this.time)
    set.arm(ph)
    this.armed = set
  }

  private aim(e: PointerEvent) {
    this.ndc.set((e.clientX / innerWidth) * 2 - 1, 1 - (e.clientY / innerHeight) * 2)
    this.mouse = e.pointerType === 'mouse'
  }

  private onMove = (e: PointerEvent) => {
    this.aim(e)
    const { turning, view } = this
    if (!turning) return
    view.yaw = Math.min(Math.max(view.yaw - (e.clientX - turning.x) * 0.006, -Math.PI), Math.PI)
    view.pitch = Math.min(Math.max(view.pitch + (e.clientY - turning.y) * 0.004, -0.35), 0.75)
    turning.x = e.clientX
    turning.y = e.clientY
  }

  // Pinching (which arrives as a wheel event with ctrl held) zooms in on the model instead of zooming the page.
  private onWheel = (e: WheelEvent) => {
    const { view, active, camera } = this
    if (!e.ctrlKey || !active || !camera) return
    e.preventDefault()
    const before = view.zoom
    const after = (view.zoom = Math.min(Math.max(before * Math.exp(-e.deltaY * 0.012), 1), 3))
    if (after > before) {
      // Zoom towards whatever is under the cursor: the model, or failing that the ground.
      this.raycaster.setFromCamera(this.ndc, camera)
      const { origin, direction } = this.raycaster.ray
      const reach = active.pick(this.raycaster.ray, this.hit) >= 0 ? this.hit.x : direction.y < -0.01 ? -origin.y / direction.y : -1
      if (reach > 0) view.pan.add(_v.copy(direction).multiplyScalar(reach).add(origin).sub(this.focus).multiplyScalar(1 - before / after))
    } else if (before > 1) view.pan.multiplyScalar((after - 1) / (before - 1)) // and drift back to the middle on the way out
  }

  private onDown = (e: PointerEvent) => {
    const set = this.active
    const on = e.target as Element
    if (e.button !== 0 || !set || !this.camera || on.closest?.('a, button')) return
    this.aim(e)
    this.raycaster.setFromCamera(this.ndc, this.camera)
    const i = set.pick(this.raycaster.ray, this.hit)
    if (i < 0) {
      // Dragging the background turns the model. Not from the text, which stays selectable.
      if (this.mouse && !on.closest?.('.card')) {
        e.preventDefault()
        this.turning = { x: e.clientX, y: e.clientY }
      }
      return
    }
    e.preventDefault() // keeps a drag from selecting the text
    this.press = { i, x: e.clientX, y: e.clientY, t: performance.now() }
    if (this.mouse)
      this.withPhysics((ph) => {
        if (this.active !== set || !this.press) return
        this.take(set, ph)
        set.free(i)
        this.drag = { set, i, dist: this.hit.x - 1.5 }
      })
  }

  // The page started scrolling under the finger: not a tap.
  private onCancel = () => {
    this.press = this.drag = this.turning = undefined
  }

  private onUp = (e: PointerEvent) => {
    const { press } = this
    this.press = this.drag = this.turning = undefined
    if (!press || Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8 || performance.now() - press.t > 350) return
    // A tap or click pops the block and its neighbours out.
    const set = this.active
    if (set)
      this.withPhysics((ph) => {
        if (this.active !== set) return
        this.take(set, ph)
        set.burst(press.i)
      })
  }

  /** Camera pose for a chapter, fitted to the screen shape. */
  private pose(k: number, aspect: number, out: Pose) {
    const wide = aspect > 1
    const tan = Math.tan((FOV / 2) * DEG)
    let halfW: number
    let halfH: number
    let fw: number
    let fh: number
    if (k === LAST) {
      // The group photo: everything at once, after one full turn around the ring.
      out.yaw = -2 * Math.PI
      out.pitch = 25 * DEG
      out.target.set(0, 4, 0)
      halfW = GATHER + 20
      halfH = ((2 * GATHER + 28) * Math.sin(out.pitch) + 22 * Math.cos(out.pitch)) / 2
      ;[fw, fh, out.cx, out.cy] = wide ? [0.94, 0.56, 0, 0.03] : [1.5, 0.36, 0, 0.09]
    } else {
      const set = this.set(k)
      const { az = -24, el = 27 } = chapters[k].view ?? {}
      const { x, y, z } = set.size
      out.yaw = set.rotY + az * DEG
      out.pitch = el * DEG
      out.target.set(set.origin.x, y * 0.42, set.origin.z)
      const sin = Math.abs(Math.sin(az * DEG))
      const cos = Math.abs(Math.cos(az * DEG))
      halfW = (x * cos + z * sin) / 2
      halfH = (y * Math.cos(out.pitch) + (x * sin + z * cos) * Math.sin(out.pitch)) / 2
      if (k === 0) [fw, fh, out.cx, out.cy] = wide ? [0.7, 0.5, 0, -0.1] : [0.96, 0.36, 0, -0.1]
      else [fw, fh, out.cx, out.cy] = wide ? [0.56, 0.74, 0.21, -0.01] : [0.96, 0.45, 0, -0.16]
    }
    out.dist = Math.max(halfW / (tan * aspect * fw), halfH / (tan * fh))
  }

  update(dt: number, camera: PerspectiveCamera, width: number, height: number) {
    this.camera = camera
    const time = (this.time += dt)
    const s = scroll.s
    const i = Math.min(Math.floor(s), LAST - 1)
    const f = s - i

    // The name builds itself on load, every other model as you scroll towards it.
    // Progress follows the scroll but never faster than a full build in ~2 s, so a quick scroll still shows the drop.
    const missing = this.sets.findIndex((set) => !set)
    if (missing > 0) this.set(missing)
    this.sets.forEach((set, k) => {
      if (!set) return
      const goal = k === 0 ? (CALM || time > 0.5 ? 1 : 0) : clamp01((s - k + 0.6) / 0.5)
      const step = CALM ? 1 : dt / (k === 0 ? 2.8 : 2)
      this.built[k] += Math.min(Math.max(goal - this.built[k], -step * 2), step)
      set.update(this.built[k], time)
      if (set.landed >= 0) {
        note(set.landed)
        set.landed = -1
      }
    })

    // For the last stop the models close in around the name and turn to face the camera.
    const gather = i === LAST - 1 ? smooth(clamp01((f - HOLD) / (1 - HOLD))) : 0
    if (gather !== this.gather) {
      this.gather = gather
      const step = (2 * Math.PI) / (LAST - 1)
      for (let k = 1; k < LAST; k++) {
        const from = (k - 1) * step
        const angle = from + gather * step * 0.5
        const radius = mix(RING, GATHER, gather)
        this.sets[k]?.moveTo(_v.set(radius * Math.sin(angle), 0, -radius * Math.cos(angle)), gather * (from > Math.PI ? from - 2 * Math.PI : from))
      }
    }

    // Which model can be played with right now.
    const nearest = Math.round(s)
    const candidate = this.sets[nearest === LAST ? 0 : nearest]
    this.active = Math.abs(s - nearest) < 0.3 && candidate?.ready ? candidate : undefined
    if (this.armed && this.armed !== this.active) {
      this.armed.disarm(time)
      this.armed = this.drag = undefined
    }
    // Fetch the physics engine in the background once the page has settled (not for visitors on data saver).
    if (!this.ph && time > 5 && !SAVE_DATA) this.withPhysics(() => {})

    // Camera: rest on a model, then travel to the next one.
    const t = smooth(clamp01((f - HOLD) / (1 - HOLD)))
    const { a, b } = this
    this.pose(i, width / height, a)
    this.pose(i + 1, width / height, b)
    this.look.lerp(this.mouse ? this.ndc : CENTRE, 1 - Math.exp(-dt * 3))
    const target = this.focus.lerpVectors(a.target, b.target, t).add(this.view.pan)
    // The visitor's own turn and zoom last while they stay on a chapter, and ease away when they move on.
    const { view } = this
    if (!this.active && !this.turning) {
      const ease = Math.exp(-dt * 5)
      view.yaw *= ease
      view.pitch *= ease
      view.zoom = 1 + (view.zoom - 1) * ease
      view.pan.multiplyScalar(ease)
    }
    scroll.zoom = view.zoom
    const dist = (mix(a.dist, b.dist, t) * (1 + 0.14 * Math.sin(Math.PI * t))) / view.zoom
    // At rest the camera drifts slowly from side to side, so every model shows more than one face.
    const sway = CALM || this.turning ? 0 : 1
    const yaw = mix(a.yaw, b.yaw, t) + view.yaw + sway * (this.look.x * 0.07 + Math.sin(time * 0.35) * 0.11)
    const pitch = Math.min(Math.max(mix(a.pitch, b.pitch, t) + view.pitch - sway * this.look.y * 0.035, 0.1), 1.25)
    camera.position.set(
      target.x + dist * Math.cos(pitch) * Math.sin(yaw),
      target.y + dist * Math.sin(pitch),
      target.z + dist * Math.cos(pitch) * Math.cos(yaw),
    )
    camera.lookAt(target)
    camera.setViewOffset(width, height, -mix(a.cx, b.cx, t) * width, -mix(a.cy, b.cy, t) * height, width, height)

    // The key light keeps its angle to the camera, so every model is lit the same way.
    const { key } = this
    key.position.set(target.x + Math.sin(yaw - 0.95) * 70, target.y + 95, target.z + Math.cos(yaw - 0.95) * 70)
    key.target.position.copy(target)
    const reach = Math.min(Math.max(dist * 0.5, 38), 190)
    const shadow = key.shadow.camera
    if (Math.abs(shadow.right - reach) > 0.5) {
      shadow.left = shadow.bottom = -reach
      shadow.right = shadow.top = reach
      shadow.updateProjectionMatrix()
    }
    this.pool.position.set(target.x, 0.02, target.z)
    this.pool.scale.setScalar(dist * 0.75)

    // Page colour follows the chapter.
    const blend = smooth(clamp01((f - 0.2) / 0.6))
    this.bg.copy(this.colors[i]).lerp(this.colors[i + 1], blend)
    this.fog.color.copy(this.bg)
    this.fog.near = dist * 1.5
    this.fog.far = dist * 8
    this.focusRange = dist * 0.62
    const css = `#${this.bg.getHexString()}`
    if (css !== this.css) {
      this.css = css
      const style = document.documentElement.style
      style.setProperty('--bg', css)
      style.setProperty('--accent', chapters[blend < 0.5 ? i : i + 1].accent)
    }

    // Toy physics.
    const { ph, armed, drag } = this
    if (ph && armed && armed.loose > 0) {
      const body = drag && drag.set === armed && armed.isLoose(drag.i) ? armed.bodies?.[drag.i] : undefined
      if (body) {
        this.raycaster.setFromCamera(this.ndc, camera)
        const { origin, direction } = this.raycaster.ray
        const p = body.translation()
        _v.copy(direction).multiplyScalar(drag!.dist).add(origin)
        _v.set(_v.x - p.x, Math.max(_v.y, 0.6) - p.y, _v.z - p.z).multiplyScalar(16).clampLength(0, 120)
        body.setLinvel(_v, true)
        const w = body.angvel()
        body.setAngvel({ x: w.x * 0.85, y: w.y * 0.85, z: w.z * 0.85 }, true)
      }
      ph.world.timestep = Math.min(dt, 1 / 30)
      ph.world.step(ph.events)
      ph.events.drainCollisionEvents((one, two, started) => started && armed.contact(one, two))
      armed.afterStep()
    }

    this.butterflies.update(CALM ? 0 : time, dt, target, Math.min(dist * 0.2, 26))

    // Screens, lamps and flames breathe a little.
    glowMaterial.color.setScalar(CALM ? 1 : 0.92 + 0.08 * Math.sin(time * 2.6))

    // Hover.
    let hover = -1
    if (this.active && this.mouse && !this.drag) {
      this.raycaster.setFromCamera(this.ndc, camera)
      hover = this.active.pick(this.raycaster.ray)
    }
    for (const set of this.sets) set?.highlight(set === this.active ? hover : -1)
    document.body.style.cursor = this.drag || this.turning ? 'grabbing' : hover >= 0 ? 'grab' : ''

    ui.set({ chapter: nearest, ready: !!this.active, loose: (this.armed?.loose ?? 0) > 0 })
  }
}
