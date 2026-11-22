// The camera for a game: a small land looked down on, held the way the island's is. The left button, or one finger,
// takes hold of the land and moves it; the right button, or shift, or a twist of two fingers, turns the world; the
// wheel, or a pinch, zooms, towards whatever is under the cursor. The keys do all three: W A S D or the arrows, Q and
// E, + and −. The castle uses it, and so should the next game: give it the canvas, the mesh there is to point at, and
// how far the land reaches.
//
// What the cursor is on is found on the land itself, and not on a flat floor under it: zooming in on a tower goes to
// the tower, and not through it to the grass behind. (The island has a camera of its own, older than this one, inside
// `Island.ts`: it goes along with what happens there, which this one has no need to. The two are held alike, and are
// not one piece of code.)
import { Plane, Raycaster, Vector2, Vector3, type Object3D, type PerspectiveCamera } from 'three'

const TILT = 0.72 // how steeply it looks down, from where it takes in the whole land
const NEAREST = 11 // how near it may come to what it looks at
const WIDE = 64 / 26 // from how far off the whole land is in the picture, for every unit it reaches from its middle
const TALL = 74 / 26 // and in a window that is as wide as it is high: further, the narrower the window
const UP = new Vector3(0, 1, 0)
const FLOOR = new Plane(UP, 0) // the floor the land lies on: what the cursor is on when it is on nothing of the land
/**
 * How close a camera is that stands `dist` from what it looks at: 0 from 34 away or more, 1 from 14 or less, evenly
 * between. (The island's measure, with the island's numbers: the two cameras come down, and go soft, alike.)
 */
export const close = (dist: number) => Math.min(1, Math.max(0, (34 - dist) / 20))
const page: { view: View | null } = { view: null }
/** The view there is on the page just now, if a game has made one: `Picture.tsx` asks it how close it is. */
export const viewing = () => page.view
const _p = new Vector3()
const _q = new Vector3()

export class View {
  yaw = 0.62
  zoom = 1
  /** Where it looks, from the middle of the land on the flat ground: across, and up when it has gone in on something high. */
  readonly pan = new Vector3()
  /** How close it is to what it looks at, from 0 (the whole land in the picture) to 1 (right up close): see `close`. */
  near = 0
  /** Which of the three ways of getting about have been used: m(ove), z(oom), t(urn). */
  known = ''
  private canvas: HTMLElement
  private land: Object3D
  private span: number
  private learnt: (known: string) => void
  private lift: number
  private pitch = TILT
  private far: number // from how far off this window sees the whole land
  private camera?: PerspectiveCamera
  private keys = new Set<string>()
  private fingers = new Map<number, number[]>()
  private press?: { x: number; y: number; last: number; moved: boolean; turn: boolean; grab: Vector3 | null }
  private level = new Plane(UP, 0) // level with whatever a drag took hold of: that is what stays under the cursor
  private ndc = new Vector2()
  private raycaster = new Raycaster()

  /**
   * @param land what there is to point at
   * @param span how far from its middle there is anything to see: the view is never moved further off than that
   * @param learnt told whenever one more of the three ways has been used, with all that have
   * @param lift how many pixels above the middle of the window the picture sits: for a page with buttons at its foot
   */
  constructor(canvas: HTMLElement, land: Object3D, span: number, learnt: (known: string) => void, lift = 0) {
    this.canvas = canvas
    this.land = land
    this.span = span
    this.learnt = learnt
    this.lift = lift
    this.far = span * WIDE
    page.view = this
    addEventListener('pointermove', this.onMove)
    addEventListener('pointerdown', this.onDown)
    addEventListener('pointerup', this.onUp)
    addEventListener('pointercancel', this.onUp)
    addEventListener('wheel', this.onWheel, { passive: false })
    addEventListener('contextmenu', this.onMenu)
    addEventListener('keydown', this.onKey)
    addEventListener('keyup', this.onKey)
    addEventListener('blur', this.onBlur)
  }
  dispose() {
    if (page.view === this) page.view = null
    removeEventListener('pointermove', this.onMove)
    removeEventListener('pointerdown', this.onDown)
    removeEventListener('pointerup', this.onUp)
    removeEventListener('pointercancel', this.onUp)
    removeEventListener('wheel', this.onWheel)
    removeEventListener('contextmenu', this.onMenu)
    removeEventListener('keydown', this.onKey)
    removeEventListener('keyup', this.onKey)
    removeEventListener('blur', this.onBlur)
  }

  private learn(way: string) {
    if (!this.known.includes(way)) this.learnt((this.known += way))
  }
  private aim(x: number, y: number) {
    this.ndc.set((x / innerWidth) * 2 - 1, 1 - (y / innerHeight) * 2)
  }
  /** What the cursor is on: a point of the land, or beside the land a point of the flat ground carried on. */
  private under(out: Vector3) {
    if (!this.camera) return null
    this.raycaster.setFromCamera(this.ndc, this.camera)
    const hit = this.raycaster.intersectObject(this.land)[0]
    return hit ? out.copy(hit.point) : this.raycaster.ray.intersectPlane(FLOOR, out)
  }
  private onDown = (e: PointerEvent) => {
    if ((e.button !== 0 && e.button !== 2) || e.target !== this.canvas) return // the buttons are not the world
    this.aim(e.clientX, e.clientY) // a tap on a touch screen arrives without any move before it
    this.fingers.set(e.pointerId, [e.clientX, e.clientY])
    const turn = e.button === 2 || e.shiftKey
    const grab = turn || this.fingers.size > 1 ? null : this.under(new Vector3())
    if (grab) this.level.constant = -grab.y
    this.press = { x: e.clientX, y: e.clientY, last: e.clientX, moved: this.fingers.size > 1, turn, grab }
  }
  private onMove = (e: PointerEvent) => {
    const { press } = this
    const finger = this.fingers.get(e.pointerId)
    if (finger && this.fingers.size === 2) {
      // Two fingers: a pinch zooms about the point between them, a twist turns the world.
      const other = [...this.fingers.values()].find((f) => f !== finger)!
      const apart = Math.hypot(finger[0] - other[0], finger[1] - other[1])
      const angle = Math.atan2(finger[1] - other[1], finger[0] - other[0])
      finger.splice(0, 2, e.clientX, e.clientY)
      this.aim((finger[0] + other[0]) / 2, (finger[1] + other[1]) / 2)
      this.zoomTo((this.zoom * Math.hypot(finger[0] - other[0], finger[1] - other[1])) / Math.max(apart, 1))
      const turn = Math.atan2(finger[1] - other[1], finger[0] - other[0]) - angle
      this.yaw += Math.atan2(Math.sin(turn), Math.cos(turn))
      if (Math.abs(turn) > 0.02) this.learn('t')
      return
    }
    finger?.splice(0, 2, e.clientX, e.clientY)
    this.aim(e.clientX, e.clientY)
    if (!press) return
    if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6) press.moved = true
    if (press.moved && press.turn) {
      this.yaw -= (e.clientX - press.last) * 0.006
      this.learn('t')
    }
    press.last = e.clientX
  }
  private onUp = (e: PointerEvent) => {
    this.fingers.delete(e.pointerId)
    this.press = undefined
  }
  private onWheel = (e: WheelEvent) => {
    if (e.target !== this.canvas) return
    e.preventDefault()
    this.aim(e.clientX, e.clientY)
    this.zoomTo(this.zoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0016)))
  }
  private onMenu = (e: Event) => {
    if (e.target === this.canvas) e.preventDefault()
  }
  private onKey = (e: KeyboardEvent) => {
    // A key typed into a box of text is a letter of what is being written there, and no business of the camera's.
    const box = e.target as Partial<HTMLElement> | null
    if (e.type === 'keydown' && (box?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(box?.tagName ?? ''))) return
    // A key pressed along with ⌘ or Ctrl is the browser's, and a Mac never says when such a key comes up again: it
    // does not count as held.
    if (e.type === 'keydown' && !e.metaKey && !e.ctrlKey && !e.altKey) this.keys.add(e.key.toLowerCase())
    else this.keys.delete(e.key.toLowerCase())
  }
  /** The window has lost the keyboard: whatever key was down is not heard coming up, so none is held any more. */
  private onBlur = () => this.keys.clear()
  /** Where the camera is: back from the point it looks at, and above it. */
  private eye(out: Vector3) {
    const dist = this.far / this.zoom
    const flat = Math.cos(this.pitch) * dist
    return out.set(Math.sin(this.yaw) * flat, 1 + Math.sin(this.pitch) * dist, Math.cos(this.yaw) * flat).add(this.pan)
  }
  /**
   * Zooming in goes towards whatever is under the cursor, which stays where it is on the screen; zooming all the way
   * out drifts home to the middle.
   * @param aimed false to zoom in on the middle of the view instead: for the keys
   */
  private zoomTo(zoom: number, aimed = true) {
    this.learn('z')
    zoom = Math.max(zoom, 0.7)
    const most = Math.max(1.2, this.far / NEAREST)
    if (zoom < this.zoom) this.pan.multiplyScalar((zoom - 0.7) / (this.zoom - 0.7))
    else if (aimed && this.under(_p)) {
      // The camera goes along its line to what the cursor is on, by as much of the way as was asked for, though no
      // nearer to it than it comes to anything; and the point it looks at stays ahead of it, where the zoom says. (So a
      // view left high up after a look at the keep, and as near as it goes, still comes down to the grass pointed at.)
      const eye = this.eye(_q)
      const off = eye.distanceTo(_p)
      eye.lerp(_p, Math.max(0, 1 - Math.max((this.zoom / zoom) * off, NEAREST) / off))
      this.zoom = Math.min(zoom, most)
      this.pan.add(eye.sub(this.eye(_p))).clampLength(0, this.span)
    }
    this.zoom = Math.min(zoom, most)
  }

  /** Every frame: what is held goes on moving the view, and the camera is put where the view says. */
  update(dt: number, camera: PerspectiveCamera, width: number, height: number) {
    this.camera = camera
    // What was taken hold of stays under the cursor: the view slides, level, by as much as the cursor has left it.
    if (this.press?.moved && this.press.grab) {
      this.raycaster.setFromCamera(this.ndc, camera)
      if (this.raycaster.ray.intersectPlane(this.level, _p)) {
        this.pan.add(_p.subVectors(this.press.grab, _p).setY(0))
        this.learn('m')
      }
    }
    const held = (a: string, b: string) => (this.keys.has(a) || this.keys.has(b) ? 1 : 0)
    const right = held('arrowright', 'd') - held('arrowleft', 'a')
    const ahead = held('arrowup', 'w') - held('arrowdown', 's')
    if (right || ahead) this.learn('m')
    const pace = (dt * this.far * 0.55) / this.zoom // the better part of a screen every second, at any zoom
    this.pan.x += (Math.cos(this.yaw) * right - Math.sin(this.yaw) * ahead) * pace
    this.pan.z += (-Math.sin(this.yaw) * right - Math.cos(this.yaw) * ahead) * pace
    this.pan.clampLength(0, this.span)
    const spin = held('e', 'e') - held('q', 'q')
    this.yaw += spin * dt * 2.2
    if (spin) this.learn('t')
    // And + and − zoom, about the middle of the view: where the cursor happens to lie has no say in what a key does.
    const closer = held('+', '=') - held('-', '_')
    if (closer) this.zoomTo(this.zoom * Math.exp(closer * dt * 1.1), false)

    // (The lift is a shift of the picture and not of the camera, so it is the same at every zoom, and a ray from the
    // cursor still goes where the cursor is.)
    if (camera.view?.fullWidth !== width || camera.view.fullHeight !== height) camera.setViewOffset(width, height, 0, this.lift, width, height)
    // From further off in a tall window, so that the whole land is in it. Up close the camera comes down for a look
    // from the side, as into a diorama.
    this.far = this.span * Math.max(WIDE, TALL / (width / height))
    const dist = this.far / this.zoom
    const near = (this.near = close(dist))
    this.pitch += (TILT - 0.17 * near * near * (3 - 2 * near) - this.pitch) * (1 - Math.exp(-dt * 5))
    this.eye(camera.position)
    camera.lookAt(this.pan.x, 1 + this.pan.y, this.pan.z)
    camera.updateMatrixWorld()
  }
}
