# Speed

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
