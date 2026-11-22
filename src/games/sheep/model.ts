// A sheep, as cubes: what it is made of, what it can wear, and how its cubes are put where it is. The field
// (`Sheep.ts`) draws every sheep with this, and so does the small window a new sheep is dressed in (`Fitting.tsx`):
// one model, so that what is dressed is what lands in the field.
import { rnd } from '../basics.ts'
import type { Cubes } from '../cubes.ts'
import { WOOL, type Look, type Wear } from './dress.ts'

/** A box of a thing: where it is from the thing's own middle (across, how high its foot is, along), its size, and its colour. */
export type Part = number[]
/** They look one of four ways, as cubes do. For each quarter turn, what becomes of across and along: 0 looks along +z, 1 along +x. */
export const TURNS = [[1, 0, 0, 1], [0, 1, -1, 0], [-1, 0, 0, -1], [0, -1, 1, 0]]
export const HOP = 0.14 // how high a sheep of full size comes off the ground at every step,
export const GLAD = 0.5 // and how long a hop for joy lasts
const FACE = 0x5f4f5a // a sheep's face, ears and legs
/**
 * A sheep of full size, looking along. Few boxes, and each one something: four legs; one chunky box of wool; a short
 * tail; a big dark head set low, with a tuft of wool on it; two ears out sideways, low, as a lamb's; and a pink nose.
 * It has no eyes, on purpose: what it feels shows in how it moves. No box is inside another. `BODY` and `HEAD` are the
 * two rectangles of ground all of it stands over, as how far to each side, and from where to where along: the tail is
 * in the first, the ears and nose in the second. A part with a 1 at its end goes with the body; the rest go with the
 * head, down to the grass and up again.
 */
export const EWE: Part[] = [
  [-0.18, 0, 0.24, 0.13, 0.2, 0.13, FACE], [0.18, 0, 0.24, 0.13, 0.2, 0.13, FACE], [-0.18, 0, -0.24, 0.13, 0.2, 0.13, FACE], [0.18, 0, -0.24, 0.13, 0.2, 0.13, FACE],
  [0, 0.2, 0, 0.66, 0.56, 0.8, 0, 1], [0, 0.42, -0.45, 0.18, 0.16, 0.1, 0, 1],
  [0, 0.34, 0.55, 0.4, 0.38, 0.3, FACE], [-0.25, 0.48, 0.52, 0.1, 0.08, 0.14, FACE], [0.25, 0.48, 0.52, 0.1, 0.08, 0.14, FACE],
  [0, 0.37, 0.715, 0.14, 0.09, 0.03, 0xffa8b8], [0, 0.72, 0.51, 0.3, 0.14, 0.22, 0],
]
/**
 * What a sheep can wear, as parts of the same kind, three at the most. Each sits on the sheep and in none of its
 * boxes, bowed head and all: what is on the head is no further back than the head is; the scarf lies on the back,
 * behind the head, with an end down one side (which is why `BODY` is a little wider than the wool).
 */
export const WORN: Record<Wear, Part[]> = {
  hat: [[0, 0.86, 0.53, 0.38, 0.04, 0.26, 0xf2d98a], [0, 0.9, 0.53, 0.24, 0.13, 0.18, 0xe9c46a]],
  bell: [[0.25, 0.36, 0.52, 0.1, 0.1, 0.1, 0xffc93c]],
  scarf: [[0, 0.76, 0.3, 0.66, 0.06, 0.14, 0xff7a8a, 1], [0.355, 0.46, 0.3, 0.05, 0.36, 0.14, 0xff7a8a, 1]],
  flowers: [[-0.1, 0.86, 0.47, 0.09, 0.07, 0.09, 0xff9ec4], [0.02, 0.86, 0.57, 0.09, 0.07, 0.09, 0xffd45c], [0.11, 0.86, 0.46, 0.09, 0.07, 0.09, 0xc4a4f0]],
}
export const SLOTS = EWE.length + 3 // the cubes every sheep has: its own, and three for what it wears
export const BODY = [0.38, -0.5, 0.4]
export const HEAD = [0.31, 0.4, 0.75]
export const NOSE = 0.56 // how far ahead of its middle the middle of its head is
export const LEGS = 0.2 // how long its legs are
export const BOW = 0.32 // how far its head goes down to the grass,
export const TUCK = 0.31 // and how far when it lies asleep (its body goes down by its legs, and its head a little more)


/** What of a sheep its drawing goes by: where it is, how it stands, what it has on, and its cubes. */
export type Body = {
  s: number // size, from 0.8 to 1
  x: number
  z: number
  y: number // how high its feet are now: set here, for whoever puts something over its head
  face: number // which quarter turn it looks: see `TURNS`
  state: string // `eat` and `drink` are the two that chew
  stride: number // how far along its stride it is: it goes at a hop
  hop: number // how long it goes on jumping for joy
  rush: number // more than 1 when it runs: its hops are higher, and its ears up
  nod: number // how far its head is down, 0 to 1,
  lie: number // and how far it has lain down
  air: number // how high over the ground it hangs
  wear: Part[] // what it has on
  wool: number
  cubes: number[] // one for each part of `EWE`, and three for what it wears
  mark: number // what it was last drawn as
  sized: number
}

/** The cubes of one sheep, in a pool: `owner` is whose the pool is to say they are. What it wears is not on show yet. */
export const limbs = (flock: Cubes, owner: number) => [...EWE.map(([, , , , , , ink]) => flock.add(0, 0, 0, 1, 1, 1, ink || WOOL[0], owner)), ...[0, 1, 2].map(() => flock.add(0, 0, 0, 1, 1, 1, WOOL[0], owner, false))]

/** A sheep's look is put on it: its wool in its colour (its look's, or else its seed's), and what it wears on the three cubes kept for that. */
export function clothe(flock: Cubes, e: Body, seed: number, look: Look = {}) {
  e.wool = WOOL[look.wool ?? Math.floor(rnd(seed * 7 + 1) * WOOL.length)]
  e.wear = look.wear ? WORN[look.wear] : []
  EWE.forEach(([, , , , , , ink], k) => {
    if (!ink) flock.paint(e.cubes[k], e.wool)
  })
  for (let k = 0; k < 3; k++) {
    const c = e.cubes[EWE.length + k]
    if (e.wear[k]) flock.paint(c, e.wear[k][6])
    if (e.wear[k]) flock.show(c)
    else flock.hide(c)
  }
  e.sized = -1
  e.mark = NaN
}

/**
 * Puts a sheep's cubes where it is. All of it goes up together at a hop, legs and all; its legs reach down to whatever
 * each stands on; its head goes down to graze or drink, and nods; asleep it is folded up on the ground; and now and
 * then an ear flicks. Nothing is sent to the graphics card for a sheep that has not changed.
 * @param floor how high the ground it stands on is (lower, for one that stands in water)
 * @param under how high the ground is under a square of ground: what a leg comes down to
 */
export function pose(flock: Cubes, e: Body, time: number, floor: number, under: (x: number, z: number, half: number) => number) {
  const { s, cubes } = e
  const lift = (Math.abs(Math.sin(e.stride * Math.PI)) * HOP * (e.rush > 1 ? 1.5 : 1) + (e.hop > 0 ? Math.sin(Math.min(1, e.hop / GLAD) * Math.PI) * 0.3 : 0)) * s + e.air
  const chew = (e.state === 'eat' || e.state === 'drink') && e.nod > 0.9 ? Math.max(0, Math.sin(time * 7 + s * 40)) * 0.06 : 0
  const flick = e.rush > 1 || (time * 0.23 + s * 11) % 1 < 0.05 ? 0.05 : 0 // (its ears go up for a moment; and stay up when it runs)
  const mark = e.x * 13 + e.z * 7 + lift * 5 + e.nod * 3 + e.lie + e.face + chew + flick + floor
  if (mark === e.mark) return
  e.mark = mark
  e.y = floor + lift
  const [a, b, c, d] = TURNS[e.face]
  const odd = e.face & 1
  const sink = LEGS * e.lie
  const bow = Math.max(e.nod * (BOW - chew), e.lie * TUCK)
  for (let k = 0; k < SLOTS; k++) {
    const part = k < EWE.length ? EWE[k] : e.wear[k - EWE.length]
    if (!part) continue
    const [dx, dy, dz, sx, sy, sz] = part
    const [x, z] = [e.x + (a * dx + b * dz) * s, e.z + (c * dx + d * dz) * s]
    if (k < 4) {
      // A leg: from the body down to what is under it. Folded away once it has lain down.
      const foot = under(x, z, sx * s * 0.5)
      const tall = floor + (LEGS - sink) * s - foot
      flock.place(cubes[k], x, foot + lift + tall / 2, z)
      flock.size(cubes[k], sx * s, tall, sz * s)
      if (e.lie > 0.9) flock.hide(cubes[k])
      else flock.show(cubes[k])
      continue
    }
    if (e.sized !== odd) flock.size(cubes[k], (odd ? sz : sx) * s, sy * s, (odd ? sx : sz) * s)
    flock.place(cubes[k], x, floor + lift + (dy - (part[7] ? sink : bow) + (k === 7 || k === 8 ? flick : 0) + sy / 2) * s, z)
  }
  e.sized = odd
}

/**
 * A thought bubble, which is the island's (`BUBBLE` in `../island/wishes.ts`), box for box: seen from the front, a
 * square of paper with its corners taken off (a wide slab with a narrower one above and below it) and two crumbs of it
 * trailing down towards whoever is thinking; and the pictures that go on it, each of a few boxes that stand a little
 * proud of the paper, plain enough to read from a way off. As [x, y, z, width, height, depth, colour], y from the foot
 * of the bubble up, z out of the paper towards whoever is looking.
 */
export const PAPER = 0xfffdf6
export const BUBBLE: Part[] = [
  [0, 0.21, 0, 0.44, 0.26, 0.05, PAPER],
  [0, 0.365, 0, 0.32, 0.05, 0.05, PAPER],
  [0, 0.055, 0, 0.32, 0.05, 0.05, PAPER],
  [-0.1, -0.03, 0, 0.08, 0.07, 0.05, PAPER],
  [-0.17, -0.12, 0, 0.05, 0.045, 0.05, PAPER],
]
const [ROSE, MINT, INK, SUN, DEW, DUSK, FIRE, BLUSH, GLINT] = [0xff7a9c, 0x4fd391, 0x4a4458, 0xffc93c, 0x7fc4f5, 0x9a92b4, 0xff8a3c, 0xffa3b5, 0xffffff]
// The faces: a round warm yellow face on the paper, and on it, proud of it again, eyes, cheeks and a mouth. Cute at a
// glance is the whole of the job: dots for eyes, pink for cheeks, and a mouth of a box or three.
const MUG: Part[] = [[0, 0.21, 0.04, 0.26, 0.2, 0.03, 0xffd966], [0, 0.325, 0.04, 0.18, 0.03, 0.03, 0xffd966], [0, 0.095, 0.04, 0.18, 0.03, 0.03, 0xffd966]]
const eyes = (wide: number, tall: number, ink = INK, y = 0.245): Part[] => [[-0.065, y, 0.065, wide, tall, 0.02, ink], [0.065, y, 0.065, wide, tall, 0.02, ink]]
const cheeks = (wide = 0.045, tall = 0.03): Part[] => [[-0.1, 0.18, 0.065, wide, tall, 0.02, BLUSH], [0.1, 0.18, 0.065, wide, tall, 0.02, BLUSH]]
export const THINK: Record<string, Part[]> = {
  // A smile: dot eyes, rosy cheeks, and a mouth that turns up at both ends.
  smile: [...MUG, ...eyes(0.04, 0.05), ...cheeks(), [0, 0.15, 0.065, 0.07, 0.02, 0.02, INK], [-0.045, 0.17, 0.065, 0.02, 0.02, 0.02, INK], [0.045, 0.17, 0.065, 0.02, 0.02, 0.02, INK]],
  // Bashful: eyes shut with pleasure, a great deal of cheek, a small mouth.
  blush: [...MUG, ...eyes(0.05, 0.02, INK, 0.24), ...cheeks(0.045, 0.04), [0, 0.155, 0.065, 0.04, 0.02, 0.02, INK]],
  // Put out: the mouth turns down.
  oh: [...MUG, ...eyes(0.04, 0.05), [0, 0.165, 0.065, 0.06, 0.02, 0.02, INK], [-0.04, 0.145, 0.065, 0.02, 0.02, 0.02, INK], [0.04, 0.145, 0.065, 0.02, 0.02, 0.02, INK]],
  // Startled: big eyes and a round mouth.
  gasp: [...MUG, ...eyes(0.04, 0.06, INK, 0.25), ...cheeks(), [0, 0.15, 0.065, 0.05, 0.06, 0.02, INK]],
  // Flustered: a drop of sweat at the temple.
  sweat: [...MUG, ...eyes(0.04, 0.05), [0, 0.155, 0.065, 0.07, 0.02, 0.02, INK], [0.105, 0.285, 0.065, 0.035, 0.05, 0.02, DEW]],
  // Overjoyed: eyes like stars, and its mouth open.
  stars: [...MUG, ...eyes(0.055, 0.055, FIRE), ...cheeks(), [0, 0.15, 0.065, 0.09, 0.045, 0.02, 0xd9546b]],
  // A plump heart, with a glint on it.
  heart: [[-0.05, 0.255, 0.04, 0.09, 0.08, 0.04, ROSE], [0.05, 0.255, 0.04, 0.09, 0.08, 0.04, ROSE], [0, 0.185, 0.04, 0.19, 0.06, 0.04, ROSE], [0, 0.135, 0.04, 0.11, 0.04, 0.04, ROSE], [0, 0.1, 0.04, 0.05, 0.03, 0.04, ROSE], [-0.06, 0.27, 0.07, 0.03, 0.03, 0.02, GLINT]],
  grass: [[-0.08, 0.19, 0.04, 0.05, 0.14, 0.04, MINT], [0, 0.22, 0.04, 0.05, 0.2, 0.04, 0x63dc9c], [0.08, 0.18, 0.04, 0.05, 0.12, 0.04, MINT], [0, 0.335, 0.04, 0.07, 0.03, 0.04, 0xfff3a0]],
  note: [[-0.035, 0.14, 0.04, 0.1, 0.08, 0.04, 0x8f7bd8], [0, 0.26, 0.04, 0.03, 0.16, 0.04, 0x8f7bd8], [0.055, 0.32, 0.04, 0.08, 0.04, 0.04, 0x8f7bd8], [-0.05, 0.155, 0.07, 0.03, 0.03, 0.02, GLINT]],
  spark: [[0, 0.21, 0.04, 0.05, 0.22, 0.04, SUN], [-0.07, 0.21, 0.04, 0.09, 0.05, 0.04, SUN], [0.07, 0.21, 0.04, 0.09, 0.05, 0.04, SUN], [0, 0.21, 0.07, 0.03, 0.03, 0.02, GLINT]],
  drop: [[-0.07, 0.275, 0.04, 0.05, 0.05, 0.04, DEW], [-0.07, 0.215, 0.04, 0.1, 0.07, 0.04, DEW], [0.07, 0.205, 0.04, 0.05, 0.05, 0.04, DEW], [0.07, 0.145, 0.04, 0.1, 0.07, 0.04, DEW], [-0.09, 0.225, 0.07, 0.025, 0.03, 0.02, GLINT], [0.05, 0.155, 0.07, 0.025, 0.03, 0.02, GLINT]],
  bang: [[0, 0.25, 0.04, 0.06, 0.16, 0.04, FIRE], [0, 0.12, 0.04, 0.06, 0.06, 0.04, FIRE]],
  what: [[0, 0.31, 0.04, 0.14, 0.04, 0.04, DUSK], [0.05, 0.265, 0.04, 0.04, 0.05, 0.04, DUSK], [0.01, 0.22, 0.04, 0.08, 0.04, 0.04, DUSK], [0, 0.18, 0.04, 0.04, 0.04, 0.04, DUSK], [0, 0.11, 0.04, 0.05, 0.05, 0.04, DUSK]],
  flower: [[0, 0.3, 0.04, 0.07, 0.06, 0.04, ROSE], [-0.065, 0.24, 0.04, 0.06, 0.07, 0.04, ROSE], [0.065, 0.24, 0.04, 0.06, 0.07, 0.04, ROSE], [0, 0.18, 0.04, 0.07, 0.06, 0.04, ROSE], [0, 0.24, 0.04, 0.07, 0.06, 0.04, SUN], [0, 0.115, 0.04, 0.03, 0.07, 0.04, MINT], [0.035, 0.12, 0.04, 0.04, 0.03, 0.04, MINT]],
}
export const LINES = 10 // the most boxes a picture is made of

/**
 * Puts a thought bubble's cubes where it is: the paper's, then the picture's. (The pool they are of may be any: the
 * ground's in the field, the little window's own.)
 * @param cubes its cubes: as many as `BUBBLE` has boxes, and `LINES` more for the picture
 * @param fresh whether the picture has changed: then the cubes are painted afresh, and pop up
 * @param foot how high the foot of the bubble is
 * @param facing the quarter turn it faces: the one nearest to whoever is looking, since cubes do not turn
 * @param grow how big it is: about 1.6, and breathing a little
 */
export function speak(pool: Cubes, cubes: number[], say: string, fresh: boolean, x: number, foot: number, z: number, facing: number, grow: number) {
  const [a, b, c, d] = TURNS[facing]
  const odd = facing & 1
  const picture = THINK[say] ?? []
  for (let k = 0; k < BUBBLE.length + LINES; k++) {
    const part = k < BUBBLE.length ? BUBBLE[k] : picture[k - BUBBLE.length]
    const cube = cubes[k]
    if (!part) {
      if (fresh) pool.hide(cube)
      continue
    }
    if (fresh) {
      pool.paint(cube, part[6])
      pool.show(cube, k < BUBBLE.length ? 0 : 0.08) // (the paper pops up, and the picture on it a moment after)
    }
    pool.place(cube, x + (a * part[0] + b * part[2]) * grow, foot + part[1] * grow, z + (c * part[0] + d * part[2]) * grow)
    pool.size(cube, (odd ? part[5] : part[3]) * grow, part[4] * grow, (odd ? part[3] : part[5]) * grow)
  }
}
