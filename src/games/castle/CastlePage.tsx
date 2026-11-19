import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Vector3, type PerspectiveCamera } from 'three'
import { Back, Hints } from '../hints.tsx'
import { keep, kept } from '../kept.ts'
import { Picture } from '../Picture.tsx'
import { toggleSound } from '../../sound.ts'
import { View } from '../View.ts'
import { Castle, DAY, SIGHT, type Item, type Want } from './Castle.ts'
import posthog, { isPostHogEnabled } from '../../posthog.ts'

/** What the page does after every frame: it has the world as it now is, and the camera it was drawn through. */
type Each = (world: Castle, camera: PerspectiveCamera, width: number, height: number) => void

/**
 * The picture: the world, moved on and drawn every frame, seen through a camera held like the island's. A click on
 * something of the land is one more thing for the helper to see to; on open ground, somewhere for him to go.
 * @param tier the step the picture is at (see `../Picture.tsx`): the world draws its shadows to match
 */
function Stage({ tier, onKnown, each }: { tier: number; onKnown: (known: string) => void; each: Each }) {
  const world = useMemo(() => new Castle(), [])
  const gl = useThree((state) => state.gl)
  const view = useRef<View>(null)
  useEffect(() => {
    // (The picture sits a little below the middle of the window: the keep is tall, and at the back.)
    const held = (view.current = new View(gl.domElement, world.solid.mesh, SIGHT, onKnown, -70))
    held.yaw = -0.55 // from the south-west: the gate, the winch on the west wall, and the farm and the camp in front
    if (import.meta.env.DEV) Object.assign(window, { castle: world, view: held }) // at hand in the console
    return () => held.dispose()
  }, [gl, world, onKnown])
  useEffect(() => () => world.dispose(), [world])
  useEffect(() => world.shadows(tier), [world, tier])
  useFrame(({ camera, size }, dt) => {
    world.update(Math.min(dt, 0.05))
    view.current?.update(Math.min(dt, 0.05), camera as PerspectiveCamera, size.width, size.height)
    each(world, camera as PerspectiveCamera, size.width, size.height)
  })
  // Which cube of the land the cursor is on (none, on anything else), and where: a hair into whatever was hit, so that
  // the side of a thing means that thing, and not the ground beside it.
  const met = (event: ThreeEvent<MouseEvent>): [number, number, number] => [event.object === world.solid.mesh ? (event.instanceId ?? -1) : -1, event.point.x - (event.face?.normal.x ?? 0) * 0.02, event.point.z - (event.face?.normal.z ?? 0) * 0.02]
  // Over something that answers a click, the cursor says so. (It is the picture's own cursor that is set: the element the
  // pointer is on.)
  const point = (event: ThreeEvent<PointerEvent>, yes: boolean) => ((event.nativeEvent.target as HTMLElement).style.cursor = yes ? 'pointer' : '')
  return (
    <>
      <primitive object={world.sky} attach="background" />
      <primitive
        object={world.group}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          if (event.delta > 6) return // the end of a drag, not a click
          event.stopPropagation()
          world.click(...met(event))
        }}
        onPointerMove={(event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation()
          point(event, world.hover(...met(event)))
        }}
        onPointerOut={(event: ThreeEvent<PointerEvent>) => point(event, false)}
      />
    </>
  )
}

// Small pictures, a character a pixel: what can be wanted or carried, and how a day can end.
const INK: Record<string, string> = { r: '#e2543f', R: '#f48a72', b: '#b9793f', B: '#e2aa62', c: '#f6d9a0', k: '#7d6450', K: '#9a7b62', e: '#e9c99a', E: '#c9a06b', s: '#8f8a99', S: '#bdb8c4', n: '#6b4fa8', h: '#ff8fb1', g: '#c9c9d6', d: '#9fd6ff', p: '#ff8fb1', y: '#ffd45c', G: '#6fbf73', t: '#8a5a2b', T: '#c98f55', o: '#f5a742', O: '#f0a04b', x: '#5b4a44' }
const ICONS: Record<Want | Item | 'heart' | 'cloud', string[]> = {
  bread: ['........', '..bbbb..', '.bBcBcb.', 'bBBBBBBb', 'bBBBBBBb', '.bbbbbb.', '........'],
  wood: ['........', '.kkkkke.', 'kKKKKeEe', 'kkkkkeEe', 'kKKKKeEe', '.kkkkke.', '........'],
  stone: ['........', '..ssss..', '.sSSSss.', 'sSSsSSSs', 'sSSSSsSs', '.ssssss.', '........'],
  music: ['..nnnnnn', '..n....n', '..n....n', '..n....n', '.nn...nn', 'nnn..nnn', '.n....n.'],
  flower: ['..ppp...', '.ppypp..', '..ppp...', '...G....', '..GG.G..', '...GGG..', '...G....'],
  soup: ['..s..s..', '...s..s.', 'xxxxxxxx', 'xOOOOOOx', '.xOOOOx.', '..xxxx..', '........'],
  wheat: ['.y.y.y..', '.y.y.y..', '.yyyyy..', '..kkk...', '..yyy...', '.yyyyy..', '........'],
  duck: ['....yy..', '...yxyoo', '...yyy..', 'y.yyyy..', 'yyyyyyy.', '.yyyyy..', '........'],
  cat: ['O.....O.', 'OO...OO.', 'OOOOOOO.', 'OxOOOxO.', 'OOOpOOO.', '.OOOOO..', '........'],
  apple: ['....tG..', '.rrrtrr.', 'rRRrrrrr', 'rRrrrrrr', 'rrrrrrrr', '.rrrrrr.', '..rr.rr.'],
  heart: ['.hh..hh.', 'hhhhhhhh', 'hhhhhhhh', '.hhhhhh.', '..hhhh..', '...hh...', '........'],
  cloud: ['..ggg...', '.ggggggg', 'gggggggg', 'gggggggg', '........', '.d..d.d.', '..d..d..'],
}
const Icon = ({ rows }: { rows: string[] }) => (
  <svg className="what" viewBox="0 0 8 7" shapeRendering="crispEdges" aria-hidden="true">
    {rows.flatMap((row, y) => [...row].map((c, x) => (c === '.' ? null : <rect key={`${x} ${y}`} x={x} y={y} width={1.03} height={1.03} fill={INK[c]} />)))}
  </svg>
)
const _v = new Vector3()

export default function CastlePage() {
  // What is being asked for, what the helper has on his hat, what is put by at the farm, and how the day ended, once
  // it has: the rest of what the world knows is drawn straight from it, every frame, in `each`.
  const [news, setNews] = useState<{ asks: [id: number, side: number, what: Want, plain: boolean, love: boolean][]; over: string; loads: Item[]; kept: number[] }>({ asks: [], over: '', loads: [], kept: [] })
  const [loud, setLoud] = useState(false)
  // Which of the three ways of getting about have been used: added to, so that a new day does not say them again; and
  // kept, so that the next visit does not either.
  const [known, learn] = useReducer((had: string, more: string) => had + more, '', () => kept('castle/known'))
  useEffect(() => keep('castle/known', known), [known])
  const [round, setRound] = useState(0) // a new world for each: what is left of the last is thrown away
  const world = useRef<Castle>(null)
  const bubbles = useRef<Record<number, HTMLElement | null>>({})
  const stores = useRef<(HTMLElement | null)[]>([])
  const sun = useRef<HTMLElement>(null)
  const tag = useRef<HTMLSpanElement>(null)
  const told = useRef('')
  const each = useCallback<Each>((now, camera, width, height) => {
    world.current = now
    const put = now.kept.map(([what]) => (what === 'bread' ? now.oven.ready : now.piles[what as 'wood' | 'stone']))
    const said = `${now.asks.map((ask) => ask.id)} ${now.over} ${now.me.loads} ${put}`
    if (said !== told.current) setNews({ asks: now.asks.map((ask) => [ask.id, ask.side, ask.what, !ask.love && !ask.still, !!ask.love]), over: now.over, loads: [...now.me.loads], kept: put })
    told.current = said
    /** Where a point of the world is in the window. (One behind the camera comes out far off the other way: that is put right.) */
    const seen = (x: number, y: number, z: number) => {
      _v.set(x, y, z).project(camera)
      const back = _v.z > 1 ? -1000 : 1
      return [width / 2 + _v.x * 0.5 * width * back, height / 2 - _v.y * 0.5 * height * back]
    }
    // Each bubble goes over whoever is asking, side by side where one asks for more than one thing, and its ring shows
    // how much patience is left. One that would be out of the window, or under the corners at the top (lower on a
    // narrow window, where those take up more room), stays at the window's edge instead, and points to its place.
    const count: Record<string, number> = {}
    for (const ask of now.asks) {
      const bubble = bubbles.current[ask.id]
      const where = `${ask.x} ${ask.z}`
      const k = (count[where] = (count[where] ?? -1) + 1)
      if (!bubble) continue
      const [px, py] = seen(ask.x, ask.y, ask.z)
      const x = px + (k - (now.asks.filter((one) => `${one.x} ${one.z}` === where).length - 1) / 2) * 54
      // (Where its middle would be, over its place; and where that is kept to.)
      const y = py - 39
      const [cx, cy] = [Math.min(width - 44, Math.max(44, x)), Math.min(height - 44, Math.max(width < 700 ? 150 : 82, y))]
      const off = cx !== x || cy !== y
      bubble.dataset.off = String(off)
      bubble.style.translate = off ? `${cx}px ${cy}px` : `${x}px ${py}px`
      if (off) bubble.style.setProperty('--to', `${Math.atan2(py - cy, x - cx)}rad`)
      bubble.style.setProperty('--left', String(Math.max(0, ask.left / ask.full)))
      bubble.dataset.late = String(ask.left / ask.full < 0.3)
    }
    // Over the helper, small pictures of what he is carrying; and over the rack, the tray and the oven's shelf, of
    // what each is for, with a dot for every one that is there.
    const [hx, hy] = seen(now.me.x, now.me.y + 1.42 + now.me.loads.length * 0.22, now.me.z)
    if (tag.current) tag.current.style.translate = `calc(${hx}px - 50%) ${hy}px`
    now.kept.forEach(([, x, y, z], k) => {
      const [sx, sy] = seen(x, y, z)
      const store = stores.current[k]
      if (store) store.style.translate = `calc(${sx}px - 50%) ${sy}px`
    })
    sun.current?.style.setProperty('--day', String(Math.min(1, now.time / DAY)))
  }, [])
  // (What he carries that nobody wants just now: the place it can be put by at says so, by not keeping still.)
  const spare = (what: string) => news.loads.includes(what as Item) && !news.asks.some(([, , wanted]) => wanted === what)
  const restart = (source: 'end' | 'manual') => {
    if (isPostHogEnabled) posthog.capture('castle_day_restarted', { source })
    setRound(round + 1)
  }
  return (
    <main className="castle">
      {/* The same picture as the island's: its finish, and its lighter steps for a machine that cannot keep up. */}
      <Picture>{(tier) => <Stage key={round} tier={tier} onKnown={learn} each={each} />}</Picture>
      {/* The three ways of getting about, as on the island: each goes the first time it is used. */}
      <Hints known={known} />
      {/* The day: the sun goes along it to the evening, and waits there until the day is decided. */}
      <div className="day" aria-hidden="true">
        <i ref={sun} />
      </div>
      {/* What is wanted, in pictures, over whoever wants it: the castle, the camp, and later the princess and the prince,
          whose bubbles are pink. Those two wait as long as it takes, and so does a fire that is out: no ring. A click
          on a bubble sends the helper there, with whatever he has. */}
      {news.asks.map(([id, side, what, plain, love]) => (
        <button key={id} className="ask" data-love={love} data-plain={plain} ref={(bubble) => void (bubbles.current[id] = bubble)} onClick={() => world.current?.serve(id)} aria-label={`${love ? ['The princess', 'The prince', 'Both of them'][side] : side ? 'The camp' : 'The castle'} wants ${what}`}>
          <svg className="ring" viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="16" />
          </svg>
          <Icon rows={ICONS[what]} />
          <i className="to" />
        </button>
      ))}
      {/* What the helper has on his hat, said the same way: so that it can be seen from afar what he is bringing. */}
      <span className="load" ref={tag} data-on={news.loads.length > 0 && !news.over} aria-hidden="true">
        {news.loads.map((item, k) => (
          <Icon key={k} rows={ICONS[item]} />
        ))}
      </span>
      {/* And what the rack, the tray and the oven's shelf are for, with how many are on each. */}
      {!news.over &&
        ['wood', 'stone', 'bread'].map((what, k) => (
          <span key={what} className="store" ref={(store) => void (stores.current[k] = store)} data-here={spare(what)} aria-hidden="true">
            <Icon rows={ICONS[what as Item]} />
            <em>
              {Array.from({ length: k < 2 ? 4 : 3 }, (_, n) => (
                <b key={n} data-on={n < (news.kept[k] ?? 0)} />
              ))}
            </em>
          </span>
        ))}
      {news.over && (
        <div className="end" data-how={news.over}>
          <Icon rows={ICONS[news.over === 'wedding' ? 'heart' : 'cloud']} />
          <button className="btn" onClick={() => restart('end')}>
            Another day
          </button>
        </div>
      )}
      <header className="top">
        <Back />
        <button className="sound" aria-pressed={loud} onClick={() => setLoud(toggleSound())}>
          {loud ? 'Sound on' : 'Sound off'}
        </button>
        <button className="sound" onClick={() => restart('manual')} title="The same morning again, from the start">
          Start over
        </button>
      </header>
    </main>
  )
}
