import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { WebGLRenderTarget, type PerspectiveCamera } from 'three'
import { Back, FINGERS, Hints } from '../hints.tsx'
import { Picture } from '../Picture.tsx'
import { setSound, toggleSound } from '../../sound.ts'
import { Island, forget, type GameState, type Said } from './Island.ts'
import { draw, sketch } from './sprites.ts'
import type { Friend } from './wishes.ts'
import posthog, { isPostHogEnabled, posthogLogger } from '../../posthog.ts'

// The isles by the names they have on the map. The strip of new land the lava builds has none: it is part of the volcano's story.
const ISLES: Record<string, string> = { island: 'The island', meadow: 'The meadow', snow: 'The snow', mountain: 'The mountain', swamp: 'The swamp', beach: 'The beach', volcano: 'The volcano', garden: 'The garden', islet: 'The islet' }
// Who is drawn how: the kind of animal and its colour.
const FACES: Record<string, string> = {
  bird: 'bird/7cc4f5', bunny: 'bunny/ffffff', tortoise: 'tortoise/8fae6a', chick: 'chick/ffe07a', flock: 'bird/ffd45c', duck: 'duck/ffffff', beaver: 'beaver/b07a55', fish: 'fish/ff7a2f', penguin: 'penguin/ffffff',
  frog: 'frog/7fca6c', ghost: 'ghost/f4f8ff', crab: 'crab/ff7a5c', dragon: 'dragon/7fd6a8', mole: 'mole/5d5560', marmot: 'marmot/c9a06b', goat: 'goat/f4efe6', eagle: 'bird/9a7b62', owl: 'owl/b9a58a',
}
const TABS = ['Map', 'Friends', 'Finds', 'Log']
// In the log, a line about a friend has its face in front of it. A few other things have a picture too.
const SIGNS: Record<string, string> = {
  ...FACES, snail: 'snail/ff7a6b', bottle: 'bottle', secret: 'heart', combo: 'heart', capybara: 'capybara/b98a5e', axolotl: 'axolotl/ffb3c7', balloon: 'balloon/ffffff', bats: 'bat/5b4a66', 'falling star': 'star/fff3a8',
}
// The colour a name is written in where the thing itself does not say, or says white: bees are yellow.
const HUES: Record<string, string> = {
  bees: 'ffc21f', bunny: 'f08fa8', duck: 'ffa23f', penguin: '4a6fa8', goat: 'c9a06b', ghost: '8fb0ea', windmill: 'e9806f', shell: 'f08fa8', 'old tree': '8a6d58', fire: 'ff8a3c', geyser: '5cb8ee', snowman: '7fb4e8',
  snowball: '7fb4e8', lantern: 'ffc21f', volcano: 'ff6a3c', cactus: '5fa85a', river: '4fa8e8', 'fairy ring': 'e0527f', bats: '7a5fa0', balloon: 'e9605a', bottle: '4fb894', 'falling star': 'ffc21f', snail: 'ff7a6b',
  capybara: 'b98a5e', axolotl: 'f58fb0',
  secret: 'ffc21f', // "A secret: ..." has the word itself in gold
  // Lines of these kinds are not about a thing with a name to pick out: only what a tip marks itself stands out in them.
  tip: '', combo: '', 'about you': '',
}
/**
 * How a line names whoever or whatever it is about, for the page to make that stand out: a friend by its name in the
 * book (or the word the game has for it), a thing by its label or the noun in it. In one or many: "bunny", "bunnies".
 */
const naming = (about: string, name?: string) => {
  const head = (name ?? about).toLowerCase().replace(/^the /, '').split(/ (?:of|in|on|with) /)[0]
  const words = [head, head.split(' ').pop()!, ...(name ? [about] : [])].filter((word, k, all) => word.length > 2 && all.indexOf(word) === k)
  return words.map((word) => new RegExp(`\\b(${word.replace(/(ies|y|s)$/, '')}(?:s|es|ies|y)?)\\b`, 'i'))
}
/** The colour a thing's name is written in: its own, as dark (or by night as light) as words have to be to be read. */
const tint = (hex: string) => {
  const [r, g, b] = [0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255)
  const [most, least] = [Math.max(r, g, b), Math.min(r, g, b)]
  const d = most - least
  const hue = d === 0 ? 0 : most === r ? ((g - b) / d + 6) % 6 : most === g ? (b - r) / d + 2 : (r - g) / d + 4
  const strong = d === 0 ? 0 : d / (1 - Math.abs(most + least - 1))
  return `hsl(${Math.round(hue * 60)} ${Math.round(Math.min(85, strong * 140 + 12))}% var(--key))`
}
// (The three ways of getting about, said in a corner at the start of every island, are `Hints` in `../hints.tsx`: each
// goes the first time it is used there.)
// The controls, under the cog, in plain words (this is where people look when they are lost): a row for each thing
// there is to do, and across it the ways of doing it. With a mouse there are keys as well, and the two get a heading.
const WAYS = FINGERS ? [] : ['Mouse', 'Keys']
const HELP = FINGERS
  ? [
      ['Knock, pat', 'Tap'],
      ['Move', 'Drag'],
      ['Zoom', 'Pinch'],
      ['Turn', 'Twist with two fingers'],
    ]
  : [
      ['Knock, pat', 'Click', ''],
      ['Move', 'Drag', 'W A S D or arrows'],
      ['Zoom', 'Scroll', '+ or −'],
      ['Turn', 'Right-drag or Shift-drag', 'Q or E'],
      ['Next line of text', '', 'Space'],
    ]
/** What the book says about a friend: its next wish, or, once it has had them all, what became of it. */
const about = (friend: Friend) => (!friend.patted ? 'Would like a pat. Is trying to be cool about it.' : friend.more && !friend.granted ? (friend.wish ?? friend.line) : friend.after)

/** A small picture, a few pixels a side and drawn large: an animal, or one of the things drawn by hand. */
function Pic({ what, shade = false, size = 48 }: { what: string; shade?: boolean; size?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (canvas.current) draw(canvas.current, what, shade)
  }, [what, shade])
  return <canvas className="pic" ref={canvas} width={27} height={27} style={{ width: size, height: size }} aria-hidden="true" />
}

/**
 * A line as the game says it. The words in [square brackets] are the ones that name the thing the line is about: they
 * stand out, and where there is somewhere to go, a click on them goes there.
 */
function Line({ text, onGo, color, names = [] }: { text: string; onGo?: () => void; color?: string; names?: RegExp[] }) {
  // They are written in the colour of the thing itself, where that is known.
  const style = color ? { color: tint(color) } : undefined
  // A line that does not mark the words itself has them looked for: however it names what it is about, first found.
  const named = names.find((name) => name.test(text))
  return text.split(text.includes('[') || !named ? /[[\]]/ : named).map((part, k) =>
    k % 2 === 0 ? (
      part
    ) : onGo ? (
      <button key={k} className="key" style={style} onClick={onGo}>
        {part}
      </button>
    ) : (
      <b key={k} className="key" style={style}>
        {part}
      </b>
    ),
  )
}

/**
 * What stands in front of a name in the log: a face or a small picture where there is one; else the thing itself, drawn
 * from the boxes it is made of in the world; else a square of its colour.
 */
function Badge({ game, about, color }: { game: RefObject<Island | null>; about: string; color?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!canvas.current || !ctx) return
    const boxes = game.current?.sketch(about)
    if (SIGNS[about]) draw(canvas.current, SIGNS[about])
    else if (boxes?.length) sketch(canvas.current, boxes)
    else {
      ctx.clearRect(0, 0, 27, 27)
      ctx.fillStyle = color ? `#${color}` : 'rgba(128, 124, 140, 0.45)'
      ctx.fillRect(7, 7, 13, 13)
    }
  }, [game, about, color])
  return <canvas className="pic" ref={canvas} width={27} height={27} aria-hidden="true" />
}

/** The world from above, a pixel a tile, as it is right now: redrawn every second while it is looked at. */
function Chart({ game, open }: { game: RefObject<Island | null>; open: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!open) return
    const paint = () => {
      const px = game.current?.chart()
      const ctx = canvas.current?.getContext('2d')
      if (px && ctx) ctx.putImageData(new ImageData(px, 35, 34), 0, 0)
    }
    paint()
    const timer = setInterval(paint, 1000)
    return () => clearInterval(timer)
  }, [game, open])
  return <canvas ref={canvas} width={35} height={34} aria-label="The world from above" />
}

/** The small pictures on two of the buttons, drawn in the colour of the words: a loudspeaker, loud or crossed out, and a cog. */
const Speaker = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.5 9.5v5h3.6l4.9 4v-13l-4.9 4z" fill="currentColor" />
    {on ? <path d="M15.6 9.2a4 4 0 0 1 0 5.6M18.4 6.4a8 8 0 0 1 0 11.2" /> : <path d="M16 9.5l5 5m0-5l-5 5" />}
  </svg>
)
const Cog = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
    <circle cx="12" cy="12" r="8.7" strokeWidth="3.4" strokeDasharray="3.416" strokeDashoffset="1.708" />
    <circle cx="12" cy="12" r="5.4" strokeWidth="3.4" />
  </svg>
)

const START: GameState = { life: 0, found: 0, total: 8, hint: '', shown: false, waiting: 0, fresh: [], stuck: false, known: 'mzt', left: [], gone: [], done: false, tip: '', knocks: 0, combos: [0, 8], secrets: [0, 16], snails: [0, 7], friends: [], isles: [], finds: [], pairs: [], notes: [], credits: [], rolling: 0, rolled: 0, said: [], ended: false, cut: false }

/**
 * The island in the picture: made here, moved on every frame, and unmade when the picture goes.
 * @param tier the step the picture is at (see `../Picture.tsx`): the island draws its shadows to match
 */
function Stage({
  seed,
  onState,
  onGame,
  words,
  tier,
  onShot,
}: {
  seed: number
  onState: (state: GameState) => void
  onGame: (game: Island | null) => void
  words: RefObject<HTMLDivElement | null>
  tier: number
  /** Given a way to take a picture: it draws a frame and hands over the canvas, to be copied from there and then. */
  onShot: (take: (() => HTMLCanvasElement) | null) => void
}) {
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const canvas = gl.domElement
  const advance = useThree((state) => state.advance)
  const island = useRef<Island>(null)
  useEffect(() => {
    onShot(() => {
      advance(performance.now() / 1000)
      return gl.domElement
    })
    return () => onShot(null)
  }, [onShot, advance, gl])
  const begun = useRef(false)
  useEffect(() => {
    const created = (island.current = new Island(scene, canvas, onState, seed))
    onGame(created)
    // The lamps of the night are not drawn by day (see `Island.lamplight`). The shaders that have them in are put together
    // now, in the background, and the way the picture is drawn (into a buffer, not straight onto the screen): otherwise the
    // first nightfall would make the page stall while they are.
    const buffer = new WebGLRenderTarget(1, 1)
    gl.setRenderTarget(buffer)
    created.lamplight(true)
    void gl.compileAsync(scene, camera)
    created.lamplight(false)
    gl.setRenderTarget(null)
    buffer.dispose()
    // The noise a thing makes when it is knocked on, as a word that floats up from it and is gone.
    created.pop = (word, x, y) => {
      const el = document.createElement('span')
      el.className = 'word'
      el.textContent = word
      el.style.left = `${x}px`
      el.style.top = `${y}px`
      el.style.setProperty('--tilt', `${Math.random() * 16 - 8}deg`)
      el.style.setProperty('--drift', `${Math.random() * 30 - 15}px`)
      el.addEventListener('animationend', () => el.remove())
      words.current?.append(el)
    }
    return () => {
      created.dispose()
      island.current = null
      onGame(null)
    }
  }, [scene, camera, gl, canvas, onState, seed, onGame, words])
  // Its shadows go by the picture's steps. (After the island is made, so that a new one gets them too.)
  useEffect(() => island.current?.shadows(tier), [tier])
  useFrame(({ camera, size }, dt) => {
    const game = island.current
    if (!game) return
    game.update(Math.min(dt, 0.05), camera as PerspectiveCamera, size.width, size.height)
    // The first frame is drawn: the small opening the page itself put up while all this was loading can go.
    if (!begun.current) {
      begun.current = true
      const boot = document.getElementById('boot')
      boot?.classList.add('gone')
      setTimeout(() => boot?.remove(), 700)
    }
  })
  return null
}

export default function GamePage() {
  const [state, setState] = useState(START)
  // The sound is off whenever the game is opened, and a small label under its button asks, until the button has been
  // pressed. (The choice used to be remembered, so that on a later visit the button said "on" from the start: but a
  // browser lets a page make no sound before the first touch, and sometimes not after it either, so it said on and
  // nothing played.) Once it is on, every touch and key says so again, before the game hears it: a browser can send a
  // sound to sleep, which that wakes. A tap on the picture is not a "click" everywhere, so a finger lifting is
  // listened for as well.
  const [chosen, setChosen] = useState<'on' | 'off' | null>(null)
  const sound = chosen === 'on'
  useEffect(() => {
    const say = () => setSound(sound)
    const ways = ['click', 'keydown', 'pointerup', 'touchend']
    for (const way of ways) addEventListener(way, say, true)
    return () => {
      for (const way of ways) removeEventListener(way, say, true)
    }
  }, [sound])
  const loud = () => setChosen(toggleSound() ? 'on' : 'off')
  // Which island. 0 is the one as drawn; any other number deals the things on it out afresh, the same way every time.
  // The number sits in the link, so an island can be passed on.
  const [seed, setSeed] = useState(() => Number(new URLSearchParams(location.search).get('seed')) || 0)
  const [map, setMap] = useState(false) // the map is open: the isles, the friends, and what has been found
  const [tab, setTab] = useState('Map')
  const [news, setNews] = useState<string[]>([]) // the lines that were new in the log when it was last opened: they carry a dot
  const [menu, setMenu] = useState(false) // the cog's sheet is open: a new game, and how to get about
  const [waved, setWaved] = useState(-1) // the card at the end has been sent away: after which roll of the ending (it comes back after the next)
  const [copied, setCopied] = useState(false)
  const [card, setCard] = useState('') // a postcard of the island, as a picture to show and to save
  const completionCaptured = useRef(false)
  const shot = useRef<(() => HTMLCanvasElement) | null>(null)
  const onShot = useCallback((take: (() => HTMLCanvasElement) | null) => {
    shot.current = take
  }, [])
  const game = useRef<Island | null>(null) // the game that is running, for the buttons that reach into it
  const onGame = useCallback((island: Island | null) => {
    game.current = island
  }, [])
  const words = useRef<HTMLDivElement>(null)
  // A small label that follows the cursor and says what it is resting on.
  const label = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const follow = (e: PointerEvent) => {
      if (label.current) label.current.style.transform = `translate(${e.clientX + 16}px, ${e.clientY + 20}px)`
    }
    addEventListener('pointermove', follow)
    return () => removeEventListener('pointermove', follow)
  }, [])
  const { friends, combos, secrets, snails, isles, finds, pairs, said } = state
  // The map shows what has been found: an isle is on it once it is up out of the sea. Those still to come are listed
  // too, as question marks: which they are is not given away, only that there are more.
  const places = isles.filter((isle) => ISLES[isle.id] && isle.open)
  const unknown = isles.filter((isle) => ISLES[isle.id] && !isle.open)
  // How many things there are to find in the whole world, those on land still under the sea too.
  const things = isles.reduce((n, isle) => n + isle.found[1], 0) || 1
  // Whether a line leads somewhere, for a click on what it is about: to the friend, wherever that friend is by now, or
  // else to the place of the thing. A line about nothing that has a place leads nowhere, and neither does one about a
  // thing that is not there any more (the cloud that has rained itself out): its name is still written in its colour,
  // but is not a button.
  const befriended = (about: string) => friends.some((friend) => friend.id === about)
  // The colour whatever a line is about is written in, and how the line may name it.
  const hue = ([, about, , color]: Said) => HUES[about] ?? (befriended(about) ? FACES[about].split('/')[1] : color)
  const names = ([, about]: Said) => (about && HUES[about] !== '' ? naming(about, friends.find((friend) => friend.id === about)?.name) : [])
  const leads = ([, about, tile]: Said) => befriended(about) || (tile >= 0 && !state.gone.includes(tile))
  // That click: the view goes there, close up, and the map shuts.
  const see = ([, about, tile]: Said) => {
    if (befriended(about)) game.current?.follow(about)
    else game.current?.visit(tile)
    setMap(false)
  }
  const saying = said.find(([line]) => line === state.hint) // the line that is up, as the log has it
  const rolling = state.credits.length > 0 // the ending is rolling up over the picture
  // An isle is whole when everything on it is found: its things, its secrets, its snail. A whole isle gets a stamp.
  const whole = (isle: (typeof isles)[number]) => isle.open && isle.found[0] === isle.found[1] && isle.secrets[0] === isle.secrets[1] && isle.snail !== false
  const stamps = places.filter(whole).length
  // Every friend wishes for a pat, and six of them for something more.
  const wishes = [friends.filter((friend) => friend.patted).length + friends.filter((friend) => friend.granted).length, friends.length + friends.filter((friend) => friend.more).length]

  const fresh = () => {
    completionCaptured.current = false
    setState(START)
    setMap(false)
    setMenu(false)
    setWaved(-1)
    setCopied(false)
  }
  // A new game: another island, and the one that is left is not kept.
  const again = () => {
    if (isPostHogEnabled) posthog.capture('island_new_game_started')
    const next = 1 + ((seed + Math.floor(Math.random() * 9998)) % 9999) // never the same one
    forget(seed)
    history.replaceState(null, '', `?seed=${next}`)
    setSeed(next)
    fresh()
  }
  // A postcard: the island as the camera sees it right now, on a card with its number, how awake it is and the date.
  // (And a stamp, once the whole world is awake.) The buttons and the words are not in the picture.
  const postcard = () => {
    const from = shot.current?.()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!from || !ctx) return
    Object.assign(canvas, { width: 1500, height: 1050 })
    ctx.fillStyle = '#fffaf0'
    ctx.fillRect(0, 0, 1500, 1050)
    // The middle of the picture, cut to the shape of the card.
    const size = Math.max(1400 / from.width, 800 / from.height)
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(50, 50, 1400, 800, 28)
    ctx.clip()
    ctx.drawImage(from, (from.width - 1400 / size) / 2, (from.height - 800 / size) / 2, 1400 / size, 800 / size, 50, 50, 1400, 800)
    ctx.restore()
    const font = '"Bricolage Grotesque Variable", system-ui, sans-serif'
    ctx.fillStyle = '#3f3b4e'
    ctx.font = `800 68px ${font}`
    ctx.fillText('Wake the island', 52, 952)
    ctx.globalAlpha = 0.7
    ctx.font = `600 30px ${font}`
    ctx.fillText(`Island no. ${seed} · ${state.life}% awake · ${state.knocks} knocks · ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}`, 54, 1004)
    ctx.globalAlpha = 1
    if (state.done) {
      // The stamp: a ring of ink a little askew, as on the map.
      ctx.translate(1350, 950)
      ctx.rotate(-0.2)
      ctx.strokeStyle = ctx.fillStyle = '#e0527f'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.arc(0, 0, 62, 0, 7)
      ctx.stroke()
      ctx.lineWidth = 2
      ctx.setLineDash([7, 6])
      ctx.beginPath()
      ctx.arc(0, 0, 51, 0, 7)
      ctx.stroke()
      ctx.font = `800 24px ${font}`
      ctx.textAlign = 'center'
      ctx.fillText('WOKEN', 0, 9)
    }
    canvas.toBlob((blob) => {
      if (!blob) return
      if (isPostHogEnabled) posthog.capture('island_postcard_created', { life_percent: state.life, knocks: state.knocks, completed: state.done })
      posthogLogger.info('island postcard created', { life_percent: state.life, knocks: state.knocks, completed: state.done })
      setMenu(false)
      setCard((old) => {
        if (old) URL.revokeObjectURL(old)
        return URL.createObjectURL(blob)
      })
    })
  }
  const away = () => {
    URL.revokeObjectURL(card)
    setCard('')
  }
  // The journal's log is looked at: the lines that went into it without being said out loud show a dot this once,
  // and from now on are new no longer.
  const read = () => {
    setNews(state.fresh)
    game.current?.read()
  }
  const open = (name: string) => {
    setTab(name)
    if (name === 'Log') read()
  }
  useEffect(() => {
    if (state.done && !completionCaptured.current) {
      if (isPostHogEnabled) posthog.capture('island_completed', { knocks: state.knocks, life_percent: state.life })
      posthogLogger.info('island completed', { knocks: state.knocks, life_percent: state.life })
      completionCaptured.current = true
    }
  }, [state.done, state.knocks, state.life])

  return (
    <>
      {/* Up close, the top and the bottom of the picture go soft, as in a photograph of something small: `near`. */}
      <Picture key={seed} flat style={{ position: 'fixed', inset: 0 }} near={() => game.current?.near ?? 0}>
        {(tier) => <Stage seed={seed} onState={setState} onGame={onGame} words={words} tier={tier} onShot={onShot} />}
      </Picture>
      <div className="words" ref={words} aria-hidden="true" />

      {/* While the cog's sheet is open, a click anywhere else only shuts it: it does not reach the world. */}
      {(menu || card) && <div className="scrim" onClick={() => (card ? away() : setMenu(false))} />}
      {/* The three ways of getting about, in the corner nobody else is using, until each has been used once on this
          island. */}
      <Hints known={state.ended ? 'mzt' : state.known} />
      <header className="top">
        {/* The way back to everything else, in the corner: the castle has the same. */}
        <Back />
        <button className="sound icon" aria-label={sound ? 'Turn the sound off' : 'Turn the sound on'} title={sound ? 'Sound on' : 'Sound off'} onClick={loud}>
          <Speaker on={sound} />
          {/* Until somebody has said yes or no to it: a small label under the button, which asks. */}
          {chosen === null && (
            <i className="ask" aria-hidden="true">
              Sound?
            </i>
          )}
        </button>
        {/* A dot on it when something has gone into the log without being said out loud. */}
        <button
          className="sound"
          aria-expanded={map}
          aria-controls="map"
          data-dot={state.fresh.length > 0 && !(map && tab === 'Log')}
          title={`The map, and what you have found: ${state.found} of ${things} things`}
          onClick={() => {
            setMap(!map)
            setMenu(false)
            if (!map && tab === 'Log') read()
          }}
        >
          Journal
          {/* How far along the game is: a thin line under the word, which fills as the things are found. All of them
              count, those on land still under the sea too, so it only ever goes forward. */}
          <i className="gauge" aria-hidden="true">
            <i style={{ width: `${(100 * state.found) / things}%` }} />
          </i>
        </button>
        {/* And a dot on this one when nothing has been found for a good while. */}
        <button className="sound" data-dot={state.stuck} onClick={() => game.current?.nudge()} title="Shows you something you have not found yet">
          Tip
        </button>
        <div className="menu">
          <button
            className="sound icon"
            aria-expanded={menu}
            aria-controls="menu"
            aria-label="Settings"
            title="Settings"
            onClick={() => {
              setMenu(!menu)
              setMap(false)
            }}
          >
            <Cog />
          </button>
          <div className="sheet" id="menu" data-open={menu}>
            <h3>Game</h3>
            {/* Two buttons and no more words than their names: what each does in full is there for whoever rests the
                cursor on it. The one thing worth knowing beforehand is in the small print under them. */}
            <div className="pair">
              <button className="sound" onClick={again} title="Starts a new island: the same places, with the things on them moved. The island you are on now is not kept.">
                New game
              </button>
              <button className="sound" onClick={postcard} title="A picture of your island as it looks right now, on a card, to keep or to send to somebody.">
                Postcard
              </button>
            </div>
            <p>The game saves by itself. A new game replaces this island.</p>
            <h3>Controls</h3>
            <table>
              {WAYS.length > 0 && (
                <thead>
                  <tr>
                    <td />
                    {WAYS.map((way) => (
                      <th key={way} scope="col">
                        {way}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {HELP.map(([what, ...how]) => (
                  <tr key={what}>
                    <th scope="row">{what}</th>
                    {how.map((way, k) => (
                      <td key={WAYS[k] ?? k}>{way}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Who made this, and the way to the rest of the site: the page this game is a part of. Plain words, as
                everything on this sheet. */}
            <h3>About me</h3>
            <p className="about">
              I’m Tiago Jerónimo Silva, a senior full-stack engineer in Zürich. <a href="/">More things I’ve made</a> · <a href="/cv/">My CV</a>
            </p>
          </div>
        </div>
      </header>

      <aside className="atlas" id="map" data-open={map} aria-label="Journal">
        <div className="tabs" role="tablist">
          {TABS.map((name) => (
            <button key={name} role="tab" aria-selected={tab === name} data-dot={name === 'Log' && tab !== 'Log' && state.fresh.length > 0} onClick={() => open(name)}>
              {name}
            </button>
          ))}
          <button className="shut" aria-label="Close the journal" onClick={() => setMap(false)}>
            ×
          </button>
        </div>

        <div className="page">
          {tab === 'Map' && (
            <section>
              <div className="tally">
                <h1>Wake the island</h1>
                <div className="meter" role="progressbar" aria-label="Life" aria-valuenow={state.life} aria-valuemin={0} aria-valuemax={100}>
                  <span style={{ width: `${state.life}%` }} />
                </div>
                <p className="count">
                  {state.life}% alive · {state.found} of {state.total} found
                </p>
                <p className="keys">
                  {combos[0]} of {combos[1]} combos · {secrets[0]} of {secrets[1]} secrets · {snails[0]} of {snails[1]} snails · {state.knocks} knocks
                </p>
              </div>
              <div className="chart">
                <em className="title">The world, so far</em>
                <div className="land">
                  <Chart game={game} open={map} />
                  {places.map((isle) => (
                    <div key={isle.id} className="pin" style={{ left: `${(isle.x / 35) * 100}%`, top: `${(isle.z / 34) * 100}%` }}>
                      {whole(isle) && (
                        <span className="stamp">
                          <Pic what="stamp" size={18} />
                          woken
                        </span>
                      )}
                      <span className="tag">{ISLES[isle.id]}</span>
                      {isle.id === 'volcano' && friends.some((friend) => friend.id === 'dragon' && friend.met) && <span className="tag small">here be a dragon</span>}
                    </div>
                  ))}
                </div>
                <span className="rose">
                  <Pic what="compass" size={38} />
                </span>
              </div>
              <p className="note">
                {stamps} of {places.length + unknown.length} stamps. An isle gets its stamp when everything on it is found: its things, its secrets and its snail. A stamp means nothing. You will want all of them.
                {unknown.length > 0 && ' The map only shows what has come up out of the sea. There is more out there. There usually is.'}
              </p>
              <ul className="ledger">
                {places.map((isle) => (
                  <li key={isle.id} data-whole={whole(isle)}>
                    <strong>{ISLES[isle.id]}</strong>
                    <span>
                      {isle.found[1] > 0 && `${isle.found[0]} of ${isle.found[1]} found · `}
                      {isle.secrets[1] > 0 && `${isle.secrets[0]} of ${isle.secrets[1]} ${isle.secrets[1] > 1 ? 'secrets' : 'secret'} · `}
                      {isle.snail !== undefined && `${isle.snail ? 'snail found' : 'a snail hides here'} · `}
                      {isle.life}% awake
                    </span>
                  </li>
                ))}
                {unknown.map((isle) => (
                  <li key={isle.id} data-open="false">
                    <strong>???</strong>
                    <span>still under the sea</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === 'Friends' && (
            <section>
              <p className="note">A heart for every wish granted. A name takes you to see them. They do not know they are in a book. Do not tell them.</p>
              <ul className="cards">
                {friends.map((friend) => (
                  <li key={friend.id} data-met={friend.met}>
                    <Pic what={FACES[friend.id]} shade={!friend.met} size={54} />
                    <div>
                      {friend.met ? (
                        <button
                          className="link"
                          onClick={() => {
                            game.current?.follow(friend.id)
                            setMap(false)
                          }}
                        >
                          {friend.name}
                        </button>
                      ) : (
                        <strong>???</strong>
                      )}
                      <span className="hearts" aria-label={`${friend.patted ? 'patted' : 'not patted yet'}${friend.more ? (friend.granted ? ', wish granted' : ', one wish to go') : ''}`}>
                        {friend.patted ? '♥' : '♡'}
                        {friend.more && (friend.granted ? '♥' : '♡')}
                      </span>
                      {friend.met && <p>{about(friend)}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === 'Finds' && (
            <section>
              <h3>
                Secrets, {secrets[0]} of {secrets[1]}
              </h3>
              <p className="note">Bottles wash up on the beach with clues. A clue stays here until what it points at is found. Yes, the game leaves you notes about itself. It worries.</p>
              <ul className="stickers">
                {finds.map((find, k) => (
                  <li key={k} data-found={!!find.name}>
                    <Pic what={find.icon} shade={!find.name} size={46} />
                    <span>{find.name ?? (find.hint ? `“${find.hint}”` : '?')}</span>
                  </li>
                ))}
              </ul>
              <h3>
                Snails, {snails[0]} of {snails[1]}
              </h3>
              <div className="row">
                {isles
                  .filter((isle) => isle.snail !== undefined)
                  .map((isle) => (
                    <span key={isle.id} title={isle.open ? ISLES[isle.id] : undefined}>
                      <Pic what={isle.snail ? 'snail/ff7a6b' : 'snail/86b6f5'} shade={!isle.snail} size={34} />
                    </span>
                  ))}
              </div>
              <h3>
                Combos, {combos[0]} of {combos[1]}
              </h3>
              <ul className="finds">
                {pairs.map((pair, k) => (
                  <li key={k} className={pair.name ? undefined : 'rest'}>
                    {pair.name ?? (pair.hint ? `“${pair.hint}”` : 'Two things that do something together. Like most good ideas, and most bad ones')}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === 'Log' && (
            <section>
              <p className="note">Everything that has been said so far, the latest on top, and who or what it was about. A tip is ticked once it is seen to; a line across marks new land. Nobody asked for minutes. The island keeps minutes.</p>
              <ul className="log">
                {said
                  .slice()
                  .reverse()
                  .map((entry) => {
                    const [line, about, tile, color] = entry
                    // Not a line at all, but a mark: this is where a piece of land came up.
                    if (about === 'land')
                      return (
                        ISLES[line] && (
                          <li key={line} className="chapter">
                            {ISLES[line]} came up
                          </li>
                        )
                      )
                    const go = leads(entry)
                    const name = friends.find((friend) => friend.id === about)?.name ?? about.slice(0, 1).toUpperCase() + about.slice(1)
                    // A tip about a thing that has since been found is seen to: ticked, and quieter. So is a wish
                    // that has been granted.
                    const granted = friends.some((friend) => friend.granted && friend.wish === line)
                    const done = granted || (about === 'tip' && tile >= 0 && !state.left.includes(tile))
                    return (
                      <li key={line} data-about={about} data-done={done}>
                        {about && (
                          <strong>
                            <Badge game={game} about={about} color={color} />
                            {go ? (
                              <button className="go" onClick={() => see(entry)} title="Go and see">
                                {name}
                              </button>
                            ) : (
                              name
                            )}
                            {done && <span className="tick">{granted ? '✓ granted' : '✓ done'}</span>}
                            {/* Not said out loud at the time, and not seen here before: a dot. */}
                            {(news.includes(line) || state.fresh.includes(line)) && <i className="new" title="New: this one went by unread" />}
                          </strong>
                        )}
                        <span>
                          <Line text={line} onGo={go ? () => see(entry) : undefined} color={hue(entry) || color} names={names(entry)} />
                        </span>
                      </li>
                    )
                  })}
              </ul>
            </section>
          )}
        </div>
      </aside>

      {/* What the game says, a line at a time across the bottom, like a subtitle. Whoever or whatever a line is about
          is written in its own colour, and a click on that goes to see it; the rest of the line lets clicks through to
          the world. The space bar is "read, next", and a small mark in the corner says that another line is waiting
          (in the corner, and not at the end of the words: there it made the line wrap afresh whenever it came or went).
          (Not while the ending rolls: that has the picture to itself.) */}
      <p className="speech" key={state.hint} data-open={state.shown && !rolling} aria-live="polite">
        <Line text={state.hint} onGo={saying && leads(saying) ? () => see(saying) : undefined} color={saying ? hue(saying) || saying[3] : undefined} names={saying ? names(saying) : []} />
        <small aria-hidden="true" data-more={state.waiting > 0}>
          ▸
        </small>
      </p>
      {/* The ending: what whoever is in the balloon has to say rolls up over the island, like the credits of a film,
          every line on a card of its own. Rolled again (a click on the balloon), it starts from the bottom again: hence
          the key. When the last of it has gone off the top, it is over: the page says so itself, since the game's clock
          stands still while nobody is looking, and the words do not. */}
      {rolling && (
        <div className="credits" key={state.rolled} aria-live="polite">
          <div style={{ animationDuration: `${state.rolling}s` }} onAnimationEnd={(event) => event.animationName === 'credits' && game.current?.next()}>
            {state.credits.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      )}

      <div className="label" ref={label} data-open={!!state.tip}>
        <Line text={state.tip} />
      </div>

      <div className="end" data-open={state.done && state.ended && waved !== state.rolled && !rolling} data-cut={state.cut} role="dialog" aria-label="The end">
        {/* Everybody who is up, along the top: it is their island now. */}
        <div className="crowd" aria-hidden="true">
          {friends
            .filter((friend) => friend.met && FACES[friend.id])
            .map((friend) => (
              <Pic key={friend.id} what={FACES[friend.id]} size={30} />
            ))}
        </div>
        <h2>The whole world is awake</h2>
        <p>
          You woke it in <strong>{state.knocks} knocks</strong>. It was a game about clicking on things until they got better. It worked. That almost never works. Thank you.
        </p>
        {/* What else there was to find, and how much of it was found: four small tiles. */}
        <dl className="stats">
          {(
            [
              ['combos', combos],
              ['secrets', secrets],
              ['snails', snails],
              ['wishes', wishes],
            ] as [string, number[]][]
          ).map(([name, [have, all]]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>
                {have}
                <small> of {all}</small>
              </dd>
            </div>
          ))}
        </dl>
        <ul className="noticed">
          {state.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <div className="buttons">
          <button className="btn" onClick={() => setWaved(state.rolled)}>
            Keep looking around
          </button>
          <button className="btn" onClick={again}>
            New game
          </button>
          <button className="sound" onClick={postcard}>
            A postcard of it
          </button>
          <button className="sound" onClick={() => void navigator.clipboard?.writeText(location.href).then(() => setCopied(true))}>
            {copied ? 'Link copied. It is somebody else’s island now, too' : 'Copy the link to this island'}
          </button>
        </div>
        {/* And who made it, with the way to the rest of the site: the same line as under the cog. */}
        <p className="about">
          I’m Tiago Jerónimo Silva, a senior full-stack engineer in Zürich. <a href="/">More things I’ve made</a> · <a href="/cv/">My CV</a>
        </p>
      </div>

      {/* The postcard, once one has been made: the picture, and a way to keep it. */}
      <div className="postcard" data-open={!!card} role="dialog" aria-label="A postcard of your island">
        {card && <img src={card} alt="A postcard of your island" />}
        <div className="buttons">
          <a className="btn" href={card || undefined} download={`wake-the-island-${seed}.png`}>
            Save the picture
          </a>
          <button className="sound" onClick={away}>
            Close
          </button>
        </div>
      </div>
    </>
  )
}
