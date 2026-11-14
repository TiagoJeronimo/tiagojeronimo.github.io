# The castle: "Storm the castle" (a working title), at `/games/castle/`

A sandbox. A castle on a hill; the player lets go archers, swordsmen or a picnic, and they get on with it by
themselves. A soldier let go on the hill is the castle's, one let go on the flat ground is against it. The cat on the
keep decides who owns the castle; a picnic ends the fight. No supply, no score, no end but peace.

## Files

| File | What |
| --- | --- |
| `Castle.ts` | The world, no React: the land (`hill`, `land`), the castle as pieces of courses, soldiers, the cat, sheep, ducks, picnics, arrows. The numbers to tune are constants at its top (`LIVES PACE RANGE TOUGH APPEAL DAWDLE` and more). |
| `CastlePage.tsx` | The page: `Stage` (the world, the camera, the clicks), the tray of three buttons, the small figure carried at the cursor, the line of news. |
| `castle.css` | The tray, the carried figure, the news. The corners come from `../hints.css`. |

## The world from outside

`drop(thing, x, z)` lets one go, `pat(x, y, z)` pats an animal there (true if there was one), `hover(x, y, z)` makes a
soldier wave, `whose(x, z)` says which colour a soldier let go there would be, `update(dt)`, `shadows(tier)`,
`dispose()`. To read: `men`, `pieces`, `owner`, `owners` (how many so far), `peace`.

## How a soldier decides

Every frame, in `duty`, the first of these that applies: a seat at a picnic; the cat (fetch it, carry it home to the top
of the hill); a sheep to pat; the fight. With none of them, `laze`: sit, fish at the water, sleep under a tree.
They find their way by maps of steps made afresh every 0.3 s in `plan` (`toTeam toCastle toCat toTop toPicnic toBank
toShade`). A blow on the castle goes to `chip`: a tooth first, then the highest course; what has lost its support
falls (`settle`, `loosen`); with the cat home, `rebuild` puts it all back and the castle may change hands.

## Trying things

In the dev server: `window.castle`, `window.view`. `test/castle.test.ts` fights whole battles in node with
`update(0.05)` in a loop. It has to pass every time, not most times: run it a few times over after changing a number.

## Settled, not to be undone unasked

- Nothing grim: whoever is hit often enough pops into loose cubes.
- No sentence says how to play. What a click will let go is carried at the cursor, in the colour it would land in.
- Thought of and left out: flowers, a narrator, things to find, night, sound, a card at the end.
- Still open with the owner: its name, and what the game is about.
