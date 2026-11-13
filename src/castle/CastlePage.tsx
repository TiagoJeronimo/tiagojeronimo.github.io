import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Bloom, EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { PerspectiveCamera } from 'three'
import { HINTS } from '../hints.ts'
import { keep, kept } from '../kept.ts'
import { Castle, REACH, WEAR, type Thing } from './Castle.ts'
import { View } from './View.ts'

/**
 * The picture: the world, moved on and drawn every frame, seen through a camera held like the island's. A click lets go
 * whatever is chosen, or pats an animal that is there; and a soldier the cursor rests on waves.
 * @param onWhose told, as the cursor moves over the land, which colour a soldier let go there would be: -1 for neither
 * @param onNews told when the castle has a new owner, and when everybody has sat down
 */
function Stage({ thing, onWhose, onKnown, onNews }: { thing: Thing; onWhose: (team: number) => void; onKnown: (known: string) => void; onNews: (owners: number, peace: boolean) => void }) {
  const world = useMemo(() => new Castle(), [])
  const gl = useThree((state) => state.gl)
  const view = useRef<View>(null)
  const told = useRef('')
  useEffect(() => {
    const held = (view.current = new View(gl.domElement, world.solid.mesh, REACH, onKnown))
    if (import.meta.env.DEV) Object.assign(window, { castle: world, view: held }) // at hand in the console
    return () => held.dispose()
  }, [gl, world, onKnown])
  useEffect(() => () => world.dispose(), [world])
  useFrame(({ camera, size }, dt) => {
    world.update(Math.min(dt, 0.05))
    view.current?.update(Math.min(dt, 0.05), camera as PerspectiveCamera, size.width, size.height)
    const news = `${world.owners} ${world.peace}`
    if (news !== told.current) onNews(world.owners, world.peace)
    told.current = news
  })
  return (
    <>
      <primitive
        object={world.group}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          if (event.delta > 6) return // the end of a drag, not a click
          event.stopPropagation()
          const { x, y, z } = event.point
          if (world.pat(x, y, z)) return
          // (A hair into whatever was hit: a click on the side of a wall means that wall, not the ground beside it.)
          const out = event.face?.normal
          world.drop(thing, x - (out?.x ?? 0) * 0.02, z - (out?.z ?? 0) * 0.02)
        }}
        onPointerMove={(event: ThreeEvent<PointerEvent>) => {
          world.hover(event.point.x, event.point.y, event.point.z)
          onWhose(world.whose(event.point.x, event.point.z))
        }}
        onPointerOut={() => onWhose(-1)}
      />
      {/* The same finish as the island: soft shade in the corners, a little glow, gentle colours. */}
      <EffectComposer multisampling={4}>
        <N8AO aoRadius={1.2} distanceFalloff={1} intensity={3} color="#5b3a66" />
        <Bloom mipmapBlur luminanceThreshold={1} intensity={0.4} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      </EffectComposer>
    </>
  )
}

// What there is to let go, as small pictures for the buttons, a character a pixel: the two soldiers, and a basket.
const INK: Record<string, string> = { H: '#b9bcc9', S: '#f2c9a0', T: '#d9d4dc', b: '#5b4a44', W: '#9a7b62', E: '#e6e9f2', c: '#b5aebb', h: '#7d6450', k: '#a98a6e', K: '#8a6d58', y: '#f6d166', w: '#fff8e7' }
const THINGS: [Thing, string, string[]][] = [
  ['archer', 'Archer', ['..HHH...', '..SSS..W', '.TTTTT.W', '.TTTTT.W', '.TTTTT.W', '..b.b..W', '..b.b...']],
  ['sword', 'Swordsman', ['..HHH..E', '..SSS..E', 'cTTTTT.E', 'cTTTTT.E', 'cTTTTT..', '..b.b...', '..b.b...']],
  ['picnic', 'Picnic', ['..hhhh..', '.h....h.', '.h....h.', 'ywywywyw', '.kkkkkk.', '.kKkKkk.', '.kkkkkk.']],
]
/** (What a soldier wears, its tunic and its shield, takes the colour `--wear` where one is set: see `.carry`.) */
const Figure = ({ rows }: { rows: string[] }) => (
  <svg viewBox="0 0 8 7" shapeRendering="crispEdges" aria-hidden="true">
    {rows.flatMap((row, y) => [...row].map((c, x) => (c === '.' ? null : <rect key={`${x} ${y}`} x={x} y={y} width={1.03} height={1.03} style={{ fill: c === 'T' || c === 'c' ? `var(--wear, ${INK[c]})` : INK[c] }} />)))}
  </svg>
)

export default function CastlePage() {
  const [thing, setThing] = useState<Thing>('archer')
  const [news, setNews] = useState({ owners: 1, peace: false }) // what there is to say of the castle: see `Stage`
  // Which of the three ways of getting about have been used: added to, so that a new castle does not say them again;
  // and kept, so that the next visit does not either.
  const [known, learn] = useReducer((had: string, more: string) => had + more, '', () => kept('castle/known'))
  useEffect(() => keep('castle/known', known), [known])
  const [round, setRound] = useState(0) // a new castle for each: what is left of the last is thrown away
  // What is about to be let go goes along with the cursor, over the picture: that says what a click will do, with no
  // words. (Not while the picture is being dragged about, and not for a finger, which has no cursor.)
  const carry = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const show = (on: boolean) => carry.current && (carry.current.dataset.on = String(on))
    const move = (event: PointerEvent) => {
      show(event.pointerType === 'mouse' && !event.buttons && (event.target as Element).tagName === 'CANVAS')
      if (carry.current) carry.current.style.translate = `${event.clientX + 14}px ${event.clientY + 10}px`
    }
    const gone = () => show(false)
    addEventListener('pointermove', move)
    document.documentElement.addEventListener('pointerleave', gone)
    return () => {
      removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('pointerleave', gone)
    }
  }, [])
  return (
    <main className="castle">
      <Canvas shadows="percentage" dpr={[1, 1.5]} gl={{ antialias: false, powerPreference: 'high-performance' }} camera={{ fov: 30, near: 1, far: 400 }}>
        <color attach="background" args={['#cfe6f1']} />
        <Stage key={round} thing={thing} onWhose={(team) => carry.current?.style.setProperty('--wear', team < 0 ? '' : `#${WEAR[team].toString(16)}`)} onKnown={learn} onNews={(owners, peace) => setNews({ owners, peace })} />
      </Canvas>
      {/* The three ways of getting about, as on the island: each goes the first time it is used. */}
      <ul className="hints" aria-label="How to get about">
        {HINTS.map(([way, keys, how]) => (
          <li key={way} data-done={known.includes(way)}>
            {how}
            {keys && <kbd>[or {keys}]</kbd>}
          </li>
        ))}
      </ul>
      {/* How things stand, once there is something to say: who is counting, and whether it is over. */}
      {(news.peace || news.owners > 1) && <p className="news">{news.peace ? 'Everybody sat down.' : `Owners so far: ${news.owners}`}</p>}
      <header className="top">
        <a className="sound back" href="/">
          ← Things I’ve made
        </a>
        <button className="sound" onClick={() => setRound(round + 1)} title="A new castle, and nobody on the field">
          Start over
        </button>
      </header>
      <span className="carry" ref={carry} aria-hidden="true">
        <Figure rows={THINGS.find(([one]) => one === thing)![2]} />
      </span>
      <div className="tray" role="group" aria-label="What to let go">
        <div>
          {THINGS.map(([one, name, rows]) => (
            <button key={one} className="btn" aria-pressed={thing === one} onClick={() => setThing(one)}>
              <Figure rows={rows} />
              {name}
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
