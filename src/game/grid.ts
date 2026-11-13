// What the game and its isles share: the grid all the maps sit on, a few colours, and the shapes of an isle and a thing.
import type { Island } from './Island.ts'

export const W = 35
export const D = 34
export const X0 = -17.5 // where tile (0, 0) is: the first island sits centred on the origin
export const Z0 = -16.5
export const GROUND = 2 // height of the plain; every step up is one more
export const NEAR = [[1, 0], [-1, 0], [0, 1], [0, -1]]
export const RING = [...NEAR, [1, 1], [-1, 1], [1, -1], [-1, -1]]
export const NEVER = -99 // a floor no loose cube ever reaches

export const LEAF = [0x9bd873, 0x8fd16b, 0xbfe36a]
export const FRUIT = [0xa9de7c, 0x97d470, 0xc4e77e]
export const BLOSSOM = [0xffc2d9, 0xf78bb5, 0xffd9e6]
export const STONE = [0xb7b2ba, 0xa39eab, 0xc6c2c8]
export const WOOD = 0x9a7b62
export const BARK = 0x8a6d58
export const WATER = 0xbfe6ff
export const LAVA = 0xff7a2f

// A repeatable random number in 0..1 from an integer, so the world looks the same on every visit.
export const rnd = (n: number) => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
export const any = () => Math.random() - 0.5
export const tx = (tile: number) => (tile % W) + X0
export const tz = (tile: number) => Math.floor(tile / W) + Z0
export const tileAt = (x: number, z: number) => Math.round(x - X0) + Math.round(z - Z0) * W
/** The tile a step away, or -1 off the map. */
export const step = (tile: number, di: number, dj: number) => {
  const i = (tile % W) + di
  const j = Math.floor(tile / W) + dj
  return i < 0 || j < 0 || i >= W || j >= D ? -1 : i + j * W
}

export type Tree = 'oak' | 'old' | 'fruit' | 'pine' | 'palm' | 'shroom'

/** How an isle looks asleep and awake. */
export interface Look {
  dry: number[]
  /** Its ground once alive. Not always green: a beach turns golden. */
  green: number[]
  tuft: number
  /** Blades of grass a tile grows when it wakes. */
  tufts: number
  soil: number
  bed: number
  wet: number
  water?: number
  /** How many tiles from water the ground wakes. */
  reach: number
  /** Share of tiles that flower. */
  flowers: number
  petals: number[]
  tree: Tree
  /** What lies about on bare tiles: straw and reeds turn green, snow melts, pebbles stay. */
  dress?: 'straw' | 'reed' | 'snow' | 'pebble'
  /** The two colours of what lies about. */
  litter?: number[]
}

export interface Isle {
  name: string
  /** Where the top left of its map sits on the grid. */
  at: number[]
  /** One character per tile, north at the top. `.` ground, `T` tree, `b` bush, `o` rocks; the rest is the isle's own. */
  rows: string[]
  /** Steps up from the plain, a digit per tile; blank is none. */
  high?: string[]
  /**
   * Other maps of the same isle, each with heights of its own: the same things on the same coastline, laid out differently.
   * An island dealt from a seed gets one of them, or the first map. See `drawn`.
   */
  variants?: Pick<Isle, 'rows' | 'high'>[]
  /** Characters that are beds: lower tiles that carry water once it gets there. */
  beds: string
  /** Beds that carry lava instead. */
  lava?: string
  /** Beds that fill when it rains. */
  rainfed?: string
  /** Things that trade places with each other when the world is dealt anew from a seed number. */
  loose?: string
  /** Things worth finding: on a freshly dealt isle nothing tall may stand in front of them. */
  finds?: string
  look: Look
  /** Put whatever stands on a tile with one of the isle's own characters. */
  lay: (w: Island, tile: number, c: string) => void
  /** Called once all its tiles are laid: wire up things that belong together. */
  done?: (w: Island, s: number) => void
}

export interface Thing {
  /** Tile it stands on. */
  tile: number
  cubes: number[]
  /** Cubes that only appear once the thing comes to life. */
  grown: number[]
  /** Comes to life when its tile wakes. */
  auto: boolean
  /** Clicks left before it breaks. Undefined for things that cannot be broken. */
  hits?: number
  /** Stays in place when its clicks run out (the cloud rains instead of crumbling). */
  keep?: boolean
  /** Another thing that takes this one's clicks while it is still unbroken (thorns guard their tree). */
  guard?: number
  /** What to say about it when the player has been stuck for a while. */
  clue?: string
  /** A word shown next to the cursor when it rests on the thing. */
  tip?: string
  /** Still to be solved in some way other than breaking it (the fairy ring, the cactus). */
  todo?: boolean
  /** An animal asleep: it breathes little clouds, and the bell wakes it too. */
  sleeper?: boolean
  onHit?: (left: number) => void
  onBreak?: () => void
  /** A click when there is nothing left to break. */
  tap?: () => void
  /** A click on something that is only there to be played with (a swing, a mushroom that bounces): it counts for nothing and is not kept. */
  play?: () => void
  /** How far it bends in the wind, once it is alive: for trees. */
  give?: number
  /** What the game says when the player will not leave it alone: at the sixth knock that does what the first did. */
  fuss?: string
  /** Anything more that happens when it comes to life. */
  wake?: () => void
  /** It rains on its isle. */
  rain?: () => void
  /** Where a bird can sit on it once it is alive: x, y and z. Once it is, also how it bends in the wind (how much, about which height, and from where). */
  perch?: number[]
  /** Cubes kept back for a later moment of its own (apples, once there are bees). */
  extra?: number[]
  up?: boolean
  /** The word for the noise it makes when knocked on. */
  sound?: string
  /** Something that grows on it is taken (a carrot is pulled). Gives the place it was, or nothing when there is none left. */
  pick?: () => number[] | undefined
  /** What each knock that does not break it does to it, in order: of these cubes, those that are there fall off and those that are not appear. Without it, it cracks. */
  marks?: number[][]
  /** How many knocks have left their mark, and the cracks they left. */
  dented?: number
  dents?: number[]
  /** What it goes by in a saved game: its place on the map, or a name of its own when that is not the same twice. */
  key?: string
  /** The thing to begin with: until something has been found it stirs every few seconds, to show where. */
  start?: boolean
  /** It has gone to pieces, or been taken apart: what stood here does not any more. */
  spent?: boolean
}

const TALL = 'TXOI' // trees, the windmill, the old tree, the stacked stones: what can stand in the way of a view
const SAILS = [[-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] // the tiles the sails of a windmill ('X') turn over, and those right in front of them
const HIGH = 'TNIO' // what would stand up into them: a tree, the nest on its trunk, the stacked stones

/** Which of an isle's maps an island has, with the heights that go with it. Island 0 has the first of each; the others one or another, by their number. */
export const drawn = (isle: Isle, seed: number): Pick<Isle, 'rows' | 'high'> => {
  const maps = [isle, ...(isle.variants ?? [])]
  return maps[seed ? Math.floor(rnd(seed * 53 + isle.at[0] * 7 + isle.at[1] * 3 + 11) * maps.length) : 0]
}

/** An isle's map with its loose things dealt out afresh over the places they stood on. Seed 0 is the map as drawn. */
export function deal(isle: Isle, seed: number) {
  const { rows: map } = drawn(isle, seed)
  const slots: number[][] = []
  map.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (isle.loose?.includes(row[i])) slots.push([i, j])
  })
  for (let attempt = 0; seed && attempt < 60; attempt++) {
    const hand = slots.map(([i, j]) => map[j][i])
    for (let k = hand.length - 1; k > 0; k--) {
      const n = Math.floor(rnd(seed * 7919 + isle.at[0] * 131 + isle.at[1] * 17 + attempt * 977 + k) * (k + 1))
      ;[hand[k], hand[n]] = [hand[n], hand[k]]
    }
    const rows = map.map((row) => [...row])
    slots.forEach(([i, j], k) => (rows[j][i] = hand[k]))
    // Nothing worth finding may end up right behind something tall, seen from the south where the camera starts.
    const hidden = rows.some((row, j) => row.some((c, i) => TALL.includes(c) && [[-1, -1], [0, -1], [1, -1], [1, -2], [2, -3]].some(([di, dj]) => isle.finds?.includes(rows[j + dj]?.[i + di] ?? ' '))))
    // And the sails of a windmill want room to turn in, and to be seen turning.
    const crowded = rows.some((row, j) => row.some((c, i) => c === 'X' && SAILS.some(([di, dj]) => HIGH.includes(rows[j + dj]?.[i + di] ?? ' '))))
    // And a well ('W') stands where no river, spring or pond will have reached by the time it fills. Bringing water to
    // where there was none is what a well is for: with the ground round it green already, it would have nothing to do.
    const soaked = rows.some((row, j) => row.some((c, i) => c === 'W' && rows.some((other, v) => other.some((d, u) => 'rSp'.includes(d) && Math.hypot(u - i, v - j) < 4))))
    if (!hidden && !crowded && !soaked) return rows.map((row) => row.join(''))
  }
  return map
}
