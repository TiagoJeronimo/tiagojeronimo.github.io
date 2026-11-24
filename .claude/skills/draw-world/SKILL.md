---
name: draw-world
description: The recipes for how a game's world looks and its creatures move (land, hills, water, trees, creatures, bubbles, light), and the list of what was sent back. Read before drawing or changing a world or a creature in any of the games.
---

# Look and movement: what every game keeps to

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
- A creature that goes over another (a leap) is in the air by a clock of its own, so the same at any frame rate; it
  keeps the ground from where it left to where it lands, the one underneath is held still, and it is never lower than
  the top of whatever it is over. It only sets off when where it will land fits. (`leap`, `vault` in `sheep/Sheep.ts`.)
- A small canvas inside something that pops up from small is measured by its own size (`resize={{ offsetSize: true }}`
  on an r3f `<Canvas>`): measured by what is seen of it, it stays the size it was in the middle of the pop.
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

Performance: `speed.md` beside this file (measure before making anything faster).
