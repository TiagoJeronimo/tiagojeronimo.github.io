# Notes for agents

The personal site of Tiago Jerónimo Silva, live at https://tiagojeronimo.github.io/. Vite, React 19, TypeScript; the two
games add three.js through react-three-fiber. No backend. A push to `main` publishes it.

Read only what the task needs. Every area has notes of its own, which most tools load by themselves once you open a file
there:

| Working on | Read |
| --- | --- |
| any game, or a new one | `src/games/AGENTS.md`: the shared kit, and how to add a game |
| the island | `src/games/island/AGENTS.md` |
| the castle | `src/games/castle/AGENTS.md` |
| the front page, a card | `src/home/AGENTS.md` |
| a word you do not know | `CONTEXT.md`: the project's vocabulary |

## Commands

```bash
npm run dev      # http://localhost:5173
npx tsc -b       # types. An editor's diagnostics lag behind here: this is the truth
npx oxlint       # lint: must print nothing
npm test         # node, no browser: the cards, the maps, whole games played (about ten seconds)
npm run build    # types, then the build into dist/
```

All four checks pass before work is called done.

## Layout

| Path | What |
| --- | --- |
| `index.html`, `cv/index.html`, `games/<name>/index.html` | one page each, listed in `vite.config.ts` |
| `src/home/` | the front page: a grid of cards |
| `src/cv/`, `src/content.ts` | the CV page, and its words: the Work cards on the front page read the same file |
| `src/games/` | what the games share, and a folder for each game |
| `src/base.css`, `src/sound.ts` | colours, font and buttons for every page; small noises made in the browser |
| `public/thumbs/` | pictures for the cards |
| `test/` | a file for each area, all run by `npm test` |

## Rules

- Commit or push only when asked. Leave `.github/workflows/` alone: the owner changes those on GitHub.
- No new dependency without asking. Before writing a helper, look in `src/games/`: it is probably there.
- Nothing about the owner goes on the site that is not already in `src/content.ts`, and no fact about his work is made up.
- A change to how a game plays is proposed and agreed before it is built. A fix or a look is just done.
- TypeScript is strict, with `erasableSyntaxOnly` and `verbatimModuleSyntax`: no enums, no parameter properties,
  `import type` for types, and an import says its `.ts` or `.tsx`.
- Comments say why, in plain sentences. When code changes, the comment over it is made true again.
- Measure before making anything faster. In the games the cost is the finish of the picture, not the logic: the
  numbers are in `src/games/AGENTS.md`.

## Voice, for anything a visitor reads

Dry, aware of itself, fond of its subject, now and then a little deep. Never dark, never selling. What to do comes
first and stays plain; the aside comes after. A card on the front page is a line or two, with no list of features.
British spelling.
