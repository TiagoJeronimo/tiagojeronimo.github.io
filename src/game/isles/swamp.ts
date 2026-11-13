import { note } from '../../sound.ts'
import type { Critter } from '../critters.ts'
import { BARK, GROUND, NEVER, any, rnd, tx, tz, type Isle } from '../grid.ts'
import type { Island } from '../Island.ts'

const LIT = [0xff9ad5, 0xffd45c, 0x9be3d0, 0x86b6f5, 0xc4a4f0]
const DIM = 0xd9c2f5

// The fairy ring of each game: its five caps, smallest first, and how many have been tapped in the right order.
// Whole again it is an instrument, and there is a song to play on it: the one the frog sings once it has its night-light.
interface Ring {
  caps: number[]
  tiles: number[]
  next: number
  centre: number
  song: number[]
  played: number[]
  sung: (text: string) => void
}
const rings = new WeakMap<Island, Ring>()
/** The ring of this game, made the first time anything asks for it. The song is five of its notes, no two the same in a row, and another five on every island. */
function ringOf(w: Island) {
  let ring = rings.get(w)
  if (!ring) {
    const song: number[] = []
    for (let n = 0; song.length < 5; n++) {
      const k = Math.floor(rnd(w.seed * 131 + n * 17 + 3) * 5)
      if (k !== song[song.length - 1]) song.push(k)
    }
    rings.set(w, (ring = { caps: [], tiles: [], next: 0, centre: -1, song, played: [], sung: w.extra('secret', { icon: 'notes', hint: 'The frog only sings for a night-light. The ring next door can sing it back. Listening is one thing. Answering is the hard part.', at: () => w.above(w.things[rings.get(w)!.centre].tile, 1) }) }))
  }
  return ring
}
/** A note, to look at: a small bright cube that drifts up. */
const sing = (w: Island, x: number, y: number, z: number, k: number, lean = 0) => {
  note(0.2 + k * 0.15, 0.12)
  w.bits.spawn(x, y, z, lean, 1.5, 0, 0.16, LIT[k], 1.8, NEVER, 0, 0.6, 2.6)
}

/** The frog croaks, and its cloud goes where rain will do something: a thirsty cactus, a lit fire, running lava. Otherwise it rains at home. */
function croak(w: Island, frog: Critter, first: boolean) {
  for (let k = 0; k < 3; k++)
    w.after(k * 0.35, () => {
      note(0.05 + k * 0.04, 0.18)
      frog.pet = 0.7
    })
  const beach = w.index('beach')
  const thirsty = () => w.open[beach] && w.things.some((thing) => thing.todo && w.isle[thing.tile] === beach)
  if (first) {
    w.say('A frog! It clears its throat, and a cloud drifts in to fill the bog. It makes rain by complaining. The most powerful thing here, and it sits on a leaf.', 'frog')
    return w.rainOn('swamp', [frog.x + 6, frog.z - 5])
  }
  const [to, words] = thirsty()
    ? ['beach', 'The frog sends its cloud south, to the beach. One croak. That is the whole procedure.']
    : w.memo.fire && !w.memo.steam
      ? ['snow', 'The frog sends its cloud north, over the snow. There is a fire burning up there. The frog knows. The frog is like that.']
      : w.memo.lava && !w.memo.glass
        ? ['volcano', 'The frog sends its cloud east, over the volcano. A frog against a volcano. It likes its chances.']
        : ['swamp', 'The frog calls its cloud home. It rains on the bog again, which did not need it. Home is like that.']
  w.say(words, 'frog')
  w.rainOn(to, [frog.x, frog.z])
}

/** One of the ring's mushrooms is tapped. Smallest to tallest wakes it; anything else, and it starts over. */
function tap(w: Island, k: number) {
  const ring = ringOf(w)
  const centre = w.things[ring.centre]
  if (!centre.todo) {
    // Whole again, every cap rings with a note of its own. The last five played are the tune: if it is the frog's, the swamp joins in.
    w.solid.paint(ring.caps[k], LIT[k], 3.4)
    w.after(0.35, () => w.solid.paint(ring.caps[k], LIT[k], 2.2))
    w.solid.poke(ring.caps[k], 6)
    sing(w, tx(ring.tiles[k]), w.h[ring.tiles[k]] + 0.6 + k * 0.12, tz(ring.tiles[k]), k)
    ring.played = [...ring.played, k].slice(-5)
    if (w.memo.chorus || ring.played.join() !== ring.song.join()) return
    w.memo.chorus = 1
    ring.sung('A secret: the song the frog sings, played back on the ring. The whole swamp joins in, and will not stop humming now. You taught a bog a tune. It cannot be untaught.')
    for (let n = 0; n < 40; n++) w.after(n * 0.06, () => sing(w, tx(centre.tile) + Math.cos(n * 0.7) * 1.6, w.h[centre.tile] + 0.4, tz(centre.tile) + Math.sin(n * 0.7) * 1.6, n % 5))
    return
  }
  if (k !== ring.next) {
    ring.next = 0
    for (const cap of ring.caps) w.solid.paint(cap, DIM)
    note(0.02, 0.12)
    return w.say('The ring goes dark again. No hard feelings. Perhaps the smallest one first? Most things go better that way.', 'fairy ring')
  }
  w.solid.paint(ring.caps[k], LIT[k], 2.2)
  w.solid.poke(ring.caps[k], 6)
  note(0.2 + k * 0.15, 0.12)
  if (++ring.next < 5) return
  centre.todo = false
  centre.tip = 'The fairy ring, whole again. Every cap has a note of its own, at last'
  w.score(centre.tile)
  w.say('The ring is whole. Light runs out from it, all across the swamp. Five small things in the right order. That is all most miracles are.', 'fairy ring')
  w.source(centre.tile, 3.8, 0.4)
  for (let n = 0; n < 40; n++) w.bits.spawn(tx(centre.tile), w.h[centre.tile] + 0.4, tz(centre.tile), Math.cos(n) * (2 + (n % 5)), 1 + (n % 3), Math.sin(n) * (2 + (n % 5)), 0.1, LIT[n % 5], 1.6, NEVER, 0, 1, 2.5)
}

/**
 * The mushroom swamp, west of the island: mud, reeds, and mushrooms as tall as trees.
 *   g  bog, filled by rain     f  the frog on its lily pad     1-5  the fairy ring, smallest to tallest     j  its middle
 *   l  a lantern     H  bridge to the island
 */
export const swamp: Isle = {
  name: 'swamp',
  at: [0, 13],
  rows: [
    '  .T...  ',
    ' ..g..T. ',
    '.Tgg.3...',
    '..g.2j4..',
    '..f.1.5.T',
    '..gg....H',
    '..gggl...',
    ' T.g...T ',
    '  .....  ',
  ],
  // What any map of it has to keep to: the bridge at (8, 5). The bog fills from the sky, so it may lie anywhere.
  // On these two the lantern stands where a tall mushroom would hide nothing, so the two can trade places when an island is
  // dealt; on the first map it cannot (a mushroom in its place would stand in front of the ring), so there it never moves.
  variants: [
    // The bog in the north-east, the ring in the south-west.
    {
      rows: [
        '  .T...  ',
        ' ...gg.. ',
        '.T..ggggT',
        '.....fgg.',
        '..1..gg..',
        '.5j2....H',
        '.4.3.l.T.',
        ' ....... ',
        '  ..T.T  ',
      ],
    },
    // The bog along the south, the ring in the north.
    {
      rows: [
        '  T....  ',
        ' ...2.T. ',
        '...1j3...',
        'T..5.4..T',
        '.......l.',
        '...ggg..H',
        '..ggfgg..',
        ' T.ggg.T ',
        '  .....  ',
      ],
    },
  ],
  beds: 'gf',
  rainfed: 'gf',
  loose: 'lT',
  finds: 'fl12345j',
  look: {
    dry: [0x9f9484, 0x958a7a, 0xa99e8e], green: [0x79c493, 0x86cc9e, 0x6cb987], tuft: 0x5fae7f, tufts: 2, soil: 0x75655c, bed: 0x8d7f6f, wet: 0x6f6a5e, water: 0x7fcdb5,
    reach: 2.2, flowers: 0.12, petals: [0xd9b3ff, 0xfff6e0, 0x9be3d0], tree: 'shroom', dress: 'reed', litter: [0x8a7a5c, 0xa08e68],
  },

  lay(w, tile, c) {
    const s = w.isle[tile]
    const x = tx(tile)
    const z = tz(tile)
    const top = w.h[tile]
    if (c === 'f') {
      // Asleep on a lily pad in the dry bog. When the bog fills, pad and frog float up with it.
      const frog = w.critters.spawn('frog', x, top + 0.06, z, 0x7fca6c)
      const t: number = w.thing(tile, {
        auto: false,
        hits: 2,
        keep: true,
        sleeper: true,
        sound: 'ribbit',
        fuss: 'That is a great deal of rain. The frog would like it known that it is not a tap.',
        tip: 'A frog, asleep on a lily pad. In a bog with no water. Committed',
        clue: 'A [frog] is asleep on a lily pad, in a bog with no water in it. It is waiting for things to get better. Somebody should tell it how that works. Knock.',
        onBreak: () => {
          w.things[t].tip = 'The frog. A knock, and it calls the rain. Nobody asked if it minds'
          croak(w, frog, true)
        },
        // Awake, a click on the frog or its pad is a croak, and a croak is rain somewhere.
        tap: () => {
          w.pat(frog)
          croak(w, frog, false)
        },
      })
      const pad = w.put(t, 0, 0.03, 0, 0.66, 0.06, 0.66, 0x6fbc6c)
      frog.thing = t
      frog.hidden = true
      w.sleepers[s].push(frog)
      w.onFill.push((filled) => {
        if (filled !== tile) return
        w.solid.place(pad, x, top + 0.47, z)
        w.critters.go(frog, x, top + 0.5, z, 0.4, 0.2)
      })
    } else if ('12345'.includes(c)) {
      const k = Number(c) - 1
      const t = w.thing(tile, { auto: false, sound: 'ting', tip: 'A little mushroom, one of five in a ring. It knows where it comes in the order', tap: () => tap(w, k) })
      w.put(t, 0, 0.14 + k * 0.06, 0, 0.14, 0.28 + k * 0.12, 0.14, 0xf3ead8)
      const cap = w.put(t, 0, 0.34 + k * 0.12, 0, 0.36 + k * 0.07, 0.16, 0.36 + k * 0.07, DIM)
      const ring = ringOf(w)
      ring.caps[k] = cap
      ring.tiles[k] = tile
    } else if (c === 'j') {
      // (It is the five mushrooms round it that get tapped: they are what stirs, to say so.)
      const t = w.thing(tile, { auto: false, todo: true, touched: () => ringOf(w).tiles.flatMap((u) => w.standing[u].flatMap((i) => w.things[i].cubes)), tip: 'A ring of five mushrooms. They would like to be taken in order', clue: '[Five little mushrooms] stand in a ring in the swamp, each a bit taller than the last. They would like to be noticed in the right order. Who would not.' })
      w.put(t, 0, 0.04, 0, 0.7, 0.08, 0.7, 0x8f9a8a)
      w.put(t, 0, 0.1, 0, 0.3, 0.06, 0.3, 0xa9b29c)
      ringOf(w).centre = t
    } else if (c === 'l') {
      // A lantern on a crooked post. Lit, it brings the night; after that, a tap turns night to day and back.
      const t: number = w.thing(tile, {
        auto: false,
        hits: 1,
        keep: true,
        sound: 'click',
        fuss: 'Night, day, night, day. You have made the best part of a week go by. Nobody is any older. Lucky them.',
        tip: 'An unlit lantern. Not broken. Waiting',
        clue: 'An [unlit lantern] hangs on a crooked post in the swamp. It can do exactly one thing, and nobody has asked. Ask.',
        onBreak: () => {
          w.say('The lantern is lit, and night comes down with its fireflies. The big mushrooms glow, and the ground wakes in their light. You put the sun out to see better. Tap the lantern again for morning.', 'lantern')
          w.grow(t)
          w.things[t].tip = 'The lantern. A tap turns night into day, and back. No pressure'
          w.setNight(true)
          for (const u of w.tiles[s]) if (w.mark[u] === 'T') w.source(u, 2.2, 1 + Math.random())
        },
        tap: () => {
          w.setNight(!w.night)
          w.say(w.night ? 'Night again. The same one. It kept your place.' : 'Morning. Nobody is ready. It comes anyway.', 'lantern')
        },
      })
      w.put(t, 0, 0.6, 0, 0.1, 1.2, 0.1, BARK)
      w.put(t, 0.16, 1.2, 0, 0.42, 0.08, 0.08, BARK)
      w.put(t, 0.32, 0.92, 0, 0.26, 0.34, 0.26, 0x4a4458)
      w.put(t, 0.32, 1.12, 0, 0.3, 0.06, 0.3, 0x3a3340)
      w.solid.paint(w.put(t, 0.32, 0.9, 0, 0.28, 0.2, 0.28, 0xffc24a, true), 0xffc24a, 2.6)
    } else if (c === 'H') {
      w.planks(w.thing(tile), 1, 0)
      w.signpost(tile, 1, 0, [
        'THE SWAMP. It is damp here on purpose.',
        'Everything in a swamp is slowly turning into something else. The sign is trying not to think about it.',
        'Mind the bog. The bog does not mind you. That is the whole thing about a bog.',
      ])
    }
  },

  done(w, s) {
    // Once the frog has its night-light it sings: five notes, the colours of the five caps of the ring, over and over.
    // Somebody who plays them back on the ring finds the swamp humming along for good.
    const { song } = ringOf(w)
    const tall = w.tiles[s].filter((u) => w.mark[u] === 'T')
    let beat = 4
    w.ticks.push((dt) => {
      if (!w.open[s]) return
      if (w.memo.chorus && Math.random() < dt * 1.4) {
        const u = tall[Math.floor(Math.random() * tall.length)]
        sing(w, tx(u) + any(), w.h[u] + 2, tz(u) + any(), Math.floor(Math.random() * 5))
      }
      if (!w.memo.frogSong || (beat -= dt) > 0) return
      beat = 9
      const frog = w.critters.list.find((c) => c.kind === 'frog')
      if (!frog) return
      song.forEach((k, n) =>
        w.after(n * 0.45, () => {
          frog.pet = 0.6
          sing(w, frog.x, frog.y + 0.5, frog.z, k, (n - 2) * 0.3)
        }),
      )
    })
    // The swamp has a ghost. It is shy, and only comes out at night.
    const [x, z] = w.middle('swamp')
    const seen = w.extra('secret', { icon: 'ghost/f4f8ff', hint: 'The swamp keeps company after dark. Be kind to it. It has been practising saying boo for years, and it is not going well.', at: () => (ghost.hidden ? undefined : [ghost.x, ghost.y + 0.6, ghost.z]) })
    const ghost = w.critters.spawn('ghost', x, GROUND + 0.9, z)
    ghost.hidden = true
    ghost.next = (g) => {
      const u = w.tiles[s][Math.floor(Math.random() * w.tiles[s].length)]
      w.critters.go(g, tx(u), w.h[u] + 0.9, tz(u), 3, 0.3)
      g.rest = 1 + Math.random() * 2
    }
    ghost.onPat = () => {
      w.pat(ghost)
      seen('A secret: the swamp has a ghost. It is shy, and only comes out at night. It is not haunting anything. It just did not know where else to go.')
    }
    w.ticks.push(() => (ghost.hidden = !(w.open[s] && w.night)))
    // Will-o'-the-wisps over the bog, once it is night.
    w.ticks.push((dt) => {
      if (!w.open[s] || !w.night || Math.random() > dt * 4) return
      const u = w.tiles[s][Math.floor(Math.random() * w.tiles[s].length)]
      w.bits.spawn(tx(u) + any(), w.h[u] + 0.6, tz(u) + any(), any() * 0.4, 0.3, any() * 0.4, 0.09, 0x9be3d0, 3, NEVER, 0, 0, 2.5)
    })
  },
}
