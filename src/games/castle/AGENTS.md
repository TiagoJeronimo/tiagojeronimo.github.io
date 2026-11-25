# The castle: "Castle", at `/games/castle/`

A war that gets nowhere, and the one who feeds both sides of it. The castle's six stand on its wall; the camp's six
charge it and go back to their fire; nobody is hurt. With every charge both sides ask the helper for things, in
pictures. What does not come in time makes one of them sit down under a rain cloud; what comes gets one up again. A
side with nobody standing gives up, and the day is lost. It is won by a wedding: in the quiet after each charge the
princess or the prince asks for something too, and when all of it has been brought and the musician is taken to the
gate, they marry.

## Files

| File | What |
| --- | --- |
| `Castle.ts` | The world, no React. At its top: the numbers to tune (`LULL CHARGE WAIT ROUNDS HAT GIFTS PACE SOW BAKE SONG DAY`); `PLAN`, the castle from above, a character a tile; `lay`, which works out the land round it once (`BROOK LAKE BRIDGE` are its water); and where everything else stands (`FIELD STOVE RACK TRAY TENT BOARD WINCH SEATS POSTS` and more). Then the class. |
| `CastlePage.tsx` | The page: `Stage` (the world, the camera, the clicks); a bubble over whoever is asking, which stays at the window's edge and points when its place is out of sight; a tag over the helper and one over each place things are put by; the sun along the top; the end of the day. |
| `castle.css` | The bubbles, the tags, the day, the end. The corners come from `../hints.css`. |

## The world from outside

`click(cube, x, z)` and `hover(cube, x, z)` are for the page; `serve(ask)` sends the helper to whoever asked.
`order(id)` puts a thing on his list, four at most: `TREE + i`, `ROCK + i`, `PLOT + i`, `FLOWER + i`, `OVEN`,
`LOGS`, `HEAP`, `HEARTH`, `BASKET`, `TABLE`, `PRINCESS`, `PRINCE`, `MUSIC`, `CAT`, `DUCK`, `APPLE`, `WED`. Then
`update(dt)`, `shadows(tier)`, `dispose()`; `start()` ends the dawn (see below). To read: `begun`, `asks`, `time`, `over` (`castle`, `camp` or `wedding`), `love`,
`phase`, `round`, `standing(side)`, `piles`, `kept`, `doused`, `me`, `tune`, `trees`, `rocks`, `plots`, `flowers`,
`oven`, `cat`, `ducks`, `men`. `new Castle(seed)`: the same seed, the same askings.

## How it goes

- The helper carries up to `HAT` things, one on another (`me.loads`, drawn by `stack`). A job is walked to (`way`,
  `walk`); there `begin` says how long it takes, or that it cannot be done, and he shakes his head; then `finish`
  does it. `order` refuses at once what plainly cannot work. At the basket, the table, the princess or the prince he
  hands over everything he has that is wanted there (`hand`).
- A side takes only what it has asked for (`takes`). At the rack, the tray and the oven's shelf a click puts by what
  he has more of than anybody wants (`extra`), and otherwise takes one: so with two wanting wood, two clicks are two
  logs. With a full hat he lets go of the oldest thing nobody wants (`spare`, `take`). The cat and a duck ride on his
  hat as themselves (`me.pets`) and go home by themselves (`home`).
- At dawn the day stands still (`begun` is false): no charge, no clock, nobody's patience running down. The castle
  asks for wood, and the yellow arrow (`ARROW` in `../basics.ts`, as on the island) bobs over the tree nearest the
  helper; a click on it is a click on the tree. Once he has wood on his hat it stands over the winch instead (a click on it
  is a click on the basket). The first wood handed over at the basket calls `start` (in `give`): the arrow
  goes and the camp sets out at once; until then nobody charges, and a visit to a tree changes nothing. The page's first line
  ("a farmer, the castle would like some wood") is done at the same moment. (Tests that do not care about dawn call `start()` themselves.)
- `direct` is the day: the camp charges for `CHARGE` seconds and rests for `LULL`, by turns (`phase`, `round`). With
  each charge both sides ask at once (`burst`): the first two charges are `ROUNDS`, the same every day (the castle's
  wood in the first is the one asked for at dawn), and after those `pick` goes by chance. An ask is waited for `CHARGE + WAIT` seconds. `want`, `give`, `tire` and `cheer` are
  all the rules there are.
- In each quiet one of `GIFTS` is asked for, while the last has been brought: pink, no timer, handed over in person
  (`PRINCESS`, `PRINCE`). What the prince asks for comes from the castle, what the princess asks for does not. After
  the last comes an ask at the gate, answered with `WED`: see `wed`.
- From the second quiet on something happens in each (`happen`, by turns): a duck follows him (`tail`); the cat goes
  for a loaf and a click stops it (`thief`, `nab`); rain puts the camp's fire out (`doused`), which then asks for
  wood with no timer (`still`) and gives no soup until it has it.
- From two gifts on the sides help each other (`lend`): in a charge, one plain ask for each gift after the first is
  met by a throw across the wall.
- The musician plays wherever he sits, and notes of three cubes rise from him (`QUAVER`, `notes`): so that he can be
  seen to be the music. While music is asked for, or he is playing at the camp, he plays faster and they go higher.
  He is only heard at the camp.
- The camp, the musician, a duck at his heels and the cat go by maps of steps (`flow`, `route`, `chase`), found
  afresh when a tree or a rock has moved (`stamp`). Only the helper, the musician and the cat get through the gate
  (`key`). On a stair, `foot` gives the tread.
- The war is a show (`fight`, `shoot`, `fly`) and decides nothing. It follows what is asked for: no wood, no arrows
  from the wall; stone wanted, teeth off the wall.

## Trying things

In the dev server: `window.castle`, `window.view`. `test/castle.test.ts` proves each rule (`hold` stops the day, so
that one can be tried at a time) and plays whole days with a bot (`play`), on fixed seeds: it passes every time or
not at all. To tune, change a number and let the bot play a dozen days at several speeds, and for one side only.

## Settled, not to be undone unasked

- Nobody is hurt: a good shot makes somebody jump.
- No sentence in the game. A want is a picture, a refusal a shake of the head, and what would help gives a jump.
  What he carries is on his hat, and said again with the same pictures on a tag over it. Nothing goes on the page
  that has to be explained: a bar for how long a charge lasts was not understood, and came out again.
- The layout is the owner's sketch: the castle at the top, the road down to the camp, the farm to the left, the winch
  on the left wall. Seen first from the south-west, so that the winch shows.
- The hill is heaped up to the foot of the walls, with uneven steps: no bare earth under a wall, no grey plinth, no
  long flat cut. Stairs are stone, with small treads. The yard has lawns. The castle is drawn by hand in `PLAN` and
  is on purpose not the same on both sides: change it there, a character at a time.
- The brook is narrow, with grass banks, and ends in the pond. Its bridge is level with the ground at both ends.
- The marks over what he has been told to do get darker down the list: the bright one is next.
- Still open with the owner: the name.
