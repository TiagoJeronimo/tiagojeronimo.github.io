import { note, thump } from '../../../sound.ts'
import type { Critter } from '../critters.ts'
import { BARK, GROUND, NEAR, NEVER, STONE, W, WOOD, any, step, tx, tz, type Isle } from '../grid.ts'
import type { Island } from '../Island.ts'

// The marmots of each game, asleep in their holes until the bell goes; and the holes, which say so until then.
const marmots = new WeakMap<Island, Critter[]>()
const burrows = new WeakMap<Island, number[]>()

/** The bell: a ring of gold goes out, and everyone still asleep anywhere sits up. */
function ring(w: Island, tile: number, loud: boolean) {
  note(0.12, 0.25)
  w.rumble(0.25)
  w.notice([tx(tile), w.h[tile] + 0.9, tz(tile)], 1.5)
  for (let k = 0; k < 18; k++) w.bits.spawn(tx(tile), w.h[tile] + 0.9, tz(tile), Math.cos(k * 0.35) * 7, 0, Math.sin(k * 0.35) * 7, 0.12, 0xffd86b, 0.8, NEVER, 0, 0, 2)
  if (!loud) return
  for (const hole of burrows.get(w) ?? []) w.things[hole].tip = 'A burrow in the rock. Empty. The bell saw to that'
  // Each marmot is called out once. (They used to be told again at every ring until they were up, and a bell rung fast
  // stacked one climb out of the burrow on another: they rose into the air.)
  const called = marmots.get(w) ?? []
  marmots.delete(w)
  let n = 0
  for (const marmot of called)
    if (!marmot.next)
      w.after(0.4 + n++ * 0.5, () => {
        note(0.9, 0.06)
        w.critters.go(marmot, marmot.x, marmot.y + 0.14, marmot.z + 0.26, 0.3, 0.4, () => Object.assign(marmot, { next: w.hop, still: false }))
      })
}

/** The snowball goes down the mountain, a step at a time and bigger at every one, and through the ice. */
function roll(w: Island, ball: Critter, from: number) {
  const dam = w.memo.icedam
  // Straight for the ice, wherever it lies from the summit: as many steps as the longer way across, a tile to each.
  const ice = w.things[dam].tile
  const [di, dj] = [(ice % W) - (from % W), Math.floor(ice / W) - Math.floor(from / W)]
  const steps = Math.max(Math.abs(di), Math.abs(dj))
  const path = Array.from({ length: steps }, (_, k) => step(from, Math.round((di * (k + 1)) / steps), Math.round((dj * (k + 1)) / steps)))
  let rolling = true
  w.ticks.push((dt) => {
    if (rolling) ball.tilt += dt * 9
  })
  ball.thing = undefined
  w.watch(ball, 8) // the camera goes down the mountain with it
  w.say('Off it goes, bigger at every step, and straight through the ice. A small decision that got out of hand. The lake is loose, and it knows the way down.', 'snowball')
  const next = (k: number) => {
    const u = path[k]
    ball.grow = 1 + k * 0.22
    if (k < steps - 1) return w.critters.go(ball, tx(u), w.h[u] + 0.45 * ball.grow, tz(u), 0.45, 0.6, () => next(k + 1))
    w.critters.go(ball, tx(u), w.h[u] + 1, tz(u), 0.4, 0.5, () => {
      rolling = false
      ball.hidden = true
      thump()
      w.rumble(0.8)
      for (let n = 0; n < 16; n++) w.bits.spawn(tx(u) + any(), w.h[u] + 1.2, tz(u) + any(), any() * 7, 4 + Math.random() * 5, any() * 7, 0.22, 0xffffff, 1.5, w.h[u], 0.3)
      w.burst(dam)
      w.blocked[u] = 0
    })
  }
  next(0)
}

function wakeMole(w: Island, tile: number) {
  const { critters } = w
  const s = w.isle[tile]
  // The channel it digs, from the end that touches the cascade to the end at the tarn.
  const cascade = (u: number) => NEAR.map(([di, dj]) => step(u, di, dj)).find((v) => v >= 0 && w.isle[v] === s && w.mark[v] === 'c')
  const dry = w.tiles[s].filter((u) => w.mark[u] === 'u')
  const head = dry.find((u) => cascade(u) !== undefined) ?? dry[0]
  const channel = dry.sort((a, b) => Math.abs(tx(a) - tx(head)) + Math.abs(tz(a) - tz(head)) - Math.abs(tx(b) - tx(head)) - Math.abs(tz(b) - tz(head)))
  const mole = critters.spawn('mole', tx(tile), w.h[tile], tz(tile), 0x5d5560)
  mole.pet = 1
  // (One line for the whole of it. Whether there is water up the mountain to follow it down is known already.)
  w.say(
    w.filled[cascade(head) ?? -1]
      ? 'A mole! It sniffs the air, digs straight for the dry tarn, and the water follows it down. It cannot see a thing, and has never once been lost.'
      : 'A mole! It digs a channel straight to the dry tarn. It cannot see a thing, and has never once been lost. The water from up the mountain is your problem.',
    'mole',
  )
  channel.forEach((u, k) =>
    w.after(1.2 + k * 0.9, () => {
      w.uncover(u)
      thump()
      critters.go(mole, tx(u), w.h[u], tz(u), 0.5, 0.3)
    }),
  )
  w.after(1.4 + channel.length * 0.9, () => {
    critters.go(mole, tx(tile) + 1, w.h[tile], tz(tile), 0.6, 0.4, () => {
      mole.next = w.stroll
      mole.rest = 2
    })
  })
}

/**
 * The mountain, north east: bare rock in steps up to a snowy top, and a lake held back by ice.
 *   a  the lake     Q  the ice that dams it     c  the bed of the cascade     U  a snowball on the summit
 *   Z  the bell     n  a marmot hole     m  molehill     u  where the mole will dig     k  the dry tarn
 *   g  a goat     E  an eagle     v  a cave in the cliff behind, for whoever turns the world round
 *   H  bridge to the meadow     O  a fir much older and bigger than the others, with a hollow, and owls in it
 */
export const mountain: Isle = {
  name: 'mountain',
  at: [23, 0],
  rows: [
    '     T.v... ',
    '   .....U.T.',
    ' .T.....Eo..',
    'T.........o.',
    '...aa....T..',
    '.o..Q.Og...T',
    '..Z.c.n..n..',
    ' ...c..n... ',
    '   .c.....T ',
    '   .cuuukk. ',
    '   .c.m.kk. ',
    '   .c...HT  ',
  ],
  high: [
    '     234432 ',
    '   233445432',
    ' 12334445432',
    '123333444332',
    '123333333321',
    '012323222221',
    '011222222210',
    ' 0111111110 ',
  ],
  // What any map of it has to keep to: the bridge to the meadow at (8, 11), on the south coast and level with the plain; the cave at (7, 0) with the north face as high as it is here; water that only ever
  // runs level or down, from the lake through the ice and down the cascade to a coast; the covered channel leading off the
  // cascade to a tarn that touches neither the cascade nor a coast; bare ground in a straight line from the snowball to
  // the ice; and bare ground east of the molehill, where the mole ends up.
  variants: [
    // The summit in the north-west, the lake on the east shoulder, the cascade down the east side, the tarn in the south-west.
    {
      rows: [
        '     ..v..T ',
        '   T.UE.....',
        ' T........o.',
        'T..........T',
        '.o...O...aa.',
        '...g.....Q..',
        '.Z..n.n..c.o',
        ' ....n...cT ',
        '   ..T...c. ',
        '   .kkuuuc. ',
        '   .kk.m.c. ',
        '   T....Hc  ',
      ],
      high: [
        '     234432 ',
        '   345444332',
        ' 12344443332',
        '123334443332',
        '123333333332',
        '012222223231',
        '011222222210',
        ' 0111111110 ',
      ],
    },
    // The lake in the middle: the cascade comes down the middle, turns east and leaves by the east coast; a long tarn below it.
    {
      rows: [
        '     T.v... ',
        '   .....UET.',
        ' .T.........',
        '..o.......o.',
        'T....aa.O...',
        '.o....Q..g.T',
        '...n..c.n.Z.',
        ' ..n..c.... ',
        '   .T.ccccc ',
        '   .....um. ',
        '   .T.kkkk. ',
        '   ..T..H.  ',
      ],
      high: [
        '     234432 ',
        '   233445432',
        ' 12334445432',
        '123333444332',
        '123333333321',
        '012223232221',
        '011222222210',
        ' 0111111110 ',
      ],
    },
  ],
  beds: 'aQcuk',
  loose: 'ZnTo',
  finds: 'UZm',
  look: {
    dry: [0xc9c3bb, 0xbfb9b0, 0xd2cdc5], green: [0x9ccf7e, 0xa9d688, 0x8fc777], tuft: 0x7fbf6b, tufts: 2, soil: 0xa59d98, bed: 0xb9b3ac, wet: 0xa39d96,
    reach: 2.4, flowers: 0.14, petals: [0xffffff, 0x7fa8ff, 0xffe27a, 0xf78bb5], tree: 'pine', dress: 'pebble', litter: [0xaaa4ac, 0xbdb8be],
  },

  lay(w, tile, c) {
    const s = w.isle[tile]
    const x = tx(tile)
    const z = tz(tile)
    const top = w.h[tile]
    // The top two steps lie under snow, and stay that way.
    if (top >= GROUND + 4) w.land(tile, top + 0.07, 1, 0.14, 1, 0xfafcff) // deep enough to bury the pebbles
    if (c === 'a') w.filled[tile] = 1
    else if (c === 'O') {
      // A fir much older and bigger than the others, with a hollow in its trunk on the side the camera starts from: a dark
      // knot by day, with two eyes in it after dark. Knocked on then, the owls come out (`combos`). Not before: whoever
      // lives in there keeps other hours. Snow on its tiers while the mountain is dry, green once it wakes, as the pines.
      const wide = 0.5
      const t = w.thing(tile, {
        sound: 'hoo',
        tip: 'A fir, much older than the others. A hollow in it, dark, and not empty',
        wanting: () => w.night && !w.memo.owls,
        tap: () => {
          if (!w.night) return w.say('Nobody answers. Whoever lives in the hollow keeps other hours. Try again when it is dark.', 'hollow')
          w.memo.owls = 1 // and they come out: see `combos`
        },
      })
      w.memo.hollowTile = tile
      w.put(t, 0, 0.8, 0, wide, 1.6, wide, WOOD)
      const tiers = [[1.7, 1.7], [1.34, 2.16], [0.98, 2.6], [0.6, 3.02]].map(([size, dy]) => w.put(t, 0, dy, 0, size, 0.46, size, 0xf4f8fd))
      w.things[t].wake = () => tiers.forEach((cube, k) => w.solid.paint(cube, k % 2 ? 0x6fbc86 : 0x5fae7a))
      w.put(t, 0, 0.78, wide / 2 + 0.02, 0.18, 0.26, 0.04, 0x3a2a22)
      const eyes = [-0.045, 0.045].map((dx) => w.put(t, dx, 0.82, wide / 2 + 0.05, 0.045, 0.045, 0.02, 0xffd45c))
      w.ticks.push(() => {
        const open = w.night && !w.memo.owls && w.open[s]
        for (const eye of eyes) {
          if (w.solid.on(eye) === open) continue
          if (open) w.solid.show(eye)
          else w.solid.hide(eye)
        }
      })
    }
    else if (c === 'v') {
      // A cave in the cliff on the far side, for whoever turns the world round: a mound of rock built out from the cliff with a
      // tall arch in it, a smaller arch further in, a pool that glows, crystals, and bats asleep under the inner roof.
      const crystals = w.extra('secret', { icon: 'bat/5b4a66', hint: 'Turn the world round. The mountain has a back door. Most things look different from behind, and most people never check.', at: () => (w.exists[tile] ? [x, GROUND + 4.2, z - 1.3] : undefined) })
      const foot = GROUND - top // down the cliff, to the level of the plain
      const [ROCK, PALE, SHADE, INNER, STONE_PALE] = [0xa59d98, 0xb3aba6, 0x978f8a, 0x9d93b3, 0xd2cdc5]
      let woken = false
      const t = w.thing(tile, {
        sound: 'flap',
        tip: 'A cave. Something rustles inside. It heard you too',
        wanting: () => !crystals.has(),
        tap: () => {
          until = Math.max(until, w.time + 12)
          if (woken) w.say('And off the bats go again. You woke them twice. They are not keeping count. You are.', 'bats')
          woken = true
          crystals('A secret: a cave on the far side of the mountain, full of crystals. And of bats. The prettiest room in the world, and it is kept by things that hang up to sleep.')
          out()
        },
      })
      // Out of the mouth first, then round and round outside, now and then right over the top: all night, or for a while after a knock.
      let until = 0
      const out = () =>
        bats.forEach((bat, k) => {
          if (bat.roll) w.critters.go(bat, x + any() * 0.8, GROUND + 0.7 + Math.random() * 0.5, z - 3 - Math.random(), 0.4 + k * 0.08, 0.1)
          Object.assign(bat, { roll: 0, grow: 1.3 })
          bat.next = (b) => {
            const over = Math.random() < 0.3
            if (w.night || w.time < until)
              return w.critters.go(b, x + any() * 9, GROUND + (over ? 6.5 + Math.random() * 1.5 : 0.5 + Math.random() * 5), z + (over ? Math.random() * 3 : -2.2 - Math.random() * 5), 0.9 + Math.random() * 0.5, 0.4)
            // Home: to the mouth, then up under the roof again.
            b.next = undefined
            w.critters.go(b, x + any(), GROUND + 0.8, z - 3, 0.9, 0.4, () =>
              w.critters.go(b, x + ROOSTS[k][0], GROUND + 1.8, z - 0.5 - ROOSTS[k][1], 0.5, 0, () => {
                if (!b.next) Object.assign(b, { roll: Math.PI, face: Math.PI, grow: 0.85 })
              }),
            )
          }
        })
      w.onNight.push((night) => night && w.open[s] && out())
      /** A block of it: from x0 to x1, from y0 to y1 above the plain, and from the cliff out to `out` (or only from `back` to `out`). */
      const rock = (x0: number, x1: number, y0: number, y1: number, out: number, color: number, back = 0, later = false) =>
        w.put(t, (x0 + x1) / 2, foot + (y0 + y1) / 2, -0.5 - (out + back) / 2, x1 - x0, y1 - y0, out - back, color, later)
      const glow = (cube: number, color: number, gain: number) => w.solid.paint(cube, color, gain)
      // The mound, stepping in over the mouth on both sides until it meets at the top: a pointed arch, not a doorway.
      rock(-1.9, -0.95, -GROUND, 1.5, 1.75, ROCK)
      rock(-1.6, -0.7, 1.5, 2.3, 1.55, PALE)
      rock(-1.25, -0.4, 2.3, 2.9, 1.35, ROCK)
      rock(0.95, 1.8, -GROUND, 1.3, 1.6, SHADE)
      rock(0.7, 1.55, 1.3, 2.2, 1.4, ROCK)
      rock(0.4, 1.2, 2.2, 2.9, 1.2, PALE)
      rock(-1, 0.95, 2.9, 3.4, 1, SHADE)
      rock(-0.5, 0.6, 3.4, 3.75, 0.7, ROCK)
      rock(-0.5, 0.6, 3.75, 3.87, 0.7, 0xfafcff) // snow on top, like the rest of the summit
      rock(-2.35, -1.9, -GROUND, 0.6, 1, SHADE) // shoulders
      rock(1.8, 2.2, -GROUND, 0.4, 0.9, PALE)
      rock(-0.95, 0.95, -GROUND, -0.12, 2.1, ROCK) // the floor, with a doorstep, and fallen rock in steps below it
      rock(-0.95, 0.95, -0.12, 0, 2.1, 0xc9c3bb)
      rock(-1.5, 1.4, -GROUND, -0.9, 2.5, SHADE)
      rock(-0.7, 1.6, -GROUND, -1.5, 3, ROCK)
      // Further in: a second, smaller arch in darker rock, and behind it a wall the colour of dusk.
      // Both are lit a little from inside, by the pool and the crystals: the far side of the mountain gets no sun.
      for (const cube of [rock(-0.95, -0.55, 0, 2.3, 0.8, INNER), rock(0.55, 0.95, 0, 2.2, 0.8, INNER), rock(-0.55, 0.55, 1.9, 2.9, 0.8, INNER)]) glow(cube, INNER, 1.2)
      glow(rock(-0.55, 0.55, 0, 1.9, 0.05, 0x8a7fc4), 0x8a7fc4, 1.4)
      // A pool at the back that glows, crystals growing out of the wall behind it, and two clusters by the inner arch.
      glow(rock(-0.4, 0.4, 0, 0.05, 0.7, 0x8ff5e6, 0.12), 0x8ff5e6, 1.5)
      for (const [dx, out, wide, y0, high, color] of [
        [-0.72, 1.05, 0.2, 0, 0.95, 0x8ff5e6], [-0.48, 1.18, 0.14, 0, 0.55, 0xbffbf0], [-0.8, 1.26, 0.12, 0, 0.35, 0x8ff5e6],
        [0.7, 1.04, 0.18, 0, 0.75, 0xff9ad5], [0.5, 1.16, 0.13, 0, 0.45, 0xc4a4f0], [0.78, 1.24, 0.1, 0, 0.28, 0xff9ad5],
        [-0.2, 0.1, 0.1, 0.8, 0.45, 0xbffbf0], [0.18, 0.1, 0.12, 0.45, 0.4, 0xff9ad5], [-0.38, 0.1, 0.08, 0.35, 0.25, 0xc4a4f0], [0.36, 0.1, 0.08, 1.05, 0.3, 0x8ff5e6],
      ])
        glow(rock(dx - wide / 2, dx + wide / 2, y0, y0 + high, out + wide / 2, color, out - wide / 2), color, 2.6)
      // Icicles along the arch, stone ones further in, and two small ones coming up from the floor.
      for (const [dx, out, from, high, color] of [[-0.1, 0.9, 2.9, 0.5, 0xdff2ff], [-0.55, 1.2, 2.3, 0.35, 0xdff2ff], [0.55, 1.05, 2.2, 0.3, 0xdff2ff], [0.2, 0.65, 1.9, 0.25, STONE_PALE], [0.3, 1.45, 0.3, 0.3, STONE_PALE], [-0.25, 1.62, 0.16, 0.16, STONE_PALE]])
        rock(dx - 0.06, dx + 0.06, from - high, from, out + 0.06, color, out - 0.06)
      // Two little mushrooms on the doorstep, with caps that glow. Moss, once the mountain is alive.
      for (const [dx, out, size] of [[0.72, 1.86, 1], [0.56, 1.98, 0.7]]) {
        rock(dx - 0.03, dx + 0.03, 0, 0.14 * size, out + 0.03, 0xfff6e0, out - 0.03)
        glow(rock(dx - 0.1 * size, dx + 0.1 * size, 0.14 * size, 0.14 * size + 0.08, out + 0.1 * size, 0xc4a4f0, out - 0.1 * size), 0xc4a4f0, 1.8)
      }
      rock(-1.4, -1, -0.9, -0.8, 2.4, 0x9ccf7e, 2.05, true)
      rock(-2.3, -1.95, 0.6, 0.7, 0.9, 0x8fc777, 0.3, true)
      // The bats hang head down under the inner roof, each in its own place.
      const ROOSTS = [[-0.38, 0.25], [0, 0.25], [0.38, 0.25], [-0.2, 0.6], [0.2, 0.6]]
      const bats = ROOSTS.map(([dx, out]) => {
        const bat = w.critters.spawn('bat', x + dx, GROUND + 1.8, z - 0.5 - out)
        w.sleepers[s].push(Object.assign(bat, { roll: Math.PI, face: Math.PI, yaw: Math.PI, grow: 0.85, hidden: true, thing: t }))
        return bat
      })
      // Motes of light drift out of it.
      w.ticks.push((dt) => {
        if (w.open[s] && Math.random() < dt * 5) w.bits.spawn(x + any() * 1.4, GROUND + 0.2 + Math.random() * 1.4, z - 1.4, any() * 0.2, 0.15, -0.35, 0.07, Math.random() < 0.5 ? 0x8ff5e6 : 0xff9ad5, 2.6, NEVER, 0, 0, 3)
      })
    }
    else if (c === 'u') w.cover(tile, true)
    else if (c === 'Q') {
      const t = (w.memo.icedam = w.thing(tile, { tip: 'A wall of ice. There is a whole lake leaning on it' }))
      w.put(t, 0, 0.8, 0, 1, 1.6, 0.9, 0xcdeaff)
      w.put(t, 0, 1.3, 0.12, 0.7, 0.9, 0.9, 0xe3f4ff)
      w.put(t, -0.25, 0.5, 0.47, 0.4, 1, 0.5, 0xdff2ff)
      w.blocked[tile] = 1
    } else if (c === 'U') {
      const ball = w.critters.spawn('snowball', x, top + 0.58, z) // resting on the snow that lies on the summit
      const t = w.thing(tile, { auto: false, hits: 3, sound: 'fwump', tip: 'A big snowball. Held back by two pebbles and a sense of duty', clue: 'A [big snowball] sits on the summit, held back by two small stones. All that wanting to happen, stopped by so little. Help it.', onBreak: () => roll(w, ball, tile) })
      // Two small stones hold it, wedged into the corners its blocks leave at the front.
      w.things[t].marks = [[w.put(t, -0.36, 0.24, 0.36, 0.18, 0.24, 0.18, STONE[1])]] // one of the two goes first
      w.put(t, 0.35, 0.21, 0.35, 0.16, 0.18, 0.16, STONE[0])
      ball.thing = t
      ball.hidden = true
      w.sleepers[s].push(ball)
    } else if (c === 'Z') {
      const t: number = w.thing(tile, {
        auto: false,
        hits: 3,
        keep: true,
        sound: 'dong',
        marks: [], // every ring polishes it a little: see onHit
        fuss: 'The bell, again. Everyone is awake. Everyone has been awake for some time.',
        tip: 'A bell. It has something to say',
        clue: 'A [bell] hangs on the mountain. Nobody has rung it in years. It has not gone anywhere. A bell cannot. Ring it.',
        onHit: (left) => {
          for (const cube of w.things[t].cubes.slice(0, 2)) w.solid.paint(cube, 0xffd45c, left === 2 ? 1.25 : 1.6)
          ring(w, tile, false)
        },
        onBreak: () => {
          w.say('The bell rings out over the water. Up on the rocks, the marmots sit up. Nobody likes it and everybody needed it. That is a bell.')
          w.things[t].tip = 'The bell. It has said it, and will say it again if asked'
          ring(w, tile, true)
        },
        tap: () => ring(w, tile, true),
      })
      w.put(t, 0, 0.95, 0, 0.4, 0.36, 0.4, 0xf0c24a)
      w.put(t, 0, 0.76, 0, 0.52, 0.1, 0.52, 0xe3b23c)
      w.put(t, 0, 0.66, 0, 0.1, 0.1, 0.1, 0x6b5a5a)
      for (const dx of [-0.42, 0.42]) w.put(t, dx, 0.66, 0, 0.1, 1.32, 0.1, BARK)
      w.put(t, 0, 1.36, 0, 1.06, 0.1, 0.16, BARK)
      w.put(t, 0, 1.2, 0, 0.08, 0.2, 0.08, 0x6b5a5a)
    } else if (c === 'n') {
      const hole = w.thing(tile, { tip: 'A burrow in the rock. It sleeps one, and soundly' })
      w.put(hole, 0, 0.16, -0.14, 0.8, 0.32, 0.6, 0xb5aca4)
      w.put(hole, 0, 0.14, 0.17, 0.36, 0.26, 0.04, 0x4f4640)
      const marmot = w.critters.spawn('marmot', x, top - 0.14, z + 0.06, 0xc9a06b)
      marmot.hidden = true
      marmot.still = true // asleep in there, until the bell
      w.sleepers[s].push(marmot)
      marmots.set(w, [...(marmots.get(w) ?? []), marmot])
      burrows.set(w, [...(burrows.get(w) ?? []), hole])
    } else if (c === 'm') {
      const t = w.thing(tile, { auto: false, hits: 3, sleeper: true, sound: 'snf', tip: 'A fresh molehill. Somebody is home, and busy', clue: 'A [fresh molehill] sits between the dry stream bed and the dry tarn. Somebody down there digs. Somebody up here has a use for that.', onBreak: () => wakeMole(w, tile) })
      w.put(t, 0, 0.15, 0, 0.7, 0.3, 0.7, 0x8a6f5a)
      w.put(t, 0.04, 0.38, -0.02, 0.4, 0.18, 0.4, 0x9a7d66)
    } else if (c === 'H') {
      // Planks south to the meadow. For a long time nothing joined the mountain to anything.
      w.planks(w.thing(tile), 0, 1)
      w.signpost(tile, 0, 1, [
        'THE MOUNTAIN. It took a geyser to get it up in the morning. The sign has had mornings like that.',
        'The view from the top is mostly of down here. That is the trouble with views.',
        'For a long time there was no bridge to the mountain. The mountain says it did not notice. It noticed.',
      ])
    } else if (c === 'g' || c === 'E') {
      // Company: a goat on its ledge, an eagle on the top.
      const animal = c === 'g' ? w.critters.spawn('goat', x, top, z, 0xf4efe6) : w.critters.spawn('bird', x, top + 0.12, z, 0x9a7b62)
      animal.next = c === 'g' ? w.stroll : w.flit
      if (c === 'E') animal.friend = 'eagle'
      animal.rest = 3
      animal.hidden = true
      w.sleepers[s].push(animal)
    }
  },
}
