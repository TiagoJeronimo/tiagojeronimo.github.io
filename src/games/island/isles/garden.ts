import { note } from '../../../sound.ts'
import type { Critter } from '../critters.ts'
import { BARK, GROUND, NEAR, W, any, drawn, step, tileAt, tx, tz, type Isle } from '../grid.ts'
import type { Island } from '../Island.ts'
import { untilBeat } from '../music.ts'

/** The coop is open: out come the chicks. Their cheeping calls the flock home, and the flock brings seeds. */
function letOut(w: Island, tile: number) {
  const x = tx(tile)
  const z = tz(tile)
  w.say('Chicks! Out they tumble, cheeping fit to burst. The racket calls the flock home, and the flock brings seeds. The loudest thing here weighs nothing and has no plan. It works anyway.', 'chick')
  // A hop is a cheep, but a small one: it does not carry, and is only heard from close by.
  const cheep = (chick: Critter) => {
    const heard = w.hears(chick.x, chick.z)
    if (heard > 0.1) note(1, 0.04 * heard)
  }
  for (let k = 0; k < 2; k++)
    w.after(0.3 + k * 0.7, () => {
      // They potter about the garden a hop at a time: over the grass, between the carrots, up onto a cabbage or a
      // pumpkin. Every hop comes down on a beat of the tune, whether or not anybody can hear it: a chick waits for the
      // right moment to leave the ground (it is up for half a beat), and stays put after it for a beat or a few.
      w.critters.spawn('chick', x, w.h[tile], z + 0.5).next = (chick) => {
        const here = tileAt(chick.x, chick.z)
        const [di, dj] = NEAR[Math.floor(Math.random() * 4)]
        const u = step(here, di, dj)
        const to = u >= 0 && w.isle[u] === w.isle[tile] && '.ckpH'.includes(w.mark[u]) ? u : here
        const perch = !w.alive[to] ? 0 : w.mark[to] === 'k' ? 0.43 : w.mark[to] === 'p' ? 0.37 : 0
        const roam = perch ? 0.12 : 0.5
        const [hx, hz] = [tx(to) + any() * roam, tz(to) + any() * roam]
        const [wait, beat] = untilBeat(w.time)
        const up = beat / 2
        const lead = wait >= up ? wait - up : wait + beat - up
        w.after(lead, () => {
          if (chick.hidden || chick.nap > 0.1) return // night has fallen meanwhile: it is asleep
          w.critters.go(chick, hx, w.h[to] + perch, hz, up, 0.14, () => cheep(chick))
        })
        chick.rest = lead + Math.floor(Math.random() * 4) * beat + 0.05
      }
    })
  w.seeds = 9
  for (let k = 0; k < 3; k++)
    w.after(1.8 + k * 0.7, () => {
      const bird = w.critters.spawn('bird', x - 12, GROUND + 7, z - 6 + k * 4, [0xffd45c, 0xff9a85, 0xc4a4f0][k])
      bird.friend = 'flock'
      bird.next = w.flit
    })
}

/**
 * The kitchen garden, just across a plank bridge from the crate the bees came out of: three beds somebody
 * once kept, a watering can, a scarecrow and a chicken coop. It comes up when the bees are let out.
 *   c  carrots     k  cabbages     p  pumpkins     w  the watering can     Z  the scarecrow
 *   h  the chicken coop     H  bridge to the island
 */
export const garden: Isle = {
  name: 'garden',
  at: [4, 7],
  rows: [
    ' .... ',
    'hcccc.',
    '.kkkk.',
    'w.pp.Z',
    ' .....',
    '     H',
  ],
  // What any map of it has to keep to: the bridge at (5, 5), and bare ground south of the coop, where its door is.
  variants: [
    // The beds running north to south, the coop in the east.
    { rows: [' .... ', 'Zck.h.', '.ck...', 'wck.p.', ' ck.p.', '     H'] },
    // The coop and the scarecrow at the back, the beds in front.
    { rows: [' .... ', '.h..Z.', '..pp.w', '.cccc.', ' kkkk.', '     H'] },
  ],
  beds: '',
  finds: 'wZh',
  look: {
    dry: [0xcbb489, 0xc2ab80, 0xd3bd93], green: [0x9fd872, 0x8fd16b, 0xb4de6e], tuft: 0x7fca6c, tufts: 2, soil: 0xa9825c, bed: 0xcbb489, wet: 0xcbb489,
    reach: 3, flowers: 0.1, petals: [0xffffff, 0xffd45c, 0xf78bb5], tree: 'fruit',
  },

  lay(w, tile, c) {
    const { bits } = w
    const x = tx(tile)
    const z = tz(tile)
    const top = w.h[tile]
    if ('ckp'.includes(c)) {
      // A patch of dug earth with something withered in it, until the tile is alive.
      const t = w.thing(tile, { tip: c === 'c' ? 'Carrots. The good half is underground, as usual' : c === 'k' ? 'Cabbages. Doing their best' : 'A pumpkin. It peaked early, and it knows' })
      const dead: number[] = []
      w.put(t, 0, 0.03, 0, 0.92, 0.06, 0.92, 0x8a6a4c)
      if (c === 'c') {
        // Two carrots to a patch. Each can be pulled, once it has grown: the earth stays where it is.
        const rows = [-0.22, 0.22].map((dx) => {
          dead.push(w.put(t, dx, 0.12, 0, 0.08, 0.14, 0.08, 0xa58f72))
          return [dx, w.put(t, dx, 0.2, 0, 0.1, 0.3, 0.1, 0x67bd72, true), w.put(t, dx + 0.07, 0.16, 0.04, 0.07, 0.2, 0.07, 0x7fca6c, true), w.put(t, dx - 0.06, 0.15, -0.04, 0.07, 0.18, 0.07, 0x5fae62, true), w.put(t, dx, 0.08, 0, 0.17, 0.06, 0.17, 0xff9a3c, true)]
        })
        w.things[t].pick = () => {
          const row = w.things[t].up ? rows.pop() : undefined
          if (!row) return
          for (const cube of row.slice(1)) w.solid.hide(cube)
          return [x + row[0], top + 0.2, z]
        }
      }
      else if (c === 'k') {
        dead.push(w.put(t, 0, 0.1, 0, 0.3, 0.12, 0.3, 0x97826a))
        w.put(t, 0, 0.1, 0, 0.56, 0.1, 0.56, 0x8fd16b, true)
        w.put(t, 0, 0.22, 0, 0.42, 0.26, 0.42, 0xa9de7c, true)
        w.put(t, 0, 0.38, 0, 0.26, 0.1, 0.26, 0xc4e77e, true)
      } else {
        dead.push(w.put(t, 0, 0.1, 0, 0.2, 0.14, 0.2, 0xb08a6a))
        w.put(t, 0, 0.2, 0, 0.5, 0.34, 0.5, 0xff9a3c, true)
        w.put(t, 0, 0.2, 0, 0.54, 0.2, 0.3, 0xf08a2c, true)
        w.put(t, 0, 0.42, 0, 0.08, 0.12, 0.08, 0x67bd72, true)
        w.put(t, 0.2, 0.08, 0.3, 0.24, 0.05, 0.2, 0x7fca6c, true)
      }
      w.things[t].wake = () => dead.forEach((cube) => w.solid.hide(cube))
    } else if (c === 'w') {
      // Full to the brim. Tip it, and the whole garden gets its drink. Its spout points at the beds, wherever on this map
      // they lie: square on to them, east, west, north or south, and the water flies their way.
      const beds = drawn(garden, w.seed).rows.flatMap((row, j) => [...row].flatMap((mark, i) => ('ckp'.includes(mark) ? [[garden.at[0] + i - (tile % W), garden.at[1] + j - Math.floor(tile / W)]] : [])))
      const [vx, vz] = [beds.reduce((n, bed) => n + bed[0], 0) / beds.length, beds.reduce((n, bed) => n + bed[1], 0) / beds.length]
      const [ux, uz] = [vx / Math.hypot(vx, vz), vz / Math.hypot(vx, vz)]
      const [di, dj] = Math.abs(vx) >= Math.abs(vz) ? [Math.sign(vx), 0] : [0, Math.sign(vz)]
      /** One box of it: how far along the spout, how high, how far to the side, and its size the same way round. */
      const box = (along: number, y: number, side: number, long: number, high: number, wide: number, color: number, add = w.put.bind(w)) => add(t, di * along - dj * side, y, dj * along + di * side, di ? long : wide, high, di ? wide : long, color)
      const t = w.thing(tile, {
        auto: false,
        hits: 3,
        keep: true,
        sound: 'slosh',
        tip: 'A watering can, full to the brim. All potential',
        clue: 'A [watering can] stands in the kitchen garden, full to the brim. Everything a garden needs, in the one container that cannot pour itself.',
        onHit: (left) => left === 1 && w.say('The can is heavy with water. One more push will tip it. Go on. Be the push.'),
        onBreak: () => {
          w.say('Water over the beds at last. Carrots, cabbages, pumpkins: the whole garden comes back. It was never gone. It was waiting for somebody to bother.')
          w.things[t].tip = 'A watering can, on its side. Empty, and pleased with itself'
          for (let k = 0; k < 40; k++)
            w.after(k * 0.06, () => {
              const [far, wide] = [2 + Math.random() * 5, any() * 4]
              bits.spawn(x + di * 0.5, top + 0.5, z + dj * 0.5, ux * far - uz * wide, 4 + Math.random() * 2, uz * far + ux * wide, 0.12, 0xbfe6ff, 1.2, top, 0)
            })
          w.source(tile, 5.6, 0.8)
        },
      })
      box(0, 0.2, 0, 0.36, 0.4, 0.3, 0x7fc7c0)
      box(0, 0.42, 0, 0.4, 0.05, 0.34, 0x6ab3ad)
      box(0.32, 0.3, 0, 0.34, 0.08, 0.08, 0x6ab3ad)
      box(0.52, 0.34, 0, 0.12, 0.14, 0.14, 0x9fd9d3)
      box(-0.24, 0.26, 0, 0.08, 0.3, 0.08, 0x6ab3ad)
      w.things[t].marks = [[box(0.62, 0.02, 0, 0.3, 0.04, 0.26, 0xbfe6ff, w.scar.bind(w))]] // the first push spills a little
    } else if (c === 'Z') {
      // A scarecrow. Something is living in its hat, and once the garden is alive the birds sit on its arms.
      let roost = false
      w.ticks.push(() => {
        if (roost || !w.alive[tile]) return
        roost = true
        w.perches.push([x, top + 1.66, z], [x - 0.42, top + 1, z], [x + 0.42, top + 1, z])
      })
      const lodger = w.extra('secret', { icon: 'bird/b08a6a', hint: 'The hat of the scarecrow is not empty. The scarecrow has known for a while, and is being very decent about it.', at: () => w.above(tile, 2) })
      const t: number = w.thing(tile, {
        auto: false,
        sound: 'rustle',
        tip: 'A scarecrow. Its hat just moved. It is choosing not to react',
        wanting: () => !lodger.has(),
        tap: () => {
          const scarecrow = w.things[t]
          scarecrow.tap = undefined
          scarecrow.tip = 'A scarecrow. Its hat is to let again'
          w.solid.poke(hat, 12)
          const sparrow = w.critters.spawn('bird', x, top + 1.65, z, 0xb08a6a)
          sparrow.friend = 'sparrow'
          sparrow.grow = 0.75
          sparrow.tip = 'The sparrow from the scarecrow’s hat. Scared of nothing'
          sparrow.next = w.flit
          lodger('A secret: the scarecrow has a lodger. A sparrow has been living in its hat. It had one job, scaring birds, and took one in instead. Nobody is cross.')
        },
      })
      w.put(t, 0, 0.65, 0, 0.1, 1.3, 0.1, BARK)
      w.put(t, 0, 0.92, 0, 0.9, 0.1, 0.1, BARK)
      w.put(t, 0, 0.84, 0, 0.42, 0.42, 0.24, 0xe9806f)
      w.put(t, 0, 0.62, 0, 0.36, 0.1, 0.2, 0xc9b27a)
      w.put(t, 0, 1.25, 0, 0.3, 0.3, 0.3, 0xe6d5a0)
      for (const dx of [-0.08, 0.08]) w.put(t, dx, 1.28, 0.16, 0.05, 0.05, 0.02, 0x3a3340)
      w.put(t, 0, 1.43, 0, 0.5, 0.07, 0.5, BARK)
      const hat = w.put(t, 0, 1.55, 0, 0.28, 0.18, 0.28, BARK)
    } else if (c === 'h') {
      // A chicken coop, its door barred. Somebody inside wants out.
      const coop = w.thing(tile, { tip: 'A chicken coop, barred shut. From the outside, note' })
      w.put(coop, 0, 0.3, -0.06, 0.8, 0.6, 0.7, 0xd9b27c)
      w.put(coop, 0, 0.67, -0.06, 0.98, 0.14, 0.88, 0xe9806f)
      w.put(coop, 0, 0.81, -0.06, 0.6, 0.14, 0.88, 0xd96f60)
      w.put(coop, 0, 0.2, 0.3, 0.3, 0.38, 0.04, 0x4a3b3b)
      w.put(coop, 0, 0.03, 0.5, 0.28, 0.06, 0.32, 0xb89572)
      const t = w.thing(tile, {
        auto: false,
        hits: 3,
        sound: 'cheep',
        tip: 'A chicken coop, barred shut. From the outside, note',
        clue: 'Something is cheeping inside the [little coop] in the kitchen garden. It has been cheeping at a door for some time. Be the worst day that door ever had.',
        onHit: (left) => left === 2 && w.say('Cheep. Cheep cheep. Somebody in the coop wants out, and has a list of complaints that is one word long.'),
        onBreak: () => {
          w.things[coop].tip = 'The chicken coop. Empty, and the better for it'
          letOut(w, tile)
        },
      })
      w.things[coop].guard = t
      w.put(t, 0, 0.2, 0.33, 0.34, 0.4, 0.04, 0xb89572)
      w.things[t].marks = [[w.put(t, 0, 0.24, 0.36, 0.52, 0.08, 0.04, BARK)]] // the bar across the door goes first
    } else if (c === 'H') {
      w.planks(w.thing(tile), 1, 0)
      w.signpost(tile, 1, 0, [
        'KITCHEN GARDEN. Please do not pick the... oh, go on then.',
        'Somebody planted all this and then did not come back. The carrots took it personally.',
        'A garden is a way of telling the future you believe in it. The sign was told this by a cabbage.',
      ])
    } else if (Math.floor(tile / W) === garden.at[1]) {
      // A bit of fence along the far side.
      for (const dy of [0.28, 0.48]) w.land(tile, top + dy, 1, 0.06, 0.06, 0xb89572, 0, -0.38)
      w.land(tile, top + 0.3, 0.09, 0.6, 0.09, BARK, any() * 0.2, -0.38)
    }
  },
}
