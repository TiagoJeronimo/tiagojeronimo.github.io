// Run with `npm test`. The castle game without a browser: the land can be walked as it should be; each thing the
// helper can be sent for comes to what it should, three of them on his hat at once; the three things that happen in
// the quiet happen; a day nobody helps with is lost, a day helped with on one side is lost by the other, and somebody
// who plays sensibly, or slowly, gets the two sides as far as a wedding; and the camera, asked to go in on the keep,
// goes to the keep.
import assert from 'node:assert/strict'
import { PerspectiveCamera, Raycaster, Vector2, Vector3 } from 'three'
import { APPLE, BASKET, CAT, Castle, DUCK, FLOWER, HEAP, HEARTH, LOGS, MUSIC, OVEN, PLOT, PRINCE, PRINCESS, REACH, ROCK, SIGHT, TABLE, TREE, WED, type Ask, type Item } from '../src/games/castle/Castle.ts'
import { View } from '../src/games/View.ts'

const N = 2 * REACH + 1
const tile = (x: number, z: number) => x + REACH + (z + REACH) * N
const [across, along] = [(t: number) => (t % N) - REACH, (t: number) => Math.floor(t / N) - REACH]
const FAR = 65535 // no way there
/** So many seconds go by, or the day ends first; `each` is asked before every step. */
const run = (world: Castle, seconds: number, each?: () => void) => {
  for (let i = 0; i < seconds * 20 && !world.over; i++) {
    each?.()
    world.update(0.05)
  }
}
/**
 * The day stands still, so that one thing can be tried at a time: the camp neither sets out nor goes back, and
 * whoever is waiting for something goes on waiting. (Said again after something more has been asked for.)
 */
const hold = (world: Castle) => {
  world.phase.left = 1e9
  for (const ask of world.asks) ask.left = 1e9
}
/** A morning held still from the start, with nobody wanting anything: not even the castle its wood at dawn. */
const still = () => {
  const world = new Castle(1)
  world.start()
  world.asks.length = 0
  hold(world)
  return world
}
/** Whichever of `of` is nearest to the helper. */
const near = <T extends { t: number }>(world: Castle, of: T[]) => of.reduce<T | undefined>((a, b) => (!a || Math.hypot(across(b.t) - world.me.x, along(b.t) - world.me.z) < Math.hypot(across(a.t) - world.me.x, along(a.t) - world.me.z) ? b : a), undefined)
const wants = (world: Castle) => world.asks.map((ask) => `${ask.side ? 'camp' : 'castle'}:${ask.what}`).join(' ')
/**
 * Somebody who plays sensibly. Whatever is wanted that he can get, he gets, soonest wanted first, until his hat is
 * full or somebody he could answer already is nearly out of patience; then he takes it where it is wanted. With
 * nothing he can do for anybody he puts by what he has, sees to the field, and fells a tree or breaks a rock for
 * later. He stops the cat when it is off with a loaf.
 * @param lag how many seconds he stands about between one job and the next
 * @param sides which sides he looks after
 */
const play = (world: Castle, lag = 1, sides = [0, 1]) => {
  const { me, tune, oven, piles } = world
  if (world['thief'] === 'out' && world.cat.x < -4) world.order(CAT)
  if (me.queue.length || me.idle < lag) return
  const haste = (ask: Ask) => (ask.love || ask.still ? 0.45 : ask.left / ask.full)
  const wanted = world.asks.filter((ask) => ask.side > 1 || sides.includes(ask.side)).sort((a, b) => haste(a) - haste(b))
  const far = (x: number, z: number) => Math.hypot(x - me.x, z - me.z)
  if (tune.mode === 'follow') return world.order(wanted.some((ask) => ask.side > 1) ? WED : TABLE)
  if (me.loads.includes('wheat')) return world.order(OVEN)
  const spare: Item[] = [...me.loads]
  const got = wanted.filter((ask) => spare.includes(ask.what as Item) && spare.splice(spare.indexOf(ask.what as Item), 1))
  const open = wanted.filter((ask) => !got.includes(ask))
  const where = (ask: Ask) => (ask.side > 1 ? WED : ask.still ? HEARTH : (ask.love ? [PRINCESS, PRINCE] : [BASKET, TABLE])[ask.side])
  const source = (ask: Ask) => {
    const tree = ask.what === 'wood' && near(world, world.trees.filter((one) => one.grown >= 1 && !one.away))
    if (ask.what === 'wood' && piles.wood && (!tree || far(-11, 5) < far(across(tree.t), along(tree.t)))) return LOGS
    if (tree) return TREE + world.trees.indexOf(tree)
    const rock = ask.what === 'stone' && near(world, world.rocks.filter((one) => !one.away))
    if (ask.what === 'stone' && piles.stone && (!rock || far(-10, 6) < far(across(rock.t), along(rock.t)))) return HEAP
    if (rock) return ROCK + world.rocks.indexOf(rock)
    const bloom = ask.what === 'flower' && near(world, world.flowers.filter((one) => !one.away))
    if (bloom) return FLOWER + world.flowers.indexOf(bloom)
    if (ask.what === 'duck' && world.ducks.some((duck) => !duck.away)) return DUCK
    if (ask.what === 'cat' && !world.cat.away) return CAT
    if (ask.what === 'apple') return APPLE
    if (ask.what === 'soup' && !world.doused) return HEARTH
    if (ask.what === 'bread' && oven.ready) return OVEN
    if (ask.what === 'music' && tune.mode === 'home' && tune.seated) return MUSIC
  }
  // One thing more for his hat, while there is room and nobody he could answer now is near the end of their patience.
  if (me.loads.length < 3 && !got.some((ask) => haste(ask) < 0.3))
    for (const ask of open) {
      const id = source(ask)
      if (id !== undefined) return world.order(id)
    }
  if (got.length) return world.order(where(got[0]))
  // Nothing he can do for anybody just now. What he has that nobody wants is put by; then the field; then something
  // on the rack and the tray for later.
  if (spare.includes('wood') && piles.wood < 4) return world.order(LOGS)
  if (spare.includes('stone') && piles.stone < 4) return world.order(HEAP)
  if (spare.includes('bread') && oven.ready < 3) return world.order(OVEN)
  if (me.loads.length >= 3) return
  const ripe = world.plots.findIndex((plot) => plot.age >= 1)
  if (ripe >= 0 && oven.todo + oven.ready < 3) return world.order(PLOT + ripe)
  const bare = world.plots.findIndex((plot) => plot.age < 0)
  if (bare >= 0) return world.order(PLOT + bare)
  const tree = piles.wood < 3 && near(world, world.trees.filter((one) => one.grown >= 1 && !one.away))
  if (tree) return world.order(TREE + world.trees.indexOf(tree))
  const rock = piles.stone < 2 && near(world, world.rocks.filter((one) => !one.away))
  if (rock) return world.order(ROCK + world.rocks.indexOf(rock))
}
/** A whole day, played that way, for ten minutes at the longest: how it ended, when, and the fewest that either side had on their feet. */
const day = (seed: number, lag?: number, sides?: number[], each?: (world: Castle) => void) => {
  const world = new Castle(seed)
  world.start()
  let least = 6
  run(world, 600, () => {
    if (lag !== undefined) play(world, lag, sides)
    least = Math.min(least, world.standing(0), world.standing(1))
    each?.(world)
  })
  return { world, over: world.over, at: world.time, least }
}

// The land, and what stands on it.
{
  const world = new Castle(1)
  const from = tile(Math.round(world.me.x), Math.round(world.me.z))
  assert.ok(world.solid.count < 9500, `the world is built of ${world.solid.count} cubes: more than there should be any need for`)
  assert.deepEqual([world.trees.length, world.rocks.length, world.plots.length, world.men.length], [16, 7, 4, 12], 'trees, rocks, plots and soldiers: not as many of each as there should be')
  for (const id of [...world.trees.map((_, i) => TREE + i), ...world.rocks.map((_, i) => ROCK + i), ...world.plots.map((_, i) => PLOT + i), ...world.flowers.map((_, i) => FLOWER + i), OVEN, LOGS, HEAP, BASKET, TABLE, HEARTH, MUSIC, CAT, DUCK, APPLE, PRINCESS, PRINCE, WED]) {
    const steps = world['way']({ id, t: world['tile'](id) })[from]
    assert.ok(steps < 70, `the helper cannot get to thing ${id}, or it is ${steps} steps off`)
  }
  // The gate opens for the helper, and for nobody of the camp: they get to the foot of the wall, and no further.
  for (const man of world.men.filter((one) => one.side)) {
    assert.ok(world['route'](man.front)[man.home] < 40, 'one of the camp cannot get from the fire to the wall')
    assert.equal(world['route'](tile(0, -3))[man.home], FAR, 'one of the camp can walk into the yard')
  }
  assert.ok(world['route'](tile(0, -3), true)[from] < 30, 'the helper cannot walk into the yard')
  assert.ok(world['route'](tile(3, -11), true)[from] < 60, 'the stairs from the yard do not lead up to the ward')
  assert.ok(world['route'](tile(-8, -3), true)[from] < 30, 'the stairs up the hill do not lead to the floor under the winch')
  // The bridge over the brook is level with the grass at both its ends, and can be walked across.
  const [west, planks, east] = [5, 6, 7].map((x) => world['stand'][tile(x, 3)])
  assert.ok(west === east && Math.abs(planks - west) < 0.1, `the bridge is at ${planks}, and the ground at its ends at ${west} and ${east}: it leads into a bank`)
  assert.equal(world['route'](tile(7, 3))[tile(5, 3)], 2, 'the bridge cannot be walked across')
}

// Dawn, wood, and the basket. At dawn the castle asks for wood and the day waits for it: no charge, no clock, no
// patience running out, whatever else he is sent to, until he is sent to a tree. Then the camp sets out at once and
// asks for bread. A tree and then the basket: the tree is felled, the wood goes up, nobody has to sit down, and the
// tree comes up again somewhere else.
{
  const world = new Castle(1)
  world.order(BASKET)
  assert.equal(world.me.queue.length, 0, 'with nothing on his hat he was sent to the basket, and went')
  run(world, 120)
  assert.equal(wants(world), 'castle:wood', 'at dawn the castle should want wood, and nobody anything else')
  assert.ok(!world.begun && !world.phase.charge && world.time === 0 && world.asks[0].left === world.asks[0].full, 'the day should stand still until he is sent to a tree')
  const tree = near(world, world.trees)!
  const [first, was] = [world.trees.indexOf(tree), tree.t]
  world.order(TREE + first)
  run(world, 0.1)
  assert.ok(!world.begun && !world.phase.charge, 'sent to a tree, the day should still wait: it starts with the wood at the castle')
  world.order(BASKET)
  let high = 0
  run(world, 26, () => (high = Math.max(high, world['lift'].y)))
  assert.ok(world.begun, 'the wood is at the castle: the day should have started')
  assert.ok(!wants(world).includes('castle:wood'), `the castle still wants its wood: ${wants(world)}`)
  assert.deepEqual(world.me.loads, [], 'the helper still has something on his hat')
  assert.ok(high > 7 && world['lift'].y === 5, `the basket should have gone up the tower and come down again: it got to ${high}, and is at ${world['lift'].y}`)
  assert.equal(world.standing(0), 6, 'somebody of the castle sat down, though it got what it asked for')
  run(world, 16)
  assert.ok(tree.t !== was && !tree.away && tree.grown === 1, 'the tree that was felled should have come up somewhere else, and grown')
}

// Three things on his hat. A log off the rack for the castle, the loaf off the shelf for the camp, and a stone that
// nobody wants: all three ride along, in that order. With no room left, a flower takes the place of the stone, which
// was the one thing there that nobody wanted. With everything on his hat wanted, he fetches nothing more. And then
// one walk to the basket and one to the table answers three askings.
{
  const world = new Castle(1)
  world.start()
  run(world, 9)
  hold(world)
  world.order(LOGS)
  world.order(OVEN)
  world.order(ROCK + world.rocks.indexOf(near(world, world.rocks)!))
  run(world, 30)
  assert.deepEqual(world.me.loads, ['wood', 'bread', 'stone'], 'a log, a loaf and a stone should be on his hat, one on another')
  assert.deepEqual([world.piles.wood, world.oven.ready], [0, 0], 'the log should have come off the rack, and the loaf off the shelf')
  world.order(FLOWER + world.flowers.indexOf(near(world, world.flowers)!))
  run(world, 12)
  assert.deepEqual(world.me.loads, ['wood', 'bread', 'flower'], 'with no room on his hat, the stone nobody wanted should have made way for the flower')
  world['want'](1, 'flower')
  hold(world)
  world.order(ROCK + world.rocks.findIndex((rock) => !rock.away))
  assert.equal(world.me.queue.length, 0, 'with three things on his hat, all of them wanted, he went for a fourth')
  world.order(BASKET)
  world.order(TABLE)
  run(world, 40)
  assert.ok(wants(world) === '' && world.me.loads.length === 0, `three askings should have been met in two walks: ${wants(world)}, with ${world.me.loads} left on his hat`)
  assert.equal(world.standing(0) + world.standing(1), 12, 'somebody sat down, though everything came')
}

// What nobody wants just now is put by at the farm. A tree felled with nobody wanting wood: a click on the rack, and
// the log is on it. With nothing on his hat a click on the rack takes one, and the next puts it back. With two
// wanting wood, two clicks are two logs. And a side takes only what it has asked for: a stone is no use to the camp.
{
  const world = still()
  assert.deepEqual([world.piles.wood, world.piles.stone, world.oven.ready], [1, 1, 1], 'a log, a stone and a loaf should be put by to begin with')
  world.order(TREE + world.trees.indexOf(near(world, world.trees)!))
  world.order(LOGS)
  run(world, 20)
  assert.ok(world.piles.wood === 2 && world.me.loads.length === 0, 'wood that nobody wants should be on the rack, and his hat bare')
  world.order(LOGS)
  run(world, 5)
  assert.ok(world.piles.wood === 1 && world.me.loads.join() === 'wood', 'a click on the rack, with nothing on his hat: a log should be on it')
  world.order(LOGS)
  run(world, 5)
  assert.ok(world.piles.wood === 2 && world.me.loads.length === 0, 'and the next click should put it back')
  world['want'](0, 'wood')
  world['want'](1, 'wood')
  hold(world)
  world.order(LOGS)
  world.order(LOGS)
  world.order(HEAP)
  run(world, 8)
  assert.deepEqual(world.me.loads, ['wood', 'wood', 'stone'], 'two wanting wood, two clicks on the rack and one on the tray: two logs and a stone')
  world.order(TABLE)
  run(world, 20)
  assert.deepEqual(world.me.loads, ['wood', 'stone'], 'the camp should have taken one log, and no stone')
  world.order(BASKET)
  world.order(HEAP)
  run(world, 40)
  assert.ok(world.piles.stone === 1 && world.me.loads.length === 0 && wants(world) === '', 'the other log should have gone up to the castle, and the stone back on the tray')
}

// Bread. A loaf is on the shelf to begin with; after that it is: sow, wait, cut, into the oven, wait, out.
{
  const world = still()
  const bare = world.plots.findIndex((plot) => plot.age < 0)
  world.order(PLOT + bare)
  run(world, 8)
  assert.ok(world.plots[bare].age >= 0 && world.plots[bare].age < 1, 'a bare plot that was seen to should be sown, and growing')
  world['want'](1, 'bread')
  hold(world)
  world.order(OVEN)
  world.order(TABLE)
  run(world, 14)
  assert.ok(world.oven.ready === 0 && wants(world) === '', 'the loaf on the shelf should have gone to the camp, which wanted bread')
  const ripe = world.plots.findIndex((plot) => plot.age >= 1)
  world.order(PLOT + ripe)
  world.order(OVEN)
  run(world, 7)
  assert.ok(world.me.loads.length === 0 && world.oven.todo === 1 && world.plots[ripe].age < 1, 'ripe wheat should be cut, the plot sown again, and the sheaf in the oven')
  run(world, 6)
  assert.equal(world.oven.ready, 1, 'a sheaf in the oven should be a loaf six seconds later')
  world.order(OVEN)
  run(world, 3)
  assert.ok(world.me.loads.join() === 'bread' && world.oven.ready === 0, 'he should have the loaf, and the shelf be bare')
  // And a loaf nobody wants goes back on the shelf.
  world.order(OVEN)
  run(world, 3)
  assert.ok(world.me.loads.length === 0 && world.oven.ready === 1, 'a loaf nobody wants and a click on the oven: the loaf should be back on the shelf')
}

// The silly things. A duck for the castle goes up in the basket, as a duck, and is back on the pond a while later.
// The cat for the camp rides there on his hat, sits on the table, and goes home. And an apple for the camp comes off
// the tree in the castle's yard.
{
  const world = still()
  world['want'](0, 'duck')
  hold(world)
  world.order(DUCK)
  world.order(BASKET)
  let [rode, hat] = [false, false]
  run(world, 40, () => {
    rode ||= world.ducks.some((duck) => duck.ride)
    hat ||= world.me.pets.some((pet) => pet !== world.cat)
  })
  assert.ok(hat && rode && wants(world) === '', 'a duck should have ridden on his hat and then up in the basket, and the castle have its duck')
  run(world, 12)
  assert.ok(world.ducks.every((duck) => !duck.away), 'the duck should be back on the pond')
  world['want'](1, 'cat')
  world['want'](1, 'apple')
  hold(world)
  world.order(CAT)
  world.order(APPLE)
  world.order(TABLE)
  hat = false
  run(world, 40, () => (hat ||= world.me.pets.includes(world.cat) && world.me.loads.join() === 'cat,apple'))
  assert.ok(hat && wants(world) === '', `the cat should have ridden to the camp on his hat, with an apple on top of it: ${wants(world)}`)
  run(world, 12)
  assert.ok(!world.cat.away && world.cat.y > 5, 'the cat should be back on its cask')
}
// Soup for the castle comes out of the pot on the camp's fire. And what the princess asks for is handed to her in
// person, under her balcony: the basket is for the castle's own askings, and will not do.
{
  const world = still()
  world['want'](0, 'soup')
  hold(world)
  world.order(HEARTH)
  world.order(BASKET)
  run(world, 45)
  assert.ok(wants(world) === '' && world.me.loads.length === 0, `soup from the camp's pot should have gone up to the castle: ${wants(world)}`)
  world['want'](0, 'flower', true)
  world.order(FLOWER + world.flowers.indexOf(near(world, world.flowers)!))
  world.order(BASKET)
  run(world, 20)
  assert.ok(world.me.loads.join() === 'flower' && world.love === 0, 'a flower for the princess went up in the basket')
  world.order(PRINCESS)
  let under = false
  run(world, 30, () => (under ||= Math.hypot(world.me.x - 6, world.me.z + 11) < 0.3))
  assert.ok(under && world.love === 1 && world.me.loads.length === 0, 'the flower should have been handed to the princess under her balcony')
}

// Music. With its second charge the camp asks for it. The musician is fetched from the yard, through the gate, and
// taken to the table: he plays by the fire, those of the camp who had sat down get up, and he goes home by himself.
{
  const world = new Castle(1)
  world.start()
  run(world, 53)
  assert.ok(wants(world).includes('camp:music'), `the camp should want music by now: ${wants(world)}`)
  world.order(MUSIC)
  world.order(TABLE)
  // (How many of the camp were on their feet as he came up to the fire, and as he struck up.)
  let [open, before, after, strayed, inside] = [0, -1, -1, false, 9]
  run(world, 60, () => {
    open = Math.max(open, world['gate'].open)
    if (world.tune.mode === 'go') before = world.standing(1)
    if (world.tune.mode === 'play' && after < 0) after = world.standing(1)
    strayed ||= world.men.some((man) => man.side && man.z < -0.5 && man.x > -6 && man.x < 7)
    inside = Math.min(inside, Math.hypot(world.me.x - world.tune.x, world.me.z - world.tune.z))
  })
  assert.ok(open > 0.9, 'the gate did not open for the helper')
  assert.ok(after >= 0 && !wants(world).includes('camp:music'), 'the musician should have played at the camp, and the camp have had its music')
  assert.ok(before < 6 && after === Math.min(6, before + 2), `music should get two of the camp back on their feet: there were ${before} standing, and then ${after}`)
  assert.ok(!strayed, 'one of the camp went in through the gate while it was open')
  assert.ok(inside > 0.6, `the helper and the musician were in each other: ${inside.toFixed(2)} apart at the nearest`)
  assert.ok(world.tune.seated && world.tune.mode === 'home', 'a minute later the musician should be back on his stool')
}

// What happens in the quiet between two charges, each in its turn. The cat goes after the loaf on the oven's shelf:
// left alone it is home again with the loaf gone; a click on it, once it has the loaf, and the loaf is back.
for (const stopped of [false, true]) {
  const world = still()
  world.round = 3
  world['happen']()
  assert.equal(world['thief'], 'out', 'the cat should be off after a loaf')
  let open = 0
  run(world, 30, () => {
    open = Math.max(open, world['gate'].open)
    if (stopped && world['loot']) world.click(-1, world.cat.x + 0.6, world.cat.z)
  })
  assert.ok(open > 0.9, 'the gate should open for a cat with somewhere to be')
  assert.ok(!world.cat.away && world.cat.y > 5 && !world['thief'], 'half a minute later the cat should be back on its cask')
  assert.equal(world.oven.ready, stopped ? 1 : 0, stopped ? 'the cat was stopped: the loaf should be back on the shelf' : 'nobody stopped the cat: the loaf should be gone')
}
// It rains on the camp's fire: there is no soup until somebody has brought wood for it, which is waited for as long as
// it takes, and asked for over the fire.
{
  const world = still()
  world.round = 4
  world['happen']()
  assert.ok(world.doused && wants(world) === 'camp:wood', `it should have rained on the fire, and the camp want wood for it: ${wants(world)}`)
  const ask = world.asks[0]
  world.order(HEARTH)
  run(world, 20)
  assert.deepEqual(world.me.loads, [], 'he got soup from a pot over a fire that is out')
  world.order(LOGS)
  world.serve(ask.id)
  run(world, 25)
  assert.ok(ask.left === ask.full, 'wood for a fire that is out should be waited for as long as it takes')
  assert.ok(!world.doused && wants(world) === '' && world.me.loads.length === 0, 'wood on the fire should have lit it again')
  world.order(HEARTH)
  run(world, 5)
  assert.deepEqual(world.me.loads, ['soup'], 'and then there should be soup again')
}
// And a duck takes a liking to the helper: it is at his heels for half a minute, and then back on the pond.
{
  const world = still()
  world.round = 2
  world['happen']()
  const duck = world['tail']!
  assert.ok(duck, 'a duck should have taken a liking to the helper')
  world.click(-1, -9, 9)
  run(world, 15)
  assert.ok(Math.hypot(duck.x - world.me.x, duck.z - world.me.z) < 2.5, `the duck should be at his heels: it is ${Math.hypot(duck.x - world.me.x, duck.z - world.me.z).toFixed(1)} off`)
  run(world, 20)
  assert.ok(world.ducks.every((one) => !one.away) && !world['tail'], 'and back on the pond half a minute later')
}

// The two sides start helping each other once the courting has got somewhere: with two things brought, one of what
// is asked for in a charge is thrown across by the other side, and nobody has to bring it.
{
  const world = new Castle(1)
  world.start()
  world.love = 2
  run(world, 20)
  assert.equal(world.asks.length, 1, `nine seconds into the charge, one of the two things asked for should have come from the other side: ${wants(world)}`)
  assert.equal(world.standing(0) + world.standing(1), 12, 'and nobody should have sat down for it')
}

// A day. Nobody helps: one side gives up before long. One side is helped: the other gives up. And somebody who plays
// sensibly keeps both of them going, brings the princess and the prince everything they ask for, and has them married
// inside six minutes, on every one of these days; so does somebody who takes four seconds over every decision.
for (const seed of [1, 2]) {
  const lost = day(seed)
  assert.ok((lost.over === 'castle' || lost.over === 'camp') && lost.at > 100 && lost.at < 260, `day ${seed}, with no help: ${lost.over || 'not over'} after ${lost.at.toFixed(0)} seconds`)
}
assert.equal(day(4, 1, [0]).over, 'camp', 'with only the castle looked after, the camp should give up')
assert.equal(day(4, 1, [1]).over, 'castle', 'with only the camp looked after, the castle should give up')
for (const [seed, lag] of [[1, 1], [2, 1], [3, 1], [4, 1], [5, 4], [6, 4]]) {
  // (What was seen on the way: the cat and an apple on his hat, soup, a flower, three things at once; and the helper
  // under the princess's balcony. What she and the prince ask for is never any nearer to running out.)
  const seen = new Set<string>()
  const won = day(seed, lag, [0, 1], (world) => {
    for (const item of world.me.loads) if (item === 'cat' || item === 'apple' || item === 'soup' || item === 'flower') seen.add(item)
    if (world.me.loads.length === 3) seen.add('three')
    if (Math.hypot(world.me.x - 6, world.me.z + 11) < 0.3) seen.add('keep')
    for (const ask of world.asks) if (ask.love) assert.equal(ask.left, ask.full, 'something the princess or the prince asked for is running out')
  })
  assert.ok(won.over === 'wedding' && won.at < 360 && won.least >= 3, `day ${seed}, played ${lag > 1 ? 'slowly' : 'sensibly'}: ${won.over || 'not over'} after ${won.at.toFixed(0)} seconds, with as few as ${won.least} standing`)
  assert.equal(won.world.love, 4, 'a wedding without all four things brought')
  assert.deepEqual([...seen].sort(), ['apple', 'cat', 'flower', 'keep', 'soup', 'three'], 'on the way to a wedding he should have carried the cat, an apple, soup and a flower, had three things on his hat at once, and been to the princess in person')
  // The wedding itself: she comes out through the gate, he comes up the road, and they stand a step apart.
  for (let i = 0; i < 400; i++) won.world.update(0.05)
  const [princess, prince] = won.world['royals']
  assert.ok(Math.hypot(princess.x, princess.z - 1) < 0.2 && Math.hypot(prince.x, prince.z - 2) < 0.2, `the princess and the prince should have met in front of the gate: she is at ${princess.x.toFixed(1)}, ${princess.z.toFixed(1)}, he at ${prince.x.toFixed(1)}, ${prince.z.toFixed(1)}`)
  assert.ok(won.world['gate'].open > 0.9 && won.world.standing(0) + won.world.standing(1) === 12, 'at a wedding the gate stands open, and nobody sits under a cloud')
}

// The camera. With the cursor on the top of the keep, the wheel brings the view in on the keep, which stays under the
// cursor, and stops short of it. (Taken to be on the flat ground, the cursor would be on the grass behind the castle,
// and the camera would go there: through the keep.)
const world = new Castle(1)
const [W, H] = [1280, 800]
Object.assign(globalThis, { addEventListener() {}, innerWidth: W, innerHeight: H })
const canvas = {} as HTMLElement
const view = new View(canvas, world.solid.mesh, SIGHT, () => {})
view.yaw = -0.55 // as on the castle's page
const camera = new PerspectiveCamera(30, W / H, 1, 400)
const frames = (n: number) => {
  for (let i = 0; i < n; i++) view.update(0.016, camera, W, H)
}
frames(1)
// Where the keep's top is drawn at the start.
const top = new Vector3(6, 11, -12.2).project(camera)
const [x, y] = [((top.x + 1) / 2) * W, ((1 - top.y) / 2) * H]
const ray = new Raycaster()
ray.setFromCamera(new Vector2((x / W) * 2 - 1, 1 - (y / H) * 2), camera)
const keep = ray.intersectObject(world.solid.mesh)[0].point.clone()
assert.ok(keep.y > 9.5, `the cursor was meant to be on the keep, and is on something ${keep.y} high`)
for (let i = 0; i < 40; i++) {
  view['onWheel']({ target: canvas, clientX: x, clientY: y, deltaY: -120, ctrlKey: false, preventDefault() {} } as unknown as WheelEvent)
  frames(2)
  assert.ok(camera.position.distanceTo(keep) > 10.5, `turn ${i} of the wheel has the camera ${camera.position.distanceTo(keep)} from the keep: in it, or nearly`)
}
frames(90)
const drawn = keep.clone().project(camera)
const off = Math.hypot(((drawn.x + 1) / 2) * W - x, ((1 - drawn.y) / 2) * H - y)
assert.ok(off < 0.1 * H, `after going in on it, the top of the keep is drawn ${off} pixels from the cursor it was under`)
assert.ok(camera.position.distanceTo(keep) < 12, `as near as it goes, the camera is still ${camera.position.distanceTo(keep)} from the keep`)
console.log('castle: ok')
