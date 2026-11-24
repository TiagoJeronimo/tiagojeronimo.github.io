// `npm run new-game <name>`: a new game that already runs. It writes the page, a small world (a green field you can
// move about), a test and short notes, and adds the page to `vite.config.ts` and the test to `package.json`.
// What it leaves to you: the card on the front page (`src/home/projects.ts`, `GAMES` in `src/home/Home.tsx`: it needs a
// picture) and a row in the root `AGENTS.md`. Then read `.claude/skills/new-game/SKILL.md` and `src/games/AGENTS.md`.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const name = process.argv[2] ?? ''
if (!/^[a-z]{3,20}$/.test(name)) {
  console.error('usage: npm run new-game <name>   (lower-case letters only, 3 to 20 of them)')
  process.exit(1)
}
const Name = name[0].toUpperCase() + name.slice(1)
const dir = `src/games/${name}`
if (existsSync(dir) || existsSync(`games/${name}`)) {
  console.error(`${name} already exists`)
  process.exit(1)
}
const write = (path, text) => {
  mkdirSync(path.slice(0, path.lastIndexOf('/')), { recursive: true })
  writeFileSync(path, text)
}

write(
  `games/${name}/index.html`,
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#c7deea" />
    <meta name="description" content="A tiny voxel game." />
    <title>${Name} · Tiago Jerónimo Silva</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/games/${name}/main.tsx"></script>
  </body>
</html>
`,
)

write(
  `${dir}/main.tsx`,
  `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../posthog.ts'
import '@fontsource-variable/bricolage-grotesque'
import '../../base.css'
import './${name}.css'
import ${Name}Page from './${Name}Page.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <${Name}Page />
  </StrictMode>,
)
`,
)

write(
  `${dir}/${name}.css`,
  `/* The picture fills the window. The bar across the top and the hints are the shared ones (\`../hints.css\`). */
:root {
  --bg: #c7deea;
}
.${name} {
  position: fixed;
  inset: 0;
  background: var(--bg);
}
.${name} canvas {
  touch-action: none; /* a finger on the picture moves it, and does not scroll the page */
}
`,
)

write(
  `${dir}/${Name}.ts`,
  `// The world of ${name}: a plain class, no React. It has a \`group\` for the scene, \`update(dt)\`, \`shadows(tier)\` and
// \`dispose()\`, and is built of \`Cubes\`. How it looks and how it moves: \`../AGENTS.md\`, "Look and movement".
import { Color, DirectionalLight, Group, HemisphereLight, MeshStandardMaterial } from 'three'
import { rnd, shade } from '../basics.ts'
import { Cubes } from '../cubes.ts'

export const REACH = 8 // how far the field goes from its middle, in tiles, and how far the camera may go
const SOIL = 0xba936d
const GRASS = [0x8fd16b, 0x9fd872, 0xb4de6e]

export class ${Name} {
  readonly group = new Group()
  readonly sky = new Color(0xc7deea)
  private sun = new DirectionalLight(0xffe9cf, 2.75)
  private soft = new HemisphereLight(0xe6efff, 0xffd9c4, 1.12)
  readonly ground = new Cubes(600, new MeshStandardMaterial({ roughness: 0.9 }), 'wind')

  constructor() {
    // A tile is a column of soil with a slab of grass on top, in one of three greens by \`rnd\`.
    for (let x = -REACH; x <= REACH; x++)
      for (let z = -REACH; z <= REACH; z++) {
        if (Math.hypot(x, z) > REACH - rnd(x * 31 + z) * 1.5) continue // a round, frayed edge
        this.ground.add(x, -0.625, z, 1, 0.75, 1, SOIL)
        this.ground.add(x, -0.125, z, 1, 0.25, 1, GRASS[Math.floor(rnd(x * 7 + z * 13) * 3)])
      }
    this.sun.position.set(-16, 30, 12)
    this.sun.castShadow = true
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.04
    Object.assign(this.sun.shadow.camera, { near: 1, far: 110, left: -20, right: 20, top: 20, bottom: -20 })
    this.shadows(0)
    this.ground.mesh.castShadow = true
    this.ground.mesh.receiveShadow = true
    this.group.add(this.ground.mesh, this.sun, this.sun.target, this.soft)
  }

  /** A click on the land, at this point of it. */
  touch(_point: { x: number; y: number; z: number }) {}

  update(dt: number) {
    this.ground.update(dt)
  }

  /** The shadows at the size that goes with a step of the picture (see \`../Picture.tsx\`). */
  shadows(tier: number) {
    shade(this.sun, tier)
  }

  /** What it holds on the graphics card is given back. */
  dispose() {
    this.ground.mesh.dispose()
  }
}
`,
)

write(
  `${dir}/${Name}Page.tsx`,
  `import { type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useReducer } from 'react'
import { Back, Hints } from '../hints.tsx'
import { keep, kept } from '../kept.ts'
import { Picture } from '../Picture.tsx'
import { useStage } from '../useStage.ts'
import { ${Name}, REACH } from './${Name}.ts'

function Stage({ tier, onKnown }: { tier: number; onKnown: (known: string) => void }) {
  const world = useMemo(() => new ${Name}(), [])
  useStage(world, tier, { name: '${name}', land: world.ground.mesh, span: REACH, onKnown })
  // (A \`delta\` over 6 is the end of a drag, not a click.)
  return (
    <>
      <primitive object={world.sky} attach="background" />
      <primitive object={world.group} onClick={(event: ThreeEvent<MouseEvent>) => event.delta <= 6 && world.touch(event.point)} />
    </>
  )
}

export default function ${Name}Page() {
  const [known, learn] = useReducer((had: string, more: string) => had + more, '', () => kept('${name}/known'))
  useEffect(() => keep('${name}/known', known), [known])
  return (
    <main className="${name}">
      <Picture>{(tier) => <Stage tier={tier} onKnown={learn} />}</Picture>
      <Hints known={known} />
      <header className="top">
        <Back />
      </header>
    </main>
  )
}
`,
)

write(
  `test/${name}.test.ts`,
  `// Run with \`npm test\`. ${Name} without a browser: the world is made and stepped, and what the rules say comes of it.
import assert from 'node:assert/strict'
import { ${Name} } from '../src/games/${name}/${Name}.ts'

const world = new ${Name}()
for (let i = 0; i < 100; i++) world.update(0.05)
assert.ok(world.group.children.length > 0, 'the world has something in it')
world.dispose()
console.log('${name}: ok')
`,
)

write(
  `${dir}/AGENTS.md`,
  `# ${Name}, at \`/games/${name}/\`

(One paragraph: what the game is, in the owner's words.)

## Files

\`${Name}.ts\` the world (no React); \`${Name}Page.tsx\` the page; \`${name}.css\`; \`test/${name}.test.ts\` the rules, played in node.
The shared kit and the recipes for how a world looks and moves are in \`../AGENTS.md\`.

## Settled, not to be undone unasked

(What the owner has decided: one line each. Nothing yet.)
`,
)
write(`${dir}/CLAUDE.md`, '@AGENTS.md\n')

// Register the page and the test.
const edit = (path, from, to) => {
  const text = readFileSync(path, 'utf8')
  if (!text.includes(from)) throw new Error(`${path}: cannot find ${from}`)
  writeFileSync(path, text.replace(from, to))
}
edit('vite.config.ts', `sheep: 'games/sheep/index.html' }`, `sheep: 'games/sheep/index.html', ${name}: 'games/${name}/index.html' }`)
edit('package.json', 'node test/sheep.test.ts', `node test/sheep.test.ts && node test/${name}.test.ts`)

console.log(`${Name} is at games/${name}/ (npm run dev, then /games/${name}/). Still by hand:
  - a card: an entry in src/home/projects.ts with kind 'games', and '/games/${name}/' in GAMES in src/home/Home.tsx
  - a row for it in the root AGENTS.md table
  - then: npx tsc -b && npx oxlint && npm test`)
