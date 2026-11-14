// Run with `npm test`. The castle on its hill, without a browser: soldiers let go over it land where they should and on
// the side they should; they fight as they are meant to; and the camera, asked to go in on the keep, goes to the keep.
import assert from 'node:assert/strict'
import { PerspectiveCamera, Raycaster, Vector2 } from 'three'
import { Castle, REACH, type Kind } from '../src/games/castle/Castle.ts'
import { View } from '../src/games/View.ts'

type Drop = [kind: Kind, x: number, z: number]
/** A new castle, soldiers let go over it, and `seconds` gone by; `each` is asked after every step of them. */
const field = (drops: Drop[], seconds: number, each?: (world: Castle) => void) => {
  const world = new Castle()
  for (const [kind, x, z] of drops) assert.ok(world.drop(kind, x, z), `nowhere to land at ${x}, ${z}`)
  for (let i = 0; i < seconds * 20; i++) {
    world.update(0.05)
    each?.(world)
  }
  return world
}
/** So many of a kind in a row, east to west, south of the castle: on the flat ground, or further out on the floor. */
const south = (n: number, kind: Kind, z = 13): Drop[] => Array.from({ length: n }, (_, k) => [kind, (k - (n - 1) / 2) * 1.5, z])
const walls: Drop[] = [['archer', -2, 3], ['archer', -1, 3], ['archer', 1, 3], ['archer', 2, 3]]
const side = (world: Castle, home: boolean) => world.men.filter((man) => man.home === home).length

// Where they land, and whose they are.
{
  const world = field([['archer', 2, 3], ['sword', 0, 13], ['archer', 0, 7], ['archer', 1, 1], ['sword', 6, 0], ['sword', 0, 22], ['archer', 0, 3]], 0)
  assert.equal(world.drop('sword', 40, 0), false, 'a soldier was let go beyond where there is anything to stand on')
  for (let i = 0; i < 60 && !world.men.every((man) => man.landed); i++) world.update(0.05)
  const [wall, plain, slope, yard, stream, floor, gate] = world.men
  assert.equal(world.men.length, 7, 'somebody who had nowhere to land is in the world all the same')
  assert.ok(world.men.every((man) => man.landed), 'somebody is still falling after three seconds')
  assert.ok(wall.home && yard.home && slope.home && stream.home && !plain.home && !floor.home, 'somebody is on the wrong side: the castle and its hill are the castle\'s; the flat ground, and the floor round it, are not')
  assert.ok(wall.y > yard.y && yard.y > slope.y && slope.y > plain.y && plain.y > floor.y, `wall ${wall.y}, yard ${yard.y}, hillside ${slope.y}, flat ground ${plain.y} and floor ${floor.y} should come in that order, highest first`)
  assert.equal(floor.y, 0, 'the floor round the land is where the land stands, and somewhere to stand')
  assert.ok(Math.abs((stream.y % 1) - 0.5) < 0.01, `let go over the stream, a soldier stands in its bed, half a step down: not at ${stream.y}`)
  assert.ok(Math.round(gate.x) !== 0 || Math.round(gate.z) !== 3, 'a soldier let go over the gate has landed on it: there is nothing there to stand on')
}

// The fight, and what it is about: the cat. With nobody at home, swordsmen break the gate and bring down the keep; the
// cat, which sat on it, runs off; one of them fetches it and carries it up the hill; and the castle, whole again, is
// theirs. The walls they never touched.
{
  let least = 25
  const world = field(south(4, 'sword'), 150, (now) => (least = Math.min(least, now.pieces.length)))
  const cat = world['cat']
  assert.equal(least, 23, `of the 25 pieces of the castle, the gate and the keep should have come down and nothing else: at one time ${least} stood`)
  assert.ok(world.owner === 1 && world.owners === 2, `the castle should have changed hands, once: it is the ${['first', 'second'][world.owner]} colour's, and has had ${world.owners} owners`)
  assert.equal(world.pieces.length, 25, 'with the cat home, the castle should have put itself together again')
  assert.ok(!cat.loose && !cat.by && cat.y > 10, `the cat should be back up on the keep, and is at ${cat.x}, ${cat.y}, ${cat.z}`)
  assert.ok(world.men.length === 4 && world.men.every((man) => man.home), 'the four who took the castle should all be there, and the castle\'s now')
}
// A picnic. Whoever is near one sits down at it, of either colour; when everybody has, it is peace; nobody has been
// hurt; and the cat has come down for it too.
{
  const world = field([['sword', 0, 8], ['archer', 1, 7], ...south(3, 'sword', 12), ['picnic', 2, 10]], 30)
  const cat = world['cat']
  assert.ok(world.peace, 'two of the castle and three against it, a picnic between them, and no peace')
  assert.ok(world.men.length === 5 && world.men.every((man) => man.sat && man.mood === 'sit' && man.hp === (man.kind === 'sword' ? 4 : 2)), 'somebody is not sitting at the picnic, or was hurt on the way to it')
  assert.ok(Math.hypot(cat.x - 2, cat.z - 10) < 1, `the cat should be at the picnic, and is at ${cat.x}, ${cat.z}`)
  assert.equal(world.drop('picnic', 10, 0), true, 'a picnic let go over the pond should come down beside it')
  assert.ok(world['picnics'][1].z !== 0, 'a picnic has been let go into the water')
}
// With nothing to do, they find themselves something: to fish, to sleep, or to sit. And nobody leaves a wall for it.
{
  const world = field([['sword', 6, 2], ['sword', 7, -2], ['archer', 5, 3], ['sword', -6, 5], ['archer', -7, -3], ['archer', 2, 3], ['sword', 0, 1]], 25)
  // (Not quite all of them, always: one that has just had a sheep come by and patted it is on its feet again for a bit.)
  assert.ok(world.men.filter((man) => man.mood).length >= 5, `after half a minute of nothing, most should have found something to do: ${world.men.map((man) => man.mood || 'up')}`)
  assert.ok(world.men[5].mood === 'sit' && world.men[5].y > 8, 'the archer on the wall should be sitting on the wall')
}
// Swordsmen can do nothing to archers on a wall, who shoot them down from it: in the end, all of them.
{
  const world = field([...south(6, 'sword'), ...walls], 120)
  assert.equal(side(world, false), 0, 'two minutes under four bows, and there are swordsmen left')
  assert.equal(side(world, true), 4, 'an archer on the wall has gone, with nobody there who could reach it')
}
// A swordsman each, one on the hillside and one below it: they meet, and one of them is left.
{
  const world = field([['sword', 0, 8], ['sword', 0, 13]], 40)
  assert.equal(world.men.length, 1, `of two swordsmen who should have met, ${world.men.length} are left`)
}
// And through a whole battle, the castle taken and put together again and all, everybody is somewhere: on ground
// there is to stand on, and not in a wall, a tree or the sky. So are the animals: the sheep on their grass, the ducks
// on their pond.
field([...south(8, 'sword'), ...south(4, 'archer', 15), ...south(3, 'sword', 21), ...walls, ['sword', -1, 1], ['sword', 0, 1], ['sword', 1, 1], ['archer', -3, -3], ['sword', 4, 7]], 120, (world) => {
  const tile = (it: { x: number; z: number }) => Math.round(it.x) + REACH + (Math.round(it.z) + REACH) * (2 * REACH + 1)
  for (const man of world.men) {
    assert.ok(Number.isFinite(man.x + man.y + man.z), 'somebody is nowhere')
    const floor = world['stand'][tile(man)]
    assert.ok(floor >= 0, `somebody stands at ${man.x}, ${man.z}, where there is nothing to stand on`)
    assert.ok(!man.landed || Math.abs(man.y - floor) < 2.3, `somebody at ${man.x}, ${man.z} is at ${man.y}, and the ground there at ${floor}`)
  }
  for (const sheep of world['sheep']) assert.ok(world['pasture'](tile(sheep)), `a sheep is at ${sheep.x}, ${sheep.z}, which is no place for a sheep`)
  for (const duck of world['ducks']) assert.ok(Math.abs(duck.x - 10.5) < 0.6 && Math.abs(duck.z) < 1, `a duck has left the pond for ${duck.x}, ${duck.z}`)
  assert.ok(Number.isFinite(world['cat'].x + world['cat'].y + world['cat'].z), 'the cat is nowhere')
})

// The castle comes down a part at a time, from the top, and nothing of it is left in the air.
{
  const world = new Castle()
  const tile = (x: number, z: number) => x + REACH + (z + REACH) * (2 * REACH + 1)
  const high = (x: number, z: number) => +(world['roof'][tile(x, z)] - 6).toFixed(2)
  const blows = (x: number, z: number, n: number) => Array.from({ length: n }, () => (world['chip'](world['on'][tile(x, z)]!, x, 7, z), high(x, z)))
  // A stretch of wall: its two teeth take two blows each, and then its four courses, the highest first, two each.
  assert.deepEqual([high(-2, 3), ...blows(-2, 3, 12)], [2.2, 2.2, 2.2, 2.2, 2.2, 2.2, 1.65, 1.65, 1.1, 1.1, 0.55, 0.55, 0], 'a stretch of wall should lose its teeth and then come down a course at a time')
  assert.equal(world['on'][tile(-2, 3)], undefined, 'twelve blows, and the stretch of wall is still there')
  // The stretch of wall over the gate is held up by the walls beside it: one is enough, and with neither it falls, and
  // the door that hung in it falls too, though nobody has touched the door.
  blows(-1, 3, 12)
  assert.equal(world['arch'].length, 3, 'the wall over the gate fell with one of the two walls beside it still standing')
  blows(1, 3, 8)
  assert.equal(world['arch'].length, 0, 'the wall over the gate is in the air: neither wall beside it reaches up to it')
  assert.ok(!world['on'][tile(0, 3)] && world['stand'][tile(0, 3)] === 6, 'the door stands by itself, with nothing left for it to hang in')
  assert.equal(world.pieces.length, 22, 'two stretches of wall and the gate should be gone, and nothing else')
}

// The camera. With the cursor on the top of the keep, the wheel brings the view in on the keep, which stays under the
// cursor, and stops short of it. (Taken to be on the flat ground, as on the island, the cursor was on the grass behind
// the castle, and the camera went there: through the keep.)
const world = new Castle()
const [W, H] = [1280, 800]
Object.assign(globalThis, { addEventListener() {}, innerWidth: W, innerHeight: H })
const canvas = {} as HTMLElement
const view = new View(canvas, world.solid.mesh, REACH, () => {}, 60) // lifted as on the castle's page
const camera = new PerspectiveCamera(30, W / H, 1, 400)
const frames = (n: number) => {
  for (let i = 0; i < n; i++) view.update(0.016, camera, W, H)
}
frames(1)
const [x, y] = [648, 150] // where the keep's top is drawn at the start
const ray = new Raycaster()
ray.setFromCamera(new Vector2((x / W) * 2 - 1, 1 - (y / H) * 2), camera)
const keep = ray.intersectObject(world.solid.mesh)[0].point.clone()
assert.ok(keep.y > 10, `the cursor was meant to be on the keep, and is on something ${keep.y} high`)
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
