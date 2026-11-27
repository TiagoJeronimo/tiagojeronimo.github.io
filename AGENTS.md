# Notes for agents

The personal site of Tiago Jerónimo Silva, live at https://tiagojeronimo.github.io/: a front page of cards, a CV, and
small voxel games. No backend, except the sheep's server. A push to `main` publishes it (`.github/workflows/publish.yml`:
lint, test, build, GitHub Pages).

Read only what the task needs. Each folder has notes of its own that most tools load by themselves once you open a file
there (its `CLAUDE.md` is one line, `@AGENTS.md`). Procedures are skills in `.claude/skills/`, loaded when used.

| Working on | Read |
| --- | --- |
| any game | `src/games/AGENTS.md` (the shared kit) |
| a new game | `npm run new-game <name>`, then the skill `new-game` |
| drawing a world or a creature | the skill `draw-world`: **read it before drawing either** |
| the island, the castle | `src/games/island/AGENTS.md`, `src/games/castle/AGENTS.md` |
| the sheep (live, taking real payments) | `src/games/sheep/AGENTS.md`; `DETAILS.md` beside it has everything it used to say, to grep |
| the sheep's server | `sheep-api/AGENTS.md`: a Cloudflare Worker and D1, Stripe by `fetch`, `/admin` behind Access; `GO-LIVE.md` is the owner's go-live steps |
| the front page, a card | `src/home/AGENTS.md` |
| a word you do not know | `CONTEXT.md`: the project's vocabulary (card, tier, pump, isle, ask, ...) |
| analytics, PostHog | `README.md`, "Analytics" |

## Stack

- Vite 8 (rolldown), React 19, TypeScript 7 (strict), oxlint. Node 24 in CI: tests are `.ts` run by Node directly.
- three 0.187 through @react-three/fiber 9; finish by @react-three/postprocessing 3. No physics, no UI kit, no audio
  library: sound is Web Audio in `src/sound.ts`. posthog-js for optional analytics.
- ai-debug-pins (dev only, on npm, the owner's own): the pin button on dev pages. His notes land in `.notes/notes.md`
  with pictures; "read my notes" handles them. Newer version: `npx --yes npm@11.19.1 update ai-debug-pins`.
- Four pages, each an `index.html` with its own `main.tsx`, listed in `vite.config.ts`. No router.
- A game's **world** is a plain class (no React: `group`, `update(dt)`, `dispose()`, `shadows(tier)`; steppable in node);
  its **page** wraps it in React (`useStage`). State flows one way: clicks → world methods; the page reads world fields
  each frame. The front page is plain React and CSS, no three.js.
- No models, textures or audio files: every shape is cubes built in code, every sound synthesised. The only binary
  assets are images in `public/`, referenced by absolute path.

## Commands

```bash
npm install
npm run dev      # http://localhost:5173 (.claude/launch.json: "web-cv")
npx tsc -b       # types. An editor's diagnostics lag behind here: this is the truth
npx oxlint       # lint (= npm run lint): must print nothing
npm test         # node, no browser: analytics, cards, maps, whole games played (about ten seconds)
npm run build    # types, then the build into dist/
npm run new-game <name>   # a new game that already runs
npm run sheep-api:dev     # the sheep's server on :8787
```

The four checks pass before work is called done. One test alone: `node test/castle.test.ts`.

## Rules

- Commit or push only when asked. Leave `.github/workflows/` alone: the owner changes those on GitHub.
- No new dependency without asking. Before writing a helper, look in `src/games/`: it is probably there.
- Change dependencies with GitHub's npm, not this Mac's (it drops `@emnapi/*` and the publish fails at `npm ci`):
  `npx --yes npm@11.19.1 install --package-lock-only`, then `npx --yes npm@11.19.1 ci --dry-run`.
- Nothing about the owner goes on the site that is not already in `src/content.ts`, and no fact about his work is made up.
- A change to how a game plays is proposed and agreed before it is built. A fix or a look is just done.
- TypeScript is strict, with `erasableSyntaxOnly` and `verbatimModuleSyntax`: no enums, no parameter properties,
  `import type` for types, and an import says its `.ts` or `.tsx`.
- three: import from `'three'`; effects go through `@react-three/postprocessing`, not three's own composer.
- In a frame: no new objects in a loop, and only changed cubes go to the GPU. Measure before making anything faster:
  the cost is the finish of the picture, not the logic (skill `draw-world`, `speed.md`).
- Comments say why, in plain sentences. When code changes, the comment over it is made true again.
- `Island.ts` (3,000 lines), `Castle.ts` (2,200) and `Sheep.ts` (2,100): grep for a method, do not read them through.

## Ignore

`node_modules/`, `dist/`, `package-lock.json`, images in `public/`, `.env` (local PostHog keys), `sheep-api/.dev.vars`
(Stripe test keys) and `.wrangler/`. Never print or paste a key.

## Status (2026-11-24)

- Live: the front page, `/cv/`, the island, and **Buy me a sheep** (`/games/sheep/`), which takes real money (Stripe
  live mode; the worker is on the owner's `workers.dev`, `/admin` is behind Cloudflare Access). The castle is built
  and playable; its name is still open with the owner.
- Sheep's open points: TWINT needs a legal-notice page with an address he does not want to publish; PayPal is not
  connected; no legal or terms page yet (see "What is left" in `sheep-api/GO-LIVE.md`).
- Types, lint and tests pass. Next: whatever the owner asks.

## Voice, for anything a visitor reads

Dry, aware of itself, fond of its subject, now and then a little deep. Never dark, never selling. What to do comes
first and stays plain; the aside comes after. A card on the front page is a line or two, with no list of features.
British spelling.
