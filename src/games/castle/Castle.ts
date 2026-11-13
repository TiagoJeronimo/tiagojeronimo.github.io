// A castle on a hill, in the cubes of the island game (`../island/cubes.ts`): a floor, flat ground lying on it, the hill
// that stands on that, the castle on top, a stream that comes down one side, and soldiers that drop where they are put
// and then fight. One that lands on the hill or the castle is the castle's; one that lands anywhere else, on the flat
// ground or on the floor round it, is against it. The page (`CastlePage.tsx`) draws it and hands it the clicks; the
// camera is the page's too (`View.ts`).
//
// The fight, in short. Those against the castle come to it; those of the castle stay where they were put, but for its
// swordsmen, who go for whoever comes near that they can walk to. A swordsman strikes whoever of the other side is
// within reach; against the castle and with nobody to get at, it hacks at the gate, and once that is down at the keep.
// An archer shoots whoever is in range (the castle's archers the swordsmen first: those are the ones coming); against
// the castle and with nobody in range, at the castle itself. Arrows fly in arcs and stop at what they meet: so a wall
// shelters whoever is behind it, its teeth stop half of what is meant for whoever stands on it, and it is worn down by
// what it stops: a tooth at a time, then a course at a time from the top, and whoever stood on it comes down with it.
// Who is hit often enough pops into loose cubes: nothing grim.
//
// What it is all about is the cat. It sits on the keep. When the keep comes down it runs off and sits somewhere else;
// whoever gets to it first picks it up and carries it home, which for either colour is the top of the hill, and the
// others go after it. With the cat home the castle puts itself together again, stone by stone, and it is theirs who
// brought it: the flag takes their colour, and whoever was against the castle is the castle's now. The cat does not care.
//
// There is a way out of all of it, and it is a picnic. Whoever is near one drops everything and sits down at it, and
// nobody strikes or shoots at somebody who has. When everybody there is is sitting, of both colours, it is peace, and
// it stays.
//
// Besides: sheep that graze, and are patted by whoever passes; ducks on the pond; and soldiers with nothing to do, who
// sit down, or fish, or sleep under a tree.
import { CircleGeometry, DirectionalLight, DynamicDrawUsage, Group, HemisphereLight, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, ShadowMaterial, Vector3 } from 'three'
import { Bits, Cubes, unit } from '../island/cubes.ts'
import { BARK, LEAF, NEAR, NEVER, RING, STONE, WOOD, any, rnd } from '../island/grid.ts'
import { thump } from '../../sound.ts'

export type Kind = 'archer' | 'sword'
/** What can be let go over the land: a soldier of either kind, or a picnic. */
export type Thing = Kind | 'picnic'

const SPAN = 16 // how far the land reaches from its middle, each way, in tiles
/** How far out there is somewhere to stand: the land, and the floor it lies on for a good way round it. */
export const REACH = 26
const N = 2 * REACH + 1
const TOP = 6 // how high the hilltop is; the flat ground round the hill is at 1, and the floor at 0
const YARD = 3 // the castle reaches this many tiles from the middle, each way
const WALL = 2.2 // how high its walls stand above the hilltop,
const TOWER = 3.3 // its corner towers,
const KEEP = 4.6 // and its keep
const ROOM = 9000 // cubes there are to build with: the land takes about a third of them

const GRASS = [0x8fd16b, 0x9fd872, 0xb4de6e]
const SOIL = 0xba936d
const PATH = 0xdcc79c
const PAVING = [0xd3cfd6, 0xc9c4cd]
const WATER = 0x86cdf5 // the island's water, in the island's kind of bed
const BED = 0xb9a67e
/** The two colours soldiers come in. The castle's own wear the colour of its flag: blue, at first. */
export const WEAR = [0x5b8fd6, 0xe2694f]
const HEART = 0xff8fb1

// How they fight.
const LIVES = { archer: 2, sword: 4 } // the hits each can take
const PACE = { archer: 1.8, sword: 2.3 } // tiles a second
const RANGE = 9.5 // how far an arrow is sent: a little further downhill, and not so far up
const RELOAD = 1.7 // seconds between an archer's arrows,
const SWING = 0.6 // and between a swordsman's blows
const ALERT = 7 // how near, in steps, somebody has to come before the castle's swordsmen go for them,
const NOTICE = 10 // and how near one of the castle's has to be for a swordsman against it to turn aside from the gate
const STEP = 1.15 // the highest step anybody takes: a wall is more,
const DROP = 2.4 // but not too much to jump down from, for somebody who has to: a tower is
const PULL = 16 // what brings an arrow down
const FAR = 65535 // no way there
const APPEAL = 6 // how near a picnic has to be, in steps, for a soldier to drop everything for it
const DAWDLE = 3 // how many seconds a soldier has nothing to do before it finds itself something,
const STROLL = 3 // and how far, in steps, it will go for it: to the water to fish, or to a tree to sleep under
// The castle is built of stones, and comes down a part at a time. A piece of it (a stretch of wall, a tower, the gate,
// the keep) is a pile of courses with teeth on top: the teeth go first, one by one, and then the courses, the highest
// first, so that nothing is ever left with nothing under it. These are the blows and arrows each part takes: a stretch
// of wall takes 12 in all, a tower 20, the gate 24, the keep 48.
const TOUGH = { tooth: 2, wall: 2, tower: 4, keep: 8, beam: 4, planks: 10 }
const WALLS = [0xb7b2ba, 0xb7b2ba, 0xaea9b5, 0xbdb8c0, 0xb1acb8] // stone, no two stones quite alike: of the walls,
const TOWERS = [0xa39eab, 0xa39eab, 0x9c97a6, 0xaaa5b2, 0x9f9aa8] // and of the towers and the keep
const MOSS = [0x8db36c, 0x7fa862, 0xa3c47c]
const SLIT = 0x5a5563 // the dark of an arrow slit
const QUARTERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]]

/** The tile at (x, z), both whole numbers from -REACH to REACH; the tile a place is on; and where a tile is. */
const at = (x: number, z: number) => x + REACH + (z + REACH) * N
const spot = (x: number, z: number) => at(Math.round(x), Math.round(z))
const across = (t: number) => (t % N) - REACH
const along = (t: number) => Math.floor(t / N) - REACH
const GATE = at(0, YARD)

/** How high the hill is at (x, z): 0 where there is no land. A round hill in steps, flat on top, on flat ground. */
const hill = (x: number, z: number) => {
  if (Math.max(Math.abs(x), Math.abs(z)) <= YARD + 1) return TOP
  const r = Math.hypot(x, z)
  // (The path and the stream go down in even steps, one at a time: nothing uneven along them.)
  const wobble = (x === 0 && z > 0) || (z === 0 && x > 0) ? 0 : rnd(x * 31 + z * 57 + 900) - 0.5
  if (r + wobble * 1.6 > SPAN - 0.3) return 0
  return Math.max(1, Math.min(TOP, TOP - Math.ceil((r + wobble * 1.1 - 5.2) * 0.95)))
}
/** The stream: out of a pool by the east wall, down the hill, through a pond at its foot, and across the flat ground to the edge. */
const STREAM = [[4, -1], [4, 0], [10, -1], [10, 1], [11, -1], [11, 1], ...Array.from({ length: SPAN - 4 }, (_, k) => [5 + k, 0])].filter(([x, z]) => hill(x, z))
const WET = new Set(STREAM.map(([x, z]) => at(x, z)))
const END = Math.max(...STREAM.map(([x]) => x)) // its last tile: past that, and nowhere else, the water goes over the edge
/**
 * How high the land is at (x, z): the hill, and banks to the stream. Ground beside the water is never lower than the
 * water is there, and there is ground beside it even where the land would have ended: else the water would hang in
 * the air with nothing to hold it.
 */
const land = (x: number, z: number) => {
  const h = hill(x, z)
  if (Math.max(Math.abs(x), Math.abs(z)) > SPAN + 1 || WET.has(at(x, z)) || (z === 0 && x === END + 1)) return h
  return Math.max(h, ...NEAR.map(([i, j]) => (WET.has(at(x + i, z + j)) ? hill(x + i, z + j) : 0)))
}

// A soldier, in boxes: where each sits (across, the height of its foot, and along), how big it is, and what it is made
// of. It faces along: its bow or its sword is on its right, its quiver on its back.
type Part = [x: number, y: number, z: number, sx: number, sy: number, sz: number, ink: keyof typeof INK]
const INK = { boot: 0x5b4a44, tunic: 0xd9d4dc, skin: 0xf2c9a0, steel: 0xb9bcc9, wood: 0x9a7b62, hide: 0x7d6450, blade: 0xe6e9f2, wool: 0xf6f2ea, fur: 0xf0a04b, ear: 0xd98a3a, down: 0xfbfaf5, bill: 0xf5a742 }
const BODY: Part[] = [
  [-0.09, 0, 0, 0.13, 0.22, 0.15, 'boot'],
  [0.09, 0, 0, 0.13, 0.22, 0.15, 'boot'],
  [0, 0.22, 0, 0.4, 0.36, 0.28, 'tunic'],
  [0, 0.58, 0, 0.3, 0.26, 0.26, 'skin'],
  [0, 0.8, 0, 0.36, 0.13, 0.32, 'steel'],
]
const ARMS: Record<Kind, Part[]> = {
  archer: [[0.27, 0.18, 0.02, 0.07, 0.5, 0.07, 'wood'], [-0.2, 0.3, -0.16, 0.12, 0.3, 0.1, 'hide']], // a bow, and a quiver on its back
  sword: [[0.27, 0.3, 0.02, 0.07, 0.46, 0.07, 'blade'], [-0.27, 0.22, 0.02, 0.08, 0.32, 0.28, 'tunic']], // a sword, and a shield in its colours
}
/** They are drawn a third bigger than they were measured: small enough for the walls, big enough to be seen from afar. */
const big = (parts: Part[]) => parts.map(([x, y, z, sx, sy, sz, ink]): Part => [x * 1.3, y * 1.3, z * 1.3, sx * 1.3, sy * 1.3, sz * 1.3, ink])
const PARTS: Record<Kind, Part[]> = { archer: big([...BODY, ...ARMS.archer]), sword: big([...BODY, ...ARMS.sword]) }
// The animals, in boxes like the soldiers. A sheep (its head first: it puts that down to graze), a duck, and the cat,
// which sits like a loaf with its tail up.
const SHEEP: Part[] = [
  [0, 0.26, 0.3, 0.2, 0.2, 0.2, 'boot'],
  [0, 0.14, 0, 0.38, 0.32, 0.52, 'wool'],
  [-0.12, 0, 0.17, 0.08, 0.16, 0.08, 'boot'],
  [0.12, 0, 0.17, 0.08, 0.16, 0.08, 'boot'],
  [-0.12, 0, -0.17, 0.08, 0.16, 0.08, 'boot'],
  [0.12, 0, -0.17, 0.08, 0.16, 0.08, 'boot'],
]
const DUCK: Part[] = [
  [0, 0, 0, 0.18, 0.13, 0.27, 'down'],
  [0, 0.1, 0.11, 0.12, 0.13, 0.12, 'down'],
  [0, 0.13, 0.2, 0.07, 0.04, 0.08, 'bill'],
]
const CAT: Part[] = [
  [0, 0, 0, 0.22, 0.2, 0.38, 'fur'],
  [0, 0.14, 0.2, 0.24, 0.2, 0.2, 'fur'],
  [-0.08, 0.34, 0.22, 0.07, 0.08, 0.06, 'ear'],
  [0.08, 0.34, 0.22, 0.07, 0.08, 0.06, 'ear'],
  [0, 0.12, -0.2, 0.06, 0.28, 0.06, 'fur'],
]
// A picnic: a cloth in four squares, a basket, a cake with a cherry on it, and over it all a sunshade, so that it can
// be seen for what it is from the far end of the land. (Where each is, how big, and its colour.)
const PICNIC = [
  [0, 0.04, 0, 0.06, 1.6, 0.06, 0x9a7b62],
  [-0.33, 1.62, -0.33, 0.66, 0.1, 0.66, 0xfff8e7],
  [0.33, 1.62, -0.33, 0.66, 0.1, 0.66, 0xf6d166],
  [-0.33, 1.62, 0.33, 0.66, 0.1, 0.66, 0xf6d166],
  [0.33, 1.62, 0.33, 0.66, 0.1, 0.66, 0xfff8e7],
  [0, 1.72, 0, 0.14, 0.08, 0.14, 0xf6d166],
  [-0.275, 0, -0.275, 0.55, 0.04, 0.55, 0xf6d166],
  [0.275, 0, -0.275, 0.55, 0.04, 0.55, 0xfff8e7],
  [-0.275, 0, 0.275, 0.55, 0.04, 0.55, 0xfff8e7],
  [0.275, 0, 0.275, 0.55, 0.04, 0.55, 0xf6d166],
  [-0.2, 0.04, 0.12, 0.32, 0.22, 0.26, 0x9a7b62],
  [0.22, 0.04, -0.16, 0.22, 0.13, 0.22, 0xfff8f0],
  [0.22, 0.17, -0.16, 0.07, 0.07, 0.07, 0xe2694f],
]
/** They look one of four ways, as cubes do. For each quarter turn, what becomes of across and along. */
const TURNS = [[1, 0, 0, 1], [0, 1, -1, 0], [-1, 0, 0, -1], [0, -1, 1, 0]]
/** Which of the four ways is nearest to the way (dx, dz) goes. */
const turned = (dx: number, dz: number) => (Math.round(Math.atan2(dx, dz) / (Math.PI / 2)) + 4) % 4

/** Something made of parts, that is somewhere and looks some way: a soldier, a sheep, a duck, the cat. */
interface Body {
  x: number
  y: number
  z: number
  /** Which way it looks, in quarter turns; and what its cubes were last sized for. */
  turn: number
  drawn: string
  cubes: number[]
}
interface Soldier extends Body {
  kind: Kind
  /** How fast it is falling: it drops out of the sky. */
  vy: number
  /** The height it stands at, or will. */
  floor: number
  landed: boolean
  /** Which of the two colours it wears; and whether that is the castle's, as things stand. */
  team: number
  home: boolean
  /** The hits it can still take. */
  hp: number
  /** How long until it can strike or shoot again, and how long its blade stays up after a blow. */
  wait: number
  swing: number
  /** How far along its stride it is: it goes at a hop. */
  stride: number
  /** How fast it is going, for whoever aims at it. */
  vx: number
  vz: number
  /** Where on a tile it likes to be: each its own way off the middle, so that they do not go in file. */
  ox: number
  oz: number
  parts: Part[]
  /** How long it has had nothing to do; what it has found to do about that; and until the next sign of it, a snore or a bite. */
  idle: number
  mood: '' | 'sit' | 'fish' | 'nap'
  beat: number
  /** How long it goes on waving; how long it goes on patting a sheep; and which sheep it has patted already. */
  wave: number
  pat: number
  patted: number
  /** Its place at a picnic, which it has from the moment it is drawn to one; and whether it has sat down there. */
  seat?: [Picnic, number]
  sat: boolean
  /** Its colour has just come by the castle, and it has yet to go up to it. */
  movein: boolean
}
interface Sheep extends Body {
  /** Where it is ambling to; how long it eats first; its stride; and how long it goes on hopping, having been patted. */
  tx: number
  tz: number
  wait: number
  stride: number
  hop: number
}
interface Duck extends Body {
  /** How far round the pond it is. */
  a: number
  hop: number
}
interface Cat extends Body {
  /** Off the keep; sitting somewhere, to be picked up; and who has it. */
  loose: boolean
  settled: boolean
  by?: Soldier
  /** Where it is off to. */
  tx: number
  tz: number
  stride: number
  hop: number
}
interface Picnic {
  x: number
  y: number
  z: number
  vy: number
  floor: number
  landed: boolean
  cubes: number[]
  /** The places round it, and who has each. */
  seats: number[][]
  taken: (Soldier | undefined)[]
}
/** A cube of the castle, and its colour for when it comes off. */
interface Stone {
  cube: number
  ink: number
  /** For what stands on top of a piece (the keep's flag): how high above the top of it. */
  rise?: number
}
/** A course of a piece of the castle, or one of its teeth: what comes off together. */
interface Course {
  stones: Stone[]
  /** The small things on its faces: one of them comes off at every blow that does not bring it down. */
  bits: Stone[]
  /** The blows it still takes. */
  hp: number
  /** How high its top is above the hilltop. */
  top: number
  /** As it was built: the blows it took then, and all the small things it had. */
  full: number
  all: Stone[]
}
/** A piece of the castle that can be brought down: a stretch of wall, a tower, the gate, the keep. */
interface Piece {
  tiles: number[]
  /** Its teeth, which go first; and its courses, the highest first. */
  teeth: Course[]
  courses: Course[]
  /** What stands on top of it, and comes down as it does. */
  crown: Stone[]
  /** Whether it is a door: nobody stands on it, and nobody gets by while any of it is left. */
  shut: boolean
  /** As it was built, for when it is put together again. */
  all: { teeth: Course[]; courses: Course[]; crown: Stone[] }
}
interface Arrow {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  /** Which colour let it go. */
  team: number
  fly: boolean
  /** How long one that has stuck in the ground stays there. */
  rest: number
}

const _m = new Matrix4()
const _q = new Quaternion()
const _v = new Vector3()
const _s = new Vector3()
const AHEAD = new Vector3(0, 0, 1)
/** How long an arrow is in the air on its way to something that far off: longer by `lob` for one sent high, over what is in the way. */
const flight = (far: number, lob = 1) => Math.min(1.1, Math.max(0.4, far / 11)) * lob

export class Castle {
  readonly group = new Group()
  readonly solid = new Cubes(ROOM, new MeshStandardMaterial({ roughness: 0.9 }), 'wind')
  readonly wet = new Cubes(200, new MeshStandardMaterial({ roughness: 0.15, transparent: true, opacity: 0.72 }), 'waves')
  readonly bits = new Bits(1200)
  readonly men: Soldier[] = []
  /** The pieces of the castle that still stand. */
  readonly pieces: Piece[] = []
  /** Which of the two colours the castle is: whose flag is on the keep. And how many owners it has had, this one counted. */
  owner = 0
  owners = 1
  /** Whether everybody has sat down. */
  peace = false
  /** For every tile, how high whoever is there stands: -1 where nobody can be. */
  private stand = new Float32Array(N * N).fill(-1)
  /** And how high what is there reaches, the ground or the piece of the castle on it: no arrow goes lower. */
  private roof = new Float32Array(N * N)
  /** Which piece of the castle is on a tile. */
  private on: (Piece | undefined)[] = []
  /** Where the stream goes over an edge: where, from how high, and down to what. */
  private falls: number[][] = []
  private shots: Arrow[] = Array.from({ length: 96 }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 1, team: 0, fly: false, rest: 0 }))
  private next = 0
  private sticks = new InstancedMesh(unit, new MeshStandardMaterial({ color: 0x6b5446, roughness: 0.9 }), this.shots.length)
  // The ways. For every tile, how many steps it is on foot: to the nearest soldier of each colour; to the part of the
  // castle that those against it are after; to the cat, when it is off the keep; to the top of the hill, which is
  // home for whoever has the cat; to a picnic with room at it; to the water's edge; and to the shade of a tree.
  private toTeam = [new Uint16Array(N * N), new Uint16Array(N * N)]
  private toCastle = new Uint16Array(N * N)
  private toCat = new Uint16Array(N * N)
  private toTop = new Uint16Array(N * N)
  private toPicnic = new Uint16Array(N * N)
  private toBank = new Uint16Array(N * N)
  private toShade = new Uint16Array(N * N)
  private banks: number[] = []
  private shades: number[] = []
  /** That part of the castle: the gate while it stands, and after that the keep. */
  private marks = new Set<Piece>()
  private keep: Piece
  /** Every piece of the castle, standing or not: for putting it together again. So too the stretch of wall over the gate, which is held up by the walls on either side of it; and the flag, for its colour. */
  private built: Piece[] = []
  private arch: Stone[] = []
  private whole: Stone[] = []
  private flag: Stone
  /** How long until the ways are found afresh. */
  private think = 0
  /** The cubes of those that have popped, for the next of their kind. */
  private spare: Record<Kind, number[][]> = { archer: [], sword: [] }
  private sheep: Sheep[] = []
  private ducks: Duck[] = []
  private cat: Cat
  private picnics: Picnic[] = []
  private time = 0

  constructor() {
    const { solid, wet } = this
    // The land: under every tile a column of earth, and on it a slab of whatever lies on top. Round it, the floor.
    for (let z = -REACH + 1; z < REACH; z++)
      for (let x = -REACH + 1; x < REACH; x++) {
        const h = land(x, z)
        const t = at(x, z)
        if (!h) {
          this.stand[t] = 0
          continue
        }
        const paved = Math.max(Math.abs(x), Math.abs(z)) < YARD
        const path = x === 0 && z > YARD
        if (WET.has(t)) {
          // Water lies in a bed half a step deep, as on the island, and comes nearly to the top of it. It can be waded.
          solid.add(x, (h - 0.6) / 2, z, 1, h - 0.6, 1, SOIL)
          solid.add(x, h - 0.55, z, 1, 0.1, 1, BED)
          wet.add(x, h - 0.28, z, 1, 0.44, 1, WATER)
          this.stand[t] = this.roof[t] = h - 0.5
          continue
        }
        solid.add(x, (h - 0.25) / 2, z, 1, h - 0.25, 1, SOIL)
        solid.add(x, h - 0.125, z, 1, 0.25, 1, paved ? PAVING[(x + z) & 1] : path ? PATH : GRASS[Math.floor(rnd(t) * 3)])
        this.stand[t] = this.roof[t] = h
        if (paved || path || Math.max(Math.abs(x), Math.abs(z)) <= YARD) continue
        // What grows: grass that bends in the wind, a flower here and there, and trees on the slopes and about the plain.
        for (let k = 0; k < 3; k++)
          if (rnd(t * 7 + k) < 0.36) {
            const gx = x + rnd(t * 11 + k) * 0.8 - 0.4
            const gz = z + rnd(t * 13 + k) * 0.8 - 0.4
            solid.bendy(solid.add(gx, h + 0.1, gz, 0.09, 0.2, 0.09, 0x7fca6c), 1, h, gx, gz)
            if (rnd(t * 17 + k) < 0.2) solid.bendy(solid.add(gx, h + 0.25, gz, 0.15, 0.13, 0.15, [0xfffaf0, 0xffd45c, 0xffc2d9, 0xc4a4f0, 0xff9a85][Math.floor(rnd(t * 19 + k) * 5)]), 1, h, gx, gz)
          }
        const beside = NEAR.some(([dx, dz]) => WET.has(at(x + dx, z + dz)))
        if (h <= 4 && Math.abs(x) > 1 && !beside && rnd(t * 23) < (h > 1 ? 0.11 : 0.045)) {
          this.stand[t] = -1 // nobody stands in a tree
          for (const [i, j] of NEAR) this.shades.push(at(x + i, z + j))
          solid.add(x, h + 0.45, z, 0.28, 0.9, 0.28, BARK)
          for (const [dy, size, k] of [[1.15, 1, 0], [1.75, 0.68, 2]]) solid.bendy(solid.add(x, h + dy, z, size, 0.75, size, LEAF[k]), 0.07, h, x, z)
        }
      }
    // Where the stream comes to a step down, or to the edge of the land, it goes over: see `update` for the drops. Over
    // the edge it comes down on the floor.
    for (const [x, z] of STREAM) {
      const h = land(x, z)
      const below = land(x + 1, z)
      if (z === 0 && below < h) this.falls.push([x + 0.5, h - 0.06, z, below ? below - 0.06 : 0])
    }

    // The castle. Walls a soldier can stand on, a tower at each corner, a gate to the south, a keep at the back: each a
    // piece that can be brought down, and each built of stones in courses, so that it comes down a part at a time.
    let seed = 7000 // (what is on a stone is the same on every visit)
    const add = (x: number, y: number, z: number, sx: number, sy: number, sz: number, ink: number): Stone => ({ cube: solid.add(x, TOP + y, z, sx, sy, sz, ink), ink })
    const piece = (tiles: number[], shut = false) => {
      const made: Piece = { tiles, teeth: [], courses: [], crown: [], shut, all: { teeth: [], courses: [], crown: [] } }
      this.pieces.push(made)
      for (const t of tiles) this.on[t] = made
      return made
    }
    /** The next course down of a piece. */
    const course = (of: Piece, hp: number, top: number) => {
      const made: Course = { stones: [], bits: [], hp, top, full: hp, all: [] }
      of.courses.push(made)
      return made
    }
    /**
     * A stone is laid in a course. On those of its faces that show (`faces`: which way each looks) there are small
     * things: stones that stand a little proud of it, and low down, where it is damp, moss.
     */
    const lay = (into: Course, greys: number[], x: number, y: number, z: number, sx: number, sy: number, sz: number, faces: number[][], bare?: (x: number, z: number) => boolean) => {
      into.stones.push(add(x, y, z, sx, sy, sz, greys[Math.floor(rnd(seed++) * greys.length)]))
      for (const [nx, nz] of faces)
        for (let k = Math.ceil((nx ? sz : sx) * sy * 3); k > 0; k--) {
          const [what, u, v, big] = [rnd(seed++), rnd(seed++) - 0.5, rnd(seed++) - 0.5, rnd(seed++)]
          const low = y < 0.7
          if (what > (low ? 0.6 : 0.3)) continue
          const mossy = low && what < 0.36
          const s = mossy ? 0.2 + big * 0.2 : 0.11 + big * 0.09
          // Moss lies on the face, and a small stone is set in it: how thick each is, and how far its middle is from the face.
          const [thick, out] = mossy ? [0.05, 0.015] : [s, -0.1 * s]
          const room = (nx ? sz : sx) - s
          const [px, pz] = [x + nx * (sx / 2 + out) + (nx ? 0 : u * room), z + nz * (sz / 2 + out) + (nz ? 0 : u * room)]
          if (bare?.(px, pz)) continue // (a door or a slit is there)
          into.bits.push(add(px, y + (mossy ? -Math.abs(v) : v) * (sy - s), pz, nx ? thick : s, mossy ? s * 0.8 : s, nz ? thick : s, mossy ? MOSS[Math.floor(big * 3)] : greys === WALLS ? TOWERS[Math.floor(big * 5)] : WALLS[Math.floor(big * 5)]))
        }
    }
    /** A tooth on top of a piece: some have a cap of moss. */
    const tooth = (of: Piece, x: number, y: number, z: number, wide: number, high: number) => {
      const made: Course = { stones: [add(x, y, z, wide, high, wide, STONE[2])], bits: [], hp: TOUGH.tooth, top: 0, full: TOUGH.tooth, all: [] }
      if (rnd(seed++) < 0.3) made.stones.push(add(x, y + high / 2 + 0.02, z, wide * 0.8, 0.05, wide * 0.8, MOSS[Math.floor(rnd(seed++) * 3)]))
      of.teeth.push(made)
    }
    for (let z = -YARD; z <= YARD; z++)
      for (let x = -YARD; x <= YARD; x++) {
        if (Math.max(Math.abs(x), Math.abs(z)) < YARD) continue
        if (Math.abs(x) === YARD && Math.abs(z) === YARD) {
          // A corner tower: three courses of four stones, an arrow slit on each side that looks out, and four teeth.
          const tower = piece([at(x, z)])
          for (let k = 2; k >= 0; k--) {
            const made = course(tower, TOUGH.tower, ((k + 1) * TOWER) / 3)
            for (const [qx, qz] of QUARTERS) lay(made, TOWERS, x + qx * 0.375, ((k + 0.5) * TOWER) / 3, z + qz * 0.375, 0.75, TOWER / 3, 0.75, [[qx, 0], [0, qz]], (px, pz) => k === 1 && Math.min(Math.abs(px - x), Math.abs(pz - z)) < 0.24)
            if (k === 1) for (const [nx, nz] of [[Math.sign(x), 0], [0, Math.sign(z)]]) made.stones.push(add(x + nx * 0.75, TOWER / 2, z + nz * 0.75, nx ? 0.04 : 0.1, 0.5, nz ? 0.04 : 0.1, SLIT))
          }
          for (const [dx, dz] of QUARTERS) tooth(tower, x + dx * 0.55, TOWER + 0.18, z + dz * 0.55, 0.4, 0.36)
          continue
        }
        const side = Math.abs(z) === YARD // along the north or the south of the yard, and not along its east or west
        const out = Math.sign(side ? z : x) * 0.3
        if (x === 0 && z === YARD) {
          // The gate: two leaves of a wooden door, each of two planks, with a beam across. Nobody stands on it, and
          // nobody gets by while any of it is left. Over it goes a stretch of wall, held up by the walls on either side.
          this.arch.push(add(0, WALL - 0.35, YARD, 1, 0.7, 0.8, WALLS[0]), ...[-0.25, 0.25].map((d) => add(d, WALL + 0.15, YARD + out, 0.26, 0.3, 0.26, STONE[2])))
          const gate = piece([GATE], true)
          course(gate, TOUGH.beam, 1.5).stones.push(add(0, 0.8, YARD + 0.17, 0.98, 0.14, 0.06, 0x7d6450))
          for (const k of [1, 0]) {
            const planks = course(gate, TOUGH.planks, (k + 1) * 0.75)
            for (const dx of [-0.24, 0.24]) planks.stones.push(add(dx, (k + 0.5) * 0.75, YARD, 0.46, 0.75, 0.3, k ? WOOD : 0x8f7159))
          }
          continue
        }
        // A stretch of wall: four courses of two stones, laid like bricks, and two teeth on its outer edge.
        const wall = piece([at(x, z)])
        for (let k = 3; k >= 0; k--) {
          const made = course(wall, TOUGH.wall, ((k + 1) * WALL) / 4)
          const joint = k % 2 ? 0.12 : -0.12
          for (const [from, to] of [[-0.5, joint], [joint, 0.5]]) {
            const [mid, wide] = [(from + to) / 2, to - from]
            lay(made, WALLS, side ? x + mid : x, ((k + 0.5) * WALL) / 4, side ? z : z + mid, side ? wide : 0.8, WALL / 4, side ? 0.8 : wide, side ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]])
          }
        }
        for (const d of [-0.25, 0.25]) tooth(wall, side ? x + d : x + out, WALL + 0.15, side ? z + out : z + d, 0.26, 0.3)
      }
    // The keep: a taller tower over four tiles at the back of the yard. Four courses of four stones, a slit high up on
    // every side, a door on the yard, teeth all round, and on top of it the flag.
    const keep = (this.keep = piece([[-1, -2], [0, -2], [-1, -1], [0, -1]].map(([x, z]) => at(x, z))))
    for (let k = 3; k >= 0; k--) {
      const made = course(keep, TOUGH.keep, ((k + 1) * KEEP) / 4)
      // (Nothing on its stones where a slit is, in the middle of a side, nor where the door is.)
      for (const [qx, qz] of QUARTERS) lay(made, TOWERS, -0.5 + qx * 0.5, ((k + 0.5) * KEEP) / 4, -1.5 + qz * 0.5, 1, KEEP / 4, 1, [[qx, 0], [0, qz]], (px, pz) => (k === 2 && Math.min(Math.abs(px + 0.5), Math.abs(pz + 1.5)) < 0.26) || (k === 0 && pz > -0.6 && Math.abs(px + 0.5) < 0.5))
      if (k === 2) for (const [nx, nz] of NEAR) made.stones.push(add(-0.5 + nx, ((k + 0.5) * KEEP) / 4, -1.5 + nz, nx ? 0.04 : 0.12, 0.55, nz ? 0.04 : 0.12, SLIT))
      if (k === 0) made.stones.push(add(-0.5, 0.42, -0.5, 0.5, 0.84, 0.05, 0x7d6450))
    }
    for (const [dx, dz] of [[-0.8, -0.8], [0, -0.8], [0.8, -0.8], [0.8, 0], [0.8, 0.8], [0, 0.8], [-0.8, 0.8], [-0.8, 0]]) tooth(keep, -0.5 + dx, KEEP + 0.18, -1.5 + dz, 0.34, 0.36)
    this.flag = { ...add(-0.14, 0, -1.5, 0.66, 0.42, 0.06, WEAR[0]), rise: 1.52 }
    keep.crown.push({ ...add(-0.5, 0, -1.5, 0.08, 1.8, 0.08, BARK), rise: 0.9 }, this.flag)
    // (Each is remembered as it was built: with the cat home again, the castle is put back the way it was.)
    for (const made of this.pieces) {
      made.all = { teeth: [...made.teeth], courses: [...made.courses], crown: [...made.crown] }
      for (const part of [...made.teeth, ...made.courses]) part.all = [...part.bits]
      this.settle(made)
    }
    this.built = [...this.pieces]
    this.whole = [...this.arch]
    // Small stones lie about at the foot of the walls.
    for (let k = 0; k < 44; k++) {
      const [a, b, s] = [rnd(seed++), rnd(seed++), 0.1 + rnd(seed++) * 0.1]
      const [by, far] = [(a - 0.5) * 2 * (YARD + 0.4), YARD + 0.5 + b * 0.35]
      const [x, z] = [[by, far], [by, -far], [far, by], [-far, by]][k % 4]
      if ((Math.abs(x) < 0.8 && z > 0) || WET.has(spot(x, z))) continue // not in the gateway, nor in the pool
      solid.add(x, TOP + s * 0.35, z, s, s * 0.7, s, [...WALLS, ...TOWERS][k % 10])
    }

    // The animals. The cat is on the keep, beside the flag. A few sheep are about the slopes and the flat ground, and
    // three ducks go round the pond at the foot of the hill.
    const body = (parts: Part[], x: number, y: number, z: number): Body => ({ x, y, z, turn: 0, drawn: '', cubes: parts.map(([, , , sx, sy, sz, ink]) => solid.add(x, y, z, sx, sy, sz, INK[ink])) })
    this.cat = { ...body(CAT, -0.1, TOP + KEEP, -1.1), loose: false, settled: false, tx: 0, tz: 0, stride: 0, hop: 0 }
    for (const [x, z] of [[-7, 6], [6, 9], [-9, -4], [7, -8], [-3, 12]]) {
      const t = this.near(x, z, (tile) => this.pasture(tile), 3)
      if (t !== undefined) this.sheep.push({ ...body(SHEEP, across(t), this.stand[t], along(t)), tx: across(t), tz: along(t), wait: 1 + rnd(t) * 5, stride: 0, hop: 0 })
    }
    for (const a of [0, 2.1, 4.2]) this.ducks.push({ ...body(DUCK, 10.5, 0.9, 0), a, hop: 0 })
    // Where there is water to fish in: the ground beside it. (Where there is shade was noted as the trees were planted.)
    for (const t of WET) for (const [i, j] of NEAR) this.banks.push(t + i + j * N)

    // The light: a low warm sun, a soft sky, and a floor that only shows the shadows that fall on it. The land lies on
    // that floor, and it is somewhere to stand like any other.
    const key = new DirectionalLight(0xffe9cf, 3.2)
    key.position.set(-16, 30, 12)
    key.castShadow = true
    key.shadow.mapSize.setScalar(globalThis.matchMedia?.('(pointer: coarse)').matches === false ? 4096 : 2048)
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.04
    key.shadow.radius = 5
    Object.assign(key.shadow.camera, { near: 1, far: 110, left: -34, right: 34, top: 34, bottom: -34 })
    const floor = new Mesh(new CircleGeometry(300, 32), new ShadowMaterial({ color: 0x6d4a7a, opacity: 0.25 }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    wet.mesh.castShadow = false
    this.sticks.instanceMatrix.setUsage(DynamicDrawUsage)
    this.sticks.frustumCulled = false
    this.sticks.castShadow = true
    for (let i = 0; i < this.shots.length; i++) this.sticks.setMatrixAt(i, _m.makeScale(0, 0, 0))
    this.group.add(solid.mesh, wet.mesh, this.bits.mesh, this.sticks, key, key.target, new HemisphereLight(0xe6efff, 0xffd9c4, 1.25), floor)
  }
  /** What it holds on the graphics card is given back: for a world that is thrown away for a new one. */
  dispose() {
    for (const mesh of [this.solid.mesh, this.wet.mesh, this.bits.mesh, this.sticks]) mesh.dispose()
  }

  /** Whether a tile is open ground: somewhere to stand that is not on the castle. */
  private open(t: number) {
    return this.stand[t] >= 0 && !this.on[t] && t !== GATE
  }
  /** Open ground that is not in the stream. */
  private dry(t: number) {
    return this.open(t) && !WET.has(t)
  }
  /** And dry ground on the land, below the hilltop: where sheep are. */
  private pasture(t: number) {
    const high = land(across(t), along(t))
    return this.dry(t) && high > 0 && high < TOP
  }
  /** The tile nearest to (x, z) that will do, looking so many tiles round: or none. */
  private near(x: number, z: number, ok: (t: number) => boolean, round = 1) {
    let found: number | undefined
    let least = Infinity
    for (let i = -round; i <= round; i++)
      for (let j = -round; j <= round; j++) {
        const [tx, tz] = [Math.round(x) + i, Math.round(z) + j]
        const far = Math.hypot(tx - x, tz - z)
        if (far >= least || Math.max(Math.abs(tx), Math.abs(tz)) >= REACH || !ok(at(tx, tz))) continue
        found = at(tx, tz)
        least = far
      }
    return found
  }

  /**
   * Something is let go over (x, z), and falls. For a soldier, where it lands says whose it is: on the hill or the
   * castle, the castle's, and it wears the colour of the flag; on the flat ground round the hill, or on the floor round
   * that, against it, in the other colour.
   * @returns whether there is anywhere there to land (and room in the world for one more)
   */
  drop(thing: Thing, x: number, z: number) {
    if (thing === 'picnic') return this.spread(x, z)
    // The tile that was pointed at; or, where a tree or the gate is in the way, the nearest tile beside it.
    const t = this.near(x, z, (tile) => tile !== GATE && this.stand[tile] >= 0)
    const parts = PARTS[thing]
    const used = t === undefined ? undefined : this.spare[thing].pop()
    if (t === undefined || (!used && this.solid.count + parts.length > ROOM)) return false
    const floor = this.stand[t]
    const team = land(across(t), along(t)) > 1 ? this.owner : 1 - this.owner
    // Not all on one spot: each a little way from the middle of its tile.
    const [ox, oz] = [any() * 0.5, any() * 0.5]
    const man: Soldier = {
      ...{ kind: thing, x: across(t) + ox, y: floor + 13, z: along(t) + oz, vy: 0, floor, landed: false, team, home: team === this.owner, hp: LIVES[thing] },
      ...{ turn: 0, drawn: '', wait: Math.random(), swing: 0, stride: 0, vx: 0, vz: 0, ox, oz, cubes: [], parts },
      ...{ idle: 0, mood: '', beat: 0, wave: 0, pat: 0, patted: 0, sat: false, movein: false },
    }
    man.cubes = used ?? parts.map(([, , , sx, sy, sz, ink]) => this.solid.add(man.x, man.y, man.z, sx, sy, sz, INK[ink]))
    // (Cubes that were somebody else's are made this one's: their colours as they were at first.)
    used?.forEach((c, k) => {
      this.solid.paint(c, INK[parts[k][6]])
      this.solid.show(c)
    })
    // The castle's look out from it, and those against it look at it.
    man.turn = man.home ? turned(man.x, man.z || 1) : turned(-man.x, -man.z)
    this.pose(man)
    this.men.push(man)
    return true
  }
  /** Which of the two colours a soldier let go over (x, z) would be: -1 where there is nowhere for one to land. */
  whose(x: number, z: number) {
    const t = this.near(x, z, (tile) => tile !== GATE && this.stand[tile] >= 0)
    return t === undefined ? -1 : land(across(t), along(t)) > 1 ? this.owner : 1 - this.owner
  }
  /** A picnic is let go over (x, z): a cloth, a basket and a cake. It comes down on open ground, and not in the water. */
  private spread(x: number, z: number) {
    const t = this.near(x, z, (tile) => this.dry(tile))
    if (t === undefined || this.solid.count + PICNIC.length > ROOM) return false
    const [px, pz, floor] = [across(t), along(t), this.stand[t]]
    // Round it, the places to sit: wherever there is ground at about its own height.
    const seats = Array.from({ length: 8 }, (_, k) => [px + Math.sin((k * Math.PI) / 4) * 1.15, pz + Math.cos((k * Math.PI) / 4) * 1.15]).filter(([sx, sz]) => this.dry(spot(sx, sz)) && Math.abs(this.stand[spot(sx, sz)] - floor) < 0.6)
    this.picnics.push({ x: px, y: floor + 13, z: pz, vy: 0, floor, landed: false, cubes: PICNIC.map(([, , , sx, sy, sz, ink]) => this.solid.add(px, floor + 13, pz, sx, sy, sz, ink)), seats, taken: [] })
    return true
  }
  /** A click at (x, y, z). If an animal is there it is patted, and nothing else comes of the click. */
  pat(x: number, y: number, z: number) {
    const one = [this.cat, ...this.sheep, ...this.ducks].find((it) => Math.hypot(it.x - x, it.y + 0.2 - y, it.z - z) < 0.55)
    if (!one) return false
    one.hop = 0.7
    this.heart(one.x, one.y + 0.5, one.z, 3)
    return true
  }
  /** The cursor is over (x, y, z). A soldier there waves. */
  hover(x: number, y: number, z: number) {
    const man = this.men.find((one) => one.landed && one.wave < -1 && Math.hypot(one.x - x, one.z - z) < 0.5 && Math.abs(one.y + 0.6 - y) < 0.9)
    if (man) man.wave = 1.2
  }

  /**
   * The cubes of something made of parts go where it is, turned the way it looks.
   * @param look what its cubes are to be sized for: their sizes are only set afresh when that changes
   * @param shape another place or size for a part, where it is not as it was measured: for one that sits, or sleeps, or
   * holds something up
   */
  private put(body: Body, parts: Part[], lift: number, look: string, shape?: (part: Part, k: number) => Part) {
    const [a, b, c, d] = TURNS[body.turn]
    const odd = body.turn & 1
    const sized = look + odd
    parts.forEach((part, k) => {
      const [dx, dy, dz, sx, sy, sz] = shape ? shape(part, k) : part
      if (sized !== body.drawn) this.solid.size(body.cubes[k], odd ? sz : sx, sy, odd ? sx : sz)
      this.solid.place(body.cubes[k], body.x + a * dx + b * dz, body.y + lift + dy + sy / 2, body.z + c * dx + d * dz)
    })
    body.drawn = sized
  }
  /** A soldier's cubes go where it is, as it is: on its feet, sitting, or asleep; and with what it holds where that is held. */
  private pose(man: Soldier) {
    this.put(man, man.parts, Math.abs(Math.sin(man.stride * Math.PI)) * 0.14, man.mood, ([dx, dy, dz, sx, sy, sz, ink], k) => {
      // Asleep: flat on its back. Sitting: on the ground, its legs out in front of it.
      if (man.mood === 'nap') return [dx, Math.max(0, dz), 0.65 - dy - sy / 2, sx, sz, sy, ink]
      if (man.mood === 'sit') return k < 2 ? [dx, 0, dz + 0.26, sx, sz, sy, ink] : [dx, dy - 0.286, dz, sx, sy, sz, ink]
      if (k !== 5) return [dx, dy, dz, sx, sy, sz, ink]
      // What it holds: up for a blow; up, and to and fro, for a wave; out over the water for a fish; down to a sheep.
      const blow = ink === 'blade' && man.swing > 0 ? 0.24 : 0
      const wave = man.wave > 0 ? 0.3 + 0.1 * Math.sin(man.wave * 24) : 0
      const out = man.mood === 'fish' ? 0.3 : man.pat > 0 ? 0.2 : 0
      return [dx, dy + blow + wave - (man.pat > 0 ? 0.12 : 0), dz + blow + out, sx, sy, sz, ink]
    })
  }
  /** A loose cube thrown up from (x, y, z): it comes down on whatever ground it is heading for. */
  private toss(x: number, y: number, z: number, speed: number, up: number, size: number, color: number, life: number) {
    const [vx, vz] = [any() * speed, any() * speed]
    const t = spot(x + vx * 0.5, z + vz * 0.5)
    this.bits.spawn(x, y, z, vx, up, vz, size, color, life, this.on[t] ? TOP : (this.roof[t] ?? 0), 0.3)
  }
  /** Small hearts go up from (x, y, z): somebody has been patted, or the cat has come home, or everybody has sat down. */
  private heart(x: number, y: number, z: number, n = 1) {
    for (let k = 0; k < n; k++) this.bits.spawn(x + any() * 0.4, y + any() * 0.2, z + any() * 0.4, any() * 0.3, 0.8 + Math.random() * 0.5, any() * 0.3, 0.11, HEART, 1.1, NEVER, 0, -0.4)
  }

  /**
   * Whether somebody can go from one tile to the next: both are somewhere to stand, the step up is not too high, and
   * the way down not too far.
   * @param jump how far down: by default as far as anybody jumps who means to
   */
  private pass(a: number, b: number, jump = DROP) {
    const rise = this.stand[b] - this.stand[a]
    return this.stand[a] >= 0 && this.stand[b] >= 0 && rise <= STEP && rise >= -jump
  }
  /** For every tile, how many steps it is on foot from the nearest of `from`: FAR where there is no way. */
  private flow(out: Uint16Array, from: number[]) {
    out.fill(FAR)
    for (const t of from) out[t] = 0
    for (let k = 0; k < from.length; k++) {
      const t = from[k]
      for (const n of [t + 1, t - 1, t + N, t - N]) {
        if (out[n] <= out[t] + 1 || !this.pass(n, t)) continue // (from there to here: the way is walked the other way round)
        out[n] = out[t] + 1
        from.push(n)
      }
    }
  }
  /** The ways are found afresh: people have moved, and a way may have opened. */
  private plan() {
    this.think = 0.3
    const { cat } = this
    const live = this.men.filter((man) => man.landed && man.hp > 0)
    // Where everybody is, for whoever is after them: but not those at a picnic or on their way to one. Nobody is after those.
    for (const k of [0, 1]) this.flow(this.toTeam[k], live.filter((man) => man.team === k && !man.seat).map((man) => spot(man.x, man.z)))
    // Of the castle, the gate while it stands, and after that the keep, which has the cat on it. The way to either is
    // to the ground beside it.
    const gate = this.on[GATE]
    this.marks = new Set(gate ? [gate] : this.pieces.includes(this.keep) ? [this.keep] : [])
    const beside: number[] = []
    for (const piece of this.marks)
      for (const p of piece.tiles)
        for (const [i, j] of NEAR) {
          const n = p + i + j * N
          if (!this.on[n] && this.stand[n] >= 0 && this.stand[n] <= TOP) beside.push(n)
        }
    this.flow(this.toCastle, beside)
    // The cat, off the keep: where it is, or where it is running to. And home for whoever has it: the top of the hill.
    this.flow(this.toCat, !cat.loose ? [] : [cat.by || cat.settled ? spot(cat.x, cat.z) : spot(cat.tx, cat.tz)])
    const top: number[] = []
    for (let z = -YARD - 1; z <= YARD + 1; z++) for (let x = -YARD - 1; x <= YARD + 1; x++) if (this.dry(at(x, z))) top.push(at(x, z))
    this.flow(this.toTop, top)
    // A picnic, while there is room at it or somebody still on the way to it.
    this.flow(this.toPicnic, this.picnics.filter((one) => one.landed && one.seats.some((_, k) => !one.taken[k]?.sat)).map((one) => spot(one.x, one.z)))
    this.flow(this.toBank, this.banks.filter((t) => this.dry(t) && land(across(t), along(t))))
    this.flow(this.toShade, this.shades.filter((t) => this.dry(t)))
    // Everybody sitting, and some of each colour: it is peace, and it stays.
    if (this.peace || live.length < 2 || !live.every((man) => man.sat) || !live.some((man) => man.team) || live.every((man) => man.team)) return
    this.peace = true
    for (const one of this.picnics) this.heart(one.x, one.y + 0.6, one.z, 8)
  }
  /**
   * It moves by (dx, dz), as far as there is a step to take: across first, then along, so that it slides by what is in
   * its way.
   * @param jump how far down it may go: nobody is pushed off a wall, though one who is walking may jump off it
   */
  private shift(man: Soldier, dx: number, dz: number, jump = STEP) {
    for (const [i, j] of [[dx, 0], [0, dz]]) {
      const from = spot(man.x, man.z)
      const to = spot(man.x + i, man.z + j)
      if (to !== from && !this.pass(from, to, jump)) continue
      man.x += i
      man.z += j
    }
  }
  /** It takes a step down one of the ways: to whichever tile next to it is nearest to where the way leads. */
  private walk(man: Soldier, way: Uint16Array, dt: number) {
    const t = spot(man.x, man.z)
    let to = t
    for (const [i, j] of RING) {
      const n = t + i + j * N
      // (Across a corner only where both ways round it are open: nobody cuts through the corner of a wall.)
      if (way[n] < way[to] && this.pass(t, n) && (!i || !j || (this.pass(t, t + i) && this.pass(t, t + j * N) && this.pass(t + i, n) && this.pass(t + j * N, n)))) to = n
    }
    if (to === t) return void (man.stride = 0)
    this.step(man, across(to) + man.ox, along(to) + man.oz, dt)
  }
  /** It takes a step straight towards (x, z). */
  private step(man: Soldier, x: number, z: number, dt: number) {
    const [dx, dz, from] = [x - man.x, z - man.z, [man.x, man.z]]
    const far = Math.hypot(dx, dz) || 1
    const go = Math.min(far, PACE[man.kind] * dt)
    man.turn = turned(dx, dz)
    this.shift(man, (dx / far) * go, (dz / far) * go, DROP)
    man.vx = (man.x - from[0]) / dt
    man.vz = (man.z - from[1]) / dt
    man.stride += go * 1.5
  }

  /** The nearest of `foes` that is within reach: not counting those at a picnic, whom nobody touches. */
  private nearest(man: Soldier, foes: Soldier[], within: number, level = Infinity) {
    let found: Soldier | undefined
    for (const foe of foes) {
      const far = Math.hypot(foe.x - man.x, foe.z - man.z)
      if (foe.hp <= 0 || foe.seat || far >= within || Math.abs(foe.y - man.y) > level) continue
      within = far
      found = foe
    }
    return found
  }
  /** A blow at something at (x, z), if it is ready for one. */
  private strike(man: Soldier, x: number, z: number, blow: () => void) {
    man.turn = turned(x - man.x, z - man.z)
    man.stride = 0
    if (man.wait > 0) return
    man.wait = SWING * (0.9 + Math.random() * 0.3)
    man.swing = 0.2
    blow()
  }
  /**
   * Whether an arrow from it to (x, y, z), so long in the air, would get there, with nothing of the land or the castle
   * in its way.
   * @param but a tile that is not in the way: the one that is aimed at, when it is a piece of the castle
   */
  private clear(man: Soldier, x: number, y: number, z: number, time: number, but = -1) {
    const up = (y - man.y - 1) / time + (PULL * time) / 2
    // Looked at every third of a tile of the way: the lip of a step is narrow, and an arrow that grazes it stops there.
    const n = Math.ceil(Math.hypot(x - man.x, z - man.z) / 0.3)
    for (let k = 1; k < n; k++) {
      const s = (k / n) * time
      const t = spot(man.x + ((x - man.x) * k) / n, man.z + ((z - man.z) * k) / n)
      if (t !== but && man.y + 0.9 + up * s - (PULL * s * s) / 2 < this.roof[t]) return false
    }
    return true
  }
  /** It lets an arrow go at (x, y, z), a little ahead of something going at (vx, vz), and not quite truly. */
  private loose(man: Soldier, x: number, y: number, z: number, vx = 0, vz = 0, lob = 1) {
    const far = Math.hypot(x - man.x, z - man.z)
    const time = flight(far, lob)
    const wide = 0.2 + far * 0.035
    // Where it will be by then, and how high the ground is there: somebody on the way up the hill has got higher.
    x += vx * time
    z += vz * time
    const ground = this.stand[spot(x, z)]
    if ((vx || vz) && ground >= 0) y = ground + 0.7
    this.next = (this.next + 1) % this.shots.length
    Object.assign(this.shots[this.next], {
      x: man.x,
      y: man.y + 1,
      z: man.z,
      vx: (x + any() * 2 * wide - man.x) / time,
      vy: (y - man.y - 1) / time + (PULL * time) / 2,
      vz: (z + any() * 2 * wide - man.z) / time,
      team: man.team,
      fly: true,
      rest: 0,
    })
    man.turn = turned(x - man.x, z - man.z)
    man.wait = RELOAD * (0.85 + Math.random() * 0.3)
    for (const c of man.cubes) this.solid.poke(c, 3)
  }

  /** It is hit. Hit often enough, it pops: every part of it flies off as a loose cube, and that is the end of it. */
  private hurt(man: Soldier) {
    if (man.hp <= 0) return
    man.hp--
    const wear = WEAR[man.team]
    for (const c of man.cubes) this.solid.poke(c, 9)
    if (man.hp > 0) {
      for (let k = 0; k < 4; k++) this.toss(man.x + any() * 0.3, man.y + 0.7, man.z + any() * 0.3, 5, 2 + Math.random() * 2, 0.1, wear, 0.5)
      return
    }
    const [a, b, c, d] = TURNS[man.turn]
    man.parts.forEach(([dx, dy, dz, sx, sy, , ink], k) => {
      this.toss(man.x + a * dx + b * dz, man.y + dy + sy / 2, man.z + c * dx + d * dz, 8, 3 + Math.random() * 4, Math.min(0.34, (sx + sy) / 2), ink === 'tunic' ? wear : INK[ink], 0.9 + Math.random() * 0.4)
      this.solid.hide(man.cubes[k])
    })
    this.spare[man.kind].push(man.cubes)
    // What it had it has no more: its place at a picnic, and the cat, which sits down where it is.
    if (man.seat) man.seat[0].taken[man.seat[1]] = undefined
    if (this.cat.by === man) this.letGo()
  }
  /** A piece of the castle is as high as its highest course: so is whoever stands on it, and so is what an arrow meets. */
  private settle(piece: Piece) {
    const deck = piece.courses[0]?.top ?? 0
    for (const t of piece.tiles) {
      this.roof[t] = TOP + deck
      this.stand[t] = piece.shut && deck ? -1 : TOP + deck
    }
    // What stands on top of it comes down as it does: the keep's flag flies from wherever the top of the keep is now.
    for (const { cube, rise = 0 } of piece.crown) {
      const [x, , z] = this.solid.at(cube)
      this.solid.place(cube, x, TOP + deck + rise, z)
      if (rise > 1) this.solid.bendy(cube, 0.6, TOP + deck + rise - 0.22, 0, 0)
    }
  }
  /** A cube of the castle comes off: it is gone from where it was, and loose cubes of its colour fly from there and fall. */
  private loosen(stone?: Stone) {
    if (!stone) return
    const [x, y, z, sx, sy, sz] = this.solid.at(stone.cube)
    const n = Math.max(1, Math.min(5, Math.round(sx * sy * sz * 10)))
    for (let k = 0; k < n; k++) this.toss(x + any() * sx * 0.7, y + any() * sy * 0.7, z + any() * sz * 0.7, 6, 1 + Math.random() * 3.5, Math.min(0.36, Math.max(0.09, Math.cbrt((sx * sy * sz) / n))), stone.ink, 0.9 + Math.random() * 0.7)
    this.solid.hide(stone.cube)
  }
  /**
   * A piece of the castle is struck, at (x, y, z). The blow goes to one of its teeth while it has any, the nearest one,
   * and after that to its highest course. A blow that does not bring that down takes one of the small things off its
   * face; the blow that does brings all of it down, and the piece is that much lower: for whoever stands on it, and for
   * whoever would climb over what is left. Nothing is left in the air: what is on top goes first, and what was held up
   * by something that has gone falls.
   */
  private chip(piece: Piece, x: number, y: number, z: number) {
    const { solid } = this
    const far = (one: Course) => Math.hypot(solid.at(one.stones[0].cube)[0] - x, solid.at(one.stones[0].cube)[2] - z)
    const among = piece.teeth.length ? piece.teeth : piece.courses
    const part = piece.teeth.length ? among.reduce((a, b) => (far(b) < far(a) ? b : a)) : among[0]
    if (!part) return
    part.hp--
    for (let k = 0; k < 3; k++) this.toss(x + any() * 0.3, y + any() * 0.3, z + any() * 0.3, 5, 1 + Math.random() * 2, 0.11, part.stones[0].ink, 0.6)
    for (const { cube } of part.stones) solid.poke(cube, 2.5)
    if (part.hp > 0) return this.loosen(part.bits.pop())
    for (const stone of [...part.stones, ...part.bits]) this.loosen(stone)
    among.splice(among.indexOf(part), 1)
    if (among !== piece.teeth) this.lower(piece)
  }
  /** A piece of the castle has lost a course: it is lower, and with none left it is gone. What it held up comes down. */
  private lower(piece: Piece) {
    this.settle(piece)
    this.think = 0 // there may be a way over it now, or through
    if (!piece.courses.length) {
      for (const t of piece.tiles) this.on[t] = undefined
      for (const stone of piece.crown.splice(0)) this.loosen(stone)
      this.pieces.splice(this.pieces.indexOf(piece), 1)
      thump()
    }
    // The stretch of wall over the gate is held up by the walls on either side of it. When neither reaches up to it any
    // more it falls, and so does what is left of the door, which hung in it.
    if (!this.arch.length || [at(-1, YARD), at(1, YARD)].some((t) => this.roof[t] > TOP + WALL - 0.75)) return
    for (const stone of this.arch.splice(0)) this.loosen(stone)
    const gate = this.on[GATE]
    if (!gate) return
    for (const part of gate.courses.splice(0)) for (const stone of [...part.stones, ...part.bits]) this.loosen(stone)
    this.lower(gate)
  }
  /**
   * The castle puts itself together again: every stone of it comes back, the lowest first, the way it was built. Its
   * flag is the colour of whoever has it now. And nobody is left standing in a wall: whoever is where one has come up
   * steps out of it.
   */
  private rebuild() {
    const { solid } = this
    this.pieces.length = 0
    this.arch = [...this.whole]
    for (const piece of this.built) {
      Object.assign(piece, { teeth: [...piece.all.teeth], courses: [...piece.all.courses], crown: [...piece.all.crown] })
      for (const part of [...piece.teeth, ...piece.courses]) {
        part.hp = part.full
        part.bits = [...part.all]
      }
      this.pieces.push(piece)
      for (const t of piece.tiles) this.on[t] = piece
      this.settle(piece)
    }
    for (const { cube } of [...this.arch, ...this.built.flatMap((piece) => [...piece.crown, ...[...piece.teeth, ...piece.courses].flatMap((part) => [...part.stones, ...part.bits])])]) solid.show(cube, 0.1 + (solid.at(cube)[1] - TOP) * 0.4 + Math.random() * 0.2)
    solid.paint(this.flag.cube, WEAR[this.owner])
    for (const man of this.men) {
      const t = spot(man.x, man.z)
      const out = this.on[t] || t === GATE ? this.near(man.x, man.z, (tile) => this.open(tile), 3) : undefined
      if (out !== undefined) [man.x, man.z] = [across(out) + man.ox, along(out) + man.oz]
    }
    this.think = 0
    thump()
  }
  /** The cat is put down, or dropped: it sits where it is, for whoever comes next. */
  private letGo() {
    const { cat } = this
    if (cat.by) [cat.x, cat.z] = [cat.by.x, cat.by.z]
    cat.by = undefined
    cat.settled = true
    this.think = 0
  }
  /**
   * The cat is home: somebody has carried it to the top of the hill. It goes back up on the keep, and the castle puts
   * itself together round it. If it was not one of the castle's who brought it, the castle has changed hands: it is
   * that colour's now, and everybody is for it or against it accordingly.
   */
  private homecoming(by: Soldier) {
    const { cat } = this
    this.heart(cat.x, cat.y + 0.3, cat.z, 6)
    cat.by = undefined
    cat.loose = cat.settled = false
    if (by.team !== this.owner) {
      this.owner = by.team
      this.owners++
      for (const man of this.men) man.movein = man.home = man.team === this.owner
    }
    this.rebuild()
  }

  /**
   * What one soldier has to do this moment, and does.
   * @returns false when there is nothing
   */
  private duty(man: Soldier, foes: Soldier[], dt: number): boolean {
    const { cat } = this
    const t = spot(man.x, man.z)
    man.wait -= dt
    man.swing -= dt
    man.wave -= dt
    man.vx = man.vz = 0
    // A picnic comes before everything. With a place at one, it goes and sits down there, and that is that. (If it
    // cannot get to its place for the crowd, it sits down where it has got to.)
    if (man.seat) {
      const [picnic, k] = man.seat
      const [x, z] = picnic.seats[k]
      const far = Math.hypot(x - man.x, z - man.z)
      if (!man.sat && far > 0.1 && (man.idle += dt) < 8) {
        if (far > 2.2 && this.toPicnic[t] < FAR) this.walk(man, this.toPicnic, dt)
        else this.step(man, x, z, dt)
      } else {
        man.sat = true
        man.mood = 'sit'
        man.stride = 0
        man.turn = turned(picnic.x - man.x, picnic.z - man.z)
      }
      return true
    }
    // With one near that has room, it drops what it was doing (the cat, if it had the cat) and takes a place at it: the
    // nearest there is.
    if (this.toPicnic[t] <= (this.peace ? FAR - 1 : APPEAL)) {
      const far = (x: number, z: number) => Math.hypot(x - man.x, z - man.z)
      const picnic = this.picnics.filter((one) => one.landed && one.seats.some((_, k) => !one.taken[k])).sort((a, b) => far(a.x, a.z) - far(b.x, b.z))[0]
      const k = picnic ? picnic.seats.reduce((best, [x, z], k) => (!picnic.taken[k] && (best < 0 || far(x, z) < far(picnic.seats[best][0], picnic.seats[best][1])) ? k : best), -1) : -1
      if (picnic && k >= 0) {
        if (cat.by === man) this.letGo()
        picnic.taken[k] = man
        man.seat = [picnic, k]
        man.idle = 0
        this.think = 0
        return true
      }
    }
    if (this.peace) return false
    // A sheep is patted for as long as that takes.
    if ((man.pat -= dt) > 0) return true
    // With the cat in its arms it has no hand free: it goes home with it, which is the top of the hill.
    if (cat.by === man) {
      if (this.toTop[t]) this.walk(man, this.toTop, dt)
      else this.homecoming(man)
      return true
    }
    // The cat is sitting right here, and nobody has it: it is picked up.
    if (cat.loose && cat.settled && !cat.by && Math.hypot(cat.x - man.x, cat.z - man.z) < 0.8 && Math.abs(cat.y - man.y) < 1.2) {
      cat.by = man
      this.think = 0
      return true
    }
    // A sheep is right here that it has not patted yet, and nobody near to mind: it stops, and pats it.
    const sheep = this.sheep.findIndex((one, k) => !(man.patted & (1 << k)) && Math.hypot(one.x - man.x, one.z - man.z) < 0.95 && Math.abs(one.y - man.y) < 0.8)
    if (sheep >= 0 && !this.nearest(man, foes, 3)) {
      const one = this.sheep[sheep]
      man.patted |= 1 << sheep
      man.pat = 1
      man.stride = 0
      man.turn = turned(one.x - man.x, one.z - man.z)
      one.hop = 0.7
      this.heart(one.x, one.y + 0.5, one.z)
      return true
    }
    if (man.kind === 'sword') {
      const foe = this.nearest(man, foes, 1.1, 1.3)
      if (foe) return this.strike(man, foe.x, foe.z, () => this.hurt(foe)), true
      // Nobody within reach. The cat, when it is off the keep: whoever has it is gone after, by the other colour, and
      // kept up with, by its own; and when nobody has it, it is gone for.
      if (this.toCat[t] < FAR && (cat.by?.team !== man.team || this.toCat[t] > 2)) return this.walk(man, this.toCat, dt), true
      // Otherwise the castle's go for whoever has come near; those against it for whoever of the castle is near, and
      // else for the castle.
      const way = this.toTeam[1 - man.team]
      const heed = man.home ? ALERT : this.toCastle[t] < FAR ? NOTICE : FAR - 1 // (with no castle to go for, anybody at all)
      if (way[t] <= heed) return this.walk(man, way, dt), true
      if (man.home || this.toCastle[t] === FAR) return false
      if (this.toCastle[t]) return this.walk(man, this.toCastle, dt), true
      // At the castle, and nobody to get at: it hacks at what it has come to.
      const beside = NEAR.map(([i, j]) => t + i + j * N).find((n) => this.marks.has(this.on[n] as Piece))
      if (beside === undefined) return false
      const [x, z] = [across(beside), along(beside)]
      return this.strike(man, x, z, () => this.chip(this.on[beside] as Piece, (man.x + x) / 2, man.y + 0.7, (man.z + z) / 2)), true
    }
    // An archer. One of the castle's stays where it is, and has nothing to do between two arrows.
    if (man.home && man.wait > 0) return false
    let mark: Soldier | undefined
    let best = Infinity
    let lob = 1
    for (const foe of foes) {
      const far = Math.hypot(foe.x - man.x, foe.z - man.z)
      // (Whoever has the cat first of all; and for the castle's, the swordsmen before the archers.)
      const rank = far + (man.home && foe.kind === 'archer' ? 100 : 0) - (cat.by === foe ? 200 : 0)
      if (foe.hp <= 0 || foe.seat || rank >= best || far > RANGE + 0.35 * (man.y - foe.y)) continue
      // The castle's do not shoot at their own walls: where a flat shot would not get there they send one high, over
      // the wall (and so can somebody down in the yard, or right above the gate); and where that would not either, none.
      const how = man.home ? [1, 1.9].find((high) => this.clear(man, foe.x, foe.y + 0.7, foe.z, flight(far, high))) : 1
      if (!how) continue
      mark = foe
      best = rank
      lob = how
    }
    if (mark) {
      man.stride = 0
      man.turn = turned(mark.x - man.x, mark.z - man.z)
      if (man.wait <= 0) this.loose(man, mark.x, mark.y + 0.7, mark.z, mark.vx, mark.vz, lob)
      return true
    }
    if (man.home) return false
    // Against the castle, and nobody in range. With the cat off the keep, it goes where the cat is. Otherwise the
    // castle itself, the nearest of it that an arrow would get to; or nearer, until there is some. (What is left of a
    // wall is low, and from the foot of the hill the hill is in the way.)
    if (cat.loose) return this.toCat[t] > 3 && this.toCat[t] < FAR ? (this.walk(man, this.toCat, dt), true) : false
    let tile = -1
    best = Infinity
    for (const piece of this.pieces)
      for (const p of piece.tiles) {
        const far = Math.hypot(across(p) - man.x, along(p) - man.z)
        if (far >= best || far > RANGE + 0.35 * (man.y - this.roof[p]) || !this.clear(man, across(p), this.roof[p] - 0.3, along(p), flight(far), p)) continue
        tile = p
        best = far
      }
    if (tile < 0) return this.toCastle[t] < FAR ? (this.walk(man, this.toCastle, dt), true) : false
    man.stride = 0
    man.turn = turned(across(tile) - man.x, along(tile) - man.z)
    if (man.wait <= 0) this.loose(man, across(tile), this.roof[tile] - 0.3, along(tile))
    return true
  }
  /**
   * It has nothing to do. After a while it finds itself something: the water's edge to fish from, a tree to sleep
   * under, or just the ground to sit on. (Each has its own idea of a good time, and its own patience.) Somebody whose
   * colour has just come by the castle goes up to it first.
   */
  private laze(man: Soldier, dt: number) {
    const t = spot(man.x, man.z)
    man.stride = 0
    if ((man.idle += dt) < DAWDLE + (man.ox + 0.25) * 4) return
    if (man.movein && this.toTop[t] && this.toTop[t] < FAR) return this.walk(man, this.toTop, dt)
    man.movein = false
    if (!man.mood) {
      const [way, what] = man.oz > 0 ? ([this.toBank, 'fish'] as const) : ([this.toShade, 'nap'] as const)
      if (this.on[t] || this.peace || way[t] > STROLL || man.idle > 14) man.mood = 'sit' // (or it has been trying to get there too long: a sheep is in the way)
      else if (way[t]) return this.walk(man, way, dt)
      else man.mood = what
    }
    const water = man.mood === 'fish' ? NEAR.find(([i, j]) => WET.has(t + i + j * N)) : undefined
    if (water) man.turn = turned(water[0], water[1])
    if ((man.beat -= dt) > 0) return
    man.beat = 1.6 + Math.random() * 1.6
    // Asleep, it snores: a small white puff goes up. Fishing, there is a ring on the water; and now and then a fish,
    // which comes out, is looked at, and goes back in.
    if (man.mood === 'nap') this.bits.spawn(man.x, man.y + 0.5, man.z, any() * 0.2, 0.5, any() * 0.2, 0.09, 0xffffff, 1.3, NEVER, 0, -0.3)
    if (!water) return
    const [x, z] = [across(t) + water[0] * 0.75, along(t) + water[1] * 0.75]
    for (let k = 0; k < 3; k++) this.bits.spawn(x + any() * 0.3, man.y - 0.05, z + any() * 0.3, any() * 0.8, 1 + Math.random(), any() * 0.8, 0.07, 0xdff2ff, 0.5, man.y - 0.5, 0)
    if (Math.random() < 0.3) this.bits.spawn(x, man.y, z, -water[0] * 0.6, 4.2, -water[1] * 0.6, 0.16, 0xa9c4d6, 1, man.y - 0.5, 0)
  }

  /** The sheep: each eats where it is for a while, then ambles a tile on, and eats there. Patted, it hops. */
  private graze(dt: number) {
    for (const one of this.sheep) {
      one.hop -= dt
      const far = Math.hypot(one.tx - one.x, one.tz - one.z)
      if ((one.wait -= dt) > 0) {
        // (eating)
      } else if (far > 0.05) {
        const go = Math.min(far, 0.7 * dt)
        one.turn = turned(one.tx - one.x, one.tz - one.z)
        one.x += ((one.tx - one.x) / far) * go
        one.z += ((one.tz - one.z) / far) * go
        one.stride += go * 2.4
      } else {
        one.wait = 2 + Math.random() * 6
        const from = spot(one.x, one.z)
        const [i, j] = NEAR[Math.floor(Math.random() * 4)]
        const to = from + i + j * N
        if (this.pasture(to) && this.pass(from, to, STEP)) [one.tx, one.tz] = [across(to) + any() * 0.4, along(to) + any() * 0.4]
      }
      const floor = this.stand[spot(one.x, one.z)]
      if (floor >= 0) one.y += (floor - one.y) * Math.min(1, dt * 10)
      const lift = (one.hop > 0 ? Math.abs(Math.sin(one.hop * 14)) * 0.18 : 0) + Math.abs(Math.sin(one.stride * Math.PI)) * 0.05
      this.put(one, SHEEP, lift, '', one.wait > 0 && one.hop <= 0 ? ([dx, dy, dz, sx, sy, sz, ink], k) => (k ? [dx, dy, dz, sx, sy, sz, ink] : [dx, dy - 0.17, dz + 0.05, sx, sy, sz, ink]) : undefined)
    }
  }
  /** The ducks go round the pond, rising and falling with the water; faster when somebody wades in. */
  private paddle(dt: number) {
    for (const one of this.ducks) {
      one.hop -= dt
      one.a += dt * (this.men.some((man) => man.landed && Math.hypot(man.x - one.x, man.z - one.z) < 1.2) ? 1.1 : 0.22)
      const [x, z] = [10.5 + Math.sin(one.a) * 0.55, Math.cos(one.a) * 0.95]
      if (x !== one.x || z !== one.z) one.turn = turned(x - one.x, z - one.z)
      Object.assign(one, { x, z, y: 0.9 + 0.025 * Math.sin(this.time * 1.4 + x * 0.9 + z * 0.6) })
      this.put(one, DUCK, one.hop > 0 ? Math.abs(Math.sin(one.hop * 14)) * 0.12 : 0, '')
    }
  }
  /** The cat makes off: to a picnic if there is one, and else to some spot on the flat ground that has taken its fancy. */
  private flee() {
    const { cat } = this
    const far = (one: Picnic) => Math.hypot(one.x - cat.x, one.z - cat.z)
    const picnic = this.picnics.filter((one) => one.landed).sort((a, b) => far(a) - far(b))[0]
    Object.assign(cat, { loose: true, settled: false, by: undefined, tx: 0, tz: 12 })
    if (picnic) return void Object.assign(cat, { tx: picnic.x - 0.24, tz: picnic.z - 0.27 })
    for (let tries = 0; tries < 40; tries++) {
      const [a, r] = [Math.random() * Math.PI * 2, 11 + Math.random() * 3]
      const t = this.near(Math.sin(a) * r, Math.cos(a) * r, (tile) => this.pasture(tile) && land(across(tile), along(tile)) === 1, 2)
      if (t !== undefined) return void Object.assign(cat, { tx: across(t), tz: along(t) })
    }
  }
  /**
   * The cat. On the keep while there is a keep; off, when that comes down (and to a picnic, when there is peace or it
   * is sitting about anyway); and on the head of whoever has picked it up. It goes straight to where it is going, over
   * whatever is in the way.
   */
  private prowl(dt: number) {
    const { cat } = this
    cat.hop -= dt
    let lift = cat.hop > 0 ? Math.abs(Math.sin(cat.hop * 14)) * 0.15 : 0
    if (cat.by) Object.assign(cat, { x: cat.by.x, z: cat.by.z, y: cat.by.y + 1.22 + Math.abs(Math.sin(cat.by.stride * Math.PI)) * 0.14, turn: cat.by.turn })
    else {
      const picnic = this.picnics.find((one) => one.landed)
      if (cat.loose ? cat.settled && picnic && !this.picnics.some((one) => one.landed && Math.hypot(one.x - cat.x, one.z - cat.z) < 1.5) : !this.pieces.includes(this.keep) || this.peace) this.flee()
      const [x, z] = cat.loose ? [cat.tx, cat.tz] : [-0.1, -1.1]
      const far = Math.hypot(x - cat.x, z - cat.z)
      if (far > 0.05) {
        const go = Math.min(far, 7 * dt)
        cat.turn = turned(x - cat.x, z - cat.z)
        cat.x += ((x - cat.x) / far) * go
        cat.z += ((z - cat.z) / far) * go
        cat.stride += go * 1.6
        lift += Math.abs(Math.sin(cat.stride * Math.PI)) * 0.2
      } else if (cat.loose && !cat.settled) {
        cat.settled = true
        this.think = 0
      } else if (!cat.loose) cat.turn = 0
      const t = spot(cat.x, cat.z)
      cat.y += ((this.roof[t] ?? 0) + (WET.has(t) ? 0.5 : 0) - cat.y) * Math.min(1, dt * 14)
    }
    this.put(cat, CAT, lift, '')
  }

  /** The arrows: each flies until it meets somebody of the other colour, the castle, or the ground. */
  private fly(dt: number, teams: Soldier[][]) {
    this.shots.forEach((arrow, i) => {
      if (!arrow.fly && arrow.rest <= 0) return
      arrow.rest -= dt
      // In short steps, so that a fast one does not go through somebody between two frames.
      const steps = arrow.fly ? Math.ceil((Math.hypot(arrow.vx, arrow.vy, arrow.vz) * dt) / 0.25) : 0
      for (let k = 0; k < steps && arrow.fly; k++) {
        const h = dt / steps
        arrow.vy -= PULL * h
        arrow.x += arrow.vx * h
        arrow.y += arrow.vy * h
        arrow.z += arrow.vz * h
        // (It goes by anybody at a picnic.)
        const hit = teams[1 - arrow.team].find((man) => man.hp > 0 && !man.seat && (man.x - arrow.x) ** 2 + (man.y + 0.7 - arrow.y) ** 2 + (man.z - arrow.z) ** 2 < 0.2)
        const t = spot(arrow.x, arrow.z)
        const out = Math.max(Math.abs(arrow.x), Math.abs(arrow.z)) > REACH
        if (!hit && !out && arrow.y >= this.roof[t]) continue
        arrow.fly = false
        const piece = this.on[t]
        // (Behind the teeth of a wall, half of what comes is stopped by them, and wears them down.)
        const cover = hit && this.on[spot(hit.x, hit.z)]
        if (hit && cover && cover.teeth.length && Math.random() < 0.5) this.chip(cover, arrow.x, arrow.y, arrow.z)
        else if (hit) this.hurt(hit)
        else if (out) continue
        else if (!piece) arrow.rest = 1.2 // in the ground: it stays there a moment
        else if (arrow.team !== this.owner) this.chip(piece, arrow.x, arrow.y, arrow.z)
      }
      const size = arrow.fly ? 1 : Math.max(0, Math.min(1, arrow.rest * 4))
      _q.setFromUnitVectors(AHEAD, _v.set(arrow.vx, arrow.vy, arrow.vz).normalize())
      this.sticks.setMatrixAt(i, _m.compose(_v.set(arrow.x, arrow.y, arrow.z), _q, _s.set(0.07, 0.07, 0.8).multiplyScalar(size)))
      this.sticks.instanceMatrix.needsUpdate = true
    })
  }

  update(dt: number) {
    const { bits, men } = this
    this.time += dt
    if ((this.think -= dt) <= 0) this.plan()
    const teams = [0, 1].map((k) => men.filter((man) => man.landed && man.team === k))
    for (const man of men) {
      if (man.landed) {
        if (man.hp <= 0) continue
        // With something to do, it gets up and does it; with nothing, it finds itself something after a while.
        if (!this.duty(man, teams[1 - man.team], dt)) this.laze(man, dt)
        else if (!man.seat) [man.idle, man.mood] = [0, '']
        continue
      }
      man.vy -= 34 * dt
      man.y += man.vy * dt
      if (man.y <= man.floor) {
        // Down. It takes its colours, the ground gives a little dust, and it bounces once in its boots.
        man.y = man.floor
        man.landed = true
        man.parts.forEach(([, , , , , , ink], k) => {
          if (ink === 'tunic') this.solid.paint(man.cubes[k], WEAR[man.team])
          this.solid.poke(man.cubes[k], 7)
        })
        for (let k = 0; k < 7; k++) bits.spawn(man.x + any() * 0.5, man.y + 0.1, man.z + any() * 0.5, any() * 3, 1.5 + Math.random() * 2, any() * 3, 0.11, 0xe9e2d6, 0.5, man.y, 0.2)
        thump()
        this.think = 0
      }
      this.pose(man)
    }
    // Nobody stands in anybody: two that have come too close step apart. (One that has sat down stays where it is.)
    // ponytail: every pair is looked at, every frame (and so is every foe, by every soldier): nothing for the hundred or
    // so a field holds, 0.1 ms; a grid of who is where if it is ever to be thousands.
    for (let i = 0; i < men.length; i++)
      for (let j = i + 1; j < men.length; j++) {
        const [a, b] = [men[i], men[j]]
        const dx = b.x - a.x
        const dz = b.z - a.z
        if (Math.abs(dx) > 0.62 || Math.abs(dz) > 0.62 || !a.landed || !b.landed || a.hp <= 0 || b.hp <= 0 || Math.abs(a.y - b.y) > 1) continue
        const far = Math.hypot(dx, dz)
        if (far >= 0.62) continue
        const push = (0.62 - far) / 2 / (far || 1)
        if (!a.sat) this.shift(a, -(dx || 0.01) * push, -dz * push)
        if (!b.sat) this.shift(b, (dx || 0.01) * push, dz * push)
      }
    // And nobody stands in a sheep: they go round it.
    for (const one of this.sheep)
      for (const man of men) {
        const far = Math.hypot(man.x - one.x, man.z - one.z)
        if (far < 0.7 && far > 0 && man.landed && !man.sat && Math.abs(man.y - one.y) < 1) this.shift(man, ((man.x - one.x) / far) * (0.7 - far), ((man.z - one.z) / far) * (0.7 - far))
      }
    // Each stands at the height of what is under it: a step is taken at a hop, and who stood on what has fallen comes down.
    for (const man of men) {
      if (!man.landed || man.hp <= 0) continue
      const floor = this.stand[spot(man.x, man.z)]
      if (floor >= 0) man.floor = floor
      man.y += (man.floor - man.y) * Math.min(1, dt * 12)
      this.pose(man)
    }
    this.fly(dt, teams)
    for (let i = men.length - 1; i >= 0; i--) if (men[i].hp <= 0) men.splice(i, 1)
    this.graze(dt)
    this.paddle(dt)
    this.prowl(dt)
    // A picnic that has been let go comes down like anybody else.
    for (const one of this.picnics) {
      if (one.landed) continue
      one.vy -= 34 * dt
      one.y = Math.max(one.floor, one.y + one.vy * dt)
      one.landed = one.y === one.floor
      PICNIC.forEach(([dx, dy, dz, , sy], k) => this.solid.place(one.cubes[k], one.x + dx, one.y + dy + sy / 2, one.z + dz))
      if (!one.landed) continue
      for (let k = 0; k < 9; k++) bits.spawn(one.x + any() * 1.1, one.y + 0.1, one.z + any() * 1.1, any() * 3, 1.5 + Math.random() * 2, any() * 3, 0.11, 0xe9e2d6, 0.5, one.y, 0.2)
      thump()
      this.think = 0
    }
    // The stream going over its edges, as on the island: a string of drops right across each, and a little mist where it lands.
    for (const [x, top, z, foot] of this.falls) {
      for (let n = 0; n < 2; n++)
        if (Math.random() < dt * 6) {
          const out = 0.3 + Math.random() * 0.5
          bits.spawn(x, top - 0.1, z + any() * 0.9, out, 0, 0, 0.1 + Math.random() * 0.07, 0x9fd6ff, 1.6, foot, 0)
        }
      if (Math.random() < dt * 4) bits.spawn(x + 0.12, foot + 0.06, z + any() * 0.8, any() * 0.3, 0.25, any() * 0.3, 0.12, 0xffffff, 0.9, NEVER, 0, -0.15)
    }
    this.solid.wind.value.set(0.1, 0.05, this.time)
    this.wet.wind.value.set(0.025, 0, this.time)
    this.solid.update(dt)
    this.wet.update(dt)
    bits.update(dt)
  }
}
