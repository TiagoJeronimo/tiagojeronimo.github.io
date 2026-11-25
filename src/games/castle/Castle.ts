// A castle on a hill, a camp at the foot of it, and a war between the two that gets nowhere: the camp charges, hacks at
// the wall and goes back for a rest, the castle shoots at it, and nobody is ever hurt. In the cubes the games share
// (`../cubes.ts`). The page (`CastlePage.tsx`) draws it and hands it the clicks; the camera is the kit's (`../View.ts`).
//
// The game is the one who feeds them both. He lives to the west of the hill with a field, an oven, trees to fell and
// rocks to break, and a click sends him to any of those. He carries up to three things, one on another on his hat.
// Both sides ask him for things, in pictures: the castle lets a basket down from a tower in its west wall, the camp
// has a table by its tent. They ask when the camp sets out, all at once, and not in the quiet between two charges.
// What is asked for and does not come in time makes one of that side sit down under a small rain cloud; what does
// come gets one up again. A side with everybody sitting packs up and goes home, and that is the day lost.
//
// What there is to bring. Bread: sow a plot, wait, cut the wheat, put it in the oven, wait, take the loaf. Wood: a
// tree, which then comes up somewhere else. Stone: a rock, likewise; the castle mends its wall with it. And music,
// which walks: the musician sits in the castle's yard, the gate opens for the helper and for nobody else, and the
// musician follows him to the camp, plays there, and goes home by himself. While he plays the camp wants nothing.
// A side takes only what it has asked for. What nobody wants just now he can put by at his farm: logs on a rack,
// stones on a tray, loaves on the oven's shelf. From the third charge on they ask for sillier things as well: a
// flower (any flower: they grow all over), soup from the pot on the camp's fire, a duck off the pond, the castle's
// cat, an apple off the tree in its yard.
//
// In the quiet between two charges something small may happen: a duck takes to following him about, the cat makes
// off with a loaf (a click stops it), or it rains on the camp's fire, which then wants wood before there is soup again.
//
// And it is won by a wedding. In each quiet the princess on her balcony or the prince on his chair asks for something
// too, by turns and in pink; they wait as long as it takes, and are brought their things in person. Each thing
// brought is a step in a courtship: the war winds down a little with every step, and the two sides start throwing
// each other what the other is short of. After the last step they both ask for music, at the gate. The musician is
// brought there, she comes out, he comes up the road, and that is the end of the war.
import { CircleGeometry, Color, DirectionalLight, DynamicDrawUsage, Group, HemisphereLight, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, ShadowMaterial, Vector3 } from 'three'
import { ARROW, BARK, LEAF, NEAR, NEVER, POINTER, RING, STONE, WOOD, any, rnd, shade } from '../basics.ts'
import { Bits, Cubes, unit } from '../cubes.ts'
import { note, thump } from '../../sound.ts'

/**
 * What can be brought to a side; what the helper can have in his hands; and what can be asked for. Bread, wood and
 * stone are the plain ones: what nobody wants of those just now can be put by at the farm, and fetched from there
 * later. A flower, soup, a duck, the cat and an apple are the silly ones, and there is nowhere to put those by. With no room on
 * his hat for something else, he lets go of the oldest thing on it that nobody wants.
 */
export type Good = 'bread' | 'wood' | 'stone' | 'flower' | 'soup' | 'duck' | 'cat' | 'apple'
export type Item = Good | 'wheat'
export type Want = Good | 'music'
/**
 * Something that is wanted, how long it will still be waited for, and where to say so. `side` is where it is brought:
 * 0 the castle, 1 the camp, 2 the gate between them. `love` marks what the princess or the prince asks for: that is
 * waited for as long as it takes, and leads to the wedding when it is met. `still` is waited for as long as it takes
 * too: wood, for a fire the rain has put out.
 */
export interface Ask {
  id: number
  side: number
  what: Want
  left: number
  full: number
  x: number
  y: number
  z: number
  love?: boolean
  still?: boolean
}
/** What a cube belongs to, where that is something to click on: a tree, a rock, a plot or a flower bed (add which one), and the rest. */
export const TREE = 1000
export const ROCK = 2000
export const PLOT = 3000
export const OVEN = 4000
export const BASKET = 5000
export const TABLE = 6000
export const MUSIC = 7000
export const CAT = 8000
export const DUCK = 9000
export const FLOWER = 10000
export const HEARTH = 11000
export const WED = 12000
export const LOGS = 13000
export const HEAP = 14000
export const PRINCESS = 15000
export const PRINCE = 16000
export const APPLE = 17000

const SPAN = 22 // how far the land reaches from its middle, in tiles
const MID = -2 // where its middle is, along: the castle is at the back of it
/** How far out there are tiles at all; and how far from the middle there is anything to see, for the camera. */
export const REACH = 26
export const SIGHT = SPAN + 2
const N = 2 * REACH + 1
const TOP = 7 // how high the ward is, where the keep stands; the flat ground is at 1
const STEP = 5 // and the yard
const WALL = 1.6 // how high the yard's walls stand,
const POST = 2.4 // its taller stretches,
const TOWER = 2.6 // its towers,
const KEEP = 4.4 // and the keep
const ROOM = 14000 // cubes there are to build with: the land takes about half of them
/** How long it is from morning to evening, in seconds. (The evening lasts until the day is decided: there is no clock to beat.) */
export const DAY = 240

// How it plays: these are the numbers to tune.
const LULL = 16 // seconds of quiet between one charge and the next: for filling the rack, the tray and the shelf
const CHARGE = 36 // how long the camp is out at the wall: when it sets out, both sides say what they want, all at once
const WAIT = 12 // how much longer than the charge they go on waiting for it
/**
 * What is asked for in the first two charges, the same every day: by the castle, and by the camp. After those it goes
 * by chance. (The castle's wood in the first is asked for at dawn, before the day starts: see `start`.)
 */
const ROUNDS: Want[][][] = [[[], ['bread']], [['stone', 'bread'], ['wood', 'music']]]
const HAT = 3 // how many things the helper carries at once, one on another
/**
 * What the princess and the prince ask for, by turns: where it is brought, and what. What he asks for comes from her
 * castle: its cat, and an apple off the tree in its yard. She gets a flower, and soup from the pot on his camp's fire.
 * One in each quiet after a charge, while the one before has been brought. After the last of it they ask for music, at
 * the gate.
 */
const GIFTS: [number, Good][] = [[0, 'flower'], [1, 'cat'], [0, 'soup'], [1, 'apple']]
const PACE = 4.4 // tiles a second, for the helper: he is in a hurry
const MARCH = 2.7 // and for a soldier
const SOW = 12 // seconds for wheat to ripen,
const BAKE = 5 // for a loaf to bake,
const SPROUT = 10 // and for a tree that has come up to be worth felling


const SONG = 14 // how long the musician plays at the camp
const STRIDE = 1.15 // the highest step anybody takes
const FAR = 65535 // no way there

const GRASS = [0x8fd16b, 0x9fd872, 0xb4de6e]
const SOIL = 0xba936d
const PATH = 0xdcc79c
const TILTH = 0x9c7658
const PAVING = [0xd3cfd6, 0xc9c4cd]
const WALLS = [0xb7b2ba, 0xb7b2ba, 0xaea9b5, 0xbdb8c0, 0xb1acb8] // stone, no two stones quite alike: of the walls,
const TOWERS = [0xa39eab, 0xa39eab, 0x9c97a6, 0xaaa5b2, 0x9f9aa8] // and of the towers and the keep
const MOSS = [0x8db36c, 0x7fa862, 0xa3c47c]
const SLIT = 0x5a5563
const ROOF = [0x5f86c9, 0x73a0e0] // slates, in the castle's blue
const WATER = 0x86cdf5
const BED = 0xb9a67e
/** The two colours: the castle's, and the camp's. */
export const WEAR = [0x5b8fd6, 0xe2694f]
const CREAM = 0xfff1dc
const HEART = 0xff8fb1
const SKIN = 0xf2c9a0
const BOOT = 0x5b4a44
const STEEL = 0xb9bcc9
const STRAW = 0xe9cf86
const GOLD = 0xffd45c
const WHEAT = [0x9bd873, 0xf2c94c] // green, and ripe
const NOON = [new Color(0xffe9cf), new Color(0xcfe6f1)] // the sun and the sky by day,
const EVENING = [new Color(0xffb37e), new Color(0xf7cfae)] // and as the sun goes down
/** How each thing looks in the helper's hands, in the basket or on a table: its size, and its colour. */
const LOOK: Record<Item, number[]> = { bread: [0.34, 0.2, 0.24, 0xd9a05b], wood: [0.5, 0.17, 0.17, 0x9a7b62], stone: [0.3, 0.26, 0.3, 0xa39eab], wheat: [0.2, 0.36, 0.2, 0xf2c94c], flower: [0.22, 0.22, 0.22, 0xff8fb1], soup: [0.3, 0.2, 0.3, 0x6b5a58], duck: [0.22, 0.18, 0.3, 0xffd45c], cat: [0.24, 0.2, 0.36, 0xf0a04b], apple: [0.24, 0.22, 0.24, 0xe2543f] }
/** What is put by at the farm on a place of its own: logs on a rack, stones on a tray. (Loaves are on the oven's shelf.) */
type Piled = 'wood' | 'stone'
const QUARTERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]]

/** The tile at (x, z), both whole numbers; the tile a place is on; and where a tile is. */
const at = (x: number, z: number) => x + REACH + (z + REACH) * N
const spot = (x: number, z: number) => at(Math.round(x), Math.round(z))
const across = (t: number) => (t % N) - REACH
const along = (t: number) => Math.floor(t / N) - REACH

// The castle from above, a character a tile: rows from north to south (the last is the south wall, with the gate in
// it), columns from west to east. It is drawn by hand, and on purpose not square and not the same on both sides: the
// ward and the keep are in one corner, and no two towers are alike. `#` a stretch of wall, `h` a taller one, `G` the
// gate; `T` a tower somebody stands on, `C` the one with the winch, `R` a thin one with a roof, `B` a fat one with a
// roof (four tiles of it); `.` the yard; `^` the ward, two steps higher, `w` its low wall, `t` its small towers, `K`
// the keep (nine tiles).
const PLAN = [
  '        twwwwKKK ',
  '        w^^^^KKK ',
  '        w^^^^KKK ',
  '        w^^^^^^w ',
  '        w^^^^^^w ',
  '  Rhhhhhtw^wwwwt ',
  '  #............# ',
  '  #............# ',
  '  #............# ',
  '  #............# ',
  '  #............# ',
  '  C............# ',
  '  #............# ',
  '  #............BB',
  '  T####hGh#####BB',
]
const [PX, PZ] = [-8, 1 - PLAN.length] // where its first character is: so the gate comes out at (0, 0)
const plan = (x: number, z: number) => PLAN[z - PZ]?.[x - PX] ?? ' '
/** Whether a tile of the castle is on its upper level; and whether something is built on it. */
const upper = (x: number, z: number) => 'tw^K'.includes(plan(x, z))
const built = (x: number, z: number) => '#hGTCRBtwK'.includes(plan(x, z))
/** Where the yard is grass and not paving: a lawn to the west of the way through it, and a smaller one to the east. */
const lawn = (x: number, z: number) => plan(x, z) === '.' && ((x >= -5 && x <= -2 && z >= -6 && z <= -3) || (x >= 3 && x <= 6 && z >= -4 && z <= -2))
const X0 = -6 // the west wall,
const WINCH = -3 // and how far along it the winch is
const POND = [5.5, 9.6] // the middle of the pond, at the foot of the hill,
const LAKE = [[5, 8], [6, 8], [4, 9], [5, 9], [6, 9], [7, 9], [4, 10], [5, 10], [6, 10], [7, 10], [5, 11], [6, 11]] // its tiles: round, near enough,
const BROOK = [[5, 1], [5, 2], [6, 2], [6, 3], [6, 4], [5, 4], [5, 5], [5, 6], [6, 6], [6, 7]] // and the brook that runs down to it from the south wall, in bends
const BRIDGE = [6, 3] // where planks are laid across it

/**
 * The land, worked out once: how high every tile is (nothing, where there is no land), and what was laid across it.
 *
 * The hill is heaped up round the castle: next to a wall the ground is as high as the wall's foot, and from there it
 * goes down in steps, a level at each of the distances in `DOWN` (and `DOWNS`, from the ward, which stands higher). So
 * no bare earth shows under the walls. The steps are not even: a slow swell pushes them in and out by up to two tiles,
 * so that there are broad shelves in one place and a steep bank in another, and every tile has a little say of its
 * own, which frays their edges. Three things want the steps to stay put where they cross: the road down from the
 * gate, the stairs up to the winch, and the brook. Near those the swell fades to nothing.
 * @returns `land` the heights; `stairs` the stairs of stone, each as its tile, the height at its upper end, and which
 * way it goes down; `paved` the floor of stone outside the castle; `road` the path of earth; `wet` the brook and the
 * pond; `falls` where the brook goes over a step: where, from how high, to how low, and which way
 */
const lay = () => {
  const land = new Float32Array(N * N)
  const [stairs, falls]: number[][][] = [[], []]
  const [paved, road, wet] = [new Set<number>(), new Set<number>(), new Set<number>()]
  const DOWN = [1.5, 2.6, 4.2, 6.2]
  const DOWNS = [1.5, 2.8, 4, 5.2, 6.6, 8.4]
  const LINES = [[0, 1, 0, 11], [-15, WINCH, X0 - 2, WINCH], [5.5, 1, 5.5, 9]]
  const tiles: number[][] = []
  for (let z = PZ; z <= 0; z++) for (let x = PX; x < PX + PLAN[0].length; x++) if (plan(x, z) !== ' ') tiles.push([x, z, upper(x, z) ? 1 : 0])
  /** How far it is to the castle, or to its upper part. */
  const off = (x: number, z: number, high: number) => {
    let least = 99
    for (const [px, pz, up] of tiles) if (up >= high) least = Math.min(least, Math.hypot(px - x, pz - z))
    return least
  }
  const toLine = (x: number, z: number, [x0, z0, x1, z1]: number[]) => {
    const [dx, dz] = [x1 - x0, z1 - z0]
    const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz)))
    return Math.hypot(x - x0 - t * dx, z - z0 - t * dz)
  }
  // The swell: chance at every sixth tile each way, and smoothly from one to the next between. From -1 to 1.
  const knot = (i: number, j: number) => rnd(i * 374761 + j * 668265 + 4321)
  const swell = (x: number, z: number) => {
    const [i, j] = [Math.floor(x / 6), Math.floor(z / 6)]
    const [a, b] = [x / 6 - i, z / 6 - j].map((t) => t * t * (3 - 2 * t))
    return (knot(i, j) * (1 - a) * (1 - b) + knot(i + 1, j) * a * (1 - b) + knot(i, j + 1) * (1 - a) * b + knot(i + 1, j + 1) * a * b) * 2 - 1
  }
  const fade = (far: number) => Math.min(1, Math.max(0, (far - 1) / 2.5))
  for (let z = -REACH + 1; z < REACH; z++)
    for (let x = -REACH + 1; x < REACH; x++) {
      if (Math.hypot(x, z - MID) + (rnd(x * 31 + z * 57 + 900) - 0.5) * 1.8 > SPAN - 0.3) continue
      const t = at(x, z)
      // The castle's own ground is flat, and so is the ground of the camp and of the farm.
      if (plan(x, z) !== ' ') land[t] = upper(x, z) ? TOP : STEP
      else if ((Math.abs(x) <= 7 && z >= 10) || (x <= -10 && z >= 1 && z <= 11)) land[t] = 1
      else {
        const [a, b] = [off(x, z, 0), off(x, z, 1)]
        const calm = Math.min(1, Math.max(0, (Math.min(...LINES.map((line) => toLine(x, z, line))) - 0.5) / 2))
        const push = (swell(x, z) * 1.9 + (rnd(x * 131 + z * 71 + 5) - 0.5) * 0.8) * calm
        const low = STEP - DOWN.filter((edge) => a + push * fade(a) > edge).length
        const high = TOP - DOWNS.filter((edge) => b + push * fade(b) > edge).length
        // (Out on the plain, where the swell is deepest the other way, a low rise or two.)
        land[t] = Math.max(1, low, high, push < -1.3 && a > 9 ? 2 : 1)
      }
    }
  /** A way down the hill from somewhere, a step a tile at the most: stairs where it goes down, and a floor where it does not. */
  const descend = (x: number, z: number, dx: number, dz: number, n: number, floor: Set<number>) => {
    let level = STEP
    for (let k = 0; k < n && land[at(x, z)]; k++, x += dx, z += dz) {
      const now = Math.max(level - 1, Math.min(level, land[at(x, z)]))
      if (now < level) stairs.push([x, z, level, dx, dz])
      else floor.add(at(x, z))
      land[at(x, z)] = level = now
    }
  }
  // Under the winch, a floor of stone on the hillside, as high as the foot of the wall; and stairs down from it.
  for (const x of [X0 - 1, X0 - 2])
    for (const z of [WINCH - 1, WINCH, WINCH + 1]) {
      land[at(x, z)] = STEP
      paved.add(at(x, z))
    }
  descend(X0 - 3, WINCH, -1, 0, 6, paved)
  descend(0, 1, 0, 1, 12, road)
  stairs.push([2, -8, TOP, 0, 1], [2, -7, TOP - 1, 0, 1]) // and in the yard, the stairs up to the ward
  // The brook: out of the south wall and down the hill in a few bends, over a little fall wherever the hill steps
  // down, into the pond at its foot. And that is where it ends: a pond needs no way out.
  let level = STEP
  BROOK.forEach(([x, z], k) => {
    const now = Math.min(level, land[at(x, z)])
    if (now < level) falls.push([(x + BROOK[k - 1][0]) / 2, level, (z + BROOK[k - 1][1]) / 2, now, x - BROOK[k - 1][0], z - BROOK[k - 1][1]])
    land[at(x, z)] = level = now
    wet.add(at(x, z))
  })
  for (const [x, z] of LAKE) {
    land[at(x, z)] = 1
    wet.add(at(x, z))
  }
  // (Ground beside the water is never lower than the water is there: else it would hang in the air.)
  for (const t of wet) for (const n of [t + 1, t - 1, t + N, t - N]) if (!wet.has(n) && land[n] && land[n] < land[t]) land[n] = land[t]
  // (And the bridge is level with the ground at both its ends: it leads on to grass, not into a bank.)
  for (const d of [-1, 1]) land[at(BRIDGE[0] + d, BRIDGE[1])] = land[at(BRIDGE[0], BRIDGE[1])]
  return { land, stairs, paved, road, wet, falls }
}
const { land: LAND, stairs: STAIRS, paved: PAVED, road: ROAD, wet: WET, falls: FALLS } = lay()
/** Where no tree comes up and no rock lands: the road, the camp, the farm, the way up to the winch, by the water, and where the camp's archers stand. */
const clear = (x: number, z: number) =>
  (Math.abs(x) <= 1 && z > 0 && z < 12) || (Math.abs(x) <= 7 && z >= 10) || (x <= -10 && z >= 1 && z <= 11) || (x < X0 && x >= -16 && Math.abs(z - WINCH) <= 1) || (Math.abs(x) <= 4 && z >= 5 && z <= 7) || [0, ...RING.map(([i, j]) => i + j * N)].some((d) => WET.has(at(x, z) + d))

// Where everything is. The camp is at the bottom of the road, in front of the gate: a tent, the prince's chair, a
// table, a flag and a fire. The farm is to the west: four plots in a square (each with the x of the tile it is worked
// from), the oven, a scarecrow, the helper's cottage, and a rack and a tray for what he puts by. In the yard: the musician's stool, a well, casks with a cat
// on them, a tree. And on the west wall the winch, with a floor of stone under it for the basket to come down on.
const FIELD = [[-15, 7, -16], [-14, 7, -13], [-15, 8, -16], [-14, 8, -13]]
const STOVE = [-17, 5]
const CROW = [-12, 8]
const HUT = [-12.5, 3.5]
const RACK = [-11, 5] // where logs are put by,
const TRAY = [-10, 6] // and stones: beside it, and a little forward, so that what is said over each can be told apart from afar
const TENT = [4, 15]
const THRONE = [2, 16]
const BOARD = [-4, 14.5]
const POLE = [-2, 12]
const FIRE = [0, 14]
const STOOL = [-3, -5]
const WELL = [4, -3]
const CASKS = [5, -6]
const SHADE = [-4, -7]
const KX = 6 // the middle of the keep, across,
const KZ = -13 // and along
const HOOK = X0 - 1.15 // how far out from the wall the basket hangs
const GATE = at(0, 0)
const BAY = at(X0 - 2, WINCH) // where the helper stands to fill the basket, which comes down on the tile between,
const SERVE = [at(BOARD[0] - 1, 14), at(BOARD[0] - 1, 15)] // at the camp's table,
const BAKERY = at(STOVE[0], STOVE[1] + 1) // and at the oven
const HOME = at(STOOL[0], STOOL[1] + 1) // where the musician steps off his stool,
const STAGE = at(FIRE[0], FIRE[1] - 1) // and where he plays, by the camp's fire
/** Where each side says what it wants: at the end of the winch's arm, and just over the table. */
const SAY = [[HOOK, STEP + TOWER + 1.5, WINCH], [BOARD[0], 2.1, BOARD[1]]]
const LOW = STEP // how high the foot of the basket is when it is down,
const HIGH = STEP + TOWER + 0.1 // and when it is up
/** The tiles that have something built on them: nothing grows there, and nobody stands there. */
const BUILT = new Set(
  [
    ...FIELD, STOVE, [STOVE[0] - 1, STOVE[1]], CROW, RACK, TRAY, ...[-0.5, 0.5].flatMap((i) => [-0.5, 0.5].map((j) => [HUT[0] + i, HUT[1] + j])),
    ...[-1, 0, 1].flatMap((i) => [-1, 0, 1].map((j) => [TENT[0] + i, TENT[1] + j])), THRONE, [BOARD[0], 14], [BOARD[0], 15], POLE, FIRE,
    STOOL, WELL, CASKS, SHADE, [X0 - 1, WINCH],
  ].map(([x, z]) => at(x, z)),
)
/** Where each of the castle's six stands: on the south wall, and on the tower at its west end (the last number: on a tower). */
const POSTS = [[X0, 1], [-4, 0], [-2, 0], [2, 0], [4, 0], [6, 0]]
/** Where each of the camp's six sits by the fire, and where it goes when the camp charges: four with swords to the foot of the wall, two with bows further back. */
const SEATS = [[-1, 13, -2, 1], [1, 13, 2, 1], [-1, 15, -1, 1], [1, 15, 1, 1], [-1, 14, -3, 6], [1, 14, 3, 6]]

// People, in boxes: where each box sits (across, the height of its foot, and along), how big it is, and its colour.
// They face along. The sixth box is what is held, where something is.
type Part = [x: number, y: number, z: number, sx: number, sy: number, sz: number, ink: number]
type Kind = 'archer' | 'sword'
/** Somebody on two legs: boots, what is worn, a head, and something on it. */
const man = (wear: number, hat: number): Part[] => [
  [-0.09, 0, 0, 0.13, 0.22, 0.15, BOOT],
  [0.09, 0, 0, 0.13, 0.22, 0.15, BOOT],
  [0, 0.22, 0, 0.4, 0.36, 0.28, wear],
  [0, 0.58, 0, 0.3, 0.26, 0.26, SKIN],
  [0, 0.84, 0, 0.36, 0.13, 0.32, hat],
]
/** They are drawn a third bigger than they were measured: small enough for the walls, big enough to be seen from afar. */
const big = (parts: Part[]) => parts.map(([x, y, z, sx, sy, sz, ink]): Part => [x * 1.3, y * 1.3, z * 1.3, sx * 1.3, sy * 1.3, sz * 1.3, ink])
const SOLDIER: Record<Kind, (wear: number) => Part[]> = {
  archer: (wear) => big([...man(wear, STEEL), [0.27, 0.18, 0.02, 0.07, 0.5, 0.07, WOOD], [-0.2, 0.3, -0.19, 0.12, 0.3, 0.1, 0x7d6450]]), // a bow, and a quiver on its back
  sword: (wear) => big([...man(wear, STEEL), [0.27, 0.3, 0.02, 0.07, 0.46, 0.07, 0xe6e9f2], [-0.27, 0.22, 0.02, 0.08, 0.32, 0.28, wear]]), // a sword, and a shield in its colour
}
/** The helper: in white, with a straw hat, and on the hat whatever he is carrying: up to three things (the last three boxes). */
const HELPER = big([...man(CREAM, STRAW).slice(0, 4), [0, 0.84, 0, 0.56, 0.05, 0.56, STRAW], [0, 0.89, 0, 0.3, 0.12, 0.3, STRAW], ...[0, 1, 2].map((): Part => [0, 1.02, 0, 0.3, 0.2, 0.3, WOOD])])
/** The musician: a lute held in front of him, its neck, and a feather in his cap. */
const BARD = big([...man(0xa98bdc, 0x6fbf73), [0.06, 0.26, 0.2, 0.22, 0.26, 0.1, 0xc98f55], [-0.19, 0.42, 0.2, 0.28, 0.06, 0.06, BARK], [0.1, 0.97, 0, 0.05, 0.16, 0.05, WEAR[1]]])
const LADY = big([[0, 0, 0, 0.46, 0.34, 0.4, 0xff9ec4], [0, 0.34, 0, 0.36, 0.24, 0.28, 0xffc2d9], [0, 0.58, 0, 0.3, 0.26, 0.26, SKIN], [0, 0.56, -0.17, 0.34, 0.3, 0.08, 0xf6c453], [0, 0.84, 0, 0.34, 0.06, 0.3, 0xf6c453], [0, 0.9, 0, 0.2, 0.09, 0.2, GOLD]])
const LORD = big([...man(0xc9506b, 0x7d5a3c), [0, 0.97, 0, 0.22, 0.08, 0.22, GOLD], [0, 0.2, -0.18, 0.42, 0.4, 0.06, 0x7d4fa8]])
/** A duck, as yellow as the one that minds the plug on the island: a body, a head, and a bill. */
const DRAKE: Part[] = [[0, 0, 0, 0.2, 0.14, 0.3, GOLD], [0, 0.14, 0.1, 0.13, 0.13, 0.13, GOLD], [0, 0.18, 0.2, 0.07, 0.04, 0.08, 0xf5a742]]
/** The cat, which sits like a loaf with its tail up. */
const PUSS: Part[] = [[0, 0, 0, 0.22, 0.2, 0.38, 0xf0a04b], [0, 0.2, 0.09, 0.24, 0.2, 0.2, 0xf0a04b], [-0.08, 0.4, 0.11, 0.07, 0.08, 0.06, 0xd98a3a], [0.08, 0.4, 0.11, 0.07, 0.08, 0.06, 0xd98a3a], [0, 0.2, -0.15, 0.06, 0.26, 0.06, 0xf0a04b]]
/** A note of music, which rises from the musician whenever he plays: its head, its stem, and its flag. */
const QUAVER = [[0, 0, 0, 0.17, 0.13, 0.13], [0.07, 0.17, 0, 0.04, 0.3, 0.04], [0.12, 0.28, 0, 0.1, 0.06, 0.04]]
/** The small rain cloud over somebody who has sat down: a row of three puffs, dark underneath, and two lighter ones on top. */
const CLOUD = [[0, 0, 0, 0.44, 0.24, 0.34, 0x97a2c2], [0.33, 0.02, 0, 0.22, 0.18, 0.26, 0xa7b1ce], [-0.33, 0.02, 0, 0.22, 0.18, 0.26, 0xa7b1ce], [0.08, 0.24, 0, 0.26, 0.16, 0.26, 0xcdd3e6], [-0.15, 0.24, 0, 0.2, 0.12, 0.22, 0xcdd3e6]]
/** A tree, from the ground up: the middle of each box, how wide it is, and how tall. And a rock, as parts. */
const TRUNK = [[0.45, 0.28, 0.9], [1.275, 1, 0.75], [2, 0.68, 0.7]]
const BOULDER = [[0.02, 0, -0.04, 0.66, 0.5, 0.6, STONE[1]], [0.1, 0.5, -0.06, 0.36, 0.26, 0.34, STONE[2]], [-0.42, 0, 0.26, 0.22, 0.2, 0.22, STONE[0]]]
/** They look one of four ways, as cubes do. For each quarter turn, what becomes of across and along. */
const TURNS = [[1, 0, 0, 1], [0, 1, -1, 0], [-1, 0, 0, -1], [0, -1, 1, 0]]
/** Which of the four ways is nearest to the way (dx, dz) goes. */
const turned = (dx: number, dz: number) => (Math.round(Math.atan2(dx, dz) / (Math.PI / 2)) + 4) % 4

/** Something made of parts, that is somewhere and looks some way. */
interface Body {
  x: number
  y: number
  z: number
  /** Which way it looks, in quarter turns; and what its cubes were last sized for. */
  turn: number
  drawn: string
  cubes: number[]
  parts: Part[]
  /** How far along its stride it is (it goes at a hop), and how long it goes on jumping for joy. */
  stride: number
  hop: number
}
/** The cat, or a duck: something that can be carried off, and comes home again. */
interface Pet extends Body {
  /** Not where it lives: on the helper's hat, in the basket, or wherever it was taken. */
  away: boolean
  /** In the basket, on the way up. */
  ride: boolean
  /** How long it stays where it was taken before it goes home. */
  stay: number
}
interface Fighter extends Body {
  side: number
  kind: Kind
  /** Sitting under a cloud: something its side asked for did not come. */
  sad: boolean
  /** Its place by the fire and its place at the wall, for one of the camp. */
  home: number
  front: number
  /** There, and at it. */
  busy: boolean
  /** How long until it strikes or shoots again, and how long its arm stays up after it has. */
  wait: number
  swing: number
  cloud: number[]
  dim: boolean
  /** Gone home: its side gave up. */
  gone: boolean
}
/** Something for the helper to do: what (-1 for somewhere to go), on which tile it was when he was told, and the way there. */
interface Task {
  id: number
  t: number
  way?: Uint16Array
  stamp?: number
}
interface Tree {
  t: number
  ground: number
  cubes: number[]
  /** How far it has grown, to 1; which of its sizes it is drawn at; and, felled, how long until it comes up again. */
  grown: number
  stage: number
  away: number
}
interface Rock {
  t: number
  ground: number
  cubes: number[]
  away: number
}
interface Plot {
  t: number
  /** The tile it is worked from. */
  from: number
  /** Below nothing, bare; then growing, to 1, which is ripe. */
  age: number
  stage: number
  stalks: number[]
  spots: number[][]
}
interface Arrow {
  from: number[]
  to: number[]
  /** How long it has been in the air, how long the way takes, and how long it then stays stuck where it landed. */
  t: number
  time: number
  rest: number
  /** Whom it startles, if it was a good shot. */
  at?: Fighter
}

const _m = new Matrix4()
const _q = new Quaternion()
const _v = new Vector3()
const _s = new Vector3()
const AHEAD = new Vector3(0, 0, 1)

export class Castle {
  readonly group = new Group()
  /** The colour of the sky, for the page to put behind everything: it changes as the sun goes down. */
  readonly sky = new Color().copy(NOON[1])
  private key = new DirectionalLight(0xffe9cf, 3.2) // the sun
  private glow = new HemisphereLight(0xe6efff, 0xffd9c4, 1.25)
  readonly solid = new Cubes(ROOM, new MeshStandardMaterial({ roughness: 0.9 }), 'wind')
  readonly wet = new Cubes(160, new MeshStandardMaterial({ roughness: 0.15, transparent: true, opacity: 0.72 }), 'waves')
  readonly bits = new Bits(900)
  /** How much of the day has gone, in seconds. */
  time = 0
  /** How it ended, once it has: one of the two sides gave up and went home, or there was a wedding. */
  over: '' | 'castle' | 'camp' | 'wedding' = ''
  /** How far the courting has got: how many of the things the princess and the prince ask for have been brought. */
  love = 0
  /** What is being asked for just now. */
  readonly asks: Ask[] = []
  /** What is put by at the farm: so many logs on the rack, and stones on the tray. */
  readonly piles: Record<Piled, number> = { wood: 1, stone: 1 }
  /** Where the three places are that things are put by at, for the page to say so over each: what is kept there, where, and how many at the most. */
  readonly kept: [Good, number, number, number, number][] = [['wood', RACK[0], 2.6, RACK[1], 4], ['stone', TRAY[0], 2.6, TRAY[1], 4], ['bread', STOVE[0] - 1, 1.95, STOVE[1], 3]]
  readonly trees: Tree[] = []
  readonly rocks: Rock[] = []
  readonly plots: Plot[] = []
  /** Where flowers grow, which is all over the land: the tile and the ground of each place, its blooms, and how long until it is in bloom again once picked. */
  readonly flowers: { t: number; ground: number; cubes: number[]; away: number }[] = []
  /** The oven: sheaves waiting in it, how long the one at the front has baked, and loaves ready on its shelf. */
  readonly oven = { todo: 0, heat: 0, ready: 1 }
  readonly men: Fighter[] = []
  /** The helper: what he carries, from his hat up (the animals among it, and how high each sits); what he has been told to do; how long the job in hand still takes. */
  readonly me: Body & { loads: Item[]; pets: Pet[]; rise: number[]; queue: Task[]; work: number; beat: number; no: number; idle: number }
  /** The musician: on his stool; following the helper; on his way to where he is to play; playing (for how long yet); and home again. */
  readonly tune: Body & { mode: 'home' | 'follow' | 'go' | 'play'; seated: boolean; left: number; beat: number; to: number }
  /** For every tile, how high whoever is there stands: -1 where nobody can be. And how high what is there reaches. */
  private stand = new Float32Array(N * N).fill(-1)
  private high = new Float32Array(N * N)
  /** On a stair, which way it goes down, across and along: whoever is on it is on its upper tread or its lower one. */
  private fx = new Int8Array(N * N)
  private fz = new Int8Array(N * N)
  /** What there is to click on a tile, and the cubes of each such thing. */
  private on = new Int32Array(N * N).fill(-1)
  private made = new Map<number, number[]>()
  /** Where trees can come up, and where rocks can land. */
  private grove: number[] = []
  private scree: number[] = []
  /** The ways soldiers and the musician go, each to one tile: found once, and afresh when a tree or a rock has moved. */
  private routes = new Map<number, { stamp: number; way: Uint16Array }>()
  private stamp = 0
  /** The way to the helper, for whoever follows him, and the tile it was found for. */
  private toMe = new Uint16Array(N * N)
  private trail = -1
  /** Chance that changes how a day goes comes from here, so that the same day can be played twice: see `chance`. */
  private seed: number
  private count = 0
  /** Whether the camp is out at the wall or resting, and how long that lasts yet, of how long. And how many charges there have been. */
  readonly phase = { charge: false, left: 0, full: 0 }
  /**
   * Whether the day has started. At dawn it stands still: the castle asks for wood, an arrow stands over a tree, and
   * the camp waits, until the helper is sent to a tree (or `start` is called).
   */
  begun = false
  /** The arrow, over the tree and then over the winch: from dawn until the first wood is at the castle. */
  private arrow: number[] = []
  private first = 0
  /** The notes that rise from the musician as he plays: three of them, a cube each for head, stem and flag. */
  private notes: number[][] = []
  round = 0
  /** How many good turns the two sides have done each other in this charge. */
  private lent = 0
  /** A duck that is following the helper about; the cat, out after a loaf or on its way back, and whether it has one. */
  private tail?: Pet
  private thief: '' | 'out' | 'back' = ''
  private loot = false
  private crumb = 0
  /** The camp's fire is out; and how long it goes on raining on it. */
  doused = false
  private pour = 0
  private storm: number[] = []
  private blows = 0
  /** The teeth of the wall that are off while the castle wants stone. */
  private loose: number[] = []
  private breach = false
  private gate = { open: 0, leaves: [0], bands: [0] }
  private lift = { y: LOW, dir: 0, hold: 0, cubes: [0], rope: 0, cargo: 0 }
  private loaves: number[] = []
  private mouth = 0
  private flames: number[] = []
  private racks: Record<Piled, number[]> = { wood: [], stone: [] }
  private marks: number[] = []
  private flags: number[][] = [[], []]
  private royals: Body[] = []
  readonly cat: Pet
  /** The ducks on the pond, and how far round it each is. */
  readonly ducks: (Pet & { a: number })[] = []
  private patted = 0
  private shots: Arrow[] = Array.from({ length: 40 }, () => ({ from: [0, 0, 0], to: [0, 0, 0], t: 0, time: 0, rest: 0 }))
  private next = 0
  private sticks = new InstancedMesh(unit, new MeshStandardMaterial({ color: 0x6b5446, roughness: 0.9 }), this.shots.length)
  private clock = 0
  private nudge = 0
  private party = 0
  private dusk = -1
  private pointed = -1

  /** @param seed which day it is: the same number, the same things asked for in the same order */
  constructor(seed = Math.floor(Math.random() * 1e6)) {
    this.seed = seed
    const { solid, wet, stand, high, on, made } = this
    // The land: under every tile a column of earth, and on it a slab of whatever lies on top. (How high each tile is,
    // and what runs across it, is worked out in `lay`.)
    const stair = new Map(STAIRS.map((one) => [at(one[0], one[1]), one]))
    /** Boxes, put somewhere: each given as where it is from there (across, how high its foot is, along), its size, and its colour. */
    const build = (parts: number[][], x: number, y: number, z: number, owner = -1) => parts.map(([dx, dy, dz, sx, sy, sz, ink]) => solid.add(x + dx, y + dy + sy / 2, z + dz, sx, sy, sz, ink, owner))
    // (For each tile of the brook, the two ways the water goes from its middle: up the brook and down it. It comes
    // in from the wall, and goes out into the pond.)
    const bends = new Map(BROOK.map(([x, z], k) => [at(x, z), [BROOK[k - 1] ?? [x, z - 1], BROOK[k + 1] ?? [x, z + 1]].map(([px, pz]) => [px - x, pz - z])]))
    const blooms = new Map<number, number[]>()
    for (let t = 0; t < N * N; t++) {
      const h = LAND[t]
      if (!h) continue
      const [x, z] = [across(t), along(t)]
      const steps = stair.get(t)
      if (steps) {
        // A stair: two treads of stone to the tile, the lower one half a step down. (Whoever is on it stands at the
        // height of the tread under them: see `foot`.)
        const [, , above, dx, dz] = steps
        for (const k of [0, 1]) {
          const tread = above - 0.5 * (k + 1)
          const [ox, oz] = [dx * (k * 0.5 - 0.25), dz * (k * 0.5 - 0.25)]
          solid.add(x + ox, (tread - 0.15) / 2, z + oz, dx ? 0.5 : 1, tread - 0.15, dz ? 0.5 : 1, WALLS[k + 2])
          solid.add(x + ox, tread - 0.075, z + oz, dx ? 0.5 : 1, 0.15, dz ? 0.5 : 1, PAVING[k])
        }
        stand[t] = high[t] = above - 0.75
        this.fx[t] = dx
        this.fz[t] = dz
        continue
      }
      const run = bends.get(t)
      if (run) {
        // The brook: a narrow bed through the middle of the tile, with grass either side of it. The tile is cut in
        // nine: the middle is water, and so are the two pieces it comes in and goes out by; the other six are bank.
        // It can be waded; and where the bridge is, walked over dry.
        solid.add(x, (h - 0.5) / 2, z, 1, h - 0.5, 1, SOIL)
        wet.add(x, h - 0.29, z, 0.6, 0.42, 0.6, WATER)
        for (const [i, j] of RING) {
          if (run.some(([dx, dz]) => dx === i && dz === j)) wet.add(x + i * 0.4, h - 0.29, z + j * 0.4, i ? 0.2 : 0.6, 0.42, j ? 0.2 : 0.6, WATER)
          else solid.add(x + i * 0.4, h - 0.25, z + j * 0.4, i ? 0.2 : 0.6, 0.5, j ? 0.2 : 0.6, GRASS[Math.floor(rnd(t * 3 + i + j * 5) * 3)])
        }
        const dry = x === BRIDGE[0] && z === BRIDGE[1]
        if (dry) build([[0, 0, 0, 1, 0.07, 0.72, WOOD], [0, 0.07, -0.33, 1, 0.14, 0.06, BARK], [0, 0.07, 0.33, 1, 0.14, 0.06, BARK]], x, h, z)
        stand[t] = high[t] = dry ? h + 0.07 : h - 0.42
        continue
      }
      if (WET.has(t)) {
        // The pond: water in a bed half a step deep, nearly to the top of it; and at each of its corners that sticks
        // out, a piece of bank, so that it is not square.
        solid.add(x, (h - 0.6) / 2, z, 1, h - 0.6, 1, SOIL)
        solid.add(x, h - 0.55, z, 1, 0.1, 1, BED)
        wet.add(x, h - 0.28, z, 1, 0.44, 1, WATER)
        for (const [i, j] of QUARTERS) if (!WET.has(at(x + i, z)) && !WET.has(at(x, z + j))) solid.add(x + i * 0.34, h - 0.25, z + j * 0.34, 0.32, 0.5, 0.32, GRASS[(i + j + 2) % 3])
        stand[t] = high[t] = h - 0.5
        continue
      }
      // Paved: the castle's own ground, but for the lawns in its yard; and the floor of stone under the winch, which
      // is stone all the way down.
      const slab = PAVED.has(t)
      const paved = slab || (plan(x, z) !== ' ' && !lawn(x, z))
      const tilled = FIELD.some(([px, pz]) => px === x && pz === z)
      solid.add(x, (h - 0.25) / 2, z, 1, h - 0.25, 1, slab ? WALLS[2 + ((x + z) & 1)] : SOIL)
      solid.add(x, h - 0.125, z, 1, 0.25, 1, paved ? PAVING[(x + z) & 1] : ROAD.has(t) ? PATH : tilled ? TILTH : GRASS[Math.floor(rnd(t) * 3)])
      stand[t] = high[t] = h
      if (paved || ROAD.has(t) || BUILT.has(t)) continue
      // What grows: grass that bends in the wind, and a flower here and there.
      for (let k = 0; k < 3; k++)
        if (rnd(t * 7 + k) < 0.3) {
          const gx = x + rnd(t * 11 + k) * 0.8 - 0.4
          const gz = z + rnd(t * 13 + k) * 0.8 - 0.4
          solid.bendy(solid.add(gx, h + 0.1, gz, 0.09, 0.2, 0.09, 0x7fca6c), 1, h, gx, gz)
          if (rnd(t * 17 + k) < 0.2) {
            const bloom = solid.add(gx, h + 0.25, gz, 0.15, 0.13, 0.15, [0xfffaf0, 0xffd45c, 0xffc2d9, 0xc4a4f0, 0xff9a85][Math.floor(rnd(t * 19 + k) * 5)])
            solid.bendy(bloom, 1, h, gx, gz)
            blooms.set(t, [...(blooms.get(t) ?? []), bloom])
          }
        }
      // Trees and rocks only where they can be seen from where the game is first looked at: in front of the castle,
      // to the west of it, or well out to the east. Not behind it.
      if (plan(x, z) !== ' ' || clear(x, z) || !(z >= 1 || x <= -8 || x >= 13)) continue
      if (h <= 3) this.grove.push(t)
      if (h >= 2) this.scree.push(t)
    }
    for (const t of BUILT) stand[t] = -1

    let seen = 7000 // (what is on a stone is the same on every visit)
    // On the pond: lily pads, one of them in flower; and at three of its corners, reeds.
    for (const [x, z, bloom] of [[5.3, 9.2, 1], [6.5, 10.2, 0], [4.7, 10.4, 0]]) build([[0, -0.06, 0, 0.34, 0.03, 0.34, 0x6fbf73], ...(bloom ? [[0.04, -0.03, 0.02, 0.14, 0.1, 0.14, 0xffc2d9]] : [])], x, 1, z)
    for (const [x, z] of [[3.66, 8.66], [7.34, 8.66], [6.34, 11.34]]) build([[-0.07, 0, 0, 0.06, 0.6, 0.06, 0x7fa862], [-0.07, 0.6, 0, 0.1, 0.2, 0.1, BARK], [0.08, 0, 0.05, 0.06, 0.42, 0.06, 0x8db36c], [0.08, 0.42, 0.05, 0.1, 0.18, 0.1, BARK]], x, 1, z)
    /**
     * A stone of the castle. On those of its faces that show (`faces`: which way each looks) there are small things:
     * stones that stand a little proud of it and, low down, where it is damp, moss.
     * @param base the height of the ground it is built on
     * @param bare where on a face there is to be nothing: a door or a slit is there
     */
    const stone = (greys: number[], x: number, y: number, z: number, sx: number, sy: number, sz: number, faces: number[][], base: number, bare?: (x: number, z: number) => boolean) => {
      solid.add(x, y, z, sx, sy, sz, greys[Math.floor(rnd(seen++) * greys.length)])
      for (const [nx, nz] of faces)
        for (let k = Math.ceil((nx ? sz : sx) * sy * 3); k > 0; k--) {
          const [what, u, v, size] = [rnd(seen++), rnd(seen++) - 0.5, rnd(seen++) - 0.5, rnd(seen++)]
          const low = y - base < 0.7
          if (what > (low ? 0.6 : 0.3)) continue
          const mossy = low && what < 0.36
          const s = mossy ? 0.2 + size * 0.2 : 0.11 + size * 0.09
          // Moss lies on the face, and a small stone is set in it: how thick each is, and how far its middle is from the face.
          const [thick, out] = mossy ? [0.05, 0.015] : [s, -0.1 * s]
          const room = (nx ? sz : sx) - s
          const [px, pz] = [x + nx * (sx / 2 + out) + (nx ? 0 : u * room), z + nz * (sz / 2 + out) + (nz ? 0 : u * room)]
          if (bare?.(px, pz)) continue
          solid.add(px, y + (mossy ? -Math.abs(v) : v) * (sy - s), pz, nx ? thick : s, mossy ? s * 0.8 : s, nz ? thick : s, mossy ? MOSS[Math.floor(size * 3)] : greys === WALLS ? TOWERS[Math.floor(size * 5)] : WALLS[Math.floor(size * 5)])
        }
    }
    /**
     * A stretch of wall on a tile: courses of two stones, laid like bricks, and two teeth on its outer edge.
     * @param side whether it runs across (and not along)
     * @param out which way is out: 1 or -1
     * @returns its teeth
     */
    const wall = (x: number, z: number, side: boolean, out: number, tall: number, base: number) => {
      const courses = Math.round(tall / 0.4)
      for (let k = 0; k < courses; k++) {
        const joint = k % 2 ? 0.12 : -0.12
        for (const [from, to] of [[-0.5, joint], [joint, 0.5]]) {
          const [mid, wide] = [(from + to) / 2, to - from]
          stone(WALLS, side ? x + mid : x, base + ((k + 0.5) * tall) / courses, side ? z : z + mid, side ? wide : 0.8, tall / courses, side ? 0.8 : wide, side ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]], base)
        }
      }
      stand[at(x, z)] = -1
      high[at(x, z)] = base + tall
      return [-0.25, 0.25].map((d) => solid.add(side ? x + d : x + out * 0.3, base + tall + 0.15, side ? z + out * 0.3 : z + d, 0.26, 0.3, 0.26, STONE[2]))
    }
    /** A tower on a tile: three courses of four stones, an arrow slit in every side, and (unless it is to have a roof) four teeth. */
    const tower = (x: number, z: number, tall = TOWER, base = STEP, teeth = true) => {
      for (let k = 0; k < 3; k++) {
        for (const [qx, qz] of QUARTERS) stone(TOWERS, x + qx * 0.375, base + ((k + 0.5) * tall) / 3, z + qz * 0.375, 0.75, tall / 3, 0.75, [[qx, 0], [0, qz]], base, (px, pz) => k === 1 && Math.min(Math.abs(px - x), Math.abs(pz - z)) < 0.24)
        if (k === 1) for (const [nx, nz] of NEAR) solid.add(x + nx * 0.75, base + tall / 2, z + nz * 0.75, nx ? 0.04 : 0.1, tall / 5, nz ? 0.04 : 0.1, SLIT)
      }
      if (teeth) for (const [dx, dz] of QUARTERS) solid.add(x + dx * 0.55, base + tall + 0.18, z + dz * 0.55, 0.4, 0.36, 0.4, STONE[2])
      stand[at(x, z)] = -1
      high[at(x, z)] = base + tall
    }
    /**
     * A roof of slates on something: slabs one on another, each smaller than the one under it.
     * @param less by how much
     * @returns how high its top is
     */
    const roof = (x: number, y: number, z: number, wide: number, less = 0.5) => {
      let k = 0
      for (let w = wide; w > 0.25; w -= less, k++) solid.add(x, y + 0.17 + k * 0.34, z, w, 0.34, w, ROOF[k % 2])
      return y + k * 0.34
    }
    /** A pennant on a short pole. @returns the cube of its cloth, which changes colour when its side gives up */
    const pennant = (x: number, y: number, z: number, ink: number) => {
      solid.add(x, y + 0.5, z, 0.08, 1, 0.08, BARK)
      return solid.add(x + 0.3, y + 0.8, z, 0.52, 0.34, 0.05, ink)
    }

    // The castle, tile by tile from its plan. A stretch of wall runs the way its neighbours lie, with its teeth on the
    // side that is not inside. (The east wall is a little higher than the west: nothing here was built in one go. And
    // the teeth either side of the gate are the ones that come off.)
    const inner = (x: number, z: number) => '.^'.includes(plan(x, z))
    for (let z = PZ; z <= 0; z++)
      for (let x = PX; x < PX + PLAN[0].length; x++) {
        const c = plan(x, z)
        if (c === '#' || c === 'h' || c === 'w') {
          const side = built(x - 1, z) || built(x + 1, z)
          const out = (side ? inner(x, z - 1) : inner(x - 1, z)) ? 1 : -1
          const teeth = wall(x, z, side, out, c === 'w' ? 0.8 : c === 'h' ? POST : x > 0 && !side ? 2 : WALL, upper(x, z) ? TOP : STEP)
          if (!z && (Math.abs(x) === 1 || Math.abs(x) === 3)) this.loose.push(...teeth)
        } else if (c === 'T' || c === 'C') tower(x, z)
        else if (c === 't') tower(x, z, 1.5, TOP)
        else if (c === 'R') {
          // The thin tower: taller than the rest, with a roof and a pennant.
          tower(x, z, 3.8, STEP, false)
          this.flags[0].push(pennant(x, roof(x, STEP + 3.8, z, 1.9), z, WEAR[0]))
          high[at(x, z)] = STEP + 5.5
        }
        // Where the ward looks down on the yard the earth is faced with stone: none of it is bare inside the walls.
        // (Where the stairs are, only what shows above them.)
        if (upper(x, z) && plan(x, z + 1) === '.') for (let k = stair.has(at(x, z + 1)) ? 3 : 0; k < 4; k++) stone(WALLS, x, STEP + 0.25 + k * 0.5, z + 0.6, 1, 0.5, 0.2, [[0, 1]], STEP)
      }
    // The fat tower at the south-east corner, over four tiles: three courses, a slit in each side, a roof and a pennant.
    const [bx, bz] = [7.5, -0.5]
    for (let k = 0; k < 3; k++) for (const [qx, qz] of QUARTERS) stone(TOWERS, bx + qx * 0.55, STEP + k + 0.5, bz + qz * 0.55, 1.1, 1, 1.1, [[qx, 0], [0, qz]], STEP, (px, pz) => k === 1 && Math.min(Math.abs(px - bx), Math.abs(pz - bz)) < 0.3)
    for (const [nx, nz] of NEAR) solid.add(bx + nx * 1.1, STEP + 1.5, bz + nz * 1.1, nx ? 0.04 : 0.14, 0.5, nz ? 0.04 : 0.14, SLIT)
    this.flags[0].push(pennant(bx, roof(bx, STEP + 3, bz, 2.7), bz, WEAR[0]))
    for (const [x, z] of [[7, -1], [8, -1], [7, 0], [8, 0]]) [stand[at(x, z)], high[at(x, z)]] = [-1, STEP + 5]
    // The gate: two leaves of a door between the two tall stretches, each with an iron band, a stone across over them,
    // two teeth on that, and a banner on either side.
    stone(WALLS, 0, STEP + POST - 0.2, 0, 1, 0.4, 0.8, [[0, 1], [0, -1]], STEP)
    for (const d of [-0.25, 0.25]) solid.add(d, STEP + POST + 0.15, 0.3, 0.26, 0.3, 0.26, STONE[2])
    for (const s of [-1, 1]) this.flags[0].push(solid.add(s, STEP + 1.5, 0.42, 0.4, 0.7, 0.04, WEAR[0]))
    this.gate.leaves = [-1, 1].map((s) => solid.add(s * 0.25, STEP + 1, 0, 0.47, 2, 0.16, WOOD))
    this.gate.bands = [-1, 1].map((s) => solid.add(s * 0.25, STEP + 1.3, 0.1, 0.47, 0.1, 0.04, 0x6b5446))
    high[GATE] = STEP + POST

    // The keep, in the corner of the ward: four courses of four great stones, slits high up, a door on the ward, a roof
    // with the flag on it, and a balcony for the princess, with its own door and two brackets to hold it.
    for (let k = 0; k < 4; k++) {
      for (const [qx, qz] of QUARTERS) stone(TOWERS, KX + qx * 0.75, TOP + ((k + 0.5) * KEEP) / 4, KZ + qz * 0.75, 1.5, KEEP / 4, 1.5, [[qx, 0], [0, qz]], TOP, (px, pz) => (k > 1 && Math.min(Math.abs(px - KX), Math.abs(pz - KZ)) < 0.8) || (!k && pz > KZ + 1 && Math.abs(px - KX) < 0.5))
      if (k === 3) for (const [nx, nz] of [[-1, 0], [1, 0], [0, -1]]) solid.add(KX + nx * 1.5, TOP + ((k + 0.5) * KEEP) / 4, KZ + nz * 1.5, nx ? 0.04 : 0.14, 0.6, nz ? 0.04 : 0.14, SLIT)
    }
    build([[0, 0, 1.5, 0.6, 1, 0.05, 0x7d6450], [0, 2.52, 1.5, 0.5, 0.9, 0.05, 0x7d6450], [0, 2.4, 1.85, 1.3, 0.12, 0.7, WALLS[0]], [-0.5, 2.1, 1.62, 0.12, 0.3, 0.24, TOWERS[0]], [0.5, 2.1, 1.62, 0.12, 0.3, 0.24, TOWERS[0]], [0, 2.52, 2.15, 1.3, 0.2, 0.1, STONE[2]]], KX, TOP, KZ)

    this.flags[0].push(pennant(KX, roof(KX, TOP + KEEP, KZ, 3.5, 0.7), KZ, WEAR[0]))
    for (const i of [-1, 0, 1]) for (const j of [-1, 0, 1]) [stand[at(KX + i, KZ + j)], high[at(KX + i, KZ + j)], on[at(KX + i, KZ + j)]] = [-1, TOP + KEEP + 1.5, PRINCESS]

    // In the yard: the musician's stool, a well with a roof, two casks, and a tree for shade. And where the stream
    // comes out through the south wall, a spout of stone.
    made.set(MUSIC, build([[0, 0, 0, 0.4, 0.3, 0.4, WOOD]], STOOL[0], STEP, STOOL[1], MUSIC))
    on[at(STOOL[0], STOOL[1])] = MUSIC
    build([[0, 0, -0.36, 0.9, 0.5, 0.18, STONE[0]], [0, 0, 0.36, 0.9, 0.5, 0.18, STONE[1]], [-0.36, 0, 0, 0.18, 0.5, 0.54, STONE[2]], [0.36, 0, 0, 0.18, 0.5, 0.54, STONE[0]], [0, 0.2, 0, 0.54, 0.1, 0.54, WATER], [-0.36, 0.5, 0, 0.1, 0.9, 0.1, BARK], [0.36, 0.5, 0, 0.1, 0.9, 0.1, BARK], [0, 1.4, 0, 1.1, 0.12, 0.8, 0xc9654f]], WELL[0], STEP, WELL[1])
    made.set(CAT, build([[-0.22, 0, 0, 0.42, 0.6, 0.42, WOOD], [0.24, 0, 0.1, 0.42, 0.5, 0.42, BARK]], CASKS[0], STEP, CASKS[1], CAT))
    on[at(CASKS[0], CASKS[1])] = CAT
    // (It is an apple tree, and the apples are there to be picked.)
    const orchard = TRUNK.map(([y, wide, tall], k) => solid.add(SHADE[0], STEP + y, SHADE[1], wide, tall, wide, k ? LEAF[k] : BARK, APPLE))
    for (const [dx, y, dz] of [[0.5, 1.2, 0.2], [-0.2, 1.05, 0.5], [0.34, 1.75, -0.1], [-0.5, 1.4, -0.15], [0.05, 1.9, 0.34], [-0.1, 2.4, 0.02]]) orchard.push(solid.add(SHADE[0] + dx, STEP + y, SHADE[1] + dz, 0.17, 0.17, 0.17, LOOK.apple[3], APPLE))
    orchard.forEach((c, k) => solid.bendy(c, k ? 0.07 : 0, STEP, SHADE[0], SHADE[1]))
    made.set(APPLE, orchard)
    on[at(SHADE[0], SHADE[1])] = APPLE
    build([[0, 0.34, 0.55, 0.3, 0.22, 0.3, STONE[0]], [0, 0.38, 0.41, 0.18, 0.14, 0.04, SLIT]], 5, STEP, 0)

    // The winch, on its own tower in the west wall: a post, an arm out over the floor of stone below, a rope, and the
    // basket on the end of it.
    build([[0, 0, 0, 0.16, 1.3, 0.16, WOOD], [-0.55, 1.18, 0, 1.4, 0.12, 0.12, WOOD]], X0, STEP + TOWER, WINCH, BASKET)
    this.lift.cubes = build([[0, 0, 0, 0.72, 0.34, 0.72, 0xc9a36b], [0, 0.34, 0, 0.8, 0.06, 0.8, 0xa98558]], HOOK, LOW, WINCH, BASKET)
    this.lift.rope = solid.add(HOOK, 0, WINCH, 0.05, 1, 0.05, 0xd9c9a0, BASKET)
    this.lift.cargo = solid.add(HOOK, 0, WINCH, 0.3, 0.2, 0.3, WOOD, BASKET, false)
    made.set(BASKET, this.lift.cubes)
    on[at(X0 - 1, WINCH)] = BASKET



    // The camp. A big striped tent with a pennant, open to the west; the prince's chair beside its door; a table; a
    // flag on a pole; and a fire in a ring of stones, with a pot of soup hung over it.
    const stripes = [3.1, 2.4, 1.7, 1, 0.4].map((wide, k) => [0, 0.9 + k * 0.3, 0, wide, 0.3, wide, k % 2 ? CREAM : WEAR[1]])
    build([[0, 0, 0, 2.7, 0.9, 2.7, CREAM], ...stripes, [0, 2.4, 0, 0.08, 0.8, 0.08, BARK], [-1.36, 0, 0, 0.04, 0.75, 0.7, 0x5a4a52]], TENT[0], 1, TENT[1], TABLE)
    this.flags[1].push(solid.add(TENT[0] + 0.29, 3.95, TENT[1], 0.5, 0.26, 0.05, WEAR[1]))
    for (const i of [-1, 0, 1]) for (const j of [-1, 0, 1]) on[at(TENT[0] + i, TENT[1] + j)] = TABLE
    build([[0, 0, 0, 0.6, 0.42, 0.7, WOOD], [-0.02, 0.42, 0, 0.48, 0.06, 0.56, WEAR[1]], [0.26, 0.42, 0, 0.08, 0.8, 0.7, WOOD]], THRONE[0], 1, THRONE[1], PRINCE)
    on[at(THRONE[0], THRONE[1])] = PRINCE
    build([[0, 0, 0, 0.1, 2.6, 0.1, BARK]], POLE[0], 1, POLE[1])
    this.flags[1].push(solid.add(POLE[0] + 0.4, 3.3, POLE[1], 0.7, 0.44, 0.06, WEAR[1]))
    made.set(TABLE, build([[0, 0.6, 0, 0.9, 0.1, 1.9, WOOD], ...QUARTERS.map(([i, j]) => [i * 0.35, 0, j * 0.82, 0.1, 0.6, 0.1, BARK])], BOARD[0], 1, BOARD[1], TABLE))
    for (const d of [-0.5, 0.5]) on[at(BOARD[0], BOARD[1] + d)] = TABLE

    build([...Array.from({ length: 6 }, (_, k) => [Math.sin(k) * 0.4, 0, Math.cos(k) * 0.4, 0.16, 0.12, 0.16, STONE[k % 3]]), [0, 0, 0, 0.5, 0.1, 0.12, BARK], [0, 0.1, 0, 0.12, 0.1, 0.5, BARK]], FIRE[0], 1, FIRE[1])
    this.flames = [0.26, 0.15].map((s, k) => solid.add(FIRE[0], 1.3 + k * 0.3, FIRE[1], s, s * 1.4, s, k ? 0xffd45c : 0xff8a3d, HEARTH))
    this.storm = CLOUD.map(([dx, dy, dz, sx, sy, sz, ink]) => solid.add(FIRE[0] + dx * 3.4, 4.6 + dy * 3.4, FIRE[1] + dz * 3.4, sx * 3.4, sy * 3.4, sz * 3.4, ink, -1, false))
    this.crumb = solid.add(0, 0, 0, 0.34, 0.2, 0.26, LOOK.bread[3], CAT, false)
    made.set(HEARTH, [...this.flames, ...build([[-0.44, 0, 0, 0.08, 1.4, 0.08, BARK], [0.44, 0, 0, 0.08, 1.4, 0.08, BARK], [0, 1.32, 0, 0.96, 0.08, 0.08, BARK], [0, 1.08, 0, 0.04, 0.24, 0.04, 0x4a4550], [0, 0.82, 0, 0.38, 0.26, 0.38, 0x4a4550]], FIRE[0], 1, FIRE[1], HEARTH)])
    on[at(FIRE[0], FIRE[1])] = HEARTH
    for (const c of this.flames) solid.paint(c, c === this.flames[0] ? 0xff8a3d : 0xffd45c, 1.6)

    // The farm. Beside the cottage, a rack for logs and a tray for stones: what he has no use for just now he puts
    // there, and takes again when it is wanted. (One of each to begin with, so that what they are for can be seen.)
    made.set(LOGS, build([[-0.42, 0, 0, 0.08, 0.55, 0.5, BARK], [0.42, 0, 0, 0.08, 0.55, 0.5, BARK]], RACK[0], 1, RACK[1], LOGS))
    this.racks.wood = [[-0.13, 0.02], [0.13, 0.02], [-0.13, 0.2], [0.13, 0.2]].map(([dz, dy]) => solid.add(RACK[0], 1 + dy + 0.085, RACK[1] + dz, 0.74, 0.17, 0.17, LOOK.wood[3], LOGS, false))
    made.set(HEAP, build([[0, 0, 0, 0.84, 0.06, 0.84, WOOD], [-0.4, 0.06, 0, 0.04, 0.12, 0.84, BARK], [0.4, 0.06, 0, 0.04, 0.12, 0.84, BARK]], TRAY[0], 1, TRAY[1], HEAP))
    this.racks.stone = [[-0.17, -0.18], [0.17, -0.14], [-0.15, 0.18], [0.16, 0.19]].map(([dx, dz]) => solid.add(TRAY[0] + dx, 1.06 + 0.13, TRAY[1] + dz, 0.28, 0.26, 0.28, LOOK.stone[3], HEAP, false))
    for (const [id, [x, z]] of [[LOGS, RACK], [HEAP, TRAY]] as [number, number[]][]) {
      made.get(id)!.push(...this.racks[id === LOGS ? 'wood' : 'stone'])
      on[at(x, z)] = id
    }
    // Four plots, each with nine stalks to come; an oven with a shelf for its loaves; a scarecrow; and the
    // helper's cottage: four walls, a thatched roof in steps, a door and a window to the south, and a chimney.
    FIELD.forEach(([x, z, from], i) => {
      const spots = Array.from({ length: 9 }, (_, k) => [x + ((k % 3) - 1) * 0.3 + (rnd(seen++) - 0.5) * 0.1, z + (Math.floor(k / 3) - 1) * 0.3 + (rnd(seen++) - 0.5) * 0.1])
      const stalks = spots.map(([sx, sz]) => solid.add(sx, 1.1, sz, 0.09, 0.2, 0.09, WHEAT[0], PLOT + i, false))
      stalks.forEach((c, k) => solid.bendy(c, 0.6, 1, spots[k][0], spots[k][1]))
      const ridges = build([-0.3, 0, 0.3].map((d) => [d, 0, 0, 0.14, 0.05, 0.9, 0x8a6549]), x, 1, z, PLOT + i)
      // (Two are sown already, and well on: what a plot is for can be seen before it has to be found out.)
      this.plots.push({ t: at(x, z), from: at(from, z), age: i % 3 ? -1 : 0.55, stage: -2, stalks, spots })
      made.set(PLOT + i, [...stalks, ...ridges])
      on[at(x, z)] = PLOT + i
    })
    const clay = 0xd9906c
    made.set(OVEN, build([[0, 0, 0, 0.9, 0.35, 0.9, STONE[1]], [0, 0.35, 0, 0.8, 0.4, 0.8, clay], [0, 0.75, 0, 0.4, 0.16, 0.4, 0xcf8560], [-0.3, 0.75, -0.3, 0.18, 0.5, 0.18, STONE[0]], [-1, 0.3, 0, 0.36, 0.06, 0.9, WOOD], [-1, 0, -0.36, 0.1, 0.3, 0.1, BARK], [-1, 0, 0.36, 0.1, 0.3, 0.1, BARK]], STOVE[0], 1, STOVE[1], OVEN))
    this.mouth = solid.add(STOVE[0], 1.52, STOVE[1] + 0.4, 0.34, 0.24, 0.04, 0x4a3a40, OVEN)
    this.loaves = [-0.28, 0, 0.28].map((d) => solid.add(STOVE[0] - 1, 1.43, STOVE[1] + d, 0.24, 0.14, 0.2, LOOK.bread[3], OVEN, false))
    for (const x of [STOVE[0], STOVE[0] - 1]) on[at(x, STOVE[1])] = OVEN
    build([[0, 0, 0, 0.1, 0.6, 0.1, BARK], [0, 0.6, 0, 0.44, 0.4, 0.2, 0x7fb0e0], [-0.36, 0.82, 0, 0.28, 0.1, 0.1, BARK], [0.36, 0.82, 0, 0.28, 0.1, 0.1, BARK], [0, 1, 0, 0.3, 0.3, 0.3, STRAW], [0, 1.3, 0, 0.46, 0.06, 0.46, 0x7d6450], [0, 1.36, 0, 0.24, 0.14, 0.24, 0x7d6450]], CROW[0], 1, CROW[1])
    build([[0, 0, 0, 1.8, 0.9, 1.8, CREAM], ...[2.1, 1.5, 0.9, 0.3].map((wide, k) => [0, 0.9 + k * 0.3, 0, wide, 0.3, 2.1, k % 2 ? 0xdcbf72 : STRAW]), [-0.3, 0, 0.91, 0.4, 0.66, 0.04, BARK], [0.42, 0.34, 0.91, 0.26, 0.26, 0.04, 0x5a4a52], [0.6, 1.5, -0.5, 0.22, 0.6, 0.22, STONE[0]]], HUT[0], 1, HUT[1])

    // Rocks on the slopes and trees below them, not too near each other, and only where the helper can get to: the
    // same ones at the start of every day.
    const pick = (from: number[], n: number, key: number, apart: number) => {
      const got: number[] = []
      for (const t of [...from].sort((a, b) => rnd(a * key) - rnd(b * key))) if (got.length < n && stand[t] >= 0 && RING.every(([i, j]) => on[t + i + j * N] < 0) && got.every((o) => Math.max(Math.abs(across(o) - across(t)), Math.abs(along(o) - along(t))) > apart)) got.push(t)
      return got
    }
    const reach = this.flow(new Uint16Array(N * N), [at(-13, 6)], true)
    // Every flower that grows where he can get to is one he can pick: a click on it will do. (No tree comes up there,
    // and no rock lands.)
    for (const [t, cubes] of blooms) {
      if (reach[t] === FAR || stand[t] < 0 || clear(across(t), along(t))) continue
      for (const c of cubes) solid.owner[c] = FLOWER + this.flowers.length
      made.set(FLOWER + this.flowers.length, cubes)
      this.flowers.push({ t, ground: stand[t], cubes, away: 0 })
    }
    const flowery = new Set(this.flowers.map((one) => one.t))
    this.grove = this.grove.filter((t) => reach[t] < FAR && !flowery.has(t))
    this.scree = this.scree.filter((t) => reach[t] < FAR && !flowery.has(t))
    pick(this.scree, 7, 91, 2).forEach((t, i) => {
      const cubes = build(BOULDER, across(t), stand[t], along(t), ROCK + i)
      this.rocks.push({ t, ground: stand[t], cubes, away: 0 })
      made.set(ROCK + i, cubes)
      this.hold(t, ROCK + i)
    })
    pick(this.grove, 16, 57, 3).forEach((t, i) => {
      const cubes = TRUNK.map((_, k) => solid.add(0, 0, 0, 1, 1, 1, k ? LEAF[(i + k) % 3] : BARK, TREE + i))
      this.trees.push({ t, ground: stand[t], cubes, grown: 1, stage: -1, away: 0 })
      made.set(TREE + i, cubes)
      this.hold(t, TREE + i)
    })

    // The people. Six of the castle on its south wall, six of the camp by their fire; the princess on the keep and the
    // prince on his chair; the musician on his stool, the cat on a cask, three ducks on the pond; and the helper, by
    // his field.
    const body = (parts: Part[], x: number, y: number, z: number, owner = -1): Body => ({ x, y, z, turn: 0, drawn: '', parts, stride: 0, hop: 0, cubes: parts.map(([, , , sx, sy, sz, ink]) => solid.add(x, y, z, sx, sy, sz, ink, owner)) })
    const fighter = (side: number, kind: Kind, x: number, y: number, z: number, home = -1, front = -1): Fighter => ({
      ...body(SOLDIER[kind](WEAR[side]), x, y, z),
      ...{ side, kind, sad: false, home, front, busy: false, wait: 1 + rnd(seen++) * 2, swing: 0, dim: false, gone: false },
      cloud: CLOUD.map(([, , , sx, sy, sz, ink]) => solid.add(x, y, z, sx, sy, sz, ink, -1, false)),
    })
    // (On the wall they stand a little back from its teeth.)
    for (const [x, tall] of POSTS) this.men.push(fighter(0, 'archer', x, STEP + (tall ? TOWER : WALL), tall ? 0 : -0.12))
    SEATS.forEach(([x, z, fx, fz], k) => this.men.push(fighter(1, k < 4 ? 'sword' : 'archer', x, 1, z, at(x, z), at(fx, fz))))
    this.royals = [body(LADY, KX, TOP + 2.52, KZ + 1.82, PRINCESS), { ...body(LORD, THRONE[0], 1.48, THRONE[1], PRINCE), turn: 3 }]
    made.set(PRINCESS, this.royals[0].cubes)
    made.set(PRINCE, this.royals[1].cubes)
    this.cat = { ...body(PUSS, CASKS[0] - 0.22, STEP + 0.6, CASKS[1], CAT), away: false, ride: false, stay: 0 }
    made.get(CAT)!.push(...this.cat.cubes)
    for (const a of [0, 2.1, 4.2]) this.ducks.push({ ...body(DRAKE, POND[0], 0.9, POND[1], DUCK), a, away: false, ride: false, stay: 0 })
    made.set(DUCK, this.ducks.flatMap((duck) => duck.cubes))
    for (const [x, z] of LAKE) on[at(x, z)] = DUCK
    this.tune = { ...body(BARD, STOOL[0], STEP, STOOL[1], MUSIC), mode: 'home', seated: true, left: 0, beat: 0, to: STAGE }
    made.get(MUSIC)!.push(...this.tune.cubes)
    this.notes = [0, 1, 2].map(() => QUAVER.map(([, , , sx, sy, sz]) => solid.add(0, -40, 0, sx, sy, sz, 0x6b4fa8, MUSIC)))
    this.me = { ...body(HELPER, -13, 1, 6), loads: [], pets: [], rise: [], queue: [], work: 0, beat: 0, no: 0, idle: 0 }
    this.stack()
    // Over whatever he has been told to see to, a small cube: up to four of them. The one he is about is bright, and
    // each one after it is darker, so that it can be seen in what order he will get to them.
    this.marks = [0xfff6c9, 0xf2b84b, 0xc97a3a, 0x8a5230].map((ink, k) => {
      const mark = solid.add(0, 0, 0, 0.2, 0.2, 0.2, ink, -1, false)
      solid.paint(mark, ink, 1.7 - k * 0.27)
      return mark
    })
    this.store()
    // Dawn: the castle wants wood, and an arrow stands over the tree nearest the helper. (A click on the arrow is a
    // click on the tree.)
    this.want(0, 'wood')
    this.first = this.trees.reduce((a, tree, i) => (Math.hypot(across(tree.t) - this.me.x, along(tree.t) - this.me.z) < Math.hypot(across(this.trees[a].t) - this.me.x, along(this.trees[a].t) - this.me.z) ? i : a), 0)
    this.arrow = ARROW.map(([, , , sx, sy, sz]) => {
      const c = solid.add(0, -40, 0, sx * 1.6, sy * 1.6, sz * 1.6, POINTER, TREE + this.first)
      solid.paint(c, POINTER, 1.7)
      return c
    })

    // The light: a low warm sun, a soft sky, and a floor that only shows the shadows that fall on it.
    const { key } = this
    key.position.set(-16, 30, 12)
    key.castShadow = true
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.04
    this.shadows(0)
    Object.assign(key.shadow.camera, { near: 1, far: 110, left: -36, right: 36, top: 36, bottom: -36 })
    const floor = new Mesh(new CircleGeometry(300, 32), new ShadowMaterial({ color: 0x6d4a7a, opacity: 0.25 }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.sticks.instanceMatrix.setUsage(DynamicDrawUsage)
    this.sticks.frustumCulled = false
    this.sticks.castShadow = true
    for (let i = 0; i < this.shots.length; i++) this.sticks.setMatrixAt(i, _m.makeScale(0, 0, 0))
    wet.mesh.castShadow = false
    this.group.add(solid.mesh, wet.mesh, this.bits.mesh, this.sticks, key, key.target, this.glow, floor)
    this.update(0)
  }
  /** The shadows at the size that goes with a step of the picture (see `../Picture.tsx`). */
  shadows(tier: number) {
    shade(this.key, tier)
  }
  /** What it holds on the graphics card is given back: for a world that is thrown away for a new one. */
  dispose() {
    for (const mesh of [this.solid.mesh, this.wet.mesh, this.bits.mesh, this.sticks]) mesh.dispose()
  }
  /** A number from 0 to 1 that is the same whenever the same day is played the same way. */
  private chance() {
    return rnd(this.seed++)
  }
  /** How many of a side are on their feet. */
  standing(side: number) {
    return this.men.filter((man) => man.side === side && !man.sad && !man.gone).length
  }

  // What the page does with it.

  /** What is to be clicked at cube `cube` of the land (-1 for none of them), at (x, z): the number of a thing, or -1. */
  private under(cube: number, x: number, z: number) {
    const own = cube >= 0 ? this.solid.owner[cube] : -1
    // (A cat that is making off with a loaf is small and quick: a click anywhere near it is a click on the cat.)
    if (this.thief && Math.hypot(this.cat.x - x, this.cat.z - z) < 1.6) return CAT
    if (own >= 0 || Math.max(Math.abs(x), Math.abs(z)) >= REACH - 2) return own
    // On the ground, or on somebody: whatever stands nearest, within a tile and a bit. Things are small, and a click
    // beside one is meant for it.
    let [id, least] = [-1, 1.3]
    for (const [i, j] of [[0, 0], ...RING]) {
      const t = at(Math.round(x) + i, Math.round(z) + j)
      const far = Math.hypot(across(t) - x, along(t) - z)
      if (this.on[t] >= 0 && far < least) [id, least] = [this.on[t], far]
    }
    // (And while somebody wants a flower, a click on ground where one grows is a click on the flower.)
    const bloom = id < 0 && this.asks.some((ask) => ask.what === 'flower') ? this.flowers.findIndex((one) => one.t === spot(x, z) && !one.away) : -1
    return bloom < 0 ? id : FLOWER + bloom
  }
  /**
   * The cursor is over cube `cube` of the land, at (x, z). What can be clicked gives a little under it.
   * @returns whether a click there would be for something
   */
  hover(cube: number, x: number, z: number) {
    const id = this.over ? -1 : this.under(cube, x, z)
    if (id >= 0 && id !== this.pointed) for (const c of this.made.get(id) ?? []) this.solid.poke(c, 2.5)
    this.pointed = id
    return id >= 0
  }
  /** A click there. On a thing, it is one more for the helper to see to; on open ground, he drops what he was about and goes. */
  click(cube: number, x: number, z: number) {
    if (this.over || Math.max(Math.abs(x), Math.abs(z)) >= REACH - 2) return
    const id = this.under(cube, x, z)
    if (id >= 0) return this.order(id)
    let [to, least] = [-1, Infinity]
    for (const [i, j] of [[0, 0], ...RING]) {
      const [tx, tz] = [Math.round(x) + i, Math.round(z) + j]
      const far = Math.hypot(tx - x, tz - z)
      if (far < least && this.stand[at(tx, tz)] >= 0) [to, least] = [at(tx, tz), far]
    }
    if (to < 0) return
    this.me.queue.length = 0
    this.me.work = 0
    this.me.queue.push({ id: -1, t: to })
  }
  /**
   * The helper is to see to a thing, after whatever he has still to do: `TREE + 3`, `OVEN`, `BASKET` and so on. Four at
   * most. What plainly cannot come to anything he refuses there and then, without going all the way to find out:
   * giving where nothing he has is wanted, or fetching with no room on his hat. Then whatever would help shows itself.
   */
  order(id: number) {
    const { me } = this
    if (this.over) return
    // (A cat making off with a loaf is stopped by a click. Otherwise the cat and the ducks are for patting, unless one
    // of them has been asked for.)
    if (id === CAT && this.thief) return this.nab()
    if ((id === CAT || id === DUCK) && !this.asks.some((ask) => ask.what === (id === CAT ? 'cat' : 'duck'))) return this.pat(id)
    // (One more of the same from the oven, the rack or the tray is a thing to ask for twice running; anything else is not.)
    const again = id === OVEN || id === LOGS || id === HEAP
    if (me.queue.length >= 4 || (!again && me.queue[me.queue.length - 1]?.id === id)) return
    const kind = id - (id % 1000)
    const music = this.tune.mode === 'follow' || me.queue.some((job) => job.id === MUSIC)
    const gift = id === PRINCESS || id === PRINCE
    const wanted = me.loads.some((item) => this.takes(id === BASKET || id === PRINCESS ? 0 : 1, item, gift))
    // (What he will have by the time he gets there cannot be told once he has been sent for something else first.)
    const sure = !me.queue.length
    const no =
      id === WED ? !music
      : id === BASKET || id === TABLE || gift ? sure && !wanted && !(id === TABLE && music)
      : (kind === TREE || kind === ROCK || kind === FLOWER || id === DUCK || id === CAT || id === APPLE) && sure && !this.spare()
    if (no) {
      me.no = 0.45
      note(0.02, 0.06)
      if (this.asks.length) this.point()
      return
    }
    me.queue.push({ id, t: this.tile(id) })
    note(0.3 + me.queue.length * 0.1, 0.05)
  }
  /** The day starts, with the first wood brought to the castle: the arrow goes and the camp sets out at once. */
  start() {
    if (this.begun) return
    this.begun = true
    for (const c of this.arrow) this.solid.hide(c)
  }
  /**
   * Whoever asked for something is answered: the helper is sent to where it is brought, with what he has. For the
   * castle that is the basket, for the camp its table; the princess and the prince are brought theirs in person.
   */
  serve(ask: number) {
    const one = this.asks.find((it) => it.id === ask)
    if (one) this.order(one.side > 1 ? WED : one.still ? HEARTH : (one.love ? [PRINCESS, PRINCE] : [BASKET, TABLE])[one.side])
  }
  /**
   * Whether something would be taken: only what has been asked for.
   * @param love by the princess (side 0) or the prince, and not by the castle or the camp
   */
  private takes(side: number, good: string, love = false) {
    return this.asks.some((ask) => ask.side === side && ask.what === good && !ask.love === !love)
  }
  /** How many more of something he has than anybody wants just now. */
  private extra(item: Item) {
    return this.me.loads.filter((one) => one === item).length - this.asks.filter((ask) => ask.what === item).length
  }
  /**
   * Whether there is room on his hat for one thing more: a place free, or something on it that nobody wants, which he
   * would let go of. (Not a sheaf: that is on its way to the oven.)
   */
  private spare() {
    return this.me.loads.length < HAT || this.me.loads.some((item) => item !== 'wheat' && this.extra(item) > 0)
  }

  // Where things are, and the ways to them.

  /** The tile a thing is on: -1 for one that is not on a tile of its own. */
  private tile(id: number) {
    const i = id % 1000
    const kind = id - i
    return kind === TREE ? this.trees[i].t : kind === ROCK ? this.rocks[i].t : kind === PLOT ? this.plots[i].t : kind === FLOWER ? this.flowers[i].t : -1
  }
  /** Where a thing is, across and along. */
  private site(id: number) {
    const t = this.tile(id)
    if (t >= 0) return [across(t), along(t)]
    return id === OVEN ? STOVE : id === LOGS ? RACK : id === HEAP ? TRAY : id === BASKET ? [HOOK, WINCH] : id === TABLE ? BOARD : id === HEARTH ? FIRE : id === DUCK ? POND : id === CAT ? CASKS : id === APPLE ? SHADE : id === WED ? [0, 1] : id === PRINCESS ? [KX, KZ + 1.8] : id === PRINCE ? THRONE : [this.tune.x, this.tune.z]
  }
  /** Where the mark over a job goes. */
  private above(task: Task) {
    const { id, t } = task
    if (id < 0) return [across(t), this.stand[t] + 0.55, along(t)]
    const [x, z] = this.site(id)
    const [kind, i] = [id - (id % 1000), id % 1000]
    const tree = this.trees[i]
    const y =
      kind === TREE ? tree.ground + 0.5 + 2.2 * (0.4 + 0.6 * tree.grown)
      : kind === ROCK ? this.rocks[i].ground + 1.1
      : kind === FLOWER ? this.flowers[i].ground + 0.9
      : id === BASKET ? this.lift.y + 1
      : id === MUSIC ? this.tune.y + 2
      : id === CAT || id === WED ? STEP + 1.7
      : id === PRINCESS ? TOP + 4.6
      : id === APPLE ? STEP + 3
      : id === LOGS || id === HEAP ? 2 // (low: what is said over the rack and the tray is over it)
      : id === DUCK ? 1.7
      : 2.5
    return [x, y, z]
  }
  /** The tiles a job is done from. */
  private stands(task: Task) {
    const { id, t } = task
    if (id < 0) return [t]
    if (id - (id % 1000) === PLOT) return [this.plots[id % 1000].from]
    if (id === OVEN) return [BAKERY]
    if (id === LOGS) return [at(RACK[0] - 1, RACK[1])]
    if (id === HEAP) return [at(TRAY[0] - 1, TRAY[1])]
    if (id === BASKET) return [BAY]
    if (id === TABLE) return SERVE
    if (id === HEARTH) return [at(FIRE[0], FIRE[1] + 1)]
    if (id === DUCK) return [at(4, 11)]
    if (id === WED) return [at(-1, 2)]
    if (id === PRINCESS) return [at(KX, KZ + 2)] // under her balcony
    if (id === PRINCE) return [at(THRONE[0] - 1, THRONE[1])]
    if (id - (id % 1000) === FLOWER) return [t] // (a flower is picked from where it grows)
    // A tree, a rock, the cat, the apple tree or the musician: from any tile beside it. (But not from the one the
    // musician steps down on to.)
    const middle = id === MUSIC ? at(STOOL[0], STOOL[1]) : id === CAT ? at(CASKS[0], CASKS[1]) : id === APPLE ? at(SHADE[0], SHADE[1]) : t
    return NEAR.map(([i, j]) => middle + i + j * N).filter((tile) => id !== MUSIC || tile !== HOME)
  }
  /**
   * Whether somebody can go from one tile to the next: both are somewhere to stand, and the step between is not too high.
   * @param key whether the gate opens for whoever it is: for the helper and the musician it does
   */
  private pass(a: number, b: number, key: boolean) {
    return this.stand[a] >= 0 && this.stand[b] >= 0 && Math.abs(this.stand[b] - this.stand[a]) <= STRIDE && (key || (a !== GATE && b !== GATE))
  }
  /** For every tile, how many steps it is on foot to the nearest of `from`: FAR where there is no way. */
  private flow(out: Uint16Array, from: number[], key: boolean) {
    out.fill(FAR)
    const todo = from.filter((t) => this.stand[t] >= 0)
    for (const t of todo) out[t] = 0
    for (let k = 0; k < todo.length; k++) {
      const t = todo[k]
      for (const n of [t + 1, t - 1, t + N, t - N]) {
        if (out[n] <= out[t] + 1 || !this.pass(n, t, key)) continue
        out[n] = out[t] + 1
        todo.push(n)
      }
    }
    return out
  }
  /** The way to one tile, kept until a tree or a rock moves. */
  private route(to: number, key = false) {
    const id = to * 2 + (key ? 1 : 0)
    let found = this.routes.get(id)
    if (!found || found.stamp !== this.stamp) this.routes.set(id, (found = { stamp: this.stamp, way: this.flow(found?.way ?? new Uint16Array(N * N), [to], key) }))
    return found.way
  }
  /** The way to a job, likewise. */
  private way(task: Task) {
    if (task.way && task.stamp === this.stamp) return task.way
    task.stamp = this.stamp
    return (task.way = this.flow(task.way ?? new Uint16Array(N * N), this.stands(task), true))
  }
  /**
   * A step along a way: towards the middle of whichever tile next to it is nearest to where the way leads, and at the
   * end of the way to the middle of that.
   * @returns whether it is there
   */
  private walk(who: Body, way: Uint16Array, pace: number, dt: number, key = false) {
    const t = spot(who.x, who.z)
    let to = t
    for (const [i, j] of RING) {
      const n = t + i + j * N
      // (Across a corner only where both ways round it are open: nobody cuts through the corner of a wall.)
      if (way[n] < way[to] && this.pass(t, n, key) && (!i || !j || (this.pass(t, t + i, key) && this.pass(t, t + j * N, key) && this.pass(t + i, n, key) && this.pass(t + j * N, n, key)))) to = n
    }
    const [dx, dz] = [across(to) - who.x, along(to) - who.z]
    const far = Math.hypot(dx, dz)
    if (far < 0.04) {
      who.stride = 0
      return true
    }
    const go = Math.min(far, pace * dt)
    who.turn = turned(dx, dz)
    who.x += (dx / far) * go
    who.z += (dz / far) * go
    who.stride += go * 1.5
    return false
  }
  /** How high whoever is at (x, z) stands: on a stair, the tread they are on. Less than nothing where nobody can be. */
  private foot(x: number, z: number) {
    const t = spot(x, z)
    const down = (x - Math.round(x)) * this.fx[t] + (z - Math.round(z)) * this.fz[t]
    return this.stand[t] < 0 ? -1 : this.stand[t] + (this.fx[t] || this.fz[t] ? (down < 0 ? 0.25 : -0.25) : 0)
  }
  /** The way to the helper, for whoever is following him: found again whenever he is on another tile. */
  private chase() {
    const t = spot(this.me.x, this.me.z)
    if (t !== this.trail) this.flow(this.toMe, [(this.trail = t)], true)
    return this.toMe
  }
  /** A tile is taken by a thing, or given up by one: the ways have to be found again. */
  private hold(t: number, id: number) {
    this.stand[t] = -1
    this.on[t] = id
    this.stamp++
  }
  private free(t: number, ground: number) {
    this.stand[t] = ground
    this.on[t] = -1
    this.stamp++
  }
  /** Somewhere new for a tree or a rock: one of `tiles` with nothing on it or beside it, and nobody. -1 if there is none. */
  private room(tiles: number[]) {
    const taken = new Set([this.me, this.tune, ...this.men].map((one) => spot(one.x, one.z)))
    const open = tiles.filter((t) => this.stand[t] >= 0 && !taken.has(t) && RING.every(([i, j]) => this.on[t + i + j * N] < 0 && !taken.has(t + i + j * N)))
    return open.length ? open[Math.floor(this.chance() * open.length)] : -1
  }

  // Drawing people.

  /**
   * The cubes of something made of parts go where it is, turned the way it looks.
   * @param look what its cubes are to be sized for: their sizes are only set afresh when that changes
   * @param shape another place or size for a part, where it is not as it was measured: for one that sits, or holds something up
   */
  private put(body: Body, lift: number, look: string, shape?: (part: Part, k: number) => Part) {
    const [a, b, c, d] = TURNS[body.turn]
    const odd = body.turn & 1
    const sized = look + odd
    body.parts.forEach((part, k) => {
      const [dx, dy, dz, sx, sy, sz] = shape ? shape(part, k) : part
      if (sized !== body.drawn) this.solid.size(body.cubes[k], odd ? sz : sx, sy, odd ? sx : sz)
      this.solid.place(body.cubes[k], body.x + a * dx + b * dz, body.y + lift + dy + sy / 2, body.z + c * dx + d * dz)
    })
    body.drawn = sized
  }
  /**
   * Somebody's cubes go where they are: on their feet or sitting, at a hop if they are walking or glad.
   * @param hold how far what they hold is lifted: for a blow, or a shot, or a chord
   */
  private pose(one: Body, sit = false, lift = 0, hold = 0) {
    const up = lift + Math.abs(Math.sin(one.stride * Math.PI)) * 0.14 + (one.hop > 0 ? Math.sin(Math.min(1, one.hop / 0.5) * Math.PI) * 0.3 : 0)
    this.put(one, up, sit ? 'sit' : '', ([dx, dy, dz, sx, sy, sz, ink], k) => {
      // Sitting: on the ground, its legs out in front of it.
      if (sit) return k < 2 ? [dx, 0, dz + 0.26, sx, sz, sy, ink] : [dx, dy - 0.286 + (k === 5 ? hold : 0), dz, sx, sy, sz, ink]
      return k === 5 && hold ? [dx, dy + hold, dz + hold, sx, sy, sz, ink] : [dx, dy, dz, sx, sy, sz, ink]
    })
  }
  /** Small hearts go up from (x, y, z). */
  private heart(x: number, y: number, z: number, n = 1) {
    for (let k = 0; k < n; k++) this.bits.spawn(x + any() * 0.5, y + any() * 0.2, z + any() * 0.5, any() * 0.3, 0.8 + Math.random() * 0.5, any() * 0.3, 0.12, HEART, 1.2, NEVER, 0, -0.4)
  }
  /** A puff of loose cubes at (x, y, z), that fall to `floor`. */
  private puff(x: number, y: number, z: number, n: number, ink: number, floor: number, size = 0.11) {
    for (let k = 0; k < n; k++) this.bits.spawn(x + any() * 0.5, y + Math.random() * 0.4, z + any() * 0.5, any() * 3, 1 + Math.random() * 2, any() * 3, size, ink, 0.7, floor, 0.25)
  }

  // The two sides, and what they want.

  /** One of a side sits down: something it asked for did not come. With nobody left standing, the side gives up. */
  private tire(side: number) {
    const up = this.men.filter((man) => man.side === side && !man.sad)
    const man = up[Math.floor(this.chance() * up.length)]
    if (man) man.sad = true
    thump()
    if (up.length <= 1) this.end(side ? 'camp' : 'castle')
  }
  /** A side is glad of something: hearts where it said what it wanted, and so many of those sitting get up again. */
  private cheer(side: number, n = 1) {
    const [x, y, z] = SAY[side]
    this.heart(x, y - 1.2, z, 5)
    note(0.75, 0.08)
    for (const man of this.men.filter((one) => one.side === side && one.sad).slice(0, n)) {
      man.sad = false
      man.hop = 0.5
      this.heart(man.x, man.y + 1.4, man.z, 3)
    }
  }
  /** The princess and the prince are glad of each other: hearts over both, and a row of them from one to the other. */
  private swoon() {
    const [a, b] = this.royals
    for (const one of this.royals) {
      one.hop = 0.5
      this.heart(one.x, one.y + 1.5, one.z, 5)
    }
    for (let k = 1; k < 12; k++) this.bits.spawn(a.x + ((b.x - a.x) * k) / 12, a.y + ((b.y - a.y) * k) / 12 + 1.5 + Math.sin((k / 12) * Math.PI) * 3, a.z + ((b.z - a.z) * k) / 12, 0, 0.3, 0, 0.17, HEART, 1.4 + k * 0.1, NEVER, 0, -0.2)
    // (And it does both sides good to see it: one of each gets up.)
    for (const side of [0, 1]) this.cheer(side)
  }
  /**
   * Something is wanted, and whoever wants it says so and waits.
   * @param love it is the princess or the prince who wants it (or, at the gate, both): they say so over their own
   * heads, and wait as long as it takes
   * @param still it is wood for the camp's fire, which the rain has put out: said over the fire, and waited for likewise
   */
  private want(side: number, what: Want, love = false, still = false) {
    // (What the princess or the prince wants, nobody else goes on wanting at the same time.)
    if (love) for (let k = this.asks.length - 1; k >= 0; k--) if (this.asks[k].what === what && what !== 'music') this.asks.splice(k, 1)
    const [x, y, z] = still ? [FIRE[0], 3, FIRE[1]] : !love ? SAY[side] : side > 1 ? [0, STEP + POST + 1.3, 0.3] : [this.royals[side].x, this.royals[side].y + 1.75, this.royals[side].z]
    const full = CHARGE + WAIT
    this.asks.push({ id: this.count++, side, what, left: full, full, x, y, z, love, still })
    this.mend()
    note(0.2, 0.06)
  }
  /** What was asked for has come. */
  private give(ask: Ask) {
    this.asks.splice(this.asks.indexOf(ask), 1)
    if (ask.love) {
      // One more thing between the princess and the prince: the next is asked for in the next quiet. But after the
      // last of them they are in no mood to wait.
      this.love++
      this.swoon()
      if (this.love === GIFTS.length) this.want(2, 'music', true)
    } else this.cheer(ask.side)
    if (!this.begun && ask.side === 0 && ask.what === 'wood') this.start() // the camp waits for it: nobody charges before the castle has its wood
    if (ask.still) this.doused = false
    this.mend()
  }
  /** While the castle wants stone, teeth are off its wall by the gate: they come off as it asks, and go back as it is brought. */
  private mend() {
    const off = this.asks.some((ask) => ask.what === 'stone')
    if (off === this.breach) return
    this.breach = off
    for (const c of this.loose) {
      const [x, y, z] = this.solid.at(c)
      if (off) this.solid.hide(c)
      else this.solid.show(c, Math.random() * 0.3)
      if (off) this.puff(x, y, z, 3, STONE[1], STEP - 1)
    }
  }
  /** What is put by at the farm is on show: logs on the rack, stones on the tray. */
  private store() {
    for (const good of ['wood', 'stone'] as const) this.racks[good].forEach((c, k) => (k < this.piles[good] ? this.solid.show(c) : this.solid.hide(c)))
  }
  /**
   * What a side asks for, when it is left to chance. Mostly the plain things, now and then a silly one. The camp's
   * silly things are the castle's: its music and its cat, when the one or the other is at home to be fetched, and an
   * apple off its tree. The castle's are a flower, a duck, and the camp's soup. Nothing silly is asked for twice at once.
   */
  private pick(side: number): Want {
    const free = (what: Want) => !this.asks.some((ask) => ask.what === what)
    // (Each with how likely it is, in parts of a hundred or so, and whether it can be asked for just now.)
    const odds: [Want, number, boolean?][] = side
      ? [['music', 18, this.tune.mode === 'home' && this.tune.seated && free('music')], ['flower', 10, free('flower')], ['cat', 10, free('cat') && !this.cat.away], ['apple', 8, free('apple')], ['bread', 34], ['wood', 28]]
      : [['flower', 10, free('flower')], ['soup', 10, free('soup') && !this.doused], ['duck', 8, free('duck')], ['bread', 32], ['wood', 22], ['stone', 18]]
    const open = odds.filter(([, , can]) => can !== false)
    let r = this.chance() * open.reduce((sum, [, part]) => sum + part, 0)
    return open.find(([, part]) => (r -= part) < 0)![0]
  }
  /** The day goes on: patience runs out, the camp charges and rests, and things happen. */
  private direct(dt: number) {
    const { asks, phase } = this
    if (!this.begun) return
    this.time += dt
    const song = this.tune.mode === 'play' // while there is music at the camp it wants nothing, and waits for nothing
    for (let k = asks.length - 1; k >= 0 && !this.over; k--) {
      const ask = asks[k]
      // (What the princess or the prince asks for is waited for as long as it takes. So is wood for a fire put out.)
      if (ask.love || ask.still || (ask.side === 1 && song) || (ask.left -= dt) > 0) continue
      asks.splice(k, 1)
      this.tire(ask.side)
      this.mend()
    }
    if (this.over) return
    // The camp charges and rests by turns (not while it has music). With every charge both sides say what they want,
    // all at once. In the quiet between, the castle and the camp ask for nothing: that is when the princess or the
    // prince does (one thing at a time, by turns, while the last has been brought), and now and then something happens.
    if (!song && (phase.left -= dt) <= 0) {
      phase.charge = !phase.charge
      phase.left = phase.full = phase.charge ? CHARGE : LULL
      if (phase.charge) return this.burst()
      if (this.round > 1) this.happen()
      if (this.love < GIFTS.length && !asks.some((ask) => ask.love)) this.want(...GIFTS[this.love], true)
    }
    // As the courting gets on, the two sides start doing each other good turns: one in every charge once two things
    // have been brought, and one more for each thing after that.
    if (phase.charge && this.lent < this.love - 1 && CHARGE - phase.left > 9 + 7 * this.lent) this.lend()
  }
  /** The camp sets out, and both sides say what they want: the same things in the first charges of every day, and after those by chance. */
  private burst() {
    const set = ROUNDS[this.round++]
    this.lent = 0
    note(0.1, 0.09)
    for (const side of [0, 1]) {
      // (By chance: two things each, and three if the day goes on and on.)
      for (const what of set ? set[side] : Array.from({ length: this.round > 7 ? 3 : 2 }, () => this.pick(side))) {
        // (There is one cat, and soup only while the fire burns: where either is not to be had, bread will do.)
        this.want(side, (what === 'cat' && this.cat.away) || (what === 'soup' && this.doused) ? 'bread' : what)
      }
    }
  }
  /**
   * One side does the other a good turn: something plain that one of them wants is thrown to it by the other, up on
   * to the wall or down from it, and that is that asking met with no help from anybody.
   */
  private lend() {
    const ask = this.asks.find((one) => !one.love && !one.still && one.side < 2 && (one.what === 'bread' || one.what === 'wood' || one.what === 'stone'))
    const up = this.men.filter((man) => !man.side && !man.sad && !man.gone)
    const down = this.men.filter((man) => man.side && man.busy)
    this.lent++
    if (!ask || !up.length || !down.length) return
    const [high, low] = [up[Math.floor(this.chance() * up.length)], down[Math.floor(this.chance() * down.length)]]
    const [from, to] = ask.side ? [high, low] : [low, high]
    // (Slowly, in a high curve, so that it can be seen: nearly a second and a half in the air, and gone where it was
    // meant to come down. It has no floor to land on: thrown up on to the wall, it starts out below where it ends.)
    const [air, pull] = [1.4, 8]
    this.bits.spawn(from.x, from.y + 1.3, from.z, (to.x - from.x) / air, (to.y - from.y) / air + (pull * air) / 2, (to.z - from.z) / air, 0.4, LOOK[ask.what as Good][3], air, NEVER, 0, pull)
    from.hop = to.hop = 0.5
    this.heart(to.x, to.y + 1.5, to.z, 4)
    this.give(ask)
  }
  /**
   * Something that is not an errand, in the quiet between two charges. By turns, whichever can happen: a duck takes a
   * liking to the helper and follows him about; the cat goes after a loaf on the oven's shelf, and a click stops it;
   * or it rains on the camp, and the fire is out until it has wood.
   */
  private happen() {
    const { cat, oven } = this
    const all = [
      () => {
        const duck = this.ducks.find((one) => !one.away)
        if (!duck || this.tail) return false
        this.tail = Object.assign(duck, { away: true, stay: 30 })
        return true
      },
      () => {
        if (cat.away || !oven.ready || this.asks.some((ask) => ask.what === 'cat')) return false
        // (Down off its cask, on to the ground beside it: from there it can walk.)
        Object.assign(cat, { away: true, stay: 99, x: CASKS[0], y: STEP, z: CASKS[1] + 1 })
        this.thief = 'out'
        return true
      },
      () => {
        if (this.doused) return false
        this.doused = true
        this.pour = 7
        for (const c of this.storm) this.solid.show(c, Math.random() * 0.3)
        this.want(1, 'wood', false, true)
        return true
      },
    ]
    for (let k = 0; k < all.length; k++) if (all[(this.round + 1 + k) % all.length]()) return
  }
  /** The cat is stopped: what it had goes back on the shelf, and it goes home. */
  private nab() {
    const { cat } = this
    if (this.loot) {
      this.loot = false
      this.oven.ready = Math.min(this.loaves.length, this.oven.ready + 1)
      this.puff(cat.x, cat.y + 0.4, cat.z, 4, LOOK.bread[3], cat.y, 0.08)
    }
    this.thief = 'back'
    cat.hop = 0.5
    this.heart(cat.x, cat.y + 0.6, cat.z, 3)
    note(0.7, 0.07)
  }
  /** One side has given up, and that is the day lost: they are gone, and their flags are white. */
  private end(how: 'castle' | 'camp') {
    this.over = how
    this.asks.length = 0
    this.me.queue.length = 0
    this.me.work = 0
    this.mend()
    const side = how === 'camp' ? 1 : 0
    for (const man of this.men) {
      if (man.side !== side) continue
      man.gone = true
      for (const c of [...man.cubes, ...man.cloud]) this.solid.hide(c, Math.random() * 0.6)
      this.puff(man.x, man.y + 0.5, man.z, 6, 0xf4f1ea, man.y)
    }
    for (const c of this.flags[side]) this.solid.paint(c, 0xffffff)
  }
  /**
   * The wedding, and the end of the war: the musician strikes up at the gate, the princess comes down from her
   * balcony and out through it, the prince gets up from his chair and comes up the road, and everybody comes to look.
   * (See `tend` for the two of them, and `fight` for everybody else.)
   */
  private wed() {
    const [princess, prince] = this.royals
    this.over = 'wedding'
    this.asks.length = 0
    this.mend()
    for (const man of this.men) man.sad = false
    this.party = 90
    Object.assign(this.tune, { mode: 'go', to: at(1, 2) })
    for (const one of this.royals) this.puff(one.x, one.y + 0.6, one.z, 8, HEART, one.y)
    Object.assign(princess, { x: 0, y: STEP, z: -3, hop: 0.5 })
    Object.assign(prince, { x: THRONE[0] - 1, y: 1, z: THRONE[1], hop: 0.5 })
    for (const c of this.flags.flat()) this.solid.paint(c, HEART)
    note(0.9, 0.1)
  }

  // The helper.

  /** What is on his hat is drawn afresh: each thing a box on the one under it, and the cat or a duck sitting there as itself. */
  private stack() {
    const { me, solid } = this
    let [y, pets] = [1.32, 0]
    for (let k = 0; k < HAT; k++) {
      const item = me.loads[k]
      const [sx, sy, sz, ink] = item ? LOOK[item] : [0, 0, 0, 0]
      const animal = item === 'cat' || item === 'duck'
      if (animal) me.rise[pets++] = y
      if (item && !animal) {
        me.parts[6 + k] = [0, y, 0, sx, sy, sz, ink]
        solid.paint(me.cubes[6 + k], ink)
        solid.show(me.cubes[6 + k])
      } else solid.hide(me.cubes[6 + k])
      y += sy ? sy + 0.02 : 0
    }
    me.drawn = '' // (so that its cubes are sized afresh)
  }
  /** One thing more on his hat. With no room for it, the oldest of the things nobody wants goes to make some. */
  private take(item: Item) {
    const { me } = this
    if (me.loads.length >= HAT) this.shed(me.loads.find((one) => one !== 'wheat' && this.extra(one) > 0) ?? me.loads[0], true)
    const pet = item === 'cat' ? this.cat : item === 'duck' ? this.ducks.find((duck) => !duck.away) : undefined
    if (pet) me.pets.push(Object.assign(pet, { away: true }))
    me.loads.push(item)
    this.stack()
  }
  /**
   * One of the things he carries comes off his hat.
   * @param away it is let go, and not handed to anybody: an animal goes home, and anything else is gone in a puff
   * @returns the animal, if it was one
   */
  private shed(item: Item, away = false) {
    const { me } = this
    me.loads.splice(me.loads.indexOf(item), 1)
    const pet = item === 'cat' || item === 'duck' ? me.pets.splice(me.pets.findIndex((one) => (one === this.cat) === (item === 'cat')), 1)[0] : undefined
    this.stack()
    if (pet && away) this.home(pet)
    else if (away) this.puff(me.x, me.y + 1.9, me.z, 4, LOOK[item][3], me.y, 0.09)
    return pet
  }
  /** The cat is back on its cask, or a duck on the pond. */
  private home(pet: Pet) {
    this.puff(pet.x, pet.y + 0.2, pet.z, 4, 0xffffff, pet.y - 0.2)
    Object.assign(pet, { away: false, ride: false, stay: 0, hop: 0.4 })
    if (pet === this.cat) Object.assign(pet, { x: CASKS[0] - 0.22, y: STEP + 0.6, z: CASKS[1], turn: 0 })
    if (pet === this.tail) this.tail = undefined
  }
  /** He cannot do what is first on his list: he shakes his head, and goes on to the next. */
  private refuse() {
    this.me.queue.shift()
    this.me.no = 0.45
    note(0.02, 0.06)
  }
  /**
   * He has got to where the first job on his list is done from.
   * @returns how many seconds it takes; nothing at all where there is something to wait for first; less than none where it cannot be done
   */
  private begin(task: Task): number | undefined {
    const { me, tune, oven, piles } = this
    if (task.id < 0) return 0
    const [x, z] = this.site(task.id)
    me.turn = turned(x - me.x, z - me.z)
    const i = task.id % 1000
    const has = (item: Item) => me.loads.includes(item)
    const room = this.spare()
    switch (task.id - i) {
      case TREE:
        return this.trees[i].t === task.t && !this.trees[i].away && this.trees[i].grown >= 1 && room ? 1.1 : -1
      case ROCK:
        return this.rocks[i].t === task.t && !this.rocks[i].away && room ? 1.4 : -1
      case PLOT: {
        // (Wheat that is nearly ripe is worth waiting for. Bare ground is sown whatever he is carrying.)
        const { age } = this.plots[i]
        return age < 0 ? 0.5 : !room ? -1 : age >= 1 ? 0.6 : age > 0.7 ? undefined : -1
      }
      case FLOWER:
        return !this.flowers[i].away && room ? 0.5 : -1
      case OVEN:
        // Sheaves to bake; or loaves that nobody wants to put on the shelf, while that has room; or a loaf to take,
        // while he has.
        return has('wheat') || (this.extra('bread') > 0 && oven.ready < this.loaves.length) || (room && oven.ready) ? 0.4 : -1
      case LOGS:
      case HEAP: {
        // Likewise at the rack and the tray: what he has of that kind that nobody wants goes on (four at the most), or
        // one comes off.
        const good = task.id === LOGS ? 'wood' : 'stone'
        return (this.extra(good) > 0 && piles[good] < 4) || (room && piles[good]) ? 0.3 : -1
      }
      case HEARTH:
        // Soup out of the pot; or, when the rain has put the fire out, wood to light it again.
        return this.doused ? (has('wood') ? 0.6 : -1) : room ? 0.5 : -1
      case DUCK:
        return room && this.ducks.some((duck) => !duck.away) ? 0.6 : -1
      case CAT:
        return room && !this.cat.away ? 0.4 : -1
      case APPLE:
        return room ? 0.6 : -1
      case BASKET:
        return !me.loads.some((item) => this.takes(0, item)) ? -1 : this.lift.dir || this.lift.y > LOW ? undefined : 0.35
      case TABLE:
        return tune.mode === 'follow' || me.loads.some((item) => this.takes(1, item)) ? 0.35 : -1
      case PRINCESS:
      case PRINCE:
        return me.loads.some((item) => this.takes(task.id === PRINCESS ? 0 : 1, item, true)) ? 0.5 : -1
      case WED:
        return tune.mode === 'follow' && this.asks.some((ask) => ask.side > 1) ? 0.5 : -1
      default:
        return tune.mode === 'home' && tune.seated ? 0.3 : -1
    }
  }
  /** And the job is done. */
  private finish(task: Task) {
    const { me, oven, tune, solid, piles } = this
    const i = task.id % 1000
    const [x, z] = this.site(task.id)
    const has = (item: Item) => me.loads.includes(item)
    /** Everything he has that is wanted there is handed over, one thing for each asking. @returns the animals among it */
    const hand = (side: number, love = false) => {
      const pets: Pet[] = []
      // (Whoever is counting the seconds comes first: wood for a fire that is out can wait.)
      for (const ask of this.asks.filter((one) => one.side === side && !one.love === !love && one.what !== 'music').sort((a, b) => Number(!!a.still) - Number(!!b.still))) {
        if (!has(ask.what as Good)) continue
        const pet = this.shed(ask.what as Good)
        if (pet) pets.push(pet)
        this.give(ask)
      }
      return pets
    }
    switch (task.id - i) {
      case TREE:
        this.fell(this.trees[i])
        return this.take('wood')
      case ROCK:
        this.crack(this.rocks[i])
        return this.take('stone')
      case PLOT: {
        // Ripe wheat is cut, and the plot sown again in the same breath; bare ground is sown.
        const plot = this.plots[i]
        if (plot.age >= 1) this.take('wheat')
        plot.age = 0
        return
      }
      case FLOWER:
        // A flower is picked: there is none there for a while.
        for (const c of this.flowers[i].cubes) solid.hide(c)
        this.flowers[i].away = 25
        return this.take('flower')
      case OVEN:
        // All the sheaves he has go in to bake; or the loaves he has that nobody wants go on the shelf; or one comes
        // off it. One of those at a click. (So with two wanting bread, two clicks are two loaves.)
        if (has('wheat')) while (has('wheat') && ++oven.todo) this.shed('wheat')
        else if (this.extra('bread') > 0 && oven.ready < this.loaves.length) while (this.extra('bread') > 0 && oven.ready < this.loaves.length && ++oven.ready) this.shed('bread')
        else if (oven.ready) {
          oven.ready--
          this.take('bread')
        }
        return
      case LOGS:
      case HEAP: {
        const good = task.id === LOGS ? 'wood' : 'stone'
        if (this.extra(good) > 0 && piles[good] < 4) while (this.extra(good) > 0 && piles[good] < 4 && ++piles[good]) this.shed(good)
        else if (piles[good]) {
          piles[good]--
          this.take(good)
        }
        return this.store()
      }
      case HEARTH:
        if (this.doused) {
          // Wood on the fire, and it burns again: the camp wanted that, and said so.
          this.shed('wood')
          const ask = this.asks.find((one) => one.still)
          if (ask) this.give(ask)
          this.doused = false
          return
        }
        // A bowl of soup out of the pot.
        this.puff(FIRE[0], 2.1, FIRE[1], 5, 0xffffff, 1.9, 0.08)
        return this.take('soup')
      case DUCK:
        // (If it is still there: one may have gone off after him in the meantime.)
        return this.ducks.some((duck) => !duck.away) ? this.take('duck') : undefined
      case CAT:
        return this.cat.away ? undefined : this.take('cat')
      case APPLE:
        this.puff(x, STEP + 1.6, z, 3, LEAF[1], STEP, 0.12)
        return this.take('apple')
      case BASKET: {
        // Into the basket and up: things as themselves (the first of them is the one that shows), and an animal too.
        // (Unless what he came with has stopped being wanted while he was at it: then nothing goes up.)
        const first = me.loads.find((item) => this.takes(0, item))
        if (!first) return
        const [sx, sy, sz, ink] = LOOK[first]
        solid.size(this.lift.cargo, sx, sy, sz)
        solid.paint(this.lift.cargo, ink)
        if (first !== 'cat' && first !== 'duck') solid.show(this.lift.cargo)
        for (const pet of hand(0)) Object.assign(pet, { ride: true, stay: 9 })
        this.lift.dir = 1
        return
      }
      case TABLE:
        if (tune.mode === 'follow') [tune.mode, tune.to] = ['go', STAGE]
        // (An animal sits on the table for a while, and then goes home.)
        hand(1).forEach((pet, k) => Object.assign(pet, { x: BOARD[0], y: 1.7, z: BOARD[1] + 0.3 - k * 0.5, turn: 3, stay: 9, hop: 0.4 }))
        return
      case PRINCESS:
      case PRINCE:
        // Handed over in person. (An animal stays beside whoever it was brought to for a while, and then goes home.)
        hand(task.id === PRINCESS ? 0 : 1, true).forEach((pet) => Object.assign(pet, { x: x + (task.id === PRINCE ? 0.1 : 0.7), y: me.y, z: z + 0.9, turn: 0, stay: 9, hop: 0.4 }))
        return
      case WED:
        return this.wed()
      default:
        // The musician gets off his stool, and comes along.
        tune.mode = 'follow'
        tune.seated = false
        tune.x = across(HOME)
        tune.z = along(HOME)
        tune.hop = 0.4
        this.trail = -1
    }
  }
  /** What he is working at shakes, and bits of it fly. */
  private shake(id: number) {
    for (const c of this.made.get(id) ?? []) this.solid.poke(c, 4)
    const [x, z] = this.site(id)
    const kind = id - (id % 1000)
    if (kind === TREE) this.puff(x, this.trees[id % 1000].ground + 1.4, z, 2, LEAF[0], this.trees[id % 1000].ground, 0.13)
    if (kind === ROCK) this.puff(x, this.rocks[id % 1000].ground + 0.4, z, 2, STONE[1], this.rocks[id % 1000].ground)
    note(0.1 + Math.random() * 0.1, 0.03)
  }
  private help(dt: number) {
    const { me } = this
    const task = me.queue[0]
    me.no -= dt
    me.hop -= dt
    if (task && me.work > 0) {
      // At work: he bobs, and what he works at shakes.
      me.stride += dt * 5
      if ((me.beat -= dt) <= 0) {
        me.beat = 0.28
        this.shake(task.id)
      }
      if ((me.work -= dt) <= 0) {
        this.finish(task)
        me.queue.shift()
        me.stride = 0
      }
    } else if (task) {
      me.idle = 0
      const way = this.way(task)
      if (way[spot(me.x, me.z)] === FAR) this.refuse()
      // (With the musician behind him he goes at the musician's pace.)
      else if (this.walk(me, way, this.tune.mode === 'follow' ? 3.3 : PACE, dt, true)) {
        const takes = this.begin(task)
        if (takes === 0) me.queue.shift()
        else if (takes !== undefined && takes < 0) this.refuse()
        else if (takes) [me.work, me.beat] = [takes, 0]
      }
    } else me.idle += dt
    const floor = this.foot(me.x, me.z)
    if (floor >= 0) me.y += (floor - me.y) * Math.min(1, dt * 12)
    // (A shake of the head: he looks to one side and the other.)
    const face = me.turn
    if (me.no > 0) me.turn = (face + (Math.floor(me.no * 14) % 2 ? 1 : 3)) % 4
    this.pose(me)
    me.turn = face
    // The animals he is carrying ride on his hat, each on whatever is under it.
    me.pets.forEach((pet, k) => {
      Object.assign(pet, { x: me.x, y: me.y + me.rise[k] + Math.abs(Math.sin(me.stride * Math.PI)) * 0.14, z: me.z, turn: me.turn })
      this.put(pet, 0, '')
    })
    // Over each thing he has still to see to, a mark.
    this.marks.forEach((c, k) => {
      const job = me.queue[k]
      if (!job) return this.solid.hide(c)
      const [x, y, z] = this.above(job)
      this.solid.show(c)
      this.solid.place(c, x, y + 0.1 * Math.sin(this.clock * 5 + k), z)
    })
    // And when he has stood about for a while with something wanted, whatever would help gives a small jump.
    if (this.over || !this.asks.length || me.idle < 5) this.nudge = 0
    else if ((this.nudge -= dt) <= 0) {
      this.nudge = 2.4
      this.point()
    }
  }
  /** What would help just now gives a jump: where to take what he has, or where to get what is most wanted. */
  private point() {
    const { me, tune, oven, asks, piles } = this
    const poke = (id: number) => this.made.get(id)?.forEach((c) => this.solid.poke(c, 6))
    const nearest = <T extends { t: number }>(from: T[], n: number) => from.sort((a, b) => Math.hypot(across(a.t) - me.x, along(a.t) - me.z) - Math.hypot(across(b.t) - me.x, along(b.t) - me.z)).slice(0, n)
    if (tune.mode === 'follow') return asks.some((ask) => ask.side > 1) ? undefined : poke(TABLE)
    if (me.loads.includes('wheat')) return poke(OVEN)
    // Something he has that somebody wants: where it goes.
    const wanted = asks.find((ask) => ask.side < 2 && me.loads.includes(ask.what as Good))
    if (wanted) return poke(wanted.still ? HEARTH : (wanted.love ? [PRINCESS, PRINCE] : [BASKET, TABLE])[wanted.side])
    // (No room on his hat for anything more, and nobody wants any of it: where it can be put by.)
    if (!this.spare()) return poke(me.loads.includes('wood') ? LOGS : me.loads.includes('stone') ? HEAP : OVEN)
    const { what } = asks.reduce((a, b) => (b.left / b.full < a.left / a.full ? b : a))
    if (what === 'music') return tune.seated ? poke(MUSIC) : undefined
    if (what === 'wood' || what === 'stone') {
      // What is on the rack or the tray, and the nearest of what stands about.
      if (piles[what]) poke(what === 'wood' ? LOGS : HEAP)
      if (what === 'wood') return nearest(this.trees.filter((tree) => tree.grown >= 1 && !tree.away), 3).forEach((tree) => poke(TREE + this.trees.indexOf(tree)))
      return nearest(this.rocks.filter((rock) => !rock.away), 2).forEach((rock) => poke(ROCK + this.rocks.indexOf(rock)))
    }
    if (what === 'flower') return nearest(this.flowers.filter((bed) => !bed.away), 2).forEach((bed) => poke(FLOWER + this.flowers.indexOf(bed)))
    if (what === 'duck' || what === 'cat' || what === 'soup' || what === 'apple') return poke(what === 'duck' ? DUCK : what === 'cat' ? CAT : what === 'apple' ? APPLE : HEARTH)
    if (oven.ready) return poke(OVEN)
    const ripe = this.plots.filter((plot) => plot.age >= 1)
    for (const plot of ripe.length ? ripe : oven.todo ? [] : this.plots.filter((one) => one.age < 0)) poke(PLOT + this.plots.indexOf(plot))
  }
  /** The cat is patted, or one of the ducks: each of them in turn. */
  private pat(id: number) {
    const one = id === CAT ? this.cat : this.ducks[this.patted++ % this.ducks.length]
    one.hop = 0.5
    this.heart(one.x, one.y + 0.5, one.z, 3)
  }

  // What grows, bakes, and goes up and down.

  private fell(tree: Tree) {
    for (const c of tree.cubes) this.solid.hide(c)
    this.puff(across(tree.t), tree.ground + 1.3, along(tree.t), 16, LEAF[1], tree.ground, 0.14)
    thump()
    this.free(tree.t, tree.ground)
    tree.away = 3
  }
  private crack(rock: Rock) {
    for (const c of rock.cubes) this.solid.hide(c)
    this.puff(across(rock.t), rock.ground + 0.3, along(rock.t), 12, STONE[0], rock.ground)
    thump()
    this.free(rock.t, rock.ground)
    rock.away = 9
  }
  /** A tree's cubes at the size it has grown to: `stage` of eight. */
  private shape(tree: Tree, stage: number) {
    tree.stage = stage
    const s = 0.4 + (0.6 * stage) / 8
    const [x, z] = [across(tree.t), along(tree.t)]
    TRUNK.forEach(([y, wide, tall], k) => {
      this.solid.size(tree.cubes[k], wide * s, tall * s, wide * s)
      this.solid.place(tree.cubes[k], x, tree.ground + y * s, z)
      this.solid.bendy(tree.cubes[k], k ? 0.07 : 0, tree.ground, x, z)
    })
  }
  private tend(dt: number) {
    const { solid, bits, oven, lift, gate, me, tune } = this
    // A felled tree comes up somewhere else, small, and grows; a broken rock turns up somewhere else.
    this.trees.forEach((tree, i) => {
      if (tree.away > 0) {
        if ((tree.away -= dt) > 0) return
        const t = this.room(this.grove)
        if (t < 0) return void (tree.away = 1)
        Object.assign(tree, { t, ground: this.stand[t], grown: 0, stage: -1, away: 0 })
        this.hold(t, TREE + i)
        for (const c of tree.cubes) solid.show(c)
      }
      tree.grown = Math.min(1, tree.grown + dt / SPROUT)
      if (Math.floor(tree.grown * 8) !== tree.stage) this.shape(tree, Math.floor(tree.grown * 8))
    })
    this.rocks.forEach((rock, i) => {
      if (rock.away <= 0 || (rock.away -= dt) > 0) return
      const t = this.room(this.scree)
      if (t < 0) return void (rock.away = 1)
      Object.assign(rock, { t, ground: this.stand[t], away: 0 })
      this.hold(t, ROCK + i)
      BOULDER.forEach(([dx, dy, dz, , sy], k) => {
        solid.place(rock.cubes[k], across(t) + dx, rock.ground + dy + sy / 2, along(t) + dz)
        solid.show(rock.cubes[k], k * 0.08)
      })
    })
    // Where a flower was picked there is one again after a while.
    for (const bed of this.flowers) if (bed.away > 0 && (bed.away -= dt) <= 0) for (const c of bed.cubes) solid.show(c)
    // Wheat grows, and is drawn afresh at each of six heights; ripe, it is yellow.
    for (const plot of this.plots) {
      if (plot.age >= 0) plot.age = Math.min(1, plot.age + dt / SOW)
      const stage = plot.age < 0 ? -1 : Math.floor(plot.age * 6)
      if (stage === plot.stage) continue
      plot.stage = stage
      plot.stalks.forEach((c, k) => {
        if (stage < 0) return solid.hide(c)
        const tall = 0.14 + stage * 0.09
        solid.size(c, 0.09, tall, 0.09)
        solid.place(c, plot.spots[k][0], 1 + tall / 2, plot.spots[k][1])
        solid.paint(c, WHEAT[stage < 6 ? 0 : 1])
        solid.show(c)
      })
    }
    // The oven bakes one sheaf at a time, while there is room on its shelf; its mouth glows, and it smokes.
    const baking = oven.todo > 0 && oven.ready < this.loaves.length
    if (baking && (oven.heat += dt) >= BAKE) {
      oven.heat = 0
      oven.todo--
      oven.ready++
      note(0.55, 0.07)
    }
    if (baking && Math.random() < dt * 5) bits.spawn(STOVE[0] - 0.39, 2.3, STOVE[1] - 0.39, any() * 0.2, 0.7, any() * 0.2, 0.12, 0xf4f1ea, 1.3, NEVER, 0, -0.3)
    solid.paint(this.mouth, baking ? 0xff8a3d : 0x4a3a40, baking ? 1.5 : 1)
    this.loaves.forEach((c, k) => (k < oven.ready ? solid.show(c) : solid.hide(c)))
    // The basket: up with what was put in it, a moment at the top while it is emptied, and down again.
    if (lift.dir > 0 && (lift.y = Math.min(HIGH, lift.y + dt * 3.6)) === HIGH) {
      lift.dir = -1
      lift.hold = 0.5
      solid.hide(lift.cargo)
      // (An animal that came up in it gets out on to the wall.)
      for (const pet of [this.cat, ...this.ducks]) if (pet.ride) Object.assign(pet, { ride: false, x: X0 + 0.1, y: STEP + WALL, z: WINCH + 1.2, turn: 3, hop: 0.4 })
    } else if (lift.dir < 0 && (lift.hold -= dt) <= 0 && (lift.y = Math.max(LOW, lift.y - dt * 4.5)) === LOW) lift.dir = 0
    solid.place(lift.cubes[0], HOOK, lift.y + 0.17, WINCH)
    solid.place(lift.cubes[1], HOOK, lift.y + 0.37, WINCH)
    solid.place(lift.cargo, HOOK, lift.y + 0.4 + solid.at(lift.cargo)[4] / 2, WINCH)
    const hook = STEP + TOWER + 1.18
    solid.size(lift.rope, 0.05, hook - lift.y - 0.4, 0.05)
    solid.place(lift.rope, HOOK, (hook + lift.y + 0.4) / 2, WINCH)
    // The gate opens for the helper, for the musician on his way out or home, and for the cat when it has somewhere to
    // be: its leaves draw back to the posts.
    const by = (one: Body) => Math.hypot(one.x, one.z) < 1.7
    const open = by(me) || (!tune.seated && by(tune)) || (this.thief && by(this.cat)) || this.over === 'wedding' ? 1 : 0
    if (Math.abs(open - gate.open) > 0.002) {
      gate.open += (open - gate.open) * Math.min(1, dt * 9)
      const wide = 0.47 * (1 - 0.82 * gate.open)
      ;[-1, 1].forEach((s, k) => {
        solid.size(gate.leaves[k], wide, 2, 0.16)
        solid.place(gate.leaves[k], s * (0.485 - wide / 2), STEP + 1, 0)
        solid.size(gate.bands[k], wide, 0.1, 0.04)
        solid.place(gate.bands[k], s * (0.485 - wide / 2), STEP + 1.3, 0.1)
      })
    }
    // The camp's fire: low while the camp wants wood, and out when the rain has been at it. That comes out of a big
    // cloud that stays over it a while; after that the fire only smokes, until somebody brings wood.
    const low = this.asks.some((ask) => ask.side === 1 && ask.what === 'wood') || this.over === 'camp'
    this.flames.forEach((c, k) => {
      const s = this.doused ? 0 : (k ? 0.15 : 0.26) * (low ? 0.5 : 1) * (1 + 0.25 * Math.sin(this.clock * (9 + k * 4) + k))
      solid.size(c, s, s * 1.4, s)
      solid.place(c, FIRE[0], 1.2 + (k ? 0.26 * (low ? 0.5 : 1) * 1.4 : 0) + s * 0.7, FIRE[1])
    })
    if (this.pour > 0) {
      for (let k = 0; k < 3; k++) if (Math.random() < dt * 12) bits.spawn(FIRE[0] + any() * 2.4, 4.4, FIRE[1] + any() * 1.2, 0, -3, 0, 0.07, 0x5aa9f2, 0.8, 1, 0, 12)
      if ((this.pour -= dt) <= 0) for (const c of this.storm) solid.hide(c, Math.random() * 0.4)
    }
    if (this.doused ? Math.random() < dt * 3 : Math.random() < dt * (low ? 2 : 7)) bits.spawn(FIRE[0] + any() * 0.2, 1.5, FIRE[1] + any() * 0.2, any() * 0.4, 1 + Math.random(), any() * 0.4, this.doused ? 0.12 : 0.07, this.doused ? 0xc9c9d6 : 0xffb347, this.doused ? 1.4 : 0.8, NEVER, 0, -0.5, this.doused ? 1 : 1.8)
    // The princess looks about from the keep, the prince sits, and the cat sits. All of them are glad at a good end.
    if (this.party > 0 && (this.party -= dt) > 0 && Math.random() < dt * 9) {
      const one = [...this.men, ...this.royals, me, tune][Math.floor(Math.random() * (this.men.length + 4))]
      one.hop = 0.5
      this.heart(one.x, one.y + 1.5, one.z, 2)
    }
    // The ducks go round the pond; one that was taken somewhere, or the cat, stays there a while and then goes home.
    // (One on the helper's hat is put there in `help`.) A duck that has taken a liking to him comes along behind
    // him for a while. And the cat, when it is after a loaf, runs to the oven's shelf, and home again with it, unless
    // it is stopped. Then the brook over its steps: drops at each, a little mist where it lands, and a trickle
    // out of the spout in the wall.
    const { cat } = this
    for (const pet of [cat, ...this.ducks]) {
      pet.hop -= dt
      if (me.pets.includes(pet)) continue
      if (pet.ride) Object.assign(pet, { x: HOOK, y: lift.y + 0.4, z: WINCH })
      else if (pet === cat && this.thief) {
        if (this.walk(cat, this.route(this.thief === 'out' ? BAKERY : at(CASKS[0], CASKS[1] + 1), true), 5.2, dt, true)) {
          if (this.thief === 'out') {
            // At the shelf: a loaf, if there is one; and back.
            this.loot = oven.ready > 0
            if (this.loot) oven.ready--
            this.thief = 'back'
          } else {
            if (this.loot) this.puff(cat.x, cat.y + 0.3, cat.z, 6, LOOK.bread[3], cat.y, 0.07)
            this.loot = false
            this.thief = ''
            this.home(cat)
          }
        }
      } else if (pet.away && (pet.stay -= dt) <= 0) this.home(pet)
      else if (pet === this.tail && this.chase()[spot(pet.x, pet.z)] > 1) this.walk(pet, this.chase(), 4, dt, true)
      if (pet === this.tail || (pet === cat && this.thief)) {
        const floor = this.foot(pet.x, pet.z)
        if (floor >= 0) pet.y += (floor - pet.y) * Math.min(1, dt * 12)
      }
      this.put(pet, (pet.hop > 0 ? Math.sin(Math.min(1, pet.hop / 0.5) * Math.PI) * 0.25 : 0) + Math.abs(Math.sin(pet.stride * Math.PI)) * 0.08, '')
    }
    // (The loaf the cat has is held up over its head, for anybody to see.)
    if (this.loot) solid.show(this.crumb)
    else solid.hide(this.crumb)
    solid.place(this.crumb, cat.x, cat.y + 0.62 + Math.abs(Math.sin(cat.stride * Math.PI)) * 0.08, cat.z)
    for (const duck of this.ducks) {
      duck.a += dt * 0.45
      if (duck.away) continue
      duck.x = POND[0] + Math.sin(duck.a) * 1.15
      duck.y = 0.9 + 0.02 * Math.sin(this.clock * 3 + duck.a)
      duck.z = POND[1] + Math.cos(duck.a) * 0.85
      duck.turn = turned(Math.cos(duck.a), -Math.sin(duck.a) * 0.74)
    }
    for (const [x, top, z, foot, dx, dz] of FALLS) {
      for (let n = 0; n < 2; n++) if (Math.random() < dt * 6) bits.spawn(x + (dz ? any() * 0.5 : 0), top - 0.1, z + (dx ? any() * 0.5 : 0), dx * (0.3 + Math.random() * 0.5), 0, dz * (0.3 + Math.random() * 0.5), 0.1 + Math.random() * 0.07, 0x9fd6ff, 1.6, foot - 0.06, 0)
      if (Math.random() < dt * 4) bits.spawn(x + dx * 0.12 + (dz ? any() * 0.5 : 0), foot + 0.06, z + dz * 0.12 + (dx ? any() * 0.5 : 0), any() * 0.3, 0.25, any() * 0.3, 0.12, 0xffffff, 0.9, NEVER, 0, -0.15)
    }
    if (Math.random() < dt * 8) bits.spawn(5 + any() * 0.1, STEP + 0.4, 0.72, 0, 0, 0.4, 0.07, 0x9fd6ff, 0.5, STEP - 0.06, 0)
    const [princess, prince] = this.royals
    for (const one of this.royals) one.hop -= dt
    if (this.over === 'wedding') {
      // She comes out through the gate and he comes up the road: they stop a step apart, on the stairs, and look at
      // each other. Then it rains paper.
      const there = [this.walk(princess, this.route(at(0, 1), true), 2.4, dt, true), this.walk(prince, this.route(at(0, 2), true), 3.4, dt, true)]
      for (const one of this.royals) {
        const floor = this.foot(one.x, one.z)
        if (floor >= 0) one.y += (floor - one.y) * Math.min(1, dt * 12)
      }
      if (there[0] && there[1]) {
        princess.turn = 0
        prince.turn = 2
        if (Math.random() < dt * 24) bits.spawn(any() * 6, STEP + 4 + Math.random() * 2, 1.5 + any() * 4, any(), 0, any(), 0.1, [HEART, GOLD, 0x9fd6ff, 0xc4a4f0, 0xffffff][Math.floor(Math.random() * 5)], 3, 3.6, 0.2, 2.5)
      }
    } else princess.turn = Math.floor(this.clock / 4) % 3 === 1 ? 1 : 0
    this.pose(princess)
    this.pose(prince, this.over !== 'wedding')
  }

  // The musician.

  private play(dt: number) {
    const { tune, me } = this
    tune.hop -= dt
    if (tune.mode === 'follow') {
      // Behind the helper, a step or two: the way to him is found again whenever he is on another tile.
      if (this.chase()[spot(tune.x, tune.z)] > 1) this.walk(tune, this.toMe, 3.6, dt, true)
      else [tune.stride, tune.turn] = [0, turned(me.x - tune.x, me.z - tune.z)]
    } else if (tune.mode === 'go') {
      if (this.walk(tune, this.route(tune.to, true), 3.6, dt, true)) {
        tune.mode = 'play'
        tune.turn = 0
        // At a wedding he plays for as long as anybody stays to look. At the camp's fire he plays one song: the camp
        // has its music, whether it asked or not, and two of those sitting get up for it.
        tune.left = this.over ? 9999 : SONG
        const k = this.asks.findIndex((ask) => ask.what === 'music' && ask.side === 1)
        if (k >= 0) this.asks.splice(k, 1)
        if (!this.over) this.cheer(1, 2)
      }
    } else if (tune.mode === 'play') {
      if ((tune.beat -= dt) <= 0) {
        tune.beat = 0.3
        tune.hop = 0.2
        note([0.3, 0.5, 0.6, 0.5, 0.7, 0.6, 0.4, 0.5][Math.floor(tune.left / 0.3) % 8], 0.07)
        this.bits.spawn(tune.x + any() * 0.5, tune.y + 1.5, tune.z + any() * 0.5, any() * 0.5, 0.9, any() * 0.5, 0.11, [0xc4a4f0, 0xffd45c, 0x9fd6ff, 0xff9a85][Math.floor(Math.random() * 4)], 1.4, NEVER, 0, -0.3)
      }
      if ((tune.left -= dt) <= 0) tune.mode = 'home'
    } else if (!tune.seated && this.walk(tune, this.route(HOME, true), 3.6, dt, true)) {
      // Home: back on his stool.
      tune.seated = true
      tune.x = STOOL[0]
      tune.z = STOOL[1]
      tune.turn = 0
      tune.hop = 0.4
    }
    // Nobody stands in anybody: where the helper comes too close, the musician gives way.
    const [dx, dz] = [tune.x - me.x, tune.z - me.z]
    const near = Math.hypot(dx, dz)
    if (!tune.seated && near < 0.8) {
      const [px, pz] = near ? [(dx / near) * (0.8 - near), (dz / near) * (0.8 - near)] : [0.1, 0]
      if (this.pass(spot(tune.x, tune.z), spot(tune.x + px, tune.z + pz), true)) [tune.x, tune.z] = [tune.x + px, tune.z + pz]
    }
    const floor = this.foot(tune.x, tune.z)
    if (!tune.seated && floor >= 0) tune.y += (floor - tune.y) * Math.min(1, dt * 12)
    if (tune.seated) tune.y = STEP
    // He plays wherever he sits, not only at the camp, and notes rise from him: so that it can be seen that he is the
    // music. Wanted somewhere, or playing at the camp, he plays faster, and the notes go higher and dance.
    const playing = tune.seated || tune.mode === 'play'
    const lively = tune.mode === 'play' || this.asks.some((ask) => ask.what === 'music')
    const pace = lively ? 20 : 9
    this.pose(tune, tune.seated, tune.seated ? 0.3 : 0, playing ? 0.04 * Math.sin(this.clock * pace) + 0.04 : 0)
    this.notes.forEach((cubes, k) => {
      const p = (this.clock * (lively ? 0.75 : 0.4) + k / 3) % 1 // how far up this one is, 0 to 1
      const grow = playing ? Math.sin(p * Math.PI) : 0 // it comes, and goes, by its size
      const [sway, rise] = lively ? [0.35, 2.2] : [0.18, 1.3]
      const [x, y, z] = [tune.x + Math.sin(p * 7 + k * 2) * sway + (k - 1) * 0.25, tune.y + 1.35 + p * rise, tune.z + Math.cos(p * 5 + k) * sway * 0.6]
      QUAVER.forEach(([dx, dy, dz, sx, sy, sz], n) => {
        this.solid.size(cubes[n], sx * grow, sy * grow, sz * grow)
        this.solid.place(cubes[n], x + dx * grow, y + dy * grow, z + dz)
      })
    })
  }

  // The war.

  /** Somebody of the other side to shoot at: one of the camp that is out and near enough, or any of the castle. */
  private target(man: Fighter) {
    const foes = this.men.filter((foe) => foe.side !== man.side && !foe.gone && (foe.side === 0 || (!foe.sad && Math.hypot(foe.x - man.x, foe.z - man.z) < 11)))
    return foes[Math.floor(Math.random() * foes.length)]
  }
  /** An arrow from one to another. Three in ten are good shots, and make whoever they are for jump; the rest land near. */
  private shoot(man: Fighter, foe: Fighter) {
    const arrow = this.shots[(this.next = (this.next + 1) % this.shots.length)]
    const good = Math.random() < 0.3
    const [x, z] = good ? [foe.x, foe.z] : [foe.x + any() * 2.4, foe.z + any() * 2.4]
    arrow.from = [man.x, man.y + 0.9, man.z]
    arrow.to = [x, good ? foe.y + 0.7 : (this.high[spot(x, z)] ?? 0), z]
    arrow.t = 0
    arrow.time = Math.min(1.2, Math.max(0.45, Math.hypot(x - man.x, z - man.z) / 10))
    arrow.rest = good ? 0 : 1.2
    arrow.at = good ? foe : undefined
    man.wait = (1.8 + Math.random() * 1.8) * (1 + this.love * 0.7)
    man.swing = 0.25
    man.turn = turned(x - man.x, z - man.z)
  }
  private fly(dt: number) {
    this.shots.forEach((arrow, i) => {
      if (arrow.t >= arrow.time + arrow.rest) return
      const before = arrow.t
      arrow.t += dt
      const u = Math.min(1, arrow.t / arrow.time)
      const [fx, fy, fz] = arrow.from
      const [tx, ty, tz] = arrow.to
      const arc = 0.5 + Math.hypot(tx - fx, tz - fz) * 0.12
      if (before < arrow.time && u === 1 && arrow.at) {
        arrow.at.hop = 0.35
        this.puff(tx, ty, tz, 4, 0xffffff, ty - 0.7, 0.08)
      }
      // Stuck where it landed, it stays a moment and then shrinks away.
      const size = arrow.t >= arrow.time + arrow.rest ? 0 : u < 1 ? 1 : Math.min(1, (arrow.time + arrow.rest - arrow.t) * 4)
      _q.setFromUnitVectors(AHEAD, _v.set(tx - fx, ty - fy + 4 * arc * (1 - 2 * Math.min(u, 0.9)), tz - fz).normalize())
      this.sticks.setMatrixAt(i, _m.compose(_v.set(fx + (tx - fx) * u, fy + (ty - fy) * u + 4 * arc * u * (1 - u), fz + (tz - fz) * u), _q, _s.set(0.07, 0.07, 0.8).multiplyScalar(size)))
      this.sticks.instanceMatrix.needsUpdate = true
    })
  }
  private fight(dt: number) {
    const { solid } = this
    // The camp is out at the wall while it is charging (see `direct`): not while there is music by its fire, and not
    // once the day is over. And the further the courting has got, the less anybody's heart is in it.
    const calm = this.over !== '' || this.tune.mode === 'play'
    const out = this.phase.charge && !calm
    const slack = 1 + this.love * 0.7
    const dry = this.asks.some((ask) => !ask.side && ask.what === 'wood') // the castle is out of arrows
    for (const man of this.men) {
      if (man.gone) continue
      man.wait -= dt
      man.swing -= dt
      man.hop -= dt
      const feast = this.over === 'wedding'
      let sit = man.sad
      if (!man.side) {
        const foe = out && !man.sad && !dry && man.wait <= 0 ? this.target(man) : undefined
        if (foe) this.shoot(man, foe)
        else if (!out) man.turn = 0
      } else {
        const to = feast ? man.front : man.sad || !out ? man.home : man.front
        const there = this.walk(man, this.route(to), MARCH, dt)
        man.busy = there && to === man.front && !feast
        if (!there) sit = false
        else if (feast) man.turn = turned(-man.x, 1.5 - man.z) // at a wedding: up at the wall with the rest, looking on
        else if (!man.busy) {
          // By the fire: looking into it, and sitting down to listen if there is music.
          man.turn = turned(FIRE[0] - man.x, FIRE[1] - man.z)
          sit ||= this.tune.mode === 'play'
        } else if (man.kind === 'archer') {
          const foe = man.wait <= 0 ? this.target(man) : undefined
          if (foe) this.shoot(man, foe)
        } else {
          // At the foot of the wall: a blow at it, and chips fly.
          man.turn = 2
          if (man.wait <= 0) {
            man.wait = (0.55 + Math.random() * 0.3) * slack
            man.swing = 0.2
            this.bits.spawn(man.x + any() * 0.3, man.y + 0.9, man.z - 0.42, any() * 2, 1 + Math.random() * 2, 0.6 + Math.random(), 0.09, STONE[this.blows % 3], 0.6, man.y, 0.3)
            if (++this.blows % 5 === 0) note(0.05, 0.025)
          }
        }
        const floor = this.foot(man.x, man.z)
        if (floor >= 0) man.y += (floor - man.y) * Math.min(1, dt * 12)
      }
      this.pose(man, sit, 0, man.swing > 0 ? 0.24 : 0)
      // The cloud over one that is sitting: there while it sits, and it rains on them.
      const dim = man.sad && sit
      if (dim !== man.dim) {
        man.dim = dim
        for (const c of man.cloud) {
          if (dim) solid.show(c)
          else solid.hide(c)
        }
      }
      if (!dim) continue
      CLOUD.forEach(([dx, dy, dz], k) => solid.place(man.cloud[k], man.x + dx, man.y + 1.7 + dy + 0.05 * Math.sin(this.clock * 2 + man.x), man.z + dz))
      if (Math.random() < dt * 8) this.bits.spawn(man.x + any() * 0.7, man.y + 1.55, man.z + any() * 0.24, 0, -1.2, 0, 0.06, 0x5aa9f2, 0.45, man.y + 0.9, 0, 9)
    }
  }

  update(dt: number) {
    this.clock += dt
    if (!this.begun) {
      // The arrow shows the way: over the tree, and once he has the wood on his hat over the winch, where it goes up. A click
      // on it is a click on whatever it stands over.
      const carrying = this.me.loads.includes('wood')
      const tree = this.trees[this.first]
      const bob = Math.abs(Math.sin(this.clock * 4)) * 0.4
      const [x, z, y] = carrying ? [HOOK, WINCH, STEP + TOWER + 3.9 + bob] : [across(tree.t), along(tree.t), tree.ground + 2.8 + bob]
      this.arrow.forEach((c, k) => {
        this.solid.owner[c] = carrying ? BASKET : TREE + this.first
        this.solid.place(c, x + ARROW[k][0] * 1.6, y + ARROW[k][1] * 1.6, z + ARROW[k][2] * 1.6)
      })
    }
    if (!this.over) this.direct(dt)
    this.help(dt)
    this.play(dt)
    this.fight(dt)
    this.tend(dt)
    this.fly(dt)
    // Towards evening the light goes warm and low, and the sky with it.
    const dusk = Math.min(1, Math.max(0, (this.time / DAY - 0.7) / 0.3))
    if (dusk !== this.dusk) {
      this.dusk = dusk
      this.key.color.lerpColors(NOON[0], EVENING[0], dusk)
      this.key.intensity = 3.2 - 0.9 * dusk
      this.glow.intensity = 1.25 - 0.2 * dusk
      this.sky.lerpColors(NOON[1], EVENING[1], dusk)
    }
    this.solid.wind.value.set(0.1, 0.05, this.clock)
    this.wet.wind.value.set(0.025, 0, this.clock)
    this.solid.update(dt)
    this.wet.update(dt)
    this.bits.update(dt)
  }
}
