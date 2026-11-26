import { note, thump } from '../../../sound.ts'
import type { Critter } from '../critters.ts'
import { BARK, NEAR, NEVER, RING, STONE, W, WOOD, any, step, tx, tz, type Isle } from '../grid.ts'
import type { Island } from '../Island.ts'
import { croak } from './swamp.ts'

/**
 * The tide, once the shell has called it in: the plug lets it out and the shell calls it back, for as long as anyone cares to.
 * Low tide empties the lagoon and leaves starfish, shells and weed on its floor, and a row of stones out to a scrap of sand in the west.
 * @param from where the stones start
 * @param hole the tile the plug is on: nothing is left lying there
 */
function tides(w: Island, s: number, from: number, hole: number) {
  const lagoon = w.tiles[s].filter((u) => w.mark[u] === 'l')
  const [mx, mz] = [lagoon.reduce((n, u) => n + tx(u), 0) / lagoon.length, lagoon.reduce((n, u) => n + tz(u), 0) / lagoon.length]
  const floor = [...lagoon].sort((a, b) => Math.hypot(tx(a) - mx, tz(a) - mz) - Math.hypot(tx(b) - mx, tz(b) - mz))
  // What the sea leaves behind, hidden until it goes: two starfish, a few shells, some weed.
  const left: number[] = []
  const lay = (u: number, dx: number, dz: number, sx: number, sy: number, sz: number, color: number) => left.push(w.solid.add(tx(u) + dx, w.h[u] + sy / 2, tz(u) + dz, sx, sy, sz, color, -2 - u, false))
  floor.forEach((u, k) => {
    if (u === hole) return
    if (k % 4 === 0) for (const [dx, dz] of [[0, 0], ...NEAR]) lay(u, 0.1 + dx * 0.13, -0.1 + dz * 0.13, 0.13, 0.07, 0.13, 0xff9a5c)
    else if (k % 4 === 1) for (const [dx, dz, high] of [[-0.2, 0.2, 0.3], [-0.08, 0.1, 0.42], [-0.28, 0.02, 0.2]]) lay(u, dx, dz, 0.07, high, 0.07, 0x6fbc86)
    else if (k % 4 === 2) for (const [dx, dz, color] of [[0.2, 0.2, 0xffffff], [-0.15, -0.2, 0xffc2d9]]) lay(u, dx, dz, 0.14, 0.08, 0.12, color)
  })
  // The stones go west from the beach, one for every tile of sea between it and the islet.
  const stones = [1, 2, 3].map((k) => w.solid.add(tx(from) - k + (k % 2 ? 0.08 : -0.1), w.h[from] - 0.1, tz(from) + (k % 2 ? 0.14 : -0.12), 0.5, 0.2, 0.42, STONE[k % 3], -2 - from, false))
  let found = false
  return (high: boolean) => {
    w.memo.tide = high ? 1 : 0
    lagoon.forEach((u, k) =>
      w.after(k * 0.12, () => {
        w.blocked[u] = high ? 0 : 1
        if (high) w.fill(u)
        else w.drain(u)
      }),
    )
    ;[...left, ...stones].forEach((cube, k) => (high ? w.solid.hide(cube, k * 0.03) : w.solid.show(cube, 0.8 + k * 0.05)))
    if (high) return w.say('The shell calls, and the tide comes back in over the starfish and the stones. The plug hops back in by itself. The starfish had only just got used to it. They always have only just got used to it.', 'shell')
    // The first time the sea goes out, one line for all of it: the islet the stones lead to comes up two seconds on.
    w.say(found ? 'The plug comes out again, and the sea leaves. Starfish, shells, and a row of stones that goes somewhere. You pulled the plug on an ocean. It should be harder than that.' : 'The plug comes out, and the sea goes down the hole after it. Stones lead west, to a scrap of sand nobody has stood on in years. It has a lighthouse. For whom is not clear.', 'plug')
    if (found) return
    found = true
    w.after(2.2, () => {
      w.raise('islet')
      for (const u of w.tiles[w.index('islet')]) w.wakeAt[u] = w.time + 2 + Math.random() * 1.5
    })
  }
}

/** A cactus: its trunk and two arms, as boxes in the plane it stands in: across, up, width and height. */
const SHAPE = [[0, 0.45, 0.3, 0.9], [-0.27, 0.5, 0.26, 0.12], [-0.34, 0.7, 0.14, 0.34], [0.27, 0.34, 0.26, 0.12], [0.34, 0.5, 0.14, 0.26]]
/** What the shell's label says with the sea out, and with it in. */
const SHELL = ['The shell that calls the tide. Blow it, and the sea comes back in. It does not ask why', 'The shell that calls the tide. The sea is in. To let it out again, there is a plug']
/** And the plug's. */
const PLUG = ['A plug, pulled, and a duck with nothing to float on. The shell calls the sea back', 'A plug, on a chain, and the duck that minds it. Knock, and out it comes']
/** The duck, in boxes, from where it sits: across, up and along, its size, and its colour. Body, head, beak, tail. */
const DUCK = [[0, 0.09, 0, 0.26, 0.18, 0.32, 0xffd45c], [0, 0.25, 0.1, 0.17, 0.16, 0.17, 0xffd45c], [0, 0.23, 0.22, 0.09, 0.05, 0.08, 0xf5a742], [0, 0.2, -0.18, 0.1, 0.09, 0.06, 0xffd45c]]

/**
 * The lagoon has a plug, at its seaward end, like a bath: a soft round one, on a chain of beads from a peg on the bank,
 * and on it a rubber duck. It bobs up with the first tide. A knock pulls it and the sea goes out, which shows the
 * stones to the islet; the shell calls the sea back, and the plug goes in again by itself. So the shell does one thing
 * and the plug the other, and nobody has to think of blowing a shell twice. (It is on a tile of the lagoon and not on a
 * letter of the map: wherever the lagoon lies, it has one.)
 */
function plug(w: Island, s: number) {
  const tile = w.tiles[s].filter((u) => w.mark[u] === 'l').sort((a, b) => tz(b) - tz(a))[0]
  const shell = w.things.find((thing) => thing.key === 'beach:c0')
  if (tile === undefined || !shell) return
  const [x, z, floor] = [tx(tile), tz(tile), w.h[tile]]
  const bank = w.h[step(tile, 0, 1)] - floor // how far the bank to the south stands above the floor of the lagoon
  let turn: ((high: boolean) => void) | undefined
  let told = false
  const set = (high: boolean) => {
    // The beach's west edge, level with the islet, is where the stones start.
    turn ??= tides(w, s, w.tiles[s].filter((u) => tz(u) === tz(beach.at[0] + (beach.at[1] + 3) * W)).sort((a, b) => tx(a) - tx(b))[0], tile)
    turn(high)
    seated.forEach((cube, k) => (high ? w.solid.show(cube, 2.2 + k * 0.06) : w.solid.hide(cube)))
    pulled.forEach((cube, k) => (high ? w.solid.hide(cube) : w.solid.show(cube, 0.25 + k * 0.06)))
    w.things[t].tip = PLUG[+high]
    shell.tip = SHELL[+high]
    // The duck goes where the plug goes: afloat on it, or perched on top of it where it stands on the bank.
    if (!high) sit(0.16, bank + 0.58, 0.5)
  }
  /** The duck is put somewhere: so far across, up and along from the middle of the tile and the floor of the lagoon. */
  const sit = (dx: number, dy: number, dz: number) => duck.forEach((cube, k) => w.solid.place(cube, x + dx + DUCK[k][0], floor + dy + DUCK[k][1], z + dz + DUCK[k][2]))
  const t: number = (w.memo.plug = w.thing(tile, {
    auto: false,
    sound: 'squeak', // (that is the duck)
    tip: PLUG[1],
    fuss: 'It is out. It cannot be more out. The duck has said so six times.',
    // It is not there to be seen until the first tide brings it up (the shell does that: `grow`).
    wake: () => [...seated, ...ashore, ...duck].forEach((cube, k) => w.solid.show(cube, k * 0.06)),
    tap: () => {
      if (!w.memo.tide) return
      thump()
      w.word('pop', x, floor + 1.1, z)
      // The water turns once round the hole on its way down.
      for (let k = 0; k < 10; k++) w.bits.spawn(x + Math.cos(k * 0.63) * 0.4, floor + 0.46, z + Math.sin(k * 0.63) * 0.4, -Math.sin(k * 0.63) * 1.4, 0.4, Math.cos(k * 0.63) * 1.4, 0.1, 0x9fd6ff, 0.9, floor, 0, 6)
      set(false)
    },
  }))
  // In its hole, with the sea over it: a cream plug with a pink top, high enough in the water for the bank not to hide
  // it, and a red loop for its chain, which is white and pink beads up to a peg with a red knob on the bank.
  const afloat = [
    [w.scar(t, 0, 0.5, 0, 0.56, 0.14, 0.56, 0xfff1dc), 0.5],
    [w.scar(t, 0, 0.605, 0, 0.36, 0.07, 0.36, 0xff9ab0), 0.605],
  ]
  const seated = [...afloat.map(([cube]) => cube), w.scar(t, -0.08, 0.6, 0.27, 0.12, 0.12, 0.06, 0xe2694f), ...[0.25, 0.5, 0.75].map((far, k) => w.scar(t, -0.08 - 0.24 * far, 0.62 + (bank + 0.28 - 0.62) * far, 0.28 + 0.22 * far, 0.09, 0.09, 0.09, k % 2 ? 0xffc2d9 : 0xffffff))]
  const ashore = [w.scar(t, -0.32, bank + 0.16, 0.52, 0.12, 0.32, 0.12, WOOD), w.scar(t, -0.32, bank + 0.36, 0.52, 0.16, 0.08, 0.16, 0xe2694f)]
  const duck = DUCK.map(([dx, dy, dz, sx, sy, sz, color]) => w.scar(t, dx, 0.64 + dy, dz, sx, sy, sz, color))
  // Pulled: the hole it leaves in the floor, and the plug stood on its edge on the rim of the bank beside the peg,
  // where it can be seen (the floor of the lagoon cannot, from most places), its pink top to the front, and the beads
  // slack between the two.
  const pulled = [
    w.scar(t, 0, 0.015, 0, 0.36, 0.03, 0.36, 0x2a2433),
    w.scar(t, 0.16, bank + 0.3, 0.5, 0.56, 0.56, 0.14, 0xfff1dc),
    w.scar(t, 0.16, bank + 0.3, 0.605, 0.36, 0.36, 0.07, 0xff9ab0),
    ...[0.22, 0.1, 0.22].map((dy, k) => w.scar(t, -0.24 + k * 0.05, bank + dy, 0.51, 0.07, 0.07, 0.07, k % 2 ? 0xffc2d9 : 0xffffff)),
  ]
  // What a blow on the shell does once the tide has come in the first time: it calls the sea back, if it is out.
  shell.tap = () => {
    note(w.memo.tide ? 0 : 0.1, 0.22)
    if (!w.memo.tide) return set(true)
    if (!told) w.say('The shell calls. The sea is already in, and says so by doing nothing. To let it out again, the lagoon has a plug.', 'shell')
    told = true
  }
  // In its hole it bobs, a little, with the water: and the duck on it a little more, and a moment after.
  w.ticks.push((_, time) => {
    if (!w.things[t].up || !w.memo.tide) return
    for (const [cube, high] of afloat) w.solid.place(cube, x, floor + high + Math.sin(time * 2.1) * 0.025, z)
    sit(0, 0.64 + Math.sin(time * 2.1 - 0.5) * 0.04, 0)
  })
}

// A hammock, piece by piece from one trunk to the other, for trunks three tiles apart and for two: from where to where
// along the way, how high, and whether it is rope or cloth. It hangs in steps, each piece resting on the end of the next.
const SLING: Record<number, number[][]> = {
  3: [[0.08, 0.56, 0.83, 0], [0.48, 1.02, 0.76, 1], [0.92, 2.08, 0.68, 2], [1.98, 2.52, 0.76, 1], [2.44, 2.92, 0.83, 0]],
  2: [[0.08, 0.4, 0.83, 0], [0.33, 0.72, 0.76, 1], [0.64, 1.36, 0.68, 2], [1.28, 1.67, 0.76, 1], [1.6, 1.92, 0.83, 0]],
}

/**
 * A hammock on the beach: between two palms that stand in line with bare sand between them, or, where no two do, between
 * a palm and a post. A click sets it rocking. Once the whole beach is awake the crab takes to it now and then.
 */
function hammock(w: Island, s: number) {
  const level = (u: number, like: number) => u >= 0 && w.isle[u] === s && w.h[u] === w.h[like]
  const bare = (u: number, like: number) => level(u, like) && w.mark[u] === '.'
  const palms = w.tiles[s].filter((u) => w.mark[u] === 'T')
  let sling: { from: number; di: number; dj: number; span: number; post: boolean } | undefined
  for (const post of [false, true])
    for (const span of [3, 2])
      for (const from of palms)
        for (const [di, dj] of post ? NEAR : [[1, 0], [0, 1]]) {
          const end = step(from, di * span, dj * span)
          const between = Array.from({ length: span - 1 }, (_, k) => step(from, di * (k + 1), dj * (k + 1)))
          if (!sling && between.every((u) => bare(u, from)) && (post ? bare(end, from) : level(end, from) && palms.includes(end))) sling = { from, di, dj, span, post }
        }
  if (!sling) return
  const { from, di, dj, span, post } = sling
  const tile = step(from, di, dj) // it belongs to the first tile it hangs over
  const top = w.h[tile]
  const lean = 0.07 // a palm leans this far east at the height the ropes are tied: the whole of it sits that far over
  let push = 0
  let lounger: Critter | undefined
  let on = false
  let until = 0
  const t = w.thing(tile, {
    tip: 'A hammock. The one thing here that works by doing nothing',
    fuss: 'You are rocking an empty hammock, or a crab. Neither has thanked you.',
    sound: 'creak',
    play: () => {
      push = 1
      if (on && lounger) w.word('clack', lounger.x, lounger.y + 0.5, lounger.z)
    },
  })
  if (post) w.put(w.thing(step(from, di * span, dj * span)), lean, 0.5, 0, 0.14, 1, 0.14, WOOD)
  const cloth = SLING[span].map(([a, b, y, kind]) => {
    const [mid, long, wide] = [(a + b) / 2 - 1, b - a, kind ? 0.6 : 0.06]
    return w.put(t, di * mid + lean, y, dj * mid, di ? long : wide, kind ? 0.08 : 0.06, di ? wide : long, [0xd9c98f, 0xe9806f, 0xfff3df][kind])
  })
  // Where somebody lying in it lies: the middle of the middle piece.
  const [mx, mz] = [tx(tile) + di * (span / 2 - 1) + lean, tz(tile) + dj * (span / 2 - 1)]
  for (const cube of cloth) w.solid.bendy(cube, 0.16, top, mx, mz) // it goes with the palms in the wind
  w.ticks.push((dt, time) => {
    if (!w.open[s]) return
    push *= Math.exp(-dt / 4)
    // It rocks across the way it hangs: every piece leans about the height of the ropes.
    const rock = Math.tan(0.9 * push * Math.sin(time * 2.1))
    for (const cube of cloth) w.solid.lean(cube, -dj * rock, di * rock, top + 0.86)
    const crab = lounger ?? w.critters.list.find((c) => c.kind === 'crab' && c.next === w.hop)
    if (!crab) return
    if (on) {
      Object.assign(crab, { x: mx + dj * rock * 0.18, y: top + 0.72, z: mz - di * rock * 0.18, face: Math.atan2(-dj, di) })
      if (time < until) return
      on = false
      lounger = undefined
      crab.next = w.hop // back to work, or to pottering about
      crab.rest = 0.2
    } else if (!lounger && w.critters.lively(crab) && w.awake[s] === w.tiles[s].length && Math.random() < dt * 0.05) {
      lounger = crab
      crab.next = undefined
      w.critters.go(crab, mx, top + 0.72, mz, 0.6, 0.8, () => {
        on = true
        until = w.time + 12 + Math.random() * 10
      })
    }
  })
}

/**
 * The beach, south of the island: grey sand that turns golden, palms, and a lagoon the tide has left dry.
 *   l  the lagoon     c  a big spiral shell     x  a crab under a heap of sand     y  a cactus on its dune
 *   J  stepping stones to the island     B  an old boat     S  a sandcastle
 */
export const beach: Isle = {
  name: 'beach',
  at: [11, 26],
  rows: [
    '   .T..J.T.  ',
    '  ..y......  ',
    ' ....lll..T. ',
    '.T..llll.x...',
    '....lll....B.',
    ' .c..ll...T. ',
    '  ....l.S..  ',
    '    .....    ',
  ],
  high: ['   11        ', '   111       '],
  // What any map of it has to keep to: the stepping stones at (7, 0); bare sand at (0, 3), where the stones out to the
  // islet start, and at (12, 3) and (12, 4), where the new land joins on; and a lagoon all in one piece that touches no coast.
  variants: [
    // The lagoon in the west, the dune in the north-east.
    {
      rows: [
        '   .T..J...  ',
        '  ....T..y.  ',
        ' .lll......T ',
        '..llll.x.....',
        '..llll....B..',
        ' T.ll....cT. ',
        '  .....S...  ',
        '    .....    ',
      ],
      high: ['         11  ', '        111  '],
    },
    // The lagoon as a creek that winds from the north-west to the south-east, the dune in the south-west.
    {
      rows: [
        '   .T..J.T.  ',
        '  .........  ',
        ' T.llll...x. ',
        '..c...lll....',
        '....B...lll..',
        ' ....ST.ll.T ',
        '  .y....l..  ',
        '    .....    ',
      ],
      high: ['', '', '', '', '', '  11         ', '  111        '],
    },
  ],
  beds: 'l',
  loose: 'cxyTBS',
  finds: 'cxyS',
  look: {
    dry: [0xe3dccb, 0xdad3c1, 0xebe5d6], green: [0xf7e1a0, 0xf3d98f, 0xfbe8b0], tuft: 0x9ccf7e, tufts: 1, soil: 0xd9c08f, bed: 0xe0d4b4, wet: 0xcdbf9a, water: 0x7fdde0,
    reach: 2.6, flowers: 0.14, petals: [0xff9a85, 0xffc2d9, 0xffffff, 0xffb347], tree: 'palm', dress: 'pebble', litter: [0xffffff, 0xffc2d9],
  },

  lay(w, tile, c) {
    const s = w.isle[tile]
    const x = tx(tile)
    const z = tz(tile)
    const top = w.h[tile]
    if (c === 'c') {
      // Blow it, and the tide comes in. After that it calls the sea back whenever the plug has let it out: see `plug`,
      // which also gives the shell what a blow does from then on.
      const t: number = w.thing(tile, {
        auto: false,
        hits: 3,
        keep: true,
        sound: 'toot',
        marks: [], // the first note sets it humming: see onHit
        fuss: 'The sea heard you the first time. It is in. It cannot be more in.',
        tip: 'A big spiral shell. It wants blowing. It has a lot to say',
        clue: 'A [big spiral shell] lies on the beach. It looks like it wants blowing. They say you can hear the sea in one. This one talks back.',
        onHit: (left) => {
          note(0.1, 0.2)
          for (const cube of w.things[t].cubes) w.solid.paint(cube, 0xffd9c9, 1.35)
          if (left === 2) w.say('A low note comes out of the shell. Far off, the sea shifts, like somebody hearing their name across a room.', 'shell')
        },
        onBreak: () => {
          note(0, 0.25)
          w.say('The shell calls and the tide comes in. All that water, and all it wanted was to be asked. Far out east, the sea draws back from a smoking rock.', 'shell')
          w.things[t].tip = SHELL[1]
          w.memo.tide = 1
          const lagoon = w.tiles[s].filter((u) => w.mark[u] === 'l').sort((a, b) => tz(b) - tz(a))
          w.fill(lagoon[0]) // from the seaward end
          w.after(3, () => w.grow(w.memo.plug)) // and up bobs the plug
          w.soon('volcano', 5)
        },
      })
      w.put(t, 0.05, 0.18, 0.05, 0.5, 0.36, 0.42, 0xffe2d2)
      w.put(t, 0.12, 0.16, 0.27, 0.24, 0.2, 0.04, 0xff9ab0)
      w.put(t, -0.2, 0.34, -0.06, 0.32, 0.26, 0.32, 0xffd5c2)
      w.put(t, -0.3, 0.52, -0.1, 0.22, 0.18, 0.22, 0xffc9b4)
      w.put(t, -0.36, 0.65, -0.12, 0.12, 0.1, 0.12, 0xffb9a4)
    } else if (c === 'x') {
      // Only its eyes show.
      const crab = w.critters.spawn('crab', x, top - 0.04, z, 0xff7a5c)
      const t = w.thing(tile, {
        auto: false,
        hits: 3,
        sleeper: true,
        sound: 'tsk',
        tip: 'Two eyes, in a heap of sand. They have seen you',
        clue: '[Two eyes on stalks] are watching from a heap of sand. It thinks it is hidden. Let it have that for one more second. Then knock.',
        onBreak: () => {
          w.say('A crab! It scuttles off sideways, raking the sand awake as it goes. It will never get ahead in life, and it has made that work.', 'crab')
          crab.thing = undefined
          w.critters.go(crab, x, top, z, 0.3, 0.3, () => (crab.next = w.hop))
        },
      })
      w.put(t, 0, 0.11, 0, 0.72, 0.22, 0.62, 0xe6dfcf)
      w.things[t].marks = [[w.put(t, -0.1, 0.24, -0.12, 0.36, 0.08, 0.3, 0xded6c4)]] // the top of the heap slides off, and more of it shows
      crab.thing = t
      crab.hidden = true
      w.sleepers[s].push(crab)
    } else if (c === 'y') {
      // It only flowers after rain, and it never rains here. A knock, and it asks for some: the frog in the swamp calls
      // the rain, and once awake it hears, and sends its cloud. (A click on the frog itself still does the same, as it
      // does for a fire or for lava: but nobody has to think of that to finish.)
      const body: number[] = []
      let unheard = false // it has asked with nobody to hear, and that has been said
      const t: number = w.thing(tile, {
        auto: false,
        todo: true,
        sound: 'ahem',
        tip: 'A cactus, waiting for rain. Knock, and it asks for some. It hates asking',
        clue: 'The [cactus] on the beach is waiting for rain, and too proud to say so. Knock, and it asks. Whoever calls the rain has to be awake to hear it: try the swamp.',
        fuss: 'The cactus has asked six times now, which is six more than it ever meant to. It heard itself. So did everybody else.',
        tap: () => {
          const frog = w.critters.list.find((c) => c.kind === 'frog')
          const its = frog?.thing === undefined ? undefined : w.things[frog.thing]
          if (frog && its && !its.hits && w.open[w.isle[its.tile]]) return croak(w, frog, false, true)
          if (!unheard) w.say('The cactus asks for rain, out loud, which it has never done. Nobody answers. Whoever calls the rain round here is still asleep, in the swamp.', 'cactus')
          unheard = true
        },
        rain: () => {
          const cactus = w.things[t]
          if (!cactus.todo) return
          cactus.todo = false
          cactus.tap = cactus.fuss = undefined // it has what it asked for
          cactus.tip = 'The cactus, in flower. Worth the wait, it says. It would'
          w.memo.cactus = 1
          w.score(tile)
          // And it is no longer the only one: young ones come up beside it, on the nearest open sand, two if there is room.
          const sand = [...RING.map(([i, j]) => step(tile, i, j)), ...RING.map(([i, j]) => step(tile, i * 2, j * 2))].filter((u) => u >= 0 && w.isle[u] === s && w.free(u)).slice(0, 2)
          w.say(`Rain on the beach. The cactus has waited years for this, and bursts into flower. All at once, like somebody who held it together for far too long.${['', ' A small one comes up beside it.', ' Two small ones come up beside it.'][sand.length]}${sand.length ? ' It was not as alone as it looked.' : ''}`, 'cactus')
          for (const cube of body) w.solid.paint(cube, 0x7fca6c)
          w.grow(t)
          w.source(tile, 3.4, 0.4)
          sand.forEach((u, k) =>
            w.after(1.4 + k * 0.8, () => {
              if (!w.free(u)) return
              w.clear(u) // what grows there makes way
              const size = k ? 0.55 : 0.72
              const young = w.thing(u, { tip: 'A young cactus. It came up with the rain, as if it had only been waiting to be asked' })
              for (const [dx, dy, sx, sy] of SHAPE) w.put(young, dx * size, dy * size, 0, sx * size, sy * size, 0.24 * size, 0x7fca6c)
              if (!k) w.put(young, 0, 0.96 * size, 0, 0.2 * size, 0.12 * size, 0.2 * size, 0xff8fb0)
              thump()
            }),
          )
        },
      })
      for (const [dx, dy, sx, sy] of SHAPE) body.push(w.put(t, dx, dy, 0, sx, sy, 0.24, 0xa3b59f))
      for (const [dx, dy] of [[0, 0.96], [-0.34, 0.92], [0.34, 0.68]]) w.put(t, dx, dy, 0, 0.2, 0.12, 0.2, 0xff8fb0, true)
      // Fruit, but only once it has flowered and there are bees.
      w.things[t].extra = [[-0.34, 0.74], [0.34, 0.5], [0.08, 0.8]].map(([dx, dy]) => w.solid.add(x + dx, top + dy, z + 0.15, 0.11, 0.12, 0.12, 0xe8556b, t, false))
      // While it waits it says that it is thirsty, the only way a cactus can: every few seconds it hops, twice, and
      // thinks of a drop of water. The thought goes up over its head the way thoughts do in a comic: two small white
      // dots, and then the drop, bright enough to be seen against the lagoon and by night. It never lands.
      let next = 0
      w.ticks.push((_, time) => {
        if (!w.things[t].todo || !w.open[s] || time < next) return
        next = time + 5 + Math.random() * 3
        const hop = () => {
          if (w.things[t].todo) for (const cube of body) w.solid.poke(cube, 8)
        }
        hop()
        w.after(0.25, hop)
        w.bits.spawn(x + 0.1, top + 1.08, z, 0, 0.1, 0, 0.1, 0xffffff, 2, NEVER, 0, 0, 1.4)
        w.after(0.2, () => w.bits.spawn(x + 0.2, top + 1.26, z, 0, 0.1, 0, 0.14, 0xffffff, 1.8, NEVER, 0, 0, 1.4))
        w.after(0.45, () => w.bits.spawn(x + 0.3, top + 1.52, z, 0, 0.1, 0, 0.24, 0x3f9dff, 1.6, NEVER, 0, 0, 1.8))
      })
    } else if (c === 'J') {
      const t = w.thing(tile, { tip: 'Stepping stones. They go somewhere, which is the whole idea' })
      w.put(t, 0, -0.1, -0.78, 0.5, 0.2, 0.42, STONE[0])
      w.put(t, 0.12, -0.1, -1.3, 0.44, 0.2, 0.36, STONE[2])
      w.signpost(tile, 0, -1, [
        'THE BEACH. No running, no diving, no working out how many grains there are.',
        'The sea comes and goes. The sign stays. Neither is sure who got the better deal.',
        `Swim at your own risk. You are ${w.touch ? 'one finger' : 'a mouse pointer'}. The risk is low.`,
      ])
    } else if (c === 'S') {
      // A sandcastle somebody left behind. Three pats and it has its flag back.
      const flagged = w.extra('secret', { icon: 'castle', hint: 'Somebody left a castle on the beach without its flag. Three pats. Finish what a stranger started. It is how anything gets built.', at: () => w.above(tile, 1.1) })
      let pats = 0
      const t: number = w.thing(tile, {
        auto: false,
        sound: 'pat',
        tip: 'A sandcastle. Not finished, like everything good',
        wanting: () => !flagged.has(),
        tap: () => {
          if (++pats !== 3) return
          w.grow(t)
          w.things[t].tip = 'A sandcastle, flag and all. Finished, for now, like everything good'
          flagged('A secret: the sandcastle has its flag back. The tide will have it by Thursday. You gave it a flag anyway. That is the whole trick.')
        },
      })
      w.put(t, 0, 0.14, 0, 0.7, 0.28, 0.7, 0xf0dca0)
      for (const [dx, dz] of [[-0.24, -0.24], [0.24, -0.24], [-0.24, 0.24], [0.24, 0.24]]) w.put(t, dx, 0.36, dz, 0.2, 0.2, 0.2, 0xf6e6b4)
      w.put(t, 0, 0.42, 0, 0.3, 0.3, 0.3, 0xf0dca0)
      w.put(t, 0, 0.75, 0, 0.04, 0.4, 0.04, BARK, true)
      w.put(t, 0.1, 0.87, 0, 0.18, 0.12, 0.03, 0xff7a6b, true)
    } else if (c === 'B') {
      // An old rowing boat, pulled up on the sand: a hull that narrows to a bow, the dark inside of it, two seats across.
      const t = w.thing(tile, { tip: 'An old rowing boat. It has been to sea, and it did not care for it' })
      w.put(t, 0, 0.14, -0.1, 0.5, 0.28, 0.8, WOOD)
      w.put(t, 0, 0.14, 0.4, 0.3, 0.28, 0.2, WOOD)
      w.put(t, 0, 0.19, 0.56, 0.1, 0.38, 0.12, BARK)
      w.put(t, 0, 0.22, -0.1, 0.36, 0.16, 0.62, 0x5d4a40)
      w.put(t, 0, 0.31, -0.3, 0.5, 0.06, 0.12, 0xb89572)
      w.put(t, 0, 0.31, 0.06, 0.5, 0.06, 0.12, 0xb89572)
    }
  },

  done(w, s) {
    hammock(w, s)
    plug(w, s)
    // Bottle post. For as long as there is a secret nobody has found, a bottle washes up now and then with a riddle that points at one.
    // The riddle then stands next to that secret on the map.
    const bottle = w.critters.spawn('bottle', 0, -40, 0)
    Object.assign(bottle, { hidden: true, tilt: 1.2, tip: 'A bottle, washed up. There is a note in it. There always is' })
    let wait = 40
    bottle.onPat = () => {
      if (bottle.hidden) return
      const text = w.riddle()
      bottle.hidden = true
      wait = 45 + Math.random() * 35
      w.splash(bottle.x, bottle.y + 0.2, bottle.z, 4)
      w.say(text ? `The note in the bottle reads: “${text}”` : 'The note in the bottle is blank. There is nothing left to give away. Somebody sent it all the same. Some people just like to stay in touch.', 'bottle')
    }
    w.ticks.push((dt) => {
      if (!w.open[s] || w.replaying || !bottle.hidden || !w.riddles || (wait -= dt) > 0) return
      const sand = w.tiles[s].filter((u) => w.mark[u] === '.' && w.free(u))
      const tile = sand[Math.floor(Math.random() * sand.length)]
      const at = tile === undefined ? undefined : w.place(tile, 0.34)
      if (!at) return
      Object.assign(bottle, { x: tx(tile) + at[0], y: w.h[tile] + 0.1, z: tz(tile) + at[1], face: Math.random() * 6.3, hidden: false })
      // Nothing is said about it: it clinks, and it is there to be found.
      w.word('clink', bottle.x, bottle.y + 0.5, bottle.z)
    })
  },
}

/**
 * A scrap of sand out west that only low tide shows the way to: one palm, a chest somebody buried and never came back for,
 * and a lighthouse that keeps its lamp for the night.
 *   C  the chest     L  the lighthouse
 */
export const islet: Isle = {
  name: 'islet',
  at: [3, 28],
  rows: [' ... ', '.L...', '.TC..', ' ... '],
  // What any map of it has to keep to: bare sand at (4, 1), where the stones from the beach arrive.
  variants: [{ rows: [' .L. ', '.....', '..CT.', ' ... '] }, { rows: [' .T. ', '.C...', '...L.', ' ... '] }],
  beds: '',
  finds: 'C',
  look: beach.look,

  lay(w, tile, c) {
    if (c === 'L') {
      // By day a striped tower. At night its lamp is lit and turns, and where it faces a pool of light goes round.
      const t = w.thing(tile, {
        auto: false,
        sound: 'clink',
        fuss: 'It is a lighthouse. It does one thing. You have now been told six times.',
        tip: 'A lighthouse. It works nights',
        // A toy: it says its piece every time, and there is nothing in it to find, so it does not stir to be found.
        play: () => {
          lamp.pet = 1 // the lamp is not one of the tower's cubes: it gets its jolt by hand
          w.say(w.night ? 'The lamp goes round and round. Somewhere a ship that is not there is grateful. The lighthouse does it for the one that might be.' : 'A lighthouse. It keeps office hours: nights only. By day it is a tall building with a secret.')
        },
      })
      ;[0xfffbf2, 0xe9806f, 0xfffbf2, 0xe9806f].forEach((color, k) => w.put(t, 0, 0.25 + k * 0.5, 0, 0.7 - k * 0.08, 0.5, 0.7 - k * 0.08, color))
      w.put(t, 0, 0.2, 0.36, 0.2, 0.36, 0.03, 0x5b4636)
      w.put(t, 0, 2.04, 0, 0.66, 0.08, 0.66, 0x4a4458)
      const roof = w.put(t, 0, 2.49, 0, 0.5, 0.1, 0.5, 0xd96f60)
      w.put(t, 0, 2.61, 0, 0.2, 0.14, 0.2, 0xd96f60)
      // The lamp is the one part that turns, so it is not built of the tower's cubes: it is there when the roof over it is.
      const lamp = w.critters.spawn('beam', tx(tile), w.h[tile] + 2.26, tz(tile), 0xfff3a8)
      Object.assign(lamp, { hidden: true, thing: t })
      const throwLight = w.beacon(tx(tile), w.h[tile] + 2.3, tz(tile))
      w.onNight.push((night) => {
        w.critters.paint(lamp, [0], 0xfff3a8, night ? 4.5 : 1)
        w.critters.paint(lamp, [1], 0xffffff, night ? 8 : 1)
      })
      w.ticks.push((dt) => {
        lamp.hidden = !w.solid.up(roof)
        const lit = w.night && !lamp.hidden
        if (lit) lamp.yaw = lamp.face = lamp.yaw + dt * 0.8
        else lamp.face = Math.round(lamp.yaw / (Math.PI / 2)) * (Math.PI / 2) // by day it stands square to the tower, wherever it had got to
        throwLight(lit ? lamp.yaw : undefined)
      })
      return
    }
    if (c !== 'C') return
    const dug = w.extra('secret', { icon: 'chest', hint: 'The lagoon has a plug. Pull it, then follow the stones. Somebody laid them out sure that you would come.', at: () => w.above(tile, 0.9) })
    const t: number = w.thing(tile, {
      auto: false,
      sound: 'creak',
      tip: 'A chest, half buried. Somebody meant to come back',
      wanting: () => !dug.has(),
      tap: () => {
        const chest = w.things[t]
        chest.tap = undefined
        chest.tip = 'A chest, open. A spyglass and a map. Somebody did come back'
        // The lid goes up and back, and stands open; a few coins jump out and roll off.
        w.solid.size(lid, 0.66, 0.44, 0.1)
        w.solid.place(lid, tx(tile), w.h[tile] + 0.5, tz(tile) - 0.24)
        w.solid.poke(lid, 14)
        w.solid.show(gold)
        for (let k = 0; k < 6; k++) w.bits.spawn(tx(tile), w.h[tile] + 0.4, tz(tile), any() * 3, 4 + Math.random() * 2.5, 0.6 + Math.random() * 2, 0.11, 0xffd45c, 2.4, w.h[tile], 0.45, 22, 2.5)
        dug('A secret: the islet that only low tide shows the way to. In the chest: a spyglass, and a map of this very world. Somebody drew all of this before you got here. Try not to dwell on it.')
      },
    })
    w.put(t, 0, 0.14, 0, 0.62, 0.28, 0.44, 0xa98463)
    const lid = w.put(t, 0, 0.34, 0, 0.66, 0.14, 0.48, WOOD)
    w.put(t, 0, 0.26, 0.23, 0.1, 0.12, 0.04, 0xffd45c)
    w.put(t, -0.3, 0.05, 0.3, 0.3, 0.1, 0.26, 0xf3d98f) // sand drifted up against it
    const gold = w.scar(t, 0, 0.44, 0, 0.3, 0.08, 0.2, 0xffd45c)
    w.solid.paint(gold, 0xffd45c, 2)
  },
}
