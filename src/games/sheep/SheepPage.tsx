import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { Vector3, type PerspectiveCamera } from 'three'
import { Back, Hints, Sound } from '../hints.tsx'
import { keep, kept } from '../kept.ts'
import { Picture } from '../Picture.tsx'
import { View } from '../View.ts'
import { note } from '../../sound.ts'
import { MESSAGE, NAME, WEARS, WOOL, tidy, type Look, type Wear } from './dress.ts'
import { FLOCK, RECLUSE, type Entry } from './flock.ts'
import { HERMIT, Sheep, SPAN } from './Sheep.ts'

const _v = new Vector3()
const when = (date: string) => new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
const hex = (colour: number) => `#${colour.toString(16).padStart(6, '0')}`
/** What a sheep has on, said after what it is doing. */
const WORN: Record<Wear, string> = { hat: 'in a straw hat', bell: 'with a bell on', scarf: 'in a scarf', flowers: 'with flowers in its wool' }
/** A picture for each thing to wear, of a few squares, as the things themselves are; and one for nothing at all. */
const squares = (...boxes: (number | string)[][]) => (
  <svg viewBox="0 0 12 12" aria-hidden="true">
    {boxes.map(([x, y, w, h, fill], k) => (
      <rect key={k} x={x} y={y} width={w} height={h} fill={fill as string} />
    ))}
  </svg>
)
const PICTURES: Record<Wear | '', ReactNode> = {
  '': squares([2, 5, 8, 2, '#cfc6d6']),
  hat: squares([1, 8, 10, 2, '#f2d98a'], [3, 4, 6, 4, '#e9c46a']),
  bell: squares([4, 2, 4, 6, '#ffc93c'], [3, 8, 6, 2, '#ffc93c'], [5, 10, 2, 1, '#b98a1e']),
  scarf: squares([2, 2, 8, 3, '#ff7a8a'], [7, 5, 3, 5, '#ff7a8a']),
  flowers: squares([1, 6, 3, 3, '#ff9ec4'], [5, 3, 3, 3, '#ffd45c'], [8, 7, 3, 3, '#c4a4f0']),
}

// The sheep this browser has put in the field. TODO(step 3 of PLAN.md): these come from the server's `GET /sheep`
// with everybody else's, and this list goes. Until then a sheep made here is seen here and nowhere else.
const MINE = 'sheep/mine'
const mine = (): Entry[] => {
  try {
    const list: unknown = JSON.parse(kept(MINE) || '[]')
    if (!Array.isArray(list)) return []
    return list
      .filter((one) => one && Number.isInteger(one.id) && Number.isInteger(one.seed))
      .map((one) => ({ id: one.id, seed: one.seed, date: /^\d{4}-\d{2}-\d{2}$/.test(one.date) ? one.date : '', ...tidy(one) }))
  } catch {
    return []
  }
}

type Mode = 'idle' | 'dress' | 'place'

/** The picture: the field, moved on and drawn every frame, seen through the same camera as the castle's. */
function Stage({ world, tier, mode, onView, onKnown, onSelect, onDrop, each }: { world: Sheep; tier: number; mode: Mode; onView: (view: View) => void; onKnown: (known: string) => void; onSelect: (sheep: number) => void; onDrop: (sheep: number) => void; each: (world: Sheep, camera: PerspectiveCamera, width: number, height: number) => void }) {
  const gl = useThree((state) => state.gl)
  const view = useRef<View>(null)
  useEffect(() => {
    const held = (view.current = new View(gl.domElement, world.ground.mesh, SPAN, onKnown))
    onView(held) // (the page moves it in on a sheep that is being dressed)
    if (import.meta.env.DEV) Object.assign(window, { sheep: world, view: held }) // at hand in the console
    return () => held.dispose()
  }, [gl, world, onKnown, onView])
  useEffect(() => world.shadows(tier), [world, tier])
  useFrame(({ camera, size }, dt) => {
    world.update(Math.min(dt, 0.05))
    view.current?.update(Math.min(dt, 0.05), camera as PerspectiveCamera, size.width, size.height)
    each(world, camera as PerspectiveCamera, size.width, size.height)
  })
  const which = (event: ThreeEvent<MouseEvent | PointerEvent>) => (event.object === world.flock.mesh ? world.pick(event.instanceId) : -1)
  /** Where on the meadow the cursor points: on the level of the grass, whatever is in the way (the sheep that hangs is). */
  const meadow = ({ ray }: ThreeEvent<MouseEvent | PointerEvent>) => ray.at((1 - ray.origin.y) / ray.direction.y, _v)
  return (
    <>
      <primitive object={world.sky} attach="background" />
      <primitive
        object={world.group}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          if (event.delta > 6) return // the end of a drag, not a click
          event.stopPropagation()
          if (mode === 'place') {
            // A sheep is waiting to be put down: this is where.
            const { x, z } = meadow(event)
            const sheep = world.drop(x, z)
            if (sheep >= 0) onDrop(sheep)
            return
          }
          const sheep = which(event)
          if (sheep !== -1) note(4 + (Math.abs(sheep) % 5))
          world.glad(sheep) // a sheep that is clicked gives a hop
          onSelect(sheep)
        }}
        onPointerMove={(event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation()
          if (mode === 'place') {
            const { x, z } = meadow(event)
            world.hang(x, z)
          }
          ;(event.nativeEvent.target as HTMLElement).style.cursor = mode === 'place' ? 'grabbing' : which(event) !== -1 ? 'pointer' : ''
        }}
        onPointerOut={(event: ThreeEvent<PointerEvent>) => ((event.nativeEvent.target as HTMLElement).style.cursor = '')}
      />
    </>
  )
}

export default function SheepPage() {
  const [known, learn] = useReducer((had: string, more: string) => had + more, '', () => kept('sheep/known'))
  useEffect(() => keep('sheep/known', known), [known])
  // Who is in the field: the made-up flock, and this browser's own. One that has just been "paid for" is in the
  // address as `?sheep=<id>`, as it will be when Stripe sends its giver back: that one is not in the field yet, it
  // waits to be put down.
  const [world, back] = useMemo(() => {
    const own = mine()
    const id = Number(new URLSearchParams(location.search).get('sheep'))
    const back = own.find((one) => one.id === id)
    const world = new Sheep([...FLOCK, ...own.filter((one) => one !== back)])
    return [world, !!back && world.bring(back)] as const
  }, [])
  useEffect(() => () => world.dispose(), [world])
  const eye = useRef<View>(null)
  const zoomed = useRef(1) // how far in the view was before a sheep was dressed
  const seeing = useCallback((view: View) => void (eye.current = view), [])
  const [mode, setMode] = useState<Mode>(back ? 'place' : 'idle')
  const [look, setLook] = useState<Look>({})
  const [full, setFull] = useState(false)
  const [chosen, choose] = useState(-1)
  const bubble = useRef<HTMLDivElement>(null)
  const saying = useRef<HTMLElement>(null)
  const pick = useRef(-1)
  useEffect(() => void (pick.current = chosen), [chosen])

  // The bubble stays over its sheep, and says what the sheep is doing now.
  const each = useCallback((world: Sheep, camera: PerspectiveCamera, width: number, height: number) => {
    const e = pick.current === HERMIT ? world.hermit : world.ewes[pick.current]
    if (!e || !bubble.current) return
    _v.set(e.x, e.y + e.s * 1.15, e.z).project(camera) // just over its head (and its hat), and up with it when it hops
    bubble.current.style.translate = `${width / 2 + _v.x * 0.5 * width}px ${height / 2 - _v.y * 0.5 * height}px`
    const wear = e.entry.look?.wear
    const now = world.doing(e) + (wear ? `, ${WORN[wear]}` : '')
    if (saying.current && saying.current.textContent !== now) saying.current.textContent = now
  }, [])

  /** A new sheep comes to be dressed: it hangs in the field where the visitor is looking, and the view goes in on it. */
  const begin = () => {
    const view = eye.current
    const entry: Entry = { id: Date.now(), seed: Math.floor(Math.random() * 1e9), name: 'a sheep', message: '', date: new Date().toISOString().slice(0, 10), look: {} }
    if (!world.bring(entry, view?.pan.x, view?.pan.z)) return setFull(true)
    if (view && world.guest) {
      // The view goes in on it as near as it goes (`View.ts`: 11 away, from wherever this window sees the whole land),
      // and looks at the sheep where it hangs, which is up in the sky. In an upright window the card is across the foot of it, so the view
      // looks a little under the sheep, which is then in the part of the window that is clear.
      zoomed.current = view.zoom
      const upright = innerHeight > innerWidth
      view.zoom = (SPAN * Math.max(64 / 26, 74 / 26 / (innerWidth / innerHeight))) / 11
      view.pan.set(world.guest.x, world.guest.air + (upright ? -0.5 : 0.4), world.guest.z)
    }
    choose(-1)
    setLook({})
    setMode('dress')
  }
  /** The view comes out again, down to the grass: the dressing is over. */
  const leave = () => {
    const view = eye.current
    if (!view) return
    view.zoom = Math.max(1.5, zoomed.current)
    view.pan.y = 0
  }
  const wear = (more: Look) => {
    const next = { ...look, ...more }
    setLook(next)
    world.dress(next)
  }
  /**
   * "Paid", which for now is nothing at all: the sheep is written down in this browser, and the page is as it will be
   * when Stripe sends the giver back, `?sheep=<id>` and all. TODO(step 3 of PLAN.md): the checkout goes here.
   */
  const pay = (form: HTMLFormElement) => {
    const guest = world.guest
    if (!guest) return
    const given = new FormData(form)
    const entry: Entry = { ...guest.entry, ...tidy({ name: given.get('name'), message: given.get('message'), look }) }
    world.sign(entry)
    keep(MINE, JSON.stringify([...mine(), entry]))
    history.replaceState(null, '', `?sheep=${entry.id}`)
    leave()
    setMode('place')
  }
  const dropped = (sheep: number) => {
    history.replaceState(null, '', location.pathname) // it is in the field: a refresh does not ask for it again
    note(7)
    choose(sheep)
    setMode('idle')
  }
  const sheep = chosen === HERMIT ? RECLUSE : world.ewes[chosen]?.entry
  return (
    <main className="sheep">
      <Picture>{(tier) => <Stage world={world} tier={tier} mode={mode} onView={seeing} onKnown={learn} onSelect={choose} onDrop={dropped} each={each} />}</Picture>
      {mode === 'idle' && <Hints known={known} />}
      {/* What a sheep's giver wrote, and what it is doing just now. It is over the sheep it is about. */}
      {sheep && (
        <div className="bubble" ref={bubble} key={sheep.id}>
          <strong>{sheep.name}</strong>
          {sheep.message && <p>{sheep.message}</p>}
          <small>
            {sheep.date && `${when(sheep.date)} · `}
            <em ref={saying} />
          </small>
        </div>
      )}
      {/* Dressing a sheep: its wool, one thing to wear, a name, a few words. The sheep itself is in the field, being dressed. */}
      {mode === 'dress' && (
        <form
          className="dress"
          onSubmit={(event) => {
            event.preventDefault()
            pay(event.currentTarget)
          }}
        >
          <strong>A sheep of your own</strong>
          <div className="row" role="radiogroup" aria-label="Its wool">
            {WOOL.map((colour, k) => (
              <button type="button" key={colour} className="swatch" role="radio" aria-checked={look.wool === k} aria-label={`Wool ${k + 1}`} style={{ background: hex(colour) }} onClick={() => wear({ wool: k })} />
            ))}
          </div>
          <div className="row" role="radiogroup" aria-label="Something to wear">
            {(['', ...WEARS] as const).map((thing) => (
              <button type="button" key={thing} className="swatch" role="radio" aria-checked={(look.wear ?? '') === thing} aria-label={thing || 'nothing'} onClick={() => wear({ wear: thing || undefined })}>
                {PICTURES[thing]}
              </button>
            ))}
          </div>
          <input name="name" maxLength={NAME} placeholder="Its name (or none: a sheep)" autoComplete="off" />
          <input name="message" maxLength={MESSAGE} placeholder="A few words for whoever clicks it" autoComplete="off" />
          <p>The paying part is not built yet, so this one is on the house, and lives in this browser only.</p>
          <div className="row">
            <button className="btn">Put it in the field</button>
            <button
              type="button"
              className="sound"
              onClick={() => {
                world.dismiss()
                leave()
                setMode('idle')
              }}
            >
              Never mind
            </button>
          </div>
        </form>
      )}
      {mode === 'place' && <p className="place">Click where it should land. It will wander off anyway.</p>}
      <header className="top">
        <Back />
        {mode === 'idle' && (
          <button className="sound buy" onClick={begin} disabled={full}>
            {full ? 'The field is full for now' : 'Buy me a sheep'}
          </button>
        )}
        <Sound />
      </header>
    </main>
  )
}
