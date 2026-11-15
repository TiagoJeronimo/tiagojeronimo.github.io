# The games: what they share, and how to add one

Each game is a small world of cubes on a page of its own. What games share lives in this folder; a game's folder holds
only what is its own. `castle/` is the short example to copy from. `island/` is older and far bigger, and does a few
things its own way (a camera of its own, inside `Island.ts`).

## The kit

| File | What it gives |
| --- | --- |
| `Picture.tsx` | `<Picture>{(tier) => scene}</Picture>`: the canvas, the finish (soft shading, glow, tone) and the pump that draws the frames and gives a slow machine a lighter picture. Optional `near={() => 0..1}` softens top and bottom from close up. Canvas props pass through. |
| `View.ts` | `new View(canvas, land, span, learnt, lift?)`: the camera. Drag moves, right-drag or a twist turns, wheel or pinch zooms to the cursor, keys do all three. `update(dt, camera, width, height)` every frame, `dispose()` at the end. |
| `cubes.ts` | `Cubes(capacity, material, 'wind' \| 'waves'?)`: a pool of boxes in one draw call. `add` returns an index; then `show hide poke paint place size lean drop` by index, `at top on up` to ask, `update(dt)` every frame. `Bits(n)`: loose cubes, `spawn(x, y, z, vx, vy, vz, size, color, life, floor, bounce?, gravity?, gain?)`. Also `unit` (the box), `dirty`, `blown`. |
| `basics.ts` | The palette (`LEAF STONE WOOD BARK WATER LAVA BLOSSOM FRUIT`), `NEAR` and `RING` (a tile's neighbours), `NEVER` (a floor no bit reaches), `rnd(n)` (the same every visit), `any()` (differs every time), `shade(sun, tier)`, `LIGHTEST`. |
| `hints.tsx`, `hints.css` | `<Back />` (the way to the front page), `<Hints known="mz" />` (how to get about, minus what has been done), `FINGERS` (a touch screen). The styles of `.top`, `.sound`, `.hints`. |
| `kept.ts` | `kept(key)`, `keep(key, value)`: what the browser remembers, when it will. |
| `../sound.ts` | `thump()`, `note(height, volume?)`, `setSound`, `toggleSound`. Silent until the visitor turns sound on. |
| `../base.css` | `--bg --ink --accent`, `.btn` (chunky), `.sound` (small and quiet), `.top` (the bar across the top). |

## A new game

1. `games/<name>/index.html`: copy the castle's, change the title, the description and the script's path. Add it to
   `input` in `vite.config.ts`.
2. `src/games/<name>/`: `main.tsx` (copy the castle's), `<Name>Page.tsx`, `<name>.css`, and the world, `<Name>.ts`.
3. The world is a plain class: no React, nothing of the page. It has a `group` to put in the scene, `update(dt)`,
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
  // (A `delta` over 6 is the end of a drag, not a click. What a click does is the game's own.)
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
