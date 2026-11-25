---
name: new-game
description: How to add a new game to the site (the page, the world, the test, the card, the notes). Use when asked to make a new game, or to start one from the castle's or the sheep's pattern.
---

# A new game

1. `npm run new-game <name>` (lower-case letters). It writes `games/<name>/index.html`, `src/games/<name>/` (`main.tsx`,
   `<Name>Page.tsx`, `<name>.css`, `<Name>.ts`, `AGENTS.md`, `CLAUDE.md`) and `test/<name>.test.ts`, and adds the page to
   `vite.config.ts` and the test to `package.json`. It runs as it is: a green field to move about on.
2. The world, `<Name>.ts`, is a plain class: no React, nothing of the page. It has a `group`, `update(dt)`,
   `shadows(tier)` and `dispose()`, and is built of `Cubes` and `Bits` (`src/games/cubes.ts`). How it looks and moves:
   the skill `draw-world`. Read it before drawing anything.
3. The page is `Stage` and a `Page`. `useStage(world, tier, { name, land, span, onKnown, lift?, yaw?, onView? }, step?)`
   (`src/games/useStage.ts`) does the camera, the frame loop, the shadows and the end; `step` is for what the game
   does each frame. A click is `onClick` on the world's group: a `delta` over 6 is the end of a drag, not a click. The
   game's own buttons go round it; what has been learnt comes from `useKnown()` (`../useKnown.ts`: the three ways of getting about last for the tab, a game's own lines only for the visit).
   The castle (`castle/CastlePage.tsx`) is the short example to copy from; the island has a camera of its own.
4. `test/<name>.test.ts`: make the world in node, step it with `update(0.05)`, and check what came of it. The rules of
   the game are proved here, not in a browser.
5. By hand: a card (an entry in `src/home/projects.ts` with `kind: 'games'`, a picture, and the page's address in
   `GAMES` in `src/home/Home.tsx`), a row in the root `AGENTS.md` table, and the game's `AGENTS.md`: files, rules that
   hold, and what the owner has settled (one line each).
6. `npx tsc -b`, `npx oxlint` (silent), `npm test`, `npm run build`. Look at it in the browser: a world takes a few
   seconds to appear in the dev server.

A change to how a game plays is proposed and agreed before it is built.
