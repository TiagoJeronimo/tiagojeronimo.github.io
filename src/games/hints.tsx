// What every game has in its corners: the way back to the front page, and the three ways of getting about, said until
// each has been used: with fingers on a screen that is touched; otherwise with a mouse, and then the keys that do the
// same come after, in brackets. `hints.css` styles them, and the bar across the top that the way back sits in.
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
