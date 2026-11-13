import { Color, DynamicDrawUsage, Euler, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Sphere, Vector3 } from 'three'
import { dirty, unit } from './cubes.ts'

export type Kind = 'bird' | 'bunny' | 'tortoise' | 'duck' | 'chick' | 'penguin' | 'beaver' | 'frog' | 'crab' | 'mole' | 'marmot' | 'goat' | 'dragon' | 'fish' | 'owl' | 'ghost' | 'bat' | 'snail' | 'star' | 'balloon' | 'arrow' | 'beam' | 'bottle' | 'capybara' | 'axolotl' | 'glow' | 'bubble' | 'sails' | 'snowball' | 'pebble'

export interface Critter {
  kind: Kind
  x: number
  y: number
  z: number
  /** Heading it turns towards. 0 looks south, where the camera starts. */
  face: number
  /** Seconds it stays put once it has arrived, before `next` is asked what to do. */
  rest: number
  next?: (c: Critter) => void
  /** A thing that takes its clicks for now (the cage round the bird, the ice round the penguin). */
  thing?: number
  /** What a click on it does, instead of a pat. */
  onPat?: () => void
  /** A word shown next to the cursor when it rests on the animal, instead of its name. */
  tip?: string
  /** The name it goes by in the friend book, when that is not its kind. */
  friend?: string
  /** What it goes by in a saved game, when neither of those tells it apart. */
  key?: string
  /** Not there yet: its isle is still under the sea. */
  hidden?: boolean
  /** Leaning forward, in radians (a penguin on its belly, a snowball rolling). */
  tilt: number
  /** Turned about the way it faces, in radians (the sails of the windmill). */
  roll: number
  /** How big it is drawn; 1 is its own size. */
  grow: number
  /** 1 right after a click, fading to 0: a happy wobble. */
  pet: number
  /** 0 awake, 1 fast asleep: curled up, which here means a good deal flatter. */
  nap: number
  /** 0..1 along its current move; 1 when it has arrived. */
  t: number
  from: number[]
  to: number[]
  dur: number
  arc: number
  then?: () => void
  yaw: number
  size: number
  first: number
  parts: number[][]
  /** Holding still for a reason of its own (asleep in its hole): it does not fidget, and looks at nothing. */
  still?: boolean
  /** What it is doing with a quiet moment (see `ACTS`), for how long it has been at it, and how long until the next. */
  act?: string
  acted: number
  idle: number
  /** Something it is looking at, and for how much longer. */
  gaze?: () => number[] | undefined
  gazing: number
  /** How it holds itself right now: see `NOD` and the rest. */
  pose: number[]
  /** The point its head nods and turns about, if it has a head apart from its body. */
  neck?: number[]
  /** The perch it sits on, when it sits on one: a tree top moves in the wind, and takes it along. */
  roost?: number[]
  /** Moved over by this much without being anywhere else, as far as the game is concerned. */
  ox: number
  oz: number
}

const _m = new Matrix4()
const _p = new Vector3()
const _n = new Vector3()
const _q = new Quaternion()
const _h = new Quaternion()
const _qh = new Quaternion()
const _s = new Vector3()
const _e = new Euler(0, 0, 0, 'YXZ')
const _pose = [0, 0, 0, 0, 0, 0, 0]
const _c = new Color()
const shade = (color: number, by: number) => _c.set(color).offsetHSL(0, 0, by).getHex()
const EYE = 0x3a3340
const HOPPERS: Kind[] = ['bunny', 'chick', 'frog', 'marmot']
const STEADY: Kind[] = ['balloon', 'star', 'snail', 'fish', 'bat', 'arrow', 'beam', 'axolotl', 'pebble'] // these glide: no waddle when they move
const BEAK = 0xffa23f
const BARK = 0x8a6d58

// A pose, as numbers: the head nodded (down is more), turned and cocked to one side; the whole animal leaning forward,
// standing taller and thinner, lifted off the ground; and how hard its wings are going.
const [NOD, TURN, COCK, LEAN, PUFF, LIFT, FLAP] = [0, 1, 2, 3, 4, 5, 6]
/** From nothing up to 1, held, and back to nothing: over the course of something that goes from 0 to 1. */
const hold = (u: number, edge = 0.25) => {
  const x = Math.min(1, u / edge, (1 - u) / edge)
  return x * x * (3 - 2 * x)
}
/** What an animal can do with a quiet moment: how many seconds it takes, and the pose at each point of it. */
const ACTS: Record<string, [number, (u: number, pose: number[]) => void]> = {
  look: [2.6, (u, p) => (p[TURN] = Math.sin(u * 6.283) * 0.9)],
  yawn: [2, (u, p) => void ((p[NOD] = -0.7 * hold(u, 0.35)), (p[PUFF] = 0.1 * hold(u, 0.35)))],
  stretch: [1.8, (u, p) => void ((p[LEAN] = 0.3 * hold(u)), (p[NOD] = -0.5 * hold(u)))],
  scratch: [1.4, (u, p) => void ((p[COCK] = 0.5 * hold(u)), (p[NOD] = 0.1 * Math.sin(u * 60) * hold(u)))],
  chew: [2.2, (u, p) => (p[NOD] = 0.14 * (0.5 - 0.5 * Math.cos(u * 44)) * hold(u, 0.1))],
  graze: [3.2, (u, p) => (p[NOD] = (0.75 + 0.07 * Math.sin(u * 50)) * hold(u, 0.2))], // head down in the grass, tugging at it
  preen: [2.2, (u, p) => void ((p[TURN] = 1.3 * hold(u, 0.2)), (p[NOD] = (0.35 + 0.1 * Math.sin(u * 45)) * hold(u, 0.2)))], // beak under its wing
  peck: [1.2, (u, p) => (p[LEAN] = 0.6 * Math.max(0, Math.sin(u * 12.566)))], // twice, at the ground
  dip: [2.4, (u, p) => void ((p[LEAN] = 1.15 * hold(u, 0.2)), (p[LIFT] = -0.06 * hold(u, 0.2)))], // head under, tail up
  flap: [1, (u, p) => void ((p[FLAP] = hold(u, 0.2)), (p[LIFT] = 0.05 * hold(u, 0.2)))],
  hop: [0.9, (u, p) => (p[LIFT] = 0.2 * Math.abs(Math.sin(u * 6.283)))], // twice, on the spot
  croak: [1.6, (u, p) => (p[PUFF] = 0.16 * Math.max(0, Math.sin(u * 12.566)))],
  sniff: [1.6, (u, p) => (p[LEAN] = (-0.3 + 0.05 * Math.sin(u * 50)) * hold(u))], // nose in the air
  stand: [2.8, (u, p) => void ((p[PUFF] = 0.2 * hold(u, 0.15)), (p[TURN] = Math.sin(u * 6.283) * 0.8))], // up on its hind legs, for a look round
}
/** Which of those each kind of animal does. An animal that is not here does not fidget, and does not look at things. */
const IDLE: Partial<Record<Kind, string[]>> = {
  bird: ['look', 'preen', 'flap', 'peck'],
  bunny: ['look', 'hop', 'scratch', 'chew'],
  tortoise: ['look', 'chew', 'yawn'],
  duck: ['look', 'preen', 'dip', 'flap'],
  chick: ['hop', 'peck', 'flap'],
  penguin: ['look', 'flap', 'yawn'],
  beaver: ['look', 'chew', 'scratch', 'yawn'],
  frog: ['croak', 'hop'],
  crab: ['flap'], // its claws
  mole: ['sniff', 'yawn'],
  marmot: ['look', 'stand', 'scratch', 'chew'],
  goat: ['graze', 'look', 'chew'],
  dragon: ['look', 'flap', 'yawn'],
  owl: ['flap', 'croak'],
  capybara: ['yawn', 'chew'],
}
// Where the head starts on those that have one apart from the body: every box at least this high up and this far
// forward is part of it, and nods and turns with it.
const NECKS: Partial<Record<Kind, number[]>> = {
  bird: [0.28, -1], bunny: [0.3, -1], tortoise: [0, 0.5], duck: [0.33, 0], penguin: [0.48, -1], beaver: [0.2, 0.19], marmot: [0.36, -1], goat: [0.4, 0.2], dragon: [0.32, 0], capybara: [0.3, 0.3],
}
/** The boxes of an animal that are its head: none for one whose head is its body. */
export const headOf = (kind: Kind, parts: number[][]) => {
  const neck = NECKS[kind]
  return neck ? parts.filter((part) => part[1] >= neck[0] && part[2] >= neck[1]) : []
}

/** The boxes of each animal, facing +z with its feet at y = 0: [x, y, z, width, height, depth, colour, flaps?]. */
const SHAPES: Record<Kind, (c: number) => number[][]> = {
  bird: (c) => [
    [0, 0.16, 0, 0.24, 0.2, 0.3, c],
    [0, 0.12, 0.1, 0.18, 0.12, 0.14, 0xfff3df],
    [0, 0.31, 0.11, 0.19, 0.17, 0.19, c],
    [0, 0.3, 0.24, 0.07, 0.05, 0.08, BEAK],
    [0.1, 0.33, 0.15, 0.02, 0.04, 0.04, EYE],
    [-0.1, 0.33, 0.15, 0.02, 0.04, 0.04, EYE],
    [0, 0.2, -0.2, 0.12, 0.05, 0.14, shade(c, -0.1)],
    [0.145, 0.18, -0.02, 0.05, 0.12, 0.2, shade(c, -0.1), 1],
    [-0.145, 0.18, -0.02, 0.05, 0.12, 0.2, shade(c, -0.1), 1],
  ],
  bunny: (c) => [
    [0, 0.17, 0, 0.28, 0.26, 0.4, c],
    [0, 0.36, 0.2, 0.24, 0.22, 0.22, c],
    [0.07, 0.56, 0.16, 0.07, 0.22, 0.07, c],
    [-0.07, 0.56, 0.16, 0.07, 0.22, 0.07, c],
    [0, 0.34, 0.32, 0.05, 0.04, 0.03, 0xf5a3b5],
    [0.125, 0.4, 0.26, 0.02, 0.05, 0.05, EYE],
    [-0.125, 0.4, 0.26, 0.02, 0.05, 0.05, EYE],
    [0, 0.22, -0.23, 0.12, 0.12, 0.1, 0xffffff],
    [0.09, 0.04, 0.1, 0.08, 0.08, 0.14, shade(c, -0.06)],
    [-0.09, 0.04, 0.1, 0.08, 0.08, 0.14, shade(c, -0.06)],
  ],
  tortoise: () => [
    [0, 0.3, 0, 0.72, 0.36, 0.84, 0x8fae6a],
    [0, 0.53, 0, 0.5, 0.14, 0.6, 0xa9c47a],
    [0, 0.62, 0, 0.22, 0.05, 0.26, 0x7d9c5c],
    [0, 0.12, 0, 0.6, 0.08, 0.7, 0xe6d5a0],
    [0, 0.3, 0.52, 0.26, 0.24, 0.26, 0xb9cf86],
    [0.135, 0.36, 0.56, 0.02, 0.06, 0.06, EYE],
    [-0.135, 0.36, 0.56, 0.02, 0.06, 0.06, EYE],
    [0.3, 0.08, 0.28, 0.16, 0.16, 0.18, 0xb9cf86],
    [-0.3, 0.08, 0.28, 0.16, 0.16, 0.18, 0xb9cf86],
    [0.3, 0.08, -0.28, 0.16, 0.16, 0.18, 0xb9cf86],
    [-0.3, 0.08, -0.28, 0.16, 0.16, 0.18, 0xb9cf86],
    [0, 0.18, -0.46, 0.08, 0.08, 0.1, 0xb9cf86],
  ],
  duck: (c) => [
    [0, 0.14, 0, 0.3, 0.24, 0.44, c],
    [0, 0.27, -0.22, 0.14, 0.12, 0.1, c],
    [0, 0.38, 0.16, 0.2, 0.2, 0.2, c],
    [0, 0.35, 0.3, 0.14, 0.05, 0.1, BEAK],
    [0.105, 0.42, 0.2, 0.02, 0.04, 0.04, EYE],
    [-0.105, 0.42, 0.2, 0.02, 0.04, 0.04, EYE],
    [0.16, 0.16, -0.02, 0.04, 0.14, 0.26, shade(c, -0.07), 1],
    [-0.16, 0.16, -0.02, 0.04, 0.14, 0.26, shade(c, -0.07), 1],
  ],
  chick: () => [
    [0, 0.1, 0, 0.2, 0.2, 0.2, 0xffe066],
    [0, 0.11, 0.12, 0.06, 0.04, 0.05, BEAK],
    [0.105, 0.15, 0.06, 0.02, 0.04, 0.04, EYE],
    [-0.105, 0.15, 0.06, 0.02, 0.04, 0.04, EYE],
    [0.11, 0.09, -0.02, 0.03, 0.08, 0.1, 0xf5cf4a, 1],
    [-0.11, 0.09, -0.02, 0.03, 0.08, 0.1, 0xf5cf4a, 1],
  ],
  penguin: () => [
    [0, 0.26, 0, 0.3, 0.42, 0.26, 0x4a5578],
    [0, 0.23, 0.12, 0.22, 0.3, 0.04, 0xffffff],
    [0, 0.55, 0.01, 0.26, 0.2, 0.24, 0x4a5578],
    [0, 0.53, 0.12, 0.18, 0.12, 0.03, 0xffffff],
    [0, 0.5, 0.16, 0.08, 0.05, 0.08, BEAK],
    [0.06, 0.57, 0.14, 0.03, 0.04, 0.02, EYE],
    [-0.06, 0.57, 0.14, 0.03, 0.04, 0.02, EYE],
    [0.18, 0.28, 0, 0.05, 0.24, 0.12, 0x3f496b, 1],
    [-0.18, 0.28, 0, 0.05, 0.24, 0.12, 0x3f496b, 1],
    [0.08, 0.03, 0.06, 0.1, 0.06, 0.14, BEAK],
    [-0.08, 0.03, 0.06, 0.1, 0.06, 0.14, BEAK],
  ],
  beaver: (c) => [
    [0, 0.16, 0, 0.34, 0.26, 0.5, c],
    [0, 0.3, 0.26, 0.26, 0.22, 0.22, c],
    [0, 0.3, 0.38, 0.08, 0.06, 0.03, 0x4a3b3b],
    [0, 0.21, 0.37, 0.08, 0.06, 0.02, 0xffffff],
    [0.135, 0.34, 0.3, 0.02, 0.04, 0.04, EYE],
    [-0.135, 0.34, 0.3, 0.02, 0.04, 0.04, EYE],
    [0.1, 0.43, 0.2, 0.06, 0.05, 0.05, shade(c, -0.1)],
    [-0.1, 0.43, 0.2, 0.06, 0.05, 0.05, shade(c, -0.1)],
    [0, 0.08, -0.36, 0.22, 0.05, 0.3, 0x5b463c],
    [0.12, 0.03, 0.12, 0.1, 0.06, 0.12, shade(c, -0.1)],
    [-0.12, 0.03, 0.12, 0.1, 0.06, 0.12, shade(c, -0.1)],
  ],
  frog: (c) => [
    [0, 0.1, 0, 0.3, 0.18, 0.3, c],
    [0, 0.06, 0.1, 0.22, 0.08, 0.12, 0xdff0b0],
    [0.09, 0.22, 0.08, 0.1, 0.1, 0.1, c],
    [-0.09, 0.22, 0.08, 0.1, 0.1, 0.1, c],
    [0.09, 0.23, 0.14, 0.05, 0.05, 0.02, EYE],
    [-0.09, 0.23, 0.14, 0.05, 0.05, 0.02, EYE],
    [0.17, 0.05, -0.08, 0.1, 0.1, 0.18, shade(c, -0.1)],
    [-0.17, 0.05, -0.08, 0.1, 0.1, 0.18, shade(c, -0.1)],
  ],
  crab: (c) => [
    [0, 0.12, 0, 0.44, 0.16, 0.3, c],
    [0.3, 0.14, 0.14, 0.14, 0.12, 0.16, c, 1],
    [-0.3, 0.14, 0.14, 0.14, 0.12, 0.16, c, 1],
    [0.08, 0.26, 0.1, 0.04, 0.12, 0.04, c],
    [-0.08, 0.26, 0.1, 0.04, 0.12, 0.04, c],
    [0.08, 0.33, 0.1, 0.07, 0.07, 0.07, 0xffffff],
    [-0.08, 0.33, 0.1, 0.07, 0.07, 0.07, 0xffffff],
    [0.08, 0.33, 0.14, 0.03, 0.03, 0.02, EYE],
    [-0.08, 0.33, 0.14, 0.03, 0.03, 0.02, EYE],
    [0.25, 0.04, -0.05, 0.08, 0.08, 0.2, shade(c, -0.1)],
    [-0.25, 0.04, -0.05, 0.08, 0.08, 0.2, shade(c, -0.1)],
  ],
  mole: (c) => [
    [0, 0.13, 0, 0.3, 0.24, 0.42, c],
    [0, 0.12, 0.25, 0.14, 0.12, 0.1, 0xf5a3b5],
    [0.17, 0.06, 0.14, 0.1, 0.06, 0.14, 0xf5a3b5],
    [-0.17, 0.06, 0.14, 0.1, 0.06, 0.14, 0xf5a3b5],
    [0.08, 0.2, 0.2, 0.03, 0.03, 0.02, EYE],
    [-0.08, 0.2, 0.2, 0.03, 0.03, 0.02, EYE],
  ],
  marmot: (c) => [
    [0, 0.18, 0, 0.3, 0.32, 0.36, c],
    [0, 0.16, 0.16, 0.2, 0.22, 0.06, 0xf0dcb4],
    [0, 0.4, 0.1, 0.24, 0.2, 0.22, c],
    [0, 0.38, 0.22, 0.06, 0.05, 0.03, 0x4a3b3b],
    [0.125, 0.43, 0.14, 0.02, 0.04, 0.04, EYE],
    [-0.125, 0.43, 0.14, 0.02, 0.04, 0.04, EYE],
    [0.09, 0.51, 0.06, 0.05, 0.04, 0.05, shade(c, -0.1)],
    [-0.09, 0.51, 0.06, 0.05, 0.04, 0.05, shade(c, -0.1)],
    [0, 0.1, -0.24, 0.1, 0.1, 0.16, shade(c, -0.1)],
  ],
  goat: (c) => [
    [0, 0.36, 0, 0.3, 0.28, 0.5, c],
    [0.1, 0.11, 0.17, 0.08, 0.22, 0.08, shade(c, -0.08)],
    [-0.1, 0.11, 0.17, 0.08, 0.22, 0.08, shade(c, -0.08)],
    [0.1, 0.11, -0.17, 0.08, 0.22, 0.08, shade(c, -0.08)],
    [-0.1, 0.11, -0.17, 0.08, 0.22, 0.08, shade(c, -0.08)],
    [0, 0.56, 0.3, 0.2, 0.2, 0.24, c],
    [0.07, 0.7, 0.24, 0.04, 0.12, 0.04, 0x9a8f80],
    [-0.07, 0.7, 0.24, 0.04, 0.12, 0.04, 0x9a8f80],
    [0, 0.43, 0.38, 0.06, 0.1, 0.04, c],
    [0.105, 0.6, 0.36, 0.02, 0.04, 0.04, EYE],
    [-0.105, 0.6, 0.36, 0.02, 0.04, 0.04, EYE],
    [0, 0.48, -0.27, 0.08, 0.08, 0.05, c],
  ],
  dragon: (c) => [
    [0, 0.18, 0, 0.26, 0.24, 0.36, c],
    [0, 0.13, 0.08, 0.2, 0.14, 0.2, 0xfff0b8],
    [0, 0.36, 0.16, 0.22, 0.2, 0.22, c],
    [0, 0.33, 0.3, 0.12, 0.1, 0.08, c],
    [0.07, 0.49, 0.1, 0.04, 0.08, 0.04, 0xfff3df],
    [-0.07, 0.49, 0.1, 0.04, 0.08, 0.04, 0xfff3df],
    [0.115, 0.4, 0.2, 0.02, 0.05, 0.05, EYE],
    [-0.115, 0.4, 0.2, 0.02, 0.05, 0.05, EYE],
    [0, 0.14, -0.28, 0.1, 0.1, 0.24, c],
    [0, 0.16, -0.44, 0.08, 0.08, 0.1, 0xff9a5c],
    [0.2, 0.3, -0.04, 0.12, 0.04, 0.26, 0xff9a85, 1],
    [-0.2, 0.3, -0.04, 0.12, 0.04, 0.26, 0xff9a85, 1],
  ],
  fish: (c) => [
    [0, 0.06, 0, 0.14, 0.14, 0.34, c],
    [0, 0.06, -0.22, 0.04, 0.18, 0.12, shade(c, -0.1)],
    [0, 0.15, 0, 0.04, 0.06, 0.12, shade(c, -0.1)],
    [0.075, 0.08, 0.1, 0.02, 0.04, 0.04, EYE],
    [-0.075, 0.08, 0.1, 0.02, 0.04, 0.04, EYE],
  ],
  owl: (c) => [
    [0, 0.2, 0, 0.3, 0.36, 0.26, c],
    [0, 0.16, 0.12, 0.2, 0.22, 0.04, 0xf0e2c8],
    [0.08, 0.3, 0.135, 0.12, 0.12, 0.03, 0xffffff],
    [-0.08, 0.3, 0.135, 0.12, 0.12, 0.03, 0xffffff],
    [0.08, 0.3, 0.155, 0.05, 0.05, 0.02, EYE],
    [-0.08, 0.3, 0.155, 0.05, 0.05, 0.02, EYE],
    [0, 0.24, 0.15, 0.05, 0.05, 0.05, BEAK],
    [0.11, 0.41, 0, 0.06, 0.07, 0.06, shade(c, -0.1)],
    [-0.11, 0.41, 0, 0.06, 0.07, 0.06, shade(c, -0.1)],
    [0.17, 0.2, -0.02, 0.05, 0.22, 0.2, shade(c, -0.1), 1],
    [-0.17, 0.2, -0.02, 0.05, 0.22, 0.2, shade(c, -0.1), 1],
  ],
  ghost: () => [
    [0, 0.26, 0, 0.34, 0.36, 0.3, 0xf4f8ff],
    [0.11, 0.05, 0, 0.1, 0.1, 0.26, 0xf4f8ff],
    [-0.11, 0.05, 0, 0.1, 0.1, 0.26, 0xf4f8ff],
    [0.08, 0.3, 0.155, 0.06, 0.08, 0.02, EYE],
    [-0.08, 0.3, 0.155, 0.06, 0.08, 0.02, EYE],
    [0, 0.2, 0.155, 0.06, 0.04, 0.02, EYE],
  ],
  bat: () => [
    [0, 0, 0, 0.14, 0.12, 0.18, 0x5b4a66],
    [0.05, 0.08, 0.06, 0.04, 0.06, 0.04, 0x5b4a66],
    [-0.05, 0.08, 0.06, 0.04, 0.06, 0.04, 0x5b4a66],
    [0.035, 0.02, 0.095, 0.035, 0.035, 0.02, 0xffffff],
    [-0.035, 0.02, 0.095, 0.035, 0.035, 0.02, 0xffffff],
    [0.14, 0.02, 0, 0.14, 0.03, 0.14, 0x7d6a8c, 1],
    [-0.14, 0.02, 0, 0.14, 0.03, 0.14, 0x7d6a8c, 1],
  ],
  snail: (c) => [
    [0, 0.05, 0.03, 0.14, 0.1, 0.36, 0xf3d9a4],
    [0, 0.2, -0.04, 0.12, 0.24, 0.24, c],
    [0.07, 0.2, -0.04, 0.02, 0.12, 0.12, shade(c, -0.14)],
    [-0.07, 0.2, -0.04, 0.02, 0.12, 0.12, shade(c, -0.14)],
    [0.04, 0.16, 0.18, 0.03, 0.14, 0.03, 0xf3d9a4],
    [-0.04, 0.16, 0.18, 0.03, 0.14, 0.03, 0xf3d9a4],
    [0.04, 0.25, 0.18, 0.045, 0.045, 0.045, EYE],
    [-0.04, 0.25, 0.18, 0.045, 0.045, 0.045, EYE],
  ],
  // A falling star: a small bright middle with six fine points, so that it twinkles from whichever side it is seen.
  star: (c) => [
    [0, 0, 0, 0.16, 0.16, 0.16, c],
    [0.2, 0, 0, 0.24, 0.05, 0.05, c],
    [-0.2, 0, 0, 0.24, 0.05, 0.05, c],
    [0, 0.2, 0, 0.05, 0.24, 0.05, c],
    [0, -0.2, 0, 0.05, 0.24, 0.05, c],
    [0, 0, 0.2, 0.05, 0.05, 0.24, c],
    [0, 0, -0.2, 0.05, 0.05, 0.24, c],
  ],
  // A balloon in stripes, its basket, and a banner hanging from the basket.
  balloon: () => [
    [0, 1.5, 0, 0.62, 0.3, 0.62, 0xfff3df],
    [0, 1.9, 0, 1.05, 0.5, 1.05, 0xff9ab0],
    [0, 2.4, 0, 1.35, 0.5, 1.35, 0xfff3df],
    [0, 2.88, 0, 1.35, 0.46, 1.35, 0x9be3d0],
    [0, 3.3, 0, 1.05, 0.4, 1.05, 0xffd45c],
    [0, 3.62, 0, 0.62, 0.26, 0.62, 0xff9ab0],
    [0.2, 0.98, 0.2, 0.04, 0.76, 0.04, BARK],
    [-0.2, 0.98, 0.2, 0.04, 0.76, 0.04, BARK],
    [0.2, 0.98, -0.2, 0.04, 0.76, 0.04, BARK],
    [-0.2, 0.98, -0.2, 0.04, 0.76, 0.04, BARK],
    [0, 0.38, 0, 0.5, 0.44, 0.5, 0xb89572],
    [0, 0.62, 0, 0.58, 0.07, 0.58, BARK],
  ],
  // The lamp of the lighthouse, the one part of it that turns: a cube with a small lens on the side it shines from.
  beam: (c) => [
    [0, 0, 0, 0.36, 0.36, 0.36, c],
    [0, 0, 0.23, 0.14, 0.14, 0.1, 0xffffff],
  ],
  // A bottle with a note in it.
  bottle: () => [
    [0, 0.11, 0, 0.16, 0.22, 0.16, 0x9be3d0],
    [0, 0.27, 0, 0.07, 0.1, 0.07, 0x9be3d0],
    [0, 0.34, 0, 0.09, 0.05, 0.09, 0xb8956a],
    [0, 0.12, 0.085, 0.09, 0.12, 0.012, 0xfff3df],
  ],
  // A capybara, with an orange on its head: it has found the hot spring.
  capybara: (c) => [
    [0, 0.2, 0, 0.42, 0.34, 0.66, c],
    [0, 0.38, 0.38, 0.34, 0.3, 0.32, c],
    [0, 0.32, 0.56, 0.26, 0.18, 0.08, shade(c, -0.1)],
    [0.12, 0.55, 0.32, 0.08, 0.06, 0.08, shade(c, -0.1)],
    [-0.12, 0.55, 0.32, 0.08, 0.06, 0.08, shade(c, -0.1)],
    [0.175, 0.44, 0.42, 0.02, 0.05, 0.05, EYE],
    [-0.175, 0.44, 0.42, 0.02, 0.05, 0.05, EYE],
    [0, 0.6, 0.4, 0.15, 0.13, 0.15, 0xffa23f],
    [0.03, 0.69, 0.4, 0.05, 0.05, 0.05, 0x67bd72],
    [0.13, 0.04, 0.22, 0.1, 0.08, 0.12, shade(c, -0.14)],
    [-0.13, 0.04, 0.22, 0.1, 0.08, 0.12, shade(c, -0.14)],
    [0.13, 0.04, -0.22, 0.1, 0.08, 0.12, shade(c, -0.14)],
    [-0.13, 0.04, -0.22, 0.1, 0.08, 0.12, shade(c, -0.14)],
  ],
  // An axolotl: pink, frilled, and smiling, because that is how its face is.
  axolotl: (c) => [
    [0, 0.1, 0, 0.2, 0.16, 0.5, c],
    [0, 0.13, 0.32, 0.3, 0.2, 0.22, c],
    [0.19, 0.24, 0.3, 0.09, 0.05, 0.05, 0xff7aa8],
    [-0.19, 0.24, 0.3, 0.09, 0.05, 0.05, 0xff7aa8],
    [0.2, 0.17, 0.34, 0.1, 0.05, 0.05, 0xff7aa8],
    [-0.2, 0.17, 0.34, 0.1, 0.05, 0.05, 0xff7aa8],
    [0.19, 0.1, 0.28, 0.08, 0.05, 0.05, 0xff7aa8],
    [-0.19, 0.1, 0.28, 0.08, 0.05, 0.05, 0xff7aa8],
    [0.09, 0.19, 0.435, 0.045, 0.045, 0.02, EYE],
    [-0.09, 0.19, 0.435, 0.045, 0.045, 0.02, EYE],
    [0, 0.09, 0.435, 0.12, 0.025, 0.02, shade(c, -0.18)],
    [0, 0.13, -0.36, 0.06, 0.22, 0.26, shade(c, -0.06)],
  ],
  // An arrow pointing down at something: seen from the front, like the thought bubbles.
  arrow: (c) => [
    [0, 0.62, 0, 0.14, 0.44, 0.1, c],
    [0, 0.34, 0, 0.46, 0.14, 0.1, c],
    [0, 0.2, 0, 0.3, 0.14, 0.1, c],
    [0, 0.06, 0, 0.14, 0.14, 0.1, c],
  ],
  // One fat firefly, and the thought bubble that floats over an animal with a wish (its boxes are given when it is made).
  glow: (c) => [
    [0, 0, 0, 0.16, 0.14, 0.2, c],
    [0.1, 0.06, 0, 0.1, 0.03, 0.12, 0xbfe6ff, 1],
    [-0.1, 0.06, 0, 0.1, 0.03, 0.12, 0xbfe6ff, 1],
  ],
  bubble: () => [],
  // Not animals, but they turn and tumble like one: the sails of the windmill, about their hub, and the snowball, about its middle.
  sails: () => [
    [0, 0, 0, 0.24, 0.24, 0.18, BARK],
    [0.75, 0, 0, 1.3, 0.07, 0.06, BARK],
    [-0.75, 0, 0, 1.3, 0.07, 0.06, BARK],
    [0, 0.75, 0, 0.07, 1.3, 0.06, BARK],
    [0, -0.75, 0, 0.07, 1.3, 0.06, BARK],
    [0.85, 0.17, 0, 0.9, 0.26, 0.03, 0xfff3df],
    [-0.85, -0.17, 0, 0.9, 0.26, 0.03, 0xfff3df],
    [-0.17, 0.85, 0, 0.26, 0.9, 0.03, 0xfff3df],
    [0.17, -0.85, 0, 0.26, 0.9, 0.03, 0xfff3df],
  ],
  // A ball of snow, as round as cubes get: three blocks crossed through each other, one for each way it can roll.
  snowball: () => [
    [0, 0, 0, 0.9, 0.54, 0.54, 0xffffff],
    [0, 0, 0, 0.54, 0.9, 0.54, 0xf4f8fd],
    [0, 0, 0, 0.54, 0.54, 0.9, 0xeaf1fa],
  ],
  // A flat stone, the kind that skips.
  pebble: () => [
    [0, 0, 0, 0.18, 0.07, 0.15, 0xa39eab],
    [0.01, 0.05, 0, 0.1, 0.03, 0.08, 0xc6c2c8],
  ],
}

/** The boxes one of them is made of: for a picture of it on the map. */
export const shapeOf = (kind: Kind, color: number) => SHAPES[kind](color)

/** The animals: a few boxes each, moved about as one body. The game tells them where to go. */
export class Critters {
  readonly mesh = new InstancedMesh(unit, new MeshStandardMaterial({ roughness: 0.85 }), 700)
  readonly list: Critter[] = []
  private owner: number[] = []

  constructor() {
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    this.mesh.count = 0
    this.mesh.frustumCulled = false
    this.mesh.boundingSphere = new Sphere(new Vector3(), 80)
    this.mesh.castShadow = true
  }

  /**
   * @param own its boxes, for one that is not a stock shape (a thought bubble)
   * @param gain above 1 makes it glow
   */
  spawn(kind: Kind, x: number, y: number, z: number, color = 0xffffff, own?: number[][], gain = 1) {
    const parts = own ?? SHAPES[kind](color)
    const c: Critter = { kind, x, y, z, face: 0, rest: 0, tilt: 0, roll: 0, grow: 1, pet: 0, nap: 0, t: 1, from: [x, y, z], to: [x, y, z], dur: 1, arc: 0, yaw: 0, size: 0, first: this.owner.length, parts, acted: 0, idle: 2 + Math.random() * 8, gazing: 0, pose: [0, 0, 0, 0, 0, 0, 0], ox: 0, oz: 0 }
    const head = own ? [] : headOf(kind, parts)
    if (head.length) {
      // The head turns about the bottom of its biggest box, a little back from the middle: where a neck would be.
      for (const part of head) part[8] = 1
      const [hx, hy, hz, , high, deep] = head.reduce((a, b) => (b[3] * b[4] * b[5] > a[3] * a[4] * a[5] ? b : a))
      c.neck = [hx, hy - high / 2, hz - deep / 4]
    }
    for (const part of parts) {
      this.mesh.setColorAt(this.owner.length, _c.set(part[6]).multiplyScalar(gain))
      this.mesh.setMatrixAt(this.owner.length, _m.makeScale(0, 0, 0))
      this.owner.push(this.list.length)
    }
    this.mesh.count = this.owner.length
    this.mesh.instanceColor!.needsUpdate = true
    this.list.push(c)
    return c
  }

  /**
   * A new colour for some of its boxes, by their place in its shape.
   * @param gain above 1 makes them glow
   */
  paint(c: Critter, parts: number[], color: number, gain = 1) {
    for (const n of parts) this.mesh.setColorAt(c.first + n, _c.set(color).multiplyScalar(gain))
    this.mesh.instanceColor!.needsUpdate = true
  }

  /** The animal a picked box belongs to. */
  of(instance: number) {
    return this.list[this.owner[instance]]
  }

  /**
   * Send it somewhere.
   * @param arc how high it leaves the ground on the way: a hop or a flight. 0 is a walk.
   * @param then called when it gets there
   */
  go(c: Critter, x: number, y: number, z: number, dur: number, arc = 0, then?: () => void) {
    if (Math.hypot(x - c.x, z - c.z) > 0.05) c.face = Math.atan2(x - c.x, z - c.z)
    Object.assign(c, { from: [c.x, c.y, c.z], to: [x, y, z], t: 0, dur, arc, then })
  }

  /** Whether something has hold of it: a cage, a block of ice, sleep. The game knows better, and says so (the frog stays on its pad for good, and is free all the same). */
  held = (c: Critter) => c.thing !== undefined
  /** Up and about, with nothing to do this moment: awake, not on its way anywhere, and not held (unless `anyway`). */
  lively(c: Critter, anyway = false) {
    return !c.hidden && !c.still && (anyway || !this.held(c)) && c.nap < 0.1 && c.t >= 1 && !!IDLE[c.kind]
  }
  /** It looks at something for a while: a place, or somebody. */
  look(c: Critter, at: Critter | (() => number[] | undefined), seconds: number) {
    c.gaze = typeof at === 'function' ? at : () => (at.hidden ? undefined : [at.x, at.y + 0.3 * at.grow, at.z])
    c.gazing = seconds
  }
  /** It does one of the things in `ACTS`, if it is free to. */
  perform(c: Critter, act: string) {
    if (!this.lively(c) || c.pet) return false
    Object.assign(c, { act, acted: 0, gazing: 0, rest: Math.max(c.rest, ACTS[act][0]) })
    return true
  }
  /** A quiet moment: now and then somebody near by is worth a look, and the look is returned. Otherwise, something of its own. */
  private fidget(c: Critter) {
    c.idle = 5 + Math.random() * 9
    const other = Math.random() < 0.3 ? this.list.find((o) => o !== c && this.lively(o) && Math.hypot(o.x - c.x, o.z - c.z) < 2.6 && Math.abs(o.y - c.y) < 1.5) : undefined
    const acts = IDLE[c.kind]!
    if (!other) return void this.perform(c, acts[Math.floor(Math.random() * acts.length)])
    this.look(c, other, 1.8)
    if (!other.act && other.gazing <= 0) this.look(other, c, 1.6)
  }

  update(dt: number, time: number) {
    for (const c of this.list) {
      c.size += ((c.hidden ? 0 : 1) - c.size) * Math.min(1, dt * 7)
      c.pet = Math.max(0, c.pet - dt * 2)
      if (c.t < 1) {
        c.t = Math.min(1, c.t + dt / c.dur)
        const e = c.arc ? c.t : c.t * c.t * (3 - 2 * c.t) // hops and flights keep their pace, walks ease in and out
        c.x = c.from[0] + (c.to[0] - c.from[0]) * e
        c.y = c.from[1] + (c.to[1] - c.from[1]) * e + Math.sin(Math.PI * c.t) * c.arc
        c.z = c.from[2] + (c.to[2] - c.from[2]) * e
        if (c.t === 1) {
          const { then } = c
          c.then = undefined
          then?.()
        }
      } else if ((c.rest -= dt) <= 0) c.next?.(c)

      const moving = c.t < 1
      // What it does with itself while it has nothing to do: something worth a look comes first, then a fidget of its own.
      const pose = _pose.fill(0)
      const quiet = !moving && !c.hidden && c.nap < 0.1 && !c.pet
      const at = quiet && c.gazing > 0 ? c.gaze?.() : undefined
      if (!quiet) c.act = undefined
      else if (at) {
        const way = Math.atan2(at[0] - c.x, at[2] - c.z)
        const round = Math.atan2(Math.sin(way - c.yaw), Math.cos(way - c.yaw))
        const up = Math.min(0.8, Math.max(-0.4, Math.atan2(at[1] - c.y - 0.3 * c.grow, Math.hypot(at[0] - c.x, at[2] - c.z))))
        // With no neck to turn, or too far round for one, the whole of it turns.
        if (!c.neck || Math.abs(round) > 1.1) c.face = way
        if (c.neck) pose[TURN] = Math.min(1.1, Math.max(-1.1, round))
        pose[c.neck ? NOD : LEAN] = c.neck ? -up : -up * 0.5
      } else if (c.act) {
        const [seconds, strike] = ACTS[c.act]
        strike(Math.min(1, (c.acted += dt) / seconds), pose)
        if (c.acted >= seconds) c.act = undefined
      } else if (this.lively(c) && (c.idle -= dt) < 0) this.fidget(c)
      if ((c.gazing -= dt) <= 0) c.gaze = undefined
      c.pose.forEach((now, n) => {
        const next = now + (pose[n] - now) * Math.min(1, dt * 12)
        c.pose[n] = Math.abs(next) < 1e-4 ? 0 : next
      })
      const [nod, turned, cock, lean, puff, lift, flutter] = c.pose

      const turn = c.face - c.yaw
      c.yaw += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, dt * 9) // the short way round
      const air = moving && c.arc ? Math.sin(Math.PI * c.t) : 0
      const stretch = (HOPPERS.includes(c.kind) ? air * 0.22 : 0) + puff
      const waddle = moving && !c.arc && !c.tilt && !STEADY.includes(c.kind) ? Math.sin(time * (c.kind === 'tortoise' ? 7 : 13)) * 0.1 : 0
      const flap = (air || (moving && c.kind === 'crab') ? 1 : flutter) * Math.sin(time * 32) * 0.07
      const k = c.size * c.grow * (1 + c.pet * 0.3 * Math.sin(c.pet * 14))
      const squash = 1 - c.nap * 0.32 + c.nap * 0.03 * Math.sin(time * 1.6 + c.first) // asleep: flatter, and breathing
      _q.setFromEuler(_e.set(c.tilt + lean, c.yaw, waddle + c.roll))
      const head = c.neck && (nod || turned || cock) ? _n.fromArray(c.neck) : undefined
      if (head) _qh.multiplyQuaternions(_q, _h.setFromEuler(_e.set(nod, turned, cock)))
      c.parts.forEach((part, n) => {
        const heady = head && part[8]
        _p.set(part[0], part[1] + (part[7] ? flap : 0), part[2])
        if (heady) _p.sub(head).applyQuaternion(_h).add(head)
        _p.y *= (1 + stretch) * squash
        _p.multiplyScalar(k).applyQuaternion(_q)
        _p.set(_p.x + c.x + c.ox, _p.y + c.y + lift * k, _p.z + c.z + c.oz)
        _s.set(part[3] * (1 - stretch * 0.4), part[4] * (1 + stretch) * squash, part[5] * (1 - stretch * 0.4)).multiplyScalar(k)
        this.mesh.setMatrixAt(c.first + n, _m.compose(_p, heady ? _qh : _q, _s))
      })
    }
    dirty(this.mesh.instanceMatrix, 0, this.owner.length * 16)
  }
}
