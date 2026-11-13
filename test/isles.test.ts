// The maps of the game's isles: every one fits the grid, none overlap, and there is sea between them.
// Run with: node test/isles.test.ts
import assert from 'node:assert/strict'
import { D, W, deal, drawn } from '../src/game/grid.ts'
import { beach, islet } from '../src/game/isles/beach.ts'
import { garden } from '../src/game/isles/garden.ts'
import { island } from '../src/game/isles/island.ts'
import { meadow } from '../src/game/isles/meadow.ts'
import { mountain } from '../src/game/isles/mountain.ts'
import { snow } from '../src/game/isles/snow.ts'
import { swamp } from '../src/game/isles/swamp.ts'
import { newland, volcano } from '../src/game/isles/volcano.ts'

const isles = [island, meadow, snow, mountain, swamp, beach, volcano, newland, garden, islet]
const owner = new Map<number, string>()
for (const isle of isles) {
  const wide = isle.rows[0].length
  isle.rows.forEach((row, j) => {
    assert.equal(row.length, wide, `${isle.name}: row ${j} is ${row.length} wide, the first is ${wide}`)
    if (isle.high?.[j]) assert.equal(isle.high[j].length, wide, `${isle.name}: height row ${j} does not match its map row`)
    ;[...row].forEach((c, i) => {
      if (c === ' ') return
      const x = isle.at[0] + i
      const z = isle.at[1] + j
      assert.ok(x >= 0 && x < W && z >= 0 && z < D, `${isle.name}: tile (${i}, ${j}) is off the grid`)
      assert.ok(!owner.has(x + z * W), `${isle.name} and ${owner.get(x + z * W)} share a tile`)
      owner.set(x + z * W, isle.name)
    })
  })
}
// A tile of sea between any two isles. The new land is the exception: it is the bridge the lava builds.
for (const [tile, name] of owner)
  for (const next of [tile % W < W - 1 ? tile + 1 : -1, tile + W]) {
    const other = owner.get(next)
    assert.ok(!other || other === name || name === 'newland' || other === 'newland', `${name} touches ${other}`)
  }
// An isle may be drawn more than once. Every map of it keeps to the coastline of the first, since the bridges of other isles
// land on it (so the checks above hold for all of them), and has one of whatever the first has one of: the things to find.
const count = (rows: string[], c: string) => rows.join('').split(c).length - 1
for (const isle of isles)
  for (const [n, map] of (isle.variants ?? []).entries()) {
    assert.equal(map.rows.length, isle.rows.length, `${isle.name}: map ${n + 2} has another number of rows`)
    map.rows.forEach((row, j) => {
      assert.equal(row.length, isle.rows[j].length, `${isle.name}: map ${n + 2}, row ${j} is ${row.length} wide`)
      if (map.high?.[j]) assert.equal(map.high[j].length, row.length, `${isle.name}: map ${n + 2}, height row ${j} does not match its map row`)
      ;[...row].forEach((c, i) => assert.equal(c === ' ', isle.rows[j][i] === ' ', `${isle.name}: map ${n + 2} has another coastline at (${i}, ${j})`))
    })
    for (const c of new Set(isle.rows.join(''))) if (count(isle.rows, c) === 1) assert.equal(count(map.rows, c), 1, `${isle.name}: map ${n + 2} should have one '${c}'`)
  }
// What the story of each isle needs of every one of its maps. The game plays the same on all of them only if these hold.
const RULES: Record<string, (at: (i: number, j: number) => string, find: (c: string) => number[][]) => void> = {
  island: (at, find) => {
    for (const [i, j] of [[5, 0], [1, 3], [0, 9], [15, 9], [8, 15]]) assert.equal(at(i, j), '.', `a bridge lands at (${i}, ${j})`)
    plugged(at, find, 'S', 'B')
    apart(at, find, 'he', 'SBrDp')
    inland(at, find, 'ph')
    const [[i, j]] = find('D')
    assert.equal(at(i, j + 1), '.', 'the beaver stands south of its dam')
    assert.ok('rD'.includes(at(i - 1, j)) && 'rD'.includes(at(i + 1, j)), 'the dam lies across a channel that runs east to west')
    assert.equal(Math.max(...find('r').map(([, row]) => row)), 15, 'the river ends on the south coast, where the beach builds up')
    // The beaver's lodge goes in a corner of the pond that is neither where the water comes in nor where the ducks land.
    const pond = find('p')
    const corner = pond.slice(0, -2).some(([pi, pj]) => SIDES.every(([di, dj]) => at(pi + di, pj + dj) !== 'r') && SIDES.filter(([di, dj]) => at(pi + di, pj + dj) === 'p').length <= 2)
    assert.ok(corner, 'the pond has a corner for the lodge')
  },
  meadow: (at, find) => {
    assert.equal(at(0, 5), 'H', 'the bridge to the island')
    assert.equal(at(4, 0), '.', 'the bridge from the mountain lands at (4, 0)')
    plugged(at, find, 'S', 'K')
    const [[i, j]] = find('K')
    assert.ok(at(i + 1, j) === '.' && at(i + 2, j) === '.', 'the tortoise walks off over two tiles of ground to the east')
    roomy(at, find)
  },
  snow: (at, find) => {
    assert.equal(at(5, 7), 'J', 'the ice bridge to the island')
    apart(at, find, 'i', 'Yyh')
    inland(at, find, 'ih')
    const [[i, j]] = find('L')
    assert.equal(at(i - 1, j), 'i', 'the slide goes down into the pond to its west')
  },
  mountain: (at, find) => {
    assert.equal(at(7, 0), 'v', 'the cave in the north face')
    assert.equal(at(8, 11), 'H', 'the bridge to the meadow')
    plugged(at, find, 'a', 'Q')
    apart(at, find, 'k', 'aQc')
    inland(at, find, 'ak')
    const [[i, j]] = find('m')
    assert.equal(at(i + 1, j), '.', 'the mole ends up east of its hill')
    // Bare ground all the way from the snowball to the ice.
    const [[ui, uj]] = find('U')
    const [[qi, qj]] = find('Q')
    const steps = Math.max(Math.abs(qi - ui), Math.abs(qj - uj))
    for (let k = 1; k < steps; k++) assert.equal(at(ui + Math.round(((qi - ui) * k) / steps), uj + Math.round(((qj - uj) * k) / steps)), '.', 'the snowball rolls over bare ground')
  },
  swamp: (at, find) => {
    assert.equal(at(8, 5), 'H', 'the bridge to the island')
    inland(at, find, 'gf')
  },
  beach: (at, find) => {
    assert.equal(at(7, 0), 'J', 'the stepping stones to the island')
    for (const [i, j] of [[0, 3], [12, 3], [12, 4]]) assert.equal(at(i, j), '.', `bare sand at (${i}, ${j})`)
    inland(at, find, 'l')
    // The lagoon is all in one piece: the tide fills it from one end.
    const lagoon = find('l')
    const reached = new Set([lagoon[0].join()])
    for (let grew = true; grew; ) {
      grew = false
      for (const [i, j] of lagoon)
        if (!reached.has([i, j].join()) && SIDES.some(([di, dj]) => reached.has([i + di, j + dj].join()))) {
          reached.add([i, j].join())
          grew = true
        }
    }
    assert.equal(reached.size, lagoon.length, 'the lagoon is in one piece')
  },
  volcano: (at, find) => assert.ok(find('v').some(([i]) => i === 0), 'the lava reaches the west coast'),
  garden: (at, find) => {
    assert.equal(at(5, 5), 'H', 'the bridge to the island')
    const [[i, j]] = find('h')
    assert.equal(at(i, j + 1), '.', 'the door of the coop opens to the south')
  },
  islet: (at) => assert.equal(at(4, 1), '.', 'the stones from the beach arrive at (4, 1)'),
}
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]]
type At = (i: number, j: number) => string
type Find = (c: string) => number[][]
/** The only way out of the water that is there from the start is through its plug. */
function plugged(at: At, find: Find, water: string, plug: string) {
  for (const [i, j] of find(water)) for (const [di, dj] of SIDES) assert.ok(!beds.includes(at(i + di, j + dj)) || (water + plug).includes(at(i + di, j + dj)), `'${water}' at (${i}, ${j}) leaks past '${plug}'`)
}
/** Two lots of water that are not to meet. */
function apart(at: At, find: Find, one: string, other: string) {
  for (const c of one) for (const [i, j] of find(c)) for (const [di, dj] of SIDES) assert.ok(!other.includes(at(i + di, j + dj)), `'${c}' at (${i}, ${j}) touches '${at(i + di, j + dj)}'`)
}
/** Nothing that stands up into the sails of a windmill beside it or right in front of it. And no tree within two tiles of the old tree, which is big enough to grow into it. */
function roomy(at: At, find: Find) {
  for (const [i, j] of find('X')) for (const [di, dj] of [[-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) assert.ok(!'TNIO'.includes(at(i + di, j + dj)), `'${at(i + di, j + dj)}' stands in the sails of the windmill`)
  for (const [i, j] of find('O')) for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) assert.notEqual(at(i + di, j + dj), 'T', `a tree at (${i + di}, ${j + dj}) stands within two tiles of the old tree`)
}
/** Still water keeps off the coast, or it would pour over the edge. */
function inland(at: At, find: Find, still: string) {
  for (const c of still) for (const [i, j] of find(c)) for (const [di, dj] of SIDES) assert.notEqual(at(i + di, j + dj), ' ', `'${c}' at (${i}, ${j}) is on the coast`)
}
let beds = ''
for (const isle of isles)
  for (const [n, map] of [isle, ...(isle.variants ?? [])].entries()) {
    const at: At = (i, j) => map.rows[j]?.[i] ?? ' '
    const find: Find = (c) => map.rows.flatMap((row, j) => [...row].flatMap((mark, i) => (mark === c ? [[i, j]] : [])))
    beds = isle.beds
    try {
      RULES[isle.name]?.(at, find)
      roomy(at, find)
    } catch (error) {
      throw new Error(`${isle.name}, map ${n + 1}: ${(error as Error).message}`, { cause: error })
    }
  }
// Dealing an isle anew from a seed picks one of its maps and moves its loose things about, and nothing else: the same things,
// on the same places, with everything that is not loose where it was. And the same seed always deals the same isle.
const sorted = (rows: string[]) => [...rows.join('')].sort().join('')
for (const isle of isles)
  for (let seed = 0; seed < 300; seed++) {
    const map = drawn(isle, seed).rows
    const rows = deal(isle, seed)
    assert.deepEqual(rows, deal(isle, seed), `${isle.name}: seed ${seed} deals differently the second time`)
    assert.equal(sorted(rows), sorted(map), `${isle.name}: seed ${seed} lost or gained something`)
    rows.forEach((row, j) =>
      [...row].forEach((c, i) => {
        const was = map[j][i]
        assert.ok(c === was || (isle.loose?.includes(c) && isle.loose.includes(was)), `${isle.name}: seed ${seed} moved '${was}' at (${i}, ${j}), which is not loose`)
      }),
    )
    if (!seed) assert.deepEqual(rows, isle.rows, `${isle.name}: seed 0 is the map as drawn`)
    roomy(
      (i, j) => rows[j]?.[i] ?? ' ',
      (c) => rows.flatMap((row, j) => [...row].flatMap((mark, i) => (mark === c ? [[i, j]] : []))),
    )
  }
assert.notDeepEqual(deal(island, 7), island.rows, 'a seed should deal the island differently')
const dealt = new Set(Array.from({ length: 20 }, (_, seed) => drawn(island, seed + 1).rows))
assert.equal(dealt.size, 1 + (island.variants?.length ?? 0), 'every map of the island should turn up among the first twenty seeds')
console.log('isles: ok')
