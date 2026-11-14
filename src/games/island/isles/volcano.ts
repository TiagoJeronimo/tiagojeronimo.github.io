import { thump } from '../../../sound.ts'
import { LAVA, NEVER, STONE, any, tx, tz, type Isle } from '../grid.ts'
import type { Island } from '../Island.ts'

/**
 * The egg in the ash opens at a knock, once the lava has warmed it (never by itself). It opens, it is not smashed: the
 * top comes off in a few small pieces, the bottom half stays where it stood, empty, and out comes a little dragon, which
 * then warms whatever on its isle is still cold.
 */
function hatch(w: Island, egg: number) {
  const thing = w.things[egg]
  const { tile } = thing
  const s = w.isle[tile]
  const [shell, ...warm] = thing.cubes
  for (const cube of warm) w.solid.hide(cube)
  for (let k = 0; k < 5; k++) w.bits.spawn(tx(tile) + any() * 0.3, w.h[tile] + 0.45, tz(tile) + any() * 0.3, any() * 3, 3 + Math.random() * 1.5, any() * 3, 0.12, 0x3a3340, 1.4, w.h[tile], 0.3)
  w.solid.size(shell, 0.36, 0.2, 0.36)
  w.solid.place(shell, tx(tile), w.h[tile] + 0.14, tz(tile))
  thing.cubes = [shell]
  w.put(egg, 0, 0.25, 0, 0.26, 0.02, 0.26, 0xfff1d6) // the inside of it, pale
  thing.tap = undefined // it is not cold any more, and has nothing left to ask for
  thing.tip = 'Half an eggshell. Somebody has moved out, and up'
  w.breath()
  w.say('The egg was only waiting for some warmth, and then for somebody to knock. A dragon! A very small one. It would like to be feared, and it is the size of a bread roll.', 'dragon')
  w.critters.spawn('dragon', tx(tile), w.h[tile] + 0.26, tz(tile), 0x7fd6a8).next = (dragon) => {
    const cold = w.tiles[s].filter((u) => !w.alive[u] && w.wakeAt[u] === Infinity)
    if (!cold.length) return w.flit(dragon)
    const u = cold[Math.floor(Math.random() * cold.length)]
    dragon.rest = 1.2
    w.critters.go(dragon, tx(u), w.h[u] + 1.1, tz(u), 1.2, 0.6, () => {
      for (let k = 0; k < 6; k++) w.bits.spawn(dragon.x, dragon.y, dragon.z, any() * 2, -2, any() * 2, 0.12, 0xffb347, 0.6, w.h[u], 0, 4, 2)
      w.source(u, 1.6)
    })
  }
}

/**
 * The volcano, south east: black ash, a plugged crater, and a bed the lava once ran down.
 *   V  the crater, with a boulder stuck in it     v  the lava bed     E  an egg in the ash
 */
export const volcano: Isle = {
  name: 'volcano',
  at: [26, 24],
  rows: [
    '   ...   ',
    '  .o...  ',
    ' ...V... ',
    ' ...v.E. ',
    '...vv....',
    'vvvv..T..',
    '....T....',
    ' ...b... ',
    '  .....  ',
    '   ...   ',
  ],
  high: [
    '   122   ',
    '  12332  ',
    ' 1234321 ',
    ' 1233321 ',
    '012222110',
    '011110000',
  ],
  // What any map of it has to keep to: lava that only ever runs level or down, from the crater to the west coast, which is
  // where the new land sets (rows 4 to 6 reach that coast).
  variants: [
    // The crater in the middle of the isle, the lava going west and leaving a row higher up.
    {
      rows: [
        '   ...   ',
        '  ....o  ',
        ' ......T ',
        ' ....... ',
        'vvvv.....',
        '...vvV...',
        '..E......',
        ' ....... ',
        '  ...bT  ',
        '   ...   ',
      ],
      high: [
        '',
        '',
        '   11111 ',
        ' 0122222 ',
        '001233321',
        '001234321',
        '001233321',
        ' 0122222 ',
        '  11111  ',
      ],
    },
    // The crater in the north-east: a long river of lava down the south side and all the way west.
    {
      rows: [
        '   ...   ',
        '  .....  ',
        ' .o...V. ',
        ' .....v. ',
        '...E..v..',
        '.....vv..',
        'vvvvvv...',
        ' ......T ',
        '  T.b..  ',
        '   ...   ',
      ],
      high: [
        '   122   ',
        '  01233  ',
        ' 0012343 ',
        ' 0012333 ',
        '000122222',
        '000111111',
      ],
    },
  ],
  beds: 'Vv',
  lava: 'Vv',
  loose: 'ETbo',
  finds: 'VE',
  look: {
    dry: [0x7f7982, 0x757079, 0x89838b], green: [0x7fbf6b, 0x8cc978, 0x72b35f], tuft: 0x62a85a, tufts: 2, soil: 0x5c5762, bed: 0x6a646e, wet: 0x4a4550,
    reach: 2.4, flowers: 0.16, petals: [0xff9a3c, 0xffd45c, 0xff6a5c], tree: 'oak', dress: 'pebble', litter: [0x4f4a55, 0x625c68],
  },

  lay(w, tile, c) {
    const { bits } = w
    const s = w.isle[tile]
    const x = tx(tile)
    const z = tz(tile)
    const top = w.h[tile]
    if (c === 'V') {
      let since = -1 // when it blew
      const t = w.thing(tile, {
        auto: false,
        hits: 3,
        sound: 'grrr',
        tip: 'A boulder, stuck in the top of the volcano. A lid on a feeling',
        clue: 'The black mountain is smoking round a [boulder] stuck in its top. It is fine. It says it is fine. Knock.',
        onHit: () => w.say('The boulder shifts. Underneath, something growls. That is the sound of a mountain being asked how it really is.'),
        // Rain on running lava: the whole mountain hisses, and for a while the lava sets like black glass.
        rain: () => {
          if (since < 0 || w.memo.glass) return
          w.memo.glass = 1
          w.memo.set = 1 // for as long as it is glass, nothing runs, falls or flies: see the tick below, and the falls in `Island.ts`
          const lava = w.tiles[s].filter((u) => w.filled[u])
          for (const u of lava) {
            for (let k = 0; k < 5; k++) bits.spawn(tx(u) + any(), w.h[u] + 0.5, tz(u) + any(), any(), 1 + Math.random() * 2, any(), 0.24, 0xffffff, 2.4, NEVER, 0, -0.8)
            w.solid.paint(w.pool[u], 0x3a3340)
          }
          w.after(14, () => {
            w.memo.set = 0
            lava.forEach((u) => w.solid.paint(w.pool[u], LAVA, 2.2))
          })
        },
        onBreak: () => {
          w.say('The volcano clears its throat. Lava! It has been meaning to say this for a thousand years. Where it meets the sea it sets: new land, still warm.', 'volcano')
          w.things[t].spent = false // the boulder is gone, but what a line about this place names is the volcano, and that is there to see
          for (let k = 0; k < 6; k++) w.after(k * 0.25, thump)
          w.blocked[tile] = 0
          w.fill(tile)
          w.source(tile, 5, 1.5) // ash, and nothing grows like ash
          w.memo.lava = 1
          w.rumble(1)
          since = w.time
        },
      })
      w.put(t, 0, 0.6, 0, 0.95, 1.2, 0.95, 0x55505c)
      // Every knock opens a crack with the glow of what is underneath in it.
      const seam = (dx: number, dy: number, high: number) => {
        const cube = w.scar(t, dx, dy, 0.49, 0.08, high, 0.03, LAVA)
        w.solid.paint(cube, LAVA, 2.2)
        return cube
      }
      w.things[t].marks = [[seam(0.18, 0.7, 0.5), seam(0.26, 0.4, 0.22)], [seam(-0.2, 0.5, 0.6), seam(-0.28, 0.9, 0.2)]]
      w.put(t, 0.2, 1.3, 0.1, 0.5, 0.3, 0.5, 0x625c68)
      w.put(t, -0.3, 0.3, 0.42, 0.4, 0.5, 0.3, 0x4a4550)
      w.blocked[tile] = 1
      // It smokes while it is plugged, throws lava about for a few seconds when it blows, and spits now and then after.
      w.ticks.push((dt, time) => {
        if (!w.open[s]) return
        if (since < 0) {
          if (Math.random() < dt * 4) bits.spawn(x + any() * 0.7, top + 1.5, z + any() * 0.7, 0, 1, 0, 0.2, 0x8f8a96, 2.2, NEVER, 0, -0.6)
        } else if (!w.memo.set && (time - since < 5 || Math.random() < dt * 0.6)) for (let k = 0; k < 2; k++) bits.spawn(x + any() * 0.4, top + 0.6, z + any() * 0.4, any() * 5, 8 + Math.random() * 6, any() * 5, 0.18, LAVA, 2, top - 3, 0, 22, 2)
      })
      // Where the lava runs off the west edge, it meets the sea and sets: new land.
      w.onFill.push((mouth) => {
        if (w.isle[mouth] !== s || tx(mouth) !== Math.min(...w.tiles[s].map(tx))) return
        w.after(1.2, () => {
          const fresh = w.tiles[w.index('newland')]
          for (let k = 0; k < 30; k++) bits.spawn(tx(mouth) - 1 + any(), 1, tz(mouth) + any() * 2, any(), 2 + Math.random() * 3, any(), 0.24, 0xffffff, 2, NEVER, 0, -1)
          w.raise('newland', tx(mouth) - 1, tz(mouth))
          for (const u of fresh) w.wakeAt[u] = w.time + 3 + Math.hypot(tx(u) - tx(mouth), tz(u) - tz(mouth)) * 0.5
        })
      })
    } else if (c === 'E') {
      const egg = w.thing(tile, { auto: false, sound: 'tik', tip: 'An egg, stone cold. It has not given up', tap: () => w.say('The egg is cold. It would like some warmth. You cannot hold it. You are a cursor. Find another way.') })
      w.put(egg, 0, 0.26, 0, 0.36, 0.44, 0.36, 0x3a3340)
      w.put(egg, 0, 0.3, 0, 0.38, 0.1, 0.38, 0xff9a5c)
      w.put(egg, 0.1, 0.44, 0.1, 0.1, 0.06, 0.1, 0xffc24a)
      const ring = w.thing(tile, { tip: 'Four stones round an egg. Somebody put them there, and left' })
      for (const [dx, dz] of [[-0.34, 0.1], [0.34, -0.06], [0.06, 0.36], [-0.1, -0.36]]) w.put(ring, dx, 0.08, dz, 0.2, 0.16, 0.2, STONE[1])
      // Warm enough once the lava has come a couple of tiles down the mountain. It does not open by itself: the band
      // round it glows, and it rocks now and then, with something tapping from inside, until somebody knocks on it.
      let lava = 0
      let rock = -1 // seconds until it next rocks, once it is warm: below zero while it is cold, and once it is open
      w.onFill.push((filled) => {
        if (w.isle[filled] !== s || ++lava !== 3) return
        const warm = w.things[egg]
        rock = 1.5
        w.solid.paint(warm.cubes[1], 0xffb347, 2.4)
        Object.assign(warm, {
          sound: 'crack',
          tip: 'An egg, warm at last. Something inside is tapping back',
          tap: () => {
            rock = -1
            hatch(w, egg)
            w.things[ring].tip = 'Four stones, round half an eggshell. They are taking it well'
          },
        })
      })
      w.ticks.push((dt) => {
        if (rock < 0 || (rock -= dt) > 0) return
        rock = 2.4 + Math.random() * 1.2
        for (const wait of [0, 0.22]) w.after(wait, () => rock >= 0 && w.things[egg].cubes.forEach((cube) => w.solid.poke(cube, 7)))
      })
    }
  },
}

/** What the lava makes when it reaches the sea: a strip of fresh black rock between the volcano and the beach. It greens by itself. */
export const newland: Isle = {
  name: 'newland',
  at: [24, 27],
  rows: [' .', '..', '..', '..', '..', '. '],
  beds: '',
  look: {
    dry: [0x524d58, 0x4a4550, 0x5a5560], green: [0x86c873, 0x93d27f, 0x78bc66], tuft: 0x62a85a, tufts: 3, soil: 0x413c47, bed: 0x524d58, wet: 0x524d58,
    reach: 2, flowers: 0.3, petals: [0xff9a3c, 0xffd45c, 0xff6a5c, 0xffffff], tree: 'oak',
  },
  lay() {},
}
