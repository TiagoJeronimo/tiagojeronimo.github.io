// Plays whole games without a browser, on enough islands that every map of every isle is played at least once:
// everything there is to find gets found, every isle comes up, every bed ends up with water (or lava) in it, and every
// tile wakes. A map that breaks the plumbing or strands a thing fails here.
// Run with: node test/play.test.ts            a few islands, as part of `npm test`
//           node test/play.test.ts 300        the first 300 islands, after drawing a new map
import assert from 'node:assert/strict'
import { PerspectiveCamera, Scene, Vector3 } from 'three'

// The game listens for the mouse, asks what kind of screen it is on, and sets a colour or two on the page. Here there is none of that.
Object.assign(globalThis, {
  matchMedia: () => ({ matches: false }),
  addEventListener() {},
  removeEventListener() {},
  document: { documentElement: { style: { setProperty() {}, removeProperty() {} } }, body: { style: {} }, querySelector: () => null },
})
const { ISLES, Island, framed, held, LINGER } = await import('../src/game/Island.ts')
const { headOf, shapeOf } = await import('../src/game/critters.ts')
const { D, W, drawn, step, tileAt, tx, tz } = await import('../src/game/grid.ts')

// What the test reaches into: mostly things the game keeps to itself.
interface Thing { tile: number; cubes: number[]; hits?: number; tip?: string; tap?: () => void; play?: () => void; todo?: boolean; up?: boolean; key?: string; extra?: number[] }
interface Game {
  things: Thing[]
  solid: { on(cube: number): boolean }
  found: number
  knocks: number
  hint: string
  ended: boolean
  noticed: string[]
  time: number
  lifeCount: number
  total: number
  open: boolean[]
  isle: Int8Array
  mark: string[]
  bed: Uint8Array
  filled: Uint8Array
  exists: Uint8Array
  alive: Uint8Array
  memo: Record<string, number>
  tiles: number[][]
  index(name: string): number
  advance(dt: number): void
  strike(id: number): boolean
  next(): void
  // The camera.
  update(dt: number, camera: PerspectiveCamera, width: number, height: number): void
  hands(): void
  zoom: number
  pan: Vector3
  centre: Vector3
}

const THINGS = 27
let endings = 0 // on how many islands the ending was caught in the middle of being said
let carried = 0 // and on how many a wish was open to be granted from across the water, with the camera going along

function play(seed: number) {
  const game = new Island(new Scene(), {} as Element, () => {}, seed) as unknown as Game
  const wait = (seconds: number) => {
    for (let i = 0; i < seconds * 20; i++) game.advance(0.05)
  }
  const open = (name: string) => game.open[game.index(name)]
  const on = (thing: Thing, name: string) => game.isle[thing.tile] === game.index(name)
  const named = (tip: RegExp) => game.things.findIndex((thing) => thing.tip && tip.test(thing.tip))
  const say = (what: string) => `island ${seed}: ${what}`
  // What the bees will bring out, besides apples: flowers on the old tree, and fruit on some of the first island's
  // other trees. None of it is there before they are.
  const flowers = [...game.things.find((thing) => thing.key === 'tree:old')!.extra!]
  const groves = game.things.filter((thing) => thing.key === 'tree:oak' && thing.extra)
  const fruit = groves.flatMap((thing) => thing.extra!)
  assert.ok(flowers.length > 9 && ![...flowers, ...fruit].some((cube) => game.solid.on(cube)), say('the old tree is in flower, or an oak in fruit, before there are any bees'))

  for (let round = 0; round < 40 && (game.found < THINGS || !open('islet')); round++) {
    // Knock on whatever can be knocked on, until it gives.
    game.things.forEach((thing, i) => {
      for (let k = 0; k < 4 && game.open[game.isle[thing.tile]] && game.things[i].hits; k++) game.strike(i)
    })
    wait(10)
    // The fairy ring: its five mushrooms, the smallest first.
    if (open('swamp') && game.things.some((thing) => on(thing, 'swamp') && thing.todo))
      for (const c of '12345') game.strike(game.things.findIndex((thing) => on(thing, 'swamp') && game.mark[thing.tile] === c))
    // The cactus wants rain: the frog, once awake, sends its cloud wherever rain will do something.
    const frog = named(/^The frog/)
    if (frog >= 0 && open('beach') && game.things.some((thing) => on(thing, 'beach') && thing.todo)) {
      game.strike(frog)
      wait(14)
    }
    // The shell, once it has called the tide in, sends it out (which shows the way to the islet) and calls it back.
    const shell = named(/^The shell that calls the tide/)
    if (shell >= 0 && !open('islet')) {
      game.strike(shell)
      wait(6)
      // Its label says what the next call will do, and that depends on where the tide is.
      assert.ok(!game.memo.tide && game.things[shell].tip?.includes('comes back in'), say(`the tide is out, and the shell says: ${game.things[shell].tip}`))
      game.strike(shell)
      wait(6)
      assert.ok(game.memo.tide && game.things[shell].tip?.includes('goes out'), say(`the tide is in, and the shell says: ${game.things[shell].tip}`))
    }
  }
  wait(30)

  assert.equal(game.found, THINGS, say(`${game.found} of ${THINGS} things found; still to go: ${game.things.filter((thing) => thing.hits || thing.todo).map((thing) => thing.tip).join(', ')}`))
  for (const isle of ISLES) assert.ok(open(isle.name), say(`the ${isle.name} never came up`))
  for (let t = 0; t < W * D; t++) {
    if (!game.exists[t]) continue
    const where = `${ISLES[game.isle[t]].name} '${game.mark[t]}' at (${(t % W) - ISLES[game.isle[t]].at[0]}, ${Math.floor(t / W) - ISLES[game.isle[t]].at[1]})`
    assert.ok(!game.bed[t] || game.filled[t], say(`a bed stayed dry: ${where}`))
    assert.ok(game.alive[t], say(`a tile never woke: ${where}`))
  }
  assert.equal(game.lifeCount, game.total, say('not everything is alive'))
  assert.ok(game.memo.ducks, say('no ducks came to the pond'))
  assert.ok(game.memo.spring, say('the hot pool never filled'))
  // The penguin's slide goes down into the pond on its west side.
  assert.equal(game.mark[step(game.memo.slideTile, -1, 0)], 'i', say('the slide does not end in the frozen pond'))
  // The things that are only there to be played with: every island has its swing (out, by now, with the old tree in
  // blossom), its hammock, and a sign to read at each of the six bridges. A knock on one does something and counts for nothing.
  const toys = game.things.filter((thing) => thing.play)
  const called = (tip: string) => toys.filter((toy) => toy.tip?.startsWith(tip))
  assert.ok(called('A swing')[0]?.up, say('no swing on the old tree'))
  assert.equal(called('A hammock').length, 1, say('no hammock on the beach'))
  assert.equal(called('A sign.').length, 6, say('not a sign at every bridge'))
  // The trees that bear oranges answer a knock as the apple trees do: a leaf or two, and a fruit for whoever is near.
  assert.equal(called('An orange tree').length, groves.length, say('an oak with oranges on it does not answer a knock'))
  assert.ok([...flowers, ...fruit].every((cube) => game.solid.on(cube)), say('the bees are out, and the old tree has no flowers or an oak that should bear fruit has none'))
  // No label goes on saying what is no longer so: by now the marmots are up and the egg has hatched.
  for (const stale of ['sleeps one, and soundly', 'round an egg', 'stone cold', 'heavy with rain'])
    assert.ok(!game.things.some((thing) => thing.tip?.includes(stale)), say(`a label still says "${stale}"`))
  // And whatever still answers a click says what it is when pointed at: the well, the old tree, the fire, the bell.
  const mute = game.things.filter((thing) => (thing.tap || thing.play || thing.hits) && !thing.tip && game.open[game.isle[thing.tile]] && thing.cubes.some((cube) => game.solid.on(cube)))
  assert.equal(mute.length, 0, say(`things that answer a click and have no label: ${mute.map((thing) => game.mark[thing.tile])}`))
  // It is night by now (the lantern), and whoever sleeps, sleeps on the land: round the fire, by the hot water, or
  // wherever it was. Nobody dozes off out over the sea, level with a cliff they are not on.
  // (One that sleeps on a perch is where the perch is: the arm of a scarecrow may reach out over the edge.)
  const abed = (game as unknown as { critters: { list: { kind: string; x: number; y: number; z: number; nap: number; hidden?: boolean; roost?: number[]; next?: { name: string } }[] } }).critters.list.filter((c) => !c.hidden && c.nap > 0.5 && !c.roost)
  const adrift = abed.filter((c) => !game.exists[tileAt(c.x, c.z)])
  assert.equal(adrift.length, 0, say(`asleep off the land: ${adrift.map((c) => `${c.kind} at ${c.x.toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)} (${c.next?.name})`)}`))
  // A wish granted from far off takes the camera with it: a carrot for the bunnies comes from the garden, across the
  // water, and the view goes over with it and ends up on whoever wished.
  const wishing = game as unknown as { friends: { id: string; wish?: string; granted?: boolean }[]; show?: object; going?: { at?: () => number[] | undefined }; critters: { list: { kind: string; x: number; z: number }[] } }
  const bunnies = wishing.friends.find((friend) => friend.id === 'bunny')
  if (bunnies?.wish && !bunnies.granted) {
    wishing.show = undefined // the long look at the finished world is over by now: without a browser, nothing ever says so
    assert.ok(game.strike(game.things.findIndex((thing) => thing.tip?.startsWith('Carrots'))), say('a carrot was not taken as the wish it grants'))
    const [x, z] = wishing.going?.at?.() ?? []
    assert.ok(x !== undefined && game.isle[tileAt(x, z)] === game.index('garden'), say('the camera did not set off with the carrot'))
    wait(3)
    const [bx, bz] = wishing.going!.at!()!
    assert.ok(wishing.critters.list.some((c) => c.kind === 'bunny' && Math.hypot(c.x - bx, c.z - bz) < 0.1) && bunnies.granted, say('the camera did not end up on the bunny that got its carrot'))
    carried++
  }
  for (const toy of toys) game.strike(game.things.indexOf(toy)) // the first knock on a tree may be somebody's wish coming true (a branch for the beaver): that one counts
  const knocks = game.knocks
  for (const toy of toys) assert.equal(game.strike(game.things.indexOf(toy)), false, say(`a knock on a toy was kept: ${toy.tip}`))
  assert.equal(game.knocks, knocks, say('knocks on toys were counted'))
  wait(30) // an apple or two came down just now: somebody eats them, and nothing is left in a muddle
  // The ending rolls: what whoever is in the balloon has to say goes up over the island in one go, like the credits
  // of a film, for about a minute. The space bar cuts it short. Then it is over, and the card can come up with a few
  // true things on it about how the island was played.
  const film = game as unknown as { reel?: { lines: string[]; seconds: number }; critters: { list: { kind: string; onPat?: () => void }[] } }
  for (let k = 0; k < 60 && !film.reel && !game.ended; k++) wait(1)
  if (film.reel) {
    assert.ok(film.reel.lines.length === 10 && film.reel.seconds > 40 && film.reel.seconds < 90, say(`an odd ending: ${film.reel.lines.length} lines in ${film.reel.seconds} seconds`))
    game.next()
    assert.ok(game.ended && !film.reel, say('the space bar did not cut the ending short'))
    endings++
  }
  assert.ok(game.ended, say('the ending never ended'))
  // And a click on the balloon rolls it again, from the top and to its end, without taking the ending back.
  film.critters.list.find((c) => c.kind === 'balloon')!.onPat!()
  assert.ok(film.reel && game.ended, say('a click on the balloon did not roll the ending again'))
  wait(film.reel!.seconds + 1)
  assert.ok(!film.reel && game.ended, say('the ending, rolled again, did not come to its end'))
  assert.ok(game.noticed.length > 1 && game.noticed.length < 5 && game.noticed.some((line) => line.startsWith('It took you')), say(`odd notes for the card at the end: ${game.noticed}`))
  return game.time
}

// Enough islands for every map of every isle to turn up, the island as drawn among them; or as many as asked for.
const want = Number(process.argv[2]) || 0
const seeds = [0]
const seen = new Set<string>()
for (let seed = 1; seed < 500 && (want ? seeds.length < want : true); seed++) {
  const fresh = ISLES.map((isle, s) => `${s}:${[isle, ...(isle.variants ?? [])].indexOf(drawn(isle, seed))}`).filter((key) => !seen.has(key))
  if (!want && !fresh.length) continue
  for (const key of fresh) seen.add(key)
  seeds.push(seed)
  if (!want && seen.size === ISLES.reduce((n, isle) => n + 1 + (isle.variants?.length ?? 0), 0)) break
}
const began = performance.now()
for (const seed of seeds) play(seed)
assert.ok(carried > 0, 'on no island were the bunnies wishing for a carrot at the end: nothing checked that the camera goes along with a wish')
assert.ok(endings > 0, 'on no island was the ending caught while it rolled: nothing checked what it holds, or that the space bar cuts it short')
console.log(`play: ok (${seeds.length} islands in ${((performance.now() - began) / 1000).toFixed(1)} s)`)

// --- the animals ------------------------------------------------------------------------------
// Those with a head apart from their body: the eyes are in the head, the body is not, and there is more to it than eyes.
for (const kind of ['bird', 'bunny', 'tortoise', 'duck', 'penguin', 'beaver', 'marmot', 'goat', 'dragon', 'capybara'] as const) {
  const parts = shapeOf(kind, 0xffffff)
  const head = headOf(kind, parts)
  assert.ok(head.length > 2 && !head.includes(parts[0]), `${kind}: its head is not its body`)
  assert.ok(parts.filter((part) => part[6] === 0x3a3340).every((eye) => head.includes(eye)), `${kind}: its eyes are in its head`)
}
// Left to themselves they find things to do, and stop for the night: by day somebody is always in the middle of something;
// in the dark those that sleep at night have yawned, and are down.
{
  const game = new Island(new Scene(), {} as Element, () => {}, 0) as unknown as Game & { critters: { list: { kind: string; act?: string; nap: number; hidden?: boolean }[] }; setNight(on: boolean): void }
  const acts = new Set<string>()
  const fidget = (seconds: number) => {
    for (let i = 0; i < seconds * 20; i++) {
      game.advance(0.05)
      for (const c of game.critters.list) if (c.act) acts.add(c.act)
    }
  }
  fidget(30)
  assert.equal(acts.size, 0, 'somebody shut in or asleep is fidgeting: on a new island there is only a bird in a cage and a beaver asleep')
  for (const tip of ['A cage', 'A cage', 'A beaver, fast asleep', 'A beaver, fast asleep']) game.strike(game.things.findIndex((thing) => thing.tip?.startsWith(tip)))
  fidget(90)
  assert.ok(acts.size > 1, `the bird and the beaver are out, and have found nothing to do with themselves (${[...acts]})`)
  game.setNight(true)
  fidget(12)
  const up = game.critters.list.filter((c) => !c.hidden && ['bird', 'beaver'].includes(c.kind) && c.nap < 0.5)
  assert.equal(up.length, 0, 'somebody who sleeps at night is still up twelve seconds into it')
}
console.log('animals: ok')

// --- what the game says, and what it notices -----------------------------------------------------
{
  const game = new Island(new Scene(), {} as Element, () => {}, 0) as unknown as Game & {
    critters: { list: { kind: string; thing?: number }[] }
    pat(c: unknown): void
    say(text: string): void
    click(): void
    pick(): number
    until: number
    lines: string[]
    notes: { idle: number; pats: Record<string, number> }
  }
  // Every line that comes up, in order, and when.
  const heard: [string, number][] = [[game.hint, 0]]
  const wait = (seconds: number) => {
    for (let i = 0; i < seconds * 20; i++) {
      game.advance(0.05)
      if (game.hint !== heard[heard.length - 1][0]) heard.push([game.hint, game.time])
    }
  }
  const said = (start: string) => heard.find(([line]) => line.startsWith(start))
  wait(3)
  // Lines come up one at a time, each for as long as it takes to read: a second one waits for the first.
  game.say('One short line.')
  game.say('And another, which has to wait its turn.')
  wait(1)
  assert.ok(!said('One short line.'), 'a line pushed out the one before it, which had not had its time')
  wait(30)
  const [one, two] = [said('One short line.')!, said('And another')!]
  assert.ok(one && two && two[1] - one[1] > held('One short line.') + 0.9, `the second line did not wait for the first to be read, and a breath more (${one}, ${two})`)
  // What a click brings about is said at once, whatever is up. Here the click lands on a sign.
  const sign = game.things.findIndex((thing) => thing.tip?.startsWith('A sign.'))
  game.say('A long line that is in the middle of being read when the click comes, so that it has to come back afterwards.')
  wait(1)
  game.pick = () => sign
  game.click()
  assert.ok(game.hint.startsWith('THE ISLAND: THAT WAY.'), `a click was not answered at once: ${game.hint}`)
  wait(30)
  assert.equal(heard.filter(([line]) => line.startsWith('A long line')).length, 2, 'a line cut off by a click did not come back')

  // A thing with nothing to give: knocked on five times, it gets a word; and again at ten.
  const dull = game.things.findIndex((thing) => !thing.hits && !thing.tap && !thing.play && !thing.todo && !thing.tip)
  for (let k = 0; k < 4; k++) assert.equal(game.strike(dull), false, 'a knock on a plain rock did something')
  wait(12)
  assert.ok(!said('Five knocks'), 'four knocks on nothing, and already there is a remark')
  game.strike(dull)
  wait(12)
  assert.ok(said('Five knocks, and nothing.'), 'five knocks on nothing went unremarked')
  assert.equal(game.notes.idle, 5, 'the knocks that came to nothing were not counted')
  for (let k = 0; k < 5; k++) game.strike(dull)
  wait(12)
  assert.ok(said('Ten knocks on the same thing.'), 'ten knocks on nothing went unremarked')
  // A favourite: one that gets all the pats.
  for (const tip of ['A cage', 'A cage']) game.strike(game.things.findIndex((thing) => thing.tip?.startsWith(tip)))
  wait(8)
  const bird = game.critters.list.find((c) => c.kind === 'bird' && c.thing === undefined)
  for (let k = 0; k < 6; k++) game.pat(bird)
  wait(60)
  assert.ok(said('You have patted the bluebird 6 times.'), `a favourite went unremarked: ${heard.map(([line]) => line.slice(0, 24))}`)
  // A thing that is not left alone says so, once: a sign read six times.
  for (let k = 0; k < 6; k++) game.strike(sign)
  wait(150) // six lines, read without hurry, and then the remark
  assert.ok(said('You have read that sign twice through now.'), 'a sign read six times had nothing to say about it')
  // And nothing that was said got lost on the way: whatever waited has had its turn by now.
  assert.equal(game.lines.length, 0, `lines still waiting after all that quiet: ${game.lines}`)
  // The player can move a line on: with one waiting, the next comes at once; with none, the line goes.
  const moved = game as unknown as { next(): void; until: number }
  game.say('A line to be read.')
  game.say('The one after it.')
  wait(1.2)
  assert.ok(game.hint.startsWith('A line to be read.'), `a line did not come up: ${game.hint}`)
  moved.next()
  assert.ok(game.hint.startsWith('The one after it.'), 'moving on did not bring the next line')
  wait(0.1)
  moved.next()
  assert.ok(game.time >= moved.until + LINGER, 'moving on from the last line did not send it away')
  // All of it is kept, for the map: every line that came up, once each, and the one said last at the end.
  const kept = (game as unknown as { heard: [string, string, number, string][] }).heard
  const lines = kept.filter(([, about]) => about !== 'land')
  assert.deepEqual(lines.map(([line]) => line).sort(), [...new Set(heard.map(([line]) => line))].sort(), 'what the map keeps is not what was said')
  assert.equal(lines[lines.length - 1][0], game.hint, 'the line said last is not the last one kept')
  // Among them, a mark where land came up: the meadow, which the bird let out of its cage went and planted.
  assert.ok(kept.some(([line, about]) => about === 'land' && line === 'meadow'), 'the log has no mark for the meadow coming up')
  // With each, who or what it was about: what a knock brings about is about the thing knocked on (or whoever is shut
  // in it), a sign's line is a sign's, and what the game remarks on is about the player.
  const about = (start: string) => kept.find(([line]) => line.startsWith(start))?.[1]
  assert.equal(about('Free! It heads straight out'), 'bird', 'the line about the bird let out of its cage is not about the bird')
  assert.equal(about('THE ISLAND: THAT WAY.'), 'sign', 'a sign was not read as a sign')
  assert.equal(about('Five knocks, and nothing.'), 'about you', 'a remark on how the game is played is not about the player')
  assert.equal(about('One short line.'), '', 'a line out of nowhere is about somebody')
  // And where that is, and what colour: the map can take the view there. A tip, when asked for, names the thing it
  // is about in [square brackets], for the page to make stand out.
  const read = kept.find(([line]) => line.startsWith('THE ISLAND: THAT WAY.'))!
  assert.ok(read[2] === game.things[sign].tile && /^[0-9a-f]{6}$/.test(read[3]), `a sign's line does not say where the sign is, or what colour: ${read}`)
  ;(game as unknown as { nudge(): void }).nudge()
  wait(1)
  const tip = kept[kept.length - 1]
  assert.ok(tip[1] === 'tip' && tip[2] >= 0 && /\[.+\]/.test(tip[0]), `a tip does not say what it is about, or where: ${tip}`)
  // A wish is not said when its bubble comes up: it goes into the log, and counts as not looked at until the log is.
  const quiet = game as unknown as { whisper(text: string, about?: string): void; read(): void; fresh: string[] }
  quiet.whisper('Somebody would like something.', 'beaver')
  assert.ok(quiet.fresh.length === 1 && !game.hint.startsWith('Somebody would like'), 'a wish was said out loud, or not counted as new')
  quiet.read()
  assert.equal(quiet.fresh.length, 0, 'looking at the log did not clear what was new in it')
}
// Until something has been found, the thing to start with stirs every few seconds, to show whoever has not clicked
// on anything yet where to begin: not at once, and not any more after the first find, whatever that was.
{
  const game = new Island(new Scene(), {} as Element, () => {}, 0) as unknown as Game & { solid: { poke(i: number, amount?: number): void }; things: (Thing & { cubes: number[]; clue?: string })[] }
  const wait = (seconds: number) => {
    for (let i = 0; i < seconds * 20; i++) game.advance(0.05)
  }
  const there = (thing: Thing & { clue?: string }) => thing.hits && thing.clue && game.open[game.isle[thing.tile]]
  const first = game.things.find((thing) => thing.tip?.startsWith('A boulder.') && there(thing))!
  let jolts = 0
  const poke = game.solid.poke.bind(game.solid)
  game.solid.poke = (i, amount) => {
    if (first.cubes.includes(i)) jolts++
    poke(i, amount)
  }
  wait(5)
  assert.equal(jolts, 0, 'the thing to start with stirred before the island had had a moment to itself')
  wait(6)
  assert.equal(jolts, 4 * first.cubes.length, `the thing to start with did not stir twice, a few seconds apart, two jolts each time (${jolts} jolts on ${first.cubes.length} cubes)`)
  // Something else is found first: the one to start with is still there, and is left in peace from now on.
  const other = game.things.findIndex((thing) => thing !== first && there(thing))
  for (let k = 0; k < 9 && !game.found; k++) game.strike(other)
  assert.ok(game.found && first.hits, 'nothing but the first thing could be found first')
  wait(1)
  jolts = 0
  wait(12)
  assert.equal(jolts, 0, 'the thing to start with went on stirring after something had been found')
}
// Words that outlive what they are about. A line about a thing leads to it only for as long as the thing is there; a
// tip is not said again once its thing has been found; nor is any other line that was said about a thing before then.
{
  let gone: number[] = []
  const game = new Island(new Scene(), {} as Element, (state: { gone: number[] }) => (gone = state.gone), 0) as unknown as Game & {
    pick(): number
    click(): void
    nudge(): void
    say(text: string, about?: string, tile?: number): void
    things: (Thing & { clue?: string })[]
  }
  const camera = new PerspectiveCamera(30, 1.6, 1, 400)
  const heard: string[] = [game.hint]
  const run = (seconds: number) => {
    for (let i = 0; i < seconds * 20; i++) {
      game.update(0.05, camera, 1280, 800)
      if (game.hint !== heard[heard.length - 1]) heard.push(game.hint)
    }
  }
  const times = (line: string) => heard.filter((one) => one === line).length
  const index = (tip: string) => game.things.findIndex((thing) => thing.tip?.startsWith(tip))
  const click = (id: number) => {
    game.pick = () => id
    game.click()
  }
  const tipFor = (id: number) => {
    for (let k = 0; k < 12 && game.hint !== game.things[id].clue; k++) game.nudge()
    assert.equal(game.hint, game.things[id].clue, 'no tip came for it')
    return game.hint
  }
  run(3)
  // The cloud: a tip about it is asked for, and it is knocked on before the tip has been read through.
  const cloud = index('A grey cloud')
  const sky = game.things[cloud].tile
  assert.ok(!gone.includes(sky), 'the cloud counts as gone while it hangs there')
  const tip = tipFor(cloud)
  run(1)
  click(cloud)
  assert.ok(game.hint.startsWith('Rain!'), `the knock on the cloud was not answered at once: ${game.hint}`)
  run(40)
  assert.equal(times(tip), 1, 'the tip about the cloud came back after the cloud had been seen to')
  assert.ok(gone.includes(sky), 'the cloud has rained itself out, and a line about it still leads there')
  // A tip cut off by something else altogether, whose thing is found before its turn comes round again.
  const boulder = index('A boulder.')
  const rock = game.things[boulder].tile
  const sign = index('A sign.')
  const other = tipFor(boulder)
  run(1)
  click(sign)
  for (let k = 0; k < 3; k++) game.strike(boulder)
  run(60)
  assert.equal(times(other), 1, 'a tip came back although its thing had been found meanwhile')
  assert.ok(gone.includes(rock), 'the boulder is in pieces, and a line about it still leads there')
  assert.ok(!gone.includes(game.things[sign].tile), 'a sign counts as gone')
  // And any line said about a thing while it is still to be found, should it have to wait until the thing is done.
  const well = index('A well, with a stone lid')
  game.say('Something else is being said just now, and it takes a little while to read it through.')
  game.say('Nearly. One more knock will do it.', 'well', game.things[well].tile)
  for (let k = 0; k < 9 && game.things[well].hits; k++) game.strike(well)
  run(60)
  assert.ok(times('Something else is being said just now, and it takes a little while to read it through.') === 1 && !times('Nearly. One more knock will do it.'), 'a line about a thing still to be found came up after it had been found')
}
console.log('saying and noticing: ok')

// --- the camera follows the action ------------------------------------------------------------
// The framing by itself. A view from the south, 20 off, shows about 8 tiles to either side of its middle.
const [TAN, ASPECT, PITCH] = [Math.tan((15 * Math.PI) / 180), 1.6, 0.72]
const frame = (points: number[][], yaw = 0, own = 20) => framed(points, [0, 0], yaw, own, TAN, ASPECT, PITCH)
assert.equal(frame([]), undefined, 'no action, nothing to frame')
assert.equal(frame([[2, 1], [-3, -1]]), undefined, 'action in plain view leaves the camera alone')
const east = frame([[30, 0]])!
assert.ok(east && east[2] > 20 && east[0] > 5 && east[0] < 25, 'action far to the east: a wider view, with its middle between the two')
assert.ok(30 - east[0] < east[2] * TAN * ASPECT && east[0] < east[2] * TAN * ASPECT, 'both the action and the place the player was looking at are in it')
assert.equal(frame([[9, 0]])![2], 20, 'action just off the edge: the view shifts over, and comes no nearer than the player had it')
const turned = frame([[0, -30]], Math.PI / 2)! // the same thing, with the world turned a quarter round
assert.ok(Math.abs(turned[2] - east[2]) < 1e-9 && Math.abs(turned[1] + east[0]) < 1e-9 && Math.abs(turned[0] - east[1]) < 1e-9, 'it works the same whichever way the camera faces')

// And in a game. Zoomed in on the boulder, three knocks send the water off down the river and out of the picture: the camera
// widens to keep up with it. By the time everything has settled the beach has come up, the camera has gone to see it, and
// there it stays: it does not come back by itself.
function watch(seed: number, then?: (game: Game, seen: () => number[]) => void) {
  const game = new Island(new Scene(), {} as Element, () => {}, seed) as unknown as Game
  const camera = new PerspectiveCamera(30, 1.6, 1, 400)
  const run = (seconds: number) => {
    for (let i = 0; i < seconds * 20; i++) game.update(0.05, camera, 1280, 800)
  }
  /** Where on the ground the camera is looking, and from how far off. */
  const seen = () => {
    const way = camera.getWorldDirection(new Vector3())
    const off = (1.5 - camera.position.y) / way.y
    return [camera.position.x + way.x * off, camera.position.z + way.z * off, off]
  }
  run(1)
  const boulder = game.things.findIndex((thing) => thing.tip?.startsWith('A boulder'))
  game.zoom = 3
  game.pan.set(tx(game.things[boulder].tile) - game.centre.x, 0, tz(game.things[boulder].tile) - game.centre.z)
  run(3)
  const before = seen()
  for (let k = 0; k < 3; k++) game.strike(boulder)
  let widest = 0
  for (let k = 0; k < 20; k++) {
    run(0.25) // five seconds: the river is still on its way, and the beach has not come up yet
    widest = Math.max(widest, seen()[2])
    if (k === 17) then?.(game, seen) // four and a half seconds in: the water is nearly at the sea, and the camera well out
  }
  const soon = seen() // five seconds in
  run(30)
  const after = seen()
  run(10)
  return { before, widest, soon, after, later: seen(), game }
}
const followed = watch(0)
// (Not by much: from this close the camera has come down for a look from the side, and from there it sees a long way already.)
assert.ok(followed.widest > followed.before[2] * 1.1, `the camera widens to keep up with the water (it was ${followed.before[2].toFixed(1)} off, and at most ${followed.widest.toFixed(1)})`)
assert.ok(followed.game.open[followed.game.index('beach')], 'the beach came up meanwhile')
const sands = followed.game.tiles[followed.game.index('beach')]
const shore = [sands.reduce((n, t) => n + tx(t), 0) / sands.length, sands.reduce((n, t) => n + tz(t), 0) / sands.length]
assert.ok(followed.after[2] > followed.before[2] * 1.5, `and the camera does not come back in by itself (${followed.before[2].toFixed(2)} off then, ${followed.after[2].toFixed(2)} now)`)
assert.ok(Math.hypot(followed.after[0] - shore[0], followed.after[1] - shore[1]) < 1.5, `it has gone to see the beach, and looks at the middle of it (${followed.after.map((v) => v.toFixed(1))}, the beach at ${shore.map((v) => v.toFixed(1))})`)
assert.ok(Math.hypot(followed.later[0] - followed.after[0], followed.later[1] - followed.after[1]) < 0.05 && Math.abs(followed.later[2] - followed.after[2]) < 0.05, 'and there it stays')
// A hand on the view ends the following: the camera stays where the player took over, until there is new land to see.
let taken: number[] = []
const kept = watch(0, (game, seen) => {
  taken = seen()
  game.hands()
})
assert.ok(taken[2] > kept.before[2] * 1.08, 'the player takes over while the camera is out wide')
assert.ok(Math.abs(kept.soon[2] - taken[2]) < 0.02 * taken[2] && Math.hypot(kept.soon[0] - taken[0], kept.soon[1] - taken[1]) < 0.3, `and the view stays where it was taken over (${taken.map((v) => v.toFixed(1))} then, ${kept.soon.map((v) => v.toFixed(1))} half a second on)`)
// The camera goes along with something on the move. From a view of the whole island, the bird let out of its cage is
// followed out over the sea, from nearer than before; then the meadow comes up, the camera goes to see that, and stays.
{
  const game = new Island(new Scene(), {} as Element, () => {}, 0) as unknown as Game & { critters: { list: { kind: string; x: number; z: number }[] } }
  const camera = new PerspectiveCamera(30, 1.6, 1, 400)
  const run = (seconds: number) => {
    for (let i = 0; i < seconds * 20; i++) game.update(0.05, camera, 1280, 800)
  }
  const seen = () => {
    const way = camera.getWorldDirection(new Vector3())
    const off = (1.5 - camera.position.y) / way.y
    return [camera.position.x + way.x * off, camera.position.z + way.z * off, off]
  }
  run(4)
  const whole = seen()
  const cage = game.things.findIndex((thing) => thing.tip?.startsWith('A cage'))
  const bird = game.critters.list.find((c) => c.kind === 'bird')!
  for (let k = 0; k < 2; k++) game.strike(cage)
  run(2)
  const along = seen()
  assert.ok(along[2] < whole[2] * 0.85, `the camera did not come nearer to go along with the bird (${whole[2].toFixed(1)} off, then ${along[2].toFixed(1)})`)
  assert.ok(Math.hypot(along[0] - bird.x, along[1] - bird.z) < Math.hypot(whole[0] - bird.x, whole[1] - bird.z), 'nor did it move towards the bird')
  run(25)
  const there = seen()
  const grass = game.tiles[game.index('meadow')]
  const middle = [grass.reduce((n, t) => n + tx(t), 0) / grass.length, grass.reduce((n, t) => n + tz(t), 0) / grass.length]
  assert.ok(game.open[game.index('meadow')] && Math.hypot(there[0] - middle[0], there[1] - middle[1]) < 1.5, `it did not end up looking at the meadow that came up (${there.map((v) => v.toFixed(1))}, the meadow at ${middle.map((v) => v.toFixed(1))})`)
}
// A window made another shape: a view that has been zoomed in on stays as near as it was (it is the whole world that
// is fitted to the window afresh, and from a narrow window that is seen from further off), and the nearest the view
// can come is the same distance in a window of any shape.
{
  const game = new Island(new Scene(), {} as Element, () => {}, 0) as unknown as Game & { zoomTo(zoom: number): void }
  const camera = new PerspectiveCamera(30, 1.6, 1, 400)
  const off = () => {
    const way = camera.getWorldDirection(new Vector3())
    return (1.5 - camera.position.y) / way.y
  }
  const run = (seconds: number, wide: number, high: number) => {
    for (let i = 0; i < seconds * 20; i++) game.update(0.05, camera, wide, high)
  }
  run(4, 1280, 800)
  const whole = off()
  game.zoom = 2.5
  run(3, 1280, 800)
  const near = off()
  run(3, 620, 800)
  assert.ok(Math.abs(off() - near) < 0.02 * near, `a close view did not keep its distance when the window was made narrow (${near.toFixed(1)} off, then ${off().toFixed(1)})`)
  run(3, 1280, 800)
  assert.ok(Math.abs(off() - near) < 0.02 * near, `nor when it was made wide again (${near.toFixed(1)} off, then ${off().toFixed(1)})`)
  game.zoomTo(99)
  run(3, 1280, 800)
  const nearest = off()
  run(1, 620, 800)
  game.zoomTo(99)
  run(3, 620, 800)
  assert.ok(Math.abs(off() - nearest) < 0.03 * nearest && nearest < 12, `the nearest view is not the same in a narrow window as in a wide one (${nearest.toFixed(1)} and ${off().toFixed(1)} off)`)
  game.zoom = 1
  game.pan.set(0, 0, 0)
  run(4, 620, 800)
  assert.ok(off() > whole * 1.3, `the whole world was not fitted afresh to a narrow window (${whole.toFixed(1)} off in a wide one, ${off().toFixed(1)} in a narrow one)`)
}
// The view goes to see something that hangs high: the cloud over its hill, on the first island, where the view is
// closest. All of the cloud is in the picture, and the arrow a tip stands over it; so it is when a line's name is clicked.
{
  const game = new Island(new Scene(), {} as Element, () => {}, 0) as unknown as Game & {
    nudge(): void
    visit(tile: number): void
    arrow: { x: number; y: number; z: number }
    things: (Thing & { clue?: string })[]
  }
  const camera = new PerspectiveCamera(30, 595 / 767, 1, 400) // a window taller than it is wide: less room to the sides, the same up and down
  const run = (seconds: number) => {
    for (let i = 0; i < seconds * 20; i++) game.update(0.05, camera, 595, 767)
  }
  const up = (x: number, y: number, z: number) => new Vector3(x, y, z).project(camera).y // 1 is the top edge of the picture
  run(4)
  const cloud = game.things.find((thing) => thing.tip?.startsWith('A grey cloud'))!
  for (let k = 0; k < 12 && game.hint !== cloud.clue; k++) game.nudge()
  run(5)
  assert.ok(up(game.arrow.x, game.arrow.y + 0.4, game.arrow.z) < 0.95, `the arrow over the cloud is off the top of the picture (${up(game.arrow.x, game.arrow.y + 0.4, game.arrow.z).toFixed(2)})`)
  game.visit(cloud.tile)
  run(5)
  assert.ok(up(game.arrow.x, game.arrow.y - 0.4, game.arrow.z) < 0.95, `the cloud is off the top of the picture when the view goes to see it (${up(game.arrow.x, game.arrow.y - 0.4, game.arrow.z).toFixed(2)})`)
}
// A view taken in for a look goes a touch too far and steps back by as much: that is how one can tell it has arrived.
{
  const game = new Island(new Scene(), {} as Element, () => {}, 0) as unknown as Game & { visit(tile: number): void; going?: object }
  const camera = new PerspectiveCamera(30, 1.6, 1, 400)
  const zooms: number[] = []
  const run = (seconds: number) => {
    for (let i = 0; i < seconds * 20; i++) {
      game.update(0.05, camera, 1280, 800)
      zooms.push(game.zoom)
    }
  }
  run(4)
  zooms.length = 0
  game.visit(game.things.find((thing) => thing.tip?.startsWith('A sign.'))!.tile)
  run(6)
  const [most, last] = [Math.max(...zooms), zooms[zooms.length - 1]]
  assert.ok(!game.going, 'the view taken to see a sign never arrived')
  assert.ok(most > last * 1.03 && most < last * 1.06, `the view did not go a touch too far and step back (${most.toFixed(2)} times at most, ${last.toFixed(2)} in the end)`)
  assert.ok(zooms.indexOf(most) < zooms.length - 5, 'the step back was still to come when the view had stopped')
}
// The keys: + comes nearer, on the middle of the view and not on wherever the cursor lies, and − goes back out. A key
// pressed along with ⌘ is the browser's and does nothing here; and when the window loses the keyboard, no key is held.
{
  const game = new Island(new Scene(), {} as Element, () => {}, 0) as unknown as Game & { keys: Set<string>; notes: { known: string }; onKey(e: object): void; onBlur(): void }
  const camera = new PerspectiveCamera(30, 1.6, 1, 400)
  const run = (seconds: number) => {
    for (let i = 0; i < seconds * 20; i++) game.update(0.05, camera, 1280, 800)
  }
  const key = (type: string, key: string, metaKey = false) => game.onKey({ type, key, metaKey })
  run(4)
  key('keydown', '+')
  run(0.5)
  key('keyup', '+')
  const near = game.zoom
  assert.ok(near > 1.5, `half a second of + did not bring the view nearer (${near.toFixed(2)} times)`)
  assert.ok(game.pan.length() < 0.01, `zooming with a key moved the view sideways (${game.pan.toArray().map((v) => v.toFixed(2))})`)
  assert.ok(game.notes.known.includes('z'), 'zooming with a key did not count as having zoomed')
  run(0.5)
  assert.equal(game.zoom, near, 'the view went on zooming after the key came up')
  key('keydown', '-')
  run(0.5)
  key('keyup', '-')
  assert.ok(Math.abs(game.zoom - 1) < 0.02, `half a second of − did not take the view back out (${game.zoom.toFixed(2)} times)`)
  key('keydown', '=', true)
  run(0.5)
  assert.ok(Math.abs(game.zoom - 1) < 0.02, 'a key pressed along with ⌘ zoomed the view')
  key('keydown', 'd')
  game.onBlur()
  run(0.5)
  assert.ok(game.pan.length() < 0.01, 'a key was still held after the window lost the keyboard')
}
console.log('camera: ok')
