# The games: what they share, and how to add one

Each game is a small world of cubes on a page of its own. What games share lives in this folder; a game's folder holds
only what is its own. `castle/` is the short example to copy from. `island/` is older and far bigger, and does a few
things its own way (a camera of its own, inside `Island.ts`).

## The kit

| File | What it gives |
| --- | --- |
| `Picture.tsx` | `<Picture>{(tier) => scene}</Picture>`: the canvas, the finish (soft shading, glow, tone) and the pump that draws the frames and gives a slow machine a lighter picture. From close up the top and bottom of the picture go soft, as in a photograph of something small: by itself, for a game whose camera is a `View` (it asks the page's view how close it is). A game with a camera of its own (the island) says how close with `near={() => 0..1}`. Canvas props pass through. |
| `View.ts` | `new View(canvas, land, span, learnt, lift?)`: the camera. Drag moves, right-drag or a twist turns, wheel or pinch zooms to the cursor, keys do all three (but never a key typed into a text field: a page with an input needs no guard of its own). `update(dt, camera, width, height)` every frame, `dispose()` at the end. `near` is how close it is, 0 to 1 (`close(dist)`, the island's measure: 0 from 34 away, 1 from 14); `viewing()` is the page's view, which `Picture` asks. |
| `cubes.ts` | `Cubes(capacity, material, 'wind' \| 'waves'?)`: a pool of boxes in one draw call. `add` returns an index; then `show hide poke paint place size lean drop` by index, `at top on up` to ask, `update(dt)` every frame. `Bits(n)`: loose cubes, `spawn(x, y, z, vx, vy, vz, size, color, life, floor, bounce?, gravity?, gain?)`. Also `unit` (the box), `dirty`, `blown`. |
| `basics.ts` | The palette (`LEAF STONE WOOD BARK WATER LAVA BLOSSOM FRUIT`), `NEAR` and `RING` (a tile's neighbours), `NEVER` (a floor no bit reaches), `rnd(n)` (the same every visit), `any()` (differs every time), `shade(sun, tier)`, `LIGHTEST`; `ARROW` and `POINTER`, the boxes and colour of the yellow arrow that stands over what to click. |
| `hints.tsx`, `hints.css` | `<Back />` (the way to the front page), `<Hints known="mz" />` (how to get about, minus what has been done), `<Sound />` (the sound's button, with its "Sound?" label until pressed), `FINGERS` (a touch screen). The styles of `.top`, `.sound`, `.icon`, `.nudge`, `.hints`. |
| `kept.ts` | `kept(key)`, `keep(key, value)`: what the browser remembers, when it will. |
| `../sound.ts` | `thump()`, `note(height, volume?)`, `setSound`, `toggleSound`. Silent until the visitor turns sound on. |
| `../base.css` | `--bg --ink --accent`, `.btn` (chunky), `.sound` (small and quiet), `.top` (the bar across the top). |

## A new game

1. `games/<name>/index.html`: copy the castle's, change the title, the description and the script's path. Add it to
   `input` in `vite.config.ts`.
2. `src/games/<name>/`: `main.tsx` (copy the castle's), `<Name>Page.tsx`, `<name>.css`, and the world, `<Name>.ts`.
3. The world is a plain class, and looks and moves as "Look and movement" below says: no React, nothing of the page. It has a `group` to put in the scene, `update(dt)`,
   `dispose()`, and `shadows(tier)`, which calls `shade(this.sun, tier)`. It is built of `Cubes` and `Bits`.
4. The page is the skeleton below, with the game's own buttons round it.
5. `test/<name>.test.ts`, added to `test` in `package.json`: make the world in node, step it with `update(0.05)`,
   and check what came of it. This is where the rules of the game are proved, not in a browser.
6. A card: an entry in `src/home/projects.ts` with `kind: 'games'`, and the page's address in `GAMES` in
   `src/home/Home.tsx` (that gives the card its Play button, and phones their notice).
7. Notes: `src/games/<name>/AGENTS.md`, a `CLAUDE.md` beside it that says `@AGENTS.md`, a row in the root table.

```tsx
function Stage({ tier, onKnown }: { tier: number; onKnown: (known: string) => void }) {
  const world = useMemo(() => new World(), [])
  const gl = useThree((state) => state.gl)
  const view = useRef<View>(null)
  useEffect(() => {
    const held = (view.current = new View(gl.domElement, world.solid.mesh, REACH, onKnown))
    return () => held.dispose()
  }, [gl, world, onKnown])
  useEffect(() => () => world.dispose(), [world])
  useEffect(() => world.shadows(tier), [world, tier])
  useFrame(({ camera, size }, dt) => {
    world.update(Math.min(dt, 0.05))
    view.current?.update(Math.min(dt, 0.05), camera as PerspectiveCamera, size.width, size.height)
  })
  // (A `delta` over 6 is the end of a drag, not a click. What a click does is the game's own. The softening of the
  // picture from close up needs nothing here: `Picture` asks the `View` that was just made.)
  return <primitive object={world.group} onClick={(event: ThreeEvent<MouseEvent>) => event.delta <= 6 && world.touch(event.point)} />
}

export default function Page() {
  const [known, learn] = useReducer((had: string, more: string) => had + more, '', () => kept('<name>/known'))
  useEffect(() => keep('<name>/known', known), [known])
  return (
    <main>
      <Picture>{(tier) => <Stage tier={tier} onKnown={learn} />}</Picture>
      <Hints known={known} />
      <header className="top">
        <Back />
      </header>
    </main>
  )
}
```

## What a world keeps to

- A cute diorama: pastel cubes, soft shadows, nothing grim. Nobody is hurt: in the castle an arrow makes somebody jump.
- Nothing floats: when what held a thing up has gone, it falls. Things break in small parts, not all at once.
- Nothing clips: no cube sits inside another.
- Whatever answers a click has a label, and the label says what is so now: change it when the thing changes.
- No sentence where a picture will do. The castle says what each side wants in a bubble with a picture in it.
- `rnd(n)` for what must look the same on every visit (scenery), `any()` for what may differ (a puff of leaves).
- The games are held alike: the same gestures, the same hints, the same corners. A new one keeps in step.

## Look and movement: what every game keeps to

Taken from the castle and the island, and from what the owner has said more than once. The castle (`castle/Castle.ts`)
is the pattern and `sheep/Sheep.ts` the short copy of it: take the recipe from there, do not think up another.

**The land**

- A tile is a column of `SOIL` (`0xba936d`) with a slab 0.25 thick on top: grass in one of three greens
  (`0x8fd16b 0x9fd872 0xb4de6e`) taken by `rnd(tile)`. Never one plain block a tile, never stripes or a chequer.
- An island: its edge is round and frayed tile by tile (`hypot` plus `rnd`), and its sides show the soil.
- Hills go up in whole steps, pushed in and out by a slow swell (`swell` in `lay`) with a little say for every tile:
  broad shelves here, a steep bank there. Grass most of the way up; stone and snow only at the very top.
- On the grass: blades (0.09 wide, 0.2 tall) and flowers on them, by `rnd`, all `bendy` in a `Cubes(..., 'wind')`.
- A pond is a hand-drawn list of tiles, never a rectangle: a bed, water nearly to the top, lily pads, reeds standing
  in it. It is round by how its whole tiles are laid, not by cut corners. Something lives on it.
- Trees are the castle's `TRUNK` (a trunk and two boxes of `LEAF`, some in `BLOSSOM`), rocks its `BOULDER`. Stone
  is clean grey, tiles and boulders alike: no moss, no grass, no flowers on it. No tree stumps.
- Water is the island's recipe (`island/Island.ts`: `this.wet.add(x, top + 0.22, z, 1, 0.44, 1, ...)` on a bed), for
  ponds and brooks alike: a whole tile of it to the tile, 0.44 deep, in a `Cubes(..., 'waves')` of roughness 0.15 and
  opacity 0.72. Down a slope it goes one step at a time, and the tile it steps down from holds a whole cube of water
  down to the water below: full blocks, one under the next (`sheep/Sheep.ts`, `DEEP`). Never a thin strip, a thin
  see-through sheet hung on a face, or drops streaming down. It starts somewhere: out of rock. Its edges are whole tiles, as
  on the island: no small cut pieces of bank. (The castle's brook is narrow, cut in nine, with pieces of bank in its
  pond's corners and drops for falls: the owner has since asked for the island's whole blocks instead.)
- A hill is high, several steps, and a heap: it comes down to the grass a step at a time on every side, lumpy, with
  rubble at its foot. No face of rock more than a tile or two wide and flat, no spur or slab sticking out, no sheer
  back: look at it from behind too.
- Detail means small things and life (a fence, bales, toadstools, a duck, petals, something to find), not finer cubes. Things
  come right up to what they stand by; nothing floats, and no cube is inside another.
- Size the land to who lives on it: they must read at the first zoom. A sheep on a land 45 tiles wide is a dot.

**Who lives there**

- Cubes do not turn. A creature is a list of parts looking along, drawn at one of four quarter turns (`TURNS`,
  `turned`). Few boxes, each one something, and a face that reads from the first zoom: a dark head on pale wool,
  a nose, ears. Eyes are not needed (the sheep had theirs taken off): feeling shows in movement. Six plain boxes are not a creature, and neither is one with fiddly extras on its back.
- It goes at a hop, all of it together, legs too: lifted by `|sin(stride * PI)| * 0.14`, `stride` growing by 1.5 for
  every tile gone, 0.6 to 0.85 tiles a second. Stopping, it finishes the hop it is in; it does not snap down.
- It goes the way it looks, and only that way: across, then along. It turns between two hops, standing. Where the way
  is shut it goes round by the other leg of the way, or stops and thinks again. It never slides sideways.
- It gathers speed and loses it. It stands about for whiles that are never the same twice.
- It is never quite still for long: it looks about, flicks an ear, nods as it eats; asleep it is folded on the
  ground. A click, or good news, is a hop for joy (`hop`, 0.5 s, 0.3 high).
- Where it may be is one rule (`fits`): rectangles of ground against the land, what stands on it, and everybody
  else. No step or turn is made that does not fit. The test proves it on the cubes themselves: no two boxes of
  different creatures overlap, none is below the ground, through a whole day (`test/sheep.test.ts`).
- What answers a click says so: a bubble or a tag right on it, moving with it. Pictures before sentences.
- Two tiles of see-through water side by side, each a box of its own, show the join between them (each draws its
  sides inside the water). Where that matters, draw the tops as one mesh and no sides between them (`pour` in
  `sheep/Sheep.ts`); the island and the castle still use a box a tile.
- Creatures that do things together hold each other by one link that both ends let go of together (`mate`, `part` in
  `sheep/Sheep.ts`), and whatever play they are at is the same walk, only faster. What one thinks is a small picture
  in a bubble over its head for a moment (see "Bubbles"), never a word.
- Nothing marks where a click on the ground will act: no frame on a tile, no lit square, nothing at the cursor. And a
  click that cannot act exactly where it was made acts at the nearest place that it can: nobody is told no because
  something is in the way. (The yellow arrow is for a thing to click, and stays.)
- The light of a day changes slowly, through a table of stops (`LIGHT` in `sheep/Sheep.ts`): no jump in strength or
  colour from one frame to the next, a visible dawn and dusk, and the day ends as it began. A page that is loaded
  again goes on with the time of day it had.
- A click on the open ground does something small of its own (in the sheep's field it plants a tuft of grass, which
  the sheep then run for): on what can take it, at once and with a bounce; on what cannot, a small puff and no
  words. What follows is the creatures' doing, by the same walk and the same rules, and differs with who they are.
- A creature that is shown somewhere else than in its world (a window to dress it in) is drawn by the same code from
  the same parts (`sheep/model.ts`, used by `Sheep.ts` and `Fitting.tsx`): never a second model. A small plain
  canvas of its own for that is cheap; it has none of the finish.
- What a creature wears is more parts on the same model, drawn by the same code: it hops, bows and lies down with
  it, sits in none of its boxes in any pose, and is inside the rectangles `fits` goes by (`WORN` in `sheep/Sheep.ts`).

**Bubbles**

A bubble over a creature is a thing in the world, made of cubes, and it is the island's (`BUBBLE` and `ICONS` in
`island/wishes.ts`; copied box for box as `BUBBLE` and `THINK` in `sheep/Sheep.ts`, where `bubbles` draws them from a
small pool): paper white (`0xfffdf6`), a slab with its corners taken off (a wide box with a narrower one above and
below), two crumbs of it trailing down to whoever it belongs to, and on it a picture of a few boxes that stand a
little proud of the paper, plain enough to read from a way off. No words in it. It is lit and shadowed like
everything else; it pops up, bobs (`sin(time * 2)`, a few hundredths) and breathes (`sin(time * 3)`, a few
hundredths of its size) and pops away; it floats over its owner's head and goes with it. On the island it turns to
face the camera; where it is of `Cubes`, which do not turn, it faces the quarter turn nearest the camera. It is in
nothing: over its own creature, above everybody's head, and not there when another bubble or something flying is
too near; a test proves it on the cubes. A handful at once at the most. Only a bubble with words in it (a sheep's
name and message) is on the page, since words cannot be cubes: the same paper and the same two crumbs, in CSS
(`.bubble` in `sheep/sheep.css`). The castle's asks (`.ask` in `castle/castle.css`) are older, round, on the page.
The two recipes are a list of boxes each and a dozen lines to place them, in two worlds that draw cubes differently
(the island's animals turn, `Cubes` do not): they are copied, not shared.

**Do not** (the first field of sheep did all of these, and was sent back)

- a wide flat square of one block a tile, a straight band of tinted blocks for a river, hills as a wall of blocks;
- three trees and nothing else: no blades, no flowers, nothing left lying about, nothing alive but the cast;
- a land so big that the creatures are specks;
- creatures of six boxes with no face, gliding at one speed with a bob too small to see;
- sliding sideways along what is in the way, turning in mid-step, stopping and starting dead;
- pauses all of one length, and nothing happening in them.

## Speed

Measured on the island, late in a game, on an M1 Pro in a window of 1920 by 1080:

- A frame costs 23 ms at step 0, then 14, 10, 8 and 4 to 5. Of the full picture about half is the soft shading, a
  third the smoothing of edges, an eighth the shadows. The game's own work is under 1 ms; loose bits cost nothing
  that can be measured.
- So a new pass in the finish is dear, and fewer particles or cleverer logic buy nothing: measure before either.
- In a frame: no new objects in a loop (keep scratch vectors at the top of the file, as `cubes.ts` does), and only
  the cubes that changed are sent to the graphics card (`dirty`).
- To measure, in the dev server: `tier(n)` sets a step and `paint()` draws one frame. Stop the pump with
  `window.requestAnimationFrame = () => 0`, then time `paint()` followed by a `readPixels` of one pixel, in a loop
  (`gl.finish()` does not wait in Chrome, and frames a second in a headless browser are not to be trusted). A machine
  with no graphics card is Chrome started with `--use-angle=swiftshader --enable-unsafe-swiftshader`.
