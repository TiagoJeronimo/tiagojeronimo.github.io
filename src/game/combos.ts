import { BARK, D, GROUND, NEVER, W, any, tx, tz } from './grid.ts'
import type { Island } from './Island.ts'

/**
 * Things that only happen when two other things are both true: wind and seeds, bees and blossom, rain and fire.
 * Nobody has to find them. Each counts once, in whatever order its two halves came about.
 * The isles leave notes in `w.memo` when their half happens; this keeps an eye on the notes.
 */
export function combos(w: Island) {
  const { bits } = w
  const beach = w.index('beach')
  const found = {
    seeds: w.extra('combo', { hint: 'Seeds want wind. Something on the first island is full of seeds, and something in the meadow makes wind. They should talk.' }),
    apples: w.extra('combo', { hint: 'Bees and fruit trees have business with each other. It is not your business. Arrange it anyway.' }),
    pears: w.extra('combo', { hint: 'A cactus that has flowered would like to meet some bees. It is prickly about asking.' }),
    steam: w.extra('combo', { hint: 'Ask the frog for rain where a fire is burning. Not because you should. Because you can.' }),
    glass: w.extra('combo', { hint: 'Ask the frog for rain where the lava runs. Somebody has to find out what happens.' }),
    glow: w.extra('combo', { hint: 'A lagoon with the tide in is worth seeing in the dark. Most things are, to be fair.' }),
    swirl: w.extra('combo', { hint: 'A windmill that turns is worth seeing in the dark. It is not doing it for you, but it does not mind.' }),
    owls: w.extra('combo', { hint: 'Ring the bell on the mountain when it is night. Somebody is always up.' }),
  }
  let clock = 0
  let sown = false
  let called = false
  let lit = false

  w.ticks.push((dt) => {
    // While they last: light under the lagoon at night, and fireflies thrown off the turning sails.
    const lagoon = w.night && !!w.memo.tide
    if (lagoon && Math.random() < dt * 12) {
      const u = w.tiles[beach][Math.floor(Math.random() * w.tiles[beach].length)]
      if (w.mark[u] === 'l') bits.spawn(tx(u) + any(), w.h[u] + 0.46, tz(u) + any(), 0, 0.25, 0, 0.1, 0x7ff5e6, 1.6, NEVER, 0, 0, 3)
    }
    if (lagoon !== lit) {
      lit = lagoon
      for (const u of w.tiles[beach]) if (w.mark[u] === 'l') w.wet.paint(w.pool[u], 0x7fdde0, lit ? 2 : 1)
    }
    const swirling = w.night && !!w.memo.wind
    if (swirling && Math.random() < dt * 12) {
      const a = Math.random() * 6.3
      bits.spawn(tx(w.memo.mill) + Math.cos(a) * 1.4, w.h[w.memo.mill] + 1.95 + Math.sin(a) * 1.4, tz(w.memo.mill) + 0.6, -Math.sin(a) * 3, Math.cos(a) * 3, 0, 0.1, 0xe9ff8a, 0.9, NEVER, 0, 0, 3.5)
    }

    if ((clock += dt) < 0.5) return
    clock = 0
    if (w.memo.wind && w.memo.pod && !sown) {
      // The windmill's wind takes what is left of the seed pod much further than it could throw it.
      sown = true
      found.seeds('Wind and seeds! The windmill takes the last of the pod and plants it on other shores. Nobody asked the other shores.')
      const from = w.memo.podTile
      for (let k = 0, n = 0; k < 600 && n < 8; k++) {
        const u = Math.floor(Math.random() * W * D)
        if (!w.plantable(u) || Math.hypot(tx(u) - tx(from), tz(u) - tz(from)) < 6) continue
        n++
        const flight = 1.8
        bits.spawn(tx(from), w.h[from] + 1, tz(from), (tx(u) - tx(from)) / flight, 11 * flight + (w.h[u] - w.h[from] - 1) / flight, (tz(u) - tz(from)) / flight, 0.14, BARK, flight + 0.05, w.h[u], 0)
        w.after(flight, () => w.sapling(u))
      }
    }
    if (w.beesOut) {
      // Apples on every fruit tree in leaf, now and from now on. And fruit on the cactus, if it has flowered.
      for (const thing of w.things) {
        if (!thing.extra || !thing.up || (!thing.perch && !w.memo.cactus)) continue
        thing.extra.forEach((cube, k) => w.solid.show(cube, 0.3 + k * 0.2))
        thing.extra = undefined
        // (Flowers on the old tree and fruit on an oak or two come out the same way, and are nothing to announce.)
        if (thing.key === 'tree:fruit') found.apples('Bees and blossom! The fruit trees are heavy with apples. The bees will not be thanked. They never are.')
        else if (!thing.perch) found.pears('Bees and cactus flowers! Prickly pears, the first in years. Hard to pick, hard to eat, and the cactus is thrilled.')
      }
    }
    if (lagoon) found.glow('Night and tide! The lagoon lights up from underneath. Nothing is doing it on purpose. That is what makes it nice.')
    if (swirling) found.swirl("Night wind! The windmill's sails throw fireflies round and round. The fireflies have decided it is a ride.")
    if (w.memo.steam) found.steam('Rain and fire! The fire pit goes out in a great cloud of steam. You did that on purpose. A knock will light it again, and we need not speak of it.')
    if (w.memo.glass) found.glass('Rain and lava! The whole mountain hisses, and for a moment the lava sets like black glass. Nobody has ever told a volcano to calm down and had it work. Until now.')
    if (w.memo.nightBell && !called) {
      called = true
      found.owls('A bell in the dark! Owls come out to see who is ringing. It was you. They are not angry, just awake.')
      const at = w.memo.bellTile
      for (let k = 0; k < 3; k++) w.critters.spawn('owl', tx(at) + 9, GROUND + 9, tz(at) - 5 + k * 4, [0xb9a58a, 0xa08c74, 0xcdbfa6][k]).next = w.flit
    }
  })
}
