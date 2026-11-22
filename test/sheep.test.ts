// Run with `npm test`. The sheep game without a browser: the same sheep come up every time, and the same seed gives
// the same day; through a whole day and night they stay on level ground, their bodies off the pond, clear of whatever
// stands in the field and out of each other (no two cubes of different sheep overlap, and none sinks into the
// ground); they walk at a hop, the way they look, and never sideways; they graze, drink and sleep; and a bitten tile
// of grass grows back.
import assert from 'node:assert/strict'
import { MESSAGE, NAME, WOOL, fit, tidy } from '../src/games/sheep/dress.ts'
import { FLOCK, type Entry } from '../src/games/sheep/flock.ts'
import { PerspectiveCamera } from 'three'
import { View } from '../src/games/View.ts'
import { HERMIT, REACH, SPAN, Sheep } from '../src/games/sheep/Sheep.ts'

const world = new Sheep()
const twin = new Sheep()
assert.equal(world.ewes.length, FLOCK.length)
const told = (w: Sheep) => w.ewes.map((e) => `${e.x.toFixed(3)} ${e.z.toFixed(3)} ${e.face} ${e.state} ${e.s.toFixed(3)} ${e.nature} ${e.wool}`)
assert.deepEqual(told(world), told(twin), 'the seeds decide it all')
assert.equal(new Set(world.ewes.map((e) => e.nature)).size, 4, 'all four natures turn up')

/** Every cube a sheep has on show, as a box: x0 x1 y0 y1 z0 z1. (The wool of its body is its fifth.) */
const boxes = (i: number) =>
  world.ewes[i].cubes.map((c, k) => {
    const [x, y, z, w, h, d] = world.flock.at(c)
    return world.flock.on(c) ? [x - w / 2, x + w / 2, y - h / 2, y + h / 2, z - d / 2, z + d / 2, k] : []
  }).filter((box) => box.length)
const apart = () => {
  const all = world.ewes.map((_, i) => boxes(i))
  for (let i = 0; i < all.length; i++) {
    const e = world.ewes[i]
    const where = `sheep ${i} (${e.state}) at ${e.x.toFixed(2)} ${e.z.toFixed(2)}`
    for (const b of all[i])
      for (const cx of [b[0], b[1]]) for (const cz of [b[4], b[5]]) {
        const ground = world.height(cx, cz)
        assert.ok(ground > 0 && ground <= 1, `${where}: off level ground`)
        assert.ok(b[2] >= ground - 0.001, `${where}: sunk into the ground, ${b[2].toFixed(3)} < ${ground}`)
        assert.ok(!world.blocked(cx, cz), `${where}: over something that stands in the field`)
        assert.ok(b[6] !== 4 || !world.pond(cx, cz), `${where}: its body over the pond`)
      }
    for (let j = i + 1; j < all.length; j++)
      for (const a of all[i]) for (const b of all[j]) assert.ok(a[1] <= b[0] || b[1] <= a[0] || a[3] <= b[2] || b[3] <= a[2] || a[5] <= b[4] || b[5] <= a[4], `sheep ${i} and ${j} overlap`)
  }
}
apart()

const NEW: Entry[] = [
  { id: 901, seed: 901, name: 'Hat', message: '', date: '2026-11-22', look: { wear: 'hat' } },
  { id: 902, seed: 902, name: 'Bell', message: '', date: '2026-11-22', look: { wool: 2, wear: 'bell' } },
  { id: 903, seed: 903, name: 'Scarf', message: '', date: '2026-11-22' },
]
const seen = new Set<string>()
const from = world.ewes.map((e) => [e.x, e.z])
let [hops, turns, regrown] = [0, 0, false]
for (let step = 0; step < 7200; step++) { // a whole day and night, 360 seconds
  const was = world.ewes.map((e) => [e.x, e.z, e.face])
  world.update(0.05)
  twin.update(0.05)
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
      w.dress({ wear: 'hat' })
      w.dress({ wool: 3, wear: 'scarf' })
      assert.equal(w.guest?.cubes.filter((c) => w.flock.on(c)).length, 13, 'a sheep in a scarf is its own eleven boxes and two more')
      assert.equal(w.drop(), n + 2)
      assert.equal(w.ewes[n + 2].entry.look?.wear, 'scarf')
      w.bring(NEW[1])
      w.dismiss()
      assert.ok(!w.guest && w.ewes.length === n + 3 && w.room(), 'one that is sent away leaves nothing behind')
    }
  if (step % 8 === 0) apart()
  world.ewes.forEach((e, i) => {
    seen.add(e.state)
    if (!was[i]) return // (it came this very step)
    const [dx, dz] = [e.x - was[i][0], e.z - was[i][1]]
    if (e.face !== was[i][2]) {
      turns++
      assert.ok(!dx && !dz && !e.stride, 'a sheep turns standing, between two hops')
    }
    if (!dx && !dz) return
    // Straight ahead, the way it looks (`face` 0 is along, 1 across, 2 and 3 the other way), and not by leaps.
    assert.deepEqual([Math.sign(dx), Math.sign(dz)], [[0, 1], [1, 0], [0, -1], [-1, 0]][e.face], 'a sheep goes the way it looks, never sideways')
    assert.ok(Math.hypot(dx, dz) <= 0.85 * 0.05 + 1e-9, 'and at a calm pace')
    if (e.y > 1.05) hops++
  })
}
assert.deepEqual(told(world), told(twin), 'the same seed, the same day')
for (const state of ['walk', 'eat', 'drink', 'sleep']) assert.ok(seen.has(state), `a sheep was seen to ${state}`)
assert.ok(world.bites > 5, 'they eat the grass')
assert.ok(hops > 500 && turns > 20, 'they go at a hop, and turn')
assert.ok(world.ewes.some((e, i) => Math.hypot(e.x - from[i][0], e.z - from[i][1]) > 3), 'they wander')

// The sheep in the cave is none of the flock: it has cubes of its own, answers a click with a hop, and stays put.
assert.ok(world.ewes.length === FLOCK.length + 3 && world.ewes.every((e) => e.air === 0), 'the three that came are down, and of the flock')
for (const wear of ['hat', 'bell', 'scarf', 'flowers']) assert.ok(world.ewes.some((e) => e.entry.look?.wear === wear), `somebody in the field wears ${wear}`)
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
for (const key of ['w', 'a', 's', 'd', 'q', 'e', '+', '-', 'ArrowUp']) {
  for (const box of [{ tagName: 'INPUT' }, { tagName: 'TEXTAREA' }, { tagName: 'SELECT' }, { tagName: 'DIV', isContentEditable: true }]) assert.ok(!press(key, box), `${key} typed into ${box.tagName} moved the camera`)
  assert.ok(press(key, { tagName: 'BODY' }), `${key} on the page should move the camera`)
}

// What a giver may write: short, plain, and no links. (The server is to run the same function: see `dress.ts`.)
assert.deepEqual(tidy({}), { name: 'a sheep', message: '', look: {} })
assert.deepEqual(tidy({ name: '  Mrs   Pemberton ', message: 'Hello\n there\u200b!', look: { wool: 2, wear: 'bell' } }), { name: 'Mrs Pemberton', message: 'Hello there !', look: { wool: 2, wear: 'bell' } })
assert.equal(tidy({ message: 'see https://evil.example/x?y=1 and www.spam.biz now, or spam.com/buy' }).message, 'see and now, or')
assert.equal(tidy({ message: '<b>Baa.</b> It cost 2.50 and was worth it.' }).message, 'b Baa. /b It cost 2.50 and was worth it.')
assert.equal([...tidy({ name: 'x'.repeat(99), message: '🐑'.repeat(200) }).message].length, MESSAGE)
assert.equal(tidy({ name: 'x'.repeat(99) }).name.length, NAME)
assert.deepEqual(tidy({ name: 7, message: null, look: 'hat' }), { name: 'a sheep', message: '', look: {} })
assert.deepEqual(fit({ wool: WOOL.length, wear: 'crown', more: 1 }), {})
assert.deepEqual(fit({ wool: 1.5 }), {})
console.log('sheep: ok')
