# The island: "A very dry island", at `/games/island/`

A click-to-explore game. The island starts dry. Water wakes the ground near it; about 27 things hold the water back or
the life in, and finding them is the game. Finding some makes more isles rise. Not needed to finish, each with a count
of its own: 6 combos, 16 secrets, 10 snails, and a wish or two for every animal.

## Files

| File | What |
| --- | --- |
| `Island.ts` | The whole game, 3,000 lines: tiles, water, waking, things, camera, input, what is said, saving. Do not read it through: grep for a method below. |
| `GamePage.tsx` | The page: top bar, the journal (Map, Friends, Finds, Log), subtitles, credits, the card at the end, the postcard. |
| `isles/<name>.ts` | One isle each: its maps, heights, colours (`look`), and `lay(w, tile, c)` for the characters that are its own. The header comment of each lists them. |
| `grid.ts` | The grid (`W D tx tz tileAt step`), the shapes `Isle` and `Thing`, and `deal`: an isle's loose things shuffled by a seed, with the rules a layout has to pass. |
| `critters.ts` | Animals and whatever else moves in one piece. `combos.ts`: what happens when two notes in `w.memo` are both true. `wishes.ts`: friends and their wishes. `music.ts`, `sprites.ts`, `Butterflies.ts`. |

Methods of `Island` worth knowing by name: `thing` (make one), `put` and `scar` (its cubes), `tree`, `lay` (the map
characters every isle shares: `.` ground, `T` tree, `b` bush, `o` rocks), `strike` and `knock`, `grow` (a thing comes
to life), `wake` (a tile does), `raise` (an isle comes up), `fill` `flow` `rainOn` (water), `say` and `aside` (a line
of words), `extra` (a secret or a combo), `score`, `fetch` (an animal comes for something), `after` (later, by the
game's clock), `epilogue`, `click` and `pick` (input), `advance` (one step, nothing drawn) and `update` (that, drawn).

## A thing (`Thing` in `grid.ts`)

- `hits`: knocks until it gives, then `onBreak`; `onHit` before that. `keep`: it stays where it is afterwards.
- `todo`: solved some other way (the cactus wants rain). `tap`: a knock when nothing is left to break.
- `play`: a toy. A knock on it counts for nothing and is not saved.
- `tip` is its label, `clue` what is said of it to a stuck player, `fuss` what is said at the sixth useless knock.
- `wake` runs when it comes to life: the place to change its `tip`. `extra` and `ripe`: cubes, and a nature, kept
  back for later (oranges, once there are bees).
- Things with `hits` or `todo` are what has to be found: they make up an isle's `quota`.

## Finishing

`done`: every thing with `hits` or `todo` is found. `won`: done, and every tile that exists is awake. The islet is a
secret and is not needed: the shell calls the tide in, the lagoon's plug (a knock) lets it out, and low tide shows the
way there. The cactus is needed: a knock on it asks for rain, and the
frog, once awake, sends its cloud. (A click on the awake frog does the same, and is how a fire or lava gets rained
on: but nobody has to think of it to finish.) The rule behind that: what still needs something is what gets knocked on,
and it shows what it needs (the cactus hops, and thinks of a drop of water).

## Maps

An isle has `rows` and may have `variants` (other maps on the same coastline). `beds` carry water, `loose` things trade
places when an island is dealt from a seed, `finds` must not end up behind anything tall. What every map and every
dealing has to keep to is in `deal` and in `test/isles.test.ts`: nothing in the sails of the windmill or on its
doorstep, still water off the coast, and so on. After changing a map: `node test/play.test.ts 300` plays 300 islands.

## Trying things

In the dev server the game is `window.island`: `island.things[i]`, `island.strike(i)`, `island.mark[tile]` (its map
character), `island.advance(0.05)`. `?ending` (dev server only) plays the ending at once, without finishing the game. `?seed=N` deals island N: use 9001 and up for tests, and take
`wake-the-island/3/<seed>` out of localStorage afterwards. Saving an edit restarts the running game from its save.
`test/play.test.ts` plays whole games with no browser, and is the place to prove a rule.

## Settled, not to be undone unasked

- Tried and taken out: a rainbow, a moon, stars, northern lights. The night sky stays plain.
- Sound is off at every visit and asks ("Sound?"). The choice is not remembered.
- One line of words for one event. Their pace was set by ear (`held`, `LINGER` in `Island.ts`): do not swing it far.
- The words of settings and controls are plain. Everything else is in the voice the root notes describe.
- The first island's layout (seed 0) is what most people see: change it with care.
