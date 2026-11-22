// The window a new sheep is dressed in: a very small island of the field's own kind (earth under grass, blades in the
// wind, a flower or two, a little tree, a stone, a toadstool), and the sheep on it; the sky and its clouds are the
// window's own, behind (`sheep.css`). The same sheep as in the field, drawn by the same code (`model.ts`), so what is dressed here is what lands
// there; and over it, now and then, the same thought bubble. It stands about as a sheep does (a hop, a nod, an ear
// that flicks), and hops when it is given something. The picture goes slowly all the way round it, so that every
// side of what it has on is seen; a drag turns it by hand. A plain small canvas, with none of the field's finish.
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { DirectionalLight, Group, HemisphereLight, MeshStandardMaterial, NeutralToneMapping } from 'three'
import { BARK, LEAF, NEVER, STONE, any, rnd } from '../basics.ts'
import { Bits, Cubes } from '../cubes.ts'
import type { Look } from './dress.ts'
import { BUBBLE, GLAD, LINES, SLOTS, clothe, limbs, pose, speak, type Body } from './model.ts'

const flat = () => 0 // the ground under the sheep: level
const GRASS = [0x8fd16b, 0x9fd872, 0xb4de6e]
const SOIL = 0xba936d
const WIDE = 1 // how far the little island reaches from its middle
const CLEAR = 0.62 // and how far from the middle nothing stands: that is the sheep's
// What the picture is fitted to: a ball round the island and the sheep on it, by its middle (how high) and its size.
// The camera looks at the middle of the ball from far enough off for all of the ball to be in the window, whatever
// the window's shape: so the island is in the middle of the window, with room all round it, from every side.
const MIDDLE = 0.5
const BALL = 1.5

/** The little island, the sheep on it, and its light. */
class Stand {
  readonly group = new Group()
  private land = new Cubes(160, new MeshStandardMaterial({ roughness: 0.9 }), 'wind')
  private cubes = new Cubes(SLOTS, new MeshStandardMaterial({ roughness: 0.95 }))
  private sheep: Body
  private glints = new Bits(8) // the small warm glints over a very old sheep
  private tree: number[] // the tree, and the bench that is there in its place for a very old sheep
  private bench: number[]
  private bubble: number[]
  private say = ''
  private said = 0
  private told = '' // what the bubble was last drawn as
  private turns = 0 // how many times it has been dressed: its bubbles take turns
  time = 0
  /** How far round the picture has been turned by hand. */
  spin = 0

  constructor(seed: number) {
    const { land } = this
    // The island: a round of half tiles, earth under grass, frayed a little at the edge, as the field's is.
    for (let j = -2; j <= 2; j++)
      for (let i = -2; i <= 2; i++) {
        const [x, z, t] = [i * 0.5, j * 0.5, i * 7 + j * 31 + 500]
        if (Math.hypot(x, z) + (rnd(t) - 0.5) * 0.3 > WIDE + 0.25) continue
        land.add(x, -0.245, z, 0.5, 0.25, 0.5, SOIL)
        land.add(x, -0.06, z, 0.5, 0.12, 0.5, GRASS[Math.floor(rnd(t + 1) * 3)])
        // What grows, away from the middle: blades that bend in the wind, and a flower here and there.
        const [gx, gz] = [x + rnd(t + 2) * 0.3 - 0.15, z + rnd(t + 3) * 0.3 - 0.15]
        if (Math.hypot(gx, gz) < CLEAR || rnd(t + 4) > 0.7) continue
        land.bendy(land.add(gx, 0.08, gz, 0.07, 0.16, 0.07, 0x7fca6c), 1, 0, gx, gz)
        if (rnd(t + 5) < 0.45) land.bendy(land.add(gx, 0.2, gz, 0.12, 0.1, 0.12, [0xfffaf0, 0xffd45c, 0xffc2d9, 0xc4a4f0, 0xff9a85][Math.floor(rnd(t + 6) * 5)]), 1, 0, gx, gz)
      }
    // A little tree in blossom behind it, a stone, and a toadstool.
    this.tree = [[0.2, 0.12, 0.4, BARK], [0.56, 0.42, 0.32, 0xffc2d9], [0.86, 0.28, 0.28, 0xffd9e6]].map(([y, wide, tall, ink]) => {
      const c = land.add(-0.72, y, -0.62, wide, tall, wide, ink)
      land.bendy(c, ink === BARK ? 0 : 0.07, 0, -0.72, -0.62)
      return c
    })
    // (Or, for a very old sheep, a small wooden bench: two legs, a seat, a back.)
    this.bench = [[-0.82, 0.07, -0.62, 0.05, 0.14, 0.14], [-0.5, 0.07, -0.62, 0.05, 0.14, 0.14], [-0.66, 0.165, -0.62, 0.42, 0.05, 0.18], [-0.66, 0.29, -0.7, 0.42, 0.1, 0.03]].map(([x, y, z, sx, sy, sz]) => land.add(x, y, z, sx, sy, sz, BARK, -1, false))
    land.add(0.78, 0.09, -0.6, 0.26, 0.18, 0.22, STONE[1])
    land.add(0.88, 0.22, -0.62, 0.14, 0.1, 0.12, STONE[2])
    land.add(0.8, 0.04, 0.62, 0.05, 0.08, 0.05, 0xfffaf0)
    land.add(0.8, 0.11, 0.62, 0.13, 0.06, 0.13, 0xff9a85)
    land.add(-0.86, 0.06, 0.52, 0.1, 0.12, 0.1, LEAF[0])
    this.bubble = [...BUBBLE, ...Array<number[]>(LINES).fill(BUBBLE[0])].map(([, , , sx, sy, sz, ink]) => land.add(0, -9, 0, sx, sy, sz, ink, -1, false))
    this.sheep = { s: 0.8 + 0.2 * rnd(seed * 7 + 2), x: 0, z: 0, y: 0, face: 0, state: 'idle', stride: 0, hop: 0, rush: 1, nod: 0, lie: 0, air: 0, wear: [], wool: 0, cubes: limbs(this.cubes, 0), mark: NaN, sized: -1 }
    // The light of the field's morning: a soft warm sun from the front, and a great deal of light from all round, so
    // that the dark of its face is warm and its shadow pale.
    const sun = new DirectionalLight(0xffe6c6, 1.9)
    sun.position.set(-2.5, 5, 4)
    sun.castShadow = true
    sun.shadow.mapSize.setScalar(1024)
    sun.shadow.radius = 5
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.04
    Object.assign(sun.shadow.camera, { near: 1, far: 14, left: -2.4, right: 2.4, top: 2.8, bottom: -2 })
    this.group.add(land.mesh, this.cubes.mesh, this.glints.mesh, sun, sun.target, new HemisphereLight(0xf2f6ff, 0xffe3d0, 1.75))
  }

  /** It is given a look, and gives a hop: so, that suits. And says so, the first time excepted. */
  dress(seed: number, look: Look) {
    clothe(this.cubes, this.sheep, seed, look)
    this.sheep.hop = GLAD
    for (const c of this.tree) if (look.elder) this.land.hide(c)
      else this.land.show(c)
    for (const c of this.bench) if (look.elder) this.land.show(c)
      else this.land.hide(c)
    if (this.turns++) [this.say, this.said] = [['heart', 'stars', 'smile', 'blush'][this.turns % 4], 1.8]
  }

  /** The picture is turned by hand, by so much. */
  turn(by: number) {
    this.spin += by
  }

  /** @param turn which way the picture is looked at from */
  update(dt: number, turn: number) {
    const { sheep, land } = this
    this.time += dt
    sheep.hop = Math.max(0, sheep.hop - dt)
    if (!sheep.hop && !sheep.old && this.time % 3.1 < dt) sheep.hop = GLAD // (a very old one keeps her feet on the ground)
    // Now and then its head goes down for a moment, as if there were grass. And now and then it is simply pleased.
    sheep.state = (this.time * 0.11) % 1 > 0.82 ? 'eat' : 'idle'
    sheep.nod += Math.max(-dt * 4, Math.min(dt * 4, (sheep.state === 'eat' ? 1 : 0) - sheep.nod))
    if (!this.said && this.time % 9 < dt) [this.say, this.said] = ['smile', 1.8]
    pose(this.cubes, sheep, this.time, 0, flat)
    // Its thought, over its head, facing whoever is looking.
    this.said = Math.max(0, this.said - dt)
    const say = this.said ? this.say : ''
    if (say) speak(land, this.bubble, say, say !== this.told, 0, sheep.y + 1.08 * sheep.s + 0.26 + 0.03 * Math.sin(this.time * 2), 0, (Math.round(turn / (Math.PI / 2)) % 4 + 4) % 4, 1.1 + 0.03 * Math.sin(this.time * 3))
    else if (this.told) for (const c of this.bubble) land.hide(c)
    this.told = say
    // Over a very old sheep, now and then, a small warm glint: here as in the field.
    if (sheep.old && Math.random() < dt * 0.9) this.glints.spawn(any() * 0.4, sheep.y + sheep.s + Math.random() * 0.2, any() * 0.4, 0, 0.25, 0, 0.06, 0xffe38a, 0.8, NEVER, 0, -0.15, 3)
    this.glints.update(dt)
    land.wind.value.set(0.1, 0.05, this.time)
    land.update(dt)
    this.cubes.update(dt)
  }

  dispose() {
    this.cubes.mesh.dispose()
    this.land.mesh.dispose()
    this.glints.mesh.dispose()
  }
}

function Scene({ stand }: { stand: Stand }) {
  useFrame(({ camera, size }, dt) => {
    // The picture goes slowly all the way round, beginning three quarters on to its face; and by hand as well.
    const turn = 0.6 + stand.time * 0.26 + stand.spin
    stand.update(Math.min(dt, 0.05), turn)
    // (From far enough off that the whole ball is in the window, by whichever of its width and height is the less;
    // and a little from above. It looks at the middle of the ball: so that is the middle of the window.)
    const narrow = Math.min(1, size.width / size.height)
    const far = (BALL * 1.12) / Math.sin(Math.atan(Math.tan(Math.PI / 12) * narrow))
    camera.position.set(Math.sin(turn) * far * 0.94, MIDDLE + far * 0.34, Math.cos(turn) * far * 0.94)
    camera.lookAt(0, MIDDLE, 0)
  })
  return <primitive object={stand.group} />
}

/** @param seed the sheep's own: it gives its size, and its wool until one is chosen. @param look what it has on */
export function Fitting({ seed, look }: { seed: number; look: Look }) {
  const stand = useMemo(() => new Stand(seed), [seed])
  const held = useRef<number | null>(null) // where a drag that turns the picture was last
  useEffect(() => () => stand.dispose(), [stand])
  useEffect(() => stand.dress(seed, look), [stand, seed, look])
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      // (Measured by its own size, and not by what is seen of it: the card it is in pops up from small, and a picture
      // measured in the middle of that stayed small, and in a corner.)
      resize={{ offsetSize: true }}
      camera={{ fov: 30, near: 0.5, far: 40, position: [3, 2.5, 4.3] }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => void (gl.toneMapping = NeutralToneMapping)}
      aria-hidden="true"
      onPointerDown={(event) => {
        held.current = event.clientX
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (held.current === null) return
        stand.turn(-(event.clientX - held.current) * 0.012)
        held.current = event.clientX
      }}
      onPointerUp={() => void (held.current = null)}
      onPointerCancel={() => void (held.current = null)}
    >
      <Scene stand={stand} />
    </Canvas>
  )
}
