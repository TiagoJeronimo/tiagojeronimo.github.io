import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { Vector3, type PerspectiveCamera } from 'three'
import { Back, FINGERS, Hints, Sound } from '../hints.tsx'
import { keep, kept } from '../kept.ts'
import { Picture } from '../Picture.tsx'
import { View } from '../View.ts'
import { music, note, sfx } from '../../sound.ts'
import { BLANKETS, LEAST, MEMORIES, MESSAGE, MOST, NAME, REMEMBERS, WEARS, WOOL, isCurrency, isId, money, newId, plan, seedOf, tidy, type Currency, allowed, isWear, pairs, type Extra, type Item, type Look, type Memory, type Wear } from './dress.ts'
import { GREY, woolOf } from './model.ts'
import { Fitting } from './Fitting.tsx'
import { CROWD } from './crowd.ts'
import bricolage from '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2?url'
import { FLOCK, RECLUSE, type Entry } from './flock.ts'
import { DOOR, HERMIT, MORNING, Sheep, SPAN } from './Sheep.ts'

const _v = new Vector3()
const HOLD = 3500 // for how long, in milliseconds, what a sheep is doing stays on its card once it is there
const when = (date: string) => new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
const hex = (colour: number) => `#${colour.toString(16).padStart(6, '0')}`
/** A picture for each thing to wear, of a few squares, as the things themselves are; and one for nothing at all. */
const squares = (...boxes: (number | string)[][]) => (
  <svg viewBox="0 0 12 12" aria-hidden="true">
    {boxes.map(([x, y, w, h, fill], k) => (
      <rect key={k} x={x} y={y} width={w} height={h} fill={fill as string} />
    ))}
  </svg>
)
const PICTURES: Record<Wear | Memory | Extra | '', ReactNode> = {
  // What a bigger gift brings: a butterfly, and a small dog.
  butterflies: squares([1, 2, 4, 4, '#ffc2d9'], [7, 2, 4, 4, '#ffc2d9'], [2, 6, 3, 3, '#c4a4f0'], [7, 6, 3, 3, '#c4a4f0'], [5, 2, 2, 8, '#5f4f5a']),
  dog: squares([2, 5, 7, 4, '#d9a066'], [7, 2, 4, 4, '#d9a066'], [10, 4, 2, 2, '#fff6e0'], [7, 1, 1, 2, '#6b5248'], [1, 3, 1, 3, '#d9a066'], [3, 9, 1, 2, '#6b5248'], [7, 9, 1, 2, '#6b5248']),
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
// the first time the card opens, and the account's publishable key, which is made to be public (`pk_...`). The
// script's address names the same API version as the worker's (`sheep-api/src/index.ts`).
const STRIPE_JS = 'https://js.stripe.com/endive/stripe.js'
const PUBLISHABLE: string = import.meta.env.VITE_STRIPE_PUBLISHABLE ?? ''
const KEYED = /^pk_(test|live)_/.test(PUBLISHABLE)
type Wrong = { error?: { message?: string } }
type Payment = { mount(where: HTMLElement): void; destroy(): void }
type Elements = { create(kind: 'payment', options: object): Payment; update(options: { amount: number; currency: Currency }): void; submit(): Promise<Wrong> }
type Stripe = {
  elements(options: object): Elements
  confirmPayment(options: object): Promise<Wrong & { paymentIntent?: { status: string } }>
}
/** The form dressed as the card is: its paper, ink, pink and corners (`sheep.css`), and the page's own letters. */
const APPEARANCE = {
  theme: 'flat',
  variables: {
    fontFamily: "'Bricolage Grotesque Variable', system-ui, sans-serif",
    fontSizeBase: '15px',
    colorPrimary: '#3d3550',
    colorBackground: '#fffdf6',
    colorText: '#3d3550',
    colorTextSecondary: '#7a7189',
    colorTextPlaceholder: '#a49cb0',
    colorDanger: '#d4506a',
    borderRadius: '10px',
    spacingUnit: '3px',
  },
  rules: {
    '.Input': { backgroundColor: '#f1e9dc', border: 'none', boxShadow: 'none', padding: '9px 11px' },
    '.Input:focus': { boxShadow: 'inset 0 0 0 2px #3d3550' },
    '.Input--invalid': { boxShadow: 'inset 0 0 0 2px #d4506a' },
    '.Label': { fontSize: '12px', fontWeight: '700' },
    // Each way of paying in a box of its own, with a border like the card's chips: the open one in ink.
    // The tabs too: each a box with a border, the chosen one in ink, so that they read as buttons.
    '.Tab': { backgroundColor: '#fffdf6', border: '2px solid #e6dccb', boxShadow: 'none', borderRadius: '12px' },
    '.Tab:hover': { borderColor: '#b9aec4' },
    '.Tab--selected': { backgroundColor: '#3d3550', borderColor: '#3d3550' },
    '.TabLabel--selected': { color: '#fffdf6' },
    '.TabIcon--selected': { fill: '#fffdf6' },
    '.AccordionItem': { backgroundColor: '#fffdf6', border: '2px solid #e6dccb', boxShadow: 'none', borderRadius: '12px' },
    '.AccordionItem--selected': { borderColor: '#3d3550' },
  },
}
// The page's letters, for inside Stripe's frame (its own address: it fetches them from here).
const FONTS = [{ family: 'Bricolage Grotesque Variable', src: `url(${new URL(bricolage, location.href).href})`, weight: '200 800' }]
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

/**
 * The currency a gift starts in: Swiss francs for a browser that says it is in Switzerland (its language's region, as
 * in de-CH or fr-CH, or Swiss German; or the clock of Zurich, whatever the language: an English browser in Zurich
 * is the commonest case), so that TWINT is there;
 * else euros. Nothing is asked of the browser for it, and nothing leaves it. A pick on the card is kept (`kept`).
 */
const COIN = 'sheep/currency'
const homeCurrency = (): Currency => {
  const picked = kept(COIN)
  if (isCurrency(picked)) return picked
  try {
    const language = navigator.language ?? ''
    const region = /^[a-z]{2,3}-(?:[a-z]{4}-)?([a-z]{2})\b/i.exec(language)?.[1]?.toUpperCase()
    if (region === 'CH' || /^gsw\b/i.test(language) || Intl.DateTimeFormat().resolvedOptions().timeZone === 'Europe/Zurich') return 'chf'
  } catch {
    // then euros
  }
  return 'eur'
}
/** Which way of paying comes first, of those Stripe offers the giver: one list for both currencies, since a way that
 * does not take the gift's currency (TWINT is francs only, MB WAY euros only) is simply not offered. */
const portugal = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone === 'Europe/Lisbon' || /-PT\b/i.test(navigator.language ?? '')
  } catch {
    return false
  }
})()
// (Card first; TWINT second for francs; MB WAY second for a Portuguese browser, else PayPal.)
const ORDER = portugal ? ['card', 'mb_way', 'twint', 'paypal', 'apple_pay', 'google_pay'] : ['card', 'twint', 'paypal', 'apple_pay', 'google_pay', 'mb_way']

/** The sheep in the address, `?sheep=<id>`: where Stripe sends a giver back to (or the fake pay of step 2). */
const wanted = () => Number(new URLSearchParams(location.search).get('sheep'))
/**
 * How a way of paying that went away (PayPal, a bank) came back, by Stripe's `redirect_status`: paid, still being
 * settled, or not paid. None at all is the fake pay of step 2, or an old address: taken as paid, and waited for.
 */
const returned = (): 'paid' | 'settling' | 'unpaid' => {
  const status = new URLSearchParams(location.search).get('redirect_status')
  return status === null || status === 'succeeded' ? 'paid' : status === 'processing' || status === 'pending' ? 'settling' : 'unpaid'
}

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
          // (A sheep that is clicked says so, each in a voice of its own; the door only knocks.)
          if (sheep === DOOR) note(0.2)
          else if (sheep !== -1) sfx('baa', ((sheep === HERMIT ? world.hermit : world.ewes[sheep])?.entry.seed ?? 0) % 7 / 6)
          world.glad(sheep) // a sheep that is clicked gives a hop (and the door in the mountain, which is locked, a rattle)
          onSelect(sheep === DOOR ? -1 : sheep) // (the door has no bubble: it has nothing to say)
          // A click anywhere on the land plants a tuft of big grass, there or on the nearest tile that can take one:
          // the sheep see to the rest. (With a sheep's bubble open, the click only puts the bubble away; and while a
          // sheep is dressed, it does nothing.)
          if (sheep === -1 && mode === 'idle' && !open && world.plant(event.point.x, event.point.y, event.point.z) >= 0) {
            sfx('pop')
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
  // The welcome: said once, a moment into a first visit, and it stays until it is answered (or half a minute has gone).
  // Not to somebody who has just come back from paying. That it has been said is kept, when the browser keeps things;
  // when it does not, it is said once a visit, which does no harm.
  const [hello, setHello] = useState(false)
  useEffect(() => {
    if (kept('sheep/hello') || wanted()) return
    const come = setTimeout(() => {
      setHello(true)
      keep('sheep/hello', '1')
    }, 1500)
    const go = setTimeout(() => setHello(false), 30000)
    return () => {
      clearTimeout(come)
      clearTimeout(go)
    }
  }, [])
  // The music box plays for as long as this page is here (and only with the sound on: see `music`).
  useEffect(() => {
    music(true)
    return () => music(false)
  }, [])
  // The sheep that is being dressed, in the card: its number and its seed, what it has on, what it is called, the
  // words that go with it, and the gift in euros. It is not in the field until it has been paid for.
  const [fresh, setFresh] = useState<Entry | null>(null)
  const [look, setLook] = useState<Look>({})
  const [called, setCalled] = useState('')
  const [words, setWords] = useState('')
  const [amount, setAmount] = useState(3)
  const [currency, setCurrency] = useState<Currency>(() => (API ? homeCurrency() : 'eur')) // what the gift is in: euros, or (with a server) Swiss francs
  const coin = (next: Currency) => {
    setCurrency(next)
    keep(COIN, next)
  }
  const [taken, setTaken] = useState(false) // whether this visit has had its very old sheep: there is one
  const [other, setOther] = useState(false) // whether the box for a gift of one's own is out
  const elder = amount === 0
  const shown = useMemo(() => ({ ...look, elder }), [look, elder]) // what the sheep in the window looks like: very old, at a gift of nothing
  const card = useRef<HTMLFormElement>(null)
  const [full, setFull] = useState(false)
  const [chosen, choose] = useState(-1)
  // With a server: a giver back from Stripe before Stripe has told the server (`waiting`, the sheep's number); what
  // there is to say about it after (`news`: it did not come in time, its payment is still being settled, or it was
  // not paid after all); a payment on its way (`paying`) or one that failed in the card (`trouble`).
  const [waiting, setWaiting] = useState(() => (given && !back && isId(wanted()) && returned() === 'paid' && wanted()) || 0)
  const [news, setNews] = useState<'' | 'late' | 'settling' | 'unpaid'>(() => (given && !back && isId(wanted()) && returned() !== 'paid' ? returned() as 'settling' | 'unpaid' : ''))
  // (Nothing to wait for: the address goes back to plain, and Stripe's parameters with it.)
  useEffect(() => void (news && history.replaceState(null, '', location.pathname)), [news])
  const [paying, setPaying] = useState(false)
  const [trouble, setTrouble] = useState('')
  // Stripe's form in the card (`counter`, where it goes; `elements`, Stripe's hold on it), and whether it is ready.
  const counter = useRef<HTMLDivElement>(null)
  const elements = useRef<Elements | null>(null)
  const [ready, setReady] = useState(false)
  const held = useRef(false) // a payment on its way: the card cannot be put away until Stripe has answered
  const cents = Math.round(amount * 100)
  const fits = cents >= LEAST && cents <= MOST // a gift Stripe may be asked for
  const paid = !!API && KEYED && mode === 'dress' && !elder // the card shows Stripe's form
  const bubble = useRef<HTMLDivElement>(null)
  const saying = useRef<HTMLElement>(null)
  const said = useRef(0) // when what the sheep is doing was last written on its card
  const pick = useRef(-1)
  const sounds = useRef([world.rang, world.splashes, world.landed, world.wuffed]) // what of the world's doings has had its noise
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
    // The field's small noises: the world counts what has happened, and the page makes a sound of what is new.
    const heard = sounds.current
    if (world.rang !== heard[0]) sfx('tinkle')
    if (world.landed !== heard[2]) sfx('jingle')
    if (world.wuffed !== heard[3]) sfx('bark', (world.wuffed % 3) / 2)
    heard[0] = world.rang
    heard[1] = world.splashes
    heard[2] = world.landed
    heard[3] = world.wuffed
    const e = pick.current === HERMIT ? world.hermit : world.ewes[pick.current]
    if (!e || !bubble.current) return
    _v.set(e.x, e.y + e.s * 1.15, e.z).project(camera) // just over its head (and its hat), and up with it when it hops
    bubble.current.style.translate = `${width / 2 + _v.x * 0.5 * width}px ${height / 2 - _v.y * 0.5 * height}px`
    // What it is at, in a word or two. Once said it stays said for a few seconds, whatever the sheep is at
    // underneath: a label that changes as fast as a sheep changes its mind cannot be read.
    const now = world.doing(e)
    const tag = saying.current
    if (tag && tag.textContent !== now && (!tag.textContent || performance.now() - said.current > HOLD)) {
      tag.textContent = now
      said.current = performance.now()
    }
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
      setNews('late')
    })()
    return () => void (gone = true)
  }, [waiting, world])

  // Stripe's form is in the card from the moment it opens (not for the very old sheep, who costs nothing), for the
  // gift as it stands: no payment exists until the button is pressed (Stripe's "deferred intent"), so nothing is
  // made by opening the card and closing it again. Stripe.js comes the first time the card opens.
  const gift = useRef(cents)
  const pence = useRef(currency)
  useEffect(() => {
    // (Before the form is made, below.)
    gift.current = fits ? cents : LEAST
    pence.current = currency
  }, [fits, cents, currency])
  useEffect(() => {
    if (!paid) return
    let gone = false
    let form: Payment | null = null
    void stripeJs()
      .then((made) => {
        if (gone || !counter.current) return
        const kept = made.elements({ mode: 'payment', amount: gift.current, currency: pence.current, appearance: APPEARANCE, fonts: FONTS })
        // Whatever the owner has switched on in Stripe's dashboard, as far as it suits the gift and the giver (the
        // worker's PaymentIntent says the same); Apple Pay or Google Pay where the device has them. One row a way of
        // paying, open under the one picked, three and then "More": tabs hid all but two behind a small menu. Not
        // Stripe's Link, which asks for an email and a telephone number to remember the card by, and doubles the
        // card's height for it.
        form = kept.create('payment', { paymentMethodOrder: ORDER, layout: { type: 'tabs', defaultCollapsed: false }, wallets: { link: 'never', applePay: 'auto', googlePay: 'auto' } })
        form.mount(counter.current)
        elements.current = kept
        setReady(true)
      })
      .catch((error: unknown) => {
        console.error('sheep: stripe', error) // (for whoever builds this; the giver gets the line)
        if (!gone) setTrouble("Stripe's form would not load. Nothing was paid; try again in a minute.")
      })
    return () => {
      gone = true
      form?.destroy()
      elements.current = null
      setReady(false)
    }
  }, [paid])
  // The gift changes: so does what the form will ask for (only ever a gift it may ask for).
  useEffect(() => {
    if (ready && fits) elements.current?.update({ amount: cents, currency })
  }, [ready, fits, cents, currency])

  /** A new sheep comes to be dressed: in the card, in a window of its own. */
  const begin = (like: Look = {}) => {
    if (!world.room()) return setFull(true)
    setHello(false)
    // With a server its number is one nobody can guess, and its seed comes from that, as the server's will.
    const id = API ? newId() : Date.now()
    setFresh({ id, seed: API ? seedOf(id) : Math.floor(Math.random() * 1e9), name: 'a sheep', message: '', date: new Date().toISOString().slice(0, 10), look: {} })
    choose(-1)
    setNews('')
    setTrouble('')
    setLook(like)
    setCalled('')
    setWords('')
    setAmount(3)
    setMode('dress')
  }
  // "Buy a sheep" on the front page comes here as `?buy`: the card is open a moment after the field is, the welcome is
  // not needed (it asks for the same thing), and the address goes back to plain.
  const [buying] = useState(() => new URLSearchParams(location.search).has('buy'))
  useEffect(() => {
    if (!buying) return
    keep('sheep/hello', '1')
    history.replaceState(null, '', location.pathname)
    const wait = setTimeout(() => begin(), 1200)
    return () => clearTimeout(wait)
    // (once: `begin` is new every render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buying])
  const close = useCallback(() => void (held.current || setMode('idle')), [])
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
  // (And what only a bigger gift can bring is let go of when the gift goes back under it. Nothing is chosen for anybody.)
  const give = (gift: number) => {
    const may = allowed(Math.round(gift * 100))
    const base: Look = (gift === 0) !== elder ? {} : look
    const items = base.items?.filter((item) => isWear(item) || may.includes(item))
    setLook({ ...base, items: items?.length ? items : undefined })
    setAmount(gift)
  }
  // One of the six things a sheep may have is tapped: the four to wear, the butterflies, the dog. Two at the most are
  // on, in any mix: a third takes the place of the earlier, a tap on one that is on takes it off, and one that cannot
  // go with another (the hat, the flowers) takes that one's place. "Nothing" takes them all off.
  const don = (thing: Item | '') => {
    const on = look.items ?? []
    const keep = on.filter((one) => thing && pairs(one, thing))
    const next = !thing ? [] : on.includes(thing) ? on.filter((one) => one !== thing) : [...keep.slice(keep.length === 2 ? 1 : 0), thing]
    setLook({ ...look, items: next.length ? next : undefined })
  }
  /**
   * With a server, Stripe's form in the card (see `paid`): paid there, the sheep drops; a bank that wants its own page
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
      if (!KEYED) return setTrouble('This build has no Stripe key (VITE_STRIPE_PUBLISHABLE), so nothing can be paid. Nothing was.')
      const form = elements.current
      if (!form || !fits) return
      // The sheep as it is sent: what drops once it is paid, whatever the card says by then.
      const entry: Entry = { ...fresh, ...tidy({ name: called, message: words, look }) }
      setPaying(true)
      held.current = true
      setTrouble('')
      try {
        // The form checks what was typed in it, then the worker makes the payment, then the form pays it: a bank
        // that wants a word (3-D Secure) asks in a window of its own here, and only one that must have its own page
        // sends the giver away, and back to `?sheep=<id>`.
        const typed = await form.submit()
        if (typed.error) return setTrouble(typed.error.message ?? 'Something in the form is not right yet.')
        const answer = await fetch(`${API}/checkout`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: fresh.id, amount: cents, currency, name: called, message: words, look }),
        })
        const { clientSecret, error } = (await answer.json()) as { clientSecret?: unknown; error?: unknown }
        if (!answer.ok || typeof clientSecret !== 'string') return setTrouble(error === 'amount' ? `From ${money(LEAST / 100, currency)} to ${money(MOST / 100, currency)}, please.` : 'That did not go through. Nothing was paid; try again in a minute.')
        const done = await (await stripeJs()).confirmPayment({ elements: form, clientSecret, confirmParams: { return_url: `${location.origin}${location.pathname}?sheep=${fresh.id}` }, redirect: 'if_required' })
        if (done.error) return setTrouble(`${done.error.message ?? 'That did not go through.'} Nothing was paid.`)
        held.current = false
        if (done.paymentIntent?.status !== 'succeeded') {
          // Taken, but still being settled (some ways of paying take a while): the card goes, and the sheep comes to
          // the field when Stripe tells the worker it is paid, on this visit's next reload or on the next visit.
          setMode('idle')
          return setNews('settling')
        }
        // Paid: the sheep comes to hang over the field at once, from what this page knows. Stripe's word to the
        // worker is for everybody else, and comes in its own time.
        if (world.bring(entry, eye.current?.pan.x, eye.current?.pan.z)) setMode('place')
        else setMode('idle') // (no room: it is in the field all the same on the next visit)
      } catch {
        setTrouble('The sheep office cannot be reached just now. Nothing was paid; try again in a minute.')
      } finally {
        held.current = false
        setPaying(false)
      }
      return
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
      {/* A sheep's card, over the sheep it is about, in four kinds that are kept apart: who it is (and the colour of
          its wool); what its giver wrote, which is the main thing; small tags for what it is doing now and what it
          has with it; and, small and last, when it came. */}
      {sheep && (
        <div className="bubble" ref={bubble} key={sheep.id} role="note">
          <strong>
            <i style={{ background: hex(sheep.look?.elder ? GREY : WOOL[woolOf(sheep.seed, sheep.look)]) }} aria-hidden="true" />
            {sheep.name}
          </strong>
          {sheep.message && <q>{sheep.message}</q>}
          <span className="pills">
            <em ref={saying} />
            {(sheep.look?.elder ? (sheep.look.memory ? [sheep.look.memory] : []) : (sheep.look?.items ?? [])).map((thing) => (
              <span key={thing}>
                {PICTURES[thing]}
                {sheep.look?.elder ? REMEMBERS[thing as Memory].replace('remembering ', '') : thing}
              </span>
            ))}
          </span>
          {sheep.date && <small>Arrived {when(sheep.date)}</small>}
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
            aria-label="Buy me a sheep"
            tabIndex={-1}
            ref={card}
            onSubmit={(event) => {
              event.preventDefault()
              void pay()
            }}
          >
            <section className="fit" inert={paying}>
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
                <div className="row" role="group" aria-labelledby="tag-wear">
                  {(['', ...WEARS] as const).map((thing) => (
                    <button type="button" key={thing} className="swatch" aria-pressed={thing ? !!look.items?.includes(thing) : !look.items?.length} aria-label={thing || 'nothing'} onClick={() => don(thing)}>
                      {PICTURES[thing]}
                    </button>
                  ))}
                  {/* What a bigger gift can bring, after what is worn: chips of the same row and the same two at the most, but shut (dim, with the gift it takes) until the gift is that much. */}
                  {([['butterflies', 5], ['dog', 10]] as const).map(([thing, from]) => {
                    const open = amount >= from
                    return (
                      <button type="button" key={thing} className="swatch perk" disabled={!open} aria-pressed={open && !!look.items?.includes(thing)} aria-label={`${thing === 'dog' ? 'a small dog' : 'butterflies'}${open ? '' : `: with a gift from ${money(from, currency)}`}`} onClick={() => don(thing)}>
                        {PICTURES[thing]}
                        {!open && <small>{money(from, currency)}</small>}
                      </button>
                    )
                  })}
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
              <div className="head">
                <strong>{elder ? 'A very old sheep' : 'Buy me a sheep'}</strong>
              </div>
              <div className="row amounts" role="radiogroup" aria-label={`The gift, in ${currency === 'chf' ? 'Swiss francs' : 'euros'}`} inert={paying}>
                {[0, 3, 5, 10].map((gift) => (
                  <button type="button" key={gift} className={gift ? 'pick' : 'pick nought'} role="radio" aria-checked={amount === gift} aria-label={money(gift, currency)} onClick={() => give(gift)}>
                    {/* The sign in front of the number, so that it reads as a price; the chips are small enough for "CHF 10" in one row. */}
                    {currency === 'chf' ? `CHF ${gift}` : `€${gift}`}
                  </button>
                ))}
                {other || ![0, 3, 5, 10].includes(amount) ? (
                <label className="gift">
                  <input name="amount" type="number" min={elder ? 0 : LEAST / 100} max={MOST / 100} step="0.01" required inputMode="decimal" value={amount} onChange={(event) => give(Number(event.target.value))} />
                </label>
                ) : (
                  <button type="button" className="more" onClick={() => setOther(true)}>
                    Another amount
                  </button>
                )}
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
                <p>
                  {trouble || (fits ? `Thank you. Genuinely. The money comes to me, Stripe carries it, and neither of us has to make eye contact. In return you get a sheep. It's the least I can do, and also the most.` : `From ${money(LEAST / 100, currency)} to ${money(MOST / 100, currency)}, please: Stripe takes nothing outside that.`)}
                  {fits && !trouble && (
                    <>
                      {' '}
                      <button type="button" className="more" onClick={() => coin(currency === 'chf' ? 'eur' : 'chf')} disabled={paying}>
                        {currency === 'chf' ? 'Pay in euros instead' : 'Pay in Swiss francs instead'}
                      </button>
                    </>
                  )}
                </p>
              ) : (
                <p>The paying part is not switched on yet: nothing is charged, whatever is picked. This one is on the house, and lives in this browser only.</p>
              )}
              {/* Stripe's form, from the moment the card opens: put away (`inert`, faded) while the gift is one it may
                  not ask for, and the line above says why. */}
              {paid && <div className={fits ? 'till' : 'till off'} ref={counter} inert={!fits || paying} />}
              <div className="row foot">
                <button className="btn" disabled={paying || (elder && taken) || (paid && (!ready || !fits))}>
                  {elder ? 'Take her in' : paying ? 'A moment…' : 'Take my money'}
                </button>
                <button type="button" className="sound" onClick={close} disabled={paying}>
                  Never mind
                </button>
              </div>
            </section>
          </form>
        </div>
      )}
      {/* A first visit: a word from the field, with two ways out. Said once, and never again in this browser. */}
      {hello && mode === 'idle' && !news && !waiting && (
        <div className="welcome" role="region" aria-label="A word about tips">
          <p>
            <b>If you like any of my projects, consider buying me a sheep.</b>
          </p>
          <p>I know. Asking for money and calling it a sheep does not make it any less asking for money. It is a very nice sheep, though.</p>
          <div className="row">
            <button
              className="btn"
              onClick={() => {
                setHello(false)
                begin()
              }}
              disabled={full}
            >
              Buy a sheep
            </button>
            <button className="sound" onClick={() => setHello(false)}>
              Just look around
            </button>
          </div>
        </div>
      )}
      {mode === 'place' && <p className="place">Click where it should land. It will wander off anyway.</p>}
      {mode === 'idle' && waiting > 0 && <p className="place">Your sheep is on its way from Stripe. A moment.</p>}
      {mode === 'idle' && news === 'late' && <p className="place">Your sheep has not turned up yet. It will be in the field once Stripe says so: look again in a minute.</p>}
      {mode === 'idle' && news === 'settling' && <p className="place">Thank you. The payment is still being settled, which some ways of paying take their time over. Your sheep comes to the field once it is: look again later.</p>}
      {mode === 'idle' && news === 'unpaid' && (
        <p className="place">
          That payment did not go through, so nothing was paid and no sheep was made.{' '}
          <button className="sound" onClick={() => begin()} disabled={full}>
            Try again
          </button>
        </p>
      )}
      <header className="top">
        <Back />
        {mode === 'idle' && (
          <button className="sound buy" onClick={() => begin()} disabled={full}>
            {/* A small sheep's face before the words, of squares as everything here is. */}
            {squares([2, 1, 8, 2, '#fffaf0'], [1, 3, 10, 5, '#fffaf0'], [4, 5, 4, 6, '#5f4f5a'], [2, 6, 2, 2, '#5f4f5a'], [8, 6, 2, 2, '#5f4f5a'], [5, 10, 2, 1, '#ffa8b8'])}
            {full ? 'The field is full for now' : 'Buy me a sheep'}
          </button>
        )}
        <Sound />
      </header>
    </main>
  )
}
