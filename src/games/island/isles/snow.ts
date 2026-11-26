import { thump } from '../../../sound.ts'
import type { Critter } from '../critters.ts'
import { BARK, GROUND, NEVER, RING, STONE, WATER, WOOD, any, step, tx, tz, type Isle } from '../grid.ts'
import type { Island } from '../Island.ts'

/** What the penguin does with itself: paddles about and, once there is a slide, goes down it every so often. */
const play = (w: Island) => (penguin: Critter) => (w.memo.slide && Math.random() < 0.3 ? slideDown(w, penguin) : w.paddle(penguin))

/** Up onto the top of the slide in one hop, down it on its belly, and into the pond. */
function slideDown(w: Island, penguin: Critter) {
  const tile = w.memo.slideTile
  const pond = step(tile, -1, 0)
  const z = tz(tile)
  w.critters.go(penguin, tx(tile) + 0.3, w.h[tile] + 0.95, z, 1.1, 0.7, () => {
    penguin.tilt = 1.35
    w.critters.go(penguin, tx(pond), w.h[pond] + 0.5, z, 0.7, 0, () => {
      penguin.tilt = 0
      if (w.filled[pond]) w.splash(penguin.x, penguin.y, penguin.z, 6)
      w.critters.go(penguin, tx(pond), w.h[pond] + 0.18, z, 0.25, 0.2)
      penguin.rest = 2.5
    })
  })
}

function freePenguin(w: Island, penguin: Critter) {
  const { critters } = w
  w.say('Free! It belly-slides straight across the pond. Crack, crack, crack. Years in the ice, and the first thing it does is throw itself at more ice.', 'penguin')
  penguin.thing = undefined
  penguin.next = undefined
  // The pond, nearest tile first.
  const far = (u: number) => Math.hypot(tx(u) - penguin.x, tz(u) - penguin.z)
  const pond = w.tiles[w.index('snow')].filter((u) => w.mark[u] === 'i').sort((a, b) => far(a) - far(b))
  const last = pond[pond.length - 1]
  critters.go(penguin, penguin.x, GROUND, penguin.z, 0.45, 0.5, () => {
    penguin.tilt = 1.35
    critters.go(penguin, tx(last), w.h[last] + 0.6, tz(last), 1.7, 0, () => {
      penguin.tilt = 0
      critters.go(penguin, penguin.x, w.h[last] + 0.18, penguin.z, 0.3, 0.25, () => {
        w.splash(penguin.x, penguin.y + 0.3, penguin.z, 6)
        penguin.next = play(w)
        penguin.rest = 1.5
      })
    })
    pond.forEach((u, k) =>
      w.after(0.2 + k * 0.2, () => {
        thump()
        w.uncover(u, true)
      }),
    )
  })
}

/**
 * The snow, north of the island. Water alone does little here: it takes warmth.
 *   i  frozen pond     P  penguin in a block of ice     F  fire pit under snow     Y  plugged geyser
 *   y  its stream bed     h  the hot pool it fills     J  ice bridge to the island
 *   M  a heap of snow that could be somebody     L  where the penguin's slide will stand
 */
export const snow: Isle = {
  name: 'snow',
  at: [10, 0],
  rows: [
    '   ..T...   ',
    '  .T..Yyy.  ',
    ' ..ii...hhT.',
    ' .iiiP..hh..',
    'T.iiLM...y..',
    ' .....F..y. ',
    '  .T....yy. ',
    '    .J..y.  ',
  ],
  // What any map of it has to keep to: the ice bridge at (5, 7); a tile of frozen pond right to the west of the slide, which
  // goes down that way; the geyser's water running through the hot pool and on to a coast; and the frozen pond apart from
  // all of that, or its meltwater would run the geyser's stream for it.
  variants: [
    // The pond in the east, with the slide on its far bank; the geyser in the north, its pool in the west.
    {
      rows: [
        '   ....T.   ',
        '  .yyY....  ',
        ' T.y....ii..',
        ' .hh..PiiiL.',
        'T.hh....iiM.',
        ' .y...F.... ',
        '  y.....T.T ',
        '    .J....  ',
      ],
    },
    // The pond in the north-west; the geyser in the south, its water running up to a pool in the east and out by the east coast.
    {
      rows: [
        '   .....T   ',
        '  ..ii....  ',
        ' T.iiiL.....',
        ' ..ii.M.hhyy',
        'T....P..hh..',
        ' ...F...y.T ',
        '  T....Yy.. ',
        '    .J....  ',
      ],
    },
  ],
  beds: 'iYyh',
  loose: 'PFTo',
  finds: 'PFY',
  look: {
    dry: [0xf6f9fd, 0xe9f0f8, 0xffffff], green: [0x8bcf93, 0x9ad79c, 0x7fc78c], tuft: 0x74bf88, tufts: 3, soil: 0xa9a3b3, bed: 0xdde7f2, wet: 0xb3c2d6,
    reach: 1.8, flowers: 0.06, petals: [0xffffff, 0xcfe4ff, 0xe3d4ff], tree: 'pine', dress: 'snow', litter: [0xffffff, 0xe8f0f9],
  },

  lay(w, tile, c) {
    const { solid, bits } = w
    const x = tx(tile)
    const z = tz(tile)
    const top = w.h[tile]
    if (c === 'i') w.cover(tile)
    else if (c === 'J') {
      w.put(w.thing(tile), 0, -0.08, 1, 0.8, 0.2, 1.1, 0xd7efff)
      w.signpost(tile, 0, 1, [
        'THE SNOW. Mind the ice: it is only water that gave up on moving.',
        'It is quiet up here. The sign used to think that was peace. Now it suspects it is just the cold.',
        `If you can read this, you are ${w.touch ? 'a finger' : 'a cursor'}. No judgement. The penguin cannot read at all.`,
      ])
    } else if (c === 'P') {
      // Frozen in up to the neck.
      const penguin = w.critters.spawn('penguin', x, top + 0.25, z)
      const t = w.thing(tile, { auto: false, hits: 3, sound: 'crick', tip: 'A block of ice, with somebody in it. They can see you', clue: 'Somebody up north is stuck in a [block of ice], up to the neck. It has had a lot of time to think, and no way to stop.', onBreak: () => freePenguin(w, penguin) })
      w.put(t, 0, 0.3, 0, 0.8, 0.6, 0.8, 0xcdeaff)
      w.put(t, 0.12, 0.2, 0.12, 0.7, 0.4, 0.7, 0xe3f4ff)
      penguin.thing = t
      penguin.hidden = true
      penguin.next = (p) => {
        p.face = any() * 1.6
        p.rest = 0.8 + Math.random() * 2
      }
      w.sleepers[w.isle[tile]].push(penguin)
    } else if (c === 'F') {
      // A fire pit, snowed under.
      let lit = false
      const light = (on: boolean) => {
        lit = on
        w.memo.fire = on ? 1 : 0
        w.things[pit].tip = on ? 'A fire. It asks for nothing, and gets visitors' : 'A fire pit, rained out. A knock will light it again'
        flames.forEach((flame, k) => (on ? solid.show(flame, k * 0.1) : solid.hide(flame)))
        gather()
      }
      // A fire at night: the birds fly in from everywhere, and they sleep in a ring round it. So does the penguin,
      // unless there is hot water to sit in. Only those going about their own business come: one in the middle of
      // something of its own (the penguin on its way across the ice, the caged bird on its way out to sea) is left to finish it.
      const gather = () => {
        if (!lit || !w.night) return
        // A ring round it, and a wider one for latecomers, wherever there is ground: whoever finds no room stays put.
        const near = w.around(x, z, 1.25, top)
        const places = [...near, ...w.around(x, z, 2, top, 16)]
        const guests = w.critters.list.filter((c) => !c.hidden && c.thing === undefined && c.next && (c.kind === 'bird' || (c.kind === 'penguin' && !w.memo.spring))).slice(0, places.length)
        guests.forEach((c, k) => {
          // Spread out, while the near ring has room for all of them.
          const [gx, gy, gz, a] = places[guests.length <= near.length ? Math.floor((k * near.length) / guests.length) : k]
          const far = Math.hypot(gx - c.x, gz - c.z)
          const flies = c.kind === 'bird'
          w.critters.go(c, gx, gy, gz, flies ? 0.6 + far / 6 : 0.4 + far * 0.45, flies ? 0.5 + far * 0.1 : 0, () => (c.face = a + Math.PI))
        })
      }
      w.onNight.push(gather)
      const pit = w.thing(tile, {
        auto: false,
        // Rain puts it out in a cloud of steam; a knock lights it again.
        rain: () => {
          if (!lit) return
          light(false)
          w.memo.steam = 1
          for (let k = 0; k < 30; k++) bits.spawn(x + any() * 0.8, top + 0.4, z + any() * 0.8, any() * 1.5, 1 + Math.random() * 2, any() * 1.5, 0.24, 0xffffff, 2.2, NEVER, 0, -0.8)
        },
        tap: () => {
          if (lit || !w.memo.steam) return
          light(true)
          w.say('The fire is lit again. You put it out, and you lit it. That is called having an effect.', 'fire')
        },
      })
      for (const [dx, dz] of RING) w.put(pit, dx * 0.34, 0.1, dz * 0.34, 0.24, 0.2, 0.24, STONE[(dx + 2 * dz + 3) % 3])
      w.put(pit, 0, 0.12, 0, 0.56, 0.12, 0.14, WOOD)
      w.put(pit, 0, 0.2, 0, 0.14, 0.12, 0.56, 0x8a6d58)
      // The fire: four small flames one on another, each narrower and paler than the one under it, and a tip that sways.
      const FLAME = [0xff6a3c, 0xff9a3c, 0xffd45c, 0xfff2b0]
      const flames = [
        w.put(pit, 0, 0.36, 0, 0.4, 0.24, 0.4, FLAME[0], true),
        w.put(pit, 0, 0.56, 0, 0.3, 0.24, 0.3, FLAME[1], true),
        w.put(pit, 0, 0.75, 0, 0.2, 0.22, 0.2, FLAME[2], true),
        w.put(pit, 0, 0.91, 0, 0.1, 0.16, 0.1, FLAME[3], true),
      ]
      const t = w.thing(tile, {
        auto: false,
        hits: 3,
        sound: 'pff',
        tip: 'A heap of snow, on a ring of stones. Stones do not arrange themselves',
        clue: 'One [heap of snow] up north has a ring of stones under it. Somebody was warm here once. There may be some left.',
        onBreak: () => {
          w.say('A fire pit, still warm under the snow. The snow backs away from it. It stayed warm under there the whole time, for nobody. Some things do.', 'fire')
          flames.forEach((flame, k) => solid.paint(flame, FLAME[k], 2.4))
          light(true)
          w.source(tile, 4.2, 0.6)
        },
      })
      // The heap is narrower than the ring, so that the stones show all the way round it.
      w.put(t, 0, 0.3, 0, 0.66, 0.6, 0.66, 0xffffff)
      w.things[t].marks = [[w.put(t, 0, 0.68, 0, 0.4, 0.2, 0.4, 0xf1f6fc)]] // the top of the heap slides off first
      w.put(t, 0.12, 0.14, 0.5, 0.14, 0.12, 0.16, WOOD) // the end of a log gives it away
      w.ticks.push((dt, time) => {
        if (!lit) return
        // The two at the top lean this way and that; every so often one of the four jumps, and a spark goes up.
        solid.place(flames[2], x + Math.sin(time * 5.3) * 0.02, top + 0.75, z + Math.cos(time * 4.1) * 0.02)
        solid.place(flames[3], x + Math.sin(time * 5.3 + 0.6) * 0.05, top + 0.91 + Math.sin(time * 9) * 0.015, z + Math.cos(time * 4.1 + 0.6) * 0.05)
        if (Math.random() > dt * 9) return
        solid.poke(flames[Math.floor(Math.random() * 4)], 2.5)
        bits.spawn(x + any() * 0.3, top + 0.8, z + any() * 0.3, any() * 0.5, 1.2, any() * 0.5, Math.random() < 0.3 ? 0.08 : 0.05, Math.random() < 0.5 ? 0xffb347 : 0xffe08a, 1.1, NEVER, 0, -1.2, 2.4)
      })
    } else if (c === 'L') {
      // Where the slide will stand, once there is a snowman: three steps of packed snow down to the pond, iced on top.
      const t = (w.memo.slideThing = w.thing(tile, { tip: 'A slide of packed snow. It seats one penguin' }))
      w.memo.slideTile = tile
      for (let k = 0; k < 3; k++) {
        w.scar(t, 0.3 - k * 0.3, 0.45 - k * 0.15, 0, 0.3, 0.9 - k * 0.3, 0.62, [0xf4f8fd, 0xe6eef8, 0xd9e6f4][k])
        w.scar(t, 0.3 - k * 0.3, 0.925 - k * 0.3, 0, 0.3, 0.05, 0.42, 0xbfe6ff)
      }
    } else if (c === 'M') {
      // A heap of snow that could be somebody. Three pats make a snowman of it; and while the snow is out, the penguin gets a slide.
      const built = w.extra('secret', { icon: 'snowman', hint: 'One heap of snow up north could be somebody. Three pats. A heap and some attention: it is how anybody starts.', at: () => w.above(tile, 0.9) })
      let pats = 0
      const t: number = w.thing(tile, {
        auto: false,
        sound: 'pat',
        tip: 'A heap of snow. It could be somebody, with some help',
        wanting: () => !built.has(),
        tap: () => {
          if (pats > 2) return w.say('The snowman has nothing to add. It is finished. Leave it. Not everything wants improving.', 'snowman')
          parts[pats].forEach((cube, k) => solid.show(cube, k * 0.07))
          if (!pats) solid.hide(heap)
          if (++pats < 3) return w.say(pats === 1 ? 'A ball of snow. Go on. It is not somebody yet.' : 'Two balls of snow. It wants a head. So do a lot of projects.', 'snowman')
          w.things[t].tip = 'A snowman. He knows about spring, and is not bringing it up'
          // And the slide, next door.
          const slide = w.things[w.memo.slideThing]
          slide.cubes.forEach((cube, k) => solid.show(cube, 0.5 + k * 0.1))
          slide.tip = 'A slide, for the penguin. Made of leftovers, like most joy'
          w.memo.slide = 1
          built('A secret: a snowman. And while the snow was out, a slide for the penguin. You made a person out of weather. He seems all right about it.')
        },
      })
      const heap = w.put(t, 0, 0.14, 0, 0.7, 0.28, 0.7, 0xffffff)
      const parts = [
        [w.scar(t, 0, 0.27, 0, 0.62, 0.54, 0.62, 0xffffff)],
        [w.scar(t, 0, 0.72, 0, 0.46, 0.4, 0.46, 0xf4f8fd)],
        [
          w.scar(t, 0, 1.06, 0, 0.32, 0.3, 0.32, 0xffffff),
          w.scar(t, 0, 0.9, 0, 0.38, 0.07, 0.38, 0xe9605a),
          w.scar(t, 0, 1.06, 0.22, 0.06, 0.06, 0.14, 0xffa23f),
          ...[-0.07, 0.07].map((dx) => w.scar(t, dx, 1.12, 0.165, 0.05, 0.05, 0.02, 0x3a3340)),
          ...[0.64, 0.78].map((dy) => w.scar(t, 0, dy, 0.235, 0.05, 0.05, 0.02, 0x3a3340)),
          ...[-0.38, 0.38].map((dx) => w.scar(t, dx, 0.76, 0, 0.32, 0.05, 0.05, BARK)),
        ],
      ]
    } else if (c === 'Y') {
      // A stone on a hot spring. It rattles.
      let since = -1
      const t = w.thing(tile, {
        auto: false,
        hits: 3,
        sound: 'hsss',
        tip: 'A rattling stone. Steam leaks out round it. It would rather not talk about it',
        clue: 'One [stone] up north keeps rattling, and steam leaks out around it. Whatever is under there has stopped being polite about it.',
        onBreak: () => {
          w.say('A geyser! It was under the snow the whole time, boiling quietly, like a few people you know. It lets go, and out east, a mountain happens.', 'geyser')
          w.things[t].spent = false // the stone is gone, but what a line about this place names is the geyser, and that is there to see
          w.blocked[tile] = 0
          w.fill(tile)
          w.source(tile, 3.2, 0.8)
          since = w.time
          w.soon('mountain', 3.5)
        },
      })
      w.stones(t, 1.3, tile)
      w.blocked[tile] = 1
      // It leaks steam while it is plugged, and spouts every few seconds once it is free.
      w.ticks.push((dt, time) => {
        if (!w.exists[tile]) return
        if (Math.random() < dt * 3) bits.spawn(x + any() * 0.9, top + 1, z + any() * 0.9, 0, 0.8, 0, 0.16, 0xffffff, 1.3, NEVER, 0, -0.8)
        if (since < 0) {
          if (Math.random() < dt * 0.7) for (const cube of w.things[t].cubes) solid.poke(cube, 2.5)
        } else if ((time - since) % 7 < 2.4) for (let k = 0; k < 2; k++) bits.spawn(x + any() * 0.3, top + 0.5, z + any() * 0.3, any() * 2.4, 9 + Math.random() * 4, any() * 2.4, 0.15, WATER, 1.6, top + 0.3, 0)
      })
    }
  },

  done(w, s) {
    // The hot spring: once the geyser is free its water gathers in a pool that steams. At night whoever is about on the snow
    // comes to it: the penguin sits in it, and if no fire is burning the birds sleep along its bank.
    const pool = w.tiles[s].filter((u) => w.mark[u] === 'h')
    const [px, pz] = [pool.reduce((n, u) => n + tx(u), 0) / pool.length, pool.reduce((n, u) => n + tz(u), 0) / pool.length]
    w.onFill.push((tile) => {
      if (pool.includes(tile) && pool.every((u) => w.filled[u])) w.memo.spring = 1
    })
    w.ticks.push((dt) => {
      if (!w.open[s]) return
      for (const u of pool) if (w.filled[u] && Math.random() < dt * 1.3) w.bits.spawn(tx(u) + any() * 0.8, w.h[u] + 0.5, tz(u) + any() * 0.8, 0, 0.45, 0, 0.14, 0xffffff, 1.7, NEVER, 0, -0.5)
    })
    w.onNight.push((night) => {
      if (!night || !w.memo.spring) return
      const about = w.critters.list.filter((c) => !c.hidden && c.thing === undefined && c.next) // as round the fire: nobody is called away from something it is in the middle of
      const penguin = about.find((c) => c.kind === 'penguin')
      if (penguin) w.critters.go(penguin, tx(pool[0]) + 0.1, w.h[pool[0]] + 0.18, tz(pool[0]), 0.6 + Math.hypot(tx(pool[0]) - penguin.x, tz(pool[0]) - penguin.z) * 0.4, 0.4)
      if (w.memo.fire) return
      // Along the bank: on the ground round the water, wherever there is some, and not in it.
      const bank = [...w.around(px, pz, 1.5, w.h[pool[0]] + 0.6), ...w.around(px, pz, 2.2, w.h[pool[0]] + 0.6, 16)]
      const birds = about.filter((c) => c.kind === 'bird').slice(0, bank.length)
      birds.forEach((bird, k) => {
        const [bx, by, bz, a] = bank[k]
        const far = Math.hypot(bx - bird.x, bz - bird.z)
        w.critters.go(bird, bx, by, bz, 0.6 + far / 6, 0.5 + far * 0.1, () => (bird.face = a + Math.PI))
      })
    })
    // It snows for as long as any of it is still frozen.
    w.ticks.push((dt) => {
      if (!w.open[s] || w.awake[s] === w.tiles[s].length || Math.random() > dt * 14) return
      const [x, z] = w.middle('snow')
      w.bits.spawn(x + any() * 12, GROUND + 5.5, z + any() * 8, 0.3, -1.1, 0.15, 0.08, 0xffffff, 4.5, GROUND, 0, 0.2)
    })
  },
}
