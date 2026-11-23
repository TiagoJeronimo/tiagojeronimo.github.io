// What every game has in its corners: the way back to the front page, the sound's button, and the three ways of
// getting about, said until each has been used: with fingers on a screen that is touched; otherwise with a mouse, and
// then the keys that do the same come after, in brackets. `hints.css` styles them, and the bar across the top that the
// way back sits in.
import { useEffect, useState } from 'react'
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
 */
export const Hints = ({ known }: { known: string }) => (
  <ul className="hints" aria-label="How to get about">
    {HINTS.map(([way, keys, how]) => (
      <li key={way} data-done={known.includes(way)}>
        {how}
        {keys && <kbd>[or {keys}]</kbd>}
      </li>
    ))}
  </ul>
)

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
