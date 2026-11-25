# The games: what they share

Each game is a small world of cubes on a page of its own. What games share lives in this folder; a game's folder holds
only what is its own. `castle/` is the short example to copy from. `island/` is older and far bigger, and has a camera
of its own (inside `Island.ts`).

- **A new game**: `npm run new-game <name>`, then the skill `new-game` (`.claude/skills/new-game/SKILL.md`).
- **Drawing a world or a creature**: read the skill `draw-world` first (`.claude/skills/draw-world/SKILL.md`: the land,
  water, creatures, bubbles and light; and what was sent back). `speed.md` beside it is for anything about performance.

## The kit

| File | What it gives |
| --- | --- |
| `Picture.tsx` | `<Picture>{(tier) => scene}</Picture>`: the canvas, the finish (soft shading, glow, tone) and the pump that draws the frames and drops to a lighter tier on a slow machine. Soft top and bottom from close up: by itself for a game whose camera is a `View`; the island says how close with `near={() => 0..1}`. |
| `useStage.ts` | `useStage(world, tier, { name, land, span, onKnown, lift?, yaw?, onView? }, step?)`: a `Stage`'s camera, frame loop, shadows and end, in one hook. `step(view, camera, width, height)` runs after the world and the camera have moved. |
| `View.ts` | The camera: drag moves, right-drag or a twist turns, wheel or pinch zooms to the cursor, keys do all three (never a key typed into a text field). `near` is how close it is, 0 to 1. |
| `cubes.ts` | `Cubes(capacity, material, 'wind' \| 'waves'?)`: boxes in one draw call (`add` returns an index; `show hide poke paint place size lean drop`, `update(dt)`). `Bits(n)`: loose cubes (`spawn(...)`). |
| `basics.ts` | The palette, `NEAR` and `RING`, `rnd(n)` (the same every visit), `any()` (differs every time), `shade(sun, tier)`, `ARROW` and `POINTER` (the yellow arrow over what to click). |
| `hints.tsx`, `hints.css` | `<Back />`, `<Hints known="mz" extra={[['s', 'words']]} />` (how to get about plus the game's own lines, each gone once done, with a few specks lifting off as it goes), `<Sound />` (shows "Sound?" until pressed), `<Gear act="…">` (the gear: controls, About me, and the game's own buttons as children; the way to the sheep), `FINGERS`. Styles of `.top`, `.sound`, `.icon`, `.hints`, `.gear`. |
| `postcard.ts`, `Postcard.tsx` | `usePostcard(file, label)` for a page (`onShot` goes to `useStage`, `make(title, line, stamp?)` is the gear's Postcard button, `props` go to `<Postcard scrim />`); `drawPostcard` is the card itself. |
| `useKnown.ts` | `useKnown()` for a page: `[known, learn]` for `<Hints>` (and `onKnown`): the three ways of getting about last for the tab (sessionStorage), a game's own lines only for the visit. `useSeen(known, ready)` is the same for a world that counts for itself (the island). |
| `kept.ts` | `kept(key)`, `keep(key, value)`: what the browser remembers, when it will. |
| `../sound.ts` | `thump()`, `note(height)`, `sfx(what)` (`baa pop tinkle bark jingle`), `music(yes)`, `setSound`, `toggleSound`. Silent until the visitor turns sound on, every visit. A world makes no sound itself: it counts, and its page listens. |
| `tracking.ts` | `gameVisit`, `gameEvents`, `milestones`: analytics events that never block play. |

Signatures are in the files: read the one you use.

## What a world keeps to

- A cute diorama: pastel cubes, soft shadows, nothing grim. Nobody is hurt.
- Nothing floats (when what held a thing up goes, it falls) and nothing clips: no cube sits inside another.
- Whatever answers a click has a label that says what is so now. No sentence where a picture will do.
- `rnd(n)` for what must look the same on every visit, `any()` for what may differ.
- The games are held alike: the same gestures, the same hints, the same corners.
- In a frame: no new objects in a loop, and only changed cubes go to the graphics card (`dirty`).
