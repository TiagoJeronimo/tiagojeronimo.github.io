# The sheep: "Buy me a sheep", at `/games/sheep/` (steps 1 to 3 of `PLAN.md`: built, not yet on the front page)

A small island in the castle's manner: a meadow with a high knoll, a pond with a duck on it, a mountain at the back
(a lumpy heap of rock with grass round its foot), a brook that runs out of the rock and down to the pond over little
steps, trees (some in blossom), rocks, a fence with two bales; twenty made-up sheep going about at a hop; and one
more in a lit cave in the back of the mountain.
A visitor can dress a sheep of their own and put it in the field, for nothing and in their own browser only. Built
with `VITE_SHEEP_API` set (the address of `sheep-api/`, the server of step 3), the page pays through Stripe and shows
everybody's sheep instead; the live site is built without it until step 5 of `PLAN.md`, which still holds the plan. How it looks
and how they move follows `../AGENTS.md`, "Look and movement": the first version did not, and was sent back.

## Files

| File | What |
| --- | --- |
| `Sheep.ts` | The world, no React. At its top: the numbers (`REACH SPAN ROUND REGROW DAY SLEEP WAKE HOP STEPS GLAD STONY SNOWY`); the water and the things by tile (`BROOK LAKE DUCK FENCE BALES CAVE FLOOR ROOF`); the land, worked out once (`LAND` heights, `ROCK` bare stone, `KIND` 1 ground 2 brook 3 pond 4 cave, `BLOCK`, `TREES ROCKS SHORE FALLS`); the parts (`EWE`, `BODY`, `HEAD`, and the scenery's). Then the class. |
| `dress.ts` | No three, no page: `WOOL` (the wools), `WEARS` (`hat bell scarf flowers`), `Look` (`{ wool?, wear? }`), `NAME` and `MESSAGE` (24 and 80 letters), `fit(look)` and `tidy({ name, message, look })`, which says what a giver may write (no links, plain words); the gift (`LEAST MOST CURRENCY`), a new sheep's number (`newId isId`) and its seed (`seedOf`). The server (`sheep-api/`) imports all of it. |
| `flock.ts` | The sheep there are: `{ id, seed, name, message, date, look? }`. Index in `FLOCK` is the sheep's index in `world.ewes`. And `RECLUSE`, the one in the cave, which is not in `FLOCK`: its line is a placeholder (a `TODO` there) until the owner writes it. |
| `SheepPage.tsx`, `sheep.css` | The page: `Stage`; a click on a sheep (it hops, and a bubble sits over it: name, message, date, what it is doing now and what it has on); the button in the top bar, the card to dress a sheep (`.dress`), the line while one is being put down (`.place`); and this browser's own sheep, kept under `sheep/mine` (`mine`), or with a server (`API`) everybody's (`herd`), the checkout, and the wait for a sheep Stripe has not told the server about yet (`waiting`, `late`). |

## The world from outside

`new Sheep(list?, seed?)`; `update(dt)`, `shadows(tier)`, `dispose()`. A new sheep: `add(entry)` puts one straight in;
`bring(entry, x?, z?)` hangs one in the air (`guest`), `dress(look)` and `sign(entry)` change it, `hang(x, z)` moves it
over the nearest place it fits, `drop(x?, z?)` lets it go (it is in `ewes` from then, and the number comes back),
`dismiss()` sends it away, `room()` says whether there are cubes for one more. For the page: `pick(instance)`, `glad(i)`,
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
- A look: `wool` is a place in `WOOL` (else the seed picks), `wear` one of `WEARS`. What is worn is up to three more
  boxes (`WORN`), on the three cubes every sheep keeps for it (`SLOTS`), drawn by the same `draw`: on the head and no
  further back than it (hat, flowers, the bell under an ear), or on the back with the body (the scarf). `BODY` is a
  little wider than the wool, for the scarf's end. The test's whole day has all four in the field.
- Buying, for now (`SheepPage.tsx`): the button brings a sheep to hang where the visitor is looking, up in the sky
  (`ALOFT`, 6 over the grass), with the yellow arrow of `../basics.ts` bobbing over it and a yellow frame on the
  ground where it would land; the view goes in on it as near as `View`
  goes, and in an upright window looks a little under it, so that it is clear of the card. The card dresses it there.
  (Typing in the card does not move the view: `View.ts` leaves keys typed into a text field alone.) "Put it in the field" is the stand-in for paying: `tidy`, the entry kept
  in this browser, the address made `?sheep=<id>` as Stripe's return will make it, and the sheep hangs from the
  cursor at the same height, the view out again and down to the grass, always over a place it could stand. A click drops it (`drop`: it falls from there under `GRAVITY`, by how long it has
  fallen and so the same at any frame rate; then a puff, a heart, a hop), its bubble
  opens, and the address is put back. A page loaded with `?sheep=<id>` of a kept sheep starts at the hanging. The
  place is not kept: on the next visit the sheep stands where its seed says. The field has cubes for `SPARE` (8)
  more sheep than it began with; after that the button says the field is full.
- The day is `DAY` seconds: bright, dark in the middle (`dark`); sheep lie down above `SLEEP`, get up below `WAKE`.
- With a server (`VITE_SHEEP_API`): the page waits for `GET /sheep` before it builds the field (the made-up flock if
  none come back); a new sheep's number is `newId` and its seed `seedOf` it; "Put it in the field" posts the sheep and
  the gift (an input in euros, `LEAST` to `MOST`) to `/checkout` and goes to Stripe's page; back at `?sheep=<id>`, that
  sheep hangs to be dropped, or if it is not in the list yet the page asks again for 15 s (`waiting`) and then says
  so (`late`). Nothing is kept in this browser then.

## Still to do

Steps 4 and 5 of `PLAN.md`; a card on the
front page (not until the owner says); his own sheep in `flock.ts`. For the owner to judge: every default of steps 2 and 3,
listed in `PLAN.md`.
Not yet judged by the owner: round 3 (the heaped mountain, water as cubes, sheep without eyes, the cave). The cave sheep's line is his to write. Known and left: legs pass through blades of grass, as in the castle.
