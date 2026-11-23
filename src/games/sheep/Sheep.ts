// The field: a small island of pastel cubes in the castle's manner. A meadow with a pond, a brook that comes down to it
// from the hills at the back, trees, rocks and a few things somebody left about; and the sheep of `flock.ts` going
// about it at a hop, playing, splashing and running for the big grass; ducks; and one more sheep in a cave at the
// back of the mountain. A plain class, no React: it has a `group` for the scene, `update(dt)`, `shadows(tier)` and
// `dispose()`, and can be stepped in node. Sheep look and are the same for every visitor (they come from their seeds);
// only the walking is worked out on each machine, by `rnd` from a seed of the world's, so that a test can play it again.
//
// How a world here is to look and how its creatures are to move is written down in `../AGENTS.md` ("Look and
// movement"): this file follows it, and the castle, from which most of its recipes are taken.
import { BufferGeometry, CircleGeometry, Color, DirectionalLight, Float32BufferAttribute, Group, HemisphereLight, Mesh, MeshStandardMaterial, PointLight, ShadowMaterial, Vector2 } from 'three'
import { ARROW, BARK, BLOSSOM, LEAF, NEAR, NEVER, POINTER, RING, STONE, WOOD, any, rnd, shade } from '../basics.ts'
import { Bits, Cubes } from '../cubes.ts'
import type { Look } from './dress.ts'
import { BODY, BUBBLE, EWE, FLIT, GLAD, HEAD, LEGS, LINES, NOSE, PUP, PUP_LONG, PUP_WIDE, SLOTS, TURNS, clothe, flutter, hound, kennel, limbs, pose, speak, swarm, type Part, type Pup } from './model.ts'
import { FLOCK, RECLUSE, type Entry } from './flock.ts'

export const REACH = 18 // the land is on a board of 2 * REACH + 1 tiles each way; a tile is a unit
export const SPAN = 19 // how far from the middle there is anything to see (for `View`): small, so that a sheep is big
const N = 2 * REACH + 1
const ROUND = 16.4 // how far the island reaches from its middle, give or take a tile
const REGROW = 45 // seconds for a bitten tile to be long again (and up to 15 more)
const DAY = 180 // seconds for a whole day: a short one, and most of it light
/** The time of day a visit begins at: a little after sunrise, in a soft gold light, with the day still to come. */
export const MORNING = 0.78 * DAY
const SLEEP = 0.75 // how dark it is when sheep lie down; they get up again at WAKE: about half a minute later
const WAKE = 0.7
const STEPS = 1.5 // how many hops a sheep takes to a tile
const BESIDE = 2.6 // how near to a very old sheep is beside her
const [UP, ATOP, DOWN] = [0.55, 0.4, 0.55] // a leap over another sheep: how long it takes to get up on it, how long it is on top, and how long to get down
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
/** What `pick` says for the sheep in the cave, which is none of the flock's. */
export const HERMIT = -2
/** And what `portal` says for the door in the mountain. */
export const DOOR = -3
const NATURES = ['greedy', 'swimmer', 'nosy', 'follower'] as const
export type Nature = (typeof NATURES)[number]
/**
 * The light through a day, as stops: how high the sun stands (1 at noon, -1 at midnight: the cosine of the time of
 * day), then the colour of the sun and how strong it is, the colour of the sky, and how strong the soft light from
 * all round is. Between two stops everything goes evenly from the one to the other, and the sun's height itself
 * changes slowly, so nothing ever jumps: the day goes out through gold, rose and violet into a blue night, and comes
 * back the same way. The night is dark, but a sheep can still be seen in it; the strongest light is noon's, and that
 * is gentle, so nothing glares. (The finish of the picture, in `../Picture.tsx`, only makes things glow that are
 * brighter than white, which none of these is.)
 */
const LIGHT = [
  [-1, 0x8f9bd8, 1, 0x2f3560, 0.55], // the dead of night: a blue moon
  [-0.9, 0x8f9bd8, 1.05, 0x39407a, 0.58], // (the hour the sheep lie down in, and get up at)
  [-0.72, 0xb9a0e0, 1.3, 0x8f86c8, 0.72], // violet: the sky lightens before anything else does
  [-0.5, 0xff9e7a, 1.75, 0xf2b8c0, 0.88], // rose: a low orange sun
  [-0.25, 0xffc27a, 2.2, 0xf6d9b8, 1], // gold
  [0.2, 0xffdcae, 2.55, 0xdbe6ea, 1.08], // a warm clear morning, or late afternoon
  [1, 0xffe6c6, 2.75, 0xd3e6ee, 1.12], // noon: soft, a good deal under the castle's 3.2 and 1.25 (a wide open meadow under that is glare)
].map(([high, sun, power, sky, glow]) => ({ high, sun: new Color(sun), power, sky: new Color(sky), glow }))

const QUARTERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]]
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
const DUCKS = 3 // how many ducks swim round it, a third of the way apart; and one more sits on the brook, up in the rocks
const DUCK = [-4.5, 5] // the middle of the pond, which the duck swims round: well away from any bank a sheep drinks at
// What somebody left about, by tile: a stretch of fence with two bales of hay behind it.
const FENCE = [[8, -2], [9, -2], [10, -2]]
const BALES = [[9, -3], [10, -3]]
// The cave, in the back of the mountain: four tiles, two across the mouth and two deep. Its floor, and the least rock over it.
const CAVE = [[0, -14], [1, -14], [0, -13], [1, -13]]
const FLOOR = 2
// The door in the mountain, on the side that is seen first, to the right: the rock it is set in, the step before it,
// the boulder it is half behind, and the worn path that leads up to it over the meadow.
const PORCH = [[5, -6], [5, -5], [6, -5]]
const TRAIL = [[5, -4], [5, -3], [5, -2]]
const TROD = 0xdcc79c // the colour of a path that is walked a great deal
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
  // The door: a block of rock two steps over a clean step of stone, and a boulder beside the step. Nothing else on them.
  {
    const [rock, step, stone] = PORCH.map(([x, z]) => at(x, z))
    LAND[rock] = 4
    LAND[step] = LAND[stone] = 2
    ROCK[rock] = ROCK[step] = 1
    BLOCK[step] = BLOCK[stone] = 1
    ROCKS.push(stone)
    for (const [x, z] of TRAIL) BLOCK[at(x, z)] = 2 // (kept clear for now: put back to open ground below)
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
  for (const [x, z] of TRAIL) BLOCK[at(x, z)] = 0
  for (const [x, z] of LAKE) for (const [i, j] of NEAR) if (KIND[at(x + i, z + j)] === 1 && LAND[at(x + i, z + j)] === 1 && !BLOCK[at(x + i, z + j)]) SHORE.push([x + i, z + j, turned(-i, -j)])
}

// Things, as parts: where each box is from the thing's own middle (across, how high its foot is, along), its size, and
// its colour. A tree is the castle's: the middle of each box, how wide it is, and how tall.
const TRUNK = [[0.45, 0.28, 0.9], [1.275, 1, 0.75], [2, 0.68, 0.7]]
const BOULDER: Part[] = [[0.02, 0, -0.04, 0.66, 0.5, 0.6, STONE[1]], [0.1, 0.5, -0.06, 0.36, 0.26, 0.34, STONE[2]], [-0.42, 0, 0.26, 0.22, 0.2, 0.22, STONE[0]]]
const REEDS: Part[] = [[-0.07, 0, 0, 0.06, 0.6, 0.06, 0x7fa862], [-0.07, 0.6, 0, 0.1, 0.2, 0.1, BARK], [0.08, 0, 0.05, 0.06, 0.42, 0.06, 0x8db36c], [0.08, 0.42, 0.05, 0.1, 0.18, 0.1, BARK]]
const TOADSTOOL: Part[] = [[0, 0, 0, 0.06, 0.1, 0.06, 0xfffaf0], [0, 0.1, 0, 0.15, 0.07, 0.15, 0xff9a85]]
// (A bale is hay tied twice: five slices side by side, so that the ties are not inside the hay.)
const BALE: Part[] = [[-0.29, 0, 0, 0.22, 0.5, 0.6, HAY[0]], [-0.15, 0, 0, 0.06, 0.52, 0.62, HAY[1]], [0, 0, 0, 0.24, 0.5, 0.6, HAY[0]], [0.15, 0, 0, 0.06, 0.52, 0.62, HAY[1]], [0.29, 0, 0, 0.22, 0.5, 0.6, HAY[0]]]
// (A post, and two rails that run in front of it to the next tile's.)
const RAILS: Part[] = [[-0.42, 0, 0, 0.12, 0.5, 0.12, BARK], [0, 0.16, 0.09, 1, 0.07, 0.06, WOOD], [0, 0.34, 0.09, 1, 0.07, 0.06, WOOD]]
const DRAKE: Part[] = [[0, 0, 0, 0.2, 0.14, 0.3, 0xffd45c], [0, 0.14, 0.1, 0.13, 0.13, 0.13, 0xffd45c], [0, 0.18, 0.2, 0.07, 0.04, 0.08, 0xf5a742]]
/** A duck's two wings, which only show when it flies; a small bird, for the fence; and the big grass that a visitor plants. */
const WINGS: Part[] = [[-0.15, 0.08, 0, 0.1, 0.03, 0.16, 0xf5c542], [0.15, 0.08, 0, 0.1, 0.03, 0.16, 0xf5c542]]
const BIRD: Part[] = [[0, 0, 0, 0.12, 0.1, 0.16, 0x7fb6e8], [0, 0.1, 0.05, 0.09, 0.08, 0.09, 0x7fb6e8], [0, 0.12, 0.11, 0.04, 0.03, 0.05, 0xf5a742]]
const TREAT: Part[] = [[-0.14, 0, 0.05, 0.15, 0.6, 0.15, 0x4fd391], [0.12, 0, -0.14, 0.15, 0.48, 0.15, 0x63dc9c], [0.04, 0, 0.22, 0.13, 0.38, 0.13, 0x4fd391], [0.3, 0, 0.06, 0.12, 0.26, 0.12, 0x63dc9c], [-0.14, 0.6, 0.05, 0.21, 0.15, 0.21, 0xfff3a0]]
const TREATS = 5 // how many tufts of it there can be at once: one more, and the oldest goes;
const RIPE = 60 // for how long one stands if nobody gets to it;
const PAUSE = 0.35 // and how long after one is planted before the next can be
const THOUGHTS = 6 // how many bubbles there can be at once
const ALOFT = 6 // how high over the grass a new sheep hangs, being dressed and waiting to be put down: up in the sky,
const GRAVITY = 22 // from where it falls like anything else (as the loose bits of `../cubes.ts` do)
const SPARE = 8 // how many more sheep than it began with a field has cubes for (until step 3: see `PLAN.md`)
/** A sheep's dog: what its drawing goes by (`Pup`), whose it is, the ground it keeps, and what it is at. */
type Dog = Pup & {
  owner: Ewe
  rect: Float64Array // x0 x1 z0 z1: far away while it is in the air or on a back
  state: 'away' | 'sit' | 'run' | 'jump' | 'up' | 'down'
  timer: number
  tx: number // where it is going,
  tz: number
  across: boolean // and which leg of the way it is on
  shut: number // for how long its way has been shut
  t: number // how far through a jump it is, 0 to 1,
  from: number[] // and the place on the ground the jump is from, or to
}

type Ewe = {
  entry: Entry
  s: number // size, from 0.8 to 1
  nature: Nature
  x: number
  z: number
  base: number // how high the ground it stands on is: 1 in the field
  y: number // how high its feet are now: the ground, and whatever hop it is in
  face: number // which quarter turn it looks: see `TURNS`
  state: 'idle' | 'walk' | 'eat' | 'drink' | 'sleep' | 'splash' | 'leap'
  goal: 'wander' | 'graze' | 'drink' | 'wade' | 'follow' | 'nose' | 'zoom' | 'flee' | 'chase' | 'treat' | 'nap' | 'poke' | 'vault' | 'visit' | 'back'
  timer: number
  tx: number // where it is going,
  tz: number
  sideways: boolean // whether it goes across first and then along, or the other way about,
  want: number // and which way it is to look once there, or -1
  hunger: number
  thirst: number
  blocked: number // how many times running its way has been shut,
  tries: number // and how many more times it will try another way round before it gives the errand up
  dry: number // how many times running it has set off for a drink and not had one
  old?: boolean // whether it is a very old sheep (`clothe` says): slow, and liked
  pace: number // how fast it likes to go,
  v: number // and how fast it is going
  stride: number // how far along its stride it is: it goes at a hop
  hop: number // how long it goes on jumping for joy
  wait: number // a moment's stop after a turn
  nod: number // how far its head is down, 0 to 1,
  lie: number // and how far it has lain down
  air: number // how high over the ground it hangs or is falling from: a sheep that is being put in the field
  fall: number // for how long it has been falling,
  high: number // and from how high
  wear: Part[] // what it has on
  friend: Ewe | null // whom it is going up to
  mate: Ewe | null // whom it is playing with: each is the other's, and both let go together (see `part`)
  lead: boolean // whether, of the two, it is the one that runs away
  fun: number // for how long the game goes on
  cool: number // a moment after a bump before there can be another
  rush: number // how many times its own pace it goes: 1, but more when it runs (and then its ears are up)
  laps: number // how many more runs its zoomies have in them
  prize: number // which tuft of big grass it is after
  gazed: number // the tuft out of reach that it has been to look at (by when that was planted): once is enough
  ate: number // for how long it has still the taste of the last one: one that goes straight on to the next is on a trail
  crown: number // for how long sparks go round its head: it ate a golden one
  rider: number // which duck is on its back, or on its way there; or -1
  napped: number // how many times tonight it has thought about lying by a friend, or waking one: twice is enough
  sniff: boolean // whether its head is down to smell a flower, and not to eat
  over: Ewe | null // the sheep it is leaping over, while it is,
  leapt: number // for how long it has been at it,
  from: number[] // from where to where (x, z, x, z), and how far along the way the other one is
  lark: boolean // and whether it is for the fun of it
  vexed: Ewe | null // the sheep in its way that it is about to leap over, once it has stamped
  frogs: number // how many more leaps a game of leapfrog has in it
  pinned: number // for how long it is to stay just as it is: somebody is in the air over it, or about to be
  say: string // what is in the small bubble over its head,
  said: number // and for how much longer
  wool: number
  cubes: number[] // one for each part of `EWE`
  rect: Float64Array // where it stands: two rectangles (body, head) as x0 x1 z0 z1
  mark: number // what it was last drawn as
  sized: number
}

export class Sheep {
  readonly group = new Group()
  readonly ground = new Cubes(5200, new MeshStandardMaterial({ roughness: 0.9 }), 'wind')
  /** The water: all of it one piece (see `pour`). */
  readonly water: Mesh
  private waves = { value: new Vector2(0.025, 0) } // how high its waves are, and the time
  readonly flock: Cubes
  readonly bits = new Bits(240)
  readonly ewes: Ewe[] = []
  /** The colour of the sky, for the page to put behind everything. */
  readonly sky = new Color().copy(LIGHT[LIGHT.length - 1].sky)
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
  /** The ducks: where each is, what it is at, and its cubes (a body, a head, a bill, two wings). */
  readonly ducks: { cubes: number[]; x: number; y: number; z: number; turn: number; state: 'swim' | 'fly' | 'ride' | 'home'; t: number; fx: number; fy: number; fz: number; on: Ewe | null; brook: number }[] = []
  /** The tufts of big grass: the tile each stands on (-1 if it does not), how long it has left, and its cubes. */
  readonly treats: { t: number; left: number; born: number; gold: boolean; cubes: number[] }[] = []
  /** How many times each of the things that can happen has happened: for whoever wants to know that they do. */
  readonly did: Record<string, number> = { zoom: 0, chase: 0, bump: 0, nap: 0, poke: 0, treat: 0, sigh: 0, splash: 0, join: 0, ride: 0, sniff: 0, leap: 0, cross: 0, lark: 0, frog: 0, wake: 0, trail: 0, tussle: 0, posy: 0, gold: 0, gaze: 0 }
  private treat = new Uint8Array(N * N) // where a tuft stands: no sheep is over it, body or head
  private bloomy = new Uint8Array(N * N) // where a flower grows
  private planted = 0 // how many have been, ever (every eighth is a golden one),
  private first = 0 // the seed this world began with,
  /** The door in the mountain: where it is, and the cubes of the door itself (planks, knob, lock, and the L on it). */
  readonly door = { x: PORCH[0][0], y: 3.05, z: PORCH[0][1] + 0.55, cubes: [] as number[] }
  /** The thought bubbles: whose each is just now, what is on it, and its cubes (the paper's, then the picture's). */
  readonly thoughts: { owner: Ewe | null; say: string; cubes: number[] }[] = []
  private facing = 0 // the quarter turn they face: the one nearest to whoever is looking
  private shy = -1 // the sheep with no bubble of that kind, because its own with its name in is open,
  private mute = false // and whether nobody has one: a sheep is being dressed, or put down
  private bare = new Uint8Array(N * N) // where nothing stands on a dry tile: a tuft can go there
  private birds: number[][] = []
  /**
   * What bigger gifts brought (among the `items` of a sheep's look): the butterflies about a sheep, and the dogs. A dog is on
   * the ground as a sheep is, by the same rule (`sits`, and `fits` minds it): `rect` is the ground it keeps, which is
   * nowhere while it is in the air or on its sheep's back. Their cubes are in a pool of their own.
   */
  readonly pets: Cubes
  readonly flits: { owner: Ewe; cubes: number[] }[] = []
  readonly dogs: Dog[] = []
  /** How many times a dog has barked at a sheep, and how many times one has been up on its sheep's back. */
  wuffed = 0
  rode = 0
  private elders: Ewe[] = [] // the very old sheep that are in the field: the others like to be by them
  /** How many times a sheep has come up to one of them, or stood by her, and shown that it is fond of her. */
  fond = 0
  private most = 0 // how many cubes the flock has room for
  /** A sheep that is being dressed, or is about to be put down: it hangs in the air, and is not of the flock yet. */
  guest: Ewe | null = null
  private sown = -9 // when the last tuft was planted, by the clock on the wall,
  private arrow: number[] = [] // the yellow arrow that bobs over the sheep that hangs: this one is yours
  private spare: Ewe | null = null // one that was sent away again: its cubes do for the next
  /** The sheep in the cave: small, at home, and going nowhere. It is none of `ewes`. */
  readonly hermit: Ewe
  private swum = 0
  private seed: number
  private scratch = new Float64Array(8)

  /**
   * @param seed the same seed, the same wandering. @param list who is in the field
   * @param start the time of day it begins at, in seconds: a page that is loaded again goes on with the day it had,
   * and does not leap back to noon (out of the middle of the night, that is a leap)
   */
  constructor(list: Entry[] = FLOCK, seed = 1, start = 0) {
    this.time = start
    this.seed = this.first = seed
    this.most = (list.length + 1 + SPARE) * SLOTS
    this.flock = new Cubes(this.most, new MeshStandardMaterial({ roughness: 0.95 }))
    this.pets = new Cubes((list.length + 1 + SPARE) * (PUP.length + FLIT * 3), new MeshStandardMaterial({ roughness: 0.95 }))
    this.build()
    this.water = this.pour()
    list.forEach((entry) => this.arrive(entry))
    this.hermit = this.ewe(RECLUSE, HERMIT, 0.6, CAVE[1][0], CAVE[1][1] + 0.05, 2)
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
    // (In the cave a lantern burns: its light is warm, and reaches no further than the mouth.)
    const lamp = new PointLight(0xffc27a, 7, 4.5, 1.4)
    lamp.position.set(CAVE[0][0] + 0.5, FLOOR + 0.9, CAVE[0][1] + 0.9)
    this.group.add(this.ground.mesh, this.water, this.flock.mesh, this.pets.mesh, this.bits.mesh, sun, sun.target, this.glow, lamp, floor)
    this.update(0)
    this.flock.settle() // (nothing springs up or changes colour at the start)
  }

  private chance() {
    return rnd(this.seed++)
  }

  /** The land and all that stands on it: under every tile a column of earth, and on it a slab of whatever lies on top. */
  private build() {
    const { ground } = this
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
        continue
      }
      if (KIND[t] === 3) {
        // The pond: the same water, a whole tile of it in a bed half a step deep. Its edges are whole tiles, as the
        // island's are: no small pieces of bank cut into its corners. It is round because its tiles are laid so. In
        // some of the corners that stick out into the land, reeds stand in the water, up from the bed.
        ground.add(x, (h - 0.6) / 2, z, 1, h - 0.6, 1, SOIL)
        ground.add(x, h - 0.55, z, 1, 0.1, 1, BED)
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
      const worn = TRAIL.some(([i, j]) => i === x && j === z) // (the path to the door: trodden bare, and nothing grows on it)
      const green = worn ? TROD : GRASS[Math.floor(rnd(t) * 3)]
      const white = stone && h >= SNOWY
      const top = ground.add(x, h - 0.125, z, 1, 0.25, 1, white ? SNOW : stone ? STONE[(x + z) & 1 ? 0 : 2] : green)
      if (stone) {
        const [lump, wide, tall] = [rnd(t * 41), 0.3 + rnd(t * 41 + 3) * 0.3, 0.16 + rnd(t * 41 + 4) * 0.3]
        this.bare[t] = lump >= 0.7 && KIND[t] === 1 ? 1 : 0
        if (BLOCK[t]) continue // (a clean step: the door's)
        if (lump < 0.45) ground.add(x + rnd(t * 41 + 1) * 0.3 - 0.15, h + tall / 2, z + rnd(t * 41 + 2) * 0.3 - 0.15, wide, tall, wide * 0.85, white ? SNOW : STONE[Math.floor(rnd(t * 41 + 5) * 3)])
        else if (lump < 0.7) ground.add(x + (rnd(t * 41 + 1) < 0.5 ? 0.3 : -0.3), h + 0.08, z + (rnd(t * 41 + 2) < 0.5 ? 0.3 : -0.3), 0.2, 0.16, 0.18, STONE[Math.floor(rnd(t * 41 + 5) * 3)])
        continue
      }
      // (At the foot of the rock, on the grass: what has come down from it. Nothing grows through that.)
      if (h > 1 && !BLOCK[t] && RING.some(([i, j]) => ROCK[at(x + i, z + j)]) && rnd(t * 53) < 0.55) {
        for (let k = 0; k < 2; k++) ground.add(x + (k ? 0.24 : -0.2) + rnd(t * 53 + k) * 0.1, h + 0.07 + k * 0.03, z + (rnd(t * 53 + 2 + k) < 0.5 ? 0.25 : -0.25), 0.2 + k * 0.08, 0.14 + k * 0.06, 0.2, STONE[(t + k) % 3])
        continue
      }
      const grazed = h === 1 && !BLOCK[t] && !worn
      if (worn) {
        this.bare[t] = 1
        continue
      }
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
            this.bloomy[t] = 1
          }
        }
      this.blades.set(t, grown)
      this.bare[t] = BLOCK[t] ? 0 : 1
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
    // The ducks: three on the pond, and one on a level stretch of the brook up in the rocks, where no sheep wades.
    const perch = BROOK.findIndex(([x, z]) => LAND[at(x, z)] > 1 && !DEEP[at(x, z)])
    for (let k = 0; k < DUCKS + (perch < 0 ? 0 : 1); k++) this.ducks.push({ cubes: put([...DRAKE, ...WINGS], 0, -40, 0), x: 0, y: 0, z: 0, turn: 0, state: 'swim', t: 0, fx: 0, fy: 0, fz: 0, on: null, brook: k < DUCKS ? -1 : at(BROOK[perch][0], BROOK[perch][1]) })
    // Two small birds on the fence's end posts. And the cubes of the big grass, for when it comes up.
    this.birds = [put(BIRD, FENCE[0][0] - 0.42, 1.5, FENCE[0][1]), put(BIRD, FENCE[FENCE.length - 1][0] + 0.42, 1.5, FENCE[0][1])]
    for (let k = 0; k < TREATS; k++) this.treats.push({ t: -1, left: 0, born: 0, gold: false, cubes: TREAT.map(([, , , sx, sy, sz, ink]) => ground.add(0, -40, 0, sx, sy, sz, ink, -1, false)) })
    // The door in the mountain: a frame of stone set in the rock; two planks with a round top; on them, standing
    // proud of the wood, a knob, a lock with its keyhole, and an L in gold (fifty, as the Romans wrote it: an upright
    // and a foot). It is locked, and stays so. A lantern by it, and hoof marks on the step.
    const [dx, dz] = [PORCH[0][0], PORCH[0][1] + 0.5]
    const door = (parts: Part[]) => parts.map(([x, y, z, sx, sy, sz, ink]) => ground.add(dx + x, 2 + y + sy / 2, dz + z, sx, sy, sz, ink, DOOR))
    door([[-0.31, 0, 0.035, 0.08, 0.78, 0.07, STONE[0]], [0.31, 0, 0.035, 0.08, 0.78, 0.07, STONE[0]], [-0.23, 0.62, 0.035, 0.08, 0.16, 0.07, STONE[2]], [0.23, 0.62, 0.035, 0.08, 0.16, 0.07, STONE[2]], [0, 0.78, 0.035, 0.7, 0.1, 0.07, STONE[0]]])
    door([[-0.36, 0, 0.3, 0.1, 0.05, 0.1, BARK], [-0.36, 0.17, 0.3, 0.1, 0.04, 0.1, BARK], [-0.08, 0, 0.42, 0.07, 0.02, 0.1, 0x8f8a96], [0.08, 0, 0.5, 0.07, 0.02, 0.1, 0x8f8a96], [-0.08, 0, 0.72, 0.07, 0.02, 0.1, 0x8f8a96], [0.08, 0, 0.8, 0.07, 0.02, 0.1, 0x8f8a96]])
    ground.paint(door([[-0.36, 0.05, 0.3, 0.08, 0.12, 0.08, 0xffd45c]])[0], 0xffd45c, 2.2)
    this.door.cubes = door([[0, 0, 0.03, 0.54, 0.62, 0.06, WOOD], [0, 0.62, 0.03, 0.38, 0.16, 0.06, WOOD], [0.17, 0.3, 0.075, 0.05, 0.05, 0.03, 0xffc93c], [0.17, 0.2, 0.07, 0.07, 0.09, 0.02, 0xffc93c], [0.17, 0.225, 0.087, 0.025, 0.04, 0.012, 0x4a3b3b], [-0.06, 0.3, 0.07, 0.06, 0.24, 0.02, 0xffc93c], [0.03, 0.3, 0.07, 0.12, 0.06, 0.02, 0xffc93c]])
    for (let k = 0; k < THOUGHTS; k++) this.thoughts.push({ owner: null, say: '', cubes: [...BUBBLE, ...Array<Part>(LINES).fill(BUBBLE[0])].map(([, , , sx, sy, sz, ink]) => ground.add(0, -40, 0, sx, sy, sz, ink, -1, false)) })
    this.arrow = ARROW.map(([, , , sx, sy, sz]) => ground.add(0, -40, 0, sx, sy, sz, POINTER))
    for (const c of this.arrow) ground.paint(c, POINTER, 1.7)
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

  /**
   * The water, which is whole blocks of it tile by tile (0.44 deep on its bed; a whole cube where the brook steps
   * down), drawn as one piece: the top of every tile, and a side only where the brook goes down a step. A box of
   * see-through water for every tile showed where one box ended and the next began, since each drew its sides inside
   * the water; here there are no sides between two tiles of the same water, so the pond is one sheet. Every corner of
   * it rises and falls by where it is, so the sheet stays in one piece as it moves.
   */
  private pour() {
    const [spots, ups] = [[] as number[], [] as number[]]
    /** A face of four corners, given in turn, that looks the way (nx, ny, nz). */
    const face = (corners: number[][], nx: number, ny: number, nz: number) => {
      for (const k of [0, 1, 2, 0, 2, 3]) {
        spots.push(...corners[k])
        ups.push(nx, ny, nz)
      }
    }
    for (let t = 0; t < N * N; t++) {
      if (KIND[t] !== 2 && KIND[t] !== 3) continue
      const [x, z, top] = [across(t), along(t), LAND[t] - 0.06]
      face([[x - 0.5, top, z - 0.5], [x - 0.5, top, z + 0.5], [x + 0.5, top, z + 0.5], [x + 0.5, top, z - 0.5]], 0, 1, 0)
      for (const [i, j] of NEAR) {
        // (Down a step: the side of this block shows, as far down as the water below it.)
        const n = at(x + i, z + j)
        if (n < 0 || KIND[n] < 2 || LAND[n] >= LAND[t]) continue
        const [low, ax, az] = [LAND[n] - 0.06, x + i * 0.5, z + j * 0.5]
        face([[ax - j * 0.5, top, az + i * 0.5], [ax - j * 0.5, low, az + i * 0.5], [ax + j * 0.5, low, az - i * 0.5], [ax + j * 0.5, top, az - i * 0.5]], i, 0, j)
      }
    }
    const shape = new BufferGeometry()
    shape.setAttribute('position', new Float32BufferAttribute(spots, 3))
    shape.setAttribute('normal', new Float32BufferAttribute(ups, 3))
    const look = new MeshStandardMaterial({ color: POOL, roughness: 0.15, transparent: true, opacity: 0.72 })
    look.onBeforeCompile = (shader) => {
      shader.uniforms.waves = this.waves
      shader.vertexShader = shader.vertexShader.replace('#include <common>', 'uniform vec2 waves;\n#include <common>').replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += waves.x * sin( waves.y * 1.4 + position.x * 0.9 + position.z * 0.6 );')
    }
    const water = new Mesh(shape, look)
    water.receiveShadow = true
    return water
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
    return t >= 0 && this.slab[t] >= 0 && !this.fed[t] && !this.treat[t]
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
   * @param but one sheep that does not count: the one that is being leapt over
   */
  fits(self: Ewe | null, s: number, face: number, x: number, z: number, but: Ewe | null = null) {
    const r = this.scratch
    this.rects(s, face, x, z, r)
    for (let o = 0; o < 8; o += 4) {
      for (let k = 0; k < 4; k++) {
        const t = at(r[o + (k & 1)], r[o + 2 + (k >> 1)])
        if (t < 0 || LAND[t] !== 1 || BLOCK[t] || this.treat[t] || (KIND[t] === 3 && !o)) return false
      }
      for (const e of this.ewes) {
        if (e === self || e === but) continue
        for (let p = 0; p < 8; p += 4) if (r[o] < e.rect[p + 1] + 0.04 && r[o + 1] > e.rect[p] - 0.04 && r[o + 2] < e.rect[p + 3] + 0.04 && r[o + 3] > e.rect[p + 2] - 0.04) return false
      }
      for (const dog of this.dogs) if (r[o] < dog.rect[1] + 0.04 && r[o + 1] > dog.rect[0] - 0.04 && r[o + 2] < dog.rect[3] + 0.04 && r[o + 3] > dog.rect[2] - 0.04) return false
    }
    return true
  }

  /** A sheep, and its cubes: `owner` is what `pick` says for them. Its seed gives its nature; its look, or else its seed, its wool. */
  private ewe(entry: Entry, owner: number, s: number, x: number, z: number, face: number): Ewe {
    const { seed } = entry
    const cubes = limbs(this.flock, owner)
    const e: Ewe = {
      entry, s, nature: NATURES[Math.floor(rnd(seed * 7 + 3) * 4)], x, z, base: 1, y: 1, face, state: 'idle', goal: 'wander',
      timer: 0.5 + this.chance() * 5, tx: 0, tz: 0, sideways: false, want: -1, hunger: this.chance(), thirst: this.chance(), blocked: 0, tries: 0, pace: 0.6 + 0.25 * rnd(seed * 7 + 7), v: 0,
      stride: 0, hop: 0, wait: 0, nod: 0, lie: 0, air: 0, fall: 0, high: 0, wear: [], friend: null, mate: null, lead: false, fun: 0, cool: 0, rush: 1, laps: 0, prize: -1, gazed: -1, ate: 0, crown: 0, rider: -1, dry: 0, napped: 0, sniff: false, over: null, leapt: 0, from: [0, 0, 0, 0, 0.5], lark: false, vexed: null, frogs: 0, pinned: 0, say: '', said: 0, wool: 0, cubes, rect: new Float64Array(8), mark: NaN, sized: -1,
    }
    this.rects(s, face, x, z, e.rect)
    clothe(this.flock, e, seed, entry.look)
    return e
  }

  /** The place nearest to (x, z) where a sheep of this size, looking this way, fits; or null, if there is none. */
  private spot(self: Ewe | null, s: number, face: number, x: number, z: number, tries = 900): [number, number] | null {
    for (let k = 0; k < tries; k++) {
      const px = x + Math.cos(k * 2.4) * k * 0.06
      const pz = z + Math.sin(k * 2.4) * k * 0.06
      if (this.fits(self, s, face, px, pz)) return [px, pz]
    }
    return null
  }

  /** Puts a sheep in the field, at the spot its seed gives or the nearest one that is free. @returns its place in `ewes` */
  private arrive(entry: Entry) {
    const { seed } = entry
    const [s, face] = [0.8 + 0.2 * rnd(seed * 7 + 2), Math.floor(rnd(seed * 7 + 6) * 4)]
    const [x, z] = this.spot(null, s, face, (rnd(seed * 7 + 4) * 2 - 1) * 12, -3 + rnd(seed * 7 + 5) * 16) ?? [0, 0]
    const e = this.ewe(entry, this.ewes.length, s, x, z, face)
    this.ewes.push(e)
    if (e.entry.look?.elder) this.elders.push(e)
    this.pet(e)
    this.draw(e)
    return this.ewes.length - 1
  }

  /** Whether there are cubes for one more sheep. */
  room() {
    return !!this.spare || this.flock.count + SLOTS <= this.most
  }

  /** One more sheep, straight into the field at the spot its seed gives. @returns its place in `ewes`, or -1 if there is no room */
  add(entry: Entry) {
    return this.flock.count + SLOTS <= this.most ? this.arrive(entry) : -1
  }

  /**
   * A new sheep comes, to be dressed and then put down: it hangs in the air over the place nearest to (x, z) where it
   * could stand, looking at whoever is looking. It is not of the flock until it is dropped.
   * @returns false if there is no room for it
   */
  bring(entry: Entry, x = 0, z = 6) {
    this.dismiss()
    if (!this.room()) return false
    const s = 0.8 + 0.2 * rnd(entry.seed * 7 + 2)
    const e = this.spare ?? this.ewe(entry, -1, s, 0, 0, 0)
    this.spare = null
    Object.assign(e, { entry, s, nature: NATURES[Math.floor(rnd(entry.seed * 7 + 3) * 4)], pace: 0.6 + 0.25 * rnd(entry.seed * 7 + 7), air: ALOFT, fall: 0 })
    for (let k = 4; k < EWE.length; k++) this.flock.show(e.cubes[k])
    clothe(this.flock, e, entry.seed, entry.look)
    this.guest = e
    this.hang(x, z)
    return true
  }

  /** The sheep that hangs is given another look. */
  dress(look: Look) {
    if (!this.guest) return
    this.guest.entry = { ...this.guest.entry, look }
    clothe(this.flock, this.guest, this.guest.entry.seed, look)
  }

  /** The sheep that hangs is given its name and its words: the same sheep, with what its giver wrote. */
  sign(entry: Entry) {
    if (!this.guest) return
    this.guest.entry = entry
    clothe(this.flock, this.guest, entry.seed, entry.look)
  }

  /** The sheep that hangs goes to hang over the place nearest to (x, z) where it could stand: what is seen is where it would land. */
  hang(x: number, z: number) {
    const e = this.guest
    const where = e && this.spot(null, e.s, e.face, x, z)
    if (!e || !where) return
    ;[e.x, e.z] = where
    this.rects(e.s, e.face, e.x, e.z, e.rect)
  }

  /**
   * The sheep that hangs is let go: over the place nearest to (x, z) if given, else where it hangs. It falls out of the
   * sky, lands with a puff, and is one of the flock from now on. The place is nobody's to keep: it walks off soon enough.
   * @returns its place in `ewes`, or -1 if there was nowhere to put it
   */
  drop(x?: number, z?: number) {
    const e = this.guest
    if (!e) return -1
    this.hang(x ?? e.x, z ?? e.z)
    if (!this.fits(null, e.s, e.face, e.x, e.z)) return -1
    this.guest = null
    for (const c of e.cubes) this.flock.owner[c] = this.ewes.length
    Object.assign(e, { state: 'idle', goal: 'wander', timer: 2 + this.chance() * 2, air: Math.max(e.air, 0.01), high: Math.max(e.air, 0.01), fall: 0 })
    this.ewes.push(e)
    if (e.entry.look?.elder) this.elders.push(e)
    this.pet(e)
    return this.ewes.length - 1
  }

  /** The sheep that hangs is not wanted after all: it goes, and its cubes wait for the next. */
  dismiss() {
    const e = this.guest
    if (!e) return
    for (const c of e.cubes) this.flock.hide(c)
    this.spare = e
    this.guest = null
  }

  /** Which sheep a cube of the flock belongs to: its place in `ewes`, `HERMIT` for the one in the cave, or -1. */
  pick(instance: number | undefined) {
    return instance === undefined ? -1 : this.flock.owner[instance]
  }

  /** A sheep that is awake gives a hop: it has been clicked, or a friend has come up. */
  glad(i: number) {
    if (i === DOOR) return this.knock()
    const e = i === HERMIT ? this.hermit : this.ewes[i]
    if (e && e.state !== 'sleep' && e.lie < 0.05 && e.hop <= 0 && !e.pinned) e.hop = GLAD // (not with somebody in the air over it)
  }

  /** Whether a cube of the ground is the door's. */
  portal(instance: number | undefined) {
    return instance !== undefined && this.ground.owner[instance] === DOOR
  }

  /** A knock at the door. It is locked: it rattles on its hinges, a little dust comes off it, and that is all. */
  knock() {
    for (const c of this.door.cubes) this.ground.poke(c, 3)
    for (let k = 0; k < 5; k++) this.bits.spawn(this.door.x + any() * 0.5, 2.1, this.door.z + 0.1, any() * 0.8, 0.5 + Math.random() * 0.6, 0.4 + Math.random() * 0.5, 0.08, 0xd9d2e0, 0.6, 2, 0, 3)
  }

  /** What the door is, as a label would say it. */
  latch() {
    return 'a locked door'
  }

  /** What a sheep is doing, as it would say it. */
  doing(e: Ewe) {
    if (e === this.hermit) return 'at home in its cave'
    if (e.state === 'sleep') return 'asleep'
    if (e.state === 'eat') return e.sniff ? 'smelling a flower' : 'grazing'
    if (e.state === 'splash') return 'splashing about'
    if (e.state === 'leap') return 'leaping over a friend'
    if (e.vexed) return 'leaping over a friend' // (it is about to: the stamp is the start of it)
    if (e.rider >= 0) return 'minding a duck'
    if (e.state === 'drink') return 'having a drink'
    if (e.state === 'idle' || e.goal === 'back') return 'standing about' // (making itself room is part of standing about)
    if (e.goal === 'graze' && Math.abs(e.tx - e.x) + Math.abs(e.tz - e.z) < 2) return 'grazing' // (a step or two to the grass is grazing already)
    return { wander: 'wandering', graze: 'off to graze', drink: 'off for a drink', wade: 'off for a paddle', follow: 'following a friend', nose: 'being nosy', zoom: 'having the zoomies', flee: 'playing chase', chase: 'playing chase', treat: 'off for a snack', nap: 'off to nap by a friend', poke: 'off to wake somebody', vault: 'leaping over a friend', visit: 'off to keep the old one company' }[e.goal]
  }

  /** The highest the ground is under a square of ground. */
  private under(x: number, z: number, half: number) {
    return Math.max(this.height(x - half, z - half), this.height(x + half, z - half), this.height(x - half, z + half), this.height(x + half, z + half))
  }

  /** Puts a sheep's cubes where it is (see `pose` in `model.ts`): on the ground it stands on, or, all of it in the brook, in the water up to its wool and not over it on stilts. */
  private draw(e: Ewe) {
    // (One that is leaping is in the air over a stretch of ground it keeps for itself, feet tucked: see `leap`.)
    if (e.over) return pose(this.flock, e, this.time, e.base, this.level)
    let wading = e.base === 1
    for (let k = 0; k < 8; k++) if (KIND[at(e.rect[(k & 4) + (k & 1)], e.rect[(k & 4) + 2 + ((k >> 1) & 1)])] !== 2) wading = false
    pose(this.flock, e, this.time, e.base - (wading ? 0.3 : 0), this.foot)
  }
  private foot = (x: number, z: number, half: number) => this.under(x, z, half)
  private level = () => 1

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
    if (e.mate && this.play(e)) return // (in the middle of a game: on with it)
    const { friend } = e
    if (friend && e.goal === 'poke' && friend.state === 'sleep' && Math.hypot(friend.x - e.x, friend.z - e.z) < 2.2) {
      // It came to wake a sleeper, and has: the sleeper starts up with a hop, and is not asked what it thinks.
      Object.assign(friend, { state: 'idle', timer: 1.5, hop: GLAD })
      this.think(friend, 'gasp')
      this.think(e, 'smile')
      this.did.poke++
    } else if (friend?.old && e.goal === 'visit') {
      // It came to be with a very old sheep, and is: a small hop, and what it thinks of her. It stays a good while.
      if (Math.hypot(friend.x - e.x, friend.z - e.z) < BESIDE + 0.6) {
        e.hop = GLAD
        this.fondly(e)
        least += 2.5
      }
    } else if (friend && e.state === 'walk' && Math.hypot(friend.x - e.x, friend.z - e.z) < 1.8 && friend.state !== 'sleep' && !friend.pinned && !friend.over) {
      e.hop = GLAD
      if (!friend.old) friend.hop = GLAD
      this.bits.spawn((e.x + friend.x) / 2, 2, (e.z + friend.z) / 2, any() * 0.2, 0.9, any() * 0.2, 0.13, 0xff8fb0, 1.2, NEVER, 0, -0.4)
    }
    e.friend = null
    e.state = 'idle'
    e.goal = 'wander'
    e.rush = 1
    e.timer = least + 4.5 + this.chance() * 7 // (a good while: a sheep that has stopped has stopped)
  }

  /** A sheep by a very old one shows that it is fond of her: a heart, more often than not. */
  private fondly(e: Ewe) {
    const roll = this.chance()
    this.think(e, roll < 0.55 ? 'heart' : roll < 0.8 ? 'smile' : 'blush', 2)
    this.fond++
  }

  /** A sheep sets off for a place: across and then along, or the other way about, since it goes the way it looks. */
  private go(e: Ewe, x: number, z: number, goal: Ewe['goal'], want = -1) {
    // (Not if it cannot so much as begin: hemmed in where it stands, it stays as it is a while longer, and is not
    // said to be off anywhere. A game is another matter: who is chased or chasing tries whatever comes.)
    const sideways = want >= 0 ? !(want & 1) : Math.abs(x - e.x) > Math.abs(z - e.z)
    if (goal !== 'chase' && goal !== 'flee' && goal !== 'zoom' && e.state !== 'walk' && !this.begins(e, x, z, sideways)) {
      Object.assign(e, { state: 'idle', goal: 'wander', friend: null, timer: 2 + this.chance() * 4 })
      // (Then it makes itself room, as a sheep does that has walked up to a bank or a tree: it backs off half a
      // tile, if there is room behind it; or else it turns to look another way, if it can. And thinks again.)
      const [, fx, , fz] = TURNS[e.face]
      if (this.fits(e, e.s, e.face, e.x - fx * 0.25, e.z - fz * 0.25) && this.fits(e, e.s, e.face, e.x - fx * 0.5, e.z - fz * 0.5)) Object.assign(e, { state: 'walk', goal: 'back', tx: e.x - fx * 0.5, tz: e.z - fz * 0.5, want: -1, blocked: 0, tries: 0, timer: 4 })
      else for (const by of [2, 1, 3]) if (this.fits(e, e.s, (e.face + by) % 4, e.x, e.z)) return this.turn(e, (e.face + by) % 4), false
      return false
    }
    e.tx = x
    e.tz = z
    e.goal = goal
    e.want = want
    // (To somewhere it must look a given way, it comes the last of the way looking so; else the longer way first.)
    e.sideways = sideways
    e.state = 'walk'
    e.blocked = 0
    e.vexed = null
    // (One that is only wandering gives up at the first thing in its way; one on an errand tries round it, twice.)
    e.tries = goal === 'wander' || goal === 'follow' || goal === 'nose' || goal === 'zoom' || goal === 'flee' || goal === 'chase' ? 0 : 2
    e.timer = 8 + (Math.abs(x - e.x) + Math.abs(z - e.z)) / 0.45 // what it may take to get there, and no longer
    return true
  }

  /** Whether a sheep can make the first move of a way: by one leg of it or the other, turn to it where it stands and take a step. */
  private begins(e: Ewe, x: number, z: number, sideways: boolean) {
    const [dx, dz] = [x - e.x, z - e.z]
    if (Math.abs(dx) <= 0.001 && Math.abs(dz) <= 0.001) return true
    for (let leg = 0; leg < 2; leg++) {
      const side = leg ? !sideways : sideways
      const left = side ? dx : dz
      if (Math.abs(left) <= 0.001) continue
      const face = side ? (dx > 0 ? 1 : 3) : dz > 0 ? 0 : 2
      const [, fx, , fz] = TURNS[face]
      const step = Math.min(Math.abs(left), 0.15)
      if ((face === e.face || this.fits(e, e.s, face, e.x, e.z)) && this.fits(e, e.s, face, e.x + fx * step, e.z + fz * step)) return true
    }
    return false
  }

  /** Whether a sheep is beside a very old one (and is not her). */
  private beside(e: Ewe) {
    for (const old of this.elders) if (old !== e && !old.air && Math.abs(old.x - e.x) < BESIDE && Math.abs(old.z - e.z) < BESIDE) return true
    return false
  }

  /**
   * A very old sheep is near, and a sheep with nothing to do may go and keep her company: to somewhere it can stand,
   * a step or two off her, at a walk. Not if six are with her or on their way already: she is not to be crowded.
   */
  private call(e: Ewe, goal: 'visit' | 'nap') {
    for (const old of this.elders) {
      if (old.air || Math.hypot(old.x - e.x, old.z - e.z) > 16) continue
      let about = 0
      for (const o of this.ewes) if (o !== old && o !== e && (o.friend === old ? o.goal === 'visit' || o.goal === 'nap' : Math.hypot(o.x - old.x, o.z - old.z) < BESIDE)) about++
      if (about >= 6) continue
      // (From a long way off it comes a few tiles at a time, by whatever way is open: a field is full of things.)
      const gap = Math.hypot(old.x - e.x, old.z - e.z)
      for (let k = 0; k < 8; k++) {
        const [turn, far] = [this.chance() * Math.PI * 2, 1.25 + this.chance() * 0.9]
        const [x, z] = gap > 6 ? [e.x + ((old.x - e.x) / gap) * 4 + Math.sin(turn) * 2, e.z + ((old.z - e.z) / gap) * 4 + Math.cos(turn) * 2] : [old.x + Math.sin(turn) * far, old.z + Math.cos(turn) * far]
        if (!this.fits(e, e.s, e.face, x, z)) continue
        if (!this.go(e, x, z, goal)) return true // (it meant to: that is its turn taken)
        e.friend = old
        return true
      }
    }
    return false
  }

  /**
   * What a very old sheep does, which is not much, and slowly: a long stand, a mouthful of the grass under her nose,
   * a few steps to somewhere near. By night she sleeps where she is. Now and then she thinks well of everybody.
   */
  private potter(e: Ewe) {
    if (this.dark > SLEEP) return void (e.state = 'sleep')
    const roll = this.chance()
    if (roll < 0.3) this.think(e, roll < 0.15 ? 'heart' : 'smile', 2.2)
    const [, fx, , fz] = TURNS[e.face]
    if (roll > 0.75 && this.long(e.x + fx * NOSE * e.s, e.z + fz * NOSE * e.s)) return this.graze(e)
    if (roll > 0.55)
      for (let k = 0; k < 4; k++) {
        const [x, z] = [e.x + (this.chance() - 0.5) * 4, e.z + (this.chance() - 0.5) * 4]
        if (this.fits(e, e.s, e.face, x, z)) return this.go(e, x, z, 'wander')
      }
    e.timer = 4 + this.chance() * 7
  }

  /** What a sheep's gift brought with it, if anything: its butterflies, or its dog (which is not there until the sheep is down). */
  private pet(e: Ewe) {
    const has = e.entry.look?.elder ? [] : (e.entry.look?.items ?? [])
    if (has.includes('butterflies')) this.flits.push({ owner: e, cubes: swarm(this.pets, e.entry.seed) })
    if (has.includes('dog')) this.dogs.push({ owner: e, s: 0.9 + 0.2 * rnd(e.entry.seed * 7 + 8), x: 0, y: 1, z: 0, face: 0, stride: 0, lie: 0, bark: 0, cubes: kennel(this.pets, e.entry.seed), rect: new Float64Array([1e9, 1e9, 1e9, 1e9]), state: 'away', timer: 0, tx: 0, tz: 0, t: 0, from: [0, 0, 0], shut: 0, across: false })
  }

  /**
   * Whether a dog can be there, looking that way: the one rule of where a dog is, as `fits` is a sheep's. All of it
   * over level grass (it does not wade), clear of whatever stands in the field, of every sheep, and of every other dog.
   */
  sits(dog: Dog, face: number, x: number, z: number) {
    const [wide, deep] = face & 1 ? [PUP_LONG * dog.s, PUP_WIDE * dog.s] : [PUP_WIDE * dog.s, PUP_LONG * dog.s]
    const [x0, x1, z0, z1] = [x - wide, x + wide, z - deep, z + deep]
    for (let k = 0; k < 4; k++) {
      const t = at(k & 1 ? x1 : x0, k & 2 ? z1 : z0)
      if (t < 0 || LAND[t] !== 1 || KIND[t] !== 1 || BLOCK[t] || this.treat[t]) return false
    }
    for (const e of this.ewes) for (let p = 0; p < 8; p += 4) if (x0 < e.rect[p + 1] + 0.04 && x1 > e.rect[p] - 0.04 && z0 < e.rect[p + 3] + 0.04 && z1 > e.rect[p + 2] - 0.04) return false
    for (const o of this.dogs) if (o !== dog && x0 < o.rect[1] + 0.04 && x1 > o.rect[0] - 0.04 && z0 < o.rect[3] + 0.04 && z1 > o.rect[2] - 0.04) return false
    return true
  }

  /** A dog is put there, looking that way: the ground it keeps is that ground. */
  private kennel(dog: Dog, face: number, x: number, z: number) {
    const [wide, deep] = face & 1 ? [PUP_LONG * dog.s, PUP_WIDE * dog.s] : [PUP_WIDE * dog.s, PUP_LONG * dog.s]
    Object.assign(dog, { face, x, z })
    dog.rect[0] = x - wide
    dog.rect[1] = x + wide
    dog.rect[2] = z - deep
    dog.rect[3] = z + deep
  }

  /** Somewhere a dog fits, as near to (x, z) as there is within a tile or two: there (in `tx`, `tz`), or false. */
  private berth(dog: Dog, x: number, z: number) {
    for (let k = 0; k < 60; k++) {
      const [px, pz] = [x + Math.cos(k * 2.4) * k * 0.04, z + Math.sin(k * 2.4) * k * 0.04]
      if (!this.sits(dog, dog.face, px, pz)) continue
      dog.tx = px
      dog.tz = pz
      return true
    }
    return false
  }

  /**
   * A dog, for a moment of its day. It is its sheep's: it keeps near it, behind it when the sheep is going somewhere,
   * and goes as the sheep go (at a hop, the way it looks, across and then along, no step that does not fit). Now and
   * then it barks at some other sheep, which looks round at it; now and then, when its sheep is standing, it jumps
   * up on its back, sits there a while, and jumps down again. When its sheep sleeps it lies down.
   */
  private heel(dog: Dog, dt: number) {
    const { owner } = dog
    const [, fx, , fz] = TURNS[owner.face]
    const far = Math.hypot(owner.x - dog.x, owner.z - dog.z)
    dog.bark = Math.max(0, dog.bark - dt)
    if (dog.state === 'away') {
      // Not here yet: it turns up beside its sheep once that is down on the grass.
      if (owner.air || !this.berth(dog, owner.x - fx, owner.z - fz)) return
      this.kennel(dog, owner.face, dog.tx, dog.tz)
      Object.assign(dog, { state: 'sit', timer: 1 + this.chance() * 2 })
    } else if (dog.state === 'jump' || dog.state === 'down') {
      // In the air, to its sheep's back or off it: by its own clock, up first and then across, over the top of the wool.
      const up = dog.state === 'jump'
      dog.t = Math.min(1, dog.t + dt / 0.5)
      const [bx, by, bz] = [owner.x - fx * 0.12 * owner.s, owner.y + 0.76 * owner.s, owner.z - fz * 0.12 * owner.s]
      const [gx, gy, gz] = dog.from
      // (Straight up beside its sheep to the height of its back, and only then across, over the top of it; and
      // down the same way the other way round. It is never level with the wool while it is over any of it.)
      const u = up ? dog.t : 1 - dog.t
      const across = Math.max(0, (u - 0.4) / 0.6)
      const k = up ? across : 1 - across
      const rise = Math.min(1, u * 2.5)
      dog.x = up ? gx + (bx - gx) * k : bx + (gx - bx) * k
      dog.z = up ? gz + (bz - gz) * k : bz + (gz - bz) * k
      dog.y = gy + (by - gy) * rise + Math.sin(dog.t * Math.PI) * 0.3
      owner.pinned = Math.max(owner.pinned, 0.2)
      if (dog.t >= 1 && up) Object.assign(dog, { state: 'up', timer: 2.5 + this.chance() * 2.5, lie: 1 })
      if (dog.t >= 1 && !up) Object.assign(dog, { state: 'sit', timer: 1 + this.chance() * 2, x: gx, y: 1, z: gz })
    } else if (dog.state === 'up') {
      // On its sheep's back, which stays as it is the while.
      Object.assign(dog, { x: owner.x - fx * 0.12 * owner.s, y: owner.y + 0.76 * owner.s, z: owner.z - fz * 0.12 * owner.s, face: owner.face })
      owner.pinned = Math.max(owner.pinned, 0.2)
      if ((dog.timer -= dt) <= 0 && this.berth(dog, owner.x - fx * 0.9, owner.z - fz * 0.9)) {
        dog.from = [dog.tx, 1, dog.tz]
        this.kennel(dog, dog.face, dog.tx, dog.tz) // (it keeps the ground it will come down on from now)
        Object.assign(dog, { state: 'down', t: 0, lie: 0, x: owner.x - fx * 0.12 * owner.s, z: owner.z - fz * 0.12 * owner.s })
      }
    } else if (owner.state === 'sleep') {
      // Its sheep is asleep: it finishes its step, and lies down where it is.
      dog.stride = 0
      Object.assign(dog, { state: 'sit', lie: Math.min(1, dog.lie + dt * 2) })
    } else if (dog.state === 'run') {
      dog.lie = 0
      const [dx, dz] = [dog.tx - dog.x, dog.tz - dog.z]
      const side = Math.abs(dz) < 0.02 || (dog.across && Math.abs(dx) >= 0.02)
      const left = side ? dx : dz
      const face = side ? (dx > 0 ? 1 : 3) : dz > 0 ? 0 : 2
      if ((Math.abs(dx) < 0.02 && Math.abs(dz) < 0.02) || (dog.timer -= dt) <= 0 || dog.shut > 0.7) Object.assign(dog, { state: 'sit', stride: 0, shut: 0, timer: 0.4 + this.chance() * 2.5 })
      else if (face !== dog.face) {
        // (It turns between two hops, standing, and only if it fits turned; else the other leg of the way first.)
        if (this.sits(dog, face, dog.x, dog.z)) this.kennel(dog, face, dog.x, dog.z)
        else [dog.across, dog.shut] = [!dog.across, dog.shut + 0.25]
        dog.stride = 0
      } else {
        const step = Math.min(Math.abs(left), 1.5 * Math.min(1, 0.4 + Math.abs(left)) * dt) * Math.sign(left)
        const [x, z] = [dog.x + (side ? step : 0), dog.z + (side ? 0 : step)]
        if (this.sits(dog, face, x, z)) {
          this.kennel(dog, face, x, z)
          dog.stride += Math.abs(step) * 3
          dog.shut = 0
        } else [dog.across, dog.shut, dog.stride] = [!dog.across, dog.shut + dt + 0.2, 0]
      }
    } else {
      // Sitting about. Off after its sheep if that has got away from it, or is coming this way; else, in a while,
      // one of the things a dog does.
      dog.lie = Math.max(0, dog.lie - dt * 3)
      dog.stride = 0
      dog.shut = Math.max(0, dog.shut - dt) // (with nowhere to go to just now, it does not ask again at once)
      const walking = owner.state === 'walk'
      if (dog.shut > 0 || ((dog.timer -= dt) > 0 && far < (walking ? 1.3 : 2.2) && !(walking && far < 0.9))) return hound(this.pets, dog, this.time)
      const roll = this.chance()
      const still = (owner.state === 'idle' || owner.state === 'eat') && !owner.lie && !owner.air && !owner.over && !owner.pinned && !owner.mate && !owner.vexed && !owner.hop && !owner.stride && owner.rider < 0
      dog.timer = 1.5 + this.chance() * 3
      if (!walking && roll < 0.22 && still && far < 1.3 && (dog.x - owner.x) * fx + (dog.z - owner.z) * fz < 0.2 && !this.ewes.some((one) => one.over) && (dog.face === owner.face || this.sits(dog, owner.face, dog.x, dog.z))) {
        // Up on its sheep's back. (Not from in front of it: that way is over its head.)
        dog.from = [dog.x, 1, dog.z]
        dog.rect.fill(1e9)
        Object.assign(dog, { state: 'jump', t: 0, face: owner.face })
        owner.pinned = 0.6
        this.rode++
      } else if (far < 2.2 && !walking && roll < 0.5) {
        // A bark at whoever else is near, which looks round to see what that was.
        let [who, gap]: [Ewe | null, number] = [null, 2.8]
        for (const o of this.ewes) {
          const d = Math.hypot(o.x - dog.x, o.z - dog.z)
          if (o !== owner && d < gap && o.state !== 'sleep' && !o.air && !o.over) [who, gap] = [o, d]
        }
        if (who) {
          const face = turned(who.x - dog.x, who.z - dog.z)
          if (face !== dog.face && this.sits(dog, face, dog.x, dog.z)) this.kennel(dog, face, dog.x, dog.z)
          dog.bark = 0.9
          dog.timer = 1.6 + this.chance() * 2
          this.wuffed++
          if (who.state === 'idle' && !who.lie && !who.pinned && !who.mate && !who.vexed && who.rider < 0) {
            const round = turned(dog.x - who.x, dog.z - who.z)
            if (round !== who.face && !who.stride && this.fits(who, who.s, round, who.x, who.z)) this.turn(who, round)
            this.think(who, 'what', 1.2)
            who.timer = Math.max(who.timer, 1)
          }
        }
      } else {
        // After its sheep: to behind it if it is going somewhere, to somewhere beside it if it is not.
        const turn = this.chance() * Math.PI * 2
        const [x, z] = walking ? [owner.x - fx * 1.1 + (this.chance() - 0.5) * 0.6, owner.z - fz * 1.1 + (this.chance() - 0.5) * 0.6] : [owner.x + Math.sin(turn) * 1.1, owner.z + Math.cos(turn) * 1.1]
        if (this.berth(dog, x, z)) Object.assign(dog, { state: 'run', timer: 6, shut: 0, across: Math.abs(dog.tx - dog.x) > Math.abs(dog.tz - dog.z) })
        else dog.shut = 0.5
      }
    }
    hound(this.pets, dog, this.time)
  }

  /** A sheep that has nothing to do thinks of something. */
  private choose(e: Ewe) {
    if (e.mate && this.play(e)) return
    // Something to leap over, for the fun of it: whoever is standing or eating near by. The playful ones often,
    // anybody now and then. It goes and stands square on to its friend first, a step off; and of three or four that
    // do, one makes a game of leapfrog of it.
    // (A very old sheep goes her own way. The others, if she is near, may well go and be with her: by day to stand
    // by her, and one that is by her already as often as not stays; by night, once, to lie down near her.)
    if (e.old) return this.potter(e)
    if (this.elders.length && this.dark <= SLEEP) {
      if (this.beside(e)) {
        if (this.chance() < 0.85) {
          if (this.chance() < 0.5) this.fondly(e)
          return void (e.timer = 2 + this.chance() * 4)
        }
      } else if (this.chance() < 0.9 && this.call(e, 'visit')) return
    }
    if (this.elders.length && this.dark > SLEEP && !e.napped && !this.beside(e) && this.call(e, 'nap')) return void (e.napped = 2)
    if (this.dark < SLEEP && e.hunger < 1 && this.chance() < (e.nature === 'swimmer' ? 0.14 : 0.4)) {
      const friend = this.neighbour(e, 4.5)
      if (friend && this.still(friend)) {
        const face = turned(friend.x - e.x, friend.z - e.z)
        const [, fx, , fz] = TURNS[face]
        const [low, high] = fx ? [Math.min(friend.rect[0], friend.rect[4]), Math.max(friend.rect[1], friend.rect[5])] : [Math.min(friend.rect[2], friend.rect[6]), Math.max(friend.rect[3], friend.rect[7])]
        const along = fx + fz > 0 ? low - HEAD[2] * e.s - 0.1 : high + HEAD[2] * e.s + 0.1
        const [x, z] = fx ? [along, friend.z] : [friend.x, along]
        if (this.fits(e, e.s, face, x, z)) {
          if (this.go(e, x, z, 'vault', face)) Object.assign(e, { friend, frogs: this.chance() < 0.45 ? 2 : 0 })
          return
        }
      }
    }
    // A tuft of big grass in sight (by night, right beside it): off after it.
    const prize = this.scent(e)
    if (prize >= 0) return this.after(e, prize)
    const roll = this.chance()
    if (this.dark > SLEEP) {
      // Night. Once, before it lies down: one that is nosy goes to wake a sleeper; another may go and lie beside one.
      let friend: Ewe | null = null
      if (e.napped < 2) for (const one of this.ewes) if (one.state === 'sleep' && one.lie > 0.9 && Math.hypot(one.x - e.x, one.z - e.z) < (friend ? Math.hypot(friend.x - e.x, friend.z - e.z) : 9)) friend = one
      // (One that likes company, with nobody near asleep yet, stays up a little to see who lies down first.)
      if (!friend && !e.napped++ && (e.nature === 'follower' || e.nature === 'nosy')) return void (e.timer = 2.5 + this.chance() * 2)
      e.napped = 2
      if (friend?.state === 'sleep' && !friend.old && e.nature === 'nosy' && roll < 0.6) {
        e.friend = friend
        return this.go(e, friend.x + (this.chance() - 0.5) * 2.4, friend.z + (this.chance() - 0.5) * 2.4, 'poke')
      }
      if (friend?.state === 'sleep' && roll < 0.75) {
        // (Side by side: looking the way the sleeper looks, a sheep's width to one side of it.)
        const [ax, , az] = TURNS[friend.face]
        for (const side of [1, -1]) {
          const gap = side * (BODY[0] * (e.s + friend.s) + 0.12)
          if (this.fits(e, e.s, friend.face, friend.x + ax * gap, friend.z + az * gap)) return this.go(e, friend.x + ax * gap, friend.z + az * gap, 'nap', friend.face)
        }
      }
      e.state = 'sleep' // (no bubble for it: what it dreams goes up from it in small bits, and that says it)
      return
    }
    const [, fx, , fz] = TURNS[e.face]
    if (e.hunger > 1) {
      // Hungry: the grass under its nose, if that is long; else the nearest that is.
      if (this.long(e.x + fx * NOSE * e.s, e.z + fz * NOSE * e.s)) return this.graze(e)
      // (Somewhere it can stand with its nose over that grass: looking the way it looks if it can, else another.)
      let [best, gap, px, pz, way] = [-1, Infinity, 0, 0, 0]
      const reach = e.nature === 'greedy' ? 8 : 6
      for (let z = Math.round(e.z) - reach; z <= Math.round(e.z) + reach; z++)
        for (let x = Math.round(e.x) - reach; x <= Math.round(e.x) + reach; x++) {
          const far = Math.hypot(x - e.x, z - e.z)
          if (far >= gap || !this.long(x, z)) continue
          for (let k = 0; k < 4; k++) {
            const face = (e.face + k) % 4
            const [, i, , j] = TURNS[face]
            const [sx, sz] = [x - i * NOSE * e.s, z - j * NOSE * e.s]
            if (!this.fits(e, e.s, face, sx, sz)) continue
            ;[best, gap, px, pz, way] = [at(x, z), far, sx, sz, face]
            break
          }
        }
      if (best >= 0) return void this.go(e, px, pz, 'graze', way)
    } else if (e.thirst > 1) {
      // Thirsty: the nearest place on the bank that is free, to stand at with its head over the water. One that has
      // set off for a drink and not got there tries another part of the bank the next time (a third of it, a
      // different third each time), and every fourth time wanders off instead, to come at the water from elsewhere:
      // the nearest place is not always one it can get to, and it would try that one for ever.
      let [best, gap] = [-1, Infinity]
      if (e.dry % 4 !== 3)
        SHORE.forEach(([x, z, turn], k) => {
          const [, i, , j] = TURNS[turn]
          const [sx, sz] = [x + i * (0.5 - 0.41 * e.s), z + j * (0.5 - 0.41 * e.s)]
          const far = Math.hypot(sx - e.x, sz - e.z)
          if (far < gap && (!e.dry || k % 3 === e.dry % 3) && this.fits(e, e.s, turn, sx, sz)) [best, gap] = [k, far]
        })
      e.dry++
      if (best >= 0) {
        const [x, z, turn] = SHORE[best]
        const [, i, , j] = TURNS[turn]
        return this.go(e, x + i * (0.5 - 0.41 * e.s), z + j * (0.5 - 0.41 * e.s), 'drink', turn)
      }
    } else if (roll > 0.45 && this.bloomy[at(e.x + fx * NOSE * e.s, e.z + fz * NOSE * e.s)] && this.long(e.x + fx * NOSE * e.s, e.z + fz * NOSE * e.s)) {
      // A flower under its nose: it has a smell of it. (Before anything livelier: it thinks less often than it did.)
      Object.assign(e, { state: 'eat', sniff: true, timer: 2.4 })
      return
    } else if (roll < (e.nature === 'swimmer' ? 0.35 : 0.04)) {
      // A swimmer (and now and then anybody): into the brook, to splash about in it.
      const [x, z] = this.ford(e, e.x, e.z, -1)
      if (x < 99) return this.go(e, x, z, 'wade')
    } else if (roll > 0.88) {
      // The zoomies: a few fast runs to nowhere, ears up.
      e.laps = 2 + Math.floor(this.chance() * 2)
      this.think(e, 'spark')
      this.did.zoom++
      if (this.zoom(e)) return
    } else if (roll > (e.nature === 'nosy' || e.nature === 'follower' ? 0.6 : 0.76) && roll <= 0.88) {
      // A game of chase with whoever is near and has nothing better to do: it runs, this one runs after it, and at
      // every bump they change over.
      const friend = this.neighbour(e, 7)
      if (friend && !friend.old && !friend.mate && !friend.pinned && friend.rider < 0 && !friend.air && (friend.state === 'idle' || (friend.state === 'walk' && friend.goal === 'wander')) && !friend.lie && !friend.nod) {
        Object.assign(e, { mate: friend, lead: false, fun: 7 + this.chance() * 4, cool: 0 })
        Object.assign(friend, { mate: e, lead: true, fun: e.fun, cool: 0, friend: null })
        this.think(e, 'note')
        this.think(friend, 'sweat')
        this.did.chase++
        this.play(friend)
        this.play(e)
        return
      }
    } else if ((e.nature === 'follower' && roll < 0.55) || (e.nature === 'nosy' && roll < 0.4)) {
      const friend = this.neighbour(e, 12)
      if (friend?.state === 'splash') {
        // A friend is splashing in the brook: the nearest free stretch of it beside the friend will do nicely.
        const [x, z] = this.ford(e, friend.x, friend.z, at(friend.x, friend.z))
        if (x < 99) {
          this.did.join++
          return this.go(e, x, z, 'wade')
        }
      }
      if (friend) {
        e.friend = friend
        return this.go(e, friend.x + (this.chance() - 0.5) * 3, friend.z + (this.chance() - 0.5) * 3, e.nature === 'nosy' ? 'nose' : 'follow')
      }
    } else if (roll > 0.68 && roll <= 0.76) {
      // Or it only looks about: another way, if there is room to turn.
      const face = Math.floor(this.chance() * 4)
      if (this.fits(e, e.s, face, e.x, e.z)) this.turn(e, face)
      return void (e.timer = 3 + this.chance() * 5)
    }
    // Else anywhere a sheep could stand: a few tries.
    for (let k = 0; k < 6; k++) {
      const [x, z] = [e.x + (this.chance() - 0.5) * 10, e.z + (this.chance() - 0.5) * 10]
      if (this.fits(e, e.s, e.face, x, z)) return this.go(e, x, z, 'wander')
    }
    e.timer = 1
  }

  /** The page says which way the picture is looked at from (the camera's turn), and the bubbles face the nearest quarter turn to that. */
  watch(yaw: number) {
    this.facing = turned(Math.sin(yaw), Math.cos(yaw))
  }

  /** The page says whose thoughts are not to be shown: the sheep whose bubble with its name in is open (or -1), or everybody's. */
  hush(sheep: number, all: boolean) {
    this.shy = sheep
    this.mute = all
  }

  /**
   * The thought bubbles, every frame. One that is no longer wanted goes (its sheep has stopped thinking, or has a duck
   * on it or coming, or is asleep, or is not to be shown); a sheep that thinks something and has none takes a free
   * one; and each goes where its sheep is, over its head and up and down with it, bobbing and breathing a little.
   * So that it is in nothing: a bubble is no wider than a sheep by more than the gap sheep keep between them, and
   * floats higher than the top of any sheep at the top of any hop, so no sheep is ever in it; and it gives way (it is
   * not there) to another bubble too near, to a sheep coming down out of the sky near by, and to a duck on the wing.
   */
  private bubbles() {
    const { ground, thoughts } = this
    const by = (e: Ewe, x: number, z: number, near: number) => Math.abs(e.x - x) < near && Math.abs(e.z - z) < near
    const barred = (e: Ewe) => {
      if (e.said <= 0 || e.pinned || e.rider >= 0 || e.air > 0 || e.state === 'sleep' || this.mute || this.ewes[this.shy] === e) return true
      for (const bubble of thoughts) if (bubble.owner && bubble.owner !== e && by(e, bubble.owner.x, bubble.owner.z, 0.85) && (bubble.owner.said >= e.said || !thoughts.some((own) => own.owner === e))) return true
      for (const o of this.ewes) if (o.air > 0 && by(e, o.x, o.z, 1.3)) return true
      for (const duck of this.ducks) if ((duck.state === 'fly' || duck.state === 'home') && by(e, duck.x, duck.z, 1.4)) return true
      return false
    }
    for (const bubble of thoughts) {
      if (!bubble.owner || !barred(bubble.owner)) continue
      for (const c of bubble.cubes) ground.hide(c)
      bubble.owner = null
    }
    for (const e of this.ewes) {
      if (barred(e)) continue
      let [mine, free] = [false, -1]
      thoughts.forEach((bubble, k) => {
        if (bubble.owner === e) mine = true
        else if (!bubble.owner && free < 0) free = k
      })
      if (!mine && free >= 0) Object.assign(thoughts[free], { owner: e, say: '' })
    }
    const grow = 1.6 + 0.04 * Math.sin(this.time * 3)
    for (const bubble of thoughts) {
      const e = bubble.owner
      if (!e) continue
      const foot = Math.max(e.y + 1.06 * e.s + 0.3, 2.46) + 0.03 * Math.sin(this.time * 2) // (over its own head, and over everybody's)
      speak(ground, bubble.cubes, e.say, bubble.say !== e.say, e.x, foot, e.z, this.facing, grow)
      bubble.say = e.say
    }
  }

  /** Whether a sheep is one that can be leapt over: on its feet, standing or with its head down, with nothing else going on and nobody on it. */
  private still(o: Ewe) {
    return (o.state === 'idle' || o.state === 'eat' || o.state === 'drink') && !o.old && !o.over && !o.pinned && !o.vexed && !o.mate && o.rider < 0 && !o.air && !o.hop && !o.stride && !o.lie
  }

  /** The sheep that is in the way of a sheep that would be at (x, z), looking that way; or null. */
  private blocker(e: Ewe, face: number, x: number, z: number) {
    const r = this.scratch
    this.rects(e.s, face, x, z, r)
    for (const o of this.ewes) {
      if (o === e) continue
      for (let k = 0; k < 8; k += 4) for (let p = 0; p < 8; p += 4) if (r[k] < o.rect[p + 1] + 0.04 && r[k + 1] > o.rect[p] - 0.04 && r[k + 2] < o.rect[p + 3] + 0.04 && r[k + 3] > o.rect[p + 2] - 0.04) return o
    }
    return null
  }

  /**
   * A sheep leaps over another: up on to its back, a moment there, and down on the far side. Only over one that is
   * `still`, straight ahead (or nearly), with a place to come down just beyond it where the leaper fits and nothing
   * else on the way; one leap at a time in the whole field, and none while a duck is on the wing. From here until it
   * is down the leaper keeps the whole stretch of ground from where it is to where it lands (nobody walks in under
   * it), and the one underneath is `pinned`: it stays as it is.
   * @param lark whether it is for the fun of it (and not because the other was in the way)
   * @param dry only say whether it could, and do nothing
   * @returns whether it has set off
   */
  private leap(e: Ewe, o: Ewe, lark: boolean, dry = false) {
    if (!this.still(o) || e.old || e.rider >= 0 || e.mate || this.ewes.some((one) => one.over) || this.ducks.some((duck) => duck.state === 'fly' || duck.state === 'home')) return false
    const face = turned(o.x - e.x, o.z - e.z)
    const [, fx, , fz] = TURNS[face]
    // (How far to one side of its way the other is: with more than half a sheep of that, it is not in the way at all.)
    if (Math.abs((o.x - e.x) * fz - (o.z - e.z) * fx) > 0.45) return false
    if (face !== e.face && !this.fits(e, e.s, face, e.x, e.z)) return false
    const [low, high] = fx ? [Math.min(o.rect[0], o.rect[4]), Math.max(o.rect[1], o.rect[5])] : [Math.min(o.rect[2], o.rect[6]), Math.max(o.rect[3], o.rect[7])]
    const here = fx ? e.x : e.z
    const there = fx + fz > 0 ? high - BODY[1] * e.s + 0.1 : low + BODY[1] * e.s - 0.1
    const [x, z] = fx ? [there, e.z] : [e.x, there]
    if (Math.abs(there - here) > 3.4 || !this.fits(e, e.s, face, x, z)) return false
    for (let k = 1; k < 6; k++) if (!this.fits(e, e.s, face, e.x + ((x - e.x) * k) / 6, e.z + ((z - e.z) * k) / 6, o)) return false
    if (dry) return true
    if (face !== e.face) this.turn(e, face)
    // The ground it keeps: all of it, from here to there.
    const r = this.scratch
    this.rects(e.s, face, x, z, r)
    for (let k = 0; k < 8; k += 4) {
      e.rect[k] = e.rect[k + 4 - 2 * k] = Math.min(e.rect[0], e.rect[4], r[0], r[4])
      e.rect[k + 1] = Math.max(e.rect[1], e.rect[5], r[1], r[5])
      e.rect[k + 2] = Math.min(e.rect[2], e.rect[6], r[2], r[6])
      e.rect[k + 3] = Math.max(e.rect[3], e.rect[7], r[3], r[7])
    }
    e.rect.copyWithin(4, 0, 4)
    Object.assign(e, { state: 'leap', over: o, leapt: 0, v: 0, stride: 0, wait: 0, lark })
    e.from[0] = e.x
    e.from[1] = e.z
    e.from[2] = x
    e.from[3] = z
    e.from[4] = Math.min(0.8, Math.max(0.2, ((fx ? o.x : o.z) - here) / (there - here)))
    o.pinned = UP + ATOP + DOWN + 0.3
    this.did.leap++
    this.did[lark ? 'lark' : 'cross']++
    return true
  }

  /**
   * A leap, as it goes: by how long it has been going, so it is the same at any frame rate. Up (a crouch, straight up
   * to the height of the other's back and a little over before it goes forward at all, then on to it), a moment on
   * top with a bounce or two, and down the far side the same way about. However that works out, while any of it is
   * over the other it is no lower than the top of the other: it is never in it.
   */
  private vault(e: Ewe, dt: number) {
    const o = e.over!
    const ease = (t: number) => Math.min(1, Math.max(0, t)) ** 2 * (3 - 2 * Math.min(1, Math.max(0, t)))
    const top = o.y - 1 + (o.entry.look?.items?.some((on) => on === 'hat' || on === 'flowers') ? 1.06 : 0.9) * o.s + 0.03
    const was = e.leapt
    e.leapt += dt
    let [way, high] = [1, 0]
    e.lie = 0
    if (e.leapt < UP) {
      const u = e.leapt / UP
      way = e.from[4] * ease((u - 0.3) / 0.7)
      high = top * ease(u / 0.34) + 0.32 * Math.sin(Math.PI * u)
      e.lie = u < 0.2 ? 0.4 * Math.sin((Math.PI * u) / 0.2) : 0 // (the crouch)
    } else if (e.leapt < UP + ATOP) {
      way = e.from[4]
      high = top + 0.1 * Math.abs(Math.sin(((e.leapt - UP) / ATOP) * Math.PI * 2))
      if (was < UP) for (let k = 0; k < 4; k++) this.bits.spawn(e.x + any() * 0.4, o.y + o.s, e.z + any() * 0.4, any() * 1.2, 0.8, any() * 1.2, 0.07, 0xfffaf0, 0.4, NEVER, 0, 3)
    } else if (e.leapt < UP + ATOP + DOWN) {
      const u = (e.leapt - UP - ATOP) / DOWN
      way = e.from[4] + (1 - e.from[4]) * ease(u / 0.7)
      high = top * (1 - ease((u - 0.66) / 0.34)) + 0.32 * Math.sin(Math.PI * u)
    }
    e.x = e.from[0] + (e.from[2] - e.from[0]) * way
    e.z = e.from[1] + (e.from[3] - e.from[1]) * way
    if (e.leapt < UP + ATOP + DOWN) {
      // (Over the other, by so much as a hair: then no lower than its top.)
      const r = this.scratch
      this.rects(e.s, e.face, e.x, e.z, r)
      for (let k = 0; k < 8; k += 4) for (let q = 0; q < 8; q += 4) if (r[k] < o.rect[q + 1] + 0.05 && r[k + 1] > o.rect[q] - 0.05 && r[k + 2] < o.rect[q + 3] + 0.05 && r[k + 3] > o.rect[q + 2] - 0.05) high = Math.max(high, top)
      e.air = Math.max(0, high)
      return
    }
    // Down: its own ground again, a puff, and the one that was leapt over gives a hop, and has a face about it.
    const { lark } = e
    Object.assign(e, { air: 0, over: null, lie: 0, hop: GLAD })
    this.rects(e.s, e.face, e.x, e.z, e.rect)
    for (let k = 0; k < 5; k++) this.bits.spawn(e.x + any() * 0.6, 1.05, e.z + any() * 0.6, any() * 1.4, 0.5 + Math.random() * 0.6, any() * 1.4, 0.09, 0xfffaf0, 0.5, 1, 0.2)
    o.pinned = 0
    o.hop = GLAD
    this.think(o, lark ? 'smile' : 'gasp', 2)
    if (!lark && e.goal !== 'wander') {
      // On with what it was about.
      Object.assign(e, { state: 'walk', blocked: 0, timer: 8 + (Math.abs(e.tx - e.x) + Math.abs(e.tz - e.z)) / 0.45 })
      return
    }
    this.rest(e, 1)
    this.think(e, 'stars', 2)
    // Leapfrog: the one that was leapt over takes its turn, over this one, the same way; and so on down the line.
    if (lark && e.frogs > 0 && !e.mate && e.rider < 0) {
      Object.assign(o, { state: 'idle', vexed: e, lark: true, frogs: e.frogs - 1, timer: 0.7, goal: 'wander' })
      e.pinned = 1
      this.did.frog++
    }
    e.frogs = 0
  }

  /** A small picture comes up over a sheep's head for a moment, in a bubble: what it thinks of things. */
  private think(e: Ewe, what: string, time = 1.8) {
    e.say = what
    e.said = time
  }

  /** The stretch of the brook nearest to a place that a sheep could stand in, but for one tile; or somewhere far off, if there is none. */
  private ford(e: Ewe, px: number, pz: number, but: number) {
    let [best, gap] = [-1, 14]
    for (const [x, z] of BROOK) {
      const far = Math.hypot(x - px, z - pz)
      if (far < gap && at(x, z) !== but && LAND[at(x, z)] === 1 && !BLOCK[at(x, z)] && (this.fits(e, e.s, 0, x, z) || this.fits(e, e.s, 1, x, z))) [best, gap] = [at(x, z), far]
    }
    return best < 0 ? [99, 99] : [across(best), along(best)]
  }

  /** One fast run of the zoomies: to somewhere a few tiles off. @returns whether there was anywhere to run to */
  private zoom(e: Ewe) {
    for (let k = 0; k < 6; k++) {
      const [x, z] = [e.x + (this.chance() - 0.5) * 9, e.z + (this.chance() - 0.5) * 9]
      if (Math.hypot(x - e.x, z - e.z) < 2 || !this.fits(e, e.s, e.face, x, z)) continue
      this.go(e, x, z, 'zoom')
      e.rush = 1.9
      return true
    }
    return false
  }

  /**
   * The next move of a sheep that is playing chase: the one that leads runs off somewhere, the other runs at it. The
   * game is over when its time is up, when night comes, or when the other has left it.
   * @returns whether the game goes on
   */
  private play(e: Ewe) {
    const { mate } = e
    if (!mate || mate.mate !== e || e.fun <= 0 || this.dark > SLEEP || mate.state === 'sleep') return this.part(e), false
    if (!e.lead) this.go(e, mate.x, mate.z, 'chase')
    else if (!this.zoom(e)) return Object.assign(e, { state: 'idle', timer: 0.4 }), true // (nowhere to run to: in a moment, then)
    e.goal = e.lead ? 'flee' : 'chase'
    e.rush = e.lead ? 1.7 : 1.85
    return true
  }

  /** Two that were playing let go of each other: both of them, whichever it was that stopped. */
  private part(e: Ewe) {
    const { mate } = e
    Object.assign(e, { mate: null, lead: false, rush: 1 })
    if (mate?.mate !== e) return
    Object.assign(mate, { mate: null, lead: false, rush: 1 })
    if (mate.state === 'walk' && (mate.goal === 'flee' || mate.goal === 'chase')) this.rest(mate, 0.5)
  }

  /**
   * Whether a tuft of big grass could be put on the tile at (x, z): dry ground of any height, grass, rock or snow, with
   * nothing standing on it (flowers do not count: they make room), no tuft, and no part of a sheep over it. A sheep
   * beside it is no matter.
   */
  plantable(x: number, z: number) {
    const t = at(x, z)
    if (t < 0 || KIND[t] !== 1 || !this.bare[t] || this.treat[t]) return false
    if (LAND[t] !== 1) return true
    const [cx, cz] = [Math.round(x), Math.round(z)]
    const over = (r: Float64Array) => (r[0] < cx + 0.5 && r[1] > cx - 0.5 && r[2] < cz + 0.5 && r[3] > cz - 0.5) || (r[4] < cx + 0.5 && r[5] > cx - 0.5 && r[6] < cz + 0.5 && r[7] > cz - 0.5)
    for (const e of this.ewes) if (over(e.rect)) return false
    for (const dog of this.dogs) if (dog.rect[0] < cx + 0.5 && dog.rect[1] > cx - 0.5 && dog.rect[2] < cz + 0.5 && dog.rect[3] > cz - 0.5) return false
    return !this.guest || !over(this.guest.rect)
  }

  /**
   * A click on the land at (x, y, z) plants a tuft of big grass: on the tile that was clicked if one can go there, and
   * else on the nearest that can, within three tiles (so a click on the pond plants on its bank, and one on a sheep
   * beside the sheep). Only where there is nowhere at all near does a small puff say no. Every eighth is a golden one.
   * With all of them standing the oldest goes, to make room. Whoever is asleep right beside it wakes with a start; and
   * the nearest few that notice run for it.
   * @param now the time by the clock on the wall, in seconds: two tufts are never planted within `PAUSE` of each other,
   * however slowly the picture is being drawn
   * @returns which tuft it is, or -1 if none was planted
   */
  plant(x: number, y: number, z: number, now = performance.now() / 1000) {
    if (now - this.sown < PAUSE && now >= this.sown) return -1
    let [best, gap] = [-1, 3]
    for (let j = Math.round(z) - 3; j <= Math.round(z) + 3; j++)
      for (let i = Math.round(x) - 3; i <= Math.round(x) + 3; i++) {
        const far = Math.hypot(i - x, j - z)
        if (far < gap && this.plantable(i, j)) [best, gap] = [at(i, j), far]
      }
    if (best < 0) {
      for (let k = 0; k < 4; k++) this.bits.spawn(x, y + 0.15, z, any() * 1.2, 0.8 + Math.random() * 0.6, any() * 1.2, 0.08, 0xd9d2e0, 0.45, NEVER, 0, 4)
      return -1
    }
    this.sown = now
    let tuft = this.treats.find((one) => one.t < 0)
    if (!tuft) {
      tuft = this.treats.reduce((old, one) => (one.born < old.born ? one : old))
      this.wilt(tuft)
    }
    const t = best
    const [cx, cz, h] = [across(t), along(t), LAND[t]]
    Object.assign(tuft, { t, left: RIPE, born: this.time, gold: (++this.planted + this.first) % 8 === 0 })
    this.treat[t] = 1
    for (const c of this.blades.get(t) ?? []) this.ground.hide(c)
    TREAT.forEach(([dx, dy, dz, , sy, , ink], i) => {
      const c = tuft.cubes[i]
      this.ground.place(c, cx + dx, h + dy + sy / 2, cz + dz)
      this.ground.bendy(c, 0.6, h, cx, cz)
      this.ground.paint(c, tuft.gold ? 0xffd45c : ink, tuft.gold ? 1.5 : 1)
      this.ground.show(c, i * 0.05) // (each blade springs up a moment after the last, with the bounce every cube has)
    })
    for (let k = 0; k < 6; k++) this.bits.spawn(cx + any() * 0.6, h + 0.3, cz + any() * 0.6, any(), 1 + Math.random(), any(), 0.07, tuft.gold ? 0xffe38a : 0xffffff, 0.6, NEVER, 0, 2, 2.5)
    // Asleep right beside it: up with a start. (It will go back to sleep, once it has seen about the grass.)
    for (const e of this.ewes) {
      if (e.state !== 'sleep' || Math.abs(e.x - cx) > 2.3 || Math.abs(e.z - cz) > 2.3) continue
      Object.assign(e, { state: 'idle', timer: 0.6, hop: GLAD })
      this.think(e, 'bang')
      this.did.wake++
    }
    // Who notices at once: whoever is awake, with nothing on, near enough (the greedy from further off). The nearest three.
    const keen = this.ewes
      .filter((e) => !e.mate && !e.pinned && e.rider < 0 && !e.air && !e.lie && (e.state === 'idle' || (e.state === 'walk' && e.goal !== 'drink' && e.goal !== 'treat')) && Math.hypot(e.x - cx, e.z - cz) < (e.nature === 'greedy' ? 13 : 7))
      .sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz))
    for (const e of keen.slice(0, 3)) this.after(e, this.treats.indexOf(tuft))
    return this.treats.indexOf(tuft)
  }

  /** A sheep sets off at a run for a tuft. */
  private after(e: Ewe, prize: number) {
    const { t, born } = this.treats[prize]
    // (One up on the hill or the rock cannot be got at: it runs to the nearest place it can stand, and looks up at it.)
    const [x, z] = LAND[t] === 1 ? [across(t), along(t)] : (this.spot(e, e.s, e.face, across(t), along(t)) ?? [e.x, e.z])
    this.go(e, x, z, 'treat')
    Object.assign(e, { prize, rush: 1.8, friend: null, gazed: LAND[t] === 1 ? e.gazed : born })
    this.think(e, 'bang')
    if (e.ate > 0) this.did.trail++ // (straight from the last one to the next: it is following a trail of them)
  }

  /** The tuft a sheep with nothing to do notices: the nearest that stands within its sight and has fewer than four after it already; or -1. */
  private scent(e: Ewe) {
    // (By night only one that is right by it: the rest would sooner sleep.)
    let [best, gap] = [-1, this.dark > SLEEP ? 3.5 : e.nature === 'greedy' ? 13 : 7]
    this.treats.forEach((tuft, k) => {
      const far = tuft.t < 0 || tuft.born === e.gazed ? 99 : Math.hypot(across(tuft.t) - e.x, along(tuft.t) - e.z) // (not one it has already been to look at)
      if (far >= gap) return
      let crowd = 0
      for (const o of this.ewes) if (o.goal === 'treat' && o.prize === k) crowd++
      if (crowd < 4) [best, gap] = [k, far]
    })
    return best
  }

  /** A tuft of big grass goes: eaten, or gone over. What grew on its tile before is there again. */
  private wilt(tuft: Sheep['treats'][number]) {
    for (const c of tuft.cubes) this.ground.hide(c)
    if (!this.fed[tuft.t]) for (const c of this.blades.get(tuft.t) ?? []) this.ground.show(c)
    this.treat[tuft.t] = 0
    tuft.t = -1
  }

  /**
   * A sheep that is after a tuft: if the tuft has gone it is put out, and says so; if it stands with its nose at it, it
   * has won, and eats it at once with a hop.
   */
  private sniffs(e: Ewe) {
    const tuft = this.treats[e.prize]
    if (!tuft || tuft.t < 0) {
      this.think(e, 'oh')
      this.did.sigh++
      return this.rest(e, 0.8)
    }
    const [, fx, , fz] = TURNS[e.face]
    if (LAND[tuft.t] !== 1 || at(e.x + fx * (HEAD[2] * e.s + 0.14), e.z + fz * (HEAD[2] * e.s + 0.14)) !== tuft.t) return
    const [x, z, gold, prize] = [across(tuft.t), along(tuft.t), tuft.gold, e.prize]
    this.wilt(tuft)
    this.bite(x, z)
    for (let k = 0; k < 8; k++) this.bits.spawn(x + any() * 0.5, 1.2, z + any() * 0.5, any() * 2, 1.5 + Math.random() * 1.5, any() * 2, 0.1, gold ? 0xffd45c : 0x4fd391, 0.7, 1, 0.2)
    e.hunger = 0
    this.rest(e, 1.6)
    Object.assign(e, { hop: GLAD, ate: 8 })
    this.think(e, 'grass', 2.2)
    this.did.treat++
    if (e.nature === 'nosy') {
      // A nosy one had a smell of it first: petals go up, and that is what it thinks of.
      for (let k = 0; k < 5; k++) this.bits.spawn(x, 1.3, z, any() * 1.4, 1 + Math.random(), any() * 1.4, 0.08, PETALS[k], 1.2, 1, 0, 3)
      this.think(e, 'flower', 2.2)
      this.did.posy++
    }
    for (const o of this.ewes) {
      if (o === e) continue
      const far = Math.hypot(o.x - x, o.z - z)
      if (o.goal === 'treat' && o.prize === prize && far < 2.2) {
        // Beaten to it by a nose: the two of them bump, and this one hops with the bother of it.
        this.rest(o, 0.8)
        o.hop = GLAD
        this.think(o, 'sweat')
        this.did.tussle++
      } else if (gold && far < 5 && o.state !== 'sleep' && !o.lie && !o.pinned && !o.over) {
        // A golden one: everybody near is glad of it, whoever got it.
        o.hop = GLAD
        this.think(o, 'heart')
      }
    }
    if (gold) {
      e.crown = 5
      this.think(e, 'stars', 2.5)
      this.did.gold++
    }
  }

  /** A splash where a sheep stands in the brook: drops up and out, and a ring of white on the water. */
  private splash(e: Ewe) {
    for (let k = 0; k < 7; k++) this.bits.spawn(e.x + any() * 0.5, 1, e.z + any() * 0.5, any() * 2.2, 1.6 + Math.random() * 1.6, any() * 2.2, 0.09, k & 1 ? 0xffffff : 0x9fd6ff, 0.7, 0.94, 0)
    for (let k = 0; k < 6; k++) this.bits.spawn(e.x, 0.97, e.z, Math.cos(k * 1.05) * 0.9, 0, Math.sin(k * 1.05) * 0.9, 0.07, 0xffffff, 0.5, NEVER, 0, 0)
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
    e.sniff = false
    e.rush = 1
    e.timer = (e.nature === 'greedy' ? 8.5 : 6) + this.chance() * 4 // (a good long mouthful)
  }

  /** A sheep has got where it was going. */
  private arrived(e: Ewe) {
    const [, fx, , fz] = TURNS[e.want >= 0 ? e.want : e.face]
    const [hx, hz] = [e.x + fx * NOSE * e.s, e.z + fz * NOSE * e.s]
    if (e.goal === 'vault') {
      // Square on to its friend: over it goes, if it still can. (Else it only stands there, as if that was the plan.)
      const { friend } = e
      e.friend = null
      if (friend && this.leap(e, friend, true)) return
      return this.rest(e, 0.5)
    }
    if (e.goal === 'graze' && this.long(hx, hz)) {
      if (e.want >= 0 && e.face !== e.want) {
        if (!this.fits(e, e.s, e.want, e.x, e.z)) return this.rest(e)
        this.turn(e, e.want)
      }
      return this.graze(e)
    }
    if (e.goal === 'drink' && this.height(hx, hz) < 1) {
      if (e.face !== e.want) {
        if (!this.fits(e, e.s, e.want, e.x, e.z)) return this.rest(e)
        this.turn(e, e.want)
      }
      e.state = 'drink'
      e.goal = 'wander'
      e.timer = 6 + this.chance() * 3
      // A duck may take it for somewhere to sit: the first one that is only swimming flies over.
      const duck = this.chance() < 0.6 && !e.old && !this.ewes.some((one) => one.over) ? this.ducks.find((one) => one.state === 'swim' && one.brook < 0) : undefined
      if (duck) {
        Object.assign(duck, { state: 'fly', t: 0, fx: duck.x, fy: duck.y, fz: duck.z, on: e })
        e.rider = this.ducks.indexOf(duck)
      }
      return
    }
    if (e.goal === 'zoom' && --e.laps > 0 && this.zoom(e)) return
    if (e.goal === 'treat') {
      // As near as it can get to a tuft that is up out of reach: it looks up at it, wonders, and gives a hop.
      const tuft = this.treats[e.prize]
      const face = tuft && tuft.t >= 0 ? turned(across(tuft.t) - e.x, along(tuft.t) - e.z) : e.face
      if (face !== e.face && this.fits(e, e.s, face, e.x, e.z)) this.turn(e, face)
      this.rest(e, 1.5)
      e.hop = GLAD
      this.think(e, 'what', 2.2)
      this.did.gaze++
      return
    }
    if (e.goal === 'nap') {
      // Beside its friend, looking the same way if there is room to turn, it lies down.
      // (One that came to lie near a very old sheep looks whichever way it came.)
      if (e.want >= 0 && e.face !== e.want && this.fits(e, e.s, e.want, e.x, e.z)) this.turn(e, e.want)
      Object.assign(e, { state: 'sleep', goal: 'wander', friend: null })
      this.think(e, 'blush')
      this.did.nap++
      return
    }
    if (e.goal === 'wade' && KIND[at(e.x, e.z)] === 2) {
      // In the brook: it splashes about, a hop and a splash at a time.
      Object.assign(e, { state: 'splash', goal: 'wander', timer: 4 + this.chance() * 2.5 })
      this.think(e, 'drop')
      this.did.splash++
      // And whoever is near with nothing to do may come and splash beside it.
      let friend: Ewe | null = null
      for (const one of this.ewes) {
        const free = one !== e && !one.mate && !one.pinned && one.rider < 0 && !one.air && !one.lie && !one.nod && (one.state === 'idle' || (one.state === 'walk' && one.goal === 'wander'))
        if (free && Math.hypot(one.x - e.x, one.z - e.z) < (friend ? Math.hypot(friend.x - e.x, friend.z - e.z) : 10)) friend = one
      }
      const [x, z] = friend ? this.ford(friend, e.x, e.z, at(e.x, e.z)) : [99, 99]
      if (friend && x < 99) {
        this.go(friend, x, z, 'wade')
        this.think(friend, 'bang')
        this.did.join++
      }
      return
    }
    this.rest(e, 0.5)
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
    if (e.goal === 'back') {
      // Backing off: the one time it does not go the way it looks. Slowly, a step at a time, and no further than fits.
      const far = Math.hypot(dx, dz)
      const step = Math.min(far, e.pace * (e.old ? 0.3 : 0.5) * dt)
      const [x, z] = far > 0.001 ? [e.x + (dx / far) * step, e.z + (dz / far) * step] : [e.x, e.z]
      if (far <= 0.001 || !this.fits(e, e.s, e.face, x, z)) return this.rest(e, 0), false
      e.x = x
      e.z = z
      e.stride += step * STEPS
      this.rects(e.s, e.face, x, z, e.rect)
      return true
    }
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
      else if (e.tries-- > 0 && wide && deep) Object.assign(e, { sideways: !e.sideways, blocked: 0, wait: 0.5 })
      else this.rest(e, 0.4)
    }
    if (face !== e.face) {
      if (e.stride) return false // (it lands first)
      if (this.fits(e, e.s, face, e.x, e.z)) this.turn(e, face)
      else balk()
      return false
    }
    const far = Math.abs(left)
    // (A very old sheep goes at a third of the pace; and nobody runs past her.)
    const haste = e.old ? 0.3 : e.rush > 1 && this.elders.length && this.beside(e) ? 1 : e.rush
    e.v += (e.pace * haste * Math.min(1, 0.3 + far / 0.6) - e.v) * Math.min(1, dt * 5)
    const step = Math.min(far, e.v * dt) * Math.sign(left)
    const [x, z] = [e.x + (side ? step : 0), e.z + (side ? 0 : step)]
    if (!this.fits(e, e.s, face, x, z)) {
      // Shut, and not for the first time, by a sheep that is only standing there: it loses patience. A stamp, a face
      // like thunder, and in a moment it will go over the top. (It keeps its errand: it means to go on with it.)
      const o = e.blocked && !e.mate ? this.blocker(e, face, x, z) : null
      // (Only if it could go over: else it would stamp, find it cannot, stand about, and stamp again.)
      if (o && this.still(o) && this.chance() < 0.6 && this.leap(e, o, false, true)) {
        Object.assign(e, { state: 'idle', vexed: o, lark: false, timer: 0.8, hop: GLAD })
        this.think(e, 'oh', 0.8)
        return false
      }
      return balk(), false
    }
    const hops = Math.floor(e.stride)
    e.x = x
    e.z = z
    e.stride += Math.abs(step) * STEPS
    e.blocked = 0
    this.rects(e.s, face, x, z, e.rect)
    // (As it lands: one that is chasing looks again where the other has got to.)
    if (Math.floor(e.stride) > hops && e.goal === 'chase' && e.mate) [e.tx, e.tz] = [e.mate.x, e.mate.z]
    // (And one that is off to graze stops at the first long grass that comes under its nose.)
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
    // The day: bright at the start, dark in the middle of its length, and sheep that can lie down do. The dark comes
    // on slowly and goes as slowly, and the deep of it is brief: a wave, squared, so that it lingers in the light.
    this.dark = (0.5 - 0.5 * Math.cos((this.time / DAY) * Math.PI * 2)) ** 2
    // The light goes by the table at the top (`LIGHT`). And the sun stands high at noon, low and long-shadowed at
    // sunrise and sunset, and the moon a little higher again: it only ever moves slowly, so no shadow jumps.
    const high = Math.cos((this.time / DAY) * Math.PI * 2)
    let k = 0
    while (k < LIGHT.length - 2 && LIGHT[k + 1].high < high) k++
    const [from, to] = [LIGHT[k], LIGHT[k + 1]]
    const part = Math.min(1, Math.max(0, (high - from.high) / (to.high - from.high)))
    this.sun.color.lerpColors(from.sun, to.sun, part)
    this.sun.intensity = from.power + (to.power - from.power) * part
    this.glow.intensity = from.glow + (to.glow - from.glow) * part
    this.sky.lerpColors(from.sky, to.sky, part)
    const up = high > -0.5 ? (high + 0.5) / 1.5 : (-0.5 - high) / 0.5
    this.sun.position.y = 12 + (high > -0.5 ? 18 : 10) * up * up * (3 - 2 * up)
    for (const e of this.ewes) {
      e.hunger += dt / (e.nature === 'greedy' ? 25 : 50)
      e.thirst += dt / 70
      e.hop = Math.max(0, e.hop - dt)
      e.said = Math.max(0, e.said - dt)
      e.cool = Math.max(0, e.cool - dt)
      e.ate = Math.max(0, e.ate - dt)
      if (e.crown > 0 && (e.crown -= dt) > 0 && Math.random() < dt * 14) bits.spawn(e.x + any() * 0.6, e.y + e.s + Math.random() * 0.2, e.z + any() * 0.6, 0, 0.3, 0, 0.06, 0xffe38a, 0.5, NEVER, 0, -0.2, 3)
      e.fun -= dt
      e.pinned = Math.max(0, e.pinned - dt)
      if (e.over) {
        this.vault(e, dt)
        this.draw(e)
        continue
      }
      if (e.air > 0) {
        // Just put in the field: it falls, lands with a puff and a heart, and gives a hop to be here.
        // (How high it is comes from how long it has fallen, and not from adding up steps: the same at any frame rate.)
        e.fall += dt
        e.air = Math.max(0, e.high - 0.5 * GRAVITY * e.fall * e.fall)
        if (!e.air) {
          e.hop = GLAD
          for (let k = 0; k < 7; k++) bits.spawn(e.x + any() * 0.7, 1.05, e.z + any() * 0.7, any() * 1.6, 0.6 + Math.random(), any() * 1.6, 0.1, 0xfffaf0, 0.6, 1, 0.2)
          bits.spawn(e.x, 2, e.z, any() * 0.2, 0.9, any() * 0.2, 0.13, 0xff8fb0, 1.2, NEVER, 0, -0.4)
        }
        this.draw(e)
        continue
      }
      let moved = false
      if (e.goal === 'treat' && e.state === 'walk') this.sniffs(e)
      if (e.goal === 'chase' && e.state === 'walk' && e.mate && !e.cool && Math.hypot(e.mate.x - e.x, e.mate.z - e.z) < 1.5) {
        // Caught: a bump, a hop each, and they change over.
        const { mate } = e
        Object.assign(e, { lead: true, cool: 2.5, hop: GLAD })
        Object.assign(mate, { lead: false, cool: 2.5, hop: GLAD })
        this.think(e, 'smile')
        this.did.bump++
        this.rest(e)
        if (mate.mate === e) Object.assign(mate, { state: 'idle', goal: 'wander', timer: 0.9 }) // (a head start)
      }
      if (e.rider >= 0 && e.state === 'idle') {
        // A duck on its back: it stays where it is, and gives a small hop now and then, to see if the duck minds.
        e.timer = Math.max(e.timer, 0.3)
        if (!e.hop && (this.time + e.s * 9) % 2.4 < dt) e.hop = GLAD
      }
      if (e.state === 'sleep') {
        if (this.dark < WAKE) {
          e.napped = 0
          this.rest(e, 0)
        } else if (Math.random() < dt * 0.2) bits.spawn(e.x, 1.6, e.z, 0.05, 0.3, 0, 0.09, 0xe6dcf7, 2, NEVER, 0, -0.1) // (it dreams)
      } else if (e.state === 'walk') moved = this.walk(e, dt)
      else if (e.state === 'splash' && !e.hop && e.timer > 0.6) {
        e.hop = GLAD
        this.splash(e)
        e.timer -= dt
      } else if ((e.timer -= dt) <= 0) {
        const [, fx, , fz] = TURNS[e.face]
        if (e.state === 'splash') this.think(e, 'smile')
        if (e.state === 'eat' && e.sniff) {
          // It has smelt the flower: a petal or two go up, and so does it.
          for (let k = 0; k < 4; k++) bits.spawn(e.x + fx * NOSE * e.s, 1.3, e.z + fz * NOSE * e.s, any() * 1.2, 1 + Math.random(), any() * 1.2, 0.08, PETALS[k], 1.2, 1, 0, 3)
          e.hop = GLAD
          e.sniff = false
          this.think(e, 'flower')
          this.did.sniff++
        } else if (e.state === 'eat' && this.bite(e.x + fx * NOSE * e.s, e.z + fz * NOSE * e.s)) e.hunger = 0
        if (e.state === 'drink') e.thirst = e.dry = 0
        if (e.state !== 'idle') this.rest(e, 1)
        else if (e.nod > 0 || e.lie > 0 || e.stride || e.pinned) e.timer = 0.1 // (not before its head is up and it is on its feet, nor with somebody over it)
        else if (e.vexed) {
          // It has stamped: now over the one in its way, if that can still be done; and else it gives the errand up.
          const o = e.vexed
          e.vexed = null
          if (e.lark) o.pinned = 0 // (leapfrog: the other has been waiting for it, bent over)
          if (!this.leap(e, o, e.lark)) this.rest(e, 0.4)
        }
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
    for (const flit of this.flits) flutter(this.pets, flit.cubes, flit.owner.x, flit.owner.y, flit.owner.z, flit.owner.s, this.time, flit.owner.entry.seed)
    for (const dog of this.dogs) this.heel(dog, dt)
    this.pets.update(dt)
    // (Over a very old sheep, now and then, a small warm glint.)
    for (const old of this.elders) if (!old.air && Math.random() < dt * 0.9) bits.spawn(old.x + any() * 0.5, old.y + old.s + Math.random() * 0.2, old.z + any() * 0.5, 0, 0.25, 0, 0.06, 0xffe38a, 0.8, NEVER, 0, -0.15, 3)
    this.bubbles()
    this.hermit.hop = Math.max(0, this.hermit.hop - dt)
    this.draw(this.hermit)
    if (this.guest) {
      // (The one that hangs bobs a little, as a thing held up does; and the arrow over it bobs too.)
      const g = this.guest
      g.air = ALOFT + 0.06 * Math.sin(this.time * 3)
      this.draw(g)
      const y = g.y + 1.25 * g.s + 0.1 * Math.sin(this.time * 4)
      ARROW.forEach(([dx, dy, dz], k) => this.ground.place(this.arrow[k], g.x + dx, y + dy, g.z + dz))
    } else if (this.ground.at(this.arrow[0])[1] > -40) for (const c of this.arrow) this.ground.place(c, 0, -40, 0)
    for (let i = this.eaten.length - 1; i >= 0; i--) {
      const t = this.eaten[i]
      this.fed[t] -= dt
      if (this.fed[t] > 0) continue
      this.fed[t] = 0
      this.ground.paint(this.slab[t], this.green[t])
      for (const c of this.blades.get(t) ?? []) this.ground.show(c)
      this.eaten.splice(i, 1)
    }
    // The big grass, which comes up where somebody plants it: one that nobody gets to goes over in time. It glints.
    for (const tuft of this.treats) {
      if (tuft.t < 0) continue
      if ((tuft.left -= dt) <= 0) this.wilt(tuft)
      else if (Math.random() < dt * 2.5) bits.spawn(across(tuft.t) + any() * 0.5, 1.5 + Math.random() * 0.3, along(tuft.t) + any() * 0.5, 0, 0.4, 0, 0.06, 0xffffff, 0.6, NEVER, 0, -0.3, 2.5)
    }
    // The ducks. They go round the pond a third of the way apart, each with its tail up for a look at the bottom now
    // and then; the one on the brook stays where it is. One that has seen a sheep drinking flies over in an arc, sits
    // on its back for a while, and flies home.
    this.swum += dt * 0.4
    this.ducks.forEach((duck, k) => {
      const a = this.swum + (k * Math.PI * 2) / DUCKS
      const [hx, hy, hz] = duck.brook < 0 ? [DUCK[0] + Math.sin(a) * 0.9, 0.9, DUCK[1] + Math.cos(a) * 0.9] : [across(duck.brook), LAND[duck.brook] - 0.1, along(duck.brook)]
      const { on } = duck
      const [bx, by, bz] = on ? [on.x - TURNS[on.face][1] * 0.12 * on.s, on.y + (0.76 - LEGS * on.lie) * on.s + 0.005, on.z - TURNS[on.face][3] * 0.12 * on.s] : [hx, hy, hz]
      let dabble = false
      if (duck.state === 'swim') {
        duck.x = hx
        duck.z = hz
        duck.y = hy + 0.02 * Math.sin(this.time * 3 + k)
        duck.turn = duck.brook < 0 ? turned(Math.cos(a), -Math.sin(a)) : Math.floor(this.time * 0.06 + 1) % 4
        dabble = (this.time * 0.07 + k * 0.37) % 1 < 0.12
      } else if (duck.state === 'ride') {
        duck.x = bx
        duck.y = by
        duck.z = bz
        duck.turn = on ? on.face : 0
        if ((duck.t -= dt) <= 0 && on) {
          // Off again: the sheep is its own once more.
          on.rider = -1
          Object.assign(duck, { state: 'home', t: 0, fx: bx, fy: by, fz: bz, on: null })
        }
      } else {
        // Flying: from where it left to where it is going (which may itself be on the move), over a hump.
        const [gx, gy, gz] = duck.state === 'fly' ? [bx, by, bz] : [hx, hy, hz]
        const u = Math.min(1, (duck.t += dt / 1.3))
        const ease = u * u * (3 - 2 * u)
        if (Math.hypot(gx - duck.fx, gz - duck.fz) > 0.05) duck.turn = turned(gx - duck.fx, gz - duck.fz)
        duck.x = duck.fx + (gx - duck.fx) * ease
        duck.z = duck.fz + (gz - duck.fz) * ease
        duck.y = duck.fy + (gy - duck.fy) * ease + Math.sin(u * Math.PI) * 1.8
        if (u >= 1 && duck.state === 'fly' && on) {
          Object.assign(duck, { state: 'ride', t: 6 + (this.time % 3) })
          this.did.ride++
        } else if (u >= 1) duck.state = 'swim'
      }
      const flying = duck.state === 'fly' || duck.state === 'home'
      const [ta, tb, tc, td] = TURNS[duck.turn]
      for (let i = 0; i < 5; i++) {
        const [dx, dy, dz, sx, sy, sz] = i < 3 ? DRAKE[i] : WINGS[i - 3]
        const c = duck.cubes[i]
        // (Tail up: the body stands on end, and its head is under the water. Wings are only out in the air, and beat.)
        if (i ? (i < 3 ? dabble : !flying) : false) {
          this.ground.hide(c)
          continue
        }
        this.ground.show(c)
        const up = !i && dabble
        this.ground.place(c, duck.x + ta * dx + tb * dz, duck.y + (up ? 0.05 : dy + sy / 2 + (i > 2 ? 0.05 * Math.sin(this.time * 34) : 0)), duck.z + tc * dx + td * dz)
        this.ground.size(c, ta ? sx : up ? sy : sz, up ? sz : sy, ta ? (up ? sy : sz) : sx)
      }
    })
    // The birds on the fence give a hop now and then, and look another way.
    this.birds.forEach((cubes, k) => {
      const x = k ? FENCE[FENCE.length - 1][0] + 0.42 : FENCE[0][0] - 0.42
      const up = (this.time * 0.13 + k * 0.5) % 1 < 0.12 ? Math.abs(Math.sin(this.time * 9)) * 0.09 : 0
      const [ta, tb, tc, td] = TURNS[Math.floor(this.time * 0.07 + k * 1.7) % 4]
      BIRD.forEach(([dx, dy, dz, sx, sy, sz], i) => {
        this.ground.place(cubes[i], x + ta * dx + tb * dz, 1.5 + up + dy + sy / 2, FENCE[0][1] + tc * dx + td * dz)
        this.ground.size(cubes[i], ta ? sx : sz, sy, ta ? sz : sx)
      })
    })
    // At night, fireflies over the pond and before the cave. The trees in blossom shed a petal now and then.
    if (Math.random() < dt * 5 * Math.min(1, (this.dark - 0.5) / 0.35)) { // (more of them as it gets darker: they come and go with the night)
      const [fx, fy, fz] = Math.random() < 0.7 ? [DUCK[0] + any() * 6, 1.4 + Math.random() * 1.2, DUCK[1] + any() * 5] : [CAVE[0][0] + 0.5 + any() * 3, FLOOR + 0.5 + Math.random(), CAVE[0][1] - 1.5 + any() * 2]
      bits.spawn(fx, fy, fz, any() * 0.5, any() * 0.3, any() * 0.5, 0.06, 0xe9ff8a, 2.5, NEVER, 0, 0, 3)
    }
    // (At the foot of each little fall, a fleck of foam now and then: no more.)
    for (const [fx, , fz, foot, dx, dz] of FALLS) {
      if (Math.random() < dt * 1.5) bits.spawn(fx + dx * 0.25 + (dz ? any() * 0.5 : 0), foot + 0.06, fz + dz * 0.12 + (dx ? any() * 0.5 : 0), any() * 0.3, 0.25, any() * 0.3, 0.12, 0xffffff, 0.9, NEVER, 0, -0.15)
    }
    if (this.pink.length && Math.random() < dt * 1.5) {
      const [px, py, pz] = this.pink[Math.floor(Math.random() * this.pink.length)]
      bits.spawn(px + any() * 0.8, py + any() * 0.5, pz + any() * 0.8, -0.5 + any() * 0.3, 0, any() * 0.3, 0.08, BLOSSOM[Math.floor(Math.random() * 3)], 3, 1, 0, 0.5)
    }
    this.ground.wind.value.set(0.1, 0.05, this.time)
    this.waves.value.y = this.time
    this.ground.update(dt)
    this.flock.update(dt)
    bits.update(dt)
  }

  /** The shadows at the size that goes with a step of the picture (see `../Picture.tsx`). */
  shadows(tier: number) {
    shade(this.sun, tier)
  }

  dispose() {
    for (const mesh of [this.ground.mesh, this.flock.mesh, this.pets.mesh, this.bits.mesh]) mesh.dispose()
    this.water.geometry.dispose()
  }
}
