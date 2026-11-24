import { thump } from '../../../sound.ts'
import type { Critter } from '../critters.ts'
import { BARK, GROUND, NEAR, RING, STONE, W, WOOD, any, deal, step, tx, tz, type Isle } from '../grid.ts'
import type { Island } from '../Island.ts'

const DEEP = 4.3 // how far the old tree's roots and the well reach

function freeRiver(w: Island, tile: number) {
  w.blocked[tile] = 0
  w.memo.river = 1
  w.rumble(0.4)
  // One line for it, whatever it sets off at once: a well that stood open and dry fills with the same breath.
  const well = w.memo.well
  w.say(well ? 'The spring is free. Watch where the water goes. It has planned this route for years, and it has not forgotten the well.' : 'The spring is free. Watch where the water goes. It has been planning this route for years.')
  for (const t of w.tiles[w.isle[tile]]) if (w.mark[t] === 'S') w.source(t, 3, 0.4)
  if (well) openWell(w, well, true)
}

/** @param quiet said already, by whatever brought the water */
function openWell(w: Island, tile: number, quiet = false) {
  w.memo.well = 0
  w.memo.wellFull = 1
  if (!quiet) w.say('Water rises in the well. The ground around it stirs, like somebody remembering they left something on.')
  w.things[w.standing[tile][0]].tip = 'The well. It takes a wish, and gives back a splash'
  w.grow(w.standing[tile][0])
  w.source(tile, DEEP, 0.8)
}

/** The river tile beside a tile of the isle's map, if there is one: where the old tree's thorns reach out. */
function riverBeside(w: Island, tile: number) {
  const rows = deal(island, w.seed)
  const n = tile - (island.at[0] + island.at[1] * W)
  const [i, j] = [n % W, Math.floor(n / W)]
  for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (rows[j + dj]?.[i + di] === 'r') return tile + di + dj * W
}

function freeBird(w: Island, bird: Critter) {
  const { critters } = w
  const [x, z] = w.middle('meadow') // out at sea, where the meadow is waiting
  // (One line for the whole of it: the seed it drops, and the meadow that comes of it, are a few seconds off.)
  w.say('Free! It heads out over the water and drops a seed into the sea. And the sea, which never answers anybody, answers. It did not say thank you. This is better.', 'bird')
  bird.thing = undefined
  bird.next = undefined
  // Up out of the cage and off in one flight, straight to the place.
  const flight = 0.8 + Math.hypot(x - bird.x, z - bird.z) / 5 // unhurried enough to be watched all the way
  w.watch(bird, flight + 0.6)
  critters.go(bird, x, GROUND + 3, z, flight, 1.2, () => {
    w.bits.spawn(x, GROUND + 2.9, z, 0, 0, 0, 0.2, BARK, 2, 0.2, 0)
    w.after(0.5, () => w.raise('meadow'))
    bird.next = w.flit
    bird.rest = 2
  })
}

/** The beaver wakes, takes its dam apart log by log, and moves into the river. */
function wakeBeaver(w: Island, beaver: Critter) {
  const dam = w.memo.dam
  const at = w.things[dam].tile
  const logs = [...w.things[dam].cubes]
  // (One line for the whole of it: the dam is gone, and the water off down the channel if there is any, in a few seconds.)
  w.say(`The beaver wakes, looks at its dam, and takes it apart. No notes, no meeting. It simply changed its mind. ${w.memo.river ? 'Off goes the water, down the side channel.' : 'The channel is open now. All it needs is a river.'}`)
  beaver.thing = undefined
  beaver.pet = 1
  beaver.roll = 0 // on its feet
  w.after(0.9, () => w.critters.go(beaver, tx(at), GROUND, tz(at) + 0.62, 0.9))
  logs.forEach((log, k) =>
    w.after(2 + k * 0.5, () => {
      w.rubble(log, at, 4)
      w.solid.hide(log)
      thump()
      beaver.pet = 0.6
    }),
  )
  w.after(2 + logs.length * 0.5, () => {
    w.things[dam].cubes = []
    w.things[dam].spent = true
    w.blocked[at] = 0
    w.mark[at] = 'r' // one more stretch of river now
    w.critters.go(beaver, tx(at), w.h[at], tz(at), 0.5, 0.3, () => {
      beaver.next = w.paddle
      beaver.rest = 1
    })
  })
}

/**
 * A swing on the old tree, once it is in blossom: from a branch of its own, low down, on whichever side has open ground
 * under it (the south by preference, where it shows best). A click gives it a push. The squirrel, once somebody has
 * knocked it out of the tree, takes a turn on it now and then.
 */
function swing(w: Island, s: number) {
  const tree = w.things.find((thing) => thing.key === 'tree:old')
  const side = tree && [[0, 1], [-1, 0], [1, 0], [0, -1]].find(([di, dj]) => {
    const u = step(tree.tile, di, dj)
    return u >= 0 && w.isle[u] === s && w.mark[u] === '.' && w.h[u] === w.h[tree.tile]
  })
  if (!tree || !side) return
  const [di, dj] = side
  const { tile } = tree
  const [x, top, z] = [tx(tile), w.h[tile], tz(tile)]
  let push = 0.2 // how far it swings: 1 right after a push, and never quite still
  let rider: Critter | undefined
  let on = false
  let until = 0
  const t = w.thing(tile, {
    auto: false,
    tip: 'A swing. Nobody put it up, and here it is',
    fuss: 'It is a swing. It has been pushed. It would like a moment.',
    sound: 'creak',
    play: () => {
      push = 1
      if (on && rider) w.word('wheee', rider.x, rider.y + 0.6, rider.z)
    },
  })
  // Measured out along the branch: how far from the trunk, how high, how long that way, how tall, how wide across.
  const box = (along: number, y: number, long: number, high: number, wide: number, color: number) => w.put(t, di * along, y, dj * along, di ? long : wide, high, di ? wide : long, color, true)
  box(0.95, 1.56, 1.3, 0.16, 0.16, BARK)
  const hanging = [box(0.95, 1.065, 0.04, 0.83, 0.04, 0xd9c98f), box(1.45, 1.065, 0.04, 0.83, 0.04, 0xd9c98f), box(1.2, 0.62, 0.7, 0.06, 0.24, 0xc9a06b)]
  for (const cube of w.things[t].grown) w.solid.bendy(cube, tree.give ?? 0, top, x, z) // it goes with the tree in the wind
  const wake = tree.wake
  tree.wake = () => {
    wake?.()
    w.grow(t)
  }
  w.ticks.push((dt, time) => {
    if (!w.things[t].up) return
    push = Math.max(0.2, push * Math.exp(-dt / 6))
    // It swings across the branch: whatever hangs leans about the height it hangs from.
    const lean = Math.tan(0.5 * push * Math.sin(time * 2.4))
    for (const cube of hanging) w.solid.lean(cube, -dj * lean, di * lean, top + 1.48)
    const squirrel = rider ?? w.critters.list.find((c) => c.friend === 'squirrel')
    if (!squirrel) return
    const seat = [x + di * 1.2 + dj * lean * 0.86, top + 0.65, z + dj * 1.2 - di * lean * 0.86]
    if (on) {
      Object.assign(squirrel, { x: seat[0], y: seat[1], z: seat[2], face: Math.atan2(-dj, di) })
      if (squirrel.nap < 0.5) push = Math.max(push, 0.55) // it keeps itself going
      if (time < until) return
      // Enough: off, onto the grass beside it, and back to pottering about.
      const u = step(tile, di, dj)
      on = false
      w.critters.go(squirrel, tx(u) - dj * 0.3, w.h[u], tz(u) + di * 0.3, 0.4, 0.4, () => {
        squirrel.next = w.stroll
        rider = undefined
      })
    } else if (!rider && squirrel.next && w.critters.lively(squirrel) && Math.random() < dt * 0.06) {
      rider = squirrel
      squirrel.next = undefined
      w.critters.go(squirrel, seat[0], seat[1], seat[2], 0.5, 0.6, () => {
        on = true
        until = w.time + 9 + Math.random() * 8
      })
    }
  })
}

/**
 * Where the game starts: a dry island with a plugged spring.
 *   S  the spring     r  river bed     p  pond bed     B  boulder on the spring
 *   D  beaver dam across the side channel     V  the beaver, asleep on its side
 *   h  hill pond under a cloud     e  its stream bed     O  old tree in thorns
 *   W  capped well     C  crate     G  bird cage     M  seed pod     4  a clover with one leaf too many
 */
export const island: Isle = {
  name: 'island',
  at: [10, 9],
  rows: [
    '     ..SS...    ',
    '   .T..SS.....  ',
    '  ..b...B...... ',
    ' .C.....r...h...',
    ' ..rrrrDr...e...',
    '.pppp.V.r...e...',
    '.pppp...rr.Te...',
    'b.pp.To..r..eee ',
    '....T....r....T.',
    '........rr..b.G.',
    '......T.rO...4..',
    '...o..M.r.......',
    ' ..W....rr..... ',
    '  .......r..b.  ',
    '   ...T..r...   ',
    '     ....r.     ',
  ],
  high: [
    '          11    ',
    '          1121  ',
    '          12211 ',
    '          11111 ',
    '          11111 ',
    '          1111  ',
  ],
  // The same island drawn a second time: the hill in the middle of the north shore, its stream running out to the west coast,
  // the spring in the north-east corner, the river down the east side, and the pond in the south-west.
  // What any map of it has to keep to. No tree within two tiles of the old one, which is a good deal bigger and would
  // grow into it. The coastline of the first: bridges from the snow, the garden, the swamp, the meadow
  // and the beach land on (5, 0), (1, 3), (0, 9), (15, 9) and (8, 15), which stay bare ground. The river's last tile on the
  // southernmost row: water there is what raises the beach. The hill's stream apart from the river, or the rain would fill
  // the river round the boulder. And the dam in a stretch that runs east to west, with ground south of it for the beaver.
  variants: [
    {
      rows: [
        '     .......    ',
        '   .T.......SS  ',
        '  ..........SS. ',
        ' .C.b...h....B4.',
        ' .......e..o.r..',
        'eeee..eee.T..r.T',
        '...eeee.....rrb.',
        '.T.......rrDr.. ',
        '....b..rrrV.r...',
        '...ppppr....rO..',
        '..opppp.T..rr...',
        'T...pp..M..r....',
        ' .W.......rr.G. ',
        '  ....T..rr...  ',
        '   ....b.rT..   ',
        '     ....r.     ',
      ],
      high: [
        '       1111     ',
        '      11211     ',
        '      12211     ',
        '      11111     ',
        '       111      ',
      ],
    },
    // And a third time: the hill left of the middle with a short stream to the west coast, the spring on the north shore,
    // the river slanting down to the south-west, and the pond in the east.
    {
      rows: [
        '     ....SS.    ',
        '   ....T.SS...  ',
        '  ........B..T. ',
        ' .......b.r.....',
        ' .C..h....r.o.G.',
        '.....e...rr..4..',
        'eeeeee...r.....T',
        '........rrDrr.. ',
        '.T.M..o.rO.Vppb.',
        '.......rr..ppp..',
        '......Tr...ppp..',
        '...W..rr....pp..',
        ' .....r..T....T ',
        '  b...r.......  ',
        '   .T.r....b.   ',
        '     .r....     ',
      ],
      high: [
        '                ',
        '                ',
        '    111         ',
        '   1221         ',
        '   1211         ',
        '    111         ',
      ],
    },
  ],
  beds: 'SBrDphe',
  loose: 'CGMTbo',
  finds: 'BVhOWCGM4',
  look: {
    dry: [0xdbc9a3, 0xd2bf97, 0xe2d2ad], green: [0x8fd16b, 0x9fd872, 0xb4de6e], tuft: 0x7fca6c, tufts: 3, soil: 0xba936d, bed: 0xd3bd92, wet: 0xb9a67e,
    reach: 3, flowers: 0.12, petals: [0xfffaf0, 0xffd45c, 0xffc2d9, 0xc4a4f0, 0xff9a85], tree: 'oak',
  },

  lay(w, tile, c) {
    const { solid } = w
    const x = tx(tile)
    const z = tz(tile)
    const top = w.h[tile]
    if (c === 'S') w.filled[tile] = 1
    else if (c === 'B') {
      // The boulder that plugs the spring.
      const t = w.thing(tile, { hits: 3, start: true, sound: 'tock', tip: 'A boulder. In the way, which is all a boulder ever wanted', clue: 'That [boulder] sits right where the water comes up. It is not being difficult. It is being a boulder. Knock anyway.', onBreak: () => freeRiver(w, tile) })
      const rocks = w.stones(t, 1.7, tile)
      // A crack down its front: it will not take many knocks. Each one opens it further, and the second knocks its top off.
      w.put(t, -0.03, 0.47, 0.73, 0.08, 0.26, 0.04, 0x7d7888)
      w.put(t, 0.05, 0.25, 0.73, 0.08, 0.22, 0.04, 0x7d7888)
      const crack = (dx: number, dy: number, high: number) => w.scar(t, dx, dy, 0.735, 0.08, high, 0.04, 0x6d6878)
      w.things[t].marks = [[crack(0.18, 0.4, 0.32), crack(0.26, 0.2, 0.16)], [crack(-0.22, 0.34, 0.4), crack(-0.27, 0.12, 0.12), rocks[3]]]
      w.blocked[tile] = 1
    } else if (c === 'D') {
      // The beaver's dam across the side channel. Only the beaver takes it down.
      const t = (w.memo.dam = w.thing(tile, { tip: 'A dam. The beaver built it, and only the beaver takes it down' }))
      for (let k = 0; k < 3; k++) w.put(t, (k - 1) * 0.3, 0.2 + (k === 1 ? 0.3 : 0), 0, 0.3, 0.3, 1.25, k === 1 ? 0xa98463 : WOOD)
      for (let k = 0; k < 3; k++) w.put(t, (k - 1) * 0.34, 0.62, any() * 0.5, 0.12, 0.12, 0.7, BARK)
      w.blocked[tile] = 1
    } else if (c === 'V') {
      // Fast asleep on its side, in plain sight. It takes two knocks: the first only gets a mutter out of it.
      const beaver = w.critters.spawn('beaver', x, top + 0.16, z, 0x8a5a3c)
      beaver.thing = w.thing(tile, { auto: false, hits: 2, sleeper: true, sound: 'mmf', onHit: () => w.say('The beaver stirs, mutters something about a deadline, and sleeps on. Knock again.'), tip: 'A beaver, fast asleep. On the job, technically', clue: 'A [beaver] is fast asleep right next to its dam, like somebody who finished one project and never started the next.', onBreak: () => wakeBeaver(w, beaver) })
      beaver.grow = 1.25
      beaver.roll = 1.3
      beaver.face = 0.5
    } else if (c === 'h') {
      // A sulking cloud that will not let go of its rain.
      const t: number = w.thing(tile, {
        auto: false,
        hits: 1,
        keep: true,
        sound: 'plip',
        tip: 'A grey cloud, heavy with rain. It is holding on',
        clue: 'That [grey cloud] over the hill looks heavy. It has been holding it in for a long time. Give it a reason.',
        onBreak: () => {
          w.say('Rain! The hill drinks first, then the pond spills over. The cloud feels much better, and a little embarrassed.')
          const cloud = w.things[t].cubes
          for (const cube of cloud) solid.paint(cube, 0xeeeaf2)
          w.showers.push([x, z, w.time + 4.5])
          w.source(tile, 3, 0.8)
          // When it has rained itself out, the pond is full and the cloud thins away.
          w.after(4.5, () => {
            w.fill(tile)
            cloud.forEach((cube, k) => solid.hide(cube, 0.6 + k * 0.25))
          })
        },
      })
      for (const [dx, dy, dz, size] of [[0, 0, 0, 1.5], [1, -0.1, 0.2, 1.1], [-1, -0.15, -0.1, 1.0], [0.3, 0.6, -0.2, 0.9], [-0.4, 0.1, 0.7, 0.8]])
        w.put(t, dx, 4.6 + dy, dz, size, size * 0.7, size, 0x9c98a8)
    } else if (c === 'O') {
      const old = w.tree(tile, 'old')
      // Once it is in blossom, a knock on the trunk brings out who lives there.
      const lodger = w.extra('secret', { icon: 'marmot/c7653a', hint: 'The old tree, once it is in blossom, has a lodger. Knock. It is polite, and it works.', at: () => w.above(tile, 3.2) })
      w.things[old].tap = () => {
        if (!w.things[old].up || w.memo.squirrel) return
        w.memo.squirrel = 1
        const squirrel = w.critters.spawn('marmot', x + 0.6, top, z + 0.5, 0xc7653a)
        squirrel.friend = 'squirrel'
        squirrel.grow = 0.7
        squirrel.next = w.stroll
        lodger('A secret: a squirrel lives in the old tree. It was only waiting for somebody to knock. For years. It could have just come out. So could we all.')
      }
      // Thorns wound round its trunk.
      const t = w.thing(tile, {
        auto: false,
        hits: 3,
        tip: 'Thorns, round the old tree and across the river. They think of it as a hug',
        clue: '[Thorns] are choking the big old tree, and have crept out over the river as well. The thorns would call it support. Cut them off.',
        onBreak: () => {
          if (river !== undefined) w.blocked[river] = 0
          w.say(river !== undefined && w.memo.river ? 'The old tree can breathe, and the water is through the gap before the thorns have landed. Its roots wake the ground around it. It is very old, and somebody has only now asked how it was.' : 'The old tree can breathe. Its roots wake the ground around it. It is very old, and somebody has only now asked how it was.', 'old tree')
          w.things[old].tip = 'The old tree. Very old, and only now getting on with it'
          w.grow(old)
          w.source(tile, DEEP, 0.6)
        },
      })
      // Round the trunk: small purple knots, with a pink berry on every fourth.
      const thorns = Array.from({ length: 12 }, (_, k) => w.put(t, Math.cos(k * 1.9) * 0.5, 0.25 + k * 0.2, Math.sin(k * 1.9) * 0.5, k % 4 === 3 ? 0.16 : 0.28, k % 4 === 3 ? 0.16 : 0.2, k % 4 === 3 ? 0.16 : 0.28, k % 4 === 3 ? 0xf07fae : k % 2 ? 0x7a5c7a : 0x6a4f6d))
      // The tree stands beside the river, and its thorns have crept out from the foot of it and across the water: thin
      // canes of bramble, lying from one bank to the other at different heights and places, some not quite reaching,
      // with a few spikes and berries. Nothing gets past until they are cut, from the top down.
      const river = riverBeside(w, tile)
      const upper: number[] = []
      const lower: number[] = []
      if (river !== undefined) {
        const [dx, dz] = [tx(river) - x, tz(river) - z]
        // Each cane: where across the bed and how high. All run the whole width, from bank to bank, so every one rests on
        // the ground at both ends, and none rises above the banks.
        const canes = [[-0.3, -0.5], [0.25, -0.34], [-0.2, -0.18], [0.15, -0.04]]
        canes.forEach(([side, y], n) => {
          const px = dx * 1 + side * dz * dz
          const pz = dz * 1 + side * dx * dx
          const [sx, sz] = [Math.abs(dx) + 0.11 * (1 - Math.abs(dx)), Math.abs(dz) + 0.11 * (1 - Math.abs(dz))]
          const cane = w.put(t, px, y, pz, sx, 0.11, sz, n % 2 ? 0x7a5c7a : 0x6a4f6d)
          const spike = n % 2 === 0 ? w.put(t, px, y + 0.08, pz, 0.05, 0.05, 0.05, 0xd9c4e0) : -1
          const berry = n > 1 ? w.put(t, px + dx * 0.15, y + 0.105, pz + dz * 0.15, 0.1, 0.1, 0.1, 0xf07fae) : -1
          const layer = y >= -0.1 ? upper : y >= -0.35 ? lower : undefined
          layer?.push(...[cane, spike, berry].filter((cube) => cube >= 0))
        })
        w.blocked[river] = 1
      }
      Object.assign(w.things[t], { sound: 'snip', marks: [[...thorns.slice(8), ...upper], [...thorns.slice(4, 8), ...lower]] }) // stripped from the top down
      w.things[old].guard = t
    } else if (c === 'W') {
      // With water in it, it is a wishing well.
      const wished = w.extra('secret', { icon: 'well', hint: 'A well with water in it will take a wish. It does not grant them. It takes them. Read the wording.', at: () => w.above(tile, 1) })
      const well = w.thing(tile, {
        tap: () => {
          if (!w.memo.wellFull) return
          // A coin goes in, from the side the player is on, and then the splash: every time, not only the first.
          w.bits.spawn(x + Math.sin(w.turn) * 1.1, top + 1.7, z + Math.cos(w.turn) * 1.1, -Math.sin(w.turn) * 2.2, 1.6, -Math.cos(w.turn) * 2.2, 0.1, 0xffd45c, 0.5, top + 0.5, 0, 22, 2.5)
          w.after(0.5, () => w.splash(x, top + 0.6, z, 6))
          wished('A secret: you toss a wish into the well. It lands with a very small splash. That is what a wish sounds like at actual size.')
        },
      })
      // Two long walls, and two short ones that fit between them: no two pieces share a corner.
      for (const [dx, dz] of [[-0.35, 0], [0.35, 0], [0, -0.35], [0, 0.35]]) w.put(well, dx, 0.3, dz, dx ? 0.25 : 0.45, 0.6, dx ? 0.95 : 0.25, STONE[(dx + dz > 0 ? 1 : 0) + 1])
      w.put(well, 0, 0.42, 0, 0.5, 0.25, 0.5, 0x86cdf5, true)
      // The stone lid.
      const t = w.thing(tile, {
        auto: false,
        hits: 2,
        sound: 'clonk',
        tip: 'A well, with a stone lid on it. Somebody was done with wishes',
        clue: 'Somebody put a [stone lid] on the well. Nobody puts a lid on a thing they never hoped into. Knock it off.',
        onBreak: () => {
          if (w.memo.river) return openWell(w, tile)
          w.memo.well = tile
          w.say('The well is open, but bone dry. You wanted a moment and got a hole. Maybe once the river runs again.')
          w.things[well].tip = 'The well, open and bone dry. A hole with prospects'
        },
      })
      w.put(t, 0, 0.7, 0, 1.05, 0.22, 1.05, STONE[0])
      w.put(t, 0, 0.86, 0, 0.3, 0.12, 0.3, STONE[1])
    } else if (c === 'C') {
      // An old crate. Something is humming inside.
      const t = w.thing(tile, {
        auto: false,
        hits: 2,
        sound: 'bzzz',
        tip: 'A crate. It hums, and not from joy',
        clue: 'Something is humming inside that [crate]. Several thousand somethings, with one opinion.',
        onBreak: () => {
          // (One line for the whole of it: the garden comes up three seconds on, while this is still being read.)
          w.say('Bees! They leave flowers where the ground is alive. Some fly off to a kitchen garden they remember, and it comes back with them. For a bee it is just Tuesday.', 'bees')
          w.grow(t)
          w.releaseBees(x, top + 1, z)
          w.after(3, () => w.raise('garden'))
        },
      })
      w.put(t, 0, 0.4, 0, 0.8, 0.8, 0.8, 0xc9a06b)
      w.put(t, 0, 0.4, 0, 0.84, 0.14, 0.84, 0xa98463)
      // The first knock takes the rim of the lid off, and one of its planks: there is a dark gap to look into.
      w.things[t].marks = [[w.put(t, 0, 0.83, 0, 0.84, 0.06, 0.84, 0xa98463), w.scar(t, 0.14, 0.8, 0, 0.24, 0.03, 0.8, 0x4a3b3b), w.scar(t, 0.14, 0.62, 0.4, 0.24, 0.36, 0.03, 0x4a3b3b)]]
      // The hive that was in it: yellow, with two dark bands round it and a dark way in, like the bees it is full of.
      // (Bands and way in stand a little proud of it: flush with it, they would flicker.)
      w.put(t, 0, 0.3, 0, 0.5, 0.6, 0.5, 0xffd45c, true)
      w.put(t, 0, 0.65, 0, 0.34, 0.2, 0.34, 0xf0b63c, true)
      for (const dy of [0.24, 0.44]) w.put(t, 0, dy, 0, 0.52, 0.07, 0.52, 0x3a3340, true)
      w.put(t, 0, 0.09, 0.25, 0.14, 0.1, 0.03, 0x3a3340, true)
    } else if (c === 'G') {
      // A bird in a cage. It knows where the next piece of land is.
      const bird = w.critters.spawn('bird', x, top + 0.1, z, 0x7cc4f5)
      const t = w.thing(tile, { auto: false, hits: 2, sound: 'clang', tip: 'A cage. Somebody thought this was a good idea', clue: 'Something flutters behind [bars]. It has stopped asking. That is not the same as not minding.', onBreak: () => freeBird(w, bird) })
      w.put(t, 0, 0.05, 0, 0.8, 0.1, 0.8, BARK)
      const bars = RING.map(([dx, dz]) => w.put(t, dx * 0.36, 0.45, dz * 0.36, 0.06, 0.7, 0.06, 0x6b5a5a))
      w.things[t].marks = [[bars[2], bars[4]]] // two bars at the front go first
      w.put(t, 0, 0.84, 0, 0.8, 0.08, 0.8, BARK)
      w.put(t, 0, 0.94, 0, 0.16, 0.12, 0.16, 0x6b5a5a)
      bird.thing = t
      bird.next = (b) => {
        b.face = Math.random() * 6.3
        w.critters.go(b, x, top + 0.1, z, 0.25, 0.12)
        b.rest = 0.6 + Math.random() * 1.8
      }
    } else if (c === 'M') {
      // A fat seed pod, ready to go.
      const t = w.thing(tile, {
        auto: false,
        hits: 2,
        sound: 'pop',
        tip: 'A seed pod, fit to burst. It needs one bad day',
        clue: 'That [fat brown pod] looks ready to burst. It is waiting for permission. You are permission.',
        onBreak: () => {
          w.say('The pod bursts and seeds fly. A sprout only needs a drink to become a tree. The rest of us need a good deal more.')
          w.memo.pod = 1
          w.memo.podTile = tile
          const taken: number[] = []
          for (let k = 0; k < 60 && taken.length < 5; k++) {
            const u = step(tile, Math.round(any() * 6), Math.round(any() * 6))
            if (u < 0 || !w.plantable(u) || taken.includes(u)) continue
            taken.push(u)
            const dur = 0.7 // each seed lands exactly on its tile
            w.bits.spawn(x, top + 0.6, z, (tx(u) - x) / dur, 11 * dur + (w.h[u] - top - 0.6) / dur, (tz(u) - z) / dur, 0.14, BARK, dur + 0.05, w.h[u], 0)
            w.after(dur, () => w.sapling(u))
          }
        },
      })
      w.put(t, 0, 0.4, 0, 0.7, 0.8, 0.7, 0xa9825c)
      w.put(t, 0, 0.4, 0, 0.74, 0.16, 0.74, 0xc7a071)
      w.put(t, 0, 0.86, 0, 0.4, 0.12, 0.4, 0x8f6c4c)
      w.put(t, 0, 1.0, 0, 0.1, 0.2, 0.1, 0x67bd72)
    } else if (c === '4') {
      // It comes up with the grass, and looks like one more tuft unless you look.
      const lucky = w.extra('secret', { icon: 'clover', hint: 'Three leaves are common. Somewhere on the first island there are four. Luck is mostly looking at the ground for longer than is normal.', at: () => w.above(tile, 0.5) })
      const t: number = w.thing(tile, { tap: () => w.things[t].up && lucky('A secret: a four-leaf clover. Lucky you. It was there the whole time, which is the least comforting thing about luck.') })
      w.put(t, 0, 0.12, 0, 0.05, 0.24, 0.05, 0x4f9a5a, true)
      for (const [dx, dz] of NEAR) w.put(t, dx * 0.1, 0.26, dz * 0.1, 0.14, 0.05, 0.14, 0x3f8f52, true)
    }
  },

  done(w, s) {
    // A pond with water in it is worth flying in for.
    w.onFill.push((tile) => {
      if (w.mark[tile] !== 'p' || w.isle[tile] !== s || w.memo.ducks) return
      w.memo.ducks = 1
      w.after(2.5, () => {
        w.say('Ducks! The pond is a pond again. They came the second there was water, and act as if they were always here.', 'duck')
        w.tiles[s]
          .filter((u) => w.mark[u] === 'p')
          .slice(-2) // the far end of the pond from where the beaver will build
          .forEach((u, k) => {
            const duck = w.critters.spawn('duck', tx(u) - 13, GROUND + 6 + k, tz(u) - 3 + k * 4, k ? 0xfff1c9 : 0xffffff)
            w.critters.go(duck, tx(u), w.h[u] + 0.4, tz(u), 2.4 + k * 0.5, 0.6, () => {
              w.splash(duck.x, duck.y + 0.1, duck.z, 5)
              duck.next = w.paddle
              duck.rest = 1 + k
              if (k) return
              // The first duck has a family: three ducklings, each keeping to the tail of the one in front.
              const line: Critter[] = [duck]
              for (let n = 0; n < 3; n++) line.push(Object.assign(w.critters.spawn('duck', duck.x, duck.y, duck.z - 0.2 * n, 0xffe07a), { grow: 0.5 }))
              w.ticks.push((dt) =>
                line.slice(1).forEach((duckling, n) => {
                  const ahead = line[n]
                  const far = Math.hypot(ahead.x - duckling.x, ahead.z - duckling.z)
                  duckling.y = duck.y
                  if (far < 0.36) return
                  const pull = Math.min(1, dt * 4) * (1 - 0.36 / far)
                  duckling.face = Math.atan2(ahead.x - duckling.x, ahead.z - duckling.z)
                  duckling.x += (ahead.x - duckling.x) * pull
                  duckling.z += (ahead.z - duckling.z) * pull
                }),
              )
            })
          })
      })
    })
    // Where the river reaches the sea it drops its sand, and a beach builds up.
    w.onFill.push((tile) => {
      if (w.isle[tile] !== s || w.mark[tile] !== 'r' || tz(tile) < Math.max(...w.tiles[s].map(tz))) return
      w.after(2.5, () => {
        w.say('The river reaches the sea and drops its sand there. Grain by grain: a beach. Nothing this slow should work. And yet.', 'river', -1, '86cdf5')
        w.raise('beach', tx(tile), tz(tile) + 2)
      })
    })
    // Fish jump once the river runs.
    w.ticks.push((dt) => {
      if (!w.memo.river || Math.random() > dt * 3) return
      const u = w.tiles[s][Math.floor(Math.random() * w.tiles[s].length)]
      if (w.mark[u] === 'r' && w.filled[u]) w.bits.spawn(tx(u), w.h[u] + 0.45, tz(u), any() * 2, 5.5, any() * 2, 0.17, 0xff9a5c, 1.2, w.h[u] + 0.35, 0)
    })
    swing(w, s)
  },
}
