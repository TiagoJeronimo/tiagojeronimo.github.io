# Notes for agents

The personal site of Tiago Jerónimo Silva, live at https://tiagojeronimo.github.io/: a front page of cards, a CV, and
two small voxel games. No backend. A push to `main` publishes it (`.github/workflows/publish.yml`: lint, test, build,
GitHub Pages).

Read only what the task needs. Every area has notes of its own, which most tools load by themselves once you open a file
there (each folder's `CLAUDE.md` is one line, `@AGENTS.md`).

| Working on | Read |
| --- | --- |
| any game, or a new one | `src/games/AGENTS.md`: the shared kit, the page skeleton, how to add a game, how a world looks and its creatures move, speed |
| the island | `src/games/island/AGENTS.md`: files, `Island` methods, things, maps, settled choices |
| the castle | `src/games/castle/AGENTS.md`: files, the world's API, the rules of a day, settled choices |
| the sheep (steps 1 to 3 built) | `src/games/sheep/AGENTS.md`: the island, the flock, how they move; `PLAN.md` beside it holds the plan |
| the sheep's server | `sheep-api/AGENTS.md`: a Cloudflare Worker and D1, Stripe by `fetch`; local only so far |
| the front page, a card | `src/home/AGENTS.md`: cards, pictures, why the page stays light, the toys |
| a word you do not know | `CONTEXT.md`: the project's vocabulary (card, tier, pump, isle, ask, ...) |
| analytics, PostHog | `README.md`, "Analytics": events, env vars, the dashboard script |

## The games, in a line each

- **Wake the island** (`/games/island/`): click-to-explore puzzle. Knock things to free water and wake a dry island;
  more isles rise. Words in subtitles, a journal, a postcard at the end.
- **Storm the castle** (`/games/castle/`, working title): click-to-command. Feed both sides of a siege that hurts
  nobody; a side left wanting sits down and gives up; a wedding wins the day. No text, only pictures.
- Controls, shared: click to act; drag moves, right-drag or twist turns, wheel or pinch zooms; keys do all three
  (`View.ts`). Hints teach `m`ove, `z`oom, `t`urn and go once done.

## Stack

- Vite 8 (rolldown), React 19, TypeScript 7 (strict), oxlint. Node 24 in CI: tests are `.ts` run by Node directly.
- three 0.187 through @react-three/fiber 9; finish by @react-three/postprocessing 3 + postprocessing 6.
- No physics, no UI kit, no audio library: sound is made with Web Audio in
  `src/sound.ts`. posthog-js for optional analytics.

## Commands

```bash
npm install
npm run dev      # http://localhost:5173 (.claude/launch.json: "web-cv")
npx tsc -b       # types. An editor's diagnostics lag behind here: this is the truth
npx oxlint       # lint (= npm run lint): must print nothing
npm test         # node, no browser: analytics, cards, maps, whole games played (about ten seconds)
npm run build    # types, then the build into dist/; `npm run preview` serves it
npm run sheep-api:dev   # the sheep's server on :8787 (see sheep-api/AGENTS.md)
```

The four checks pass before work is called done. One test alone: `node test/castle.test.ts`.

## Architecture

- Four pages, each an `index.html` with its own `main.tsx`, listed in `vite.config.ts`. No router.
- Games: a **world** is a plain class (`Island.ts`, `Castle.ts`): no React, holds a three `group`, `update(dt)`,
  `dispose()`, `shadows(tier)`, steppable in node. A **page** wraps it in React.
- Renderer, scene and camera: the r3f `<Canvas>` inside `<Picture>` (`src/games/Picture.tsx`), which also owns the
  finish and the pump (frame loop, drops to a lighter tier on a slow machine). Camera moved by `View.ts` (the island
  has its own camera code in `Island.ts`).
- Game loop: each page's `Stage` calls `world.update` and `view.update` in `useFrame`, `dt` capped at 0.05.
- State flows one way: clicks → world methods; the page reads world fields each frame for its bubbles, tags and
  labels. Saves and remembered choices via `kept.ts` (localStorage). Analytics events via `src/analytics.ts`,
  `src/posthog.ts`, `src/games/tracking.ts`; they never block play.
- Front page: plain React and CSS, no three.js (see `src/home/AGENTS.md`).

## Layout

| Path | What |
| --- | --- |
| `index.html`, `cv/index.html`, `games/<name>/index.html` | one page each |
| `src/home/` | the front page: cards (`projects.ts`), drawings (`art.ts`), page (`Home.tsx`) |
| `src/cv/`, `src/content.ts` | the CV page, and its words: the Work cards read the same file |
| `src/games/` | the shared kit (`Picture View cubes basics hints kept tracking`), and a folder per game |
| `src/base.css`, `src/sound.ts` | colours, font and buttons for every page; small noises made in the browser |
| `src/analytics.ts`, `src/posthog.ts` | event helpers; the lazily loaded PostHog client |
| `sheep-api/` | the sheep's server (a Worker, not part of the site's build): its own `wrangler.toml`, tests, notes |
| `analytics/`, `scripts/` | the PostHog dashboard definition and the script that applies it: not shipped |
| `public/thumbs/`, `public/logos/` | card pictures (`-s` = small copy), employer logos |
| `test/` | a file for each area, all run by `npm test` |

## Assets

- No models, textures or audio files: every shape is cubes built in code (`Cubes`, `Bits` in `cubes.ts`), every
  colour in code (`basics.ts`, each isle's `look`), every sound synthesised.
- The only binary assets are images in `public/`, referenced by absolute path (`/thumbs/x.jpg`).

## Rules

- Commit or push only when asked. Leave `.github/workflows/` alone: the owner changes those on GitHub.
- No new dependency without asking. Before writing a helper, look in `src/games/`: it is probably there.
- Change dependencies with GitHub's npm, not this Mac's (it drops `@emnapi/*` and the publish fails at `npm ci`):
  `npx --yes npm@11.19.1 install --package-lock-only`, then `npx --yes npm@11.19.1 ci --dry-run`.
- Nothing about the owner goes on the site that is not already in `src/content.ts`, and no fact about his work is made up.
- A change to how a game plays is proposed and agreed before it is built. A fix or a look is just done.
- A world or a creature is built by the recipes in `src/games/AGENTS.md`, "Look and movement": read it before drawing either.
- TypeScript is strict, with `erasableSyntaxOnly` and `verbatimModuleSyntax`: no enums, no parameter properties,
  `import type` for types, and an import says its `.ts` or `.tsx`.
- three: import from `'three'`; addons, if ever needed, from `'three/addons/...'`. Effects go through
  `@react-three/postprocessing`, not three's own composer.
- In a frame: no new objects in a loop (scratch vectors at the top of the file), and only changed cubes go to the GPU.
- Comments say why, in plain sentences. When code changes, the comment over it is made true again.
- Measure before making anything faster: the cost is the finish of the picture, not the logic (`src/games/AGENTS.md`).
- `Island.ts` (3,000 lines) and `Castle.ts` (2,200): grep for a method, do not read them through.

## Ignore

`node_modules/`, `dist/`, `package-lock.json`, images in `public/`, `.env` (local PostHog keys; `.env.example` shows them),
`sheep-api/.dev.vars` (Stripe test keys) and `.wrangler/`.

## Status (2026-11-22)

- Live: the front page, `/cv/`, the island. The castle is built and playable; still open with the owner: its name.
- The sheep: steps 1 to 3 built (the server only locally, untried against Stripe itself); see its `PLAN.md`.
- Types, lint and tests pass. No known bugs recorded.
- Next: whatever the owner asks; ideas for the castle wait for his pick.

## Voice, for anything a visitor reads

Dry, aware of itself, fond of its subject, now and then a little deep. Never dark, never selling. What to do comes
first and stays plain; the aside comes after. A card on the front page is a line or two, with no list of features.
British spelling.
