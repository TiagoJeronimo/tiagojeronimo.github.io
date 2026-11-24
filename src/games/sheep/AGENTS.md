# The sheep: "Buy me a sheep", at `/games/sheep/`

Live, and it takes real money (see `sheep-api/AGENTS.md` and `GO-LIVE.md`). A small island in the castle's manner: a
meadow, a knoll, a pond with ducks, a brook out of a mountain, a locked door and a cave with a hermit sheep. A visitor
dresses a sheep, pays by Stripe's Payment Element, and drops it in the field for everybody. Without `VITE_SHEEP_API`
nothing is charged and the sheep lives in that browser only.

Everything the notes used to say, in full (the buying card, the very old sheep, extras, sound, calm, leaping, water,
the door, the day), is in `DETAILS.md`: grep it for the thing you are changing. It can be out of date; the code wins.

## Files

| File | What |
| --- | --- |
| `Sheep.ts` | The world, no React. `new Sheep(list?, seed?, start?)`, `update(dt)`, `shadows(tier)`, `dispose()`; `add bring drop dress sign hang dismiss` for a sheep that joins; `fits` is the one rule of where a sheep may be. |
| `model.ts`, `Fitting.tsx` | The sheep as cubes, drawn by one piece of code for the field and for the dressing window: never a second model. |
| `dress.ts` | No three, no page: wools, `Look`, `tidy`, the gift's bounds and currencies, ids and seeds. `sheep-api/` imports it, so the page and the server share one rule of what a giver may write. |
| `flock.ts`, `crowd.ts` | The resident (Claude the sheep, id 1) and the cave's sheep; twenty made-up sheep for tests and `?crowd` (dev only: keep it out of the published build). |
| `SheepPage.tsx`, `sheep.css` | The page: `Stage`, the buying card, the sheep's card, the welcome, the checkout and the wait for a paid sheep. |

In the dev server: `window.sheep`, `window.view`; `?crowd` for a full field; `?buy` opens the buying card.
`test/sheep.test.ts` plays whole days, and proves that no two cubes overlap, nothing is below the ground, and every
leap clears what it is over.

## Rules that hold

- How it looks and how the sheep move follows the castle (`../AGENTS.md`, and the skill `draw-world`). The first
  version did not, and was sent back.
- A sheep is 11 boxes, with no eyes (the owner had them taken off): feeling shows in movement and ears.
- Where a sheep stands is `fits`, and no step or turn is made that does not fit. Nothing clips.
- Water is whole tiles, 0.44 deep, drawn as one mesh (`pour`). Never a thin sheet or streaming drops.
- Nothing marks where a click on the ground will plant a tuft (a frame, a lit tile and a cursor mark were each taken out).
- The door in the mountain is locked and never opens, and has no bubble. The cave sheep's line is the owner's to write.
- One resident only (`FLOCK`), by his word. Do not add more.
- Calm: a sheep's label must not change every second. Keep `rest` 4.5 to 11.5 s, a mouthful 6 to 10, a drink 6 to 9.
- Sound is off at every load (a browser lets a page make no sound before a touch, so a remembered "on" plays
  nothing); the label is just "Sound?". No splash sound at the brook. The world makes no sound: it counts, the page listens.
- No "Get one like this" on a sheep's card. The welcome card shows once per browser (`sheep/hello`), stays until
  answered (or 30 s), and never after coming back from Stripe.
- Extras: two things at most of the six (`ITEMS`), hat and flowers never together. Butterflies from a gift of 5, the
  dog from 10. The server drops an extra the money that came does not allow; nothing is ever chosen for the giver.
- The very old sheep (a gift of nothing, "Take her in"): never `/checkout`, never `localStorage` or `sessionStorage`,
  never the address; one a visit; `fit` leaves `elder` out of anything from outside. Her text never says she is what a
  gift of nothing gets, never what she does in the field, and has no line about a better gift (a test reads it).
  Nothing outside her card changes for her: no tab title or icon, no sound, no `beforeunload`. The earlier, darker
  idea (others run from her) is gone: do not bring it back.
- A paid sheep shows at once from what the page knows; Stripe tells the worker in its own time. The amount is what
  Stripe says was received, never what the page asked. A gift is `LEAST` to `MOST`, in euros or Swiss francs.
- In a frame: no new objects (scratch vectors at the top of the file), and a sheep that has not changed sends nothing to the graphics card.
