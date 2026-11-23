// A sheep, as cubes: what it is made of, what it can wear, and how its cubes are put where it is. The field
// (`Sheep.ts`) draws every sheep with this, and so does the small window a new sheep is dressed in (`Fitting.tsx`):
// one model, so that what is dressed is what lands in the field.
import { rnd } from '../basics.ts'
import type { Cubes } from '../cubes.ts'
import { BLANKETS, WOOL, worn, type Look, type Memory, type Wear } from './dress.ts'

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
const [LACE, GOLD, LEAFY] = [0xfffdf6, 0xffc93c, 0x7fca6c]
/**
 * What a very old sheep remembers, as the keepsake she has on for it: six parts at the most. What is on her head or
 * hangs from an ear goes with her head (and is no lower than her beard when her head is down); what is on her back
 * lies on her blanket and goes with her body.
 */
export const KEEPSAKES: Record<Memory, Part[]> = {
  // Her wedding: a veil of lace over her head and down each side of it, a posy at one ear, and at the other the ring.
  wedding: [[0, 0.86, 0.52, 0.4, 0.04, 0.22, LACE], [-0.18, 0.72, 0.52, 0.04, 0.14, 0.22, LACE], [0.18, 0.72, 0.52, 0.04, 0.14, 0.22, LACE], [0.25, 0.3, 0.52, 0.1, 0.08, 0.1, 0xff9ec4], [0.25, 0.26, 0.52, 0.04, 0.04, 0.04, LEAFY], [-0.25, 0.3, 0.52, 0.08, 0.08, 0.08, GOLD]],
  // Her first love: a pressed flower over one ear, and the letter, pink and sealed, kept on her back.
  love: [[-0.25, 0.46, 0.52, 0.1, 0.09, 0.1, 0xff7a9c], [-0.25, 0.55, 0.52, 0.05, 0.03, 0.05, GOLD], [0.1, 0.81, -0.05, 0.22, 0.03, 0.15, 0xffc2d9, 1], [0.1, 0.84, -0.05, 0.05, 0.015, 0.05, 0xe0526e, 1]],
  // Her baby: a very small lamb, lying on her back, which goes wherever she goes.
  lamb: [[0, 0.81, -0.1, 0.24, 0.16, 0.3, WOOL[0], 1], [0, 0.85, 0.12, 0.16, 0.14, 0.12, FACE, 1], [0, 0.99, 0.11, 0.12, 0.05, 0.09, WOOL[0], 1], [-0.1, 0.9, 0.12, 0.04, 0.04, 0.06, FACE, 1], [0.1, 0.9, 0.12, 0.04, 0.04, 0.06, FACE, 1], [0, 0.88, -0.28, 0.07, 0.07, 0.05, WOOL[0], 1]],
  // The summer of the duck: it is sitting on her still.
  duck: [[0, 0.81, -0.08, 0.2, 0.12, 0.26, 0xffe07a, 1], [0, 0.93, 0, 0.13, 0.11, 0.12, 0xffe07a, 1], [0, 0.96, 0.085, 0.07, 0.035, 0.05, 0xff9a3c, 1], [0, 0.93, -0.18, 0.1, 0.05, 0.05, 0xffe07a, 1]],
  // The hat, with which there was a brief affair.
  hat: WORN.hat,
  // The river: a blue stone from it, on a string from her ear.
  river: [[0.25, 0.34, 0.52, 0.02, 0.04, 0.02, LACE], [0.25, 0.26, 0.52, 0.1, 0.08, 0.1, 0x5fb4f0]],
}
/**
 * What a very old sheep has that no other has: a small white beard under her chin (it goes with her head), and a
 * knitted blanket over her back and down both her sides, with a pale fringe along the foot of it (they go with her
 * body). A part with no colour here is of the blanket's colour, which is hers to choose.
 */
export const AGED: Part[] = [
  [0, 0.26, 0.6, 0.14, 0.08, 0.12, 0xfbf8f2],
  [0, 0.76, -0.06, 0.7, 0.05, 0.56, 0, 1], [-0.355, 0.56, -0.06, 0.04, 0.2, 0.56, 0, 1], [0.355, 0.56, -0.06, 0.04, 0.2, 0.56, 0, 1],
  [-0.355, 0.5, -0.06, 0.04, 0.06, 0.56, 0xfff6e0, 1], [0.355, 0.5, -0.06, 0.04, 0.06, 0.56, 0xfff6e0, 1],
]
const SPARE = 6 // how many cubes a sheep has for what it wears (or remembers): and as many again for what great age adds
export const SLOTS = EWE.length + SPARE + AGED.length
export const GREY = 0xe9e6e1 // the wool of a very old sheep: pale, and past dyeing
const DROOP = 0.1 // how far lower an old sheep's ears hang,
const STOOP = 0.05 // how far down she holds her head when she is doing nothing,
const REACH = 0.25 // and how far down it goes at the most: her beard is at the grass by then
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
  wear: Part[] // what it has on, or remembers, in the first six of its places; and what great age adds, in the rest
  old?: boolean // whether it is a very old sheep: it stoops, its ears hang, and it goes slowly
  wool: number
  cubes: number[] // one for each part of `EWE`, and `SLOTS` in all
  mark: number // what it was last drawn as
  sized: number
}

/** The cubes of one sheep, in a pool: `owner` is whose the pool is to say they are. What it wears is not on show yet. */
export const limbs = (flock: Cubes, owner: number) => [...EWE.map(([, , , , , , ink]) => flock.add(0, 0, 0, 1, 1, 1, ink || WOOL[0], owner)), ...AGED.concat(AGED).map(() => flock.add(0, 0, 0, 1, 1, 1, WOOL[0], owner, false))]

/** Which wool a sheep has (or which blanket, a very old one): the one its look names, or else the one its seed gives. */
export const woolOf = (seed: number, look: Look = {}) => look.wool ?? Math.floor(rnd(seed * 7 + 1) * WOOL.length)

/** A sheep's look is put on it: its wool in its colour (its look's, or else its seed's), and what it wears on the cubes kept for that. */
export function clothe(flock: Cubes, e: Body, seed: number, look: Look = {}) {
  e.old = !!look.elder
  const pick = woolOf(seed, look)
  e.wool = e.old ? GREY : WOOL[pick]
  // What it wears, in the first places. A very old sheep has on what she remembers, and nothing else; and in the last
  // places her beard and her blanket, which is of the colour that would have been her wool's.
  e.wear = e.old ? (look.memory ? [...KEEPSAKES[look.memory]] : []) : worn(look).flatMap((thing) => WORN[thing])
  if (e.old) AGED.forEach((part, k) => (e.wear[SPARE + k] = part[6] ? part : [...part.slice(0, 6), BLANKETS[pick], 1]))
  EWE.forEach(([, , , , , , ink], k) => {
    if (!ink) flock.paint(e.cubes[k], e.wool)
  })
  for (let k = 0; k < SPARE + AGED.length; k++) {
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
  const lift = (Math.abs(Math.sin(e.stride * Math.PI)) * HOP * (e.old ? 0.45 : e.rush > 1 ? 1.5 : 1) + (e.hop > 0 ? Math.sin(Math.min(1, e.hop / GLAD) * Math.PI) * 0.3 : 0)) * s + e.air
  const chew = (e.state === 'eat' || e.state === 'drink') && e.nod > 0.9 ? Math.max(0, Math.sin(time * 7 + s * 40)) * 0.06 : 0
  const flick = e.old ? -DROOP : e.rush > 1 || (time * 0.23 + s * 11) % 1 < 0.05 ? 0.05 : 0 // (its ears go up for a moment; and stay up when it runs)
  const mark = e.x * 13 + e.z * 7 + lift * 5 + e.nod * 3 + e.lie + e.face + chew + flick + floor
  if (mark === e.mark) return
  e.mark = mark
  e.y = floor + lift
  const [a, b, c, d] = TURNS[e.face]
  const odd = e.face & 1
  const sink = LEGS * e.lie
  const bow = e.old ? Math.max(STOOP, e.nod * (REACH - chew), e.lie * REACH) : Math.max(e.nod * (BOW - chew), e.lie * TUCK)
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

// What a bigger gift brings with a sheep (among the `items` of its look): butterflies about it, a small dog of its own, or both. Drawn
// here for the field and for the window alike, of cubes that are not the sheep's: whoever draws them has a pool for
// them.

/**
 * A small dog, looking along: four short legs, a body, a head with a snout, two ears, a tail that is up; and, after
 * those, the three marks that stand over its head while it barks. No box is in another. `PUP_WIDE` and `PUP_LONG`
 * are the half of the ground it stands over, across and along.
 */
const [EAR, SNOUT, WUF] = [0x6b5248, 0xfff6e0, 0xffc93c]
export const PUP: Part[] = [
  [-0.06, 0, 0.1, 0.05, 0.07, 0.05, EAR], [0.06, 0, 0.1, 0.05, 0.07, 0.05, EAR], [-0.06, 0, -0.1, 0.05, 0.07, 0.05, EAR], [0.06, 0, -0.1, 0.05, 0.07, 0.05, EAR],
  [0, 0.07, 0, 0.17, 0.13, 0.32, 0], [0, 0.13, 0.22, 0.15, 0.14, 0.12, 0], [0, 0.14, 0.305, 0.08, 0.06, 0.05, SNOUT],
  [-0.055, 0.27, 0.2, 0.04, 0.05, 0.05, EAR], [0.055, 0.27, 0.2, 0.04, 0.05, 0.05, EAR], [0, 0.17, -0.185, 0.04, 0.09, 0.05, 0],
  [0, 0.37, 0.22, 0.03, 0.07, 0.03, WUF], [-0.07, 0.35, 0.22, 0.03, 0.05, 0.03, WUF], [0.07, 0.35, 0.22, 0.03, 0.05, 0.03, WUF],
]
export const PUP_WIDE = 0.1
export const PUP_LONG = 0.34
/** The coats a dog comes in: its seed picks one. */
export const COATS = [0xd9a066, 0xfff1d6, 0x9a7868, 0xc9c2d0]
/** What of a dog its drawing goes by. */
export type Pup = {
  s: number
  x: number
  y: number // how high its feet are (the ground, or the back it sits on)
  z: number
  face: number // which quarter turn it looks: see `TURNS`
  stride: number // how far along its stride it is: it goes at a hop, as the sheep do
  lie: number // how far it has lain down, 0 to 1: its legs are folded away
  bark: number // for how long it goes on barking
  cubes: number[] // one for each part of `PUP`
}
/** The cubes of one dog, in a pool, not on show yet. */
export const kennel = (pool: Cubes, seed: number) => PUP.map(([, , , sx, sy, sz, ink]) => pool.add(0, -40, 0, sx, sy, sz, ink || COATS[Math.floor(rnd(seed * 7 + 9) * COATS.length)], -1, false))
/** Puts a dog's cubes where it is: up at every step, a small jump at every bark, its tail going, and down on its belly when it lies. */
export function hound(pool: Cubes, d: Pup, time: number) {
  const { s, cubes } = d
  const [a, b, c, e] = TURNS[d.face]
  const odd = d.face & 1
  const lift = (Math.abs(Math.sin(d.stride * Math.PI)) * 0.07 + (d.bark > 0 ? Math.abs(Math.sin(d.bark * 16)) * 0.05 : 0)) * s
  for (let k = 0; k < PUP.length; k++) {
    const [dx, dy, dz, sx, sy, sz] = PUP[k]
    const shown = k < 4 ? d.lie < 0.5 : k < 10 || d.bark > 0
    if (!shown) {
      pool.hide(cubes[k])
      continue
    }
    const wag = k === 9 && d.lie < 0.5 ? Math.sin(time * 12 + s * 30) * 0.02 : 0
    pool.show(cubes[k])
    pool.size(cubes[k], (odd ? sz : sx) * s, sy * s, (odd ? sx : sz) * s)
    pool.place(cubes[k], d.x + (a * (dx + wag) + b * dz) * s, d.y + lift + (dy - (k < 4 ? 0 : 0.14 * Math.max(0, d.lie - 0.5)) + sy / 2) * s, d.z + (c * (dx + wag) + e * dz) * s)
  }
}

export const FLIT = 3 // how many butterflies a sheep has about it,
export const WINGS = [0xffc2d9, 0xc4a4f0, 0xffe07a, 0x9cc4f0] // and what colours their wings may be
/** The cubes of a sheep's butterflies, in a pool, not on show yet: for each a body and two wings. */
export const swarm = (pool: Cubes, seed: number) =>
  Array.from({ length: FLIT * 3 }, (_, k) => pool.add(0, -40, 0, 0.05, 0.04, 0.13, k % 3 ? WINGS[Math.floor(rnd(seed * 7 + 11 + Math.floor(k / 3)) * WINGS.length)] : FACE, -1, false))
/**
 * Puts a sheep's butterflies where they are: each goes round the sheep in a slow loop of its own, a little out from
 * it and well over its head (clear of its hat, and of the thought over it, which is narrower than the loop), rising
 * and falling, wings going. Cubes do not turn: a butterfly looks the quarter turn nearest to the way it goes.
 * @param y how high the sheep's feet are
 */
export function flutter(pool: Cubes, cubes: number[], x: number, y: number, z: number, s: number, time: number, seed: number) {
  for (let k = 0; k < FLIT; k++) {
    const way = k & 1 ? -1 : 1
    const turn = way * time * (0.55 + 0.2 * k) + k * 2.1 + seed
    const out = 0.72 + 0.07 * Math.sin(time * 0.6 + k * 1.3)
    const [bx, by, bz] = [x + Math.sin(turn) * out, y + (1.3 + 0.13 * k) * s + 0.07 * Math.sin(time * 2.1 + k * 1.7), z + Math.cos(turn) * out]
    const odd = Math.abs(Math.cos(turn)) > Math.abs(Math.sin(turn)) // (it goes mostly across: its wings are out along)
    const wide = 0.04 + 0.1 * Math.abs(Math.sin(time * 13 + k * 2))
    pool.show(cubes[k * 3])
    pool.size(cubes[k * 3], odd ? 0.13 : 0.05, 0.04, odd ? 0.05 : 0.13)
    pool.place(cubes[k * 3], bx, by, bz)
    for (let side = -1; side <= 1; side += 2) {
      const c = cubes[k * 3 + (side > 0 ? 2 : 1)]
      const off = side * (0.025 + wide / 2)
      pool.show(c)
      pool.size(c, odd ? 0.11 : wide, 0.02, odd ? wide : 0.11)
      pool.place(c, bx + (odd ? 0 : off), by + 0.025, bz + (odd ? off : 0))
    }
  }
}
