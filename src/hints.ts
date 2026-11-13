// The three ways of getting about, which both games say in a corner until each has been used: with fingers on a
// screen that is touched; otherwise with a mouse, and then the keys that do the same come after, in brackets.
import './hints.css'

export const FINGERS = matchMedia('(pointer: coarse)').matches // a screen that is touched: no mouse, and no keys to speak of
export const HINTS = FINGERS
  ? [['m', '', 'Drag to move'], ['z', '', 'Pinch to zoom'], ['t', '', 'Twist to turn']]
  : [['m', 'W A S D', 'Drag to move'], ['z', '+ −', 'Scroll to zoom'], ['t', 'Q E', 'Right-drag to turn']]
