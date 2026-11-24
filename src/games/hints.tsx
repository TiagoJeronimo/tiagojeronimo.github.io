// What every game has in its corners: the way back to the front page, the sound's button, and the three ways of
// getting about, said until each has been used: with fingers on a screen that is touched; otherwise with a mouse, and
// then the keys that do the same come after, in brackets. `hints.css` styles them, and the bar across the top that the
// way back sits in.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ART } from '../home/art.ts'
import { setSound, toggleSound } from '../sound.ts'
import './hints.css'

export const FINGERS = matchMedia('(pointer: coarse)').matches // a screen that is touched: no mouse, and no keys to speak of
const HINTS = FINGERS
  ? [['m', '', 'Drag to move'], ['z', '', 'Pinch to zoom'], ['t', '', 'Twist to turn']]
  : [['m', 'W A S D', 'Drag to move'], ['z', '+ −', 'Scroll to zoom'], ['t', 'Q E', 'Right-drag to turn']]

/** The way back to everything else: the first thing in a game's `<header className="top">`. */
export const Back = () => (
  <a className="sound back" href="/">
    ← Things I’ve made
  </a>
)

/**
 * The three ways of getting about, in the corner nobody else is using.
 * @param known the ways that have been used, as their letters (`m`, `z`, `t`): those are no longer said
 * @param extra a game's own, each a letter (its own, not `m` `z` `t`) and the words: they follow the three, and go the same way
 */
export function Hints({ known, extra = [] }: { known: string; extra?: [letter: string, words: string][] }) {
  const list = useRef<HTMLUListElement>(null)
  return (
    <>
      <ul className="hints" aria-label="How to get about" ref={list}>
        {HINTS.map(([way, keys, how]) => (
          <li key={way} data-letter={way} data-done={known.includes(way)}>
            {how}
            {keys && <kbd>[or {keys}]</kbd>}
          </li>
        ))}
        {extra.map(([letter, words]) => (
          <li key={letter} data-letter={letter} data-done={known.includes(letter)}>
            {words}
          </li>
        ))}
      </ul>
    </>
  )
}

/** A loudspeaker, loud or crossed out, drawn in the colour of the words. */
const Speaker = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.5 9.5v5h3.6l4.9 4v-13l-4.9 4z" fill="currentColor" />
    {on ? <path d="M15.6 9.2a4 4 0 0 1 0 5.6M18.4 6.4a8 8 0 0 1 0 11.2" /> : <path d="M16 9.5l5 5m0-5l-5 5" />}
  </svg>
)

/**
 * The sound's button, for the right of the bar. The sound is off whenever a game is opened, and a small label under
 * the button asks, until it has been pressed. (The choice used to be remembered, so that on a later visit the button
 * said "on" from the start: but a browser lets a page make no sound before the first touch, and sometimes not after it
 * either, so it said on and nothing played.) Once it is on, every touch and key says so again, before the game hears
 * it: a browser can send a sound to sleep, which that wakes. A tap on the picture is not a "click" everywhere, so a
 * finger lifting is listened for as well.
 */
export function Sound() {
  const [chosen, setChosen] = useState<'on' | 'off' | null>(null)
  const sound = chosen === 'on'
  useEffect(() => {
    const say = () => {
      setSound(sound)
    }
    const ways = ['click', 'keydown', 'pointerup', 'touchend']
    for (const way of ways) addEventListener(way, say, true)
    return () => {
      for (const way of ways) removeEventListener(way, say, true)
    }
  }, [sound])
  const choose = () => setChosen(toggleSound() ? 'on' : 'off')
  return (
    <button className="sound icon" aria-label={sound ? 'Turn the sound off' : 'Turn the sound on'} title={sound ? 'Sound on' : 'Sound off'} onClick={choose}>
      <Speaker on={sound} />
      {/* Until somebody has said yes or no to it: a small label under the button, which asks. */}
      {chosen === null && (
        <i className="nudge" aria-hidden="true">
          Sound?
        </i>
      )}
    </button>
  )
}

/** The small picture on the gear's button, drawn in the colour of the words. */
const Cog = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
    <circle cx="12" cy="12" r="8.7" strokeWidth="3.4" strokeDasharray="3.416" strokeDashoffset="1.708" />
    <circle cx="12" cy="12" r="5.4" strokeWidth="3.4" />
  </svg>
)

const WAYS = FINGERS ? [] : ['Mouse', 'Keys']
/** @param act what a click does in this game: its row is the first of the controls */
const controls = (act: string) =>
  FINGERS
    ? [[act, 'Tap'], ['Move', 'Drag'], ['Zoom', 'Pinch'], ['Turn', 'Twist with two fingers']]
    : [[act, 'Click', ''], ['Move', 'Drag', 'W A S D or arrows'], ['Zoom', 'Scroll', '+ or −'], ['Turn', 'Right-drag or Shift-drag', 'Q or E']]

/**
 * The gear for the right of the bar, as the island's: a sheet with how to get about, and who made this, with the way
 * to the rest of the site. (The island has a sheet of its own, with its own buttons in it.)
 * @param act what a click does here ("Send the helper")
 * @param children whatever else the game puts on the sheet, under a "Game" heading: its buttons (a press on one shuts the sheet)
 * @param buy false in the sheep's own game, where the way to buy a sheep is in the bar
 */
export function Gear({ act, children, buy = true }: { act: string; children?: ReactNode; buy?: boolean }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const away = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    addEventListener('keydown', away)
    return () => removeEventListener('keydown', away)
  }, [open])
  return (
    <>
      {/* While the sheet is open, a click anywhere else only shuts it: it does not reach the world. */}
      {open && <div className="gear-scrim" onClick={() => setOpen(false)} />}
      <div className="gear">
        <button className="sound icon" aria-expanded={open} aria-controls="gear" aria-label="Settings" title="Settings" onClick={() => setOpen(!open)}>
          <Cog />
        </button>
        <div className="sheet" id="gear" data-open={open} onClick={(event) => (event.target as HTMLElement).closest('button') && setOpen(false)}>
          {children && (
            <>
              <h3>Game</h3>
              {children}
            </>
          )}
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
              {controls(act).map(([what, ...how]) => (
                <tr key={what}>
                  <th scope="row">{what}</th>
                  {how.map((way, k) => (
                    <td key={WAYS[k] ?? k}>{way}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <h3>About me</h3>
          <p className="about">
            I’m Tiago Jerónimo Silva, a senior full-stack engineer in Zürich. <a href="/">More things I’ve made</a> · <a href="/cv/">My CV</a>
          </p>
          {buy && (
            <p className="about">
              <SheepLink />
            </p>
          )}
        </div>
      </div>
    </>
  )
}

/** The sheep's face, of squares as everything in its game is: for the button there, and for the way to it. */
export const SheepFace = () => (
  <svg viewBox="0 0 12 12" aria-hidden="true">
    <rect x="2" y="1" width="8" height="2" fill="#fffaf0" />
    <rect x="1" y="3" width="10" height="5" fill="#fffaf0" />
    <rect x="4" y="5" width="4" height="6" fill="#5f4f5a" />
    <rect x="2" y="6" width="2" height="2" fill="#5f4f5a" />
    <rect x="8" y="6" width="2" height="2" fill="#5f4f5a" />
    <rect x="5" y="10" width="2" height="1" fill="#ffa8b8" />
  </svg>
)

/** A sheep as the landing page draws its animals: front on, a pixel to a square, with its pink ears and cheeks. */
const Ewe = () => {
  const { rows, ink } = ART.sheep
  return (
    <svg viewBox={`0 0 ${rows[0].length} ${rows.length}`} shapeRendering="crispEdges" aria-hidden="true">
      {rows.flatMap((row, y) => [...row].map((c, x) => (c === '.' ? null : <rect key={`${x} ${y}`} x={x} y={y} width={1.03} height={1.03} fill={ink[c]} />)))}
    </svg>
  )
}

/** A tuft of grass with a pink flower and a yellow one, a pixel to a square, in the greens of the games' ground. */
const TUFT = ['....P...Y...', '...PPP.YYY..', '....P...Y...', '.L..G..G..G.', '.G.LG.LG.LG.', 'LG.GG.GGLGG.', 'GGGGGGGGGGGG']
const TUFT_INK: Record<string, string> = { P: '#ffb3cf', Y: '#ffd45c', L: '#a8e07a', G: '#6fbf73' }
const Grass = () => (
  <svg className="grass" viewBox="0 0 12 7" shapeRendering="crispEdges" aria-hidden="true">
    {TUFT.flatMap((row, y) => [...row].map((c, x) => (c === '.' ? null : <rect key={`${x} ${y}`} x={x} y={y} width={1.03} height={1.03} fill={TUFT_INK[c]} />)))}
  </svg>
)

/**
 * The way to the sheep, as a small pink card like the one at the foot of the front page: one of its sheep, hopping now
 * and then (not for whoever has asked for less movement), a tuft of grass each side, and the words.
 */
export const SheepLink = () => (
  <a className="sheep-link" href="/games/sheep/?buy">
    <span className="sheep-field">
      <Grass />
      <i>
        <Ewe />
      </i>
      <Grass />
    </span>
    <span className="sheep-text">If you liked any of this, consider buying me a sheep.</span>
  </a>
)
