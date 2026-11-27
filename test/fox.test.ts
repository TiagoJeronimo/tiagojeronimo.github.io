// The fox of the island, and what came with her: her nest on the rim of the first island, the click that wakes her,
// where she may go and where not, that she is never inside anybody else; and the stones to the islet, which are not to
// stand in a high tide, and the storm cloud over the lighthouse, which is a thing of its own.
// Run with: node test/fox.test.ts          two games, as part of `npm test`
//           node test/fox.test.ts more     six
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Matrix4, Scene, Vector3 } from 'three'

// The game listens for the mouse, asks what kind of screen it is on, and sets a colour or two on the page. Here there is none of that.
Object.assign(globalThis, {
  matchMedia: () => ({ matches: false }),
  addEventListener() {},
  removeEventListener() {},
  document: { documentElement: { style: { setProperty() {}, removeProperty() {} }, toggleAttribute() {}, removeAttribute() {} }, body: { style: {} }, querySelector: () => null },
})
// Chance is the same on every run: the games played here are the same games each time, so that what fails, fails
// again (`FOX_RANDOM=7 node test/fox.test.ts` plays another set).
let chance = Number(process.env.FOX_RANDOM ?? 1) >>> 0
Math.random = () => {
  chance = (chance + 0x6d2b79f5) >>> 0
  let t = Math.imul(chance ^ (chance >>> 15), 1 | chance)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const { ISLES, Island } = await import('../src/games/island/Island.ts')
const { W, tileAt, tx, tz } = await import('../src/games/island/grid.ts')
const { island } = await import('../src/games/island/isles/island.ts')

interface Critter { key?: string; arc: number; pet: number;  x: number; y: number; z: number; t: number; nap: number; size: number; hidden?: boolean; thing?: number; next?: unknown; first: number; parts: number[][]; act?: string; friend?: string; rest: number }
interface Thing { tile: number; cubes: number[]; hits?: number; tip?: string; tap?: () => void; play?: () => void; todo?: boolean; key?: string }
interface Game {
  things: Thing[]
  critters: { list: Critter[]; mesh: { getMatrixAt(i: number, m: Matrix4): void } }
  fox: Critter
  friends: { id: string; patted: boolean }[]
  finds: { name?: string }[]
  ways: { a: number; b: number; via: number[][]; open(): boolean }[]
  solid: { on(cube: number): boolean; up(cube: number): boolean }
  standing: number[][]
  found: number
  time: number
  night: boolean
  stuck: boolean
  lastFind: number
  open: boolean[]
  isle: Uint8Array
  mark: string[]
  bed: Uint8Array
  exists: Uint8Array
  h: Float32Array
  memo: Record<string, number>
  index(name: string): number
  advance(dt: number): void
  strike(id: number): boolean
  pat(c: Critter): void
  setNight(on: boolean): void
  raise(name: string): void
  replay(saved: (string | number)[][]): void
  soak(x: number, z: number, within: number): void
  free(tile: number): boolean
  stroll: (c: Critter) => void
  pet(c: Critter): void
  rider?: unknown[]
  heard: string[][]
}
interface Spawner { spawn(kind: string, x: number, y: number, z: number, color?: number): Critter }
const [_a, _b, _v] = [new Matrix4(), new Matrix4(), new Vector3()]
const make = (seed: number) => new Island(new Scene(), {} as Element, () => {}, seed) as unknown as Game
const NEST = island.at[0] + 11 + (island.at[1] + 15) * W
const named = (game: Game, tip: RegExp) => game.things.findIndex((thing) => thing.tip && tip.test(thing.tip))

// --- the nest ---------------------------------------------------------------------------------
// On every island, whichever map it has and however its loose things were dealt: a ledge half a step down on the south
// shore, bare ground beside it to step up onto, and the fox asleep on it. She does not get up by herself.
for (let seed = 0; seed < 40; seed++) {
  const game = make(seed)
  const say = (what: string) => `island ${seed}: ${what}`
  assert.ok(game.exists[NEST] && game.mark[NEST] === 'n', say('no ledge for the nest'))
  assert.equal(game.mark[NEST - 1], '.', say('no bare ground beside the nest'))
  assert.ok(Math.abs(game.h[NEST - 1] - game.h[NEST] - 0.5) < 1e-6, say('the ledge is not half a step down'))
  const { fox } = game
  assert.ok(fox && fox.thing !== undefined && tileAt(fox.x, fox.z) === NEST, say('the fox is not in her nest'))
  if (!seed) {
    // Asleep she is curled up, not standing: her legs are tucked away to nothing, nothing of her is as high as a
    // standing fox's back, and all of her is inside the ring of twigs.
    for (let i = 0; i < 40; i++) game.advance(0.05)
    const boxes = fox.parts.map((_, n) => {
      game.critters.mesh.getMatrixAt(fox.first + n, _a)
      const e = _a.elements
      return [e[12] - fox.x, e[13] - game.h[NEST], e[14] - fox.z, Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10])]
    })
    assert.ok([1, 2, 3, 4].every((n) => boxes[n][4] < 0.01), 'asleep, the fox still has her legs under her: she is standing')
    assert.ok(boxes.every(([, y, , , high]) => y + high / 2 < 0.42), 'asleep, the fox is as tall as she is awake')
    assert.ok(boxes.every(([x, , z, wide, , deep]) => Math.abs(x) + wide / 2 < 0.331 && Math.abs(z) + deep / 2 < 0.331), 'asleep, the fox lies over the twigs of her nest')
  }
  if (seed > 3) continue
  for (let i = 0; i < 1200; i++) game.advance(0.05)
  assert.ok(fox.nap > 0.9 && fox.thing !== undefined && tileAt(fox.x, fox.z) === NEST && fox.t >= 1, say('the fox got up by herself'))
}

// --- she wakes on a click, and is a friend ----------------------------------------------------
{
  const game = make(0)
  for (let i = 0; i < 100; i++) game.advance(0.05)
  const { fox } = game
  const friend = game.friends.find((f) => f.id === 'fox')!
  assert.ok(friend && !friend.patted, 'the fox is no friend, or has had her pat before anybody came')
  // Every friend has a picture on the page: one without brought the whole page down the moment a line was about it.
  const page = readFileSync(new URL('../src/games/island/GamePage.tsx', import.meta.url), 'utf8')
  const faces = page.slice(page.indexOf('const FACES'), page.indexOf('const TABS'))
  for (const { id } of game.friends) assert.ok(faces.includes(`${id}: '`), `the ${id} is a friend with no picture in the journal`)
  const nest = fox.thing!
  assert.match(game.things[nest].tip ?? '', /^A fox, asleep/, 'the nest does not say who is in it')
  game.strike(nest)
  assert.ok(fox.thing === undefined && fox.next && friend.patted && game.memo.fox, 'a click on the fox in her nest did not wake her')
  assert.match(game.things[nest].tip ?? '', /^A nest/, 'the nest still says she is in it')
  let left = false
  for (let i = 0; i < 1200 && !left; i++) {
    game.advance(0.05)
    left = tileAt(fox.x, fox.z) !== NEST
  }
  assert.ok(left && fox.nap < 0.1, 'the fox, awake, never left her nest')
  // And a second knock on the empty nest wakes nobody.
  game.strike(nest)
  assert.ok(!game.things[nest].tap, 'the empty nest still answers a knock')
}
// A game saved before there was a fox: everybody in it had been patted, and that is still everybody. One saved since
// brings her back awake.
{
  const old = make(0)
  old.replay(old.friends.filter((f) => f.id !== 'fox').map((f, k) => [k, 'p', f.id]))
  for (let i = 0; i < 40; i++) old.advance(0.05)
  assert.ok(old.finds.some((find) => find.name?.startsWith('Everybody')), "with everybody but the sleeping fox patted, 'everybody's friend' is not given")
  assert.ok(old.fox.thing !== undefined, 'an old game woke the fox')
  const game = make(0)
  game.replay([[3, 'k', 'island:n0']])
  assert.ok(game.fox.thing === undefined && game.friends.find((f) => f.id === 'fox')!.patted, 'a saved click on the fox did not bring her back awake')
}

// --- where she goes ---------------------------------------------------------------------------
// One box of an animal inside one of another's: any corner, or the middle, of either in the other.
const CORNERS = [-0.49, 0, 0.49].flatMap((x) => [-0.49, 0, 0.49].flatMap((y) => [-0.49, 0, 0.49].map((z) => [x, y, z])))
function clash(game: Game, one: Critter, other: Critter) {
  const { mesh } = game.critters
  for (let i = 0; i < one.parts.length; i++)
    for (let j = 0; j < other.parts.length; j++) {
      mesh.getMatrixAt(one.first + i, _a)
      mesh.getMatrixAt(other.first + j, _b)
      for (const [from, into] of [[_a, _b], [_b, _a]]) {
        if (Math.abs(into.determinant()) < 1e-9) continue
        const back = into.clone().invert().multiply(from)
        if (CORNERS.some(([x, y, z]) => Math.abs(_v.set(x, y, z).applyMatrix4(back).x) < 0.49 && Math.abs(_v.y) < 0.49 && Math.abs(_v.z) < 0.49)) return true
      }
    }
  return false
}
/** A step of the game, and then: the fox stands on open ground of an isle that is up, or is in the air between two such places; and she is in nobody. */
function watched(game: Game, seed: number, seen: Set<number>) {
  const { fox } = game
  game.advance(0.05)
  const say = (what: string) => `island ${seed}, at ${game.time.toFixed(1)} s: ${what}`
  const u = tileAt(fox.x, fox.z)
  const crossing = game.ways.some((way) => way.open() && way.via.some(([x, y, z]) => Math.hypot(x - fox.x, z - fox.z) < 0.05 && Math.abs(y - fox.y) < 0.05))
  if (crossing) assert.ok(fox.rest < 12, say('the fox has stopped on a bridge')) // (a moment to look at something, yes)
  else if (fox.t >= 1) {
    assert.ok(game.exists[u] && game.open[game.isle[u]], say('the fox stands where there is no land'))
    assert.ok(!game.bed[u], say(`the fox stands in a bed (water or lava) on the ${ISLES[game.isle[u]].name}`))
    assert.ok(Math.abs(fox.y - game.h[u]) < 0.1, say('the fox is not on the ground'))
    seen.add(game.isle[u])
  } else assert.ok(fox.y > game.h[NEST] - 0.2, say('the fox is down in the sea'))
  // Nor is any bird in another: one spot, one bird, wherever they come down.
  const birds = game.critters.list.filter((c) => ['bird', 'owl', 'dragon'].includes(c.kind) && !c.hidden && c.size > 0.9 && c.t >= 1)
  for (const one of birds) for (const other of birds) if (one.first < other.first && Math.hypot(one.x - other.x, one.z - other.z) < 0.9 && Math.abs(one.y - other.y) < 0.9) assert.ok(!clash(game, one, other), say(`two birds (${one.friend ?? one.kind}, ${other.friend ?? other.kind}) sit in each other at ${[one.x, one.y, one.z].map((n) => n.toFixed(2))}`))
  // Nor any bunny in another, standing, hopping, leaping over one or landing: one tile, one animal. (Not while one
  // of the two is still swelling from a pat: that wobble makes it a third bigger for a moment, as it does everybody.)
  const bunnies = game.critters.list.filter((c) => c.kind === 'bunny' && !c.hidden && c.size > 0.9 && !c.pet)
  for (const one of bunnies) for (const other of bunnies) if (one.first < other.first && Math.hypot(one.x - other.x, one.z - other.z) < 1.2 && Math.abs(one.y - other.y) < 1.5) assert.ok(!clash(game, one, other), say(`two bunnies are in each other at ${[one.x, one.y, one.z, one.t].map((n) => n.toFixed(2))} and ${[other.x, other.y, other.z, other.t].map((n) => n.toFixed(2))}`))
  for (const other of game.critters.list) {
    if (other === fox || other.key === 'bubble:fox' || other.hidden || other.size < 0.9 || Math.hypot(other.x - fox.x, other.z - fox.z) > 2.2 || Math.abs(other.y - fox.y) > 2) continue
    // (Whoever is in the air just then is not held to it: a bird comes in to land low and flat, as it always has, past
    // whoever is there. Where anybody lands, and where she steps, is what is kept apart.)
    if (other.t < 1 && (['bird', 'owl', 'dragon'].includes(other.kind) || other.y - game.h[tileAt(other.x, other.z)] > 0.1)) continue
    // Nor whoever is still swelling from a pat (a third bigger for a moment, as everybody is), nor a thought bubble
    // that its owner has carried up to her while she stood there: it is her steps that are held to this.
    if (other.pet || (other.kind === 'bubble' && fox.t >= 1)) continue
    assert.ok(!clash(game, fox, other), say(`the fox and a ${other.friend ?? other.kind} are in each other, on the ${ISLES[game.isle[u]]?.name}: she at ${[fox.x, fox.y, fox.z, fox.t].map((n) => n.toFixed(2))}, it at ${[other.x, other.y, other.z, other.t].map((n) => n.toFixed(2))}`))
  }
}
/**
 * In a game that has been played through, with the animals that live in it and by the clicks a player makes (a knock
 * is `strike`, a click on an animal is `pet`): what the animals do with each other does happen.
 */
function real(game: Game, wait: (seconds: number) => void) {
  const list = game.critters.list
  const friend = (id: string) => game.friends.find((f) => f.id === id) as unknown as { granted?: boolean; wish?: string }
  const during = (seconds: number, see: () => void) => {
    for (let i = 0; i < seconds * 20; i++) {
      wait(0.05)
      see()
    }
  }
  if (game.night) game.setNight(false)
  wait(10)
  // The bell: the goat gives a hop, and the marmots, patted, stand up for a look.
  const goat = list.find((c) => c.kind === 'goat')!
  let hopped = false
  game.strike(named(game, /^The bell/))
  during(3, () => (hopped ||= goat.act === 'hop'))
  assert.ok(hopped, 'the bell rang, and the goat did not hop')
  const marmots = list.filter((c) => c.kind === 'marmot' && !c.friend && c.next)
  const stood = new Set<Critter>()
  wait(4)
  const pack = marmots.filter((marmot) => Math.hypot(marmot.x - marmots[0].x, marmot.z - marmots[0].z) < 5).length
  game.pet(marmots[0])
  during(6, () => marmots.forEach((marmot) => marmot.act === 'watch' && stood.add(marmot)))
  assert.ok(stood.size >= Math.min(2, pack), `a marmot was patted, and ${stood.size} of the ${pack} near by stood up for a look`)
  // The tortoise: patted, it has a bunny on its shell within a few seconds, if one is anywhere near.
  const tortoise = list.find((c) => c.kind === 'tortoise' && c.thing === undefined)!
  const near = list.some((c) => c.kind === 'bunny' && c.next && Math.hypot(c.x - tortoise.x, c.z - tortoise.z) < 3)
  game.pet(tortoise)
  for (let i = 0; i < 22 && !game.rider; i++) wait(0.5)
  assert.ok(!near || game.rider, `the tortoise was patted with a bunny near by, and nobody got on: seat ${!!(game as unknown as { seat?: unknown }).seat}, tortoise ${[tortoise.y, tortoise.nap, !!tortoise.next]}, bunnies ${list.filter((c) => c.kind === 'bunny').map((c) => [Math.hypot(c.x - tortoise.x, c.z - tortoise.z).toFixed(1), c.y.toFixed(2), c.t, !!c.next, c.nap.toFixed(1), c.rest.toFixed(1)].join('/'))}`)
  // The frog: a knock is rain on the bog, and when it stops the frog shakes itself dry. And now and then it hops over
  // to its other pad, sits there, and hops back.
  const frog = list.find((c) => c.kind === 'frog')!
  const pad = [tx(game.things[frog.thing!].tile), tz(game.things[frog.thing!].tile)] // its own pad, wherever it is sitting just now
  let [shook, away, back] = [false, false, false]
  // (Its cloud goes first to wherever rain is wanted: a fire, the lava. The third knock at the latest rains on the bog.)
  for (let k = 0; k < 3; k++) {
    game.strike(frog.thing!)
    during(22, () => (shook ||= list.some((c) => c.act === 'shake')))
  }
  during(260, () => {
    const far = Math.hypot(frog.x - pad[0], frog.z - pad[1])
    if (frog.t >= 1 && far > 1.9 && far < 2.9 && Math.abs(frog.y - game.h[tileAt(frog.x, frog.z)] - 0.5) < 1e-6) away = true
    if (away && frog.t >= 1 && far < 0.01) back = true
  })
  assert.ok(shook, 'it rained three times, and nobody under it shook dry')
  assert.ok(away && back, `the frog did not hop to its other pad and back (there: ${away}, back: ${back})`)
  // The firefly: nowhere by day; after dark it is over the water by the frog, a click sends it to the frog, the frog
  // has its wish, and from then on it is never far off. By day it is gone again.
  const light = list.find((c) => c.kind === 'glow')!
  const gap = () => Math.hypot(light.x - frog.x, light.z - frog.z)
  const off = () => Math.hypot(light.x - pad[0], light.z - pad[1]) // from the frog's own pad, wherever the frog has hopped to
  assert.ok(light.hidden, 'the firefly is about by day')
  game.setNight(true)
  let far = 0
  // And it never hangs in the air: whenever it is not on its way somewhere, it is sitting on something.
  const places = game as unknown as { rests: number[][]; perches: number[][] }
  const sits = () => [...places.rests, ...places.perches].some((p) => Math.hypot(p[0] - light.x, p[2] - light.z) < 0.25 && Math.abs(p[1] + 0.11 - light.y) < 0.02)
  let hung = 0
  during(30, () => {
    far = Math.max(far, off())
    if (light.t >= 1 && !sits()) hung++
  })
  assert.ok(hung < 30, `the firefly hung in the air with nothing under it, for ${hung} steps of the game`)
  assert.ok(!light.hidden && far < 3.6 && !friend('frog').granted, `after dark the firefly is not by the frog's water (${far.toFixed(1)} off), or is the frog's already`)
  game.pet(light)
  wait(4)
  for (let i = 0; i < 10 && gap() > 0.4; i++) wait(1) // (the frog may be on its way to its other pad: the firefly goes after it)
  assert.ok(friend('frog').granted && game.memo.frogSong && gap() < 0.4, 'a click on the firefly did not make it the frog\'s night-light')
  far = 0
  let out = 0
  // (A pat sends it off to sit somewhere near, unless it is just then on its way after the frog: so, up to three pats.)
  for (let k = 0; k < 3 && out < 0.5; k++) {
    game.pet(light)
    during(8, () => {
      out = Math.max(out, gap())
      far = Math.max(far, off())
    })
  }
  for (let i = 0; i < 20 && gap() > 0.4; i++) wait(1) // (the frog may have hopped to its other pad meanwhile: the firefly goes after it)
  assert.ok(out > 0.5 && far < 2.9 && gap() < 0.4, `the frog's firefly went ${out.toFixed(2)} from the frog and ${far.toFixed(2)} from its pad, and is ${gap().toFixed(2)} off now`)
  game.setNight(false)
  wait(1)
  assert.ok(light.hidden, 'morning, and the firefly is still there')
  // The crab's oyster: a coconut for the crab (a knock on a palm, once it has let on), and it carries the oyster to the
  // plinth of sand, sets it down there and steps off. Its thanks are said only then.
  const crab = list.find((c) => c.kind === 'crab')!
  const oak = game.things.findIndex((thing) => game.isle[thing.tile] === 0 && (thing as unknown as { perch?: number[]; up?: boolean }).perch && (thing as unknown as { up?: boolean }).up)
  game.strike(oak) // (a branch for the beaver, if it wants one: three wishes at a time is all there are)
  for (let i = 0; i < 40 && !friend('crab').wish; i++) wait(10)
  assert.ok(friend('crab').wish, 'the crab never let on what it wants')
  const said = () => game.heard.some(([line]) => line.startsWith('A coconut for the crab'))
  const palm = game.things.findIndex((thing) => game.isle[thing.tile] === game.index('beach') && (thing as unknown as { perch?: number[]; up?: boolean }).perch && (thing as unknown as { up?: boolean }).up)
  game.strike(palm)
  wait(3.5) // the coconut flies over, the crab cracks it
  const pearl = game.things.find((thing) => thing.key === 'pearl')!
  assert.ok(pearl && game.mark[pearl.tile] === 'P' && Math.abs(game.h[pearl.tile] - 2.5) < 1e-6, 'the oyster is not bound for the plinth of sand')
  for (let i = 0; i < 120 && !pearl.tap; i++) wait(1) // (a long way round the lagoon, on some beaches)
  wait(15) // (its thanks have their turn, or go to the log)
  assert.ok(pearl.tap && said() && friend('crab').granted, `the crab never set its oyster down on the plinth: it is ${(Math.abs(crab.x - tx(pearl.tile)) + Math.abs(crab.z - tz(pearl.tile))).toFixed(1)} tiles off, moving ${crab.t < 1}; tap ${!!pearl.tap}, thanked ${said()}, granted ${friend('crab').granted}`)
  assert.ok(pearl.cubes.every((cube) => (game.solid as unknown as { at(cube: number): number[] }).at(cube)[1] > game.h[pearl.tile] && Math.abs((game.solid as unknown as { at(cube: number): number[] }).at(cube)[0] - tx(pearl.tile)) < 0.3), 'the oyster is not on the plinth')
  assert.ok(tileAt(crab.x, crab.z) !== pearl.tile, 'the crab sits in its oyster')
  // An isle that is whole puts up its flag: every thing on it found, all of it awake, its secrets and its snail. (The
  // snails are not looked for here: they are counted as found.) A click on a flag says its line, which names it.
  ;(game as unknown as { snailOn: boolean[] }).snailOn.fill(true)
  wait(3)
  const flags = game.things.filter((thing) => thing.key?.startsWith('flag:'))
  assert.ok(flags.length >= 1 && flags.every((flag) => `flag:${ISLES[game.isle[flag.tile]].name}` === flag.key && flag.cubes.length === 3), `the isles that are whole have ${flags.length} flags between them, or one stands on another isle`)
  game.strike(game.things.indexOf(flags[0]))
  wait(12)
  assert.ok(game.heard.some(([line]) => / flag\. /.test(line.slice(0, 24))), 'a click on a flag said nothing about a flag')
}
// The lantern of the swamp is lit at night and dark by day: its flame is there, or it is not.
{
  const game = make(0)
  game.raise('swamp')
  for (let i = 0; i < 200; i++) game.advance(0.05)
  const lantern = named(game, /^An unlit lantern/)
  const flame = game.things[lantern].cubes.at(-1)!
  assert.ok(!game.solid.on(flame), 'the lantern burns before it has been lit')
  game.strike(lantern)
  assert.ok(game.night && game.solid.on(flame), 'lit, and no night, or no flame')
  game.strike(lantern)
  assert.ok(!game.night && !game.solid.on(flame), 'day, and the lantern still burns')
  game.strike(lantern)
  assert.ok(game.night && game.solid.on(flame), 'night again, and the lantern is dark')
}
// With only the first island up there is no way off it, and she stays on it: day and night.
{
  const game = make(0)
  game.strike(game.fox.thing!)
  const seen = new Set<number>()
  for (let i = 0; i < 3000; i++) {
    if (i === 1500) game.setNight(true)
    watched(game, 0, seen)
  }
  assert.deepEqual([...seen], [0], 'the fox left the first island with no way off it')
}
// Through whole games, played as the other test plays them: she is woken at the start, and goes about while the world
// comes up round her. She gets off the first island once there is a way, and never stands in water or lava, on an isle
// that is not there, or in anybody.
let crossed = 0
let leaps = 0 // how often a bunny was seen in the middle of a leap over another
const c0 = (game: Game) => game.critters.list.some((c) => c.kind === 'bunny' && c.t < 1 && c.arc >= 1.1)
const GAMES = process.argv[2] ? [0, 9001, 9002, 9003, 9004, 9005] : [0, 9002]
for (const seed of GAMES) {
  const game = make(seed)
  const { fox } = game
  game.strike(fox.thing!)
  const seen = new Set<number>()
  const wait = (seconds: number) => {
    for (let i = 0; i < seconds * 20; i++) watched(game, seed, seen)
  }
  for (let round = 0; round < 14; round++) {
    game.things.forEach((thing, i) => {
      for (let k = 0; k < 4 && game.open[game.isle[thing.tile]] && game.things[i].hits; k++) game.strike(i)
    })
    // And all the while the bunnies are patted (which is leapfrog, when two are near) and the tortoise (which is a ride).
    for (let k = 0; k < 5; k++) {
      wait(5)
      for (const c of game.critters.list) if (!c.hidden && c.next && (c.kind === 'bunny' || (c.kind === 'tortoise' && c.thing === undefined))) game.pet(c)
      if (c0(game)) leaps++
    }
    if (game.open[game.index('swamp')]) for (const c of '12345') game.strike(game.things.findIndex((thing) => game.isle[thing.tile] === game.index('swamp') && game.mark[thing.tile] === c))
    const cactus = game.things.findIndex((thing) => game.isle[thing.tile] === game.index('beach') && thing.todo)
    if (cactus >= 0 && game.open[game.index('beach')]) game.strike(cactus)
    // (The lantern is among what gets knocked on, and turns the day to night. Here it is day, but for three rounds.)
    if (game.night !== (round > 7 && round < 11)) game.setNight(!game.night)
  }
  for (let k = 0; k < 40; k++) {
    wait(5)
    for (const c of game.critters.list) if (!c.hidden && c.next && (c.kind === 'bunny' || (c.kind === 'tortoise' && c.thing === undefined))) game.pet(c)
    if (c0(game)) leaps++
  }
  if (seed === 0) real(game, wait)
  if (seen.size > 1) crossed++
  // Stuck, and patted: she goes and sits by something still to be found, if there is anything (here there is nothing left, and she does not).
  assert.ok(fox.next && fox.thing === undefined, `island ${seed}: the fox stopped going about`)
}
assert.ok(leaps > 0, 'in all those games, with every bunny patted every five seconds, no bunny ever leapt over another')
assert.ok(crossed >= GAMES.length / 2, `the fox got off the first island in only ${crossed} of ${GAMES.length} games`)

// A pat on the fox, awake and with the player not stuck, is a line about her: a different one each time, none twice
// until all have been said.
{
  const game = make(0)
  const { fox } = game
  game.strike(fox.thing!)
  for (let i = 0; i < 200; i++) game.advance(0.05)
  const lines = new Set<string>()
  const said = (game as unknown as { say: (text: string, ...more: unknown[]) => void })
  const say = said.say.bind(game)
  said.say = (text, ...more) => {
    lines.add(text)
    say(text, ...more)
  }
  for (let k = 0; k < 10; k++) {
    ;(game as unknown as { lastFind: number }).lastFind = game.time // (not stuck: that is another matter, below)
    game.pet(fox)
    for (let i = 0; i < 40; i++) game.advance(0.05)
  }
  assert.equal(lines.size, 10, `ten pats on the fox said ${lines.size} different things: ${[...lines].map((line) => line.slice(0, 28))}`)
}
// A pat while the player is stuck: she goes to something still to be found, sits a tile off, and looks at it.
{
  const game = make(0)
  const { fox } = game
  game.strike(fox.thing!)
  for (let i = 0; i < 1300; i++) game.advance(0.05) // more than a minute with nothing found
  assert.ok(game.stuck, 'a minute with nothing found, and the game does not count the player as stuck')
  game.pat(fox)
  let sat = false
  for (let i = 0; i < 1200 && !sat; i++) {
    game.advance(0.05)
    sat = fox.t >= 1 && game.things.some((thing) => thing.hits && Math.max(Math.abs(tx(thing.tile) - fox.x), Math.abs(tz(thing.tile) - fox.z)) < 1.3 && tileAt(fox.x, fox.z) !== thing.tile) && fox.rest > 5
  }
  assert.ok(sat, 'patted by a stuck player, the fox did not go and sit by anything')
  const bubble = game.critters.list.find((c) => c.key === 'bubble:fox')!
  for (let i = 0; i < 400 && bubble.hidden; i++) game.advance(0.05)
  assert.ok(bubble && !bubble.hidden && Math.hypot(bubble.x - fox.x, bubble.z - fox.z) < 1e-6 && bubble.y > fox.y + 0.9, 'sat by it, the fox has no bubble with a question over her')
  for (let i = 0; i < 300; i++) game.advance(0.05)
  assert.ok(game.heard.some(([line]) => line.startsWith('The fox sits down by something you have not found yet')), 'sat by it, and not a word')
  assert.ok(bubble.hidden, 'the fox has moved on, and her question hangs there still')
}

// --- the stones to the islet, and the storm cloud ----------------------------------------------
{
  const game = make(0)
  const wait = (seconds: number) => {
    for (let i = 0; i < seconds * 20; i++) game.advance(0.05)
  }
  for (let round = 0; round < 40 && named(game, /^The shell that calls the tide/) < 0; round++) {
    game.things.forEach((thing, i) => {
      for (let k = 0; k < 4 && game.open[game.isle[thing.tile]] && game.things[i].hits; k++) game.strike(i)
    })
    wait(10)
  }
  const [shell, plug] = [named(game, /^The shell that calls the tide/), named(game, /^A plug/)]
  assert.ok(shell >= 0 && plug >= 0 && game.memo.tide, 'the tide never came in')
  const islet = game.index('islet')
  // The plug is pulled, and the shell blown again before the islet has come up: the stones stay down under the tide.
  game.strike(plug)
  wait(1)
  const stones = game.ways.find((way) => game.isle[way.b] === islet)!
  assert.ok(stones && stones.via.length === 3 && !stones.open(), 'no way over the stones, or one that is open before they are up')
  game.strike(shell)
  wait(12)
  assert.ok(game.memo.tide && game.open[islet], 'the tide did not come back in, or the islet did not come up')
  assert.ok(!stones.open(), 'the stones came up into a high tide')
  // The next low tide shows them, and the way is open; the tide comes in, and it is shut.
  game.strike(plug)
  wait(8)
  assert.ok(!game.memo.tide && stones.open(), 'low tide, and no stones')
  // The cloud over the lighthouse is a thing of its own on the lighthouse's tile: each has its label, and a click on
  // one is not a click on the other.
  const tower = named(game, /^A lighthouse/)
  const cloud = named(game, /^A storm cloud/)
  assert.ok(tower >= 0 && cloud >= 0 && game.things[tower].tile === game.things[cloud].tile, 'the lighthouse and its cloud are not two things on one tile')
  assert.deepEqual(game.standing[game.things[tower].tile], [tower, cloud], 'the tile of the lighthouse does not hold the two of them')
  assert.notEqual(game.things[tower].key, game.things[cloud].key, 'the two go by one name in a saved game')
  assert.equal(game.things[cloud].cubes.length, 5, 'the cloud has not its five lumps')
  wait(3)
  game.strike(cloud) // by day: it pours harder for three seconds, and is then as it was: no smaller, no paler, never dry
  wait(4)
  assert.match(game.things[cloud].tip ?? '', /^A storm cloud\. It rains/, 'a downpour changed what the cloud says it is')
  assert.match(game.things[tower].tip ?? '', /^A lighthouse\. It works nights/, 'a click on the cloud changed the lighthouse')
  assert.ok(game.things[cloud].cubes.every((cube) => Math.abs((game.solid as unknown as { at(cube: number): number[] }).at(cube)[3] - [1.3, 0.95, 0.9, 0.75, 0.7][game.things[cloud].cubes.indexOf(cube)]) < 1e-6), 'the cloud shrank after its downpour')
  // At night a click on the tower puts its lamp out, and the next one lights it; it is lit again at every nightfall.
  game.setNight(true)
  wait(1)
  game.strike(tower)
  assert.match(game.things[tower].tip ?? '', /lamp out/, 'a click at night did not put the lamp out')
  game.strike(tower)
  assert.match(game.things[tower].tip ?? '', /works nights/, 'a second click did not light it again')
  game.strike(tower)
  game.setNight(false)
  game.setNight(true)
  assert.match(game.things[tower].tip ?? '', /works nights/, 'the lamp stayed out over a day')
  // And the fox, if she is over there when the tide comes in, waits: she does not walk back over water.
  game.strike(game.fox.thing!)
  game.setNight(false)
  const seen = new Set<number>()
  game.strike(shell)
  for (let i = 0; i < 2400; i++) watched(game, 0, seen)
  assert.ok(!seen.has(islet), 'the fox got to the islet at high tide')
}

// --- what the other animals do with each other ------------------------------------------------
// Three tiles of open ground in a row on the first island, all at one height, for somebody to be put on.
function row(game: Game) {
  for (let u = 0; u < game.exists.length - 2; u++) if ([u, u + 1, u + 2].every((v) => game.exists[v] && game.isle[v] === 0 && game.free(v) && game.h[v] === game.h[u]) && Math.abs(tx(u + 2) - tx(u)) === 2) return u
  throw new Error('no three tiles of open ground in a row')
}
const put = (game: Game, kind: string, u: number) => Object.assign((game.critters as unknown as Spawner).spawn(kind, tx(u), game.h[u], tz(u), 0xffffff), { next: game.stroll, rest: 99 })
// Leapfrog: a bunny patted with another on the next tile goes over it and lands on the tile beyond; it is never in
// the one underneath on the way, and that one stays where it is. Then the other one cannot (the map ends, or the
// tile beyond is taken), and nothing happens.
{
  const game = make(0)
  for (let i = 0; i < 100; i++) game.advance(0.05)
  const u = row(game)
  const [a, b] = [put(game, 'bunny', u), put(game, 'bunny', u + 1)]
  for (let i = 0; i < 10; i++) game.advance(0.05)
  game.pat(a)
  assert.ok(a.t < 1, 'a pat on a bunny with another beside it, and no leap')
  let top = 0
  while (a.t < 1) {
    game.advance(0.05)
    top = Math.max(top, a.y - game.h[u])
    assert.ok(!clash(game, a, b), 'the bunny that leaps is in the one underneath')
    assert.ok(Math.hypot(b.x - tx(u + 1), b.z - tz(u + 1)) < 1e-6, 'the bunny underneath moved')
  }
  assert.ok(tileAt(a.x, a.z) === u + 2 && Math.abs(a.y - game.h[u + 2]) < 1e-6 && top > 0.8, `the leap did not end on the tile beyond, or was a low one (${top.toFixed(2)})`)
}
// The lookout: a pat on a marmot, and it and the others near by stand up one after another, facing one way.
{
  const game = make(0)
  for (let i = 0; i < 100; i++) game.advance(0.05)
  const u = row(game)
  const pack = [put(game, 'marmot', u), put(game, 'marmot', u + 1), put(game, 'marmot', u + 2)]
  for (let i = 0; i < 10; i++) game.advance(0.05)
  game.pat(pack[1])
  const stood = new Set<Critter>()
  for (let i = 0; i < 80; i++) {
    game.advance(0.05)
    for (const marmot of pack) if (marmot.act === 'watch') stood.add(marmot)
  }
  assert.equal(stood.size, 3, 'a pat on a marmot did not bring all three up for a look')
  assert.ok(pack.every((marmot) => Math.abs((marmot as unknown as { face: number }).face - (pack[1] as unknown as { face: number }).face) < 1e-6), 'the marmots on the lookout face different ways')
}
// The bus: a pat on the tortoise brings the nearest bunny onto its shell; it rides, and gets off onto open ground.
{
  const game = make(0)
  for (let i = 0; i < 100; i++) game.advance(0.05)
  const u = row(game)
  const [tortoise, bunny] = [put(game, 'tortoise', u), put(game, 'bunny', u + 2)]
  for (let i = 0; i < 10; i++) game.advance(0.05)
  game.pat(tortoise)
  for (let i = 0; i < 40; i++) game.advance(0.05)
  assert.ok(Math.hypot(bunny.x - tortoise.x, bunny.z - tortoise.z) < 0.05 && bunny.y - tortoise.y > 0.7 && !bunny.next, 'a pat on the tortoise, and no bunny on its shell')
  assert.ok(!clash(game, bunny, tortoise), 'the bunny sits in the tortoise, not on it')
  for (let i = 0; i < 500; i++) game.advance(0.05)
  assert.ok(bunny.next && Math.abs(bunny.y - game.h[tileAt(bunny.x, bunny.z)]) < 1e-6, 'the bunny never got off the tortoise')
}
// Whoever is rained on shakes dry.
{
  const game = make(0)
  for (let i = 0; i < 100; i++) game.advance(0.05)
  const bunny = put(game, 'bunny', row(game))
  for (let i = 0; i < 10; i++) game.advance(0.05)
  game.soak(bunny.x, bunny.z, 2)
  let shook = false
  for (let i = 0; i < 30; i++) {
    game.advance(0.05)
    shook ||= bunny.act === 'shake'
  }
  assert.ok(shook, 'rained on, and no shake')
}
// At nightfall the chicks hop up onto the arms of the scarecrow, one each, and sleep there: the label says so. In the
// morning they come down onto the ground.
{
  const game = make(0)
  const near = (thing: Thing) => ['island', 'garden'].some((name) => game.isle[thing.tile] === game.index(name))
  const chicks = () => game.critters.list.filter((c) => c.kind === 'chick')
  for (let round = 0; round < 10 && chicks().length < 2; round++) {
    game.things.forEach((thing, i) => {
      for (let k = 0; k < 4 && near(thing) && game.open[game.isle[thing.tile]] && game.things[i].hits; k++) game.strike(i)
    })
    for (let i = 0; i < 200; i++) game.advance(0.05)
  }
  assert.equal(chicks().length, 2, 'no chicks to go to roost')
  for (let i = 0; i < 400; i++) game.advance(0.05) // the garden wakes
  if (game.night) game.setNight(false)
  for (let i = 0; i < 40; i++) game.advance(0.05)
  const scarecrow = game.things[named(game, /^A scarecrow/)]
  for (const c of game.critters.list) if (c.kind === 'bird') c.hidden = true // (a bird asleep on an arm keeps it: here there is none)
  game.setNight(true)
  for (let i = 0; i < 240; i++) game.advance(0.05)
  const [x, top, z] = [tx(scarecrow.tile), game.h[scarecrow.tile], tz(scarecrow.tile)]
  assert.ok(chicks().every((c) => Math.abs(c.y - top - 0.97) < 1e-6 && Math.abs(c.z - z) < 1e-6 && Math.abs(Math.abs(c.x - x) - 0.33) < 1e-6 && c.nap > 0.9), `the chicks are not asleep on the arms of the scarecrow: ${chicks().map((c) => [c.x - x, c.y - top, c.z - z, c.nap].map((n) => n.toFixed(2)))}`)
  assert.ok(Math.abs(chicks()[0].x - chicks()[1].x) > 0.6, 'two chicks on one arm')
  assert.match(scarecrow.tip ?? '', /a chick asleep on each arm/, 'the scarecrow does not say who is on its arms')
  game.setNight(false)
  for (let i = 0; i < 200; i++) game.advance(0.05)
  assert.ok(chicks().every((c) => c.t < 1 || c.y - game.h[tileAt(c.x, c.z)] < 0.5) && chicks().every((c) => tileAt(c.x, c.z) !== scarecrow.tile || c.t < 1), 'morning, and the chicks are still up on the scarecrow')
  assert.doesNotMatch(scarecrow.tip ?? '', /asleep/, 'morning, and the scarecrow still says the chicks are asleep on it')
}
console.log('fox: ok')
