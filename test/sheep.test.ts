// Run with `npm test`. The sheep game without a browser: the same sheep come up every time, and the same seed gives
// the same day; through a whole day and night they stay on level ground, their bodies off the pond, clear of whatever
// stands in the field and out of each other (no two cubes of different sheep overlap, and none sinks into the
// ground); they walk at a hop, the way they look, and never sideways; they graze, drink and sleep; and a bitten tile
// of grass grows back.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { bucket, phrase } from '../src/sound.ts'
import { BLANKETS, BLANKET_NAMES, EXTRAS, MEMORIES, MESSAGE, NAME, REMEMBERS, WOOL, WEARS, allowed, fit, pairs, plan, tidy, worn } from '../src/games/sheep/dress.ts'
import { WORN, AGED, GREY, KEEPSAKES } from '../src/games/sheep/model.ts'
import { CROWD } from '../src/games/sheep/crowd.ts'
import { FLOCK, type Entry } from '../src/games/sheep/flock.ts'
import { PerspectiveCamera } from 'three'
import { View, close, viewing } from '../src/games/View.ts'
import { DOOR, HERMIT, REACH, SPAN, Sheep } from '../src/games/sheep/Sheep.ts'

const world = new Sheep(CROWD)
const twin = new Sheep(CROWD)
assert.equal(world.ewes.length, CROWD.length)
const told = (w: Sheep) => w.ewes.map((e) => `${e.x.toFixed(3)} ${e.z.toFixed(3)} ${e.face} ${e.state} ${e.s.toFixed(3)} ${e.nature} ${e.wool}`)
assert.deepEqual(told(world), told(twin), 'the seeds decide it all')
assert.equal(new Set(world.ewes.map((e) => e.nature)).size, 4, 'all four natures turn up')

/** Every cube a sheep has on show, as a box: x0 x1 y0 y1 z0 z1. (The wool of its body is its fifth.) */
const boxes = (w: Sheep, i: number) =>
  w.ewes[i].cubes.map((c, k) => {
    const [x, y, z, wide, h, d] = w.flock.at(c)
    return w.flock.on(c) ? [x - wide / 2, x + wide / 2, y - h / 2, y + h / 2, z - d / 2, z + d / 2, k] : []
  }).filter((box) => box.length)
/** The boxes of some of the ground's cubes that are on show. */
const shown = (w: Sheep, cubes: number[]) =>
  cubes.filter((c) => w.ground.on(c)).map((c) => {
    const [x, y, z, wide, h, d] = w.ground.at(c)
    return [x - wide / 2, x + wide / 2, y - h / 2, y + h / 2, z - d / 2, z + d / 2]
  })
/** Every cube that is on show of the ducks, of the big grass and of the thought bubbles: no sheep is ever in one. */
const others = (w: Sheep) => shown(w, [...w.ducks, ...w.treats.filter((tuft) => tuft.t >= 0), ...w.thoughts.filter((bubble) => bubble.owner)].flatMap((thing) => thing.cubes))
let thought = 0 // how many thought bubbles were seen at once, at the most
const clear = (a: number[], b: number[]) => a[1] <= b[0] || b[1] <= a[0] || a[3] <= b[2] || b[3] <= a[2] || a[5] <= b[4] || b[5] <= a[4]
const apart = (w: Sheep) => {
  const all = w.ewes.map((_, i) => boxes(w, i))
  const rest = others(w)
  // The thought bubbles: six at the most, each over a sheep that is awake with no duck on it, and no two in each other.
  const up = w.thoughts.filter((bubble) => bubble.owner)
  thought = Math.max(thought, up.length)
  assert.ok(up.every((bubble) => bubble.owner!.state !== 'sleep' && bubble.owner!.rider < 0), 'a bubble over a sleeper, or over one with a duck on it')
  up.forEach((one, i) => up.slice(i + 1).forEach((two) => shown(w, one.cubes).forEach((a) => shown(w, two.cubes).forEach((b) => assert.ok(clear(a, b), 'two thought bubbles in each other')))))
  for (let i = 0; i < all.length; i++) {
    const e = w.ewes[i]
    const where = `sheep ${i} (${e.state}, ${e.goal}) at ${e.x.toFixed(2)} ${e.z.toFixed(2)}`
    for (const b of all[i]) {
      for (const cx of [b[0], b[1]]) for (const cz of [b[4], b[5]]) {
        const ground = w.height(cx, cz)
        assert.ok(ground > 0 && ground <= 1, `${where}: off level ground`)
        assert.ok(b[2] >= ground - 0.001, `${where}: sunk into the ground, ${b[2].toFixed(3)} < ${ground} (box ${b[6]}, face ${e.face}, lie ${e.lie.toFixed(2)}, air ${e.air.toFixed(2)}, y ${e.y.toFixed(2)}, base ${e.base}, box ${b.map((v) => v.toFixed(2))})`)
        assert.ok(!w.blocked(cx, cz), `${where}: over something that stands in the field`)
        assert.ok(b[6] !== 4 || !w.pond(cx, cz), `${where}: its body over the pond`)
      }
      for (const o of rest) assert.ok(clear(b, o), `${where}: in a duck, in the big grass, or in a thought bubble`)
    }
    for (let j = i + 1; j < all.length; j++) {
      // (Two that are three tiles apart have no box in common: a sheep's boxes are all within a tile of it.)
      if (Math.abs(e.x - w.ewes[j].x) > 3 || Math.abs(e.z - w.ewes[j].z) > 3) continue
      for (const a of all[i]) for (const b of all[j]) assert.ok(clear(a, b), `sheep ${i} and ${j} overlap`)
    }
  }
}
apart(world)

const NEW: Entry[] = [
  { id: 901, seed: 901, name: 'Hat', message: '', date: '2026-11-22', look: { items: ['hat'] } },
  { id: 902, seed: 902, name: 'Bell', message: '', date: '2026-11-22', look: { wool: 2, items: ['bell'] } },
  { id: 903, seed: 903, name: 'Scarf', message: '', date: '2026-11-22' },
]
/** A tile of level ground (or, if asked, of higher) near (x, z), not too near, where a tuft of big grass can go; or null. The same answer for the same world. */
const patch = (w: Sheep, x: number, z: number, least = 2.5, most = 5, high = false) => {
  for (let dz = -5; dz <= 5; dz++)
    for (let dx = -5; dx <= 5; dx++) {
      const far = Math.hypot(dx, dz)
      if (far >= least && far <= most && w.height(Math.round(x) + dx, Math.round(z) + dz) > 1 === high && w.plantable(Math.round(x) + dx, Math.round(z) + dz)) return [Math.round(x) + dx, Math.round(z) + dz]
    }
  return null
}
/**
 * Somebody plants grass as the day goes: a tuft every fifteen seconds or so near one sheep or another, now and then three
 * in a row a few steps apart (a trail), and at night one right beside a sleeper. Always the same for the same world.
 */
const sow = (w: Sheep, step: number) => {
  const turn = Math.floor(step / 300)
  const row = turn % 4 === 0 ? [0, 8, 16] : [0]
  if (step < 100 || !row.includes(step % 300)) return
  const sleeper = w.ewes.find((e) => e.state === 'sleep' && e.lie > 0.9)
  if (w.dark > 0.8 && !(sleeper && turn % 2)) return // (by night only the one beside a sleeper: the rest are let sleep)
  const e = w.ewes[(turn * 7) % w.ewes.length]
  const at = sleeper && turn % 2 ? patch(w, sleeper.x, sleeper.z, 1.9, 2.3) : patch(w, e.x + (step % 300) / 4, e.z)
  if (at) w.plant(at[0], 1.1, at[1], step * 0.05)
}
const seen = new Set<string>()
const from = world.ewes.map((e) => [e.x, e.z])
let [hops, turns, regrown] = [0, 0, false]
for (let step = 0; step < 3600; step++) { // a whole day and night, 180 seconds
  const was = world.ewes.map((e) => [e.x, e.z, e.face, e.rush, e.over ? 1 : 0, e.goal === 'back' ? 1 : 0])
  world.update(0.05)
  twin.update(0.05)
  sow(world, step)
  sow(twin, step)
  // Part of the way through the day three more sheep come, dressed: one straight into the field, one let go over the
  // middle of the pond (where no sheep can stand: it lands on the nearest grass), one dressed twice and then let go.
  if (step === 1500)
    for (const w of [world, twin]) {
      const n = w.ewes.length
      assert.equal(w.add(NEW[0]), n, 'one more sheep is one more in the list')
      assert.ok(w.bring(NEW[1], -4.5, 5) && w.guest && !w.ewes.includes(w.guest), 'a sheep that hangs is not of the flock yet')
      assert.equal(w.drop(-4.5, 5), n + 1)
      const landed = w.ewes[n + 1]
      assert.ok(!w.guest && !w.pond(landed.x, landed.z) && w.height(landed.x, landed.z) === 1 && Math.hypot(landed.x + 4.5, landed.z - 5) < 5, 'let go over the pond, it lands on the nearest grass')
      assert.ok(landed.air > 0 && landed.cubes.every((c) => w.pick(c) === n + 1), 'and falls to it, and is the flock\'s to click')
      w.bring(NEW[2], 20, 20)
      w.dress({ items: ['hat'] })
      w.dress({ wool: 3, items: ['scarf'] })
      assert.equal(w.guest?.cubes.filter((c) => w.flock.on(c)).length, 13, 'a sheep in a scarf is its own eleven boxes and two more')
      assert.equal(w.drop(), n + 2)
      assert.deepEqual(w.ewes[n + 2].entry.look?.items, ['scarf'])
      w.bring(NEW[1])
      w.dismiss()
      assert.ok(!w.guest && w.ewes.length === n + 3 && w.room(), 'one that is sent away leaves nothing behind')
    }
  if (step !== 1500 && (step % 8 === 0 || world.ewes.some((e) => e.over))) apart(world) // (every step, while a sheep is in the air over another; not the step the three came in, which are not drawn until the next)
  world.ewes.forEach((e, i) => {
    seen.add(e.state)
    if (!was[i] || was[i][4] || e.over) return // (it came this very step; or it is in the air over another, which is its own test)
    const [dx, dz] = [e.x - was[i][0], e.z - was[i][1]]
    if (e.face !== was[i][2]) {
      turns++
      assert.ok(!dx && !dz && !e.stride, 'a sheep turns standing, between two hops')
    }
    if (!dx && !dz) return
    // Straight ahead, the way it looks (`face` 0 is along, 1 across, 2 and 3 the other way), and not by leaps.
    // (Or straight back, half a tile at the most, when it is hemmed in and making itself room: never sideways.)
    const way = [[0, 1], [1, 0], [0, -1], [-1, 0]][e.face]
    assert.deepEqual([Math.sign(dx), Math.sign(dz)], e.goal === 'back' || was[i][5] ? way.map((v) => -v || 0) : way, 'a sheep goes the way it looks, never sideways')
    assert.ok(Math.hypot(dx, dz) <= 0.85 * (was[i][3] > 1 || e.rush > 1 ? 1.9 : 1) * 0.05 + 1e-9, 'and at a calm pace, unless it is running')
    if (e.y > 1.05) hops++
  })
}
assert.deepEqual(told(world), told(twin), 'the same seed, the same day')
assert.deepEqual(world.did, twin.did, 'and the same things happen in it')
for (const state of ['walk', 'eat', 'drink', 'sleep']) assert.ok(seen.has(state), `a sheep was seen to ${state}`)
assert.ok(world.bites > 5, 'they eat the grass')
assert.ok(hops > 500 && turns > 20, 'they go at a hop, and turn')
assert.ok(world.ewes.some((e, i) => Math.hypot(e.x - from[i][0], e.z - from[i][1]) > 3), 'they wander')

// The sheep in the cave is none of the flock: it has cubes of its own, answers a click with a hop, and stays put.
assert.ok(world.ewes.length === CROWD.length + 3 && world.ewes.every((e) => e.air === 0), 'the three that came are down, and of the flock')
for (const wear of ['hat', 'bell', 'scarf', 'flowers']) assert.ok(world.ewes.some((e) => e.entry.look?.items?.includes(wear as 'hat')), `somebody in the field wears ${wear}`)
const { hermit } = world
assert.ok(!world.ewes.includes(hermit) && hermit.cubes.every((c) => world.pick(c) === HERMIT), 'the one in the cave is not of the flock')
assert.ok(world.ewes.every((e, i) => e.cubes.every((c) => world.pick(c) === i)), 'and a click on any other finds its place in the list')
const home = [hermit.x, hermit.z]
world.glad(HERMIT)
world.update(0.05)
assert.ok(hermit.y > hermit.base && hermit.y < hermit.base + 0.6 && hermit.x === home[0] && hermit.z === home[1], 'it hops where it is, under its roof')

// Grass: on a field with no sheep, a tile that is bitten is short, and is long again in time.
const empty = new Sheep([])
let spot = [0, 0]
for (let z = 0; z < REACH; z++) for (let x = 0; x < REACH; x++) if (empty.long(x, z)) spot = [x, z]
const [x, z] = spot
assert.ok(empty.long(x, z))
assert.ok(empty.bite(x, z))
assert.ok(!empty.long(x, z) && !empty.bite(x, z), 'a bitten tile is short')
for (let i = 0; i < 70 * 20; i++) {
  empty.update(0.05)
  regrown ||= empty.long(x, z)
}
assert.ok(regrown && empty.long(x, z), 'and it grows back')

// Life in the field, on other days (other seeds): play, big grass, ducks and all, and still no cube in another. Over
// the days everything that can happen does. And a sheep that is in the middle of a game can be clicked, and a new
// sheep dressed and put down beside it, and the game goes on.
const did: Record<string, number> = { ...world.did }
let met = 0
for (const seed of [2, 3, 4, 5]) {
  const field = new Sheep(CROWD, seed)
  let slept = 0
  const flying = new Set<object>() // the sheep that were in the air over another at the last step
  for (let step = 0; step < 3600; step++) {
    field.update(0.05)
    sow(field, step)
    const leaper = field.ewes.find((e) => e.over)
    if (step % 12 === 0 || leaper) apart(field) // (every step, while a sheep is in the air over another)
    // A leap: the one underneath stays as it is; the leaper is not in it at any step (that is `apart`), comes down
    // where it fits, and can be clicked on the way, and a new sheep put down beside it.
    if (leaper) {
      const o = leaper.over!
      assert.ok(o.rider < 0 && o.state !== 'sleep' && o.state !== 'walk' && !o.over, 'a sheep is leapt over that should not be')
      if (step % 7 === 0) field.glad(field.ewes.indexOf(leaper))
      if (step % 40 === 3 && field.room() && field.bring({ ...NEW[2], id: 990 + step, seed: 990 + step }, leaper.x, leaper.z)) {
        assert.ok(field.drop() >= 0)
        field.update(0.05)
        apart(field)
      }
    }
    for (const e of field.ewes) {
      if (flying.has(e) && !e.over) assert.ok(field.fits(e, e.s, e.face, e.x, e.z), 'a sheep came down from a leap where it does not fit')
      if (e.over) flying.add(e)
      else flying.delete(e)
    }
    const player = field.ewes.findIndex((e) => e.mate && e.state === 'walk')
    if (player >= 0 && step % 400 === 7 && field.room()) {
      const { mate } = field.ewes[player]
      field.glad(player)
      assert.ok(field.ewes[player].hop > 0 && field.ewes[player].mate === mate, 'a sheep at play hops when it is clicked, and plays on')
      const by = patch(field, field.ewes[player].x, field.ewes[player].z, 1.5)
      field.update(0.4) // (long enough since the last tuft for another)
      assert.ok(!by || field.plant(by[0], 1.1, by[1], 1e6 + step) >= 0, 'a tuft can be planted beside two that are playing')
      assert.ok(field.bring({ ...NEW[1], id: 950 + met, seed: 950 + met }, field.ewes[player].x, field.ewes[player].z))
      field.update(0.4)
      const under = field.plant(field.guest!.x, 1.1, field.guest!.z, 2e6 + step)
      assert.ok(under >= 0 && !field.plantable(field.guest!.x, field.guest!.z), 'and one aimed at where a new sheep is about to come down goes beside that, not under it')
      field.dress({ items: ['hat'] })
      assert.ok(field.drop() >= 0, 'and a new sheep can be put down beside it')
      field.update(0.05)
      apart(field)
      met++
    }
    for (const e of field.ewes) assert.ok(!e.mate || e.mate.mate === e, 'two that play are each the other\'s')
    slept += field.ewes.filter((e) => e.state === 'sleep').length * 0.05
  }
  for (const what in field.did) did[what] += field.did[what]
  const night = slept / field.ewes.length
  assert.ok(night > 12 && night < 35, `a sheep sleeps for up to half a minute of the day (less, woken for grass), not ${night.toFixed(0)} s`)
  assert.ok(field.ewes.every((e) => !e.mate || e.mate.mate === e) && field.ducks.every((duck) => (duck.state === 'ride') === !!duck.on || duck.state === 'fly'), 'nothing is left half done')
}
assert.ok(met > 0, 'a sheep was caught at play')
assert.ok(thought > 1 && thought <= 6, `thought bubbles come up, a few at a time: ${thought} at the most`)
assert.ok(did.leap >= 5 && did.leap <= 5 * 40, `sheep leap over each other now and then, and not all day: ${did.leap} times in five days`)
for (const what in did) assert.ok(did[what] > 0 || what === 'gaze' /* (its own test is below: that takes a tuft up a slope) */, `over five days nobody was seen to ${what}: ${JSON.stringify(did)}`)

// The light of a day never jumps: from one step to the next the sun, the soft light, the sky and the height of the sun
// change by very little, all the way round through dusk, night and dawn, and on over the end of one day into the
// next: the day ends as it began. The night is dark, and the day bright. And a world that begins part of the way
// through a day (a page loaded again) has the light of that time of day, and not noon's.
{
  const day = new Sheep([])
  const light = (w: Sheep) => [w['sun'].intensity, w['glow'].intensity, w.sky.r, w.sky.g, w.sky.b, w['sun'].color.r, w['sun'].color.g, w['sun'].color.b, w['sun'].position.y / 30, w.dark]
  let [was, least, most, jump] = [light(day), 9, 0, 0]
  for (let step = 0; step < 2 * 3600 + 200; step++) {
    day.update(0.05)
    const now = light(day)
    now.forEach((value, k) => {
      jump = Math.max(jump, Math.abs(value - was[k]))
      assert.ok(Math.abs(value - was[k]) < 0.006, `the light jumped at ${(step / 20).toFixed(1)} s: ${was[k]} to ${value}`)
    })
    was = now
    least = Math.min(least, now[0])
    most = Math.max(most, now[0])
    if (step === 3599) light(new Sheep([])).forEach((value, k) => assert.ok(Math.abs(value - now[k]) < 0.006, 'the day ends in the light it began in'))
  }
  assert.ok(least <= 1.05 && most >= 2.7 && most <= 2.8, 'a dark night, and a day that is bright but never glaring')
  const late = new Sheep([], 1, 90)
  const there = new Sheep([])
  for (let i = 0; i < 1800; i++) there.update(0.05)
  light(late).forEach((value, k) => assert.ok(Math.abs(value - light(there)[k]) < 0.01, 'a world that begins at midnight is as dark as midnight'))
  assert.ok(late.dark > 0.95)
}

// Planting: only on level grass with nothing and nobody on it; not twice in a blink; five at the most, and then the
// oldest goes; the eighth is golden.
{
  const lone = new Sheep([CROWD[0]])
  const sheep = lone.ewes[0]
  let tree = [0, 0]
  for (let z = -REACH; z <= REACH; z++) for (let x = -REACH; x <= REACH; x++) if (lone.blocked(x, z) && lone.height(x, z) === 1 && !lone.pond(x, z)) tree = [x, z]
  const wait = () => {
    for (let i = 0; i < 9; i++) lone.update(0.05)
  }
  let clock = 100
  const golden: boolean[] = [] // whether each tuft planted here, in turn, was a golden one
  const free = patch(lone, sheep.x + 9, sheep.z, 0, 9)!
  // A click on something that cannot take grass plants on the nearest tile that can: never under the sheep, never in
  // the water, never on the tree. Only out at sea, with nothing near, is there a no.
  for (const [what, x, y, z] of [['the pond', -4, 0.94, 5], ['the cave', 0, 2.1, -13], ['a tree', tree[0], 1.1, tree[1]], ['a sheep', sheep.x, 1.1, sheep.z], ['the side of a bank', free[0], 2.5, free[1]]] as const) {
    const k = lone.plant(x, y, z, (clock += 1))
    assert.ok(k >= 0, `a click on ${what} planted nothing`)
    golden.push(lone.treats[k].gold)
    const t = lone.treats[k].t
    const [tx, tz] = [(t % (2 * REACH + 1)) - REACH, Math.floor(t / (2 * REACH + 1)) - REACH]
    assert.ok(Math.hypot(tx - x, tz - z) < 3 && !lone.pond(tx, tz) && !lone.blocked(tx, tz) && lone.height(tx, tz) >= 1, `a click on ${what} planted on ${tx} ${tz}`)
    lone.update(0.05)
    apart(lone)
  }
  assert.equal(lone.plant(40, 0, 40, (clock += 1)), -1, 'grass was planted out at sea')
  for (let i = 0; i < 1400 && lone.treats.some((tuft) => tuft.t >= 0); i++) lone.update(0.05) // (until those have gone)
  const herd = new Sheep(CROWD)
  const near = herd.ewes.map((e) => patch(herd, e.x, e.z, 0, 4, true)).find((at) => at)!
  const k = herd.plant(near[0], herd.height(near[0], near[1]) + 0.1, near[1], 5)
  assert.ok(k >= 0 && herd.height(near[0], near[1]) > 1, 'grass goes on the hillside too')
  herd.update(0.05)
  for (const c of herd.treats[k].cubes) assert.ok(herd.ground.at(c)[1] - herd.ground.at(c)[4] / 2 >= herd.height(near[0], near[1]) - 0.001, 'and stands on it, not in it')
  for (let i = 0; i < 1300 && !herd.did.gaze; i++) herd.update(0.05)
  assert.ok(herd.did.gaze > 0 && herd.did.treat === 0, 'a sheep comes to look at what it cannot reach')
  const first = lone.plant(free[0], 1.1, free[1], (clock += 1))
  assert.ok(first >= 0, 'grass goes on grass')
  golden.push(lone.treats[first].gold)
  assert.equal(lone.plant(free[0] + 1, 1.1, free[1], clock + 0.2), -1, 'but not twice in a blink')
  const again = lone.plant(free[0], 1.1, free[1], (clock += 1))
  assert.ok(again >= 0 && lone.treats.filter((tuft) => tuft.t >= 0).length === 2, 'and a second click on the same tile plants beside it')
  golden.push(lone.treats[again].gold)
  const tiles: number[][] = [free]
  for (let k = 0; k < 7; k++) {
    wait()
    const next = patch(lone, sheep.x + 9, sheep.z, 0, 9)!
    const one = lone.plant(next[0], 1.1, next[1], (clock += 1))
    assert.ok(one >= 0)
    golden.push(lone.treats[one].gold)
    tiles.push(next)
  }
  assert.equal(lone.treats.filter((tuft) => tuft.t >= 0).length, 5, 'five tufts at the most')
  assert.ok(lone.plantable(tiles[0][0], tiles[0][1]) && !lone.plantable(tiles[7][0], tiles[7][1]), 'the oldest has gone, to make room')
  assert.deepEqual(golden.map((gold, k) => (gold ? k : -1)).filter((k) => k >= 0), [6], 'and one in eight is a golden one: here, with this world\'s seed, the seventh')
  const before = lone.did.treat
  for (let i = 0; i < 1200 && lone.did.treat === before; i++) lone.update(0.05)
  assert.ok(lone.did.treat > before, 'a sheep runs for the grass, and eats it')
}

// The door in the mountain is no sheep: its cubes are the ground's and say so. It is locked: a knock rattles it and
// that is all, however often. On it is L (fifty), of two gold boxes that stand proud of the planks, as the knob and the lock do; no box of the door
// is in another, and all of it stands on its step.
{
  const field = new Sheep(CROWD)
  const { door } = field
  const box = (c: number) => {
    const [x, y, z, wide, h, d] = field.ground.at(c)
    return [x - wide / 2, x + wide / 2, y - h / 2, y + h / 2, z - d / 2, z + d / 2]
  }
  assert.ok(door.cubes.length === 11 && door.cubes.every((c) => field.portal(c)) && !field.portal(0) && field.pick(door.cubes[0]) !== DOOR, 'the door\'s cubes are the door\'s, and nobody else\'s')
  for (let knocks = 0; knocks < 3; knocks++) {
    field.glad(DOOR)
    for (let i = 0; i < 60; i++) field.update(0.05)
    assert.ok(door.cubes.every((c) => field.ground.on(c)) && field.latch() === 'a locked door', 'a knock rattles the door, and it stays shut')
  }
  const numerals = door.cubes.slice(9)
  // (The door is three planks side by side, and a stepped top of three more: the first three give its width and its face.)
  const [first, , last] = [0, 1, 2].map((k) => box(door.cubes[k]))
  const planks = [first[0], last[1], first[2], first[3], first[4], first[5]]
  assert.ok(numerals.length === 2 && numerals.every((c) => box(c)[4] >= planks[5] - 1e-4 && box(c)[0] > planks[0] && box(c)[1] < planks[1]), 'the L stands on the planks, proud of them')
  door.cubes.forEach((a, i) => door.cubes.slice(i + 1).forEach((b) => assert.ok(clear(box(a).map((v, k) => v + (k & 1 ? -1e-4 : 1e-4)), box(b)), 'two boxes of the door in each other'))) // (to a hair: they touch)
  for (const c of door.cubes) assert.ok(box(c)[2] >= 2 - 0.001 && field.height(field.ground.at(c)[0], field.ground.at(c)[2]) === 2, 'the door stands on its step')
  assert.ok(field.ewes.every((e) => Math.hypot(e.x - door.x, e.z - door.z) > 1), 'and no sheep is at it')
}

// The very old sheep: a gift of nothing. It is never the checkout and never the stand-in that is kept, with a server
// or without; any other gift is as it was. A look that comes from outside never says a sheep is one (no server keeps
// such a sheep), and has a memory only if it is one there is. In the field she has a beard, a blanket of the colour
// picked and what she remembers, and a wool that is pale and grey whatever was picked; and no box of her is in
// another box of her, whatever she remembers and whatever she is at: standing, hopping, head down, asleep. What is
// for her is not on any other sheep, and what is for the others is not on her.
assert.deepEqual([plan(0, true), plan(0, false), plan(3, true), plan(3, false), plan(0.5, true)], ['elder', 'elder', 'checkout', 'stand-in', 'checkout'])
assert.deepEqual(tidy({ look: { wool: 1, items: ['hat'], elder: true, memory: 'duck' } }).look, { wool: 1, items: ['hat'], memory: 'duck' })
assert.deepEqual(tidy({ look: { memory: 'soul', elder: 1 } }).look, {})
assert.ok(MEMORIES.length >= 5 && MEMORIES.every((memory) => REMEMBERS[memory].startsWith('remembering ') && KEEPSAKES[memory].length && KEEPSAKES[memory].length <= 6), 'every memory has its words and its keepsake')
assert.equal(new Set(BLANKETS).size, WOOL.length, 'as many blankets as wools, no two alike')
assert.ok(new Set(BLANKET_NAMES).size === BLANKETS.length && BLANKET_NAMES.every((name) => /^[a-z]+$/.test(name)), 'and each has a plain name of its own')
{
  // What the card says of her: none of what was taken out, and nothing of why she is the one on offer.
  const page = readFileSync(new URL('../src/games/sheep/SheepPage.tsx', import.meta.url), 'utf8')
  const words = page.slice(page.indexOf('<div className="terms">'), page.indexOf('</div>', page.indexOf('<div className="terms">')))
  assert.ok(words.includes('She is very old.') && words.includes('So that is the offer'), 'the words of the old sheep are where they were looked for')
  assert.ok(!/for nothing|offered|giving|zero|€|free\b|real gift|amounts|walk about|stand near her/i.test(words), 'the card says nothing of a gift of nothing, of what she will do, or of a better gift')
}
{
  const looks = ['', ...MEMORIES].map((memory, k) => ({ id: 800 + k, seed: 800 + k, name: 'x', message: '', date: '', look: { wool: k, elder: true, ...(memory ? { memory } : {}) } })) as Entry[]
  const mixed = [{ id: 820, seed: 820, name: 'x', message: '', date: '', look: { wool: 2, items: ['bell'], elder: true } }, { id: 821, seed: 821, name: 'x', message: '', date: '', look: { wool: 2, items: ['hat'], memory: 'duck' } }] as Entry[]
  const home = new Sheep([...looks, ...mixed, CROWD[0]])
  const aged = home.ewes.slice(0, looks.length)
  const on = (e: (typeof home.ewes)[number]) => e.cubes.filter((c) => home.flock.on(c)).length
  assert.ok(aged.every((e) => e.old && on(e) === 11 + AGED.length + (e.entry.look?.memory ? KEEPSAKES[e.entry.look.memory].length : 0)), 'a very old sheep has a beard, a blanket, and what she remembers')
  assert.ok(aged.every((e, k) => e.wool === GREY && e.wear[7][6] === BLANKETS[k]), 'her wool is grey whatever is picked, and her blanket is of the colour picked')
  const [old, young, plain] = home.ewes.slice(looks.length)
  assert.ok(old.old && on(old) === 11 + AGED.length, 'a very old sheep wears nothing that the others wear')
  assert.ok(!young.old && on(young) === 11 + 2 && young.wool === WOOL[2], 'and a sheep that is not old has no memory on')
  assert.ok(!plain.old && on(plain) === 11, 'nor a beard, nor a blanket')
  const inside = (w: Sheep) => {
    for (const e of w.ewes) {
      const all = boxes(w, w.ewes.indexOf(e))
      all.forEach((a, i) => all.slice(i + 1).forEach((b) => assert.ok(clear(a.map((v, k) => (k < 6 ? v + (k & 1 ? -1e-4 : 1e-4) : v)), b), `two boxes of one sheep in each other (${e.entry.look?.memory ?? e.entry.look?.wear ?? 'bare'}, ${e.state}, box ${a[6]} and ${b[6]})`)))
    }
  }
  for (const [state, time] of [['idle', 10], ['eat', 10], ['sleep', 90]] as const) {
    for (const w of [home]) {
      w.time = time
      for (const e of w.ewes) Object.assign(e, { state, timer: 99, goal: 'wander' })
      for (let i = 0; i < 40; i++) {
        w.update(0.05)
        if (i % 9 === 0) w.ewes.forEach((_, k) => w.glad(k))
        inside(w)
      }
    }
  }
}

// A very old sheep in the field. She goes slowly, never runs, is in no game and under no leap; the others come and
// are with her, and say so with hearts: put in the same place on the same day, an ordinary sheep has much less
// company. Nothing is in anything, at any step; and the same seed is the same day.
{
  const company = (seed: number, elder: boolean) => {
    const field = new Sheep(CROWD, seed)
    const k = field.add({ id: 5, seed: 5 + seed, name: 'x', message: '', date: '', look: elder ? { elder: true } : {} })
    const it = field.ewes[k]
    let [near, fast] = [0, 0]
    for (let step = 0; step < 3600; step++) {
      const [x, z] = [it.x, it.z]
      field.update(0.05)
      if (elder && (step % 12 === 0 || field.ewes.some((e) => e.over))) apart(field)
      if (!it.air) fast = Math.max(fast, Math.hypot(it.x - x, it.z - z) / 0.05)
      for (const e of field.ewes) if (e !== it && Math.hypot(e.x - it.x, e.z - it.z) < 3) near += 1 / 3600
      if (elder) assert.ok(!it.mate && !it.over && it.rush <= 1 && !field.ewes.some((e) => e.over === it), 'a very old sheep is in no game, runs nowhere, leaps nothing, and is not leapt')
    }
    return { field, near, fast }
  }
  const [old, plain] = [company(3, true), company(3, false)]
  // (Company is noisy from one day to the next: it is judged over four days.)
  const days = [7, 8, 9, 10].map((day) => [company(day, true), company(day, false)])
  const mean = (kind: 0 | 1) => days.reduce((sum, day) => sum + day[kind].near, 0) / days.length
  assert.ok(old.fast < 0.85 * 0.35 && old.fast < plain.fast * 0.35, `a very old sheep goes slowly: ${old.fast.toFixed(2)} at her fastest, and ${plain.fast.toFixed(2)} an ordinary one`)
  assert.ok(mean(0) > 2.5 && mean(0) > mean(1) * 1.3, `the others keep a very old sheep company: ${mean(0).toFixed(2)} of them within three tiles of her on average, and ${mean(1).toFixed(2)} of an ordinary one`)
  assert.ok(old.field.fond > 20 && plain.field.fond === 0, 'and show that they are fond of her, and of nobody else in that way')
  assert.deepEqual(told(old.field), told(company(3, true).field), 'and the same seed is the same day, old sheep and all')
}

// A sheep let go falls out of the sky as anything falls: from the same height in the same time, however long a frame is.
const landing = (dt: number) => {
  const field = new Sheep([])
  field.bring(NEW[0])
  const from = field.guest!.air
  field.drop()
  let time = 0
  while (field.ewes[0].air > 0 && time < 5) {
    field.update(dt)
    time += dt
  }
  return [from, time]
}
const [[from60, slow], [, fast]] = [landing(0.05), landing(0.004)]
assert.ok(from60 >= 5.9, `a new sheep hangs high over the grass: ${from60}`)
assert.ok(Math.abs(slow - fast) <= 0.05 && fast > 0.6 && fast < 0.9, `it falls for ${fast.toFixed(2)} s at one frame rate and ${slow.toFixed(2)} s at another`)

// The camera and the boxes of text: a letter typed into a name or a message is not a key of the camera's. (W held on
// the picture moves the view; W typed into an input, a textarea or anything that can be written in does not.)
Object.assign(globalThis, { addEventListener() {}, innerWidth: 1280, innerHeight: 800 })
const view = new View({} as HTMLElement, world.ground.mesh, SPAN, () => {})
const lens = new PerspectiveCamera(30, 1.6, 1, 400)
const press = (key: string, target: object) => {
  const from = [view.pan.x, view.pan.z, view.yaw, view.zoom].join()
  view['onKey']({ type: 'keydown', key, target } as unknown as KeyboardEvent)
  for (let i = 0; i < 10; i++) view.update(0.016, lens, 1280, 800)
  view['onKey']({ type: 'keyup', key, target } as unknown as KeyboardEvent)
  return [view.pan.x, view.pan.z, view.yaw, view.zoom].join() !== from
}
// How close the camera is, which every game's picture goes soft by from close up: nothing with the whole land in the
// picture, all of it right up close, evenly between, by the island's own numbers; and the view on the page says it.
assert.deepEqual([60, 34, 29, 24, 19, 14, 11].map(close), [0, 0, 0.25, 0.5, 0.75, 1, 1])
for (let dist = 11; dist < 60; dist++) assert.ok(close(dist) >= close(dist + 1) && close(dist) === Math.min(1, Math.max(0, (34 - dist) / 20)), 'closer is never less close')
assert.equal(viewing(), view)
view.update(0.016, lens, 1280, 800)
assert.equal(view.near, 0, 'from where the whole field is seen, it is not close at all')
view.zoom = 4
view.update(0.016, lens, 1280, 800)
assert.ok(view.near > 0.99, 'and right in, it is')
view.zoom = 1
view.update(0.016, lens, 1280, 800)
for (const key of ['w', 'a', 's', 'd', 'q', 'e', '+', '-', 'ArrowUp']) {
  for (const box of [{ tagName: 'INPUT' }, { tagName: 'TEXTAREA' }, { tagName: 'SELECT' }, { tagName: 'DIV', isContentEditable: true }]) assert.ok(!press(key, box), `${key} typed into ${box.tagName} moved the camera`)
  assert.ok(press(key, { tagName: 'BODY' }), `${key} on the page should move the camera`)
}

// What a giver may write: short, plain, and no links. (The server is to run the same function: see `dress.ts`.)
assert.deepEqual(tidy({}), { name: 'a sheep', message: '', look: {} })
assert.deepEqual(tidy({ name: '  Mrs   Pemberton ', message: 'Hello\n there\u200b!', look: { wool: 2, items: ['bell'] } }), { name: 'Mrs Pemberton', message: 'Hello there !', look: { wool: 2, items: ['bell'] } })
assert.equal(tidy({ message: 'see https://evil.example/x?y=1 and www.spam.biz now, or spam.com/buy' }).message, 'see and now, or')
assert.equal(tidy({ message: '<b>Baa.</b> It cost 2.50 and was worth it.' }).message, 'b Baa. /b It cost 2.50 and was worth it.')
assert.equal([...tidy({ name: 'x'.repeat(99), message: '🐑'.repeat(200) }).message].length, MESSAGE)
assert.equal(tidy({ name: 'x'.repeat(99) }).name.length, NAME)
assert.deepEqual(tidy({ name: 7, message: null, look: 'hat' }), { name: 'a sheep', message: '', look: {} })
assert.deepEqual(fit({ wool: WOOL.length, items: ['crown'], more: 1 }), {})
assert.deepEqual(fit({ wool: 1.5 }), {})

// What is published has one sheep in it that nobody gave: Claude the sheep, as written (nothing `tidy` would change),
// with a number no given sheep can have. A field of that one sheep goes through a day and a night with nothing going
// wrong: it eats, drinks and sleeps, alone. And a very old sheep put with it has it for company, out of each other.
{
  assert.equal(FLOCK.length, 1)
  const [claude] = FLOCK
  assert.ok(claude.id === 1 && claude.name === 'Claude the sheep' && claude.date === '2026-11-22' && claude.message.length > 20)
  assert.deepEqual(tidy(claude), { name: claude.name, message: claude.message, look: claude.look })
  const alone = new Sheep()
  assert.equal(alone.ewes.length, 1)
  const seen = new Set<string>()
  for (let step = 0; step < 7200; step++) { // (two days: a sheep stands about for longer than it did, and one day is not always a drink)
    alone.update(0.05)
    seen.add(alone.ewes[0].state)
    if (step % 12 === 0) apart(alone)
  }
  assert.ok(['walk', 'eat', 'drink', 'sleep'].every((state) => seen.has(state)), `a sheep alone still walks, eats, drinks and sleeps (${[...seen]})`)
  const pair = new Sheep()
  const old = pair.ewes[pair.add({ id: 5, seed: 9, name: 'x', message: '', date: '', look: { elder: true, memory: 'lamb' } })]
  let near = 0
  for (let step = 0; step < 3600; step++) {
    pair.update(0.05)
    apart(pair)
    if (Math.hypot(pair.ewes[0].x - old.x, pair.ewes[0].z - old.z) < 3) near++
  }
  assert.ok(near > 600 && pair.fond > 3, `the one other sheep keeps a very old one company (${near} steps of 3600 near her, fond ${pair.fond} times)`)
}

// What a bigger gift brings: butterflies about a sheep, or a dog of its own, and only for a sheep whose look says so.
// Through a day and a night in a full field the dogs keep to the rule: on level grass, in no sheep and in nothing
// else (cube against cube, at every step, on the ground, in the air and on a back), near their sheep; they bark, and
// get up on their sheep. The butterflies are in nothing of their sheep's, nor in the thought over it. And the same
// seed is the same day.
{
  const gifts = (): Entry[] => [...CROWD, { id: 900, seed: 900, name: 'x', message: '', date: '', look: { items: ['dog'] } }, { id: 901, seed: 901, name: 'x', message: '', date: '', look: { items: ['dog', 'butterflies'] } }, { id: 902, seed: 902, name: 'x', message: '', date: '', look: { items: ['hat', 'butterflies'] } }, { id: 903, seed: 903, name: 'x', message: '', date: '', look: { elder: true, items: ['dog'] } }]
  const plain = new Sheep(CROWD)
  assert.ok(!plain.dogs.length && !plain.flits.length && plain.pets.count === 0, 'no extras in a field where no look has one')
  const field = new Sheep(gifts(), 4)
  assert.ok(field.dogs.length === 2 && field.flits.length === 2, 'a dog for each look that says so, butterflies for each that says so (one sheep has both), none for a very old sheep')
  const pool = (cubes: number[]) => cubes.filter((c) => field.pets.on(c)).map((c) => {
    const [x, y, z, wide, h, d] = field.pets.at(c)
    return [x - wide / 2, x + wide / 2, y - h / 2, y + h / 2, z - d / 2, z + d / 2]
  })
  const loose = (a: number[], b: number[]) => clear(a.map((v, k) => v + (k & 1 ? -1e-4 : 1e-4)), b)
  let [near, steps] = [0, 0]
  for (let step = 0; step < 3600; step++) {
    field.update(0.05)
    const sheep = field.ewes.map((_, i) => boxes(field, i))
    const things = others(field)
    for (const dog of field.dogs) {
      const mine = pool(dog.cubes)
      if (dog.state === 'away') continue
      mine.forEach((a, i) => mine.slice(i + 1).forEach((b) => assert.ok(loose(a, b), `two boxes of a dog in each other (${dog.state})`)))
      for (const box of mine) {
        assert.ok(box[2] >= 1 - 1e-6, `a dog below the grass (${dog.state})`)
        sheep.forEach((all, i) => all.forEach((b) => assert.ok(loose(box, b), `a dog in sheep ${i} (${dog.state}, step ${step}, box ${b[6]})`)))
        things.forEach((b) => assert.ok(loose(box, b), `a dog in a duck, a tuft or a thought (${dog.state}, step ${step})`))
      }
      for (const other of field.dogs) if (other !== dog) pool(other.cubes).forEach((b) => mine.forEach((a) => assert.ok(loose(a, b), 'two dogs in each other')))
      if (dog.state === 'sit' || dog.state === 'run') assert.ok(field.sits(dog, dog.face, dog.x, dog.z), `a dog where a dog cannot be (${dog.state}, step ${step})`)
      steps++
      if (Math.hypot(dog.x - dog.owner.x, dog.z - dog.owner.z) < 3) near++
    }
    for (const flit of field.flits) {
      const k = field.ewes.indexOf(flit.owner)
      for (const box of pool(flit.cubes)) {
        sheep[k].forEach((b) => assert.ok(loose(box, b), `a butterfly in its sheep (${flit.owner.state}, lie ${flit.owner.lie.toFixed(2)}, air ${flit.owner.air.toFixed(2)}, over ${!!flit.owner.over}, y ${flit.owner.y.toFixed(2)}, box ${b[6]}: ${box.map((v) => v.toFixed(2))} in ${b.slice(0, 6).map((v) => v.toFixed(2))})`))
        shown(field, field.thoughts.filter((bubble) => bubble.owner === flit.owner).flatMap((bubble) => bubble.cubes)).forEach((b) => assert.ok(loose(box, b), 'a butterfly in the thought over its sheep'))
      }
    }
    if (step % 12 === 0 || field.ewes.some((e) => e.over)) apart(field)
  }
  assert.ok(near > steps * 0.8, `a dog keeps near its sheep (${near} of ${steps} steps within three tiles)`)
  assert.ok(field.wuffed > 5 && field.rode > 2, `the dogs bark and get up on their sheep (${field.wuffed} barks, ${field.rode} times up)`)
  const again = new Sheep(gifts(), 4)
  for (let step = 0; step < 3600; step++) again.update(0.05)
  assert.deepEqual(told(field), told(again), 'the same seed is the same day, dogs and all')
  assert.deepEqual(field.dogs.map((dog) => [dog.x, dog.z, dog.state]), again.dogs.map((dog) => [dog.x, dog.z, dog.state]))
}

// Two things at the most, of the six a sheep may have, in any mix: never the same thing twice, never the hat with the
// flowers, and nothing that is not one of the six. A gift allows no extra under 5, the butterflies from 5, the dog
// too from 10. Every pair that may be worn fits in the cubes kept for what a sheep wears, and no box of such a sheep
// is in another, standing, hopping, head down or asleep.
{
  assert.deepEqual([fit({ items: ['hat', 'scarf'] }), fit({ items: ['dog', 'butterflies'] }), fit({ items: ['scarf', 'dog'] })], [{ items: ['hat', 'scarf'] }, { items: ['dog', 'butterflies'] }, { items: ['scarf', 'dog'] }])
  assert.deepEqual([fit({ items: ['hat', 'hat'] }), fit({ items: ['hat', 'flowers'] }), fit({ items: ['flowers', 'hat', 'bell'] }), fit({ items: ['bell', 'scarf', 'dog'] }), fit({ items: ['crown', 'dog'] }), fit({ items: 'dog' }), fit({ items: [] }), fit({ wear: 'hat', extras: ['dog'] })], [{ items: ['hat'] }, { items: ['hat'] }, { items: ['flowers', 'bell'] }, { items: ['bell', 'scarf'] }, { items: ['dog'] }, {}, {}, {}])
  assert.deepEqual([allowed(499), allowed(500), allowed(999), allowed(1000)], [[], ['butterflies'], ['butterflies'], [...EXTRAS]])
  const both = WEARS.flatMap((wear) => WEARS.filter((also) => pairs(wear, also)).map((also) => ({ items: [wear, also] })))
  assert.equal(both.length, 10)
  assert.ok(both.every(({ items: [wear, also] }) => WORN[wear].length + WORN[also].length <= 6), 'two things worn are six boxes at the most')
  const dressed = new Sheep(both.map((look, k) => ({ id: 700 + k, seed: 700 + k, name: 'x', message: '', date: '', look })))
  assert.ok(dressed.ewes.every((e) => e.cubes.filter((c) => dressed.flock.on(c)).length === 11 + worn(e.entry.look).reduce((n, thing) => n + WORN[thing].length, 0)), 'both are on it')
  for (const [state, time] of [['idle', 10], ['eat', 10], ['sleep', 90]] as const) {
    dressed.time = time
    for (const e of dressed.ewes) Object.assign(e, { state, timer: 99, goal: 'wander' })
    for (let i = 0; i < 40; i++) {
      dressed.update(0.05)
      if (i % 9 === 0) dressed.ewes.forEach((_, k) => dressed.glad(k))
      dressed.ewes.forEach((e, n) => {
        const all = boxes(dressed, n)
        all.forEach((a, i) => all.slice(i + 1).forEach((b) => assert.ok(clear(a.map((v, k) => (k < 6 ? v + (k & 1 ? -1e-4 : 1e-4) : v)), b), `two boxes of one sheep in each other (${e.entry.look?.items}, ${state}, box ${a[6]} and ${b[6]})`)))
      })
    }
  }
}

// The sound, as far as it can be heard without ears. The small noises are limited: four at once, three a second
// after that, however many sheep there are. The music box plays the same five notes as everything else, the same
// tune for the same round, and not quite the same tune the next time round. And what a visitor said of the sound the
// last time is taken as said only if it was a yes or a no.
{
  const few = bucket(3, 4)
  let made = 0
  for (let t = 0; t < 10; t += 0.01) if (few(t)) made++ // (a hundred asked for every second, for ten seconds)
  assert.ok(made >= 30 && made <= 35, `the small noises are limited: ${made} in ten seconds`)
  const burst = bucket(3, 4)
  assert.deepEqual([0, 0, 0, 0, 0, 0.1, 0.4].map((t) => burst(t)), [true, true, true, true, false, false, true])
  const rounds = [0, 1, 2, 3, 4, 5].map(phrase)
  assert.ok(rounds.every((tune) => tune.length === 16 && tune.every((step) => Number.isInteger(step) && step >= -1 && step <= 10) && tune.filter((step) => step >= 0).length >= 8), 'a round of the music box is sixteen beats of notes there are, most of them sounded')
  assert.deepEqual(phrase(3), rounds[3])
  assert.ok(new Set(rounds.map((tune) => tune.join())).size >= 4, 'and is not the same every time round')
}
console.log('sheep: ok')
