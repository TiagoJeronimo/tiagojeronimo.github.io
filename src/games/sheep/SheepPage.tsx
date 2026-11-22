import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { Vector3, type PerspectiveCamera } from 'three'
import { Back, FINGERS, Hints, Sound } from '../hints.tsx'
import { keep, kept } from '../kept.ts'
import { Picture } from '../Picture.tsx'
import { View } from '../View.ts'
import { note } from '../../sound.ts'
import { BLANKETS, BLANKET_NAMES, LEAST, MEMORIES, MESSAGE, MOST, NAME, REMEMBERS, WEARS, WOOL, isId, newId, plan, seedOf, tidy, type Look, type Memory, type Wear } from './dress.ts'
import { woolOf } from './model.ts'
import { Fitting } from './Fitting.tsx'
import { CROWD } from './crowd.ts'
import { FLOCK, RECLUSE, type Entry } from './flock.ts'
import { DOOR, HERMIT, MORNING, Sheep, SPAN } from './Sheep.ts'

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
const PICTURES: Record<Wear | Memory | '', ReactNode> = {
  '': squares([2, 5, 8, 2, '#cfc6d6']),
  hat: squares([1, 8, 10, 2, '#f2d98a'], [3, 4, 6, 4, '#e9c46a']),
  bell: squares([4, 2, 4, 6, '#ffc93c'], [3, 8, 6, 2, '#ffc93c'], [5, 10, 2, 1, '#b98a1e']),
  scarf: squares([2, 2, 8, 3, '#ff7a8a'], [7, 5, 3, 5, '#ff7a8a']),
  flowers: squares([1, 6, 3, 3, '#ff9ec4'], [5, 3, 3, 3, '#ffd45c'], [8, 7, 3, 3, '#c4a4f0']),
  // What a very old sheep remembers: a ring, a heart, a lamb, a duck, and a stone from the river. (The hat is the hat.)
  wedding: squares([3, 4, 6, 1, '#ffc93c'], [3, 9, 6, 1, '#ffc93c'], [2, 5, 1, 4, '#ffc93c'], [9, 5, 1, 4, '#ffc93c'], [5, 1, 2, 2, '#bfe6ff']),
  love: squares([2, 2, 3, 3, '#ff7a9c'], [7, 2, 3, 3, '#ff7a9c'], [2, 5, 8, 2, '#ff7a9c'], [3, 7, 6, 2, '#ff7a9c'], [5, 9, 2, 2, '#ff7a9c']),
  lamb: squares([2, 4, 6, 4, '#fffaf0'], [8, 3, 3, 3, '#5f4f5a'], [3, 8, 1, 3, '#5f4f5a'], [6, 8, 1, 3, '#5f4f5a']),
  duck: squares([2, 6, 7, 4, '#ffe07a'], [6, 2, 3, 4, '#ffe07a'], [9, 4, 2, 1, '#ff9a3c']),
  river: squares([6, 1, 1, 4, '#cfc6d6'], [4, 5, 5, 5, '#5fb4f0'], [5, 6, 1, 1, '#ffffff']),
}

/** Sheep as they come from somewhere this page does not control (this browser's storage, the server): checked over. */
const entries = (list: unknown): Entry[] =>
  Array.isArray(list)
    ? list
        .filter((one) => one && Number.isInteger(one.id) && one.id > FLOCK[0].id && Number.isInteger(one.seed)) // (no listed sheep has the resident's number)
        .map((one) => ({ id: one.id, seed: one.seed, date: /^\d{4}-\d{2}-\d{2}$/.test(one.date) ? one.date : '', ...tidy(one) }))
    : []

// The sheep's server (`sheep-api/`), if this build was told where it is (`VITE_SHEEP_API`). Without it the page is
// step 2's: Claude the sheep and this browser's own, and no paying; that is how the live site is until step 5.
const API: string = import.meta.env.VITE_SHEEP_API ?? ''
/** Everybody's sheep, from the server; none if it cannot be reached. `fresh`, past the browser's minute of cache. */
const herd = async (fresh = false): Promise<Entry[]> => {
  try {
    const answer = await fetch(`${API}/sheep`, { cache: fresh ? 'no-store' : 'default', signal: AbortSignal.timeout(5000) })
    return answer.ok ? entries(await answer.json()) : []
  } catch {
    return []
  }
}
// Stripe's form, in the card: Stripe.js, from Stripe and nowhere else (it may not be bundled or kept here), fetched
// only when somebody presses to pay, and the account's publishable key, which is made to be public (`pk_...`). The
// script's address names the same API version as the worker's (`sheep-api/src/index.ts`).
const STRIPE_JS = 'https://js.stripe.com/endive/stripe.js'
const PUBLISHABLE: string = import.meta.env.VITE_STRIPE_PUBLISHABLE ?? ''
type Embedded = { mount(where: HTMLElement): void; destroy(): void }
type Embed = (options: { fetchClientSecret: () => Promise<string>; onComplete: () => void }) => Promise<Embedded>
type Stripe = { createEmbeddedCheckoutPage?: Embed; initEmbeddedCheckout?: Embed }
let stripe: Promise<Stripe> | null = null
/** Stripe.js, once a visit; a failed load is tried again next time. */
const stripeJs = () =>
  (stripe ??= new Promise<Stripe>((done, fail) => {
    const script = Object.assign(document.createElement('script'), { src: STRIPE_JS, async: true })
    const make = (window as { Stripe?: (key: string) => Stripe }).Stripe
    if (make) return done(make(PUBLISHABLE))
    script.onload = () => {
      const made = (window as { Stripe?: (key: string) => Stripe }).Stripe
      if (made) done(made(PUBLISHABLE))
      else fail(new Error('no Stripe'))
    }
    script.onerror = () => fail(new Error('no Stripe'))
    document.head.append(script)
  }).catch((error: unknown) => {
    stripe = null
    throw error
  }))

/** The sheep in the address, `?sheep=<id>`: where Stripe sends a giver back to (or the fake pay of step 2). */
const wanted = () => Number(new URLSearchParams(location.search).get('sheep'))

// The sheep this browser has put in the field, with no server: a sheep made here is seen here and nowhere else.
const MINE = 'sheep/mine'
const mine = (): Entry[] => {
  try {
    return entries(JSON.parse(kept(MINE) || '[]'))
  } catch {
    return []
  }
}

type Mode = 'idle' | 'dress' | 'place'

// The time of day, kept for as long as the tab is open: so a page that is loaded again (or put together again while it
// is being worked on) goes on with the day it had (a new visit begins in the morning). Without it every reload began the day
// again, and from the middle of the night that is the whole picture leaping from dark to bright in one frame.
const CLOCK = 'sheep/time'
const clock = () => {
  try {
    return Number(sessionStorage.getItem(CLOCK)) || MORNING
  } catch {
    return MORNING
  }
}

/** The picture: the field, moved on and drawn every frame, seen through the same camera as the castle's. */
function Stage({ world, tier, mode, open, onView, onKnown, onSelect, onDrop, onPlant, each }: { world: Sheep; tier: number; mode: Mode; open: boolean; onPlant: () => void; onView: (view: View) => void; onKnown: (known: string) => void; onSelect: (sheep: number) => void; onDrop: (sheep: number) => void; each: (world: Sheep, camera: PerspectiveCamera, width: number, height: number) => void }) {
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
    if (view.current) world.watch(view.current.yaw) // (the sheep's thought bubbles face whoever is looking)
    each(world, camera as PerspectiveCamera, size.width, size.height)
  })
  /** What was hit: a sheep (its place in the flock), the one in the cave, the door in the mountain, or nothing that answers (-1). */
  const which = (event: ThreeEvent<MouseEvent | PointerEvent>) => (event.object === world.flock.mesh ? world.pick(event.instanceId) : event.object === world.ground.mesh && world.portal(event.instanceId) ? DOOR : -1)
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
          world.glad(sheep) // a sheep that is clicked gives a hop (and the door in the mountain, which is locked, a rattle)
          onSelect(sheep === DOOR ? -1 : sheep) // (the door has no bubble: it has nothing to say)
          // A click anywhere on the land plants a tuft of big grass, there or on the nearest tile that can take one:
          // the sheep see to the rest. (With a sheep's bubble open, the click only puts the bubble away; and while a
          // sheep is dressed, it does nothing.)
          if (sheep === -1 && mode === 'idle' && !open && world.plant(event.point.x, event.point.y, event.point.z) >= 0) {
            note(9)
            onPlant()
          }
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

/** With a server, the field waits for its sheep (a few hundred milliseconds, or five seconds if it is down). */
export default function SheepPage() {
  const [given, setGiven] = useState<Entry[] | null>(null)
  useEffect(() => void (API && herd(!!wanted()).then((list) => setGiven((had) => had ?? list))), []) // (once, though React in development asks twice)
  return API ? given && <Field given={given} /> : <Field given={null} />
}

/** @param given everybody's sheep, from the server; null when there is none, and this browser keeps its own */
function Field({ given }: { given: Entry[] | null }) {
  const [known, learn] = useReducer((had: string, more: string) => had + more, '', () => kept('sheep/known'))
  useEffect(() => keep('sheep/known', known), [known])
  // Who is in the field: Claude the sheep, always; and with it everybody's from the server, or without one this
  // browser's own. (In development, `?crowd` puts twenty made-up sheep there in its place, to be watched: the
  // condition is false in what is published, and the crowd is left out of it.) One just paid for is in the address as `?sheep=<id>`, where Stripe sends
  // its giver back: that one is not in the field yet, it waits to be put down.
  const [world, back] = useMemo(() => {
    const id = wanted()
    const home = import.meta.env.DEV && new URLSearchParams(location.search).has('crowd') ? CROWD : FLOCK
    if (given) {
      const back = given.find((one) => one.id === id)
      const others = given.filter((one) => one !== back)
      const world = new Sheep([...home, ...others])
      return [world, !!back && world.bring(back)] as const
    }
    const own = mine()
    const back = own.find((one) => one.id === id)
    const world = new Sheep([...home, ...own.filter((one) => one !== back)], 1, clock())
    return [world, !!back && world.bring(back)] as const
  }, [given])
  useEffect(() => () => world.dispose(), [world])
  const eye = useRef<View>(null)
  const seeing = useCallback((view: View) => void (eye.current = view), [])
  const [mode, setMode] = useState<Mode>(back ? 'place' : 'idle')
  // The sheep that is being dressed, in the card: its number and its seed, what it has on, what it is called, the
  // words that go with it, and the gift in euros. It is not in the field until it has been paid for.
  const [fresh, setFresh] = useState<Entry | null>(null)
  const [look, setLook] = useState<Look>({})
  const [called, setCalled] = useState('')
  const [words, setWords] = useState('')
  const [amount, setAmount] = useState(3)
  const [taken, setTaken] = useState(false) // whether this visit has had its very old sheep: there is one
  const elder = amount === 0
  const shown = useMemo(() => ({ ...look, elder }), [look, elder]) // what the sheep in the window looks like: very old, at a gift of nothing
  const card = useRef<HTMLFormElement>(null)
  const [full, setFull] = useState(false)
  const [chosen, choose] = useState(-1)
  // With a server: a giver back from Stripe before Stripe has told the server (`waiting`, the sheep's number), one
  // whose sheep did not come in time (`late`), a checkout on its way (`paying`) or one that failed (`trouble`).
  const [waiting, setWaiting] = useState(() => (given && !back && isId(wanted()) && wanted()) || 0)
  const [late, setLate] = useState(false)
  const [paying, setPaying] = useState(false)
  const [trouble, setTrouble] = useState('')
  // Stripe's form in the card: the session to pay, and the sheep as it was sent (what is dropped once it is paid,
  // whatever the card says by then). Null when the card shows its own buttons.
  const [till, setTill] = useState<{ secret: string; entry: Entry } | null>(null)
  const counter = useRef<HTMLDivElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const saying = useRef<HTMLElement>(null)
  const pick = useRef(-1)
  const told = useRef(-1) // the last time of day that was written down, in twos of seconds
  // The sheep's thought bubbles are the world's own (cubes over their heads). None over the sheep whose bubble with
  // its name in is open, and none at all while a sheep is being dressed or put down.
  useEffect(() => world.hush(chosen, mode !== 'idle'), [world, chosen, mode])
  useEffect(() => void (pick.current = chosen), [chosen])

  // The bubble stays over its sheep, and says what the sheep is doing now.
  const each = useCallback((world: Sheep, camera: PerspectiveCamera, width: number, height: number) => {
    // (The time of day is written down every couple of seconds: see `clock`.)
    if (Math.floor(world.time / 2) !== told.current) {
      told.current = Math.floor(world.time / 2)
      try {
        sessionStorage.setItem(CLOCK, String(world.time))
      } catch {
        // then the day begins again in the morning
      }
    }
    const e = pick.current === HERMIT ? world.hermit : world.ewes[pick.current]
    if (!e || !bubble.current) return
    _v.set(e.x, e.y + e.s * 1.15, e.z).project(camera) // just over its head (and its hat), and up with it when it hops
    bubble.current.style.translate = `${width / 2 + _v.x * 0.5 * width}px ${height / 2 - _v.y * 0.5 * height}px`
    // (What it is at, and what it has on; or, of a very old sheep, what she is remembering.)
    const { wear, memory, elder } = e.entry.look ?? {}
    const now = world.doing(e) + (elder ? (memory ? `, ${REMEMBERS[memory]}` : '') : wear ? `, ${WORN[wear]}` : '')
    if (saying.current && saying.current.textContent !== now) saying.current.textContent = now
  }, [])

  // Stripe's word to the server can be a few seconds behind its giver: ask again for a while, then let it be. The
  // sheep is in the field whenever the word comes, whether or not anybody is there to drop it.
  useEffect(() => {
    if (!waiting) return
    let gone = false
    void (async () => {
      for (let k = 0; k < 10; k++) {
        await new Promise((done) => setTimeout(done, 1500))
        const found = (await herd(true)).find((one) => one.id === waiting)
        if (gone) return
        if (found) {
          if (world.bring(found)) setMode('place')
          return setWaiting(0)
        }
      }
      if (gone) return
      setWaiting(0)
      setLate(true)
      history.replaceState(null, '', location.pathname)
    })()
    return () => void (gone = true)
  }, [waiting, world])

  // Stripe's form goes into the card while there is a session to pay, and away again with it: "Never mind", Escape
  // or a click beside the card all take the session away, and so the form (Stripe allows one on a page at a time).
  // Paid, the sheep comes to hang over the field at once, from what this page already knows: Stripe's word to the
  // server is for everybody else, and comes in its own time.
  useEffect(() => {
    if (!till) return
    let gone = false
    let form: Embedded | null = null
    const paid = () => {
      if (gone) return
      setTill(null)
      if (world.bring(till.entry, eye.current?.pan.x, eye.current?.pan.z)) setMode('place')
      else setMode('idle') // (no room: it is in the field all the same on the next visit)
    }
    void stripeJs()
      .then((made) => {
        const embed = made.createEmbeddedCheckoutPage ?? made.initEmbeddedCheckout
        if (!embed) throw new Error('no embedded checkout')
        return embed.call(made, { fetchClientSecret: () => Promise.resolve(till.secret), onComplete: paid })
      })
      .then((made) => {
        if (gone) return made.destroy()
        form = made
        if (counter.current) made.mount(counter.current)
      })
      .catch(() => {
        if (gone) return
        setTill(null)
        setTrouble("Stripe's form would not load. Nothing was paid; try again in a minute.")
      })
    return () => {
      gone = true
      form?.destroy()
    }
  }, [till, world])

  /** A new sheep comes to be dressed: in the card, in a window of its own. */
  const begin = () => {
    if (!world.room()) return setFull(true)
    // With a server its number is one nobody can guess, and its seed comes from that, as the server's will.
    const id = API ? newId() : Date.now()
    setFresh({ id, seed: API ? seedOf(id) : Math.floor(Math.random() * 1e9), name: 'a sheep', message: '', date: new Date().toISOString().slice(0, 10), look: {} })
    choose(-1)
    setLate(false)
    setTrouble('')
    setTill(null)
    setLook({})
    setCalled('')
    setWords('')
    setAmount(3)
    setMode('dress')
  }
  const close = useCallback(() => {
    setTill(null)
    setMode('idle')
  }, [])
  // The card is a dialogue: Escape puts it away, and Tab goes round inside it and not out into the page behind.
  useEffect(() => {
    if (mode !== 'dress') return
    card.current?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') return close()
      if (event.key !== 'Tab' || !card.current) return
      const stops = [...card.current.querySelectorAll<HTMLElement>('button:not(:disabled), input')]
      const [first, last] = [stops[0], stops[stops.length - 1]]
      if (event.shiftKey ? document.activeElement === first || document.activeElement === card.current : document.activeElement === last) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      }
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [mode, close])
  const wear = (more: Look) => setLook({ ...look, ...more })
  // The gift is changed. To or from nothing, the sheep is another sheep (a very old one has a blanket and a memory,
  // any other a wool and something on): what was picked for the one is not kept for the other.
  const give = (gift: number) => {
    if ((gift === 0) !== elder) setLook({})
    setAmount(gift)
  }
  /**
   * With a server, Stripe's form in the card (see `till`): paid there, the sheep drops; a bank that wants its own page
   * sends the giver back to `?sheep=<id>`. Without one, "paid" is nothing at all: the sheep is written down in this
   * browser, and the page is as it is when Stripe sends somebody back.
   */
  const pay = async () => {
    if (!fresh) return
    if (plan(amount, !!API) === 'elder') {
      // The very old sheep: a sheep for nothing. It is in this page and nowhere else: nothing is sent, nothing is written down,
      // and the address stays as it is, so that a reload has nothing to bring back. One to a visit.
      if (taken) return
      const entry: Entry = { ...fresh, ...tidy({ name: called, message: words, look }) }
      entry.look = { ...entry.look, elder: true }
      if (!world.bring(entry, eye.current?.pan.x, eye.current?.pan.z)) return setFull(true), setMode('idle')
      setTaken(true)
      return setMode('place')
    }
    if (API) {
      if (!/^pk_(test|live)_/.test(PUBLISHABLE)) return setTrouble('This build has no Stripe key (VITE_STRIPE_PUBLISHABLE), so nothing can be paid. Nothing was.')
      setPaying(true)
      setTrouble('')
      void stripeJs().catch(() => {}) // (on its way while the server is asked; `till` waits for it)
      try {
        const answer = await fetch(`${API}/checkout`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: fresh.id, amount: Math.round(amount * 100), name: called, message: words, look }),
        })
        const { clientSecret, error } = (await answer.json()) as { clientSecret?: unknown; error?: unknown }
        if (answer.ok && typeof clientSecret === 'string') {
          setTill({ secret: clientSecret, entry: { ...fresh, ...tidy({ name: called, message: words, look }) } })
          return setPaying(false)
        }
        setTrouble(error === 'amount' ? `From €${LEAST / 100} to €${MOST / 100}, please.` : 'That did not go through. Nothing was paid; try again in a minute.')
      } catch {
        setTrouble('The sheep office cannot be reached just now. Nothing was paid; try again in a minute.')
      }
      return setPaying(false)
    }
    const entry: Entry = { ...fresh, ...tidy({ name: called, message: words, look }) }
    keep(MINE, JSON.stringify([...mine(), entry]))
    history.replaceState(null, '', `?sheep=${entry.id}`)
    // Paid for (in a manner of speaking): it comes to hang over the field, where the visitor is looking, to be put down.
    if (world.bring(entry, eye.current?.pan.x, eye.current?.pan.z)) setMode('place')
    else {
      setFull(true)
      setMode('idle')
    }
  }
  const dropped = (sheep: number) => {
    history.replaceState(null, '', location.pathname) // it is in the field: a refresh does not ask for it again
    note(7)
    choose(sheep)
    setMode('idle')
  }
  const planted = useCallback(() => learn('g'), [])
  const sheep = chosen === HERMIT ? RECLUSE : world.ewes[chosen]?.entry
  return (
    <main className="sheep">
      <Picture>{(tier) => <Stage world={world} tier={tier} mode={mode} open={chosen !== -1} onPlant={planted} onView={seeing} onKnown={learn} onSelect={choose} onDrop={dropped} each={each} />}</Picture>
      {mode === 'idle' && <Hints known={known} />}
      {/* One more hint, the field's own, in the same style and gone once done: a click on the grass plants a snack. */}
      {mode === 'idle' && (
        <ul className="hints snack">
          <li data-done={known.includes('g')}>{FINGERS ? 'Tap' : 'Click'} the grass to plant a snack</li>
        </ul>
      )}
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
      {/* Buying a sheep: one card in the middle of the window, in two halves. On the right the sheep itself in a small
          window, and under it what it is to look like and be called; on the left the gift, and the button. (On a
          narrow screen the one is over the other: the sheep, its looks, then the gift.) */}
      {mode === 'dress' && fresh && (
        <div className="veil" onClick={(event) => event.target === event.currentTarget && close()}>
          <form
            className={elder ? 'dress elder' : 'dress'}
            role="dialog"
            aria-modal="true"
            aria-label="A sheep of your own"
            tabIndex={-1}
            ref={card}
            onSubmit={(event) => {
              event.preventDefault()
              void pay()
            }}
          >
            <section className="fit" inert={!!till}>
              <div className="window">
                <Fitting seed={fresh.seed} look={shown} />
              </div>
              <span className="tag" id="tag-wool">
                {elder ? 'Blanket' : 'Wool'}
              </span>
              <div className="row" role="radiogroup" aria-labelledby="tag-wool">
                {(elder ? BLANKETS : WOOL).map((colour, k) => (
                  <button type="button" key={colour} className="swatch" role="radio" aria-checked={look.wool === k} aria-label={`${elder ? 'Blanket' : 'Wool'} ${k + 1}`} style={{ background: hex(colour) }} onClick={() => wear({ wool: k })} />
                ))}
              </div>
              <span className="tag" id="tag-wear">
                {elder ? 'Memories' : 'Wearing'}
              </span>
              {elder ? (
                <div className="row" role="radiogroup" aria-labelledby="tag-wear">
                  {(['', ...MEMORIES] as const).map((thing) => (
                    <button type="button" key={thing} className="swatch" role="radio" aria-checked={(look.memory ?? '') === thing} aria-label={thing ? REMEMBERS[thing].replace('remembering ', '') : 'nothing'} onClick={() => wear({ memory: thing || undefined })}>
                      {PICTURES[thing]}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="row" role="radiogroup" aria-labelledby="tag-wear">
                  {(['', ...WEARS] as const).map((thing) => (
                    <button type="button" key={thing} className="swatch" role="radio" aria-checked={(look.wear ?? '') === thing} aria-label={thing || 'nothing'} onClick={() => wear({ wear: thing || undefined })}>
                      {PICTURES[thing]}
                    </button>
                  ))}
                </div>
              )}
              <label className="field">
                <span className="tag">Your sheep's name</span>
                <input name="name" maxLength={NAME} placeholder="Baa-a-a" autoComplete="off" value={called} onChange={(event) => setCalled(event.target.value)} />
              </label>
              <label className="field words">
                <span className="tag">What is the sheep thinking about?</span>
                <input name="message" maxLength={MESSAGE} placeholder="Baaa… meh" autoComplete="off" value={words} onChange={(event) => setWords(event.target.value)} />
                <small>
                  {[...words].length}/{MESSAGE}
                </small>
              </label>
            </section>
            <section className="pay">
              <strong>{elder ? 'A very old sheep' : 'A sheep of your own'}</strong>
              <div className="row" role="radiogroup" aria-label="The gift, in euros" inert={!!till}>
                {[0, 3, 5, 10].map((euros) => (
                  <button type="button" key={euros} className={euros ? 'pick' : 'pick nought'} role="radio" aria-checked={amount === euros} onClick={() => give(euros)}>
                    €{euros}
                  </button>
                ))}
                <label className="gift">
                  or €
                  <input name="amount" type="number" min={elder ? 0 : LEAST / 100} max={MOST / 100} step="0.01" required inputMode="decimal" value={amount} onChange={(event) => give(Number(event.target.value))} />
                </label>
              </div>
              {elder ? (
                // The very old sheep: who she is, and for how long. Said only here, in this card, and never why she is the one on offer.
                <div className="terms">
                  <p>She is very old. Nobody is sure how old, herself included: she stopped counting some time ago, and has not missed it.</p>
                  <p>She has had a good life, as these things go. A great deal of grass. A river, once, which she still brings up. A duck who sat on her for most of a summer and never said why. A brief affair with a hat.</p>
                  <p>She is tired now, the way you are tired after a nice day out.</p>
                  <p>And then you will close this tab, as you were always going to, and she will die. Quietly. She will not mind. Nothing keeps her anywhere: not a server, not this browser's memory. That is the arrangement. It is everybody's arrangement, really; hers is just shorter, and has a button.</p>
                  <p>So that is the offer: a little while, in a field, with company. She thinks it is a very good one.</p>
                  {taken && <p>One old sheep to a visit, and this visit has had hers.</p>}
                </div>
              ) : API ? (
                <p>{trouble || (till ? 'Paid here, through Stripe. Once it goes through, your sheep comes down to the field.' : `A gift to the person who made all this, paid through Stripe without leaving the field. The sheep is the thank-you, and it stays. From €${LEAST / 100}.`)}</p>
              ) : (
                <p>The paying part is not switched on yet: nothing is charged, whatever is picked. This one is on the house, and lives in this browser only.</p>
              )}
              <p className="sum">
                {tidy({ name: called }).name === 'a sheep' ? 'A sheep' : tidy({ name: called }).name}, {elder ? 'very old, ' : ''}
                {elder ? (look.memory ? REMEMBERS[look.memory] : 'keeping her memories to herself') : look.wear ? WORN[look.wear] : 'with nothing on but its wool'}
                {elder && (
                  // (Which blanket, by name and in its own colour, a little deeper so that it reads on the paper.)
                  <>
                    , under <span style={{ color: `color-mix(in srgb, ${hex(BLANKETS[woolOf(fresh.seed, look)])} 48%, #4a3550)` }}>a {BLANKET_NAMES[woolOf(fresh.seed, look)]} blanket</span>
                  </>
                )}
                .
              </p>
              {/* Stripe's form, in place of the buttons, once there is something to pay: its own colours are the
                  owner's, set in Stripe's dashboard. "Never mind" under it goes back to the buttons, and the session
                  with it, unpaid. */}
              {till && <div className="till" ref={counter} />}
              <div className="row foot">
                {till ? (
                  <button type="button" className="sound" onClick={() => setTill(null)}>
                    Never mind
                  </button>
                ) : (
                  <>
                    <button className="btn" disabled={paying || (elder && taken)}>
                      {elder ? 'Take her in' : paying ? 'A moment…' : 'Put it in the field'}
                    </button>
                    <button type="button" className="sound" onClick={close}>
                      Never mind
                    </button>
                  </>
                )}
              </div>
            </section>
          </form>
        </div>
      )}
      {mode === 'place' && <p className="place">Click where it should land. It will wander off anyway.</p>}
      {mode === 'idle' && waiting > 0 && <p className="place">Your sheep is on its way from Stripe. A moment.</p>}
      {mode === 'idle' && late && <p className="place">Your sheep has not turned up yet. It will be in the field once Stripe says so: look again in a minute.</p>}
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
