import { note } from '../../../sound.ts'
import type { Critter } from '../critters.ts'
import { BARK, GROUND, NEAR, NEVER, STONE, WOOD, any, tx, tz, type Isle } from '../grid.ts'
import type { Island } from '../Island.ts'

function wakeTortoise(w: Island, tile: number, tortoise: Critter) {
  const { critters } = w
  const x = tx(tile)
  const z = tz(tile)
  w.say('The tortoise gets up, in its own time, and wanders off. And through comes the water. It was holding back a whole stream and will never know. Envy it a little.')
  tortoise.thing = undefined
  tortoise.pet = 1
  critters.go(tortoise, x + 1, GROUND, z, 2.4, 0.3, () =>
    critters.go(tortoise, x + 2, GROUND, z, 2.4, 0, () => {
      tortoise.next = w.stroll
      tortoise.rest = 5
    }),
  )
  w.after(1, () => (w.blocked[tile] = 0))
}

/**
 * The meadow, east of the island: dry straw, fruit trees, a stream that reaches less far than the island's.
 *   S  a spring     K  a tortoise asleep in the way of its water     q  the stream bed     R  burrow behind rubble
 *   N  a nest on a bare trunk     I  three sleeping stones     X  windmill, its sails tied down     H  bridge to the island
 */
export const meadow: Isle = {
  name: 'meadow',
  at: [27, 13],
  rows: [
    '   S.T  ',
    '  .S..X.',
    ' ..K..b.',
    ' ..q....',
    ' .qq.R.T',
    'H.q.....',
    ' .q.N...',
    ' .q...I.',
    ' .q.b.. ',
    ' .q..   ',
  ],
  // What any map of it has to keep to: the bridge at (0, 5); bare ground at (4, 0), where the bridge from the mountain
  // lands; the tortoise as the only way out of the spring, with two tiles of bare ground east of it to walk off over;
  // and the stream running on from it to a coast.
  variants: [
    // The spring in the north-east, the stream down the east side, the windmill in the west.
    {
      rows: [
        '   T.S  ',
        '  ...S..',
        ' .X..K..',
        ' ....q..',
        ' ..R.qq.',
        'H.....q.',
        ' .....qb',
        ' ...N.q.',
        ' TI...q ',
        ' ..b.   ',
      ],
    },
    // The spring in the south: the stream comes up the west side, crosses over, and leaves by the east coast.
    {
      rows: [
        '   ...  ',
        '  ..X.b.',
        ' .T.....',
        ' ....qqq',
        ' .qqqq..',
        'H.q....T',
        ' .q.I.R.',
        ' .K.....',
        ' .S..N. ',
        ' .S.b   ',
      ],
    },
  ],
  beds: 'SKq',
  loose: 'RNITb',
  finds: 'KRNIX',
  look: {
    dry: [0xd8cf9f, 0xcec592, 0xe1d8ab], green: [0xa6dd72, 0xb7e479, 0x98d56e], tuft: 0x86cf6a, tufts: 1, soil: 0xb8956a, bed: 0xd3c08f, wet: 0xb9a67e,
    reach: 2, flowers: 0.2, petals: [0xffffff, 0xffd45c, 0xff9a85, 0xf78bb5, 0x86b6f5], tree: 'fruit', dress: 'straw', litter: [0xcdbb80, 0xd9c98f],
  },

  lay(w, tile, c) {
    const { solid } = w
    const x = tx(tile)
    const z = tz(tile)
    const top = w.h[tile]
    if (c === 'S') w.filled[tile] = 1
    else if (c === 'K') {
      // Asleep in the bed of the stream, with all its water waiting behind it.
      const tortoise = w.critters.spawn('tortoise', x, top + 0.12, z)
      tortoise.thing = w.thing(tile, {
        auto: false,
        hits: 2,
        sleeper: true,
        sound: 'hm?',
        tip: 'A tortoise, asleep in the stream bed. It was here first',
        clue: 'A [tortoise] has gone to sleep right where the water wants to go. It is not blocking anything. It is resting, in a location. Knock.',
        onHit: () => w.say('The tortoise opens one eye. It is very comfortable where it is, and would like that taken into account.'),
        onBreak: () => wakeTortoise(w, tile, tortoise),
      })
      tortoise.grow = 1.25
      tortoise.face = 0.4
      tortoise.hidden = true
      w.sleepers[w.isle[tile]].push(tortoise)
      w.blocked[tile] = 1
    } else if (c === 'R') {
      // A hole in the ground with fresh dirt thrown up round it. Somebody is at home: knock, and out they come.
      const t: number = w.thing(tile, {
        auto: false,
        hits: 2,
        keep: true,
        sound: 'thump',
        tip: 'A hole in the ground, fresh dirt round it. Somebody is in',
        clue: 'There is a [hole] in the meadow, with fresh dirt thrown up round it. Somebody lives down there and is hoping you are not a fox. Knock nicely.',
        onHit: () => w.say('Two ears come up out of the hole. They are thinking it over. You are being assessed by ears.'),
        onBreak: () => {
          w.say('Bunnies! Wherever they hop, the ground remembers being green. They have no idea they do it. Most good gets done like that.', 'bunny')
          w.things[t].tip = 'A rabbit hole. Do not go down it. You have things to do'
          for (const ear of ears) w.solid.hide(ear)
          for (let k = 0; k < 3; k++)
            w.after(0.3 + k * 0.6, () => {
              // Up out of the hole in one jump, and off.
              const bunny = w.critters.spawn('bunny', x, top - 0.25, z, [0xffffff, 0xe9d3b4, 0xcbb7a6][k])
              w.critters.go(bunny, x + (k - 1) * 0.3, top, z + 0.34, 0.4, 0.8, () => (bunny.next = w.hop))
              note(0.7 + k * 0.1, 0.06)
            })
        },
      })
      w.put(t, 0, 0.02, 0, 0.5, 0.04, 0.5, 0x3a2f2a) // the dark of it
      // The dirt round it: two long heaps and two short ones between them, so that no two share a corner.
      for (const [dx, dz, high, color] of [[-0.36, 0, 0.16, 0xb8956a], [0.36, 0, 0.1, 0xa98463], [0, -0.36, 0.2, 0xa98463], [0, 0.36, 0.08, 0xb8956a]])
        w.put(t, dx, high / 2, dz, dx ? 0.22 : 0.5, high, dx ? 0.72 : 0.22, color)
      for (const [dx, dz, size] of [[0.46, 0.44, 0.12], [-0.44, -0.46, 0.1], [0.4, -0.44, 0.08]]) w.put(t, dx, size / 2, dz, size, size, size, 0xc4a377)
      // The first knock brings two ears up.
      const ears = [-0.07, 0.07].map((dx) => w.scar(t, dx, 0.16, 0, 0.07, 0.3, 0.07, 0xffffff))
      w.things[t].marks = [ears]
    } else if (c === 'N') {
      // A nest at the top of a tall bare trunk, with one pale blue egg in it.
      const hatched = w.extra('secret', { icon: 'nest', hint: 'In the meadow stands a tree with no leaves and one blue thing in it. Knock twice. Once is a mistake. Twice is a visit.', at: () => w.above(tile, 2.7) })
      let taps = 0
      const t: number = w.thing(tile, {
        auto: false,
        tip: 'A nest, with one blue egg in it. Somebody is expecting',
        tap: () => {
          if (++taps < 2) return w.say('Tap. Something taps back from inside the egg. You are in a conversation now. Finish it.')
          const nest = w.things[t]
          nest.tap = undefined
          nest.tip = 'An empty nest. It is being very grown-up about it'
          w.rubble(egg, tile, 5)
          w.solid.hide(egg)
          const chick = w.critters.spawn('bird', x, top + 2.3, z, 0x9fd6ff)
          chick.friend = 'nestling'
          chick.grow = 0.65
          chick.tip = 'A bluebird, just hatched. Already has places to be'
          chick.next = w.flit
          hatched('A secret: the egg at the top of the bare trunk. A bluebird, and already in a hurry. One minute old and behind on everything. Welcome.')
        },
      })
      w.put(t, 0, 1, 0, 0.3, 2, 0.3, WOOD)
      w.put(t, 0.24, 1.3, 0, 0.4, 0.12, 0.12, BARK)
      // The rim: two long sides, and two short ones that fit between them, so that no two pieces share a corner.
      for (const [dx, dz] of NEAR) w.put(t, dx * 0.3, 2.1, dz * 0.3, dx ? 0.2 : 0.4, 0.2, dx ? 0.8 : 0.2, dx ? 0xb89572 : BARK)
      w.put(t, 0, 2.04, 0, 0.4, 0.08, 0.4, 0xc9b27a)
      const egg = w.put(t, 0, 2.3, 0, 0.32, 0.4, 0.32, 0xbfe0f5)
    } else if (c === 'I') {
      // Three old stones, fast asleep. Each knock wakes one of them.
      const faces: number[][] = []
      const light = (k: number) => {
        const [block, ...eyes] = faces[k]
        solid.paint(block, 0xffe7a3, 1.5)
        solid.poke(block, 6)
        eyes.forEach((eye, n) => (n < 2 ? solid.hide(eye) : solid.show(eye, 0.1)))
        note(0.3 + k * 0.25, 0.1)
      }
      const t = w.thing(tile, {
        auto: false,
        hits: 3,
        keep: true,
        sound: 'ooh',
        marks: [], // each knock wakes a stone: that is mark enough
        tip: 'Three stones, fast asleep. Stacked, so somebody cared',
        clue: '[Three stacked stones] in the meadow are fast asleep. Stones do not usually need waking. These ones do. Knock.',
        onHit: (left) => {
          light(2 - left)
          w.say(left === 2 ? 'One stone opens its eyes. It had eyes. It is as surprised as you are.' : 'Two awake. One more. The last one is pretending. You know the type.')
        },
        onBreak: () => {
          light(2)
          w.say('The old stones are wide awake. Far to the north, something cold answers. They are not sure what they have started. Nobody ever is.')
          w.things[t].tip = 'Three stones, wide awake. No plans, and all day for them'
          w.after(1.3, () => w.raise('snow'))
        },
      })
      for (let k = 0; k < 3; k++) {
        const wide = 0.74 - k * 0.08
        const y = 0.28 + k * 0.56
        const front = wide / 2 + 0.01
        faces.push([
          w.put(t, 0, y, 0, wide, 0.56, wide, STONE[k]),
          w.put(t, 0.15, y + 0.06, front, 0.14, 0.04, 0.03, 0x6d6878),
          w.put(t, -0.15, y + 0.06, front, 0.14, 0.04, 0.03, 0x6d6878),
          w.put(t, 0.15, y + 0.07, front, 0.1, 0.12, 0.03, 0x4a4458, true),
          w.put(t, -0.15, y + 0.07, front, 0.1, 0.12, 0.03, 0x4a4458, true),
        ])
        w.put(t, 0, y - 0.13, front, 0.12, 0.04, 0.03, 0x6d6878)
      }
    } else if (c === 'X') {
      // A windmill. Ivy has tied its sails down, and there is a whole season of seed heads waiting for a wind.
      const mill: number = w.thing(tile, { tip: 'A windmill. Ivy has its sails', play: () => w.things[t].play?.() })
      w.memo.mill = tile
      w.put(mill, 0, 0.6, 0, 0.9, 1.2, 0.9, 0xf3ead8)
      w.put(mill, 0, 1.7, 0, 0.74, 1.0, 0.74, 0xfbf4e6)
      w.put(mill, 0, 2.3, 0, 0.92, 0.2, 0.92, 0xe9806f)
      w.put(mill, 0, 2.52, 0, 0.6, 0.24, 0.6, 0xe9806f)
      w.put(mill, 0, 2.72, 0, 0.3, 0.16, 0.3, 0xd96f60)
      w.put(mill, 0, 0.35, 0.46, 0.3, 0.6, 0.04, BARK)
      const sails = w.critters.spawn('sails', x, top + 1.95, z + 0.52)
      sails.roll = 0.5
      sails.hidden = true
      w.sleepers[w.isle[tile]].push(sails)
      let turning = 0 // how fast the sails go round
      let freed = Infinity
      let on = true // once it is free, a click stops it and the wind with it, and another sets both going again
      const t: number = w.thing(tile, {
        auto: false,
        hits: 3,
        sound: 'rip',
        play: () => {
          on = !on
          w.memo.wind = on ? 1 : 0
          w.things[t].tip = w.things[mill].tip = on ? 'The windmill. A click stops it, and the wind with it' : 'The windmill, stopped. A click sets it going again, and the wind with it'
        },
        tip: 'Ivy, holding the sails of the windmill down. It means well',
        clue: 'Ivy has tied down the sails of the [windmill]. Slowly, over years, the way most things get stuck. Tear it off.',
        onBreak: () => {
          const [sx, sz] = w.middle('swamp')
          freed = w.time
          w.memo.wind = 1
          sails.thing = undefined
          sails.onPat = () => void w.strike(t) // a click on the sails is a click on the mill
          Object.assign(w.things[t], { tip: 'The windmill. A click stops it, and the wind with it', sound: 'creak' })
          Object.assign(w.things[mill], { tip: w.things[t].tip, sound: 'creak' })
          w.say('The sails turn! The wind takes the seeds out west, and where they land, something dark and damp comes up. Not everything you plant is a meadow. It is still yours.', 'windmill')
          // Each seed is thrown so that it comes down where the swamp will be.
          for (let k = 0; k < 44; k++) w.after(0.8 + k * 0.05, () => w.bits.spawn(x + any(), top + 2.4 + any(), z + any(), (sx - x) / 3.4 + any(), 1.2, (sz - z) / 3.4 + any(), 0.1, 0xfffbe8, 3.5, NEVER, 0, 0.7))
          // The camera goes west with them, once it has seen the sails start to turn.
          w.after(1.4, () => {
            const from = w.time
            w.trail(() => {
              const t = Math.min(1, (w.time - from) / 3.4)
              return [x + (sx - x) * t, z + (sz - z) * t]
            }, 3.5)
          })
          w.after(5, () => w.raise('swamp'))
        },
      })
      const ivy = Array.from({ length: 10 }, (_, k) => w.put(t, Math.cos(k * 2.4) * 0.52, 1.1 + k * 0.17, 0.56 + Math.sin(k * 2.4) * 0.1, 0.3, 0.2, 0.14, k % 2 ? 0x5f9a5a : 0x6fae62))
      w.things[t].marks = [ivy.slice(7), ivy.slice(4, 7)] // torn off from the top down
      sails.thing = t
      w.things[mill].guard = t // a knock on the mill is a knock on the ivy, for as long as there is ivy
      w.ticks.push((dt, time) => {
        turning += ((time > freed && on ? 2.2 : 0) - turning) * Math.min(1, dt * 0.8)
        sails.roll += turning * dt
        // For a while after they come free, the wind shows.
        if (time > freed && time < freed + 7 && Math.random() < dt * 9) w.bits.spawn(x + any() * 3, top + 0.8 + Math.random() * 2.6, z + any() * 3, -8, 0, any(), 0.06, 0xffffff, 0.7, NEVER, 0, 0)
      })
    } else if (c === 'H') {
      w.planks(w.thing(tile), -1, 0)
      w.signpost(tile, -1, 0, [
        'THE ISLAND: THAT WAY. THE MEADOW: YOU ARE STANDING IN IT. The sign feels this covers everything.',
        'A bridge is two places agreeing to stop pretending the other one is not there.',
        'You are reading a sign in a small game. Somebody wrote it hoping you would. Hello.',
      ])
    }
  },
}
