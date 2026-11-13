// A tiny music box: every block that lands plays one soft note. Silent until the visitor turns it on, on the CV and in
// the game alike (the game remembers, and then starts it at the first touch of a later visit).

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24] // major pentatonic, two octaves
let ctx: AudioContext | undefined
let last = 0
let on = false
let muted = false

/** Quiet for a moment, whatever the switch says: while a saved game is put back together. */
export const mute = (yes: boolean) => (muted = yes)

/**
 * The sound, on or off. A browser lets a page make none until somebody has clicked on it or pressed a key, so this is to
 * be called from one of those. Calling it again with what it already is does no harm, and wakes a sound that has dozed off.
 */
export function setSound(yes: boolean) {
  on = yes
  if (!on) return
  ctx ??= new AudioContext()
  if (ctx.state !== 'running') void ctx.resume()
}

export function toggleSound() {
  setSound(!on)
  if (on) note(0.5)
  return on
}

/** The audio context while the sound is on, for anything else that wants to make some. */
export const audio = () => (on ? ctx : undefined)

/** @param height 0..1 picks the pitch, so a model sings upwards as it grows. */
export function note(height: number, volume = 0.1) {
  if (!on || !ctx || muted) return
  const now = ctx.currentTime
  if (now - last < 0.04) return // at most 25 notes a second
  last = now
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.value = 392 * 2 ** (SCALE[Math.min(SCALE.length - 1, Math.floor(height * SCALE.length))] / 12)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
  osc.connect(gain).connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.45)
}

/** A soft low thump for the smash. */
export function thump() {
  if (!on || !ctx || muted) return
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.setValueAtTime(170, now)
  osc.frequency.exponentialRampToValueAtTime(45, now + 0.3)
  gain.gain.setValueAtTime(0.35, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35)
  osc.connect(gain).connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.4)
}
