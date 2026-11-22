import {
  CircleGeometry, Color, DirectionalLight, Group, HemisphereLight, Mesh, MeshStandardMaterial, Plane, PointLight, Raycaster, ShadowMaterial, SpotLight, Vector2, Vector3,
  type Light, type PerspectiveCamera, type Scene,
} from 'three'
import { Butterflies } from './Butterflies.ts'
import { mute, note, thump } from '../../sound.ts'
import { Critters, type Critter } from './critters.ts'
import { combos } from './combos.ts'
import { Bits, Cubes, blown } from '../cubes.ts'
import { POINTER } from '../basics.ts'
import { BARK, BLOSSOM, D, FRUIT, GROUND, LAVA, LEAF, NEAR, NEVER, RING, STONE, W, WATER, WOOD, any, deal, drawn, rnd, shade, step, tileAt, tx, tz, type Isle, type Thing, type Tree } from './grid.ts'
import { beach, islet } from './isles/beach.ts'
import { garden } from './isles/garden.ts'
import { island } from './isles/island.ts'
import { meadow } from './isles/meadow.ts'
import { mountain } from './isles/mountain.ts'
import { snow } from './isles/snow.ts'
import { swamp } from './isles/swamp.ts'
import { newland, volcano } from './isles/volcano.ts'
import { hush, music } from './music.ts'
import { wishes, type Friend } from './wishes.ts'

// The world is a handful of isles. Only the first is there at the start; each of the others comes up
// out of the sea when the right thing is found on one that is already there. Every isle has its own file:
// its map, its look, and the things on it.
export const ISLES: Isle[] = [island, meadow, snow, mountain, swamp, beach, volcano, newland, garden, islet]

const PET = 1e6 // picked ids from here up are animals
const BEES = 0.25 // share of tiles that flower only once the bees are out
const FLOOR = new Plane(new Vector3(0, 1, 0), -GROUND)
// Where a game is kept between visits, one per island. A saved game is a list of knocks on things, each named by its isle,
// its letter on the map and its turn among those with that letter: so it survives an isle being moved or reshaped.
// The number goes up when that naming changes, and older games start over.
const STORE = 'wake-the-island/3/'
/** The saved game of an island is thrown away: it starts over. */
export const forget = (seed: number) => {
  try {
    localStorage.removeItem(STORE + seed)
    localStorage.removeItem(`${STORE}${seed}/notes`)
    localStorage.removeItem(`${STORE}${seed}/said`)
  } catch {
    // no storage, nothing to forget
  }
}
// What the animals say to a pat.
const VOICES: Record<string, string> = {
  bird: 'tweet', bunny: 'squeak', tortoise: 'hmm', duck: 'quack', chick: 'cheep', penguin: 'honk', beaver: 'chrr', frog: 'ribbit', crab: 'clack', mole: 'snf',
  snail: 'squish', balloon: 'whoosh', capybara: 'mm', axolotl: 'blip', bottle: 'clink', marmot: 'eep', goat: 'meh', dragon: 'rawr', fish: 'blub', owl: 'hoo', ghost: 'boo', bat: 'eek', eagle: 'kree', squirrel: 'chk', flock: 'tweet', sparrow: 'chirp', nestling: 'peep',
}
const DAYTIME = ['bird', 'bunny', 'tortoise', 'duck', 'chick', 'penguin', 'beaver', 'crab', 'mole', 'marmot', 'goat', 'dragon'] // who sleeps at night
const SMALL = ['bunny', 'chick', 'marmot'] // who makes off when a dragon comes over
const TILT = 0.72 // how steeply the camera looks down, from where it takes in the whole world
const STIR = 4.5 // how hard a thing still to be found stirs: about an eighth bigger for a moment (a knock is a quarter)
const BREATH = 2.4 // how long something found has the picture to itself before a word is said about it (seconds)
const STEP = 1.045 // how much too far in a view goes that is taken to look at something, before it steps back
const NEAREST = 11 // how near the camera may come to what it looks at
const ALONG = 26 // how far off it stays from something it is going along with: the bird on its way, the seeds on the wind
/**
 * The colour a plain patch of the picture has by the time it is on the screen. The last step of drawing presses the
 * colours together a little ("neutral" tone mapping, as three.js does it: this is the same sum). The page takes this
 * colour, so that nobody can tell where the picture ends and what is round it begins.
 * ponytail: where this sum lands on a half the graphics card may round the other way, and the two are then one level of
 * 255 apart in one channel, which nobody can see. Should it ever show: snap the picture's colour to a whole level first.
 */
const toned = ({ r, g, b }: Color) => {
  const low = Math.min(r, g, b)
  const off = low < 0.08 ? low - 6.25 * low * low : 0.04
  const peak = Math.max(r, g, b) - off
  const top = peak < 0.76 ? peak : 1 - 0.0576 / (peak - 0.52)
  const grey = 1 - 1 / (0.15 * (peak - top) + 1)
  const press = (v: number) => (((v - off) * top) / peak) * (1 - grey) + top * grey
  return _c.setRGB(press(r), press(g), press(b))
}
/**
 * A line that has been said, as the map's log keeps it: the line, who or what it is about (see `Island.say`), the tile
 * that is on (-1 for none: somebody who moves about is found by name), and the colour of the thing, as hex (or nothing).
 */
export type Said = [line: string, about: string, tile: number, color: string]
type About = [about: string, tile: number, color: string]
/** That, for whatever is being knocked on or patted right now, with what the thing looks like: its boxes. */
type Topic = [...About, boxes?: number[][]]
const NOBODY: About = ['', -1, '']
/**
 * How many seconds a line needs on the screen to be read, by somebody who is also watching an island: longer for a
 * longer one, within reason. (The pace has been set by ear, twice: first it was too fast, then, at 2.5 seconds and 0.42
 * a word, a bit too slow.)
 */
export const held = (text: string) => Math.min(11, Math.max(3.5, 2 + text.split(' ').length * 0.32))
/** And how many seconds longer a line stays when nothing is waiting to be said after it. */
export const LINGER = 4
// What the game says when it notices how it is being played. Each of them once, ever.
const NOTICED = {
  nothing5: 'Five knocks, and nothing. Some things are just things. This is one of them.',
  nothing10: 'Ten knocks on the same thing. It has not changed. Have you?',
  nothing20: 'Twenty. All right. It is not going to open. But it has never had this much attention, and it would like to say thanks.',
  ground: 'You keep poking the ground. It is ground. It was always going to be ground.',
  hammer: 'Easy. It is an island, not a lift button.',
  away: 'You went away for a bit. It is fine. The island does this when nobody is looking, too.',
  away2: 'Back again. Nothing fell apart without you. Try not to take that personally.',
  nudge: 'Third tip. No judgement. The button is right there. Somebody put it there.',
  stones: 'Ten stones. There is nothing down there to hit. That was never the point of stones.',
  night: 'It has been night for a while now. Some of them would like to get up. No rush. It is your night.',
  unturned: 'You have not turned the world round once. It has a back. Things are kept there.',
}
const FLOAT: Record<string, number> = { duck: 0.4, penguin: 0.18, beaver: 0.2, frog: 0.42, fish: 0.36, axolotl: 0.26 } // how high each swimmer rides
const CLOUD = [[0, 0, 0, 1.5], [1, -0.1, 0.2, 1.1], [-1, -0.15, -0.1, 1.0], [0.3, 0.6, -0.2, 0.9], [-0.4, 0.1, 0.7, 0.8]]
// Tree tops, as [x, y, z, width, height, depth, shade] measured from the top of the trunk. In every one of them the faces
// of two boxes are either well apart or well inside each other, so that nothing looks like it is clipping.
const CANOPIES = [
  [[0, 0.45, 0, 1.3, 1.1, 1.3, 0], [0.55, 0.1, 0.45, 0.8, 0.7, 0.8, 1], [-0.5, 1.0, -0.5, 0.7, 0.6, 0.7, 2]],
  [[0, 0.5, 0, 1.1, 1.3, 1.1, 0], [0.1, 1.3, 0.1, 0.6, 0.5, 0.6, 2], [-0.5, 0.3, 0.4, 0.7, 0.6, 0.7, 1]],
  [[0, 0.4, 0, 1.4, 0.9, 1.2, 0], [-0.15, 0.95, 0, 0.8, 0.5, 0.8, 1], [0.6, 0.35, 0.55, 0.5, 0.5, 0.5, 2]],
  [[-0.15, 0.4, 0.1, 1.1, 1.0, 1.1, 0], [0.45, 0.75, -0.25, 0.9, 0.8, 0.9, 1], [-0.6, 0.95, -0.4, 0.5, 0.4, 0.5, 2]],
]
// Where blossom comes out on the old tree, which has the first of those shapes: a few small flowers on the faces nothing
// else covers, all the way round and on top. Mostly white, with some of a deeper pink, like a cherry in spring. A lot
// for each of its three boxes (the big light one, the darker one low down, the pale one up top), each in colours that
// show against the pink behind them.
const FLOWERS: [spots: number[][], colors: number[]][] = [
  [[[0.25, 1.0, 0.3], [-0.45, 1.0, 0.1], [0.05, 1.0, -0.5], [-0.35, 0.6, 0.65], [0.4, 0.75, 0.65], [0.3, 0.5, -0.65], [0.65, 0.7, -0.2], [-0.65, 0.5, 0.35], [-0.65, 0.15, -0.3]], [0xffffff, 0xf27aa8, 0xffffff]],
  [[[0.95, 0.2, 0.3], [0.5, 0.05, 0.85]], [0xffffff, 0xffeaf2]],
  [[[-0.5, 1.3, -0.45], [-0.85, 1.0, -0.55]], [0xf27aa8, 0xffffff]],
]
// Where the apples hang on each of them: three spots, each in the middle of a face that nothing else covers.
const APPLES = [
  [[-0.3, 0.3, 0.65], [0.95, 0.15, 0.5], [-0.65, 0.35, 0.1]],
  [[0.55, 0.4, 0.2], [0.25, 0.7, 0.55], [-0.5, 0.25, 0.75]],
  [[-0.3, 0.35, 0.6], [0.85, 0.3, 0.55], [-0.7, 0.45, -0.1]],
  [[-0.2, 0.3, 0.65], [0.9, 0.7, -0.2], [-0.7, 0.3, 0.2]],
]

export interface GameState {
  /** 0..100: share of the land that is alive. */
  life: number
  found: number
  /** Things to find on the land there is so far. */
  total: number
  hint: string
  /** That line is up: it stays for as long as it takes to read and a little more, and then goes. */
  shown: boolean
  /** How many lines are waiting their turn behind it. */
  waiting: number
  /** The lines that have gone to the log without being said out loud, and have not been looked at there. */
  fresh: string[]
  /** Nothing has been found for a good while, though there is something to find. */
  stuck: boolean
  /** Which of the ways of getting about have been used, on this machine, ever: m for moving the view, z for zooming, t for turning the world. */
  known: string
  /** Where the things still to be found stand, on the land there is so far: their tiles. A tip about a thing no longer among them has been seen to. */
  left: number[]
  /** The tiles where a thing stood and nothing stands any more: a line about it leads nowhere now. */
  gone: number[]
  done: boolean
  /** What the cursor is resting on, in a word or two; empty over nothing in particular. */
  tip: string
  /** Clicks that counted, so far. */
  knocks: number
  /** Found and all there are: pairs of things that do something together. */
  combos: number[]
  /** Found and all there are: things nobody has to find. */
  secrets: number[]
  /** Found and all there are: snails, one hiding on each of the seven isles. */
  snails: number[]
  friends: Friend[]
  /** The isles as they stand on the map: what has been found on each, out of what there is. */
  isles: Place[]
  /** Every secret there is: found ones by name, the others by a riddle if a bottle has brought one, and all of them with a picture. */
  finds: Find[]
  /** The same for the combos, without pictures. */
  pairs: { name?: string; hint?: string }[]
  /** A few true things about how this island was played, for the card at the end. */
  notes: string[]
  /** What is being said out loud at the end, a line at a time; empty when nothing is. */
  /** The ending, while it rolls up over the picture like the credits of a film: what it says, a paragraph each. */
  credits: string[]
  /** How many seconds that roll takes, and how many times it has started: at every start the page rolls it from the top. */
  rolling: number
  rolled: number
  /** Everything that has been said so far, the latest last: each line once, with who or what it is about (see `Island.say`). The map has a page for it. */
  said: Said[]
  /** The end has been said, or cut short: the card may come up. */
  ended: boolean
  /** It was the player who cut it short: the card need not wait a breath first. */
  cut: boolean
}
/** One secret, for the map. */
export interface Find {
  /** Which picture goes with it. */
  icon: string
  name?: string
  hint?: string
}
/** One isle, for the map. */
export interface Place {
  id: string
  /** Where its middle is, in tiles from the north-west corner of the map. */
  x: number
  z: number
  /** Up out of the sea. */
  open: boolean
  /** 0..100: how much of it is alive. */
  life: number
  /** Things found on it and things there are, then the same for its secrets. */
  found: number[]
  secrets: number[]
  /** Its snail: undefined if it has none, otherwise whether it has been found. */
  snail?: boolean
}

const _c = new Color()
const _p = new Vector3()

/** The whole game: dry land that wakes up wherever water reaches, and more of it to find. */
const EDGE = 2.5 // the room, in tiles, the camera leaves round the action it follows: about as far as ground wakes beside water

/**
 * The view that keeps the action in the picture along with what the player is looking at. Nothing, if it is all in view already.
 * @param points where the action is: x and z of each place
 * @param look the point on the ground the player's own view is centred on
 * @param yaw which way the camera faces
 * @param own how far off the player's own view is
 * @param tan the tangent of half the camera's angle of view, top to bottom
 * @param aspect how much wider than high the screen is
 * @param pitch how steeply the camera looks down
 * @param words the share of the screen, at the bottom, that the words lie across
 * @returns x and z of the point to look at, and how far off to be: never nearer than the player's own view
 */
export function framed(points: number[][], look: number[], yaw: number, own: number, tan: number, aspect: number, pitch: number, words = 0) {
  if (!points.length) return
  // Across the screen and up it, along the ground: how far the action reaches from the middle of the player's view.
  const [ax, az, bx, bz] = [Math.cos(yaw), -Math.sin(yaw), -Math.sin(yaw), -Math.cos(yaw)]
  let [left, right, near, far] = [0, 0, 0, 0]
  for (const [x, z] of points) {
    const [a, b] = [(x - look[0]) * ax + (z - look[1]) * az, (x - look[0]) * bx + (z - look[1]) * bz]
    left = Math.min(left, a)
    right = Math.max(right, a)
    near = Math.min(near, b)
    far = Math.max(far, b)
  }
  // For every unit the camera is off, this much ground shows: to either side, towards the camera, and away from it.
  // More of it away than towards, since the camera looks down at a slant.
  const side = tan * aspect
  const front = (tan * (1 - words)) / (Math.sin(pitch) + tan * Math.cos(pitch))
  const back = (tan * (1 - words)) / (Math.sin(pitch) - tan * Math.cos(pitch))
  if (-left < own * side - EDGE && right < own * side - EDGE && -near < own * front - EDGE && far < own * back - EDGE) return
  const off = Math.max(own, ((right - left) / 2 + EDGE) / side, (far - near + 2 * EDGE) / (front + back))
  // Its middle: half way across the action, and as much nearer the camera as the slant asks for, so that what is furthest
  // off and what is nearest keep the same room.
  const [a, b] = [(left + right) / 2, (near + far) / 2 + (((far - near) / 2 + EDGE) * (front - back)) / (front + back)]
  return [look[0] + a * ax + b * bx, look[1] + a * az + b * bz, off]
}

export class Island {
  private group = new Group()
  readonly solid = new Cubes(16000, new MeshStandardMaterial({ roughness: 0.9 }), 'wind')
  readonly wet = new Cubes(800, new MeshStandardMaterial({ roughness: 0.15, transparent: true, opacity: 0.72 }), 'waves')
  readonly bits = new Bits(1600)
  readonly critters = new Critters()
  private butterflies = new Butterflies()
  private key = new DirectionalLight(0xffe9cf, 3.2)
  private sky = new HemisphereLight(0xe6efff, 0xffd9c4, 1.25)
  readonly things: Thing[] = []

  // Per tile.
  readonly mark: string[] = new Array(W * D).fill(' ')
  readonly isle = new Uint8Array(W * D)
  readonly exists = new Uint8Array(W * D)
  readonly h = new Float32Array(W * D) // height of its top
  readonly bed = new Uint8Array(W * D)
  readonly filled = new Uint8Array(W * D)
  readonly blocked = new Uint8Array(W * D)
  readonly alive = new Uint8Array(W * D)
  readonly wakeAt = new Float32Array(W * D).fill(Infinity)
  readonly cap = new Int32Array(W * D)
  readonly pool = new Int32Array(W * D).fill(-1) // its water, or its lava
  readonly lid = new Int32Array(W * D).fill(-1) // ice or turf over a bed
  private turf = new Uint8Array(W * D)
  private hot = new Uint8Array(W * D) // a bed for lava
  readonly standing: number[][] = Array.from({ length: W * D }, () => [])
  private dress: number[][] = Array.from({ length: W * D }, () => []) // straw, reeds, snow or pebbles lying on it
  private spots: number[][][] = [] // what grows on each tile and where: [x, z, half its width, its cubes...], from the middle of the tile

  // Per isle.
  readonly open = ISLES.map((_, s) => s === 0)
  readonly tiles: number[][] = ISLES.map(() => [])
  private asleep: number[][][] = ISLES.map(() => []) // [cube, tile] of everything that pops in when it rises
  readonly sleepers: Critter[][] = ISLES.map(() => []) // animals that turn up with it
  readonly quota = ISLES.map(() => 0) // things to find on it
  readonly awake = ISLES.map(() => 0) // tiles alive on it
  private foundOn = ISLES.map(() => 0) // things found on it

  time = 0
  /** Loose notes the isles keep between their things: is the river running, which well stands open. */
  readonly memo: Record<string, number> = {}
  /** Called for every tile that water or lava arrives in. */
  readonly onFill: ((tile: number) => void)[] = []
  /** Called every frame. */
  readonly ticks: ((dt: number, time: number) => void)[] = []
  readonly perches: number[][] = []
  readonly showers: number[][] = [] // where it rains: x, z, until
  private bees: number[] = []
  /** Seeds the flock still carries. */
  seeds = 0
  night = false
  private dusk = 0
  private ink?: string // the colour of the words, as last set: not yet, to begin with, so that the first frame sets it whatever was there before
  private glows: number[][] = []
  private drift?: { cubes: number[]; x: number; z: number; to: number[]; then?: () => void; busy: boolean }
  private falls: number[][] = [] // wherever water or lava goes over an edge: see `pour`
  private tick = 0
  private flows = 0
  private todo: { at: number; run: () => void }[] = []
  private lifeCount = 0
  private total = 0
  private found = 0
  private lastFind = 0
  private nudges = 0
  private hint = 'It has not rained here in a long time. Nobody is coming to fix it. Well. You came. Poke around.'
  private lines: string[] = [] // what is waiting to be said, in the order it will be
  private heard: Said[] = [] // everything that has been said on this island, the latest last: each line once, with who or what it is about
  private whose = new Map<string, About>() // who or what a line is about, from when it is said until it comes up
  private still = 0 // until when nothing new is said: something worth watching has just happened (`breath`)
  private early = new Map<string, Thing>() // the lines said about a thing while it was still to be found, and which thing
  private topic: Topic = NOBODY // who or what is being knocked on or patted right now: what that brings about is said about them
  private shooting?: Critter // the falling star
  private sketches = new Map<string, number[][]>() // what a thing that lines are about looks like, by the name it goes by in the log: its boxes
  private fresh: string[] = [] // the lines that went to the log without being said out loud, and have not been looked at there
  private stuck = false // nothing found for a good while, and there is something to find: the button for a tip says so
  private beckon = 6 // when the thing to start with stirs next, for as long as nothing has been found
  private twitch = 9 // when one of the things still to be found stirs next: any of them that is in the picture
  private far = 0 // how far off the camera stands to take in the whole world, as last worked out
  private spare = 0 // the share of the picture's height kept clear at the bottom for the line being said, on a narrow screen
  private view = [0, 0, 1] // where the camera really is: the player's own view, with whatever it is off looking at mixed in
  private until = 9 // when the line that is up has had its time, and the next may take its place
  private jump = -1 // while a click is being dealt with: how many lines it has brought about so far. Below 0 otherwise.
  private done = false
  private over = false
  private sent = ''
  private knocks = 0
  private extras = { combo: [0, 0], secret: [0, 0] } // found, and how many there are
  // Every secret and every combo: its riddle, whether a bottle has told it, its name once found; a secret also has a picture and a place.
  private finds: (Find & { riddle?: string; told?: boolean; at?: () => number[] | undefined })[] = []
  private pairs: { name?: string; riddle?: string; told?: boolean }[] = []
  private hive = [0, 0, 0, -99] // where the bees came out, and when
  private greeted = new Set<Critter>() // the snails that have been said hello to
  private hinted = new Set<Thing>() // the things a bottle has given a clue for
  private turns = new Map<string, number>() // how many things each letter of each isle's map has made so far
  private hid = ISLES.map(() => [0, 0]) // secrets found on each isle, and how many it has
  private laying = -1 // the isle being laid out, while the world is built
  private snailOn: (boolean | undefined)[] = ISLES.map(() => undefined)
  private snails = [0, 7]
  /** Which island this is: 0 as drawn, any other number dealt out afresh. */
  readonly seed: number
  /**
   * A repeatable random number for how the scenery looks: the shape and height of a tree, which way a rock lies, where grass
   * and flowers come up. The same on every visit to one island, different from island to island; island 0 is the world as drawn.
   */
  private chance = (n: number) => rnd(n + this.seed * 7919)
  private at = new Vector3() // where in the world the cursor points
  private aimed = false
  private outside = false // the cursor is on a button or a card: nothing in the world is under it
  private soft = new Set<number>() // cubes that lean away from the cursor: grass, flowers, straw and reeds
  private leaning = new Map<number, number[]>() // those that are leaning now: how far in x and z, how far they should, and the ground they stand on
  private touch = matchMedia('(pointer: coarse)').matches
  private lamps: Light[] = [] // the lights that only burn at night: the lighthouse, the fireflies
  // The few fireflies that carry a real light about: how each drifts, and when it goes out. Real lights are dear to draw.
  private fireflies = Array.from({ length: this.touch ? 3 : 6 }, () => ({ lamp: this.candle(), drift: new Vector3(), until: 0 }))
  // Where the view is being taken, to stay there: to a tip or a friend; (auto) in for a look at a thing just finished;
  // or (at) along with something on the move, until it is gone or its time is up.
  private going?: { x: number; z: number; zoom: number; at?: () => number[] | undefined; until?: number; past?: number }
  private following?: Critter
  private arrow?: Critter
  private pointing?: () => void
  private tune = 0
  /** Everyone there is to meet. */
  readonly friends: Friend[] = []
  /** Asked when something with nothing to break and no use of its own is knocked on. The first to say yes has dealt with it. */
  readonly onKnock: ((thing: Thing) => boolean)[] = []
  /** Called when night falls, and when it lifts. */
  readonly onNight: ((night: boolean) => void)[] = []
  /** Shows a word floating up from a place on the screen. The page sets it. */
  pop?: (word: string, x: number, y: number) => void
  // The saved game: what the player did and when. Putting it back is doing it all again, fast and without the show.
  private log: (string | number)[][] = []
  private store = ''
  private fast = false
  private stirred = 0 // when anything last filled, woke or rose
  private acts: Record<string, () => void> = {}

  private camera?: PerspectiveCamera
  private raycaster = new Raycaster()
  private ndc = new Vector2(2, 2)
  private yaw = -0.55
  private zoom = 1
  private pan = new Vector3() // where the view has been moved to, from the middle of the land
  private centre = new Vector3()
  private goal = new Vector3()
  private span = 0 // how far the land reaches from its middle
  private reach = 0
  private press?: { x: number; y: number; last: number; moved: boolean; turn: boolean; grab: Vector3 | null }
  private fingers = new Map<number, number[]>() // where each pointer is, to tell a pinch from a drag
  private keys = new Set<string>()
  private show?: { x: number; z: number; zoom: number; until: number; free?: boolean } // somewhere the camera has gone to look
  // Following the action. Where something set off by a knock is on the move right now (water or lava creeping along its bed,
  // the snowball, the freed bird, the frog's cloud and its rain), each place until a little after it was last seen there;
  // the animals that are part of it, and until when; the wider view that keeps it all in the picture; how far the camera has
  // gone over to that view; and whether the player has taken the view in hand, which ends the following until things settle.
  private action: number[][] = []
  private watched: [Critter, number][] = []
  private wide = { x: 0, z: 0, zoom: 1 }
  private widen = 0
  private mine = false
  private blend = 0 // how far it has gone there
  private pitch = TILT // how steeply the camera looks down right now
  /** 0 from where the whole world is in view, 1 right up close. */
  near = 0
  private paper = '' // the colour of the page, as last set
  // What the game has noticed about how it is being played. It is kept between visits, next to the game and apart from it:
  // knocks that came to nothing, pokes at the ground, pats by who got them, the longest the player left it alone (seconds),
  // whether the world was ever turned, nudges asked for, stones thrown, seconds played, how many of those it took to
  // wake the whole world, what has been said about any of it already, and when it was last written down.
  // And which ways of getting about have been used on this island (m for moving the view, z for zooming, t for
  // turning the world): the hint for each shows until then, on every new island, and not again on one come back to.
  private notes = { idle: 0, ground: 0, pats: {} as Record<string, number>, quiet: 0, turned: false, nudged: 0, stones: 0, played: 0, took: 0, said: [] as string[], seen: 0, known: '' }
  private unsaved = 0 // seconds since that was last written down
  private fussed = new Map<Thing, number>() // how often each thing has been knocked on to no purpose, or once too often
  private clicks: number[] = [] // when the last few clicks came, to tell hammering from knocking
  private input = 0 // when the player last moved at all, by the clock on the wall; 0 until they first do
  private nightFor = 0 // how long it has been night
  private reel?: { lines: string[]; seconds: number } // the ending, while it rolls: what it says and for how long
  private reels = 0 // how many times it has rolled: a click on the balloon rolls it again
  private ended = false // it has been said: the card may come up
  private hush?: () => void // cuts it short, while it rolls
  private cut = false // the player did: with a click on the picture or on the balloon, or the space bar
  private gust = 0 // how hard the wind blows: 0 until the windmill turns
  private abed = new Set<Critter>() // who has yawned and turned in
  /** Who is sitting on the tortoise, if anyone is. */
  seat?: Critter
  private seated = false // and whether it has got there yet
  private stone?: Critter // the one flat stone there is to skip
  private blooms: number[] = [] // the head of every flower: they shut at night
  private shaking = 0
  private orbit = 0 // until when the camera drifts round the finished world
  private hover = -1
  private label = ['', 9, 9, 0] as [string, number, number, number] // what the cursor last rested on, where it was then, and where the camera was
  private bg = new Color(0xeadcc2)
  private scene: Scene
  private canvas: Element // what the world is drawn on. The map has small canvases of its own, and those are not the world.
  private report: (state: GameState) => void

  /** @param seed 0 for the world as drawn; any other number deals the things on it out afresh, the same way every time */
  constructor(scene: Scene, canvas: Element, report: (state: GameState) => void, seed = 0) {
    this.scene = scene
    this.canvas = canvas
    this.report = report
    this.seed = seed
    const { solid, wet, key } = this
    this.critters.held = (c) => c.thing !== undefined && !!this.things[c.thing].hits // a thing with knocks left in it still has hold of whoever is in it

    ISLES.forEach((isle, s) => {
      this.laying = s
      const { high } = drawn(isle, seed)
      deal(isle, seed).forEach((row, j) => {
        for (let i = 0; i < row.length; i++) if (row[i] !== ' ') this.lay(isle.at[0] + i + (isle.at[1] + j) * W, row[i], s, Number(high?.[j]?.[i]) || 0)
      })
      isle.done?.(this, s)
    })
    this.laying = -1
    combos(this)
    wishes(this)
    this.hideSnails()
    this.rareVisitor()
    this.fallingStars()
    for (const tile of this.tiles[0]) this.exists[tile] = 1
    this.total = this.tiles[0].length
    this.surface(0, 0)
    this.fit()
    this.centre.copy(this.goal)
    this.span = this.reach

    key.castShadow = true
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.04
    this.shadows(0)
    Object.assign(key.shadow.camera, { near: 1, far: 120 })
    const floor = new Mesh(new CircleGeometry(300, 32), new ShadowMaterial({ color: 0x6d4a7a, opacity: 0.25 }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    wet.mesh.castShadow = false
    this.butterflies.mesh.scale.setScalar(0.28)
    this.group.add(solid.mesh, wet.mesh, this.bits.mesh, this.critters.mesh, this.butterflies.mesh, key, key.target, this.sky, floor)
    scene.add(this.group)
    scene.background = this.bg

    addEventListener('pointermove', this.onMove)
    addEventListener('pointerdown', this.onDown)
    addEventListener('pointerup', this.onUp)
    addEventListener('pointercancel', this.onUp)
    addEventListener('wheel', this.onWheel, { passive: false })
    addEventListener('contextmenu', this.onMenu)
    addEventListener('keydown', this.onKey)
    addEventListener('keyup', this.onKey)
    addEventListener('blur', this.onBlur)
    if (typeof window !== 'undefined' && import.meta.env.DEV) Object.assign(window, { island: this }) // to poke at from the console. There is no window when the tests play the game.
    this.store = STORE + seed
    try {
      Object.assign(this.notes, JSON.parse(localStorage.getItem(`${this.store}/notes`) ?? '{}'))
      // (A list from before the lines said who they were about is dropped: putting the game back makes a new one.)
      this.heard.push(...(JSON.parse(localStorage.getItem(`${this.store}/said`) ?? '[]') as unknown[]).filter((one): one is Said => Array.isArray(one)))
    } catch {
      // no storage, or nothing in it that makes sense: nothing has been noticed, or said, yet
    }
    if (!this.heard.length) this.heard.push([this.hint, ...NOBODY]) // the line it opens with
    try {
      const saved = JSON.parse(localStorage.getItem(this.store) ?? '[]') as (string | number)[][]
      if (saved.length) this.replay(saved)
    } catch {
      // no storage, or nothing in it that makes sense: a fresh start
    }
    this.assemble()
  }

  /** The world puts itself together: the ground from the middle outwards and from the bottom up, then what stands on it, then whoever lives there. */
  private assemble() {
    const late = (x: number, z: number) => 0.3 + Math.hypot(x - this.goal.x, z - this.goal.z) * 0.1
    for (const pool of [this.solid, this.wet])
      for (let i = 0; i < pool.count; i++) {
        const [x, y, z] = pool.at(i)
        pool.drop(i, late(x, z) + y * 0.04 + (pool.owner[i] >= 0 ? 0.35 : 0))
      }
    for (const c of this.critters.list) {
      if (c.hidden) continue
      c.hidden = true
      this.after(late(c.x, c.z) + 0.5, () => (c.hidden = false))
    }
    // Nothing drips, steams or glints over ground that is not there yet.
    this.bits.off = true
    this.after(late(this.goal.x + this.reach, this.goal.z) + 0.6, () => (this.bits.off = false))
  }

  /** The player did something worth remembering. */
  private record(kind: string, key: string) {
    if (this.fast) return
    this.log.push([Math.round(this.time * 10) / 10, kind, key])
    try {
      localStorage.setItem(this.store, JSON.stringify(this.log))
    } catch {
      // no storage: it will not be there next time, that is all
    }
  }
  /**
   * Something the player can do that has neither a thing nor an animal to its name (catching a falling star).
   * @returns what to call when it is done, so that it is remembered
   */
  act(name: string, run: () => void) {
    this.acts[name] = run
    return () => {
      this.record('a', name)
      run()
    }
  }
  /** The thing a saved game means by a name: of several (any tree of a kind will do), one that is of use right now. */
  private named(key: string) {
    const all = this.things.map((thing, t) => [thing, t] as const).filter(([thing]) => thing.key === key)
    return (all.find(([thing]) => thing.up || thing.hits || thing.tap) ?? all[0])?.[1]
  }
  /** Nothing is on its way: no timer running, no water creeping, no cloud drifting, nobody going anywhere on an errand. */
  private get quiet() {
    return !this.todo.length && this.time - this.stirred > 1.5 && !this.drift?.busy && this.critters.list.every((c) => !c.then)
  }
  /** A saved game is put back by doing everything in it again: the same knocks in the same order, with the waits between cut short. */
  private replay(saved: (string | number)[][]) {
    this.fast = this.bits.off = true
    mute(true)
    const wait = (most: number, least: number) => {
      const from = this.time
      while (this.time - from < most && (this.time - from < least || !this.quiet)) this.advance(0.05)
    }
    let last = 0
    for (const [at, kind, key] of saved) {
      // As long as it took then, give or take: at least long enough for an animal to come up with a wish, and no longer than things take to settle.
      wait(Math.min(Number(at) - last, 120), 8)
      last = Number(at)
      this.log.push([Math.round(this.time * 10) / 10, kind, key])
      if (kind === 'a') this.acts[key]?.()
      else if (kind === 'k') {
        const t = this.named(String(key))
        if (t !== undefined) this.strike(t)
      } else {
        const all = this.critters.list.filter((c) => (c.key ?? c.friend ?? c.kind) === key)
        const c = all.find((one) => !one.hidden) ?? all[0]
        const friend = this.friends.find((f) => f.id === key)
        if (c) this.pet(c)
        else if (friend) friend.patted = true
      }
    }
    wait(60, 8)
    this.solid.settle()
    this.wet.settle()
    this.fast = this.bits.off = false
    mute(false)
    this.centre.copy(this.goal)
    this.span = this.reach
    this.show = undefined
    this.orbit = this.shaking = 0
    this.lastFind = this.time
    this.beckon = this.time + 6
    if (!this.over) this.say(this.welcome)
  }

  dispose() {
    removeEventListener('pointermove', this.onMove)
    removeEventListener('pointerdown', this.onDown)
    removeEventListener('pointerup', this.onUp)
    removeEventListener('pointercancel', this.onUp)
    removeEventListener('wheel', this.onWheel)
    removeEventListener('contextmenu', this.onMenu)
    removeEventListener('keydown', this.onKey)
    removeEventListener('keyup', this.onKey)
    removeEventListener('blur', this.onBlur)
    this.scene.remove(this.group)
    this.scene.background = null
    for (const mesh of [this.solid.mesh, this.wet.mesh, this.bits.mesh, this.critters.mesh, this.butterflies.mesh]) mesh.dispose()
    document.body.style.cursor = ''
    document.documentElement.style.removeProperty('--ink')
    document.documentElement.style.removeProperty('--key') // or a game left at night would hand its light words on to the next
    hush()
  }

  /**
   * Something to say. Lines come up one at a time across the bottom of the picture, each for as long as it takes to
   * read; one that is said while another is up waits its turn. What a click brings about is said at once, in place of
   * whatever was up, and the line it replaces does not come back: it is in the log, with a dot on the journal's button
   * if it was cut off before it could be read.
   * Words in [square brackets] are the ones that name the thing a line is about: the page makes them stand out.
   * @param about who or what the line is about, for the log on the map: a friend by its name in the book ('beaver'), or
   * a word or two to go in front of it as they are ('tip', 'sign', 'windmill'). Left out, it is whoever or whatever is
   * being knocked on or patted just then, if anything is.
   * @param tile where that is, for the map to take the view there: left out, the tile of what is being knocked on
   * @param color and its colour, as hex: left out, that of what is being knocked on
   */
  say(text: string, about = this.topic[0], tile = this.topic[1], color = this.topic[2]) {
    this.tag(text, about, tile, color)
    // Said about a thing that is still to be found: a tip, or "one more push will tip it". Should such a line have to
    // wait, it is let go once the thing has been found (`moot`): by then it is the wrong way round.
    const open = tile < 0 ? undefined : this.things.find((thing) => thing.tile === tile && (thing.hits || thing.todo))
    if (open) this.early.set(text, open)
    else this.early.delete(text)
    if (this.fast) {
      // A game being put back does not talk its way through it: only the last thing said is left standing.
      this.keep(text)
      this.hint = text
      this.lines.length = 0
      this.until = 0
    } else if (this.jump === 0) {
      // The line that was up goes, and does not come back: whoever clicks on has moved on, and a line that turns up
      // again ten seconds later is about something long past. It is in the log all the same. Cut off before it could be
      // read (less than half its time), it counts as new there, and the journal's button shows a dot: unless what cuts
      // it off is news of the same thing or the same somebody, or it has lost its point anyway.
      const [was, where] = this.whose.get(this.hint) ?? NOBODY
      const same = (tile >= 0 && where === tile) || (about !== '' && was === about)
      if (!same && this.time < this.until - held(this.hint) / 2 && !this.moot(this.hint) && !this.fresh.includes(this.hint)) this.fresh.push(this.hint)
      if (this.time < this.still) {
        // What it is about is still happening (`breath`): the line that is up goes, and this one comes when the show is over.
        this.lines.unshift(text)
        this.until = Math.min(this.until, this.time - LINGER)
        this.jump++ // it stands first among those waiting: whatever else this click brings about goes in behind it
      } else this.voice(text)
    } else if (this.jump > 0) this.lines.splice(Math.min(this.jump - 1, this.lines.length), 0, text)
    else this.lines.push(text)
    if (this.jump >= 0) this.jump++
  }
  /**
   * Something has just happened that is worth watching: a thing found, a wish come true. The picture has a breath to
   * itself. (Not for a secret or a combo: nothing much moves for those.) Nothing new is said until it is over, and what this is about is said then: nobody has to choose
   * between reading the line and watching what it is about.
   */
  breath() {
    if (!this.fast) this.still = this.time + BREATH
  }
  /** A line is about somebody or something: the log will say who. What the thing looks like is kept for a picture of it. */
  private tag(text: string, about: string, tile: number, color: string) {
    this.whose.set(text, [about, tile, color])
    if (this.topic[3] && !this.sketches.has(about)) this.sketches.set(about, this.topic[3])
  }
  /**
   * Something worth knowing that is not said out loud: it goes straight into the log, and the button of the map shows
   * a dot. A wish is one: the bubble over the animal's head is how that is told, and a click on it says it.
   */
  whisper(text: string, about = this.topic[0], tile = this.topic[1]) {
    if (!this.fast && !this.heard.some(([line]) => line === text)) this.fresh.push(text)
    this.tag(text, about, tile, this.topic[2])
    this.keep(text)
  }
  /** The player has got about in one of the three ways: the hint for it can go. (It is written down with the rest of the notes.) */
  private learn(way: string) {
    if (!this.notes.known.includes(way)) this.notes.known += way
  }
  /** The log has been looked at. */
  read() {
    this.fresh = []
  }
  /** What the thing a line is about looks like: its boxes, as [x, y, z, wide, high, deep, colour], or nothing when it has no shape of its own. */
  sketch(about: string) {
    return this.sketches.get(about)
  }
  /** The player has read the line that is up: the next one comes at once, or, with none waiting, the line goes. */
  next() {
    if (this.hush) return this.hush() // the ending is rolling: that will do
    const line = this.due()
    if (line) this.voice(line)
    else this.until = Math.min(this.until, this.time - LINGER)
  }
  /** The next of the lines that are waiting, leaving out any that has lost its point meanwhile. */
  private due() {
    while (this.lines.length) {
      const line = this.lines.shift()!
      if (!this.moot(line)) return line
    }
  }
  /**
   * Whether a line has lost its point: one that says what to do about a thing, a secret or a wish is not said once
   * that is done. It happens when such a line has to wait: a tip is cut off by a click somewhere else, and by the time
   * its turn comes round again the thing it points at has been found.
   */
  private moot(text: string) {
    const thing = this.early.get(text)
    return (
      (!!thing && !thing.hits && !thing.todo) ||
      this.things.some((thing) => thing.clue && !thing.hits && !thing.todo && text.includes(thing.clue)) ||
      [...this.finds, ...this.pairs].some((find) => find.name && find.riddle && text.includes(find.riddle)) ||
      this.friends.some((friend) => friend.granted && friend.wish === text)
    )
  }
  /**
   * Whether a thing is still there to be looked at: something of it stands. One that never had a shape of its own (an
   * animal asleep, a patch of ground) always is; one that has gone to pieces, or has thinned away like the cloud, is not.
   */
  private stands(thing: Thing) {
    const shown = (cube: number) => this.solid.on(cube)
    return thing.cubes.some(shown) || thing.grown.some(shown) || (!thing.spent && !thing.cubes.length)
  }
  /** A line comes up, for as long as it takes to read. */
  private voice(text: string) {
    this.keep(text)
    this.hint = text
    this.until = this.time + held(text)
  }
  /**
   * Whatever is said is kept, for the map: every line once, and the one said last at the end. A game being put back
   * only adds what is not there yet (a game from before there was such a list gets one that way) and leaves the order
   * alone; who a line is about it says afresh, so that a list kept by an older version comes to agree with this one.
   */
  private keep(text: string, topic: About = this.whose.get(text) ?? NOBODY) {
    const at = this.heard.findIndex(([line]) => line === text)
    if (this.fast && at >= 0) return void (this.heard[at] = [text, ...topic])
    if (at >= 0) this.heard.splice(at, 1)
    this.heard.push([text, ...topic])
    if (this.fast) return
    try {
      localStorage.setItem(`${this.store}/said`, JSON.stringify(this.heard))
    } catch {
      // no storage: it is kept for this visit only
    }
  }
  /**
   * Something the game has noticed about how it is being played. It says so once, ever, and after whatever else is
   * waiting to be said: a remark never pushes in front of a line that matters.
   */
  private aside(id: string, text: string) {
    if (this.fast || this.notes.said.includes(id)) return
    this.notes.said.push(id)
    this.whose.set(text, ['about you', -1, ''])
    this.lines.push(text)
  }
  /** The player moved: the pointer, a key. If that is the first sign of life in over a minute, it gets a mention. */
  private here() {
    const now = performance.now()
    const gone = this.input ? (now - this.input) / 1000 : 0
    this.input = now
    if (gone < 60 || this.over) return
    this.notes.quiet = Math.max(this.notes.quiet, gone)
    this.aside(this.notes.said.includes('away') && gone > 300 ? 'away2' : 'away', this.notes.said.includes('away') && gone > 300 ? NOTICED.away2 : NOTICED.away)
  }
  /** What to say to somebody who has come back: it depends on how long they were gone. */
  private get welcome() {
    const gone = this.notes.seen ? (Date.now() - this.notes.seen) / 1000 : 600
    const days = Math.round(gone / 86400)
    if (gone < 90) return 'You reloaded the page. Everything is where it was. That was a test, and it passed.'
    if (days > 0) return `Welcome back. You were gone ${days > 1 ? `${days} days` : 'a day'}. Nobody counted. The frog counted.`
    return 'Welcome back. Everything is as you left it. It had no choice, but still: it waited.'
  }
  /** The name somebody goes by in a sentence: "the bunnies", "the snail". */
  private called(id: string) {
    return `the ${(this.friends.find((f) => f.id === id)?.name ?? id).replace(/^The /, '').toLowerCase()}`
  }
  /** A few true things about how this island was played, for the card at the end: no more than four of them. */
  private get noticed() {
    const { idle, pats, quiet, turned, nudged, stones, played, took } = this.notes
    const [pet, most] = Object.entries(pats).reduce((a, b) => (b[1] > a[1] ? b : a), ['', 0])
    const minutes = Math.round((took || played) / 60)
    return [
      idle > 2 && `${idle} of your knocks were on things with nothing to give. They enjoyed the company.`,
      most > 2 && `Most patted: ${this.called(pet)}, ${most} times. The others know.`,
      `It took you ${minutes < 2 ? 'a minute' : `${minutes} minutes`}. The island had been waiting a good deal longer.`,
      !turned && 'You never turned the world round. It has a back. It is not offended.',
      quiet > 90 && `The longest you left it alone: ${quiet > 3600 ? 'over an hour' : `${Math.round(quiet / 60)} minutes`}. It got on with things.`,
      nudged ? `Tips asked for: ${nudged}. Asking is a skill.` : 'Tips asked for: none. Suit yourself.',
      stones > 4 && `Stones skipped: ${stones}. None of them came back.`,
    ].filter((line): line is string => !!line).slice(0, 4)
  }
  /** Something for later. Whoever or whatever it is about by then is who it was about when it was set off: see `say`. */
  after(seconds: number, run: () => void) {
    const { topic } = this
    this.todo.push({ at: this.time + seconds, run: () => this.as(topic, run) })
  }
  /** Does something as being about somebody or something: what is said meanwhile is about them. */
  private as<T>(topic: Topic, run: () => T) {
    const was = this.topic
    this.topic = topic
    const out = run()
    this.topic = was
    return out
  }
  /** The colour of the biggest box a thing is made of, as hex: what it looks like from a way off. */
  private hue(thing: Thing) {
    let most = 0
    let color = ''
    for (const cube of thing.cubes) {
      const [, , , sx, sy, sz] = this.solid.at(cube)
      if (!this.solid.on(cube) || sx * sy * sz <= most) continue
      most = sx * sy * sz
      this.solid.mesh.getColorAt(cube, _c)
      color = _c.getHexString()
    }
    // Somebody asleep, with nothing built round them, has their own colour.
    const sleeper = color ? undefined : this.critters.list.find((c) => c.thing !== undefined && this.things[c.thing] === thing)
    if (sleeper) {
      this.critters.mesh.getColorAt(sleeper.first, _c)
      color = _c.getHexString()
    }
    return color
  }
  /** Which isle goes by this name. */
  index(name: string) {
    return ISLES.findIndex((isle) => isle.name === name)
  }
  look(tile: number) {
    return ISLES[this.isle[tile]].look
  }
  /** The middle of an isle, as [x, z]. */
  middle(name: string) {
    const tiles = this.tiles[this.index(name)]
    return [tiles.reduce((n, t) => n + tx(t), 0) / tiles.length, tiles.reduce((n, t) => n + tz(t), 0) / tiles.length]
  }

  /** Whether the bees are out. */
  get beesOut() {
    return this.bees.length > 0
  }
  /** Everything is found and all of it is awake. */
  get finished() {
    return this.over
  }
  /** Which way the camera has been turned. */
  get turn() {
    return this.yaw
  }

  /**
   * Something that does not have to be found: a combination, or a secret. Call what this returns when it is; it counts once.
   * @param more a riddle that points at it (bottles bring those); for a secret also the picture that goes with it on the map,
   * where it is to be found right now (the nudge points there), and the isle it belongs to when that is not the one being laid out
   */
  extra(kind: 'combo' | 'secret', more: { icon?: string; hint?: string; where?: string; at?: () => number[] | undefined } = {}) {
    const tally = this.extras[kind]
    tally[1]++
    const s = more.where ? this.index(more.where) : this.laying
    const entry: (typeof this.finds)[number] = { icon: more.icon ?? 'heart', riddle: more.hint, at: more.at }
    const list = kind === 'secret' ? this.finds : this.pairs
    if (kind === 'secret' && s >= 0) this.hid[s][1]++
    this.acts[`${kind}${list.push(entry) - 1}`] = () => (entry.told = true) // a bottle has told it: see `riddle`
    let found = false
    return (text: string) => {
      if (found) return
      found = true
      tally[0]++
      if (kind === 'secret' && s >= 0) this.hid[s][0]++
      // The first few words of what is said about it are its name on the map.
      const name = text.replace(/^A secret: /, '').split(/[.!]/)[0]
      entry.name = name[0].toUpperCase() + name.slice(1)
      // Where it is: its own place if it has one, else that of whatever was knocked on. The line leads there. It is
      // said at once (no `breath` first): nothing much moves for a secret or a combo, and a wait would only look slow.
      const tile = this.topic[1]
      const at = entry.at?.() ?? (tile >= 0 ? [tx(tile), this.h[tile] + 0.9, tz(tile)] : undefined)
      this.say(text, kind, at ? tileAt(at[0], at[2]) : tile)
      for (let k = 0; k < 3; k++) this.after(k * 0.13, () => note(0.45 + k * 0.2, 0.12))
      // And it shows, there: a ring of gold going up, and the word for it.
      if (!at) return
      for (let k = 0; k < 18; k++) this.bits.spawn(at[0] + Math.cos(k * 0.35) * 0.35, at[1] - 0.3, at[2] + Math.sin(k * 0.35) * 0.35, Math.cos(k * 0.35) * 1.4, 2.4 + (k % 3) * 0.7, Math.sin(k * 0.35) * 1.4, k % 3 ? 0.09 : 0.13, k % 3 ? 0xffd45c : 0xffffff, 1.3, NEVER, 0, 1.6, 2.4)
      this.word(kind === 'secret' ? 'a secret!' : 'a combo!', at[0], at[1] + 0.5, at[2])
    }
  }
  /** What a bottle can still tell: a riddle for every secret and combo not found and not told, and the clue of every thing still to be found. */
  private get untold() {
    const extras = (['secret', 'combo'] as const).flatMap((kind) => (kind === 'secret' ? this.finds : this.pairs).map((entry, k) => ({ text: entry.riddle, tell: () => (entry.told = true), act: `${kind}${k}`, done: !!entry.name || !!entry.told })))
    const things = this.things.filter((thing) => (thing.hits || thing.todo) && thing.clue && this.open[this.isle[thing.tile]] && !this.hinted.has(thing)).map((thing) => ({ text: thing.clue, tell: () => void this.hinted.add(thing), act: '', done: false }))
    return [...extras, ...things].filter((one) => one.text && !one.done)
  }
  /** A clue for something still to be found that no bottle has told yet, or nothing if there is none left. It counts as told from now on. */
  riddle() {
    const left = this.untold
    const one = left[Math.floor(Math.random() * left.length)]
    if (!one) return
    if (one.act) this.record('a', one.act)
    one.tell()
    return one.text
  }
  /** Whether there is a riddle left to tell. */
  get riddles() {
    return this.untold.length > 0
  }
  /** A place a little way above a tile, for something to point at: nothing while the tile is still under the sea. */
  above(tile: number, high: number) {
    return this.exists[tile] ? [tx(tile), this.h[tile] + high, tz(tile)] : undefined
  }
  /** A lamp that throws a pool of light where it points. Give it the way it faces, or nothing to put it out. */
  beacon(x: number, y: number, z: number) {
    const lamp = new SpotLight(0xffe2a0, 0, 26, 0.28, 0.8, 1)
    lamp.position.set(x, y, z)
    this.group.add(lamp, lamp.target)
    this.lamps.push(lamp)
    return (toward?: number) => {
      lamp.intensity = toward === undefined ? 0 : 75
      if (toward !== undefined) lamp.target.position.set(x + Math.sin(toward) * 9, GROUND, z + Math.cos(toward) * 9)
    }
  }
  /** A small light for a firefly to carry: put it where the firefly is, and say how bright it is. */
  candle() {
    const lamp = new PointLight(0xe9ff8a, 0, 3.2, 1)
    this.group.add(lamp)
    this.lamps.push(lamp)
    return lamp
  }
  /**
   * The lamps of the night are there to be drawn, or not. While none of them gives any light they are not: a lamp that is
   * there is worked out for every pixel of every cube, lit or not. The page asks for them once, at the start, so that
   * the shaders that include them are ready before the first nightfall.
   */
  lamplight(on: boolean) {
    for (const lamp of this.lamps) lamp.visible = on
  }
  /** A saved game is being put back: no new surprises of the kind that would not be the same twice. */
  get replaying() {
    return this.fast
  }

  /**
   * The world from straight above, one pixel a tile, for the map: the land there is so far in the colour it has now, water
   * where there is water, the bridges between isles, and a ripple on the sea here and there. What is still under the sea is not on it.
   * @returns red, green, blue and alpha for every tile, row by row from the north
   */
  chart() {
    const px = new Uint8ClampedArray(W * D * 4)
    const ink = (t: number, color: number, alpha = 255) => px.set([color >> 16, (color >> 8) & 255, color & 255, alpha], t * 4)
    for (let t = 0; t < W * D; t++) {
      if (this.mark[t] === ' ') {
        if (rnd(t * 7 + 1) < 0.03) ink(t, 0xffffff, 70)
        continue
      }
      if (!this.exists[t]) continue
      const look = this.look(t)
      ink(t, this.bed[t] ? (this.filled[t] ? (this.hot[t] ? LAVA : (look.water ?? 0x86cdf5)) : look.bed) : this.alive[t] ? look.green[t % 3] : look.dry[t % 3])
      if (!'HJ'.includes(this.mark[t])) continue
      // A bridge: the tile of sea between this isle and the next.
      for (const [di, dj] of NEAR) {
        const gap = step(t, di, dj)
        const far = step(t, di * 2, dj * 2)
        if (gap >= 0 && far >= 0 && this.mark[gap] === ' ' && this.exists[far] && this.isle[far] !== this.isle[t]) ink(gap, 0xb89572)
      }
    }
    return px
  }

  /** A pat: the animal wobbles, hearts go up, and the friend book takes note. */
  pat(c: Critter) {
    if (!this.fast) {
      // Who gets the pats is noticed: one who gets three times as many as anybody else is a favourite.
      const { pats } = this.notes
      const id = c.friend ?? c.kind
      const n = (pats[id] = (pats[id] ?? 0) + 1)
      if (n > 5 && Object.entries(pats).every(([other, m]) => other === id || m * 3 <= n)) this.aside('favourite', `You have patted ${this.called(id)} ${n} times. The others have noticed. Nobody is saying anything.`)
    }
    c.pet = 1
    c.rest = Math.min(c.rest, 0.3)
    this.word(c.nap > 0.5 ? 'zzz' : (VOICES[c.friend ?? c.kind] ?? ''), c.x, c.y + 0.7, c.z)
    note(0.75 + Math.random() * 0.25, 0.06)
    for (let k = 0; k < 3; k++) this.bits.spawn(c.x + any() * 0.3, c.y + 0.5, c.z + any() * 0.3, any(), 2.2, any(), 0.12, 0xff8fb0, 0.8, NEVER, 0, 2)
    const friend = this.friends.find((f) => f.id === (c.friend ?? c.kind))
    if (friend) friend.patted = true
    this.notice(() => (c.hidden ? undefined : [c.x, c.y + 0.3 * c.grow, c.z]), 1.4, 3.2, 1, c) // and whoever is near wonders why not them
  }
  /**
   * Something worth a look. Whoever is up and about and near enough stops and turns to see it, each a moment after the other.
   * @param at where it is: a place, or something that says where it is now, for a thing that moves
   * @param within how near an animal has to be to care
   * @param share how many of them care: 1 is all
   * @param but one that does not: the one it is about
   */
  notice(at: number[] | (() => number[] | undefined), seconds: number, within = Infinity, share = 1, but?: Critter) {
    if (this.fast) return
    const where = typeof at === 'function' ? at : () => at
    const spot = where()
    if (!spot) return
    for (const c of this.critters.list) {
      // Somebody shut in can still look (the bird in its cage, the penguin in its ice); somebody asleep cannot.
      const asleep = this.critters.held(c) && this.things[c.thing!].sleeper
      if (c === but || asleep || !this.critters.lively(c, true) || Math.hypot(c.x - spot[0], c.z - spot[2]) > within || Math.random() > share) continue
      c.rest = Math.max(c.rest, seconds)
      this.after(Math.random() * 0.6, () => this.critters.look(c, where, seconds * (0.7 + Math.random() * 0.3)))
    }
  }

  /** The camera goes to look at a place for a moment, then comes straight back. */
  glance(x: number, z: number, radius: number, seconds = 2.8) {
    if (this.fast || this.press || this.time < 3) return
    this.going = this.following = undefined
    this.show = { x, z, zoom: Math.max(1, this.reach / (radius * 1.5)), until: this.time + seconds }
  }
  /**
   * From far off, the knock that finishes a thing brings the view in for a look at what comes of it, and leaves it there.
   * Not at once: it waits a beat to see what does come of it. If that sets off somewhere (water down a river bed, a
   * bird out to sea) the view stays as wide as it is, to take that in, or goes along with it. It used to start in at
   * once and be called off by the first of the water: half a move, which looked like a mistake. Nor while the camera
   * is off looking at something else, or the player has a hand on the view.
   */
  private closer(tile: number) {
    if (this.fast || !this.far || this.near > 0.3) return
    this.after(0.7, () => {
      if (this.press || this.show || this.going || this.action.length || this.near > 0.3) return
      this.following = undefined
      this.going = { x: tx(tile), z: tz(tile), zoom: Math.max(this.zoom, this.far / 22) }
    })
  }
  /** Something set off by a knock is here now, and moving on. While it is out of the player's view the camera widens to keep it in the picture. */
  stir(x: number, z: number, seconds = 2.5) {
    if (this.fast) return
    const last = this.action.at(-1)
    if (last && last[0] === x && last[1] === z) last[2] = this.time + seconds
    else this.action.push([x, z, this.time + seconds])
  }
  /** An animal that is part of the action for a while: the camera goes along with it until it is gone, or the time is up. */
  watch(c: Critter, seconds: number) {
    this.watched.push([c, this.time + seconds])
    this.trail(() => (c.hidden ? undefined : [c.x, c.z]), seconds)
  }
  /**
   * The camera goes along with something on the move, from near enough to see it (and no nearer than it was already),
   * until that is gone or its time is up, and stays wherever that leaves it. A touch of the controls ends it; so does
   * new land coming up, which the camera goes to see instead.
   * @param at where the thing is now, or nothing once it is gone
   */
  trail(at: () => number[] | undefined, seconds: number) {
    const spot = at()
    if (this.fast || this.press || this.show || !spot) return
    this.following = undefined
    this.going = { x: spot[0], z: spot[1], zoom: Math.max(this.zoom, this.far / ALONG), at, until: this.time + seconds }
  }
  /** A nudge, asked for: the view goes to one thing still to be found and stays there, an arrow stands over it, and its clue is said. */
  nudge() {
    this.jump = 0 // asked for: said at once
    if (++this.notes.nudged === 3) this.after(6, () => this.aside('nudge', NOTICED.nudge)) // once the nudge itself has been read
    const left = this.things.map((thing, t) => [thing, t] as const).filter(([thing]) => (thing.hits || thing.todo) && thing.clue && this.open[this.isle[thing.tile]])
    const [thing, t] = left[this.nudges++ % Math.max(1, left.length)] ?? []
    this.lastFind = this.time
    this.following = undefined
    if (thing && t !== undefined) {
      const { tile } = thing
      const high = Math.max(this.h[tile] + 0.9, ...thing.cubes.filter((cube) => this.solid.on(cube)).map((cube) => this.solid.top(cube)))
      this.say(thing.clue!, 'tip', tile, this.hue(thing))
      this.going = { x: tx(tile), z: tz(tile), zoom: this.within(high + 0.6, Math.max(this.zoom, 2.4)) } // room for the arrow over it, too
      return this.point(() => [tx(tile), high, tz(tile)], () => !thing.hits && !thing.todo, () => void this.strike(t))
    }
    // Everything that has to be found is found: what is left is snails.
    const snail = this.critters.list.find((c) => c.kind === 'snail' && !c.hidden && !this.greeted.has(c))
    if (snail) {
      this.say('There is a snail here that nobody has said hello to. It has not complained. That is the sad part.', 'tip')
      this.going = { x: snail.x, z: snail.z, zoom: Math.max(this.zoom, 3) }
      return this.point(() => [snail.x, snail.y + 0.4, snail.z], () => this.greeted.has(snail), () => snail.onPat?.())
    }
    // And after the snails, the secrets: its riddle is said, and where it has a place right now, the arrow stands over it.
    const hidden = this.finds.filter((find) => !find.name && find.riddle)
    const find = hidden[this.nudges % Math.max(1, hidden.length)]
    if (!find) return this.say(this.done ? 'There is nothing left that I know of. You found the lot. You may now have the feeling you came for. Take your time with it.' : 'Nothing more to find just now. Something is still on its way. Waiting also counts as playing, apparently.', 'tip')
    // Told now, like one a bottle brought: its riddle stays next to it on the map.
    if (!find.told) this.record('a', `secret${this.finds.indexOf(find)}`)
    find.told = true
    this.say(`A secret: ${find.riddle}`, 'tip')
    const at = find.at?.()
    if (!at) return
    this.going = { x: at[0], z: at[2], zoom: Math.max(this.zoom, 2.6) }
    this.point(() => find.at?.() ?? at, () => !!find.name, () => {})
  }
  /** A word floats up from a place in the world. */
  word(text: string, x: number, y: number, z: number) {
    if (this.fast || !text || !this.camera || !this.pop) return
    _p.set(x, y, z).project(this.camera)
    this.pop(text, ((_p.x + 1) / 2) * innerWidth, ((1 - _p.y) / 2) * innerHeight)
  }
  /** The ground shakes. */
  rumble(amount: number) {
    this.shaking = Math.max(this.shaking, amount)
  }

  // --- building ---------------------------------------------------------------------------

  /** A cube of the ground itself, at height y above the sea. On an isle still under the sea it is built invisible. */
  land(tile: number, y: number, sx: number, sy: number, sz: number, color: number, dx = 0, dz = 0) {
    const s = this.isle[tile]
    const cube = this.solid.add(tx(tile) + dx, y, tz(tile) + dz, sx, sy, sz, color, -2 - tile, this.open[s])
    if (!this.open[s]) this.asleep[s].push([cube, tile])
    return cube
  }

  /** The shadows at the size that goes with a step of the picture (see `../Picture.tsx`). */
  shadows(tier: number) {
    shade(this.key, tier)
  }

  thing(tile: number, more: Partial<Thing> = {}) {
    // Its name in a saved game: the isle, the letter it has on the map, and its turn among the things with that letter there.
    const letter = `${ISLES[this.isle[tile]].name}:${this.mark[tile]}`
    const turn = this.turns.get(letter) ?? 0
    this.turns.set(letter, turn + 1)
    this.things.push({ tile, cubes: [], grown: [], auto: true, key: `${letter}${turn}`, ...more })
    this.standing[tile].push(this.things.length - 1)
    if (more.hits || more.todo) this.quota[this.isle[tile]]++
    return this.things.length - 1
  }

  /**
   * One box of a thing, measured from the middle of its tile and up from the ground there.
   * @param later the box waits until the thing comes to life
   */
  put(t: number, dx: number, dy: number, dz: number, sx: number, sy: number, sz: number, color: number, later = false) {
    const thing = this.things[t]
    const { tile } = thing
    const s = this.isle[tile]
    const now = !later && this.open[s]
    const cube = this.solid.add(tx(tile) + dx, this.h[tile] + dy, tz(tile) + dz, sx, sy, sz, color, t, now && !this.time)
    if (now && this.time) this.solid.show(cube, 0.05) // built in mid game: it pops in
    if (!later && !this.open[s]) this.asleep[s].push([cube, tile])
    ;(later ? thing.grown : thing.cubes).push(cube)
    return cube
  }

  /** A cube of a thing that is not there yet: a crack for a knock to open, a piece for it to bring out. See `Thing.marks`. */
  scar(t: number, dx: number, dy: number, dz: number, sx: number, sy: number, sz: number, color: number) {
    const { tile } = this.things[t]
    const cube = this.solid.add(tx(tile) + dx, this.h[tile] + dy, tz(tile) + dz, sx, sy, sz, color, t, false)
    this.things[t].cubes.push(cube)
    return cube
  }

  /**
   * A boulder: one lump with its corners knocked off (a middle, and a lower bulge to either side and to front and back),
   * a paler top, a smaller stone and a pebble beside it, and moss once the ground is alive.
   */
  stones(t: number, size: number, seed: number, dz = 0) {
    const m = this.chance(seed) < 0.5 ? size : -size // mirrored, so that no two next to each other look alike
    const box = (dx: number, y: number, z: number, wide: number, high: number, deep: number, color: number, later = false) =>
      this.put(t, dx * m, (y + high / 2) * size, dz + z * size, wide * size, high * size, deep * size, color, later)
    // In this order: the middle, its two bulges, the pale top, the smaller stone, the pebble, the moss.
    return [
      box(0, 0, 0, 0.66, 0.52, 0.56, STONE[0]),
      box(0.02, 0, 0.02, 0.96, 0.3, 0.4, STONE[1]),
      box(-0.03, 0, 0, 0.44, 0.38, 0.84, STONE[1]),
      box(0.07, 0.52, -0.04, 0.4, 0.14, 0.34, STONE[2]),
      box(0.52, 0, 0.42, 0.26, 0.2, 0.24, STONE[2]),
      box(-0.46, 0, -0.38, 0.16, 0.12, 0.16, STONE[0]),
      box(-0.09, 0.52, 0.2, 0.38, 0.05, 0.14, 0x8fd16b, true),
    ]
  }

  /** Planks from the edge of a tile across the gap to the next isle. */
  planks(t: number, di: number, dj: number) {
    this.things[t].tip ??= 'A plank bridge. It holds. It has decided to'
    for (let k = 0; k < 4; k++) this.put(t, di * (0.65 + k * 0.3), 0.02, dj * (0.65 + k * 0.3), di ? 0.26 : 0.8, 0.08, di ? 0.8 : 0.26, k % 2 ? 0xb89572 : 0xa98463)
    for (const far of [0.5, 1.5]) for (const side of [-0.42, 0.42]) this.put(t, di ? di * far : side, 0.22, dj ? dj * far : side, 0.08, 0.44, 0.08, BARK)
  }

  /** @param seedling only a sprout until its tile is alive */
  tree(tile: number, kind: Tree, seedling = false) {
    const old = kind === 'old'
    const t = this.thing(tile, { auto: !old })
    const thing = this.things[t]
    thing.key = `tree:${kind}` // in a saved game any tree of its kind will do: seeds do not fall in the same place twice
    ;(this.spots[tile] ??= []).push([0, 0, old ? 0.3 : 0.17]) // nothing else grows where the trunk is
    const x = tx(tile)
    const y = this.h[tile]
    const z = tz(tile)
    thing.give = old ? 0.07 : kind === 'pine' ? 0.1 : kind === 'palm' ? 0.16 : kind === 'shroom' ? 0.04 : 0.12 // how far it bends in the wind
    if (kind === 'pine') {
      // Three tiers under snow; the top one keeps its white cap.
      this.put(t, 0, 0.25, 0, 0.26, 0.5, 0.26, WOOD)
      const tiers = [[1.15, 0.72], [0.82, 1.14], [0.48, 1.56]].map(([s, dy]) => this.put(t, 0, dy, 0, s, 0.44, s, 0xf4f8fd))
      thing.wake = () => tiers.slice(0, 2).forEach((cube, k) => this.solid.paint(cube, k ? 0x6fbc86 : 0x5fae7a))
      thing.perch = [x, y + 1.78, z]
      return t
    }
    if (kind === 'palm') {
      // A leaning trunk. Dry fronds hang; green ones spread, with a coconut or two.
      for (let k = 0; k < 4; k++) this.put(t, k * 0.07, 0.25 + k * 0.5, 0, 0.2, 0.5, 0.2, k % 2 ? 0xb8956a : 0xa98463)
      const dead = [this.put(t, 0.5, 1.9, 0, 0.5, 0.1, 0.16, 0xa58f72), this.put(t, 0.16, 1.9, 0.33, 0.16, 0.1, 0.5, 0x97826a)]
      for (const [dx, dz] of NEAR) {
        this.put(t, 0.28 + dx * 0.5, 2.1, dz * 0.5, dx ? 0.8 : 0.3, 0.1, dx ? 0.3 : 0.8, 0x7fca6c, true)
        this.put(t, 0.28 + dx * 0.98, 1.97, dz * 0.98, dx ? 0.3 : 0.24, 0.1, dx ? 0.24 : 0.3, 0x8fd16b, true)
      }
      this.put(t, 0.28, 2.22, 0, 0.3, 0.14, 0.3, 0x6fbc6c, true)
      this.put(t, 0.42, 1.93, 0.13, 0.16, 0.16, 0.16, BARK, true)
      this.put(t, 0.16, 1.93, -0.12, 0.16, 0.16, 0.16, BARK, true)
      thing.wake = () => dead.forEach((cube) => this.solid.hide(cube))
      thing.perch = [x + 0.28, y + 2.29, z]
      return t
    }
    if (kind === 'shroom') {
      // A mushroom as tall as a tree. Shrivelled and grey asleep; awake, a big spotted cap that glows at night.
      this.put(t, 0, 0.6, 0, 0.36, 1.2, 0.36, 0xf3ead8)
      const dead = this.put(t, 0, 1.3, 0, 0.8, 0.26, 0.8, 0x8f8474)
      const cap = this.chance(tile) < 0.5 ? 0xf06a6a : 0xb58cf0
      this.put(t, 0, 1.42, 0, 1.5, 0.44, 1.5, cap, true)
      this.put(t, 0, 1.76, 0, 0.9, 0.24, 0.9, cap, true)
      const spots = [[0.5, 1.66, 0.4], [-0.45, 1.66, -0.3], [0.1, 1.9, -0.1], [-0.3, 1.66, 0.55], [0.76, 1.44, -0.2], [-0.2, 1.44, 0.76]].map(([dx, dy, dz]) => this.put(t, dx, dy, dz, 0.2, 0.08, 0.2, 0xfff6e0, true))
      thing.wake = () => {
        this.solid.hide(dead)
        for (const spot of spots) this.glow(spot, 0xfff6e0)
      }
      thing.perch = [x, y + 1.88, z]
      // A knock, and it bounces: cap, spots and all. Awake, it lets a few spores go.
      Object.assign(thing, {
        tip: 'A mushroom the size of a tree. Go on, it bounces',
        fuss: 'It bounces every time. That is the whole of what it does. You have now checked this very thoroughly.',
        sound: 'boing',
        play: () => {
          for (const cube of thing.grown) this.solid.poke(cube, 9)
          if (thing.up) for (let k = 0; k < 5; k++) this.bits.spawn(x + any() * 1.2, y + 1.5, z + any() * 1.2, any() * 0.6, 0.8, any() * 0.6, 0.08, 0xfff6e0, 1.6, NEVER, 0, -0.3, this.night ? 2.4 : 1)
        },
      })
      return t
    }
    const tall = old ? 2.6 : (seedling ? 1 : 1.4) + this.chance(tile) * 0.6
    const w = old ? 0.6 : 0.34
    this.put(t, 0, tall / 2, 0, w, tall, w, WOOD, seedling)
    if (seedling) {
      const sprout = [this.put(t, 0, 0.16, 0, 0.08, 0.32, 0.08, 0x67bd72), this.put(t, 0.09, 0.3, 0, 0.16, 0.08, 0.1, 0x8fd16b), this.put(t, -0.09, 0.22, 0, 0.16, 0.08, 0.1, 0x8fd16b)]
      thing.wake = () => sprout.forEach((cube) => this.solid.hide(cube)) // the trunk takes its place
    } else {
      this.put(t, 0.3, tall * 0.72, 0, 0.5, 0.15, 0.15, BARK)
      this.put(t, -0.1, tall * 0.9, 0.25, 0.15, 0.15, 0.45, BARK)
    }
    const leaf = old ? BLOSSOM : kind === 'fruit' ? FRUIT : LEAF
    const f = old ? 1.7 : seedling ? 0.8 : 1
    const recipe = old ? 0 : Math.floor(this.chance(tile * 7 + 3) * CANOPIES.length)
    const top = CANOPIES[recipe]
    const mx = this.chance(tile * 5 + 1) < 0.5 ? -f : f // mirrored left to right, or front to back, or both
    const mz = this.chance(tile * 3 + 2) < 0.5 ? -f : f
    for (const [dx, dy, dz, wide, high, deep, shade] of top) this.put(t, dx * mx, tall + dy * f, dz * mz, wide * f, high * f, deep * f, leaf[shade], true)
    // Fruit, but only once there are bees to set it (`combos`): apples on a fruit tree, and oranges on some of the first
    // island's own trees. Not on all of them.
    const fruit = kind === 'fruit' ? 0xee6a62 : kind === 'oak' && !seedling && this.isle[tile] === 0 && this.chance(tile * 11 + 4) < 0.4 ? 0xffa94d : 0
    const apples = fruit ? APPLES[recipe].map(([dx, dy, dz]) => this.solid.add(x + dx * mx, y + tall + dy * f, z + dz * mz, 0.18, 0.18, 0.18, fruit, t, false)) : []
    if (fruit) thing.extra = apples
    // And what the bees bring out on the old tree is blossom: a few small flowers, here and there all over it.
    if (old) thing.extra = FLOWERS.flatMap(([spots, colors]) => spots.map(([dx, dy, dz], k) => this.solid.add(x + dx * mx, y + tall + dy * f, z + dz * mz, 0.2, 0.2, 0.2, colors[k % colors.length], t, false)))
    const [px, py, pz, , high] = top.reduce((a, b) => (b[1] + b[4] / 2 > a[1] + a[4] / 2 ? b : a))
    thing.perch = [x + px * mx, y + tall + (py + high / 2) * f, z + pz * mz]
    if (!fruit) return t
    // A knock on a tree that bears fruit brings a few leaves down, and an apple (or an orange), once the bees have set
    // some. It lies where it fell (a spot kept clear of grass) until somebody comes and eats it, and the tree grows another.
    const [ax, az] = this.room(tile, 0.2, tile * 29 + 5) ?? [0.3, 0.32]
    const fallen = this.solid.add(x + ax, y + 0.09, z + az, 0.18, 0.18, 0.18, fruit, t, false)
    let lying = false
    const gone = () => {
      lying = false
      this.solid.hide(fallen)
    }
    // Whoever is about comes for it. If nobody does, it lies there a while, and then it is gone.
    const call = (tries: number) => {
      if (!lying) return
      const coming = this.fetch(x + ax, y, z + az, (c) => {
        this.critters.perform(c, ['bird', 'chick'].includes(c.kind) ? 'peck' : 'chew')
        c.rest = 2.6
        this.after(1.7, () => {
          if (!lying) return
          gone()
          this.word('nom', c.x, c.y + 0.6, c.z)
          for (let k = 0; k < 2; k++) this.bits.spawn(c.x + any() * 0.3, c.y + 0.5, c.z + any() * 0.3, any(), 2.2, any(), 0.12, 0xff8fb0, 0.8, NEVER, 0, 2)
        })
      })
      if (!coming) this.after(2, () => (tries ? call(tries - 1) : gone()))
    }
    // An apple tree is one from the start. An oak is an orange tree only once it has oranges on it (`combos`): until
    // then it looks like the oaks next to it, so it says nothing and answers no knock, as they do.
    Object.assign(kind === 'fruit' ? thing : (thing.ripe = {}), {
      tip: kind === 'fruit' ? 'A fruit tree. Knock, and it lets go of things' : 'An orange tree. Knock, and it lets go of things',
      fuss: 'The tree is giving what it has. Try another tree. This one is out of fruit, not out of goodwill.',
      sound: 'rustle',
      play: () => {
        for (let k = 0; k < 4; k++) this.bits.spawn(x + any(), y + tall + 0.3, z + any(), any(), 0.5, any(), 0.12, leaf[k % 3], 1.6, y, 0, 4)
        // `extra` is what waits for the bees: once it is gone, the apples are out.
        const apple = thing.up && !thing.extra && !lying ? apples.find((cube) => this.solid.on(cube)) : undefined
        if (apple === undefined) return
        lying = true
        const [bx, by, bz] = this.solid.at(apple)
        this.solid.hide(apple)
        this.after(25, () => this.solid.show(apple))
        this.bits.spawn(bx, by, bz, (x + ax - bx) / 0.45, 1.5, (z + az - bz) / 0.45, 0.18, fruit, 0.5, y + 0.09, 0)
        this.after(0.45, () => lying && this.solid.show(fallen))
        this.after(1, () => call(10))
      },
    })
    return t
  }

  /** Ground, water and whatever stands on one tile. */
  private lay(tile: number, c: string, s: number, level: number) {
    const isle = ISLES[s]
    const { look } = isle
    const bed = isle.beds.includes(c)
    const top = GROUND + level - (bed ? 0.6 : 0)
    this.mark[tile] = c
    this.isle[tile] = s
    this.tiles[s].push(tile)
    this.h[tile] = top
    this.bed[tile] = bed ? 1 : 0
    this.land(tile, (top - 0.3) / 2, 1, top - 0.3, 1, _c.set(look.soil).offsetHSL(0, 0, (rnd(tile) - 0.5) * 0.05).getHex())
    this.cap[tile] = this.land(tile, top - 0.15, 1, 0.3, 1, bed ? look.bed : look.dry[tile % 3])
    if (c === 'T') this.tree(tile, look.tree) // first, so that what lies on the ground keeps clear of its trunk
    if (bed) {
      this.hot[tile] = isle.lava?.includes(c) ? 1 : 0
      this.pool[tile] = (this.hot[tile] ? this.solid : this.wet).add(tx(tile), top + 0.22, tz(tile), 1, 0.44, 1, this.hot[tile] ? LAVA : (look.water ?? 0x86cdf5), -2 - tile, false)
    } else if (look.dress && '.T'.includes(c)) {
      const [a, b] = look.litter ?? STONE
      for (let k = 0; k < (look.dress === 'pebble' ? 1 : 2) + Math.round(this.chance(tile * 3)); k++) {
        const color = k ? a : b
        if (look.dress === 'snow') {
          // Snow lies in drifts: on a tile here and there, one low heap with a smaller one on top of it.
          if (k || this.chance(tile * 17 + 5) > 0.5) continue
          const [dx, dz] = [(this.chance(tile * 7) - 0.5) * 0.4, (this.chance(tile * 11) - 0.5) * 0.4]
          this.dress[tile].push(this.land(tile, top + 0.045, 0.56, 0.09, 0.46, 0xffffff, dx, dz), this.land(tile, top + 0.13, 0.32, 0.08, 0.26, 0xffffff, dx - 0.04, dz + 0.03))
          continue
        }
        // Straw, reeds and pebbles each get room of their own, like the grass that comes later.
        const wide = look.dress === 'pebble' ? 0.12 + k * 0.04 : 0.09
        const at = this.room(tile, wide, tile * 7 + k * 100)
        if (!at) continue
        at.push(look.dress === 'pebble' ? this.land(tile, top + 0.05 + k * 0.01, wide, 0.1 + k * 0.02, wide, color, at[0], at[1]) : this.land(tile, top + (look.dress === 'reed' ? 0.24 : 0.15), wide, look.dress === 'reed' ? 0.48 : 0.3, wide, color, at[0], at[1]))
        this.dress[tile].push(at[3])
        if (look.dress !== 'pebble') this.blade(at[3], tile)
      }
    }
    if (c === 'T') return
    if (c === 'o') this.stones(this.thing(tile), 0.9, tile)
    else if (c === 'b') {
      // A bush: twigs until its tile wakes, then leaves and two berries. It does nothing, and its label says which it is.
      const t = this.thing(tile, { tip: 'A bush, all twigs. It is waiting for water, like the rest of us', wake: () => (this.things[t].tip = 'A bush, with two berries on it. It grew them itself') })
      this.put(t, 0, 0.2, 0, 0.5, 0.4, 0.5, 0xa58f72)
      this.put(t, 0.25, 0.12, 0.2, 0.3, 0.25, 0.3, 0x97826a)
      this.put(t, 0, 0.42, 0, 0.75, 0.6, 0.75, 0x7fca6c, true)
      this.put(t, 0.3, 0.3, 0.25, 0.45, 0.4, 0.45, LEAF[0], true)
      this.put(t, -0.2, 0.72, 0.2, 0.16, 0.16, 0.16, 0xee6a62, true)
      this.put(t, 0.3, 0.5, -0.1, 0.16, 0.16, 0.16, 0xee6a62, true)
    } else isle.lay(this, tile, c)
  }

  /** A lid on a bed: a sheet of ice, or turf that looks like any other ground. Nothing flows under it. */
  cover(tile: number, turf = false) {
    this.lid[tile] = turf ? this.land(tile, this.h[tile] + 0.3, 1, 0.6, 1, this.look(tile).dry[tile % 3]) : this.land(tile, this.h[tile] + 0.3, 1, 0.24, 1, 0xd7efff)
    this.turf[tile] = turf ? 1 : 0
    this.blocked[tile] = 1
  }
  /** @param melt the lid was ice: what is left of it is water */
  uncover(tile: number, melt = false) {
    this.rubble(this.lid[tile], tile, 4)
    this.solid.hide(this.lid[tile])
    this.lid[tile] = -1
    this.blocked[tile] = 0
    if (melt) this.fill(tile)
  }

  /** The middle of the land there is, and how far it reaches from there. */
  private fit() {
    let x0 = Infinity
    let x1 = -Infinity
    let z0 = Infinity
    let z1 = -Infinity
    for (let t = 0; t < W * D; t++) {
      if (!this.exists[t]) continue
      x0 = Math.min(x0, tx(t))
      x1 = Math.max(x1, tx(t))
      z0 = Math.min(z0, tz(t))
      z1 = Math.max(z1, tz(t))
    }
    this.goal.set((x0 + x1) / 2, 0, (z0 + z1) / 2)
    this.reach = 0
    for (let t = 0; t < W * D; t++) if (this.exists[t]) this.reach = Math.max(this.reach, Math.hypot(tx(t) - this.goal.x, tz(t) - this.goal.z) + 0.7)
  }

  /** Water that is already there when an isle appears: it shows, and keeps a little green around it. */
  private surface(s: number, wait: number) {
    for (const tile of this.tiles[s]) {
      if (!this.filled[tile]) continue
      this.wet.show(this.pool[tile], wait)
      this.source(tile, 1.7, wait + 0.6)
      this.spill(tile)
    }
  }

  /** Where a tile of water or lava has nothing beside it, it falls over the edge. */
  private spill(tile: number) {
    for (const [di, dj] of NEAR) {
      const u = step(tile, di, dj)
      if (u < 0 || !this.exists[u]) this.pour(tile, di, dj, u)
    }
  }
  /**
   * Water (or lava) goes over an edge here: off the land altogether, or down a step into the tile below. It falls as a
   * steady stream of drops right across the edge, and where it lands there is a little mist.
   * @param beyond the tile past the edge, where there is one that may yet come up out of the sea: once it has, nothing falls
   * @param below the tile it lands in, for a step down; without one it falls to the sea
   */
  private pour(tile: number, di: number, dj: number, beyond: number, below = -1) {
    this.falls.push([tx(tile) + di * 0.56, this.h[tile] + 0.44, tz(tile) + dj * 0.56, di, dj, below < 0 ? 0 : this.h[below] + 0.3, beyond, this.hot[tile]])
  }

  /** A new isle comes up out of the sea, from (x, z) outwards; from its middle if not given. */
  raise(name: string, x?: number, z?: number) {
    const s = this.index(name)
    if (this.open[s]) return
    const [mx, mz] = this.middle(name)
    this.open[s] = true
    this.stirred = this.time
    this.keep(name, ['land', -1, '']) // a mark in the log: this is where it came up
    for (const tile of this.tiles[s]) this.exists[tile] = 1
    this.total += this.tiles[s].length
    // Ground first, what stands on it a moment later.
    for (const [cube, tile] of this.asleep[s]) this.solid.show(cube, Math.hypot(tx(tile) - (x ?? mx), tz(tile) - (z ?? mz)) * 0.11 + (this.solid.owner[cube] >= 0 ? 0.35 : 0))
    for (const critter of this.sleepers[s]) critter.hidden = false
    this.surface(s, 1.2)
    for (let k = 0; k < 5; k++) this.after(k * 0.2, thump)
    this.rumble(0.7)
    for (const tile of this.tiles[s]) if (rnd(tile) < 0.5) this.bits.spawn(tx(tile), 0.4, tz(tile), any() * 3, 6 + Math.random() * 5, any() * 3, 0.2, 0xeaf6ff, 1.4, 0, 0)
    this.fit()
    this.glance(mx, mz, Math.max(...this.tiles[s].map((t) => Math.hypot(tx(t) - mx, tz(t) - mz))) + 1.5)
    this.notice([mx, GROUND + 1, mz], 3)
  }

  // --- water and waking ground ---------------------------------------------------------------

  /** Everything within `radius` tiles of this one wakes up, the nearest first. */
  source(tile: number, radius: number, delay = 0) {
    const i = tile % W
    const j = Math.floor(tile / W)
    for (let v = Math.max(0, j - 5); v < Math.min(D, j + 6); v++)
      for (let u = Math.max(0, i - 5); u < Math.min(W, i + 6); u++) {
        const d = Math.hypot(u - i, v - j)
        if (d <= radius && this.exists[u + v * W]) this.wakeAt[u + v * W] = Math.min(this.wakeAt[u + v * W], this.time + delay + d * 0.32 + rnd(u * 31 + v) * 0.25)
      }
  }

  /**
   * A click on water throws a flat stone at it. It lands where the click was and skips on, along the water whichever way
   * there is most of it, for as long as there is water under it, with a small splash at every touch. Then somewhere near
   * by a fish jumps at the noise.
   */
  private skip(tile: number) {
    const { critters } = this
    const wet = (u: number) => u >= 0 && !!this.exists[u] && !!this.filled[u] && !this.hot[u] && Math.abs(this.h[u] - this.h[tile]) < 0.1
    const x = Math.min(tx(tile) + 0.4, Math.max(tx(tile) - 0.4, this.at.x))
    const z = Math.min(tz(tile) + 0.4, Math.max(tz(tile) - 0.4, this.at.z))
    const top = this.h[tile] + 0.47
    const stone = (this.stone ??= Object.assign(critters.spawn('pebble', 0, -40, 0), { hidden: true, onPat: () => {} }))
    // One stone at a time. While it is on its way a click is only a finger in the water.
    if (!stone.hidden || this.fast) return this.splash(x, top, z, 3)
    if (++this.notes.stones === 10) this.aside('stones', NOTICED.stones)
    // Of two ways with as much water, the one that leads away from the camera.
    const run = ([di, dj]: number[]) => {
      let n = 0
      while (n < 3 && wet(step(tile, di * (n + 1), dj * (n + 1)))) n++
      return n * 10 - (di * Math.sin(this.yaw) + dj * Math.cos(this.yaw)) / Math.hypot(di, dj)
    }
    const [di, dj] = RING.reduce((a, b) => (run(b) > run(a) ? b : a))
    const [ux, uz] = [di / Math.hypot(di, dj), dj / Math.hypot(di, dj)]
    // Where it touches down: each skip shorter than the last, and none onto dry land.
    const spots = [[x, z]]
    for (const hop of [0.95, 0.7, 0.5, 0.35]) {
      const [px, pz] = spots[spots.length - 1]
      if (!wet(tileAt(px + ux * hop, pz + uz * hop))) break
      spots.push([px + ux * hop, pz + uz * hop])
    }
    const touch = (k: number) => {
      const [px, pz] = spots[k]
      note(0.7 + k * 0.07, 0.03)
      this.word(k ? '' : 'plip', px, top + 0.3, pz)
      const last = k === spots.length - 1
      this.splash(px, top, pz, last ? 5 : 3)
      if (last) return void (stone.hidden = true)
      const hop = Math.hypot(spots[k + 1][0] - px, spots[k + 1][1] - pz)
      critters.go(stone, spots[k + 1][0], top, spots[k + 1][1], 0.12 + hop * 0.22, 0.08 + hop * 0.28, () => touch(k + 1))
    }
    Object.assign(stone, { x: x - ux * 1.1, y: top + 0.7, z: z - uz * 1.1, hidden: false, face: Math.atan2(ux, uz), yaw: Math.atan2(ux, uz), size: 1 })
    critters.go(stone, x, top, z, 0.26, 0.1, () => touch(0))
    // The fish. Not up north: the penguin's pond has none, which is the trouble with it.
    if (ISLES[this.isle[tile]].name === 'snow') return
    const water = this.tiles[this.isle[tile]].filter((u) => u !== tile && wet(u) && this.mark[u] === this.mark[tile] && Math.hypot(tx(u) - x, tz(u) - z) < 3)
    const u = water[Math.floor(Math.random() * water.length)]
    if (u === undefined) return
    this.after(0.6 + Math.random() * 0.5, () => {
      const [vx, vz] = [any() * 1.6, any() * 1.6]
      this.bits.spawn(tx(u), this.h[u] + 0.45, tz(u), vx, 5.5, vz, 0.17, 0xff9a5c, 1.2, this.h[u] + 0.35, 0)
      this.splash(tx(u), this.h[u] + 0.47, tz(u), 2)
    })
  }

  splash(x: number, y: number, z: number, n: number, color = WATER) {
    for (let k = 0; k < n; k++) this.bits.spawn(x, y, z, any() * 3, 4 + Math.random() * 3, any() * 3, 0.13, color, 0.8, y - 0.2, 0)
  }

  /** Water (or lava) arrives in a bed. */
  fill(tile: number) {
    if (this.filled[tile]) return
    const look = this.look(tile)
    const hot = this.hot[tile]
    const x = tx(tile)
    const z = tz(tile)
    this.filled[tile] = 1
    this.stirred = this.time
    this.stir(x, z)
    if (hot) {
      this.solid.show(this.pool[tile])
      this.solid.paint(this.pool[tile], LAVA, 2.2)
    } else this.wet.show(this.pool[tile])
    this.solid.paint(this.cap[tile], look.wet)
    this.source(tile, look.reach)
    this.splash(x, this.h[tile] + 0.5, z, 3, hot ? 0xffb347 : WATER)
    this.spill(tile)
    for (const heard of this.onFill) heard(tile)
  }

  /** The water leaves a bed again: the tide goes out. Block the bed as well, or its neighbours fill it straight back up. */
  drain(tile: number) {
    if (!this.filled[tile]) return
    this.filled[tile] = 0
    this.wet.hide(this.pool[tile])
    this.solid.paint(this.cap[tile], this.look(tile).bed)
  }

  /** It creeps one tile further along every open bed, downhill or level. */
  private flow() {
    this.flows++
    const next: number[][] = []
    for (let t = 0; t < W * D; t++) {
      if (!this.filled[t]) continue
      for (const [di, dj] of NEAR) {
        const u = step(t, di, dj)
        if (u < 0 || !this.exists[u] || !this.bed[u] || this.filled[u] || this.blocked[u] || this.h[u] > this.h[t] + 0.01) continue
        if (this.hot[u] !== this.hot[t] || (this.hot[u] && this.flows % 4)) continue // lava keeps to its own bed, and takes its time
        next.push([u, t, di, dj])
      }
    }
    for (const [u, t, di, dj] of next) {
      if (this.filled[u]) continue
      this.fill(u)
      // A step down is a small fall of its own.
      if (this.h[u] < this.h[t] - 0.3) this.pour(t, di, dj, -1, u)
    }
  }

  /** The frog's cloud drifts over an isle and rains there: rain-fed beds fill, and whatever was waiting for rain gets it. */
  rainOn(name: string, from: number[], then?: () => void) {
    const s = this.index(name)
    const [x, z] = this.middle(name)
    if (!this.drift) {
      const cubes = CLOUD.map(([, , , size]) => this.solid.add(0, -9, 0, size, size * 0.7, size, 0xeeeaf2, -1, false))
      cubes.forEach((cube, k) => this.solid.show(cube, k * 0.15))
      this.drift = { cubes, x: from[0], z: from[1], to: from, busy: false }
    }
    const { drift } = this
    if (drift.busy) return
    drift.busy = true
    drift.to = [x, z]
    this.trail(() => (Math.hypot(drift.to[0] - drift.x, drift.to[1] - drift.z) > 0.1 ? [drift.x, drift.z] : undefined), 30) // the camera goes with the cloud
    drift.then = () => {
      this.showers.push([x, z, this.time + 4.5])
      this.after(4.5, () => {
        drift.busy = false
        for (const tile of this.tiles[s]) if (ISLES[s].rainfed?.includes(this.mark[tile])) this.fill(tile)
        for (const thing of this.things) if (this.isle[thing.tile] === s) thing.rain?.()
        then?.()
      })
    }
  }

  /** Night falls, or lifts. Whatever glows, glows. */
  setNight(on: boolean) {
    this.night = on
    for (const [cube, color] of this.glows) this.solid.paint(cube, color, on ? 2.6 : 1)
    // Flowers shut for the night, one after another, and open again in the morning.
    for (const head of this.blooms)
      this.after(Math.random() * 1.5, () => {
        this.solid.size(head, on ? 0.1 : 0.2, on ? 0.12 : 0.18, on ? 0.1 : 0.2)
        this.solid.poke(head, 5)
      })
    for (const heard of this.onNight) heard(on)
  }
  /** This cube shines in the dark. */
  glow(cube: number, color: number) {
    this.glows.push([cube, color])
    if (this.night) this.solid.paint(cube, color, 2.6)
  }

  /** The bees are out: flowers on the tiles that would have had one, had the bees been there when they woke. */
  releaseBees(x: number, y: number, z: number) {
    this.hive = [x, y - 0.6, z, this.time]
    for (let k = 0; k < 9; k++) this.bees.push(this.solid.add(x, y - 0.6, z, 0.13, 0.13, 0.13, k % 3 ? 0xffcf3f : 0x4a4458))
    for (let u = 0; u < W * D; u++) {
      const shy = this.chance(u * 13) - this.look(u).flowers
      if (this.alive[u] && !this.bed[u] && shy >= 0 && shy < BEES) this.flower(u, 0.3 + rnd(u) * 2)
    }
  }

  /** One small flower on a living tile. */
  private flower(tile: number, wait: number) {
    const seed = tile * 17 + this.solid.count
    const at = this.room(tile, 0.2, seed)
    if (!at) return
    const x = tx(tile) + at[0]
    const z = tz(tile) + at[1]
    const { petals } = this.look(tile)
    at.push(this.solid.add(x, this.h[tile] + 0.14, z, 0.07, 0.28, 0.07, 0x67bd72, -2 - tile, false), this.solid.add(x, this.h[tile] + 0.34, z, 0.2, 0.18, 0.2, petals[Math.floor(rnd(seed + 2) * petals.length)], -2 - tile, false))
    this.solid.show(at[3], wait)
    this.solid.show(at[4], wait + 0.1)
    this.blade(at[3], tile)
    this.blade(at[4], tile)
    this.blooms.push(at[4])
  }
  /** Grass, a flower, straw, a reed: it leans away from the cursor, and bends when the wind blows. */
  private blade(cube: number, tile: number) {
    this.soft.add(cube)
    const [x, , z] = this.solid.at(cube)
    this.solid.bendy(cube, 1, this.h[tile], x, z)
  }

  /**
   * Room on a tile for a tuft or a flower `wide`: inside the tile, clear of a trunk in the middle of it and of whatever
   * grows there already, so that no two of them stand in each other. Nothing grows where something other than a tree stands.
   * @returns the note of the spot, for the cubes to be added to; nothing if there is no room
   */
  private room(tile: number, wide: number, seed: number) {
    if (this.standing[tile].some((t) => !this.things[t].perch)) return
    const taken = (this.spots[tile] ??= [])
    const reach = 1 - wide - 0.04
    for (let n = 0; n < 8; n++) {
      const x = (this.chance(seed + n * 31) - 0.5) * reach
      const z = (this.chance(seed + n * 31 + 7) - 0.5) * reach
      if (taken.some(([px, pz, half]) => Math.abs(px - x) < half + wide / 2 + 0.03 && Math.abs(pz - z) < half + wide / 2 + 0.03)) continue
      const spot = [x, z, wide / 2]
      taken.push(spot)
      return spot
    }
  }
  /** Room on a tile for something small that turns up there (a bottle on the beach): where, from the middle of the tile, or nothing if there is none. */
  place(tile: number, wide: number) {
    return this.room(tile, wide, tile * 13 + Math.floor(this.time))
  }
  /** What grows on a tile makes way: for a trunk `half` wide in the middle of it, or, with no width given, for anything at all. */
  clear(tile: number, half = 1) {
    this.spots[tile] = (this.spots[tile] ?? []).filter(([x, z, room, ...cubes]) => {
      const hit = Math.abs(x) < half + room && Math.abs(z) < half + room
      if (hit) for (const cube of cubes) this.solid.hide(cube)
      return !hit
    })
  }

  /** A thing comes to life: its hidden cubes pop out. */
  grow(t: number) {
    const thing = this.things[t]
    if (thing.up) return
    thing.up = true
    thing.grown.forEach((cube, k) => this.solid.show(cube, 0.15 + k * 0.12))
    thing.wake?.()
    if (!thing.perch) return
    this.perches.push(thing.perch)
    // A tree in leaf bends in the wind, all in one piece. Its perch says how, for whoever sits there to go along.
    const [x, ground, z] = [tx(thing.tile), this.h[thing.tile], tz(thing.tile)]
    for (const cube of [...thing.cubes, ...thing.grown, ...(thing.extra ?? [])]) this.solid.bendy(cube, thing.give ?? 0, ground, x, z)
    thing.perch.push(thing.give ?? 0, ground, x, z)
  }

  private wake(tile: number) {
    const s = this.isle[tile]
    const look = this.look(tile)
    this.alive[tile] = 1
    this.stirred = this.time
    this.lifeCount++
    this.awake[s]++
    note(this.lifeCount / this.total, 0.07)
    if (this.bed[tile]) {
      if (this.turf[tile] && this.lid[tile] >= 0) this.solid.paint(this.lid[tile], look.green[tile % 3])
      return
    }
    this.solid.paint(this.cap[tile], look.green[tile % 3])
    this.solid.poke(this.cap[tile], 2)
    // Snow melts away, straw and reeds turn green, pebbles stay as they are.
    this.dress[tile].forEach((cube, k) => {
      if (look.dress === 'snow') this.solid.hide(cube, k * 0.15)
      else if (look.dress !== 'pebble') this.solid.paint(cube, look.tuft)
    })
    for (let k = 0; k < look.tufts; k++) {
      const size = 0.12 + this.chance(tile * 7 + k) * 0.1
      const at = this.room(tile, size, tile * 3 + k * 1000)
      if (!at) continue
      at.push(this.solid.add(tx(tile) + at[0], this.h[tile] + size, tz(tile) + at[1], size, size * 2.2, size, k ? look.green[(tile + k) % 3] : look.tuft, -2 - tile, false))
      this.blade(at[3], tile)
      this.solid.show(at[3], 0.1 + k * 0.1)
    }
    if (this.chance(tile * 13) < look.flowers + (this.bees.length ? BEES : 0)) this.flower(tile, 0.4)
    for (const t of this.standing[tile]) if (this.things[t].auto) this.grow(t)
  }

  // --- animals and seeds --------------------------------------------------------------------

  /**
   * How well a small noise at (x, z) is heard from where the camera is: 1 from close up with the view on it, less from
   * further off, and nothing at all from where the whole island is in view, or with the view somewhere else.
   */
  hears(x: number, z: number) {
    return this.near * Math.max(0, 1 - Math.hypot(x - this.centre.x - this.view[0], z - this.centre.z - this.view[1]) / 9)
  }

  /** Open ground: nothing stands there and no water runs through. */
  free(tile: number) {
    return !!this.exists[tile] && !this.bed[tile] && !this.standing[tile].length
  }

  /**
   * Places to settle in a ring round a spot, for a gathering: only where there is open ground to settle on, about level
   * with the middle. A fire pit may stand at the top of a cliff, and nobody sleeps on thin air.
   * @param far how far out the ring lies
   * @param level how high the ground in the middle is
   * @returns for each place: x, the height of the ground there, z, and the angle it lies at
   */
  around(x: number, z: number, far: number, level: number, n = 12) {
    const places: number[][] = []
    for (let k = 0; k < n; k++) {
      const a = (k / n) * 6.283 + 0.4
      const u = tileAt(x + Math.sin(a) * far, z + Math.cos(a) * far)
      if (!this.free(u) || Math.abs(this.h[u] - level) > 0.6) continue
      // Well inside its tile: the next one over may be sea.
      places.push([Math.min(tx(u) + 0.3, Math.max(tx(u) - 0.3, x + Math.sin(a) * far)), this.h[u], Math.min(tz(u) + 0.3, Math.max(tz(u) - 0.3, z + Math.cos(a) * far)), a])
    }
    return places
  }

  /**
   * Open ground where a tree fits the place, and would not hide anything but another tree from the south, where the
   * camera starts. And not within two tiles of the old tree, which is big enough to grow into it (as in `deal`).
   */
  plantable(tile: number) {
    const behind = [[-1, -1], [0, -1], [1, -1], [1, -2], [2, -3]].map(([di, dj]) => step(tile, di, dj))
    const hides = behind.some((u) => u >= 0 && this.standing[u].some((t) => !this.things[t].perch))
    const old = this.things.find((thing) => thing.key === 'tree:old')
    const cramped = !!old && Math.max(Math.abs(tx(tile) - tx(old.tile)), Math.abs(tz(tile) - tz(old.tile))) < 3
    return this.free(tile) && !hides && !cramped && ['oak', 'fruit'].includes(this.look(tile).tree)
  }

  /** A sprout. It turns into a tree as soon as its tile is alive. */
  sapling(tile: number) {
    if (!this.free(tile)) return
    this.clear(tile, 0.19) // grass and flowers make way for the trunk
    const t = this.tree(tile, this.look(tile).tree, true)
    if (this.alive[tile]) this.after(0.8, () => this.grow(t))
  }

  /** Birds go from tree top to tree top. The flock carries seeds and drops them on open ground. */
  flit = (bird: Critter) => {
    const { critters } = this
    const fly = (x: number, y: number, z: number, then?: () => void) => {
      const far = Math.hypot(x - bird.x, z - bird.z)
      critters.go(bird, x, y, z, 0.5 + far / 6, 0.5 + far * 0.1, then)
    }
    bird.roost = undefined
    if (this.seat === bird) this.seat = undefined // off the tortoise, if that is where it was
    let tile = -1
    for (let k = 0; k < 60 && tile < 0; k++) {
      const u = Math.floor(Math.random() * W * D)
      if (this.plantable(u)) tile = u
    }
    if (tile >= 0 && this.seeds > 0 && bird.kind === 'bird' && Math.random() < 0.6) {
      this.seeds--
      bird.rest = 0.6
      return fly(tx(tile), this.h[tile] + 2.2, tz(tile), () => {
        this.bits.spawn(bird.x, bird.y, bird.z, 0, 0, 0, 0.14, BARK, 1, this.h[tile], 0)
        this.after(0.45, () => this.sapling(tile))
      })
    }
    bird.rest = 2 + Math.random() * 6
    // Now and then the tortoise will do for a perch: it gets a look for that, and takes the bird along.
    const tortoise = bird.kind === 'bird' && !this.seat && Math.random() < 0.15 ? this.tortoise : undefined
    if (tortoise && critters.lively(tortoise)) {
      this.seat = bird
      this.seated = false
      bird.rest = 6 + Math.random() * 8
      return fly(tortoise.x, tortoise.y + 0.81, tortoise.z, () => {
        this.seated = true
        critters.look(tortoise, bird, 2)
      })
    }
    const perch = this.perches[Math.floor(Math.random() * this.perches.length)]
    if (perch && Math.random() < 0.85) {
      bird.roost = perch
      fly(perch[0] + any() * 0.2, perch[1], perch[2] + any() * 0.2)
    } else if (tile >= 0) fly(tx(tile), this.h[tile], tz(tile))
  }
  /** The tortoise, once it is up and about. */
  private get tortoise() {
    return this.critters.list.find((c) => c.kind === 'tortoise' && c.thing === undefined)
  }

  /**
   * Somebody comes for something that lies on the ground: of those that walk, the nearest with open ground all the way;
   * failing that, a bird from wherever it is.
   * @param then called with whoever it was, once it has got there
   * @returns whether anybody is on the way
   */
  fetch(x: number, y: number, z: number, then: (c: Critter) => void) {
    const { critters } = this
    const far = (c: Critter) => Math.hypot(x - c.x, z - c.z)
    const about = (kinds: string[], most: number) => critters.list.filter((c) => kinds.includes(c.kind) && critters.lively(c) && c.next && c !== this.seat && far(c) < most).sort((a, b) => far(a) - far(b))
    // A straight line over ground at one height, with nothing standing in it but what stands at either end.
    const clear = (c: Critter) => {
      const steps = Math.ceil(far(c) * 2)
      for (let k = 1; k < steps; k++) {
        const u = tileAt(c.x + ((x - c.x) * k) / steps, c.z + ((z - c.z) * k) / steps)
        const end = u === tileAt(x, z) || u === tileAt(c.x, c.z)
        if (!this.exists[u] || this.bed[u] || Math.abs(this.h[u] - y) > 0.1 || (this.standing[u].length && !end)) return false
      }
      return Math.abs(c.y - y) < 0.1
    }
    const walker = about(['bunny', 'chick', 'marmot', 'tortoise', 'goat'], 4.5).find(clear)
    const c = walker ?? about(['bird'], Infinity)[0]
    if (!c) return false
    // It stops just short. Those that hop go in hops; a bird comes in one flight.
    const d = Math.max(far(c), 0.01)
    const [sx, sz] = [c.x, c.z]
    const [ex, ez] = [x - ((x - sx) / d) * 0.3, z - ((z - sz) / d) * 0.3]
    const hops = walker && SMALL.includes(c.kind) ? Math.max(1, Math.round(d / 0.8)) : 1
    const [dur, arc] = !walker ? [0.6 + d / 6, 0.5 + d * 0.1] : SMALL.includes(c.kind) ? [0.32, 0.4] : [d * (c.kind === 'tortoise' ? 2.2 : 0.9), 0]
    c.roost = undefined
    const leg = (k: number) => critters.go(c, sx + ((ex - sx) * k) / hops, y, sz + ((ez - sz) * k) / hops, dur, arc, () => (k < hops ? leg(k + 1) : then(c)))
    leg(1)
    return true
  }

  /**
   * A wooden sign beside the way onto a bridge: a board on a short post, with a few lines written on it. It faces south,
   * where the camera starts. A click reads it: one of its lines, and the next one the next time.
   * @param di which way the bridge leaves this tile, and `dj`: the sign stands to one side of that
   */
  signpost(tile: number, di: number, dj: number, lines: string[]) {
    let read = 0
    const t = this.thing(tile, { tip: 'A sign. Somebody wrote on it', fuss: 'You have read that sign twice through now. It has not changed. That is what makes it a sign.', play: () => this.say(lines[read++ % lines.length], 'sign') })
    const [x, z] = [-di * 0.12 - dj * 0.25, -dj * 0.12 + di * 0.25]
    this.put(t, x, 0.2, z, 0.1, 0.4, 0.08, BARK)
    this.put(t, x, 0.58, z, 0.5, 0.36, 0.08, 0xc9a06b)
    // Three lines of writing, lying on the face of the board.
    for (const [dy, wide] of [[0.1, 0.34], [0, 0.38], [-0.1, 0.24]]) this.put(t, x - 0.19 + wide / 2, 0.58 + dy, z + 0.05, wide, 0.04, 0.02, 0x6b5a5a)
  }

  /** A slow wander from tile to tile, for animals with nothing left to do. */
  stroll = (c: Critter) => {
    const here = tileAt(c.x, c.z)
    const [di, dj] = NEAR[Math.floor(Math.random() * 4)]
    const u = step(here, di, dj)
    c.rest = 3 + Math.random() * 7
    if (u >= 0 && this.free(u) && this.isle[u] === this.isle[here] && Math.abs(this.h[u] - this.h[here]) < 0.1) this.critters.go(c, tx(u), this.h[u], tz(u), c.kind === 'snail' ? 7 : c.kind === 'tortoise' ? 2.6 : 1.1)
  }

  /** Swimmers drift from one tile of their water to the next; on a dry bed they walk it. */
  paddle = (c: Critter) => {
    const here = tileAt(c.x, c.z)
    const swims = (u: number) => u >= 0 && this.exists[u] && this.mark[u] === this.mark[here] && !this.blocked[u] && !!this.filled[u]
    // No two of them in one tile: where another swimmer is, or is making for, is taken. (Ducklings go where their mother goes.)
    const taken = (u: number) => this.critters.list.some((o) => o !== c && !o.hidden && o.next && FLOAT[o.kind] !== undefined && tileAt(o.t < 1 ? o.to[0] : o.x, o.t < 1 ? o.to[2] : o.z) === u)
    if (c.kind === 'fish' && this.aimed && this.filled[here] && Math.hypot(this.at.x - c.x, this.at.z - c.z) < 4.5) {
      // A fish comes to see what the cursor is: one tile of its water at a time, whichever brings it nearer. Two that
      // come for the same thing stop a tile apart.
      const far = (u: number) => Math.hypot(tx(u) - this.at.x, tz(u) - this.at.z)
      const open = NEAR.map(([di, dj]) => step(here, di, dj)).filter((u) => swims(u) && !taken(u))
      const to = open.reduce((a, b) => (far(b) < far(a) ? b : a), taken(here) ? (open[0] ?? here) : here)
      c.rest = 0.15
      if (to !== here) return this.critters.go(c, tx(to) + any() * 0.2, this.h[to] + FLOAT.fish, tz(to) + any() * 0.2, 0.7)
      c.face = Math.atan2(this.at.x - c.x, this.at.z - c.z)
      return
    }
    const [di, dj] = NEAR[Math.floor(Math.random() * 4)]
    const u = step(here, di, dj)
    c.rest = 0.5 + Math.random() * 3
    if (u >= 0 && this.exists[u] && this.mark[u] === this.mark[here] && !this.blocked[u] && (this.filled[u] || !this.filled[here]) && !taken(u))
      this.critters.go(c, tx(u) + any() * 0.3, this.h[u] + (this.filled[u] ? (FLOAT[c.kind] ?? 0.3) : 0), tz(u) + any() * 0.3, 1.8)
  }

  /** Bunnies, marmots and the crab make for the nearest bare ground on their isle. Where they land, it wakes. */
  hop = (c: Critter) => {
    const here = tileAt(c.x, c.z)
    const s = this.isle[here]
    this.source(here, 1.5)
    // Breadth first over the tiles it can stand on, to the nearest one with bare ground beside it.
    const from = new Map([[here, here]])
    const queue = [here]
    let to = -1
    for (let q = 0; q < queue.length && to < 0; q++)
      for (const [di, dj] of RING) {
        const u = step(queue[q], di, dj)
        if (u < 0 || !this.exists[u] || this.isle[u] !== s) continue
        if (!this.alive[u] && this.wakeAt[u] === Infinity) to = queue[q]
        else if (!from.has(u) && !this.bed[u] && !this.standing[u].length && Math.abs(this.h[u] - this.h[queue[q]]) < 1.2) {
          from.set(u, queue[q])
          queue.push(u)
        }
      }
    if (to < 0) {
      // Nothing left to do but potter about.
      to = queue[1 + Math.floor(Math.random() * Math.min(8, queue.length - 1))] ?? here
      c.rest = 1.5 + Math.random() * 4
    } else c.rest = 0.2 + Math.random() * 0.5
    while (to !== here && from.get(to) !== here) to = from.get(to)!
    if (to === here) return
    const crab = c.kind === 'crab'
    this.critters.go(c, tx(to) + any() * 0.3, this.h[to], tz(to) + any() * 0.3, crab ? 0.5 : 0.34, crab ? 0 : 0.45)
    if (crab) c.face += Math.PI / 2 // sideways, as crabs do
  }

  // --- snails, stars, a balloon -------------------------------------------------------------

  /** Seven snails, one hiding on each of the seven isles: by preference right behind a tree, seen from where the camera starts. Blue until found, red after. */
  private hideSnails() {
    const all = this.extra('secret', { icon: 'snail/ff7a6b', hint: 'Seven isles, seven shells. They stay blue until somebody says hello. Same as anyone.' })
    ;['island', 'meadow', 'snow', 'mountain', 'swamp', 'beach', 'volcano'].forEach((name, k) => {
      const s = this.index(name)
      const free = this.tiles[s].filter((u) => this.mark[u] === '.' && !this.standing[u].length && !this.bed[u])
      const behind = free.filter((u) => {
        const south = step(u, 0, 1)
        return south >= 0 && this.standing[south].some((t) => this.things[t].perch)
      })
      const among = behind.length ? behind : free
      const tile = among[Math.floor(rnd(this.seed * 97 + k * 13 + 5) * among.length)]
      const at = this.room(tile, 0.36, this.seed * 7 + k) ?? [0.25, 0.25] // so that no grass comes up through it
      const snail = this.critters.spawn('snail', tx(tile) + at[0], this.h[tile], tz(tile) + at[1], 0x86b6f5)
      this.snailOn[s] = false
      Object.assign(snail, { key: `snail${k}`, tip: 'A snail. In no hurry, and right about it', face: rnd(k + this.seed) * 6.3, yaw: rnd(k + this.seed) * 6.3, hidden: s > 0 })
      if (s) this.sleepers[s].push(snail)
      snail.onPat = () => {
        this.pat(snail)
        if (this.greeted.has(snail)) return
        // Found: its shell turns from blue to red, and from now on it goes for walks.
        this.greeted.add(snail)
        snail.next = this.stroll
        this.snailOn[s] = true
        this.critters.paint(snail, [1], 0xff7a6b)
        this.critters.paint(snail, [2, 3], 0xe9605a)
        const n = ++this.snails[0]
        this.say(n < 7 ? `A snail! That is ${n} of seven. There is one on every isle, and each believes it is the only snail.` : 'A snail! That is all seven. They have never met. You are the only thing they have in common.', 'snail')
        if (n === 7) all('A secret: seven snails, one on every isle. They are off on a very slow race. Nobody will finish, and all of them are winning.')
      }
      if (name !== 'meadow') return
      // The meadow's snail, once it has been said hello to, gets a lift: it rides about on the tortoise from then on.
      let riding = 0 // 1 on its way up, 2 up
      this.ticks.push(() => {
        const { tortoise } = this
        if (!tortoise || !this.greeted.has(snail)) return
        if (riding === 2) return void Object.assign(snail, { x: tortoise.x, y: tortoise.y + 0.8 * (1 - tortoise.nap * 0.3), z: tortoise.z, face: tortoise.yaw })
        if (riding || snail.t < 1) return
        if (this.seat) return void (this.seat.rest = 0) // a bird is sitting there: it makes way
        this.seat = snail
        riding = 1
        snail.next = undefined
        this.critters.go(snail, tortoise.x, tortoise.y + 0.8, tortoise.z, 3, 0.7, () => (riding = 2))
      })
    })
  }

  /**
   * Now and then somebody turns up who has nothing to do with anything: a capybara in the hot spring on the snow, or an axolotl
   * in the bog of the swamp, each once there is water there. One visit in four, and not the same on the next. Nothing counts it.
   */
  private rareVisitor(kind = Math.random() < 0.25 ? (Math.random() < 0.5 ? 'capybara' : 'axolotl') : undefined) {
    if (kind !== 'capybara' && kind !== 'axolotl') return
    const guest = this.critters.spawn(kind, 0, -40, 0, kind === 'capybara' ? 0xb98a5e : 0xffb3c7)
    Object.assign(guest, { hidden: true, tip: kind === 'capybara' ? 'A capybara. It found the hot water and stopped wanting things' : 'An axolotl. It is smiling. It cannot not' })
    const water = this.tiles[this.index(kind === 'capybara' ? 'snow' : 'swamp')].filter((u) => this.mark[u] === (kind === 'capybara' ? 'h' : 'g'))
    const arrive = () => {
      if (!guest.hidden || water.some((u) => !this.filled[u])) return
      const home = water[water.length - 1]
      Object.assign(guest, { x: tx(home), y: this.h[home] + (kind === 'capybara' ? 0.14 : 0.26), z: tz(home), hidden: false, face: 0.5 })
      if (kind === 'axolotl') guest.next = this.paddle
      this.after(2, () => this.say(kind === 'capybara' ? 'Somebody is sitting in the hot spring with an orange on its head. Nobody saw it arrive. It has the calm of somebody with no notifications.' : 'Somebody pink is swimming in the bog, smiling. Nobody saw it arrive. It smiles like that at everything. Do not read into it.', kind))
    }
    this.onFill.push(arrive)
    arrive()
  }

  /** At night a star falls across the sky every so often. Catch it, and it is a wish: flowers, wherever its dust comes down. */
  private fallingStars() {
    const caught = this.extra('secret', { icon: 'star/fff3a8', hint: 'At night, things fall. Catch one. It will not fix anything, but you will have caught one.' })
    const star = (this.shooting = this.critters.spawn('star', 0, -40, 0, 0xfff3a8, undefined, 3))
    Object.assign(star, { hidden: true, grow: 1.5, tip: 'A falling star. Click fast, wish slow' })
    let wait = 5
    const was = new Vector3() // where it was a moment ago: the tail is laid between there and where it is now
    const wish = this.act('star', () => {
      this.say('You caught a falling star. Wherever its dust comes down, something flowers. This is not how stars work. Do not write in.', 'falling star')
      caught('A secret: you caught a falling star. Make a wish. Not that one. A smaller one.')
      const living = this.tiles.flat().filter((u) => this.alive[u] && !this.bed[u])
      for (let k = 0; k < 14 && living.length; k++) {
        const u = living[Math.floor(Math.random() * living.length)]
        this.bits.spawn(star.x, star.y, star.z, (tx(u) - star.x) / 1.2, 3, (tz(u) - star.z) / 1.2, 0.14, 0xfff3a8, 1.2, this.h[u], 0, (2 * (star.y - this.h[u] + 3.6)) / 1.44, 3)
        this.after(1.2, () => this.flower(u, 0))
      }
    })
    star.onPat = () => {
      if (star.hidden) return
      wish()
      star.hidden = true
    }
    this.ticks.push((dt) => {
      if (!star.hidden) {
        // A fine tail behind it, so that it is seen from far off: thick and short-lived by the head, thin and lasting
        // further back, and now and then a mote that drifts down out of it.
        for (const [size, life] of [[0.11, 0.2], [0.08, 0.45], [0.05, 0.9]]) {
          const t = Math.random()
          this.bits.spawn(was.x + (star.x - was.x) * t + any() * 0.06, was.y + (star.y - was.y) * t + any() * 0.06, was.z + (star.z - was.z) * t + any() * 0.06, 0, 0, 0, size, 0xfff3a8, life, NEVER, 0, 0, 3)
        }
        if (Math.random() < dt * 12) this.bits.spawn(star.x, star.y, star.z, any() * 0.4, 0, any() * 0.4, 0.05, 0xffffff, 1.4, NEVER, 0, 0.5, 3)
        was.set(star.x, star.y, star.z)
        return
      }
      if (this.fast || !this.night || (wait -= dt) > 0) return
      wait = 9 + Math.random() * 10
      // From one side of the sky to the other, slanting down, over the land there is.
      const a = Math.random() * 6.283
      const far = this.span + 3
      Object.assign(star, { x: this.centre.x + Math.cos(a) * far, y: GROUND + 10.5, z: this.centre.z + Math.sin(a) * far, hidden: false })
      was.set(star.x, star.y, star.z)
      this.notice(() => (star.hidden ? undefined : [star.x, star.y, star.z]), 5)
      this.critters.go(star, this.centre.x - Math.cos(a + 0.7) * far, GROUND + 6, this.centre.z - Math.sin(a + 0.7) * far, 5.5, 0, () => (star.hidden = true))
    })
  }

  /** When the whole world is awake a balloon comes over to see, and stays. A click on it gets confetti, and the ending rolled again. */
  private balloon() {
    const { centre, span } = this
    const balloon = this.critters.spawn('balloon', centre.x + span + 12, GROUND + 13, centre.z - 6)
    balloon.tip = 'A balloon. It came to see what you did'
    const drift = () => this.critters.go(balloon, centre.x + any() * span, GROUND + 5.5 + Math.random() * 2, centre.z + any() * span, 14 + Math.random() * 8)
    const up = () => [balloon.x, balloon.y + 2.4, balloon.z]
    this.critters.go(balloon, centre.x + 2, GROUND + 6, centre.z + 1, 10, 0, () => (balloon.next = drift))
    this.after(1.5, () => this.epilogue(up)) // it starts on its piece almost as soon as it is in sight
    this.after(2.5, () => this.notice(up, 6)) // everybody watches it come in
    balloon.onPat = () => {
      if (this.hush) return this.stop() // in the middle of saying its piece: that will do
      this.notice(up, 3)
      this.word('thank you', balloon.x, balloon.y + 3.6, balloon.z)
      this.epilogue(up) // and it says it all again, from the top
      for (let k = 0; k < 30; k++) this.bits.spawn(balloon.x, balloon.y + 0.5, balloon.z, any() * 4, 2 + Math.random() * 3, any() * 4, 0.13, [0xff8fb0, 0xffd45c, 0x9be3d0, 0x86b6f5, 0xc4a4f0][k % 5], 2.6, NEVER, 0, 5)
    }
  }

  /**
   * The end, in words. Whoever is in the balloon has a few things to say, and they roll up over the island like the
   * credits of a film, with fireworks from about where things got better. Then the card. The space bar, or a click
   * anywhere on the picture, cuts it short; and once it is over, a click on the balloon rolls it again.
   * @param up where the balloon is, for those on the ground to look at
   */
  private epilogue(up: () => number[]) {
    const done = () => {
      this.hush = this.reel = undefined
      this.ended = true
      // The camera has stayed back and drifted round for as long as it lasted: from here the view stays where it is.
      this.orbit = Math.min(this.orbit, this.time)
      if (this.show?.free) this.show.until = Math.min(this.show.until, this.time)
    }
    if (this.fast) return done()
    // Whatever was still waiting to be said goes into the log unsaid, with a dot on the journal: the picture is the balloon's now.
    for (const line of this.lines.splice(0)) {
      if (this.moot(line)) continue
      this.keep(line)
      this.fresh.push(line)
    }
    const land = this.tiles.flat().filter((u) => this.exists[u])
    const lines = [
      'Hello. Up here, in the balloon. I have been watching. That is most of what a balloon is for.',
      `You woke a whole island by knocking on it. ${this.knocks} knocks. I counted. Somebody should.`,
      'I should say it was a game. The island was never dry. Somebody drew it dry, so that you could fix it.',
      'That is most of what a game is: a problem made by hand, in a shape you can solve.',
      'The other kind does not come in that shape. You know that. You came here anyway.',
      'And for a few minutes, everything you touched got better. Notice how that felt. It is why we build these.',
      'I will be honest, since it is only us. Somebody made this small world hoping you would think well of them.',
      'That is all anybody is doing, most days. It is just rarely this many cubes.',
      'None of it was real. All of it happened. I have never been able to explain that.',
      'The island does not need you now. That was the point. Go and knock on something real. Gently.',
    ]
    // Slow enough to read every line twice as it goes by: as long, all told, as it would take to say them one by one.
    const seconds = Math.round(lines.reduce((all, line) => all + held(line), 0))
    const run = ++this.reels
    const live = () => run === this.reels && !!this.reel
    this.reel = { lines, seconds }
    this.cut = false
    this.hush = done
    for (const line of lines) this.keep(line, ['balloon', -1, ''])
    // Those on the ground look up at it now and then, and from about where things got better there are fireworks.
    for (let at = 0; at < seconds; at += 6) this.after(at, () => live() && this.notice(up, 2.5, Infinity, 0.5))
    for (let at = seconds * 0.45; at < seconds * 0.92; at += 1.4) this.after(at, () => live() && this.firework(land[Math.floor(Math.random() * land.length)]))
    this.after(seconds, () => live() && done())
    // The camera stays back and goes on drifting round for as long as it lasts, unless the player has taken the view.
    if (this.show?.free && this.time < this.show.until) this.show.until = this.orbit = this.time + seconds
  }
  /** A firework, over a tile: any tile, if none is given, and nothing where there is no land. Some of those who are up look at it. */
  firework(u = Math.floor(Math.random() * W * D)) {
    if (!this.exists[u]) return
    const color = [0xff8fb0, 0xffd45c, 0x9be3d0, 0x86b6f5, 0xc4a4f0, 0xffffff][Math.floor(Math.random() * 6)]
    for (let k = 0; k < 28; k++) this.bits.spawn(tx(u), 8 + (u % 3), tz(u), Math.cos(k * 0.9) * (3 + (k % 3)), 3 * Math.sin(k * 1.7) + 2, Math.sin(k * 0.9) * (3 + (k % 3)), 0.16, color, 1.4, NEVER, 0, 5, 3)
    this.notice([tx(u), 8 + (u % 3), tz(u)], 1.2, Infinity, 0.4) // some of them look at this one, some at the next
  }

  /** The camera goes to one of the friends and stays with it, until the view is moved by hand. */
  follow(id: string) {
    this.jump = 0
    const all = this.critters.list.filter((c) => (c.friend ?? c.kind) === id && !c.hidden)
    const c = all.find((one) => one.thing === undefined) ?? all[0]
    if (!c) return this.say('Nobody of that name is about just now. They have lives. Small ones, but still.')
    this.following = c
    this.going = { x: c.x, z: c.z, zoom: Math.max(this.zoom, this.close) }
  }
  /** The view goes to a place and stays there, close up: asked for from the map, by a click on what a line was about. */
  visit(tile: number) {
    this.following = undefined
    const high = Math.max(this.h[tile] + 0.9, ...this.things.filter((thing) => thing.tile === tile).flatMap((thing) => [...thing.cubes, ...thing.grown].filter((cube) => this.solid.on(cube)).map((cube) => this.solid.top(cube)))) // its leaves count: a tree is mostly top
    this.going = { x: tx(tile), z: tz(tile), zoom: this.within(high, Math.max(this.zoom, this.close)) }
  }
  /**
   * A zoom to go and look at something with, brought down to the closest that still takes in all of it. The view looks
   * at the ground a thing stands on, and from close to that, whatever reaches or hangs high above it is off the top of
   * the picture: the cloud over its hill, for one.
   * @param high the height of the top of it
   */
  private within(high: number, zoom: number) {
    if (!this.far) return zoom
    const tan = Math.tan((((this.camera?.fov ?? 30) / 2) * Math.PI) / 180)
    // How far off the camera has to stand, for every unit of height over the ground it looks at. Seen from as low as it
    // comes, 0.85 of a height shows, and what is high is nearer too, by about half its height; the picture is taken to
    // end a little under its top edge, and on a narrow screen the land sits higher in it to begin with.
    const off = Math.max(0, high - 1.5) * (0.53 + 0.85 / (tan * (0.88 - this.spare * 0.85)))
    return Math.min(zoom, this.far / off)
  }
  /** How far in the view goes when the map takes it to see somebody or something: most of the way there is. */
  private get close() {
    return this.far ? this.far / (NEAREST * 1.25) : (2.8 * this.span) / 9.45
  }

  /** An arrow stands over something for a while and bobs: this one. A click on the arrow is a click on what it points at. */
  private point(at: () => number[], until: () => boolean, hit: () => void) {
    const arrow = (this.arrow ??= this.critters.spawn('arrow', 0, -40, 0, POINTER, undefined, 1.7))
    const from = this.time
    arrow.hidden = false
    arrow.onPat = hit
    this.pointing = () => {
      const [x, y, z] = at()
      Object.assign(arrow, { x, y: y + 0.25 + Math.abs(Math.sin((this.time - from) * 4)) * 0.3, z, yaw: this.yaw, face: this.yaw })
      if (this.time - from < 14 && !until()) return
      arrow.hidden = true
      this.pointing = undefined
    }
  }

  /** What the animals make of each other, and what shows of what they are up to. */
  private company(dt: number) {
    const { critters, bits, seat, tortoise } = this
    for (const c of critters.list) {
      // A duck with its head under sends a drop or two up; a dragon that yawns lets a little fire go.
      if (c.act === 'dip' && Math.random() < dt * 4) bits.spawn(c.x + Math.sin(c.yaw) * 0.3, c.y + 0.12, c.z + Math.cos(c.yaw) * 0.3, any() * 1.2, 2, any() * 1.2, 0.09, WATER, 0.6, c.y, 0)
      if (c.act === 'yawn' && c.kind === 'dragon' && c.acted > 0.7 && c.acted < 1.3 && Math.random() < dt * 25)
        bits.spawn(c.x + Math.sin(c.yaw) * 0.35, c.y + 0.45, c.z + Math.cos(c.yaw) * 0.35, Math.sin(c.yaw) * 1.2 + any() * 0.4, 0.9, Math.cos(c.yaw) * 1.2 + any() * 0.4, 0.09, 0xffb347, 0.5, NEVER, 0, -1, 2.2)
      if (c.kind !== 'dragon' || c.t >= 1 || c.hidden) continue
      // Small things on the ground do not care for a dragon overhead: they are off, a hop away, and then look back at it.
      for (const small of critters.list) {
        if (!SMALL.includes(small.kind) || !small.next || !critters.lively(small) || c.y - small.y < 0.6 || Math.hypot(c.x - small.x, c.z - small.z) > 1.7) continue
        const here = tileAt(small.x, small.z)
        const far = (u: number) => Math.hypot(tx(u) - c.x, tz(u) - c.z)
        const to = RING.map(([di, dj]) => step(here, di, dj))
          .filter((u) => u >= 0 && this.free(u) && this.isle[u] === this.isle[here] && Math.abs(this.h[u] - this.h[here]) < 0.1)
          .reduce((a, b) => (far(b) > far(a) ? b : a), here)
        if (to === here) continue
        this.word(VOICES[small.friend ?? small.kind] ?? '', small.x, small.y + 0.6, small.z)
        small.rest = 1.6
        critters.go(small, tx(to) + any() * 0.3, this.h[to], tz(to) + any() * 0.3, 0.32, 0.5, () => critters.look(small, c, 1.5))
      }
    }
    // A bird that has picked the tortoise for a perch lands wherever the tortoise has got to by then, and goes along with it.
    if (!seat || seat.kind !== 'bird') return
    if (!tortoise || seat.hidden) return void (this.seat = undefined)
    const at = [tortoise.x, tortoise.y + 0.81 * (1 - tortoise.nap * 0.3), tortoise.z]
    if (!this.seated) seat.to = at
    else if (seat.t < 1) this.seat = undefined // called away: to a fire, to an apple
    else Object.assign(seat, { x: at[0], y: at[1], z: at[2], face: tortoise.yaw })
  }

  /** Grass and flowers lean away from the cursor as it passes, and stand up again behind it. */
  private sway(dt: number) {
    const { leaning, solid } = this
    for (const lean of leaning.values()) lean[2] = lean[3] = 0
    if (this.aimed && !this.touch) {
      const here = tileAt(this.at.x, this.at.z)
      for (let dj = -2; dj <= 2; dj++)
        for (let di = -2; di <= 2; di++) {
          const u = step(here, di, dj)
          if (u < 0) continue
          for (const [x, z, , ...cubes] of this.spots[u] ?? []) {
            const [ax, az] = [tx(u) + x - this.at.x, tz(u) + z - this.at.z]
            const far = Math.hypot(ax, az)
            if (far > 1.5 || far < 0.01) continue
            const push = (0.6 * (1 - far / 1.5) ** 2) / far
            for (const cube of cubes) {
              if (!this.soft.has(cube)) continue
              const lean = leaning.get(cube) ?? [0, 0, 0, 0, this.h[u]]
              lean[2] = ax * push
              lean[3] = az * push
              leaning.set(cube, lean)
            }
          }
        }
    }
    const ease = Math.min(1, dt * 9)
    for (const [cube, lean] of leaning) {
      lean[0] += (lean[2] - lean[0]) * ease
      lean[1] += (lean[3] - lean[1]) * ease
      const still = !lean[2] && !lean[3] && Math.abs(lean[0]) + Math.abs(lean[1]) < 0.004
      solid.lean(cube, still ? 0 : lean[0], still ? 0 : lean[1], lean[4])
      if (still) leaning.delete(cube)
    }
  }

  // --- input ------------------------------------------------------------------------------

  private aim(x: number, y: number) {
    this.ndc.set((x / innerWidth) * 2 - 1, 1 - (y / innerHeight) * 2)
  }
  /** The point of the plain under the cursor. */
  private ground(out: Vector3) {
    if (!this.camera) return null
    this.raycaster.setFromCamera(this.ndc, this.camera)
    return this.raycaster.ray.intersectPlane(FLOOR, out)
  }
  private onMove = (e: PointerEvent) => {
    const { press } = this
    const finger = this.fingers.get(e.pointerId)
    if (finger && this.fingers.size === 2) {
      // Two fingers: a pinch zooms about the point between them, a twist turns the world.
      const other = [...this.fingers.values()].find((f) => f !== finger)!
      this.hands()
      const apart = Math.hypot(finger[0] - other[0], finger[1] - other[1])
      const angle = Math.atan2(finger[1] - other[1], finger[0] - other[0])
      finger.splice(0, 2, e.clientX, e.clientY)
      this.aim((finger[0] + other[0]) / 2, (finger[1] + other[1]) / 2)
      this.zoomTo((this.zoom * Math.hypot(finger[0] - other[0], finger[1] - other[1])) / Math.max(apart, 1))
      const turn = Math.atan2(finger[1] - other[1], finger[0] - other[0]) - angle
      this.yaw += Math.atan2(Math.sin(turn), Math.cos(turn))
      if (Math.abs(turn) > 0.02) this.notes.turned = true
      if (Math.abs(turn) > 0.02) this.learn('t')
      this.here()
      return
    }
    this.aim(e.clientX, e.clientY)
    this.outside = e.target !== this.canvas // the buttons and the cards are not the world
    this.here()
    if (!press) return
    if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6) {
      press.moved = true
      this.hands()
    }
    if (press.moved && press.turn && !this.away) {
      this.yaw -= (e.clientX - press.last) * 0.006
      this.notes.turned = true
    }
    press.last = e.clientX
  }
  private onDown = (e: PointerEvent) => {
    this.aim(e.clientX, e.clientY) // a tap on a touch screen arrives without any move before it
    this.outside = e.target !== this.canvas
    this.here()
    if ((e.button !== 0 && e.button !== 2) || this.outside) return
    this.release()
    this.fingers.set(e.pointerId, [e.clientX, e.clientY])
    // The left button or one finger takes hold of the ground and moves it; the right button, or shift, turns the world.
    const turn = e.button === 2 || e.shiftKey
    this.press = { x: e.clientX, y: e.clientY, last: e.clientX, moved: this.fingers.size > 1, turn, grab: turn || this.fingers.size > 1 ? null : this.ground(new Vector3()) }
  }
  private onUp = (e: PointerEvent) => {
    const { press } = this
    this.fingers.delete(e.pointerId)
    this.press = undefined
    if (press && !press.moved && e.type === 'pointerup' && e.button === 0) this.click()
  }
  /** A touch of the controls ends the slow turn round the finished world. */
  private release() {
    this.orbit = 0
    this.going = this.following = undefined
    if (!this.show?.free) return
    // And the view is the player's from where it stands now, not from where they had left it.
    this.pan.set(this.view[0], 0, this.view[1])
    this.zoom = this.view[2]
    this.show = undefined
    this.blend = this.widen = 0
  }
  /**
   * The player moves the view. Whatever the camera was doing by itself to keep the action in the picture ends there: the view
   * is the player's from where it stands, and stays theirs until things have settled. A knock is not a move, and does not end it.
   */
  private hands() {
    const [x, z] = [this.centre.x + this.pan.x, this.centre.z + this.pan.z]
    this.pan.x += (this.wide.x - x) * this.widen
    this.pan.z += (this.wide.z - z) * this.widen
    this.zoom += (this.wide.zoom - this.zoom) * this.widen
    this.widen = 0
    this.mine = true
  }
  /** Whether the camera is off looking at something: until it is back, the controls that move the view wait. */
  private get away() {
    return !!this.show && this.time < this.show.until && !this.show.free
  }
  private onWheel = (e: WheelEvent) => {
    if (e.target !== this.canvas) return // the map scrolls by itself
    e.preventDefault()
    this.here()
    if (this.away) return
    this.release()
    this.hands()
    this.zoomTo(this.zoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0016)))
  }
  private onMenu = (e: Event) => e.preventDefault()
  private onKey = (e: KeyboardEvent) => {
    // The space bar is for the line at the bottom: read, next. While the ending rolls, it cuts that short. (Unless a
    // button has it: then it is that button's.)
    if (e.key === ' ') {
      if (e.type !== 'keydown' || e.repeat || (e.target as Element | null)?.closest?.('button')) return
      if (this.hush) this.stop()
      else this.next()
      return
    }
    if (e.type === 'keydown') this.release()
    if (e.type === 'keydown') this.hands()
    if (e.type === 'keydown') this.here()
    // A key pressed along with ⌘ or Ctrl is the browser's (⌘+ makes the page larger, ⌘S saves it), and a Mac never
    // says when such a key comes up again: it does not count as held.
    if (e.type === 'keydown' && !e.metaKey && !e.ctrlKey && !e.altKey) this.keys.add(e.key.toLowerCase())
    else this.keys.delete(e.key.toLowerCase())
  }
  /** The window has lost the keyboard: whatever key was down is not heard coming up, so none is held any more. */
  private onBlur = () => this.keys.clear()
  /**
   * Zooming in goes towards whatever is under the cursor; zooming all the way out drifts home to the middle.
   * @param aimed false to zoom in on the middle of the view instead: for the keys
   */
  private zoomTo(zoom: number, aimed = true) {
    this.learn('z')
    // No nearer than a fixed distance, whatever the shape of the window. (How many times nearer than the whole world
    // that is depends on the window: a narrow one sees the whole world from further off.)
    zoom = Math.min(Math.max(zoom, 0.7), this.far ? Math.max(1.2, this.far / NEAREST) : (3.5 * this.span) / 9.45)
    if (zoom > this.zoom) {
      if (aimed && this.ground(_p)) this.pan.lerp(_p.sub(this.centre).setY(0), 1 - this.zoom / zoom).clampLength(0, this.span)
    } else if (zoom < this.zoom) this.pan.multiplyScalar((zoom - 0.7) / (this.zoom - 0.7))
    this.zoom = zoom
  }

  /** What is under the cursor: a thing (0 and up), an animal (PET and up), a tile (-2 and down), or nothing (-1). */
  private pick() {
    this.aimed = false
    if (!this.camera || this.outside) return -1
    this.raycaster.setFromCamera(this.ndc, this.camera)
    // A falling star is slight and quick: aiming close by it is aiming at it.
    const star = this.shooting
    if (star && !star.hidden && this.raycaster.ray.distanceSqToPoint(this.at.set(star.x, star.y, star.z)) < 0.8) return ((this.aimed = true), PET + this.critters.list.indexOf(star))
    // The nearest thing that is somebody's: the frog's cloud and the bees belong to nobody and let a click through.
    const owner = (h: { object: unknown; instanceId?: number }) => (h.object === this.critters.mesh ? 0 : (h.object === this.solid.mesh ? this.solid : this.wet).owner[h.instanceId!])
    const hit = this.raycaster.intersectObjects([this.solid.mesh, this.wet.mesh, this.critters.mesh]).find((h) => owner(h) !== -1)
    this.aimed = !!hit
    if (!hit) return -1
    this.at.copy(hit.point)
    if (hit.object !== this.critters.mesh) return owner(hit)
    const critter = this.critters.of(hit.instanceId!)
    return critter.thing ?? PET + this.critters.list.indexOf(critter)
  }

  /** The player has had enough of the ending. */
  private stop() {
    this.cut = true
    this.hush?.()
  }
  private click() {
    if (this.hush) return this.stop() // the ending is rolling: a click anywhere on the picture ends it, and does nothing else
    this.jump = 0 // whatever this click brings about is said at once
    const id = this.pick()
    const now = performance.now()
    this.clicks = [...this.clicks.filter((at) => now - at < 3000), now]
    if (this.clicks.length > 11) this.aside('hammer', NOTICED.hammer)
    if (id >= PET) {
      const c = this.critters.list[id - PET]
      this.record('p', c.key ?? c.friend ?? c.kind)
      this.pet(c)
    } else if (id >= 0) {
      if (this.strike(id)) this.record('k', this.things[id].key!)
    } else if (id <= -2) {
      // Bare ground or water: a little bounce, a little splash.
      const tile = -2 - id
      this.solid.poke(this.cap[tile], 3)
      if (this.lid[tile] >= 0) this.solid.poke(this.lid[tile], 3)
      if (this.filled[tile] && !this.hot[tile] && this.lid[tile] < 0) this.skip(tile)
      else if (++this.notes.ground === 25) this.aside('ground', NOTICED.ground)
    }
  }
  /** A click on an animal: a pat, unless it has something better to do with a click. */
  private pet(c: Critter) {
    this.as([c.friend ?? c.kind, -1, ''], () => (c.onPat ? c.onPat() : this.pat(c)))
  }

  /** Bits of a cube fly off. */
  rubble(cube: number, tile: number, n: number) {
    this.solid.mesh.getColorAt(cube, _c)
    const color = _c.getHex()
    for (let k = 0; k < n; k++)
      this.bits.spawn(tx(tile) + any(), this.solid.top(cube), tz(tile) + any(), any() * 8, 5 + Math.random() * 5, any() * 8, 0.16 + Math.random() * 0.16, color, 1.6, this.h[tile], 0.35)
  }
  /** A thing falls to pieces. */
  burst(t: number) {
    const thing = this.things[t]
    for (const cube of thing.cubes) {
      this.rubble(cube, thing.tile, 3)
      this.solid.hide(cube)
    }
    thing.cubes = []
    thing.spent = true
  }
  /** One more thing found. */
  score(tile: number) {
    const s = this.isle[tile]
    this.breath()
    this.found++
    this.lastFind = this.time
    // The last thing on an isle: whatever part of it nothing reached wakes as well, so that no patch is left bare.
    if (++this.foundOn[s] === this.quota[s]) for (const u of this.tiles[s]) if (this.wakeAt[u] === Infinity) this.wakeAt[u] = this.time + 2.5 + rnd(u) * 2
  }

  /**
   * One knock on a thing.
   * @returns whether it did anything
   */
  strike(id: number): boolean {
    let thing = this.things[id]
    if (thing.guard !== undefined && this.things[thing.guard].hits) thing = this.things[(id = thing.guard)]
    // What this brings about is said about the thing: whoever is shut in it or asleep on it, in plain view, or else
    // the first word or two of its label. Where it stands and what colour it is go along.
    const held = this.critters.list.find((c) => c.thing === id && !c.hidden)
    const about = held ? (held.friend ?? held.kind) : (thing.tip?.split(/[,.]/)[0].replace(/^An? /, '') ?? '')
    // And what it looks like, for a picture of it in the log: its boxes, from where it stands.
    const boxes = thing.cubes
      .filter((cube) => this.solid.on(cube))
      .map((cube) => {
        const [x, y, z, wide, high, deep] = this.solid.at(cube)
        this.solid.mesh.getColorAt(cube, _c)
        return [x - tx(thing.tile), y - this.h[thing.tile], z - tz(thing.tile), wide, high, deep, _c.getHex()]
      })
    return this.as([about, thing.tile, this.hue(thing), boxes], () => this.knock(thing, id))
  }
  private knock(thing: Thing, id: number): boolean {
    for (const cube of thing.cubes) this.solid.poke(cube, thing.hits ? 9 : 5)
    // Whoever is near looks round at it, and a bird that was sitting in it is off.
    this.notice([tx(thing.tile), this.h[thing.tile] + 0.6, tz(thing.tile)], 1, 3.6)
    for (const c of this.critters.list) if (c.roost && c.roost === thing.perch && c.t >= 1 && c.next && !this.fast) c.rest = 0
    const shout = (text: string) => this.word(text, tx(thing.tile), Math.max(this.h[thing.tile] + 0.8, ...thing.cubes.filter((cube) => this.solid.on(cube)).map((cube) => this.solid.top(cube))) + 0.2, tz(thing.tile))
    if (!thing.hits) {
      // Somebody's wish that this can grant comes before any use of its own.
      if (this.onKnock.some((heard) => heard(thing))) {
        shout('rustle')
        return true
      }
      // How often this one thing has been knocked on gets noticed: a thing with something to say about being fussed
      // over says it at the sixth knock, and one with nothing to give gets a word at the fifth, the tenth and the twentieth.
      const times = this.fast ? 0 : (this.fussed.get(thing) ?? 0) + 1
      this.fussed.set(thing, times)
      if (times === 6 && thing.fuss) this.after(5, () => this.aside(`fuss:${thing.key}`, thing.fuss!))
      if (thing.tap) {
        this.knocks++
        shout(thing.sound ?? 'tap')
        thing.tap()
        return true
      }
      if (thing.play) {
        // A toy: it does something, and that is all. Nothing to find, nothing to count, nothing to remember.
        shout(thing.sound ?? '')
        thing.play()
        return false
      }
      note(0.1 + Math.random() * 0.2, 0.05)
      if (times) this.notes.idle++
      if (times === 5) this.aside('nothing5', NOTICED.nothing5)
      else if (times === 10) this.aside('nothing10', NOTICED.nothing10)
      else if (times === 20) this.aside('nothing20', NOTICED.nothing20)
      return false
    }
    this.knocks++
    thing.hits--
    thump()
    const sound = thing.sound ?? 'knock'
    if (thing.hits > 0) {
      shout(sound)
      if (thing.cubes.length) this.rubble(thing.cubes[0], thing.tile, 5)
      this.dent(thing, id)
      thing.onHit?.(thing.hits)
      return true
    }
    shout(`${sound.toUpperCase()}!`)
    thing.hits = thing.tip = undefined // whatever its label said is no longer so
    for (const cube of thing.dents ?? []) this.solid.hide(cube)
    this.score(thing.tile)
    if (!thing.keep) this.burst(id)
    thing.onBreak?.()
    this.closer(thing.tile)
    return true
  }

  /** A knock that does not break a thing still leaves its mark, and the mark stays: that is how it shows there is more to come. */
  private dent(thing: Thing, t: number) {
    const n = (thing.dented = (thing.dented ?? 0) + 1) - 1
    const { solid } = this
    if (thing.marks) {
      for (const cube of thing.marks[n] ?? []) {
        if (!solid.on(cube)) solid.show(cube)
        else {
          this.rubble(cube, thing.tile, 4)
          solid.hide(cube)
        }
      }
      return
    }
    const dents = (thing.dents ??= [])
    const { tile } = thing
    if (thing.sleeper) {
      // Somebody asleep stirs: a small "!" stands over it until the next knock.
      if (!n) dents.push(this.put(t, 0.3, 1.04, 0, 0.08, 0.24, 0.08, 0xffd45c), this.put(t, 0.3, 0.84, 0, 0.08, 0.08, 0.08, 0xffd45c))
      return
    }
    // Anything else cracks: one crack down the face of it that looks south, one across its top, and another pair with every knock.
    const boxes = thing.cubes.filter((cube) => solid.on(cube)).map((cube) => [cube, ...solid.at(cube)])
    if (!boxes.length) return
    const pick = (area: (b: number[]) => number, far: (b: number[]) => number) => {
      const most = Math.max(...boxes.map(area))
      return boxes.filter((b) => area(b) >= most * 0.3).reduce((a, b) => (far(b) > far(a) ? b : a))
    }
    const side = n % 2 ? 1 : -1
    const dark = (cube: number) => {
      solid.mesh.getColorAt(cube, _c)
      return _c.multiplyScalar(0.6).getHex()
    }
    const crack = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: number) => dents.push(this.put(t, x - tx(tile), y - this.h[tile], z - tz(tile), sx, sy, sz, color))
    const [fc, fx, fy, fz, fw, fh, fd] = pick((b) => b[4] * b[5], (b) => b[3] + b[6] / 2)
    const wide = Math.min(0.08, fw * 0.16)
    crack(fx + side * 0.2 * fw, fy + side * 0.08 * fh, fz + fd / 2 + 0.02, wide, fh * 0.6, 0.04, dark(fc))
    crack(fx + side * 0.2 * fw + wide, fy + side * 0.08 * fh - fh * 0.16, fz + fd / 2 + 0.02, wide, fh * 0.26, 0.04, dark(fc))
    const [tc, ux, uy, uz, uw, uh, ud] = pick((b) => b[4] * b[6], (b) => b[2] + b[5] / 2)
    crack(ux - side * 0.16 * uw, uy + uh / 2 + 0.02, uz + side * 0.06 * ud, Math.min(0.08, uw * 0.16), 0.04, ud * 0.55, dark(tc))
  }

  // --- every frame ------------------------------------------------------------------------

  /** One step of the game itself, with nothing of how it is shown: timers, water, waking ground, animals. */
  private advance(dt: number) {
    const time = (this.time += dt)
    const { bits, solid, drift } = this
    // The next line comes up once the one before it has had its time, and a breath after that. Never sooner. And not
    // while something just found has the picture to itself (`breath`).
    this.jump = -1
    if (this.lines.length && time >= this.until + 1 && time >= this.still) {
      const line = this.due()
      if (line) this.voice(line)
    }
    for (let k = this.todo.length - 1; k >= 0; k--) if (this.todo[k].at <= time) this.todo.splice(k, 1)[0].run()
    if (time - this.tick > 0.2) {
      this.tick = time
      this.flow()
    }
    for (let t = 0; t < W * D; t++) if (!this.alive[t] && this.wakeAt[t] <= time) this.wake(t)
    for (const tick of this.ticks) tick(dt, time)
    // Night and day. At night whoever belongs to the day stays where it is, curls up and sleeps; by day it is the owls' turn.
    for (const c of this.critters.list) {
      const tired = !c.hidden && c.thing === undefined && c.t >= 1 && (this.night ? DAYTIME.includes(c.kind) : c.kind === 'owl')
      // Bedtime starts with a yawn, each in its own time; getting up, with a stretch.
      if (tired) {
        c.rest = Math.max(c.rest, 0.6)
        if (!this.abed.has(c) && Math.random() < dt * 2.5) {
          this.abed.add(c)
          this.critters.perform(c, 'yawn')
        }
      } else if (this.abed.delete(c) && !c.hidden && c.t >= 1) this.after(1.2 + Math.random() * 0.8, () => this.critters.perform(c, 'stretch'))
      const sleeps = tired && this.abed.has(c) && c.act !== 'yawn'
      c.nap += ((sleeps ? 1 : 0) - c.nap) * Math.min(1, dt * 2.5)
      if (c.nap > 0.7 && Math.random() < dt * 0.3) bits.spawn(c.x + 0.12, c.y + 0.45 * c.grow, c.z, 0.12, 0.4, 0, 0.09, 0xffffff, 1.5, NEVER, 0, -0.3)
    }

    // Rain where it rains, water and lava off every edge and down every step.
    for (let k = this.showers.length - 1; k >= 0; k--) {
      const [x, z, until] = this.showers[k]
      if (time > until) this.showers.splice(k, 1)
      else {
        this.stir(x, z)
        for (let n = 0; n < 3; n++) {
          const a = Math.random() * 6.3
          const r = Math.random() * 3
          bits.spawn(x + Math.cos(a) * r, 7.2, z + Math.sin(a) * r, 0, -6, 0, 0.1, 0x9fd6ff, 1.2, GROUND + 0.4, 0)
        }
      }
    }
    for (const [x, top, z, di, dj, foot, beyond, hot] of this.falls) {
      // Nothing falls where land has come up beyond the edge. And a fall nobody can see is not drawn: there are only so
      // many loose cubes to go round, and from close to, where a fall is most of the picture, it gets more of them.
      if (beyond >= 0 && this.exists[beyond]) continue
      if (hot && this.memo.set) continue // lava that has set like glass, for the while that it has (see the volcano), does not fall
      if (this.camera && (Math.abs(_p.set(x, (top + foot) / 2, z).project(this.camera).x) > 1.2 || Math.abs(_p.y) > 1.5)) continue
      for (let n = 0; n < 2; n++)
        if (Math.random() < dt * (5 + 6 * this.near)) {
          const out = 0.3 + Math.random() * 0.5
          bits.spawn(x + any() * 0.9 * Math.abs(dj), top - 0.1, z + any() * 0.9 * Math.abs(di), di * out, 0, dj * out, 0.1 + Math.random() * 0.07, hot ? LAVA : 0x9fd6ff, 1.6, foot, 0)
        }
      // Where it lands, mist: small, and low. (Steam, where it is lava.)
      if (Math.random() < dt * 4) bits.spawn(x + any() * 0.8 * Math.abs(dj) + di * 0.12, foot + 0.06, z + any() * 0.8 * Math.abs(di) + dj * 0.12, any() * 0.3, 0.25, any() * 0.3, 0.12, 0xffffff, 0.9, NEVER, 0, -0.15)
    }
    // The frog's cloud on its way.
    if (drift) {
      const far = Math.hypot(drift.to[0] - drift.x, drift.to[1] - drift.z)
      if (far > 0.1) {
        drift.x += ((drift.to[0] - drift.x) / far) * Math.min(far, dt * 5)
        drift.z += ((drift.to[1] - drift.z) / far) * Math.min(far, dt * 5)
        this.stir(drift.x, drift.z, 0.5)
      } else if (drift.then) {
        const { then } = drift
        drift.then = undefined
        then()
      }
      drift.cubes.forEach((cube, k) => solid.place(cube, drift.x + CLOUD[k][0], 7.6 + CLOUD[k][1] + Math.sin(time + k) * 0.06, drift.z + CLOUD[k][2]))
    }
    // Whoever is asleep breathes out a little cloud now and then.
    for (const thing of this.things)
      if (thing.sleeper && thing.hits && this.open[this.isle[thing.tile]] && Math.random() < dt * 0.8) bits.spawn(tx(thing.tile) + 0.2, this.h[thing.tile] + 0.7, tz(thing.tile), 0.2, 0.5, 0, 0.1, 0xffffff, 1.5, NEVER, 0, -0.3)
    // Bees do their rounds, unhurried.
    const [hx, hy, hz, since] = this.hive
    this.bees.forEach((bee, k) => {
      const a = time * (0.2 + k * 0.025) + k * 2.4
      const round = [Math.cos(a) * (2 + k * 0.6) + Math.sin(a * 2.3) * 0.6, GROUND + 1.1 + Math.sin(time * 1.8 + k) * 0.2 + (k % 3) * 0.4, Math.sin(a * 0.9) * (2 + k * 0.55)]
      // Out of the crate one after another, round and round above it in a widening spiral, and only then away.
      const out = Math.min(1, Math.max(0, (time - since - k * 0.3) / 4.5))
      const up = Math.min(1, out * 3)
      const swirl = [hx + Math.cos(time * 5 + k * 0.7) * 0.6 * up, hy + up * 1.5, hz + Math.sin(time * 5 + k * 0.7) * 0.6 * up]
      const away = Math.max(0, out * 1.5 - 0.5) ** 2 * (3 - 2 * Math.max(0, out * 1.5 - 0.5))
      solid.place(bee, swirl[0] + (round[0] - swirl[0]) * away, swirl[1] + (round[1] - swirl[1]) * away, swirl[2] + (round[2] - swirl[2]) * away)
    })

    // Stuck for a while? Nothing is said: the button for a tip shows a dot, for whoever would like one.
    this.stuck = time - this.lastFind > 60 && this.things.some((thing) => (thing.hits || thing.todo) && thing.clue && this.open[this.isle[thing.tile]])

    // And until the first thing has been found, the one to start with stirs every few seconds: twice, as if somebody
    // knocked on it from inside. Whoever has not clicked on anything yet is shown where; whoever has found one thing
    // knows how it goes. (Which thing that is, the isle says: the boulder on the spring, with the first river under it.)
    if (!this.found && !this.fast && time >= this.beckon) {
      this.beckon = time + 4
      const first = this.things.find((thing) => thing.start)
      const jolt = () => {
        if (first?.hits && !this.found) for (const cube of first.cubes) solid.poke(cube, 7) // a fifth bigger for a moment: a knock is a quarter
      }
      jolt()
      this.after(0.25, jolt)
    }

    // The end: everything found. Whatever the water missed wakes too, and blossom drifts down.
    if (!this.done && this.found === this.quota.reduce((a, b) => a + b)) {
      this.done = true
      for (let t = 0; t < W * D; t++) if (this.exists[t] && this.wakeAt[t] === Infinity) this.wakeAt[t] = time + 2 + rnd(t) * 2
    }
    const won = this.done && this.lifeCount === this.total
    if (won && !this.over) {
      // Once: the camera pulls back to take it all in and drifts round it, and everybody jumps for joy.
      this.over = true
      this.say('The whole world is awake. You did that, with one finger. Do not let it go to your head. Let it go to your head a little.')
      this.show = { x: this.centre.x, z: this.centre.z, zoom: 1, until: time + 14, free: true }
      this.orbit = time + 14
      for (const critter of this.critters.list) critter.pet = 1
      for (let k = 0; k < 5; k++) this.after(k * 0.16, () => note(0.3 + k * 0.17, 0.14))
      // The balloon comes once what is still being said has been said (or after twenty seconds of that, at most): what
      // it has to say takes the whole picture.
      const come = (tries: number) => ((this.lines.length || this.time < this.until + 1) && tries < 34 ? this.after(0.5, () => come(tries + 1)) : this.balloon())
      this.after(3, () => come(0))
      // The rest of the end is said from the balloon, as soon as it is there. A game that is only being put back as it was
      // has had its ending.
      this.notes.took ||= this.notes.played
      if (this.fast) this.ended = true
    }
    if (time < this.orbit) this.yaw += dt * 0.09
    if (won) {
      if (Math.random() < dt * 20) bits.spawn(this.centre.x + any() * 2 * this.span, 10, this.centre.z + any() * 2 * this.span, any(), -1, any(), 0.15, BLOSSOM[Math.floor(Math.random() * 3)], 6, GROUND, 0, 1.5)
    }

    this.company(dt)
    this.critters.update(dt, time)
    this.watched = this.watched.filter(([c, until]) => time < until && !c.hidden)
    for (const [c] of this.watched) this.stir(c.x, c.z, 0.5)
  }

  update(dt: number, camera: PerspectiveCamera, width: number, height: number) {
    const { bits, solid, key, sky } = this

    // Moving the view: the ground follows the hand that holds it, and the arrow keys (or WASD) slide it.
    // Done here, before the camera moves, so that the cursor is read against the view it was drawn in.
    const { away, going } = this
    // Going along with something that is gone by now, or whose time is up: the view stays where that has left it.
    const spot = going?.at && (this.time < going.until! ? going.at() : undefined)
    if (going?.at && !spot) this.going = undefined
    else if (going) {
      // Being taken somewhere, to stay: to a thing the tip points out, or along with a friend (or whatever else is on
      // the move) wherever it goes.
      if (this.following?.hidden) this.following = undefined
      if (this.following) Object.assign(going, { x: this.following.x, z: this.following.z })
      if (spot) Object.assign(going, { x: spot[0], z: spot[1] })
      const ease = 1 - Math.exp(-dt * 4)
      // A move that brings the view in for a look goes a touch too far and then steps back by as much: the step back
      // is how one can tell that it has arrived. (Not when it goes along with something: that does not arrive.)
      going.past ??= !going.at && !this.following && going.zoom > this.zoom * 1.08 ? STEP : 1
      // (No further out than the view is ever allowed to go: otherwise it would never arrive, and never let go.)
      _p.set(going.x - this.centre.x, 0, going.z - this.centre.z).clampLength(0, this.span)
      this.pan.x += (_p.x - this.pan.x) * ease
      this.pan.z += (_p.z - this.pan.z) * ease
      this.zoom += (going.zoom * going.past - this.zoom) * ease
      const there = !this.following && !going.at && Math.hypot(_p.x - this.pan.x, _p.z - this.pan.z) < 0.02 && Math.abs(this.zoom / (going.zoom * going.past) - 1) < 0.005
      if (there && going.past > 1) going.past = 1
      else if (there) this.going = undefined
    }
    this.pointing?.()
    if (!away && this.press?.moved && this.press.grab && this.ground(_p)) {
      this.pan.add(_p.subVectors(this.press.grab, _p).setY(0))
      this.learn('m')
    }
    const held = (a: string, b: string) => (!away && (this.keys.has(a) || this.keys.has(b)) ? 1 : 0)
    const right = held('arrowright', 'd') - held('arrowleft', 'a')
    const ahead = held('arrowup', 'w') - held('arrowdown', 's')
    if (right || ahead) this.learn('m')
    const pace = (dt * this.span * 2.2) / this.zoom // a little over a screen every second, at any zoom
    this.pan.x += (Math.cos(this.yaw) * right - Math.sin(this.yaw) * ahead) * pace
    this.pan.z += (-Math.sin(this.yaw) * right - Math.cos(this.yaw) * ahead) * pace
    const spin = held('e', 'e') - held('q', 'q')
    this.yaw += spin * dt * 2.2
    if (spin) this.notes.turned = true
    if (this.notes.turned) this.learn('t')
    // And + and − zoom, about the middle of the view: where the cursor happens to lie has no say in what a key does.
    const closer = held('+', '=') - held('-', '_')
    if (closer) this.zoomTo(this.zoom * Math.exp(closer * dt * 1.1), false)
    this.pan.clampLength(0, this.span)
    this.camera = camera

    this.advance(dt)
    const time = this.time
    const won = this.over
    // What has been noticed is written down every few seconds, with the time: coming back can then be told from never having left.
    this.notes.played += dt
    if ((this.unsaved += dt) > 5) {
      this.unsaved = 0
      this.notes.seen = Date.now()
      try {
        localStorage.setItem(`${this.store}/notes`, JSON.stringify(this.notes))
      } catch {
        // no storage: it is noticed for this visit only
      }
    }
    if (!this.notes.turned && this.notes.played > 300 && this.open.filter(Boolean).length > 2) this.aside('unturned', `${NOTICED.unturned} ${this.touch ? 'Two fingers, and a twist.' : 'Right-drag turns it.'}`)
    this.nightFor = this.night ? this.nightFor + dt : 0
    if (this.nightFor > 180) this.aside('night', NOTICED.night)
    solid.update(dt)
    this.wet.update(dt)
    bits.update(dt)

    // The mood follows the land: dusty at first, fresh at the end. And the lantern can turn the day into night.
    const life = this.lifeCount / this.total
    const dusk = (this.dusk += ((this.night ? 1 : 0) - this.dusk) * (1 - Math.exp(-dt * 1.6)))
    this.bg.set(0xeadcc2).lerp(_c.set(0xd9f0e4), life).lerp(_c.set(0x3b416e), dusk)
    key.color.set(0xffe9cf).lerp(_c.set(0xcfd6ff), dusk)
    key.intensity = 3.2 - 1.5 * dusk
    sky.color.set(0xe6efff).lerp(_c.set(0xa9b1de), dusk)
    sky.groundColor.set(0xffd9c4).lerp(_c.set(0x5d6494), dusk)
    sky.intensity = 1.25 - 0.2 * dusk
    const style = document.documentElement.style
    const paper = `#${toned(this.bg).getHexString()}`
    if (paper !== this.paper) {
      style.setProperty('--bg', (this.paper = paper))
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', paper) // what a browser tints its own bars with
    }
    const ink = dusk > 0.5 ? '#f4efff' : ''
    if (ink !== this.ink) {
      style.setProperty('--ink', (this.ink = ink) || '#3f3b4e')
      style.setProperty('--key', ink ? '74%' : '40%') // how light the words that name a thing are written: see the page
    }
    // Fireflies come out with the dark, and give a little light: as many of those in view as there are lamps for.
    for (let n = 0; n < 4; n++) {
      const u = Math.floor(Math.random() * W * D)
      if (dusk <= 0.5 || !this.exists[u] || Math.random() >= dt * 22) continue
      const [x, y, z] = [tx(u) + any(), this.h[u] + 0.3 + Math.random() * 1.4, tz(u) + any()]
      const drift = [any() * 0.4, any() * 0.25, any() * 0.4]
      bits.spawn(x, y, z, drift[0], drift[1], drift[2], 0.1, 0xe9ff8a, 4, NEVER, 0, 0, 3.5)
      const free = this.fireflies.find((firefly) => time > firefly.until)
      if (!free || Math.abs(_p.set(x, y, z).project(camera).x) > 1 || Math.abs(_p.y) > 1) continue
      free.lamp.position.set(x, y, z)
      free.drift.fromArray(drift)
      free.until = time + 4
    }
    for (const { lamp, drift, until } of this.fireflies) {
      const left = until - time
      lamp.intensity = left > 0 ? 3 * Math.min(1, left * 2, (4 - left) * 4) : 0 // it comes on quickly and goes out with its firefly
      lamp.position.addScaledVector(drift, dt)
    }
    this.lamplight(this.lamps.some((lamp) => lamp.intensity > 0.004))

    // The wind. Tree tops move a little in any air; once the windmill turns it blows in earnest, and the grass goes with it.
    this.gust += ((this.memo.wind ? 1 : 0) - this.gust) * Math.min(1, dt * 0.6)
    solid.wind.value.set(0.1, 0.11 * this.gust, time)
    for (const c of this.critters.list) {
      // Whoever sits in a tree top goes along with it.
      const { roost } = c
      if (roost?.[3] && c.t >= 1 && Math.hypot(c.x - roost[0], c.z - roost[2]) < 0.6) [c.ox, c.oz] = blown(solid.wind.value, roost[3], c.y - roost[4], roost[5], roost[6])
      else c.ox = c.oz = 0
    }
    // Water is never quite still: its surface rises and falls in waves that travel (the shader sees to that), and it glints here and there.
    this.wet.wind.value.set(0.025, 0, time)
    for (let n = 0; n < 6; n++) {
      const u = Math.floor(Math.random() * W * D)
      // (By night they are a paler gold, and brighter against the dark.)
      if (this.filled[u] && this.exists[u] && !this.hot[u] && Math.random() < dt * 30) bits.spawn(tx(u) + any() * 0.8, this.h[u] + 0.48, tz(u) + any() * 0.8, 0, 0, 0, 0.07, dusk > 0.5 ? 0xfff0b8 : 0xffffff, 0.9, NEVER, 0, 0, dusk > 0.5 ? 2.6 : 1.6)
    }

    // Camera: fitted to the land there is, moved by dragging, turned with the right button, zoomed with the wheel.
    const tan = Math.tan((camera.fov / 2) * (Math.PI / 180))
    const { pitch } = this
    // On a narrow screen there is room to spare above and below the land: it keeps clear of the line being said, at the bottom.
    const words = width < 900 ? Math.min(120 / height, 0.3) : 0
    this.spare = words
    // How far off the camera has to be to take in land that reaches this far from its middle: room for the land across
    // the screen, and for it plus hills, trees and the cloud up and down.
    const fitted = (span: number) => Math.max((span + 2.2) / (tan * (width / height) * 0.92), (span * Math.sin(TILT) + 3.2) / (tan * 0.92 * (1 - words)))
    const ease = 1 - Math.exp(-dt * 1.6)
    const was = [this.centre.x, this.centre.z]
    this.centre.lerp(this.goal, ease)
    this.span += (this.reach - this.span) * ease
    const fit = fitted(this.span)
    // A view the player has zoomed in on stays on what it shows while the land grows round it, and when the window is
    // made another shape: its place and its nearness are kept. A view of the whole world grows (or is fitted afresh)
    // along with the world, and the ones in between do a bit of both.
    const close = Math.min(1, Math.max(0, (this.zoom - 1) * 2))
    this.pan.x -= (this.centre.x - was[0]) * close
    this.pan.z -= (this.centre.z - was[1]) * close
    this.zoom *= (fit / (this.far || fit)) ** close
    // Following the action: while something set off by a knock is on the move outside the player's view, the camera widens
    // to keep it in the picture together with what the player was looking at, and glides back once it has settled.
    this.action = this.action.filter((at) => at[2] > time)
    if (!this.action.length) {
      // Once the action is over the view stays where it followed it to: it is the player's from there, as if by hand.
      if (this.widen > 0.01) this.hands()
      this.mine = false
    }
    const look = [this.centre.x + this.pan.x, this.centre.z + this.pan.z]
    const frame = this.mine || this.going || won ? undefined : framed(this.action, look, this.yaw, fit / this.zoom, tan, width / height, pitch, words)
    if (frame) {
      // It sets out from the player's own view, and then keeps up with the action without hurry.
      if (this.widen < 0.01) Object.assign(this.wide, { x: look[0], z: look[1], zoom: this.zoom })
      const keep = 1 - Math.exp(-dt * 2.5)
      this.wide.x += (frame[0] - this.wide.x) * keep
      this.wide.z += (frame[1] - this.wide.z) * keep
      this.wide.zoom += (Math.max(0.7, fit / frame[2]) - this.wide.zoom) * keep
    }
    this.widen += ((frame ? 1 : 0) - this.widen) * (1 - Math.exp(-dt * (frame ? 1.8 : 1.3)))
    const own = { x: look[0] + (this.wide.x - look[0]) * this.widen - this.centre.x, z: look[1] + (this.wide.z - look[1]) * this.widen - this.centre.z, zoom: this.zoom + (this.wide.zoom - this.zoom) * this.widen }
    // Now and then it goes to look at something far off: new land, mostly. It does not come back: once it is there, or
    // its time is up, the view stays, and is the player's from then on.
    const { show } = this
    if (show && time < show.until) this.blend += (1 - this.blend) * (1 - Math.exp(-dt * 3))
    const zoom = own.zoom + ((show?.zoom ?? own.zoom) - own.zoom) * this.blend
    const panX = own.x + ((show ? show.x - this.centre.x : own.x) - own.x) * this.blend
    const panZ = own.z + ((show ? show.z - this.centre.z : own.z) - own.z) * this.blend
    this.view = [panX, panZ, zoom]
    if (show && (time >= show.until || (!show.free && this.blend > 0.985))) {
      this.pan.set(panX, 0, panZ)
      this.zoom = zoom
      this.show = undefined
      this.blend = this.widen = 0
      // Brought in closer to see new land: it has arrived, and says so with the same small step back.
      if (!show.free && zoom > own.zoom * 1.08) this.going = { x: this.centre.x + panX, z: this.centre.z + panZ, zoom: zoom / STEP, past: 1 }
    }
    const dist = fit / zoom
    this.far = fit
    // Up close the camera comes down for a look from the side, as into a diorama; from further off it looks down as it always did.
    this.near = Math.min(1, Math.max(0, (34 - dist) / 20))
    this.pitch += (TILT - 0.17 * this.near * this.near * (3 - 2 * this.near) - pitch) * (1 - Math.exp(-dt * 5))
    // (Only from far enough off to see the land whole: close up, what is being looked at sits in the middle.)
    const lift = (words * 0.85 * dist * tan * (1 - this.near)) / Math.sin(pitch)
    const x = this.centre.x + panX + Math.sin(this.yaw) * lift
    const z = this.centre.z + panZ + Math.cos(this.yaw) * lift
    const shake = (this.shaking *= Math.exp(-dt * 5)) * dist * 0.012
    camera.position.set(x + Math.sin(this.yaw) * Math.cos(pitch) * dist + any() * shake, 1.5 + Math.sin(pitch) * dist + any() * shake, z + Math.cos(this.yaw) * Math.cos(pitch) * dist + any() * shake)
    camera.lookAt(x, 1.5, z)
    camera.updateMatrixWorld()
    // The things still to be found stir now and then: one at a time, a small jolt, and only those in the picture. On a
    // touch screen there is no cursor to turn into a hand and no label to read: this is all that says what can be touched.
    // Only what counts towards finishing, and only where a touch does something: what takes a knock, the fairy ring by
    // way of its mushrooms, and the cactus, which asks for its rain when it is knocked. Never scenery, toys or secrets.
    if (time >= this.twitch) {
      this.twitch = time + 2.2 + Math.random() * 2.2
      const seen = this.things.filter((thing) => {
        if (!(thing.hits || (thing.todo && (thing.touched || thing.tap))) || !thing.clue || !this.open[this.isle[thing.tile]]) return false
        _p.set(tx(thing.tile), this.h[thing.tile] + 0.5, tz(thing.tile)).project(camera)
        return Math.abs(_p.x) < 0.92 && Math.abs(_p.y) < 0.88 && _p.z < 1
      })
      const thing = seen[Math.floor(Math.random() * seen.length)]
      if (thing) {
        for (const cube of thing.touched?.() ?? thing.cubes) solid.poke(cube, STIR)
        // Somebody asleep, or shut in, has no cubes to speak of: it is the animal that stirs.
        const who = this.critters.list.find((c) => !c.hidden && c.thing !== undefined && this.things[c.thing] === thing)
        if (who) who.pet = Math.max(who.pet, 0.45)
      }
    }
    // By night the sea round the land glitters, a very little: a pale speck here and there, each just big enough to
    // show from where the camera stands. It is all there is to say that the dark is water.
    if (dusk > 0.5 && Math.random() < dt * 2.5) {
      const [a, out] = [Math.random() * 6.283, this.span + 1 + Math.random() * 14]
      const far = _p.set(this.centre.x + Math.cos(a) * out, 0.05, this.centre.z + Math.sin(a) * out).distanceTo(camera.position)
      bits.spawn(_p.x, 0.05, _p.z, 0, 0, 0, far * 0.0013, 0xcfe0ff, 1.4, NEVER, 0, 0, 1.6)
    }
    // The sun and its shadows keep the whole of it covered.
    key.position.set(this.centre.x - 14, 24, this.centre.z + 10)
    key.target.position.copy(this.centre)
    const edge = this.span * 1.25 + 4
    Object.assign(key.shadow.camera, { left: -edge, right: edge, top: edge, bottom: -edge })
    key.shadow.camera.updateProjectionMatrix()
    // Butterflies turn up once a third of it is alive, and go to bed at night.
    this.butterflies.mesh.visible = life > 0.33 && dusk < 0.5
    this.butterflies.update(time, dt, _p.set(this.centre.x, GROUND - 0.2, this.centre.z).divideScalar(0.28), (this.span * 0.8) / 0.28)

    // Whatever the cursor rests on gives a small wobble; things that can be broken or tapped, and animals, also change the cursor.
    const over = this.press?.moved || this.touch ? -1 : this.pick() // a finger does not hover: on a touch screen the world is only asked what is where when it is tapped
    this.sway(dt)
    const thing = over >= 0 && over < PET ? this.things[over] : undefined
    if (over !== this.hover) {
      this.hover = over
      if (thing) for (const cube of thing.play ? [...thing.cubes, ...thing.grown] : thing.cubes) solid.poke(cube, thing.hits ? 3.5 : 2)
    }
    const breakable = thing && (thing.hits || thing.tap || thing.play || (thing.guard !== undefined && this.things[thing.guard].hits))
    const animal = over >= PET ? this.critters.list[over - PET] : undefined
    let tip = (animal ? (animal.tip ?? this.friends.find((f) => f.id === (animal.friend ?? animal.kind))?.name) : thing?.tip) ?? ''
    // The label stays up until the cursor moves on, or the view does: animals do not hold still to be read.
    const view = camera.position.x + camera.position.y * 1.7 + camera.position.z * 2.9
    if (tip) this.label = [tip, this.ndc.x, this.ndc.y, view]
    else if (Math.hypot(this.ndc.x - this.label[1], this.ndc.y - this.label[2]) < 0.004 && Math.abs(view - this.label[3]) < 0.02) tip = this.label[0]
    document.body.style.cursor = this.press?.moved ? 'grabbing' : breakable || over >= PET ? 'pointer' : ''

    if ((this.tune -= dt) < 0) {
      this.tune = 0.5
      music(Math.min(7, this.open.filter(Boolean).length), life, this.night, !!this.memo.frogSong)
    }
    const state: GameState = {
      life: Math.round(life * 100),
      found: this.found,
      total: this.quota.reduce((n, q, s) => n + (this.open[s] ? q : 0), 0),
      hint: this.hint,
      shown: this.time < this.until + (this.lines.length ? 0 : LINGER),
      waiting: this.lines.filter((line) => !this.moot(line)).length,
      fresh: this.fresh,
      stuck: this.stuck,
      known: this.notes.known,
      left: this.things.filter((thing) => (thing.hits || thing.todo) && thing.clue && this.open[this.isle[thing.tile]]).map((thing) => thing.tile),
      // The cloud that has rained itself out, the boulder in pieces: where one of those was, unless something else stands there.
      gone: this.things
        .filter((thing) => this.open[this.isle[thing.tile]] && !this.stands(thing) && !this.things.some((other) => other.tile === thing.tile && this.stands(other)))
        .map((thing) => thing.tile),
      done: won,
      tip,
      knocks: this.knocks,
      combos: this.extras.combo,
      secrets: this.extras.secret,
      snails: this.snails,
      friends: this.friends,
      isles: ISLES.map((isle, s) => ({
        id: isle.name,
        x: isle.at[0] + isle.rows[0].length / 2,
        z: isle.at[1] + isle.rows.length / 2,
        open: this.open[s],
        life: Math.round((100 * this.awake[s]) / this.tiles[s].length),
        found: [this.foundOn[s], this.quota[s]],
        secrets: this.hid[s],
        snail: this.snailOn[s],
      })),
      finds: this.finds.map(({ icon, name, riddle, told }) => ({ icon, name, hint: !name && told ? riddle : undefined })),
      pairs: this.pairs.map(({ name, riddle, told }) => ({ name, hint: !name && told ? riddle : undefined })),
      notes: won ? this.noticed : [],
      credits: this.reel?.lines ?? [],
      rolling: this.reel?.seconds ?? 0,
      rolled: this.reels,
      said: this.heard,
      ended: this.ended,
      cut: this.cut,
    }
    const sent = JSON.stringify(state)
    if (sent !== this.sent) {
      this.sent = sent
      this.report(state)
    }
  }
}
