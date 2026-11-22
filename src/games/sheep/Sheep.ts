// The field: a small island of pastel cubes in the castle's manner. A meadow with a pond, a brook that comes down to it
// from the hills at the back, trees, rocks and a few things somebody left about; and the sheep of `flock.ts` going
// about it at a hop; and one more in a cave at the back of the mountain. A plain class, no React: it has a `group` for the scene, `update(dt)`, `shadows(tier)` and
// `dispose()`, and can be stepped in node. Sheep look and are the same for every visitor (they come from their seeds);
// only the walking is worked out on each machine, by `rnd` from a seed of the world's, so that a test can play it again.
//
// How a world here is to look and how its creatures are to move is written down in `../AGENTS.md` ("Look and
// movement"): this file follows it, and the castle, from which most of its recipes are taken.
import { CircleGeometry, Color, DirectionalLight, Group, HemisphereLight, Mesh, MeshStandardMaterial, PointLight, ShadowMaterial } from 'three'
import { BARK, BLOSSOM, LEAF, NEAR, NEVER, RING, STONE, WOOD, any, rnd, shade } from '../basics.ts'
import { Bits, Cubes } from '../cubes.ts'
import { FLOCK, RECLUSE, type Entry } from './flock.ts'

export const REACH = 18 // the land is on a board of 2 * REACH + 1 tiles each way; a tile is a unit
export const SPAN = 19 // how far from the middle there is anything to see (for `View`): small, so that a sheep is big
const N = 2 * REACH + 1
const ROUND = 16.4 // how far the island reaches from its middle, give or take a tile
const REGROW = 45 // seconds for a bitten tile to be long again (and up to 15 more)
const DAY = 360 // seconds for a whole day
const SLEEP = 0.9 // how dark it is when sheep lie down; they get up again at WAKE
const WAKE = 0.8
const HOP = 0.14 // how high a sheep of full size comes off the ground at every step,
const STEPS = 1.5 // how many such hops to a tile,
const GLAD = 0.5 // and how long a hop for joy lasts
const GRASS = [0x8fd16b, 0x9fd872, 0xb4de6e] // the castle's greens: a tile takes one by chance
const SHORT = 0xd6e8a4 // grass that has been eaten
const SOIL = 0xba936d
const STONY = 4 // from this high the mountain is bare stone, clean and grey: nothing green grows on it,
const SNOWY = 9 // and from this high there is snow
const POOL = 0x86cdf5
const BED = 0xb9a67e
const SNOW = 0xf6f3fa
const HAY = [0xf2d98a, 0xd9b95e]
const PETALS = [0xfffaf0, 0xffd45c, 0xffc2d9, 0xc4a4f0, 0xff9a85]
const WOOL = [0xfffaf0, 0xf7ecd9, 0xffd9e6, 0xe6dcf7, 0xd6f0e0, 0xd4e8fb, 0xfff0b8, 0xf9d9c4]
const FACE = 0x5f4f5a // a sheep's face, ears and legs
/** What `pick` says for the sheep in the cave, which is none of the flock's. */
export const HERMIT = -2
const NATURES = ['greedy', 'swimmer', 'nosy', 'follower'] as const
export type Nature = (typeof NATURES)[number]
const NOON = [new Color(0xffe9cf), new Color(0xcfe6f1)] // the sun and the sky by day,
const NIGHT = [new Color(0x8f9bd8), new Color(0x2f3560)] // and at night

const QUARTERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]]
/** They look one of four ways, as cubes do. For each quarter turn, what becomes of across and along: 0 looks along +z, 1 along +x. */
const TURNS = [[1, 0, 0, 1], [0, 1, -1, 0], [-1, 0, 0, -1], [0, -1, 1, 0]]
/** Which of the four ways is nearest to the way (dx, dz) goes. */
const turned = (dx: number, dz: number) => (Math.round(Math.atan2(dx, dz) / (Math.PI / 2)) + 4) % 4
const at = (x: number, z: number) => {
  const [i, j] = [Math.round(x), Math.round(z)]
  return Math.abs(i) > REACH || Math.abs(j) > REACH ? -1 : i + REACH + (j + REACH) * N
}
const across = (t: number) => (t % N) - REACH
const along = (t: number) => Math.floor(t / N) - REACH

// The water, by tile. The brook runs out of the rock of the mountain and down to the pond in a few bends; the pond is no square.
const BROOK = [[-3, -7], [-4, -7], [-4, -6], [-5, -6], [-5, -5], [-5, -4], [-5, -3], [-6, -3], [-6, -2], [-6, -1], [-6, 0], [-5, 0], [-5, 1], [-5, 2]]
const LAKE = [[-6, 3], [-5, 3], [-4, 3], [-7, 4], [-6, 4], [-5, 4], [-4, 4], [-3, 4], [-7, 5], [-6, 5], [-5, 5], [-4, 5], [-3, 5], [-2, 5], [-6, 6], [-5, 6], [-4, 6], [-3, 6], [-2, 6], [-5, 7], [-4, 7], [-3, 7]]
const DUCK = [-4.5, 5] // the middle of the pond, which the duck swims round: well away from any bank a sheep drinks at
// What somebody left about, by tile: a stretch of fence with two bales of hay behind it.
const FENCE = [[8, -2], [9, -2], [10, -2]]
const BALES = [[9, -3], [10, -3]]
// The cave, in the back of the mountain: four tiles, two across the mouth and two deep. Its floor, and the least rock over it.
const CAVE = [[0, -14], [1, -14], [0, -13], [1, -13]]
const FLOOR = 2
const ROOF = 5 // (over the hollow: a step less in places, and round it)

/**
 * The land, worked out once, as the castle's is. `LAND` is how high each tile stands (nothing, where there is none):
 * 1 on the meadow; a mountain at the back, which is a heap and not a wall: it goes up a step at a time from the grass
 * on every side, the back too; and a knoll. The steps are not even: a slow swell pushes them in and out, and every tile
 * has a little say of its own, so there are broad ledges in one place and a steep bank in another, and no face of
 * rock runs wide and flat. `ROCK` is where the mountain is bare stone. `KIND` is 1 for ground, 2 for the brook, 3 for
 * the pond and 4 for the cave. `FALLS` is where the brook goes over a step: where, from how high, to how low, and
 * which way.
 */
const LAND = new Float32Array(N * N)
const KIND = new Uint8Array(N * N)
const ROCK = new Uint8Array(N * N)
const BLOCK = new Uint8Array(N * N) // where something stands that no sheep may be over: a tree, a rock, a bale, reeds
const DEEP = new Uint8Array(N * N) // the tiles of the brook from which it goes down a step
const FALLS: number[][] = []
const TREES: number[][] = [] // tile, size, and whether it is in blossom
const ROCKS: number[] = []
const SHORE: number[][] = [] // where a sheep can drink: a dry tile, and the quarter turn that looks at the pond from it
/** Whether a corner of the pond's tile sticks out into the land. */
const juts = (x: number, z: number, i: number, j: number) => KIND[at(x + i, z)] !== 3 && KIND[at(x, z + j)] !== 3
/** And whether reeds grow in it. */
const reedy = (x: number, z: number, i: number, j: number) => juts(x, z, i, j) && rnd(at(x, z) * 37 + i + j * 3) < 0.45
{
  // The swell: chance at every sixth tile each way, and smoothly from one to the next between. From -1 to 1.
  const knot = (i: number, j: number) => rnd(i * 374761 + j * 668265 + 977)
  const swell = (x: number, z: number) => {
    const [i, j] = [Math.floor(x / 6), Math.floor(z / 6)]
    const [a, b] = [x / 6 - i, z / 6 - j].map((t) => t * t * (3 - 2 * t))
    return (knot(i, j) * (1 - a) * (1 - b) + knot(i + 1, j) * a * (1 - b) + knot(i, j + 1) * (1 - a) * b + knot(i + 1, j + 1) * a * b) * 2 - 1
  }
  const UP = [0, 0.8, 2.2, 3, 4.4, 5.2, 6.4, 7.2] // how far into the mountain each step up is: some ledges broad, some not
  for (let z = -REACH; z <= REACH; z++)
    for (let x = -REACH; x <= REACH; x++) {
      // (The edge is frayed, tile by tile: an island, not a plate.)
      if (Math.hypot(x * 0.94, z) + (rnd(x * 31 + z * 57 + 900) - 0.5) * 1.8 > ROUND) continue
      const t = at(x, z)
      const push = swell(x, z) * 1.9 + (rnd(x * 131 + z * 71 + 5) - 0.5) * 0.8
      // The mountain is a round heap well inside the edge, so that grass lies all round its foot. And in the meadow,
      // to the east, a knoll. (Both are high: a hill that is only a step up is not a hill.)
      const mount = 7.2 - Math.hypot(x * 0.75, (z + 9.5) * 1.1) + push * 0.8
      const knoll = Math.hypot(x - 10, (z - 8) * 1.2) + push * 0.35
      const high = 1 + UP.filter((edge) => mount > edge).length
      LAND[t] = Math.max(high, 1 + [3.4, 2.4, 1.5, 0.7].filter((edge) => knoll < edge).length)
      ROCK[t] = high >= STONY ? 1 : 0
      KIND[t] = 1
    }
  // (No tile out at sea by itself, or held on by one side only.)
  const lone = [...LAND.keys()].filter((t) => LAND[t] && [t + 1, t - 1, t + N, t - N].filter((n) => LAND[n]).length < 2)
  for (const t of lone) LAND[t] = KIND[t] = 0
  for (const [x, z] of [...FENCE, ...BALES]) LAND[at(x, z)] = 1
  // The brook runs out of the rock and down the mountain a step at a time: over a little fall wherever the ground
  // steps down, and never more than a step at once. It never runs uphill: where the ground would rise again it has cut
  // its way through.
  let level = LAND[at(BROOK[0][0], BROOK[0][1])]
  BROOK.forEach(([x, z], k) => {
    const t = at(x, z)
    const now = Math.max(level - 1, Math.min(level, LAND[t]))
    if (now < level) {
      FALLS.push([(x + BROOK[k - 1][0]) / 2, level, (z + BROOK[k - 1][1]) / 2, now, x - BROOK[k - 1][0], z - BROOK[k - 1][1]])
      DEEP[at(BROOK[k - 1][0], BROOK[k - 1][1])] = 1
    }
    LAND[t] = level = now
    KIND[t] = 2
  })
  for (const [x, z] of LAKE) {
    LAND[at(x, z)] = 1
    KIND[at(x, z)] = 3
  }
  // (Ground beside the water is never lower than the water is there: else it would hang in the air.)
  for (let t = 0; t < N * N; t++) if (KIND[t] > 1) for (const n of [t + 1, t - 1, t + N, t - N]) if (KIND[n] === 1 && LAND[n] < LAND[t]) [LAND[n], ROCK[n]] = [LAND[t], ROCK[n] || ROCK[t]] // (and rock, beside water in the rock)
  for (const [x, z] of [...FENCE, ...BALES]) BLOCK[at(x, z)] = 1
  // The cave: rock over it, behind it and on both sides, and in front of its mouth a low step of grass to look in from.
  for (let x = CAVE[0][0] - 1; x <= CAVE[0][0] + 2; x++)
    for (let z = CAVE[0][1] - 3; z <= CAVE[0][1] + 2; z++) {
      const t = at(x, z)
      const inside = CAVE.some(([i, j]) => i === x && j === z)
      if (z < CAVE[0][1]) {
        if (x === CAVE[0][0] - 1 || x === CAVE[0][0] + 2 || (!LAND[t] && z < CAVE[0][1] - 1)) continue
        LAND[t] = Math.min(LAND[t] || FLOOR, FLOOR)
        ROCK[t] = 0
        BLOCK[t] = 1 // (and no tree in the way)
      } else {
        // (The rock round the mouth is not one flat face: a step lower here, a step higher there.)
        LAND[t] = Math.max(LAND[t], ROOF - (inside ? (x + z) & 1 : 1))
        ROCK[t] = 1
      }
      KIND[t] = inside ? 4 : KIND[t] || 1
    }
  // Trees and rocks, by chance: a few in the meadow, more on the lower slopes, none by the water, no two trees side by
  // side. Rocks lie on the slopes, and one or two in the grass: none by the fence and the hay.
  const beside = (t: number, what: (n: number) => boolean) => [0, ...RING.map(([i, j]) => i + j * N)].some((d) => what(t + d))
  for (let t = 0; t < N * N; t++) {
    if (KIND[t] !== 1 || BLOCK[t] || beside(t, (n) => KIND[n] > 1)) continue
    const h = LAND[t]
    if (!ROCK[t] && rnd(t * 23 + 7) < (h === 1 ? 0.035 : 0.2) && !beside(t, (n) => TREES.some((tree) => tree[0] === n))) {
      TREES.push([t, 0.72 + rnd(t * 23 + 8) * 0.28, rnd(t * 23 + 9) < 0.34 ? 1 : 0])
      BLOCK[t] = 1
    } else if (!ROCK[t] && rnd(t * 29 + 3) < (h === 1 ? 0.012 : 0.16) && ![...FENCE, ...BALES].some(([x, z]) => Math.hypot(x - across(t), z - along(t)) < 3)) {
      ROCKS.push(t)
      BLOCK[t] = 1
    }
  }
  // (Over reeds no sheep puts its head.)
  for (const [x, z] of LAKE) if (QUARTERS.some(([i, j]) => reedy(x, z, i, j))) BLOCK[at(x, z)] = 1
  for (const [x, z] of LAKE) for (const [i, j] of NEAR) if (KIND[at(x + i, z + j)] === 1 && LAND[at(x + i, z + j)] === 1 && !BLOCK[at(x + i, z + j)]) SHORE.push([x + i, z + j, turned(-i, -j)])
}

// Things, as parts: where each box is from the thing's own middle (across, how high its foot is, along), its size, and
// its colour. A tree is the castle's: the middle of each box, how wide it is, and how tall.
type Part = number[]
const TRUNK = [[0.45, 0.28, 0.9], [1.275, 1, 0.75], [2, 0.68, 0.7]]
const BOULDER: Part[] = [[0.02, 0, -0.04, 0.66, 0.5, 0.6, STONE[1]], [0.1, 0.5, -0.06, 0.36, 0.26, 0.34, STONE[2]], [-0.42, 0, 0.26, 0.22, 0.2, 0.22, STONE[0]]]
const REEDS: Part[] = [[-0.07, 0, 0, 0.06, 0.6, 0.06, 0x7fa862], [-0.07, 0.6, 0, 0.1, 0.2, 0.1, BARK], [0.08, 0, 0.05, 0.06, 0.42, 0.06, 0x8db36c], [0.08, 0.42, 0.05, 0.1, 0.18, 0.1, BARK]]
const TOADSTOOL: Part[] = [[0, 0, 0, 0.06, 0.1, 0.06, 0xfffaf0], [0, 0.1, 0, 0.15, 0.07, 0.15, 0xff9a85]]
// (A bale is hay tied twice: five slices side by side, so that the ties are not inside the hay.)
const BALE: Part[] = [[-0.29, 0, 0, 0.22, 0.5, 0.6, HAY[0]], [-0.15, 0, 0, 0.06, 0.52, 0.62, HAY[1]], [0, 0, 0, 0.24, 0.5, 0.6, HAY[0]], [0.15, 0, 0, 0.06, 0.52, 0.62, HAY[1]], [0.29, 0, 0, 0.22, 0.5, 0.6, HAY[0]]]
// (A post, and two rails that run in front of it to the next tile's.)
const RAILS: Part[] = [[-0.42, 0, 0, 0.12, 0.5, 0.12, BARK], [0, 0.16, 0.09, 1, 0.07, 0.06, WOOD], [0, 0.34, 0.09, 1, 0.07, 0.06, WOOD]]
const DRAKE: Part[] = [[0, 0, 0, 0.2, 0.14, 0.3, 0xffd45c], [0, 0.14, 0.1, 0.13, 0.13, 0.13, 0xffd45c], [0, 0.18, 0.2, 0.07, 0.04, 0.08, 0xf5a742]]
/**
 * A sheep of full size, looking along. Few boxes, and each one something: four legs; one chunky box of wool; a short
 * tail; a big dark head set low, with a tuft of wool on it; two ears out sideways, low, as a lamb's; and a pink nose.
 * It has no eyes, on purpose: what it feels shows in how it moves. No box is inside another. `BODY` and `HEAD` are the
 * two rectangles of ground all of it stands over, as how far to each side, and from where to where along: the tail is
 * in the first, the ears and nose in the second.
 */
const EWE: Part[] = [
  [-0.18, 0, 0.24, 0.13, 0.2, 0.13, FACE], [0.18, 0, 0.24, 0.13, 0.2, 0.13, FACE], [-0.18, 0, -0.24, 0.13, 0.2, 0.13, FACE], [0.18, 0, -0.24, 0.13, 0.2, 0.13, FACE],
  [0, 0.2, 0, 0.66, 0.56, 0.8, 0], [0, 0.42, -0.45, 0.18, 0.16, 0.1, 0],
  [0, 0.34, 0.55, 0.4, 0.38, 0.3, FACE], [-0.25, 0.48, 0.52, 0.1, 0.08, 0.14, FACE], [0.25, 0.48, 0.52, 0.1, 0.08, 0.14, FACE],
  [0, 0.37, 0.715, 0.14, 0.09, 0.03, 0xffa8b8], [0, 0.72, 0.51, 0.3, 0.14, 0.22, 0],
]
const BODY = [0.33, -0.5, 0.4]
const HEAD = [0.31, 0.4, 0.75]
const NOSE = 0.56 // how far ahead of its middle the middle of its head is
const LEGS = 0.2 // how long its legs are
const BOW = 0.32 // how far its head goes down to the grass,
const TUCK = 0.31 // and how far when it lies asleep (its body goes down by its legs, and its head a little more)

type Ewe = {
  entry: Entry
  s: number // size, from 0.8 to 1
  nature: Nature
  x: number
  z: number
  base: number // how high the ground it stands on is: 1 in the field
  y: number // how high its feet are now: the ground, and whatever hop it is in
  face: number // which quarter turn it looks: see `TURNS`
  state: 'idle' | 'walk' | 'eat' | 'drink' | 'sleep'
  goal: 'wander' | 'graze' | 'drink' | 'wade' | 'follow' | 'nose'
  timer: number
  tx: number // where it is going,
  tz: number
  sideways: boolean // whether it goes across first and then along, or the other way about,
  want: number // and which way it is to look once there, or -1
  hunger: number
  thirst: number
  blocked: number // how many times running its way has been shut
  pace: number // how fast it likes to go,
  v: number // and how fast it is going
  stride: number // how far along its stride it is: it goes at a hop
  hop: number // how long it goes on jumping for joy
  wait: number // a moment's stop after a turn
  nod: number // how far its head is down, 0 to 1,
  lie: number // and how far it has lain down
  friend: Ewe | null // whom it is going up to
  wool: number
  cubes: number[] // one for each part of `EWE`
  rect: Float64Array // where it stands: two rectangles (body, head) as x0 x1 z0 z1
  mark: number // what it was last drawn as
  sized: number
}

export class Sheep {
  readonly group = new Group()
  readonly ground = new Cubes(5200, new MeshStandardMaterial({ roughness: 0.9 }), 'wind')
  readonly water = new Cubes(BROOK.length + LAKE.length, new MeshStandardMaterial({ roughness: 0.15, transparent: true, opacity: 0.72 }), 'waves')
  readonly flock: Cubes
  readonly bits = new Bits(240)
  readonly ewes: Ewe[] = []
  /** The colour of the sky, for the page to put behind everything. */
  readonly sky = new Color().copy(NOON[1])
  /** 0 by day, 1 at the dead of night. */
  dark = 0
  time = 0
  /** How many mouthfuls of grass there have been. */
  bites = 0
  private sun = new DirectionalLight(0xffe9cf, 3.2)
  private glow = new HemisphereLight(0xe6efff, 0xffd9c4, 1.25)
  private slab = new Int32Array(N * N).fill(-1) // the grass of each tile that can be eaten, and its own green,
  private green = new Int32Array(N * N)
  private blades = new Map<number, number[]>() // and what grows on it
  private fed = new Float32Array(N * N) // seconds until a bitten tile is long again; 0 if it is
  private eaten: number[] = []
  private pink: number[][] = [] // the tops of the trees in blossom, which shed petals
  private duck: number[] = []
  /** The sheep in the cave: small, at home, and going nowhere. It is none of `ewes`. */
  readonly hermit: Ewe
  private swum = 0
  private seed: number
  private scratch = new Float64Array(8)

  /** @param seed the same seed, the same wandering. @param list who is in the field */
  constructor(list: Entry[] = FLOCK, seed = 1) {
    this.seed = seed
    this.flock = new Cubes((list.length + 1) * EWE.length, new MeshStandardMaterial({ roughness: 0.95 }))
    this.build()
    list.forEach((entry) => this.arrive(entry))
    this.hermit = this.ewe(RECLUSE, HERMIT, 0.6, WOOL[0], CAVE[1][0], CAVE[1][1] + 0.05, 2)
    this.hermit.base = FLOOR
    this.draw(this.hermit)
    // The light: a low warm sun, a soft sky, and a floor that only shows the shadows that fall on it.
    const { sun } = this
    sun.position.set(-16, 30, 12)
    sun.castShadow = true
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.04
    this.shadows(0)
    Object.assign(sun.shadow.camera, { near: 1, far: 90, left: -24, right: 24, top: 24, bottom: -24 })
    const floor = new Mesh(new CircleGeometry(300, 32), new ShadowMaterial({ color: 0x6d4a7a, opacity: 0.25 }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.water.mesh.castShadow = false
    // (In the cave a lantern burns: its light is warm, and reaches no further than the mouth.)
    const lamp = new PointLight(0xffc27a, 7, 4.5, 1.4)
    lamp.position.set(CAVE[0][0] + 0.5, FLOOR + 0.9, CAVE[0][1] + 0.9)
    this.group.add(this.ground.mesh, this.water.mesh, this.flock.mesh, this.bits.mesh, sun, sun.target, this.glow, lamp, floor)
    this.update(0)
  }

  private chance() {
    return rnd(this.seed++)
  }

  /** The land and all that stands on it: under every tile a column of earth, and on it a slab of whatever lies on top. */
  private build() {
    const { ground, water } = this
    /** Boxes, put somewhere, at a size: see `Part`. */
    const put = (parts: Part[], x: number, y: number, z: number, s = 1, turn = 0) => {
      const [a, b, c, d] = TURNS[turn]
      return parts.map(([dx, dy, dz, sx, sy, sz, ink]) => ground.add(x + (a * dx + b * dz) * s, y + (dy + sy / 2) * s, z + (c * dx + d * dz) * s, (turn & 1 ? sz : sx) * s, sy * s, (turn & 1 ? sx : sz) * s, ink))
    }
    for (let t = 0; t < N * N; t++) {
      const h = LAND[t]
      if (!h) continue
      const [x, z] = [across(t), along(t)]
      if (KIND[t] === 2) {
        // The brook: the island's water, a whole tile of it to the tile, on a bed, nearly to the top. Where it goes
        // down a step the block is a whole cube, down to the water below: so it comes down the mountain as blocks of
        // water, one under the next, with no thin sheet of it and no shower of drops. (In the rock its bed is rock.)
        const deep = DEEP[t] ? 1 : 0.44
        ground.add(x, (h - deep - 0.16) / 2, z, 1, h - deep - 0.16, 1, ROCK[t] ? STONE[1] : SOIL)
        ground.add(x, h - deep - 0.11, z, 1, 0.1, 1, ROCK[t] ? STONE[0] : BED)
        water.add(x, h - 0.06 - deep / 2, z, 1, deep, 1, POOL)
        continue
      }
      if (KIND[t] === 3) {
        // The pond: the same water, a whole tile of it in a bed half a step deep. Its edges are whole tiles, as the
        // island's are: no small pieces of bank cut into its corners. It is round because its tiles are laid so. In
        // some of the corners that stick out into the land, reeds stand in the water, up from the bed.
        ground.add(x, (h - 0.6) / 2, z, 1, h - 0.6, 1, SOIL)
        ground.add(x, h - 0.55, z, 1, 0.1, 1, BED)
        water.add(x, h - 0.28, z, 1, 0.44, 1, POOL)
        for (const [i, j] of QUARTERS) {
          if (reedy(x, z, i, j)) put(REEDS, x + i * 0.3, h - 0.5, z + j * 0.3, 1.4).forEach((c) => ground.bendy(c, 0.5, h - 0.5, x, z))
        }
        continue
      }
      // Grass on the lower steps of the mountain, bare stone above them, and snow on the top. The stone is clean, and
      // lumpy: on many a tile a lump of rock or a loose stone, so that no step of it is a plain slab.
      const stone = ROCK[t] === 1
      if (KIND[t] === 4) {
        // The cave: a floor, a hollow, and the rock over it.
        ground.add(x, FLOOR / 2, z, 1, FLOOR, 1, STONE[1])
        ground.add(x, (FLOOR + 1.35 + h - 0.25) / 2, z, 1, h - 0.25 - FLOOR - 1.35, 1, STONE[1])
      } else ground.add(x, (h - 0.25) / 2, z, 1, h - 0.25, 1, stone ? STONE[1] : SOIL)
      const green = GRASS[Math.floor(rnd(t) * 3)]
      const white = stone && h >= SNOWY
      const top = ground.add(x, h - 0.125, z, 1, 0.25, 1, white ? SNOW : stone ? STONE[(x + z) & 1 ? 0 : 2] : green)
      if (stone) {
        const [lump, wide, tall] = [rnd(t * 41), 0.3 + rnd(t * 41 + 3) * 0.3, 0.16 + rnd(t * 41 + 4) * 0.3]
        if (lump < 0.45) ground.add(x + rnd(t * 41 + 1) * 0.3 - 0.15, h + tall / 2, z + rnd(t * 41 + 2) * 0.3 - 0.15, wide, tall, wide * 0.85, white ? SNOW : STONE[Math.floor(rnd(t * 41 + 5) * 3)])
        else if (lump < 0.7) ground.add(x + (rnd(t * 41 + 1) < 0.5 ? 0.3 : -0.3), h + 0.08, z + (rnd(t * 41 + 2) < 0.5 ? 0.3 : -0.3), 0.2, 0.16, 0.18, STONE[Math.floor(rnd(t * 41 + 5) * 3)])
        continue
      }
      // (At the foot of the rock, on the grass: what has come down from it. Nothing grows through that.)
      if (h > 1 && !BLOCK[t] && RING.some(([i, j]) => ROCK[at(x + i, z + j)]) && rnd(t * 53) < 0.55) {
        for (let k = 0; k < 2; k++) ground.add(x + (k ? 0.24 : -0.2) + rnd(t * 53 + k) * 0.1, h + 0.07 + k * 0.03, z + (rnd(t * 53 + 2 + k) < 0.5 ? 0.25 : -0.25), 0.2 + k * 0.08, 0.14 + k * 0.06, 0.2, STONE[(t + k) % 3])
        continue
      }
      const grazed = h === 1 && !BLOCK[t]
      if (grazed) {
        this.slab[t] = top
        this.green[t] = green
      }
      // What grows: grass that bends in the wind, and a flower here and there. (Not where something stands.)
      const grown: number[] = []
      for (let k = 0; k < 3; k++)
        if (rnd(t * 7 + k) < 0.34) {
          const gx = x + rnd(t * 11 + k) * 0.8 - 0.4
          const gz = z + rnd(t * 13 + k) * 0.8 - 0.4
          if (BLOCK[t] && Math.max(Math.abs(gx - x), Math.abs(gz - z)) < 0.45) continue
          const blade = ground.add(gx, h + 0.1, gz, 0.09, 0.2, 0.09, 0x7fca6c)
          ground.bendy(blade, 1, h, gx, gz)
          grown.push(blade)
          if (rnd(t * 17 + k) < 0.24) {
            const bloom = ground.add(gx, h + 0.25, gz, 0.15, 0.13, 0.15, PETALS[Math.floor(rnd(t * 19 + k) * 5)])
            ground.bendy(bloom, 1, h, gx, gz)
            grown.push(bloom)
          }
        }
      if (grazed) this.blades.set(t, grown)
    }
    // Trees: a trunk and two boxes of leaves, which give in the wind; one in three is in blossom. Under some, a toadstool.
    for (const [t, s, pink] of TREES) {
      const [x, z, h] = [across(t), along(t), LAND[t]]
      const cubes = TRUNK.map(([y, wide, tall], k) => ground.add(x, h + y * s, z, wide * s, tall * s, wide * s, k ? (pink ? BLOSSOM : LEAF)[(t + k) % 3] : BARK))
      cubes.forEach((c, k) => ground.bendy(c, k ? 0.07 : 0, h, x, z))
      if (pink) this.pink.push([x, h + 1.5 * s, z])
      if (rnd(t * 43) < 0.5) put(TOADSTOOL, x + 0.3, h, z + (rnd(t * 43 + 1) < 0.5 ? 0.28 : -0.28))
    }
    // Rocks: small enough to stay on their own tile, and bare.
    for (const t of ROCKS) {
      const [x, z, h] = [across(t), along(t), LAND[t]]
      put(BOULDER, x, h, z, 0.85, Math.floor(rnd(t * 47) * 4))
    }
    // On the pond: lily pads, two of them in flower, and a duck. And what was left in the meadow.
    for (const [x, z, bloom] of [[DUCK[0], DUCK[1], 1], [-6.4, 4.6, 0], [-2.7, 5.6, 1], [-4.2, 6.9, 0]]) put([[0, -0.06, 0, 0.34, 0.03, 0.34, 0x6fbf73], ...(bloom ? [[0.04, -0.03, 0.02, 0.14, 0.1, 0.14, 0xffc2d9]] : [])], x, 1, z)
    this.duck = put(DRAKE, DUCK[0], 0.9, DUCK[1] + 0.9)
    FENCE.forEach(([x, z], k) => put(k === FENCE.length - 1 ? [...RAILS, [0.42, 0, 0, 0.12, 0.5, 0.12, BARK]] : RAILS, x, 1, z))
    BALES.forEach(([x, z], k) => put(BALE, x, 1, z, k ? 0.8 : 1, k))
    // In the cave: a bed of hay, a stone, a lantern that glows, and two toadstools that glow a little too.
    const [cx, cz] = CAVE[0]
    put([[0, 0, 0, 0.8, 0.12, 0.7, HAY[0]], [0, 0.12, 0.12, 0.5, 0.06, 0.3, HAY[1]]], cx, FLOOR, cz + 1)
    put([[0.2, 0, 0.15, 0.34, 0.24, 0.3, STONE[2]]], cx + 1, FLOOR, cz + 1)
    const lantern = put([[-0.3, 0, 0.1, 0.14, 0.05, 0.14, BARK], [-0.3, 0.05, 0.1, 0.1, 0.16, 0.1, 0xffd45c], [-0.3, 0.21, 0.1, 0.14, 0.05, 0.14, BARK]], cx, FLOOR, cz)
    ground.paint(lantern[1], 0xffd45c, 3)
    for (const [x, z, s] of [[cx + 0.7, cz + 0.7, 1], [cx + 0.34, cz + 0.36, 0.7]]) ground.paint(put([[0, 0, 0, 0.06, 0.1, 0.06, 0xfffaf0], [0, 0.1, 0, 0.15, 0.07, 0.15, 0x9fe8d0]], x, FLOOR, z, s)[1], 0x9fe8d0, 2)
  }

  /** How high the ground is at a point: the bed, where there is water over it. Nothing where there is no land. */
  height(x: number, z: number) {
    const t = at(x, z)
    if (t < 0 || !LAND[t]) return 0
    if (KIND[t] === 4) return FLOOR // (the floor of the cave)
    const h = LAND[t]
    return KIND[t] > 1 ? h - 0.5 : h
  }
  /** Whether a point is over the pond. */
  pond(x: number, z: number) {
    return KIND[at(x, z)] === 3
  }
  /** Whether something stands on the tile there that no sheep may be over. */
  blocked(x: number, z: number) {
    return BLOCK[at(x, z)] === 1
  }
  /** Whether the grass of the tile there is long. */
  long(x: number, z: number) {
    const t = at(x, z)
    return t >= 0 && this.slab[t] >= 0 && !this.fed[t]
  }

  /** The two rectangles a sheep covers at a place and facing: its body, and its head. */
  private rects(s: number, face: number, x: number, z: number, out: Float64Array) {
    const [a, b, , d] = TURNS[face]
    for (let o = 0; o < 8; o += 4) {
      const part = o ? HEAD : BODY
      const [u, v, w] = [part[0] * s, part[1] * s, part[2] * s]
      out[o] = x + (a ? -u : Math.min(b * v, b * w))
      out[o + 1] = x + (a ? u : Math.max(b * v, b * w))
      out[o + 2] = z + (d ? Math.min(d * v, d * w) : -u)
      out[o + 3] = z + (d ? Math.max(d * v, d * w) : u)
    }
  }

  /**
   * Whether a sheep of this size can be there, looking that way: all of it over level ground or the brook, its body
   * not over the pond (its head may be: that is how it drinks), clear of whatever stands in the field, and clear of
   * every other sheep. This is the one rule of where a sheep is: a step or a turn is only made if it fits.
   */
  fits(self: Ewe | null, s: number, face: number, x: number, z: number) {
    const r = this.scratch
    this.rects(s, face, x, z, r)
    for (let o = 0; o < 8; o += 4) {
      for (let k = 0; k < 4; k++) {
        const t = at(r[o + (k & 1)], r[o + 2 + (k >> 1)])
        if (t < 0 || LAND[t] !== 1 || BLOCK[t] || (KIND[t] === 3 && !o)) return false
      }
      for (const e of this.ewes) {
        if (e === self) continue
        for (let p = 0; p < 8; p += 4) if (r[o] < e.rect[p + 1] + 0.04 && r[o + 1] > e.rect[p] - 0.04 && r[o + 2] < e.rect[p + 3] + 0.04 && r[o + 3] > e.rect[p + 2] - 0.04) return false
      }
    }
    return true
  }

  /** A sheep, and its cubes: `owner` is what `pick` says for them. */
  private ewe(entry: Entry, owner: number, s: number, wool: number, x: number, z: number, face: number): Ewe {
    const { seed } = entry
    const cubes = EWE.map(([, , , , , , ink]) => this.flock.add(0, 0, 0, 1, 1, 1, ink || wool, owner))
    const e: Ewe = {
      entry, s, nature: NATURES[Math.floor(rnd(seed * 7 + 3) * 4)], x, z, base: 1, y: 1, face, state: 'idle', goal: 'wander',
      timer: 0.5 + this.chance() * 5, tx: 0, tz: 0, sideways: false, want: -1, hunger: this.chance(), thirst: this.chance(), blocked: 0, pace: 0.6 + 0.25 * rnd(seed * 7 + 7), v: 0,
      stride: 0, hop: 0, wait: 0, nod: 0, lie: 0, friend: null, wool, cubes, rect: new Float64Array(8), mark: NaN, sized: -1,
    }
    this.rects(s, face, x, z, e.rect)
    return e
  }

  /** Puts a sheep in the field, at the spot its seed gives or the nearest one that is free. */
  private arrive(entry: Entry) {
    const { seed } = entry
    const [s, face] = [0.8 + 0.2 * rnd(seed * 7 + 2), Math.floor(rnd(seed * 7 + 6) * 4)]
    const [x0, z0] = [(rnd(seed * 7 + 4) * 2 - 1) * 12, -3 + rnd(seed * 7 + 5) * 16]
    let [x, z] = [x0, z0]
    for (let k = 0; k < 900; k++) {
      ;[x, z] = [x0 + Math.cos(k * 2.4) * k * 0.12, z0 + Math.sin(k * 2.4) * k * 0.12]
      if (this.fits(null, s, face, x, z)) break
    }
    const e = this.ewe(entry, this.ewes.length, s, WOOL[Math.floor(rnd(seed * 7 + 1) * WOOL.length)], x, z, face)
    this.ewes.push(e)
    this.draw(e)
  }

  /** Which sheep a cube of the flock belongs to: its place in `ewes`, `HERMIT` for the one in the cave, or -1. */
  pick(instance: number | undefined) {
    return instance === undefined ? -1 : this.flock.owner[instance]
  }

  /** A sheep that is awake gives a hop: it has been clicked, or a friend has come up. */
  glad(i: number) {
    const e = i === HERMIT ? this.hermit : this.ewes[i]
    if (e && e.state !== 'sleep' && e.lie < 0.05 && e.hop <= 0) e.hop = GLAD
  }

  /** What a sheep is doing, as it would say it. */
  doing(e: Ewe) {
    if (e === this.hermit) return 'at home in its cave'
    if (e.state === 'sleep') return 'asleep'
    if (e.state === 'eat') return 'grazing'
    if (e.state === 'drink') return 'having a drink'
    if (e.state === 'idle') return 'standing about'
    return { wander: 'wandering', graze: 'off to graze', drink: 'off for a drink', wade: 'off for a paddle', follow: 'following a friend', nose: 'being nosy' }[e.goal]
  }

  /** The highest the ground is under a square of ground. */
  private under(x: number, z: number, half: number) {
    return Math.max(this.height(x - half, z - half), this.height(x + half, z - half), this.height(x - half, z + half), this.height(x + half, z + half))
  }

  /**
   * Puts a sheep's cubes where it is. All of it goes up together at a hop, legs and all; its legs reach down to
   * whatever each stands on; a sheep that is wholly in the brook stands in it up to its wool; its head goes down to
   * graze or drink, and nods;
   * asleep it is folded up on the ground; and now and then an ear flicks. Nothing is sent to the graphics card for a sheep that
   * has not changed.
   */
  private draw(e: Ewe) {
    const { flock } = this
    const { s, cubes } = e
    const lift = (Math.abs(Math.sin(e.stride * Math.PI)) * HOP + (e.hop > 0 ? Math.sin(Math.min(1, e.hop / GLAD) * Math.PI) * 0.3 : 0)) * s
    const chew = (e.state === 'eat' || e.state === 'drink') && e.nod > 0.9 ? Math.max(0, Math.sin(this.time * 7 + s * 40)) * 0.06 : 0
    const flick = (this.time * 0.23 + s * 11) % 1 < 0.05 ? 0.05 : 0 // (its ears go up for a moment)
    // All of it in the brook, it stands in the water up to its wool, and not over it on stilts.
    let wading = e.base === 1
    for (let k = 0; k < 8; k++) if (KIND[at(e.rect[(k & 4) + (k & 1)], e.rect[(k & 4) + 2 + ((k >> 1) & 1)])] !== 2) wading = false
    const floor = e.base - (wading ? 0.3 : 0)
    const mark = e.x * 13 + e.z * 7 + lift * 5 + e.nod * 3 + e.lie + e.face + chew + flick + floor
    if (mark === e.mark) return
    e.mark = mark
    e.y = floor + lift
    const [a, b, c, d] = TURNS[e.face]
    const odd = e.face & 1
    const sink = LEGS * e.lie
    const bow = Math.max(e.nod * (BOW - chew), e.lie * TUCK)
    EWE.forEach(([dx, dy, dz, sx, sy, sz], k) => {
      const [x, z] = [e.x + (a * dx + b * dz) * s, e.z + (c * dx + d * dz) * s]
      if (k < 4) {
        // A leg: from the body down to what is under it. Folded away once it has lain down.
        const foot = this.under(x, z, sx * s * 0.5)
        const tall = floor + (LEGS - sink) * s - foot
        flock.place(cubes[k], x, foot + lift + tall / 2, z)
        flock.size(cubes[k], sx * s, tall, sz * s)
        if (e.lie > 0.9) flock.hide(cubes[k])
        else flock.show(cubes[k])
        return
      }
      if (e.sized !== odd) flock.size(cubes[k], (odd ? sz : sx) * s, sy * s, (odd ? sx : sz) * s)
      const low = k === 4 || k === 5 ? sink : bow
      flock.place(cubes[k], x, floor + lift + (dy - low + (k === 7 || k === 8 ? flick : 0) + sy / 2) * s, z)
    })
    e.sized = odd
  }

  /** The other sheep nearest to this one, within a distance. */
  private neighbour(e: Ewe, within: number) {
    let best: Ewe | null = null
    let gap = within
    for (const o of this.ewes) {
      const far = Math.hypot(o.x - e.x, o.z - e.z)
      if (o !== e && far < gap) {
        gap = far
        best = o
      }
    }
    return best
  }

  /** A sheep stops where it is and stands about for a while: never for the same while twice. */
  private rest(e: Ewe, least = 0.5) {
    // (One that was going up to a friend and has got there: both are glad, and say so.)
    const { friend } = e
    if (friend && e.state === 'walk' && Math.hypot(friend.x - e.x, friend.z - e.z) < 1.8 && friend.state !== 'sleep') {
      e.hop = friend.hop = GLAD
      this.bits.spawn((e.x + friend.x) / 2, 2, (e.z + friend.z) / 2, any() * 0.2, 0.9, any() * 0.2, 0.13, 0xff8fb0, 1.2, NEVER, 0, -0.4)
    }
    e.friend = null
    e.state = 'idle'
    e.goal = 'wander'
    e.timer = least + this.chance() * this.chance() * 4.5
  }

  /** A sheep sets off for a place: across and then along, or the other way about, since it goes the way it looks. */
  private go(e: Ewe, x: number, z: number, goal: Ewe['goal'], want = -1) {
    e.tx = x
    e.tz = z
    e.goal = goal
    e.want = want
    // (To somewhere it must look a given way, it comes the last of the way looking so; else the longer way first.)
    e.sideways = want >= 0 ? !(want & 1) : Math.abs(x - e.x) > Math.abs(z - e.z)
    e.state = 'walk'
    e.blocked = 0
    e.timer = 16 // what it may take to get there: a way that is shut is given up on
  }

  /** A sheep that has nothing to do thinks of something. */
  private choose(e: Ewe) {
    if (this.dark > SLEEP) return void (e.state = 'sleep')
    const roll = this.chance()
    const [, fx, , fz] = TURNS[e.face]
    if (e.hunger > 1) {
      // Hungry: the grass under its nose, if that is long; else the nearest that is.
      if (this.long(e.x + fx * NOSE * e.s, e.z + fz * NOSE * e.s)) return this.graze(e)
      let [best, gap] = [-1, Infinity]
      const reach = e.nature === 'greedy' ? 8 : 6
      for (let z = Math.round(e.z) - reach; z <= Math.round(e.z) + reach; z++)
        for (let x = Math.round(e.x) - reach; x <= Math.round(e.x) + reach; x++) {
          const far = Math.hypot(x - e.x, z - e.z)
          if (far < gap && this.long(x, z)) [best, gap] = [at(x, z), far]
        }
      if (best >= 0) return this.go(e, across(best), along(best), 'graze')
    } else if (e.thirst > 1) {
      // Thirsty: the nearest place on the bank that is free, to stand at with its head over the water.
      let [best, gap] = [-1, Infinity]
      SHORE.forEach(([x, z, turn], k) => {
        const [, i, , j] = TURNS[turn]
        const [sx, sz] = [x + i * (0.5 - 0.41 * e.s), z + j * (0.5 - 0.41 * e.s)]
        const far = Math.hypot(sx - e.x, sz - e.z)
        if (far < gap && this.fits(e, e.s, turn, sx, sz)) [best, gap] = [k, far]
      })
      if (best >= 0) {
        const [x, z, turn] = SHORE[best]
        const [, i, , j] = TURNS[turn]
        return this.go(e, x + i * (0.5 - 0.41 * e.s), z + j * (0.5 - 0.41 * e.s), 'drink', turn)
      }
    } else if (e.nature === 'swimmer' && roll < 0.35) {
      // A swimmer: into the brook, to stand in it.
      const [x, z] = BROOK[Math.floor(this.chance() * BROOK.length)]
      if (LAND[at(x, z)] === 1 && !BLOCK[at(x, z)] && Math.hypot(x - e.x, z - e.z) < 12) return this.go(e, x, z, 'wade')
    } else if ((e.nature === 'follower' && roll < 0.55) || (e.nature === 'nosy' && roll < 0.4)) {
      const friend = this.neighbour(e, 12)
      if (friend) {
        e.friend = friend
        return this.go(e, friend.x + (this.chance() - 0.5) * 3, friend.z + (this.chance() - 0.5) * 3, e.nature === 'nosy' ? 'nose' : 'follow')
      }
    } else if (roll > 0.85) {
      // Or it only looks about: another way, if there is room to turn.
      const face = Math.floor(this.chance() * 4)
      if (this.fits(e, e.s, face, e.x, e.z)) this.turn(e, face)
      return void (e.timer = 1 + this.chance() * 3)
    }
    // Else anywhere a sheep could stand: a few tries.
    for (let k = 0; k < 6; k++) {
      const [x, z] = [e.x + (this.chance() - 0.5) * 10, e.z + (this.chance() - 0.5) * 10]
      if (this.fits(e, e.s, e.face, x, z)) return this.go(e, x, z, 'wander')
    }
    e.timer = 1
  }

  private turn(e: Ewe, face: number) {
    e.face = face
    this.rects(e.s, face, e.x, e.z, e.rect)
    e.wait = 0.18
  }

  /** Head down to the grass in front of it. */
  private graze(e: Ewe) {
    e.state = 'eat'
    e.goal = 'wander'
    e.timer = (e.nature === 'greedy' ? 4.5 : 3) + this.chance()
  }

  /** A sheep has got where it was going. */
  private arrived(e: Ewe) {
    const [, fx, , fz] = TURNS[e.want >= 0 ? e.want : e.face]
    const [hx, hz] = [e.x + fx * NOSE * e.s, e.z + fz * NOSE * e.s]
    if (e.goal === 'graze' && this.long(hx, hz)) return this.graze(e)
    if (e.goal === 'drink' && this.height(hx, hz) < 1) {
      if (e.face !== e.want) {
        if (!this.fits(e, e.s, e.want, e.x, e.z)) return this.rest(e)
        this.turn(e, e.want)
      }
      e.state = 'drink'
      e.goal = 'wander'
      e.timer = 3 + this.chance() * 2
      return
    }
    this.rest(e, e.goal === 'wade' ? 3 : 0.5)
  }

  /**
   * One step on the way: straight ahead, the way it looks. It gathers speed and loses it again, turns only with its
   * feet on the ground, and where the way is shut it goes round by the other leg of the way or stops: never sideways.
   * @returns whether it moved
   */
  private walk(e: Ewe, dt: number) {
    e.timer -= dt
    if (e.timer <= 0) return this.rest(e), false
    if (e.wait > 0) return (e.wait -= dt), false
    const [dx, dz] = [e.tx - e.x, e.tz - e.z]
    const [wide, deep] = [Math.abs(dx) > 0.001, Math.abs(dz) > 0.001]
    if (!wide && !deep) {
      if (!e.stride) this.arrived(e)
      return false
    }
    const side = wide && (e.sideways || !deep)
    const left = side ? dx : dz
    const face = side ? (dx > 0 ? 1 : 3) : dz > 0 ? 0 : 2
    /** The way is shut: by the other leg of the way, if there is one, or not at all. */
    const balk = () => {
      if (++e.blocked < 3 && (side ? deep : wide)) e.sideways = !side
      else this.rest(e, 0.4)
    }
    if (face !== e.face) {
      if (e.stride) return false // (it lands first)
      if (this.fits(e, e.s, face, e.x, e.z)) this.turn(e, face)
      else balk()
      return false
    }
    const far = Math.abs(left)
    e.v += (e.pace * Math.min(1, 0.3 + far / 0.6) - e.v) * Math.min(1, dt * 5)
    const step = Math.min(far, e.v * dt) * Math.sign(left)
    const [x, z] = [e.x + (side ? step : 0), e.z + (side ? 0 : step)]
    if (!this.fits(e, e.s, face, x, z)) return balk(), false
    const hops = Math.floor(e.stride)
    e.x = x
    e.z = z
    e.stride += Math.abs(step) * STEPS
    e.blocked = 0
    this.rects(e.s, face, x, z, e.rect)
    // (As it lands: one that is off to graze stops at the first long grass that comes under its nose.)
    if (Math.floor(e.stride) > hops && e.goal === 'graze' && this.long(x + TURNS[face][1] * NOSE * e.s, z + TURNS[face][3] * NOSE * e.s)) {
      e.stride = 0
      this.graze(e)
    }
    return true
  }

  /** Bites the grass of a tile: it goes short and what grew on it is gone, and all of it grows back. */
  bite(x: number, z: number) {
    const t = at(x, z)
    if (!this.long(x, z)) return false
    this.fed[t] = REGROW + this.chance() * 15
    this.eaten.push(t)
    this.ground.paint(this.slab[t], SHORT)
    for (const c of this.blades.get(t) ?? []) this.ground.hide(c)
    this.bites++
    return true
  }

  update(dt: number) {
    const { bits } = this
    this.time += dt
    // The day: bright at the start, dark in the middle of its length, and sheep that can lie down do.
    this.dark = 0.5 - 0.5 * Math.cos((this.time / DAY) * Math.PI * 2)
    this.sun.color.lerpColors(NOON[0], NIGHT[0], this.dark)
    this.sun.intensity = 3.2 - 2.2 * this.dark
    this.glow.intensity = 1.25 - 0.7 * this.dark
    this.sky.lerpColors(NOON[1], NIGHT[1], this.dark)
    for (const e of this.ewes) {
      e.hunger += dt / (e.nature === 'greedy' ? 25 : 50)
      e.thirst += dt / 70
      e.hop = Math.max(0, e.hop - dt)
      let moved = false
      if (e.state === 'sleep') {
        if (this.dark < WAKE) this.rest(e, 0)
        else if (Math.random() < dt * 0.2) bits.spawn(e.x, 1.6, e.z, 0.05, 0.3, 0, 0.09, 0xe6dcf7, 2, NEVER, 0, -0.1) // (it dreams)
      } else if (e.state === 'walk') moved = this.walk(e, dt)
      else if ((e.timer -= dt) <= 0) {
        const [, fx, , fz] = TURNS[e.face]
        if (e.state === 'eat' && this.bite(e.x + fx * NOSE * e.s, e.z + fz * NOSE * e.s)) e.hunger = 0
        if (e.state === 'drink') e.thirst = 0
        if (e.state !== 'idle') this.rest(e, 1)
        else if (e.nod > 0 || e.lie > 0 || e.stride) e.timer = 0.1 // (not before its head is up and it is on its feet)
        else this.choose(e)
      }
      if (!moved) {
        // Standing: whatever hop it was in, it comes down from; and then it stands still.
        e.v = 0
        if (e.stride) {
          const land = Math.ceil(e.stride)
          e.stride += dt * 2.4
          if (e.stride >= land) e.stride = 0
        }
      }
      const [down, flat] = [e.state === 'eat' || e.state === 'drink' ? 1 : 0, e.state === 'sleep' ? 1 : 0]
      e.nod += Math.max(-dt * 4, Math.min(dt * 4, down - e.nod))
      e.lie += Math.max(-dt * 2, Math.min(dt * 2, flat - e.lie))
      this.draw(e)
    }
    this.hermit.hop = Math.max(0, this.hermit.hop - dt)
    this.draw(this.hermit)
    for (let i = this.eaten.length - 1; i >= 0; i--) {
      const t = this.eaten[i]
      this.fed[t] -= dt
      if (this.fed[t] > 0) continue
      this.fed[t] = 0
      this.ground.paint(this.slab[t], this.green[t])
      for (const c of this.blades.get(t) ?? []) this.ground.show(c)
      this.eaten.splice(i, 1)
    }
    // The duck goes round the pond. The trees in blossom shed a petal now and then.
    this.swum += dt * 0.45
    const [a, b, c, d] = TURNS[turned(Math.cos(this.swum), -Math.sin(this.swum))]
    const [x, y, z] = [DUCK[0] + Math.sin(this.swum) * 0.9, 0.9 + 0.02 * Math.sin(this.time * 3), DUCK[1] + Math.cos(this.swum) * 0.9]
    DRAKE.forEach(([dx, dy, dz, sx, sy, sz], k) => {
      this.ground.place(this.duck[k], x + a * dx + b * dz, y + dy + sy / 2, z + c * dx + d * dz)
      this.ground.size(this.duck[k], a ? sx : sz, sy, a ? sz : sx)
    })
    // (At the foot of each little fall, a fleck of foam now and then: no more.)
    for (const [fx, , fz, foot, dx, dz] of FALLS) {
      if (Math.random() < dt * 1.5) bits.spawn(fx + dx * 0.25 + (dz ? any() * 0.5 : 0), foot + 0.06, fz + dz * 0.12 + (dx ? any() * 0.5 : 0), any() * 0.3, 0.25, any() * 0.3, 0.12, 0xffffff, 0.9, NEVER, 0, -0.15)
    }
    if (this.pink.length && Math.random() < dt * 1.5) {
      const [px, py, pz] = this.pink[Math.floor(Math.random() * this.pink.length)]
      bits.spawn(px + any() * 0.8, py + any() * 0.5, pz + any() * 0.8, -0.5 + any() * 0.3, 0, any() * 0.3, 0.08, BLOSSOM[Math.floor(Math.random() * 3)], 3, 1, 0, 0.5)
    }
    this.ground.wind.value.set(0.1, 0.05, this.time)
    this.water.wind.value.set(0.025, 0, this.time)
    this.ground.update(dt)
    this.water.update(dt)
    this.flock.update(dt)
    bits.update(dt)
  }

  /** The shadows at the size that goes with a step of the picture (see `../Picture.tsx`). */
  shadows(tier: number) {
    shade(this.sun, tier)
  }

  dispose() {
    for (const mesh of [this.ground.mesh, this.water.mesh, this.flock.mesh, this.bits.mesh]) mesh.dispose()
  }
}
