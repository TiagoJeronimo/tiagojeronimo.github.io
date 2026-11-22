# The sheep: "Buy me a sheep", at `/games/sheep/` (step 1 of `PLAN.md`: built, not yet on the front page)

A small island in the castle's manner: a meadow with a high knoll, a pond with a duck on it, a mountain at the back
(a lumpy heap of rock with grass round its foot), a brook that runs out of the rock and down to the pond over little
steps, trees (some in blossom), rocks, a fence with two bales; twenty made-up sheep going about at a hop; and one
more in a lit cave in the back of the mountain.
No payments, no server, no dressing yet: those are steps 2 to 5 of `PLAN.md`, which still holds the plan. How it looks
and how they move follows `../AGENTS.md`, "Look and movement": the first version did not, and was sent back.

## Files

| File | What |
| --- | --- |
| `Sheep.ts` | The world, no React. At its top: the numbers (`REACH SPAN ROUND REGROW DAY SLEEP WAKE HOP STEPS GLAD STONY SNOWY`); the water and the things by tile (`BROOK LAKE DUCK FENCE BALES CAVE FLOOR ROOF`); the land, worked out once (`LAND` heights, `ROCK` bare stone, `KIND` 1 ground 2 brook 3 pond 4 cave, `BLOCK`, `TREES ROCKS SHORE FALLS`); the parts (`EWE`, `BODY`, `HEAD`, and the scenery's). Then the class. |
| `flock.ts` | The sheep there are: `{ id, seed, name, message, date }`. Index in `FLOCK` is the sheep's index in `world.ewes`. And `RECLUSE`, the one in the cave, which is not in `FLOCK`: its line is a placeholder (a `TODO` there) until the owner writes it. |
| `SheepPage.tsx`, `sheep.css` | The page: `Stage`, a click on a sheep (it hops, and a bubble sits over it: name, message, date, and what it is doing now). |

## The world from outside

`new Sheep(list?, seed?)`; `update(dt)`, `shadows(tier)`, `dispose()`. For the page: `pick(instance)`, `glad(i)`,
`doing(ewe)`, `ewes`, `hermit` (the cave's sheep: `pick` says `HERMIT`, -2, for it), `sky`, `dark`, `time`, `ground` (what the camera points at), `flock`. For tests: `height(x, z)`
(the bed, under water), `pond`, `blocked`, `long`, `bite`, `fits`, `bites`. In the dev server: `window.sheep`, `window.view`.

## How it goes

- A sheep's seed gives its wool, size (0.8 to 1), pace, nature (`greedy swimmer nosy follower`) and where it starts,
  through `rnd`: every visitor sees the same. Only what it does is by `chance()` from the world's seed, so a test can
  play a day again. (Petals, foam and dreams are `Math.random`: they decide nothing.)
- `fits(self, s, face, x, z)` is the one rule of where a sheep is: its body and head rectangles over level ground
  (`LAND` 1) or the brook, the body not over the pond (the head may be: that is how it drinks), off every `BLOCK`ed
  tile (trees, rocks, fence, bales, stump, reeds) and clear of every other sheep. No step or turn is made that does
  not fit, so nothing clips; `test/sheep.test.ts` proves it on the cubes.
- `choose` picks what to do: hungry, the long grass under its nose or the nearest; thirsty, the nearest free place
  in `SHORE`; then by nature (swimmers stand in the brook, followers and the nosy go up to a friend, and both hop
  when they meet); sometimes it only looks about; else it wanders. `go` sets off, `walk` takes a step, `arrived`
  and `rest` end it. A way is across then along (or the other way about): it goes the way it looks, turns standing
  between hops, and where the way is shut (`balk`) takes the other leg or stops. Given up after 16 seconds.
- `draw` puts the cubes: all of it up together at a hop (`stride`, `hop`), each leg down to what is under it (in the
  brook, to the bed, and all of it lower: see below), head down by `nod` to graze or drink, folded up by `lie` to sleep, ears up for a
  moment now and then (`flick`). A sheep that has not changed sends nothing to the graphics card (`mark`).
- Grass: level tiles with nothing on them. A bite (`bite`, the tile under the head) paints the slab `SHORT` and
  hides its blades and flowers; all are back after `REGROW` seconds and up to 15 more.
- A sheep is 11 boxes, on purpose few: legs, one box of wool, a short tail, a big dark head with a tuft of wool, low
  ears, a pink nose. No eyes (the owner had them taken off): it shows what it feels by moving, and its ears flick.
- The mountain is a round heap inside the edge (`mount` in the land), a step at a time on every side, so no face of
  it is wide and flat and grass lies round its foot. Its stone (`ROCK`: the mountain from `STONY` up) is clean grey,
  with lumps and loose stones on it and rubble on the grass below: no moss, no grass, no flowers; snow from `SNOWY`.
- Water is the island's (`Island.ts`, where a bed is laid): a whole tile of it to the tile, 0.44 deep on a bed, in the
  same see-through `'waves'` material. The pond is that and the brook is that too, a tile wide, both with whole tiles for edges
  as on the island: no small pieces of bank cut into corners (the owner asked what they were). Reeds stand in the
  water at some of the pond's outward corners, and no sheep puts its head over those tiles. The brook starts in the rock and goes down one step at a time; a tile it steps down from
  (`DEEP`) holds a whole cube of water, down to the water below, so it comes down as blocks one under the next. No
  thin sheet, no drops streaming: a fleck of foam at each step now and then. No rock within three tiles of the
  fence and the hay.
- The brook can be waded: `height` gives its bed, and a sheep wholly in it stands 0.3 lower, up to its wool (`draw`).
- The cave is `CAVE`, four tiles in the back of the mountain: a floor at `FLOOR`, a hollow, rock over and round it at
  uneven heights, a step of grass before its mouth. In it a bed of hay, a stone, a lantern and two toadstools that
  glow, and a warm `PointLight`. Its sheep is drawn by the same `draw` (on `base`, its floor), hops when clicked,
  and never moves: `fits` and the flock know nothing of it.
- The day is `DAY` seconds: bright, dark in the middle (`dark`); sheep lie down above `SLEEP`, get up below `WAKE`.

## Still to do

Steps 2 to 5 of `PLAN.md`; a card on the front page (not until the owner says); his own sheep in `flock.ts`.
Not yet judged by the owner: round 3 (the heaped mountain, water as cubes, sheep without eyes, the cave). The cave sheep's line is his to write. Known and left: legs pass through blades of grass, as in the castle.
