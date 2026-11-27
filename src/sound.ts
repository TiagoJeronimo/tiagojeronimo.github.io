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
  // On an iPhone or iPad, web audio counts as a ringtone unless told otherwise, and the silent switch mutes it: the
  // sound button would light up and nothing be heard. As playback it plays, as a video would.
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
  if (session) session.type = 'playback'
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

// More than the one note: small noises for things that happen (the sheep's field uses them), and a quiet music box.
// All of it is under the one switch, made here and nowhere kept; all of it goes out through one low gain and a
// compressor, so that many small noises at once are never a loud one; and what is said to happen is said to the
// audio clock, which keeps the time: nothing here runs in a frame.

/**
 * A limit on how often something may happen: `burst` at once, and `rate` a second after that. The returned function
 * says, for a time in seconds, whether one more may happen then (and counts it if so).
 */
export function bucket(rate: number, burst: number) {
  let [have, then] = [burst, -Infinity]
  return (now: number) => {
    have = Math.min(burst, have + Math.max(0, now - then) * rate)
    then = now
    if (have < 1) return false
    have -= 1
    return true
  }
}

/**
 * One time round the music box: sixteen beats, each a place in `SCALE` or -1 for a rest. The tune is the same shape
 * every time round (a slow rise and a fall back to where it began), and a few of its notes are others each time, by
 * the number of the round: so it is known when it comes again, and is not the same.
 */
export function phrase(round: number) {
  const shape = [0, -1, 2, 4, -1, 3, 2, -1, 4, 5, -1, 7, 5, -1, 2, 0]
  const pick = (k: number) => {
    const h = Math.sin((round * 16 + k) * 127.1 + 311.7) * 43758.5453
    return h - Math.floor(h)
  }
  return shape.map((step, k) => (step < 0 ? (pick(k) < 0.15 ? 2 + Math.floor(pick(k + 40) * 4) : -1) : pick(k) < 0.3 ? Math.max(0, Math.min(SCALE.length - 1, step + (pick(k + 80) < 0.5 ? -1 : 1))) : step))
}

let out: GainNode | undefined
const few = bucket(3, 4) // the small noises: four at once, and three a second after that
/** Where every sound here goes: a low gain, then a compressor, then out. Made once. */
function bus(c: AudioContext) {
  if (out) return out
  out = c.createGain()
  out.gain.value = 0.6
  out.connect(c.createDynamicsCompressor()).connect(c.destination)
  return out
}
/** One voice: a wave that comes up fast and dies away, from `from` hertz to `to`, at a time on the audio clock. */
function voice(c: AudioContext, kind: OscillatorType, from: number, to: number, at: number, long: number, loud: number, through?: AudioNode) {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = kind
  osc.frequency.setValueAtTime(from, at)
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + long)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(loud, at + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + long)
  osc.connect(gain).connect(through ?? bus(c))
  osc.start(at)
  osc.stop(at + long + 0.05)
  return osc
}
const pitch = (step: number, base = 392) => base * 2 ** (SCALE[Math.max(0, Math.min(SCALE.length - 1, step))] / 12)

/**
 * A small noise for something that has happened: `baa` (a sheep, clicked; `tone` 0..1 is how high its voice is),
 * `pop` (something planted), `tinkle` (a bell), `bark`, `jingle` (somebody has arrived). Nothing if the
 * sound is off, and nothing if there have been a few already this second: a field of sheep is not a din.
 */
export function sfx(what: 'baa' | 'pop' | 'tinkle' | 'bark' | 'jingle', tone = 0.5) {
  if (!on || !ctx || muted || !few(ctx.currentTime)) return
  const [c, now] = [ctx, ctx.currentTime]
  if (what === 'baa') {
    // A reedy voice with a wobble in it, through a filter that makes a mouth of it.
    const mouth = c.createBiquadFilter()
    mouth.type = 'bandpass'
    mouth.frequency.value = 900
    mouth.Q.value = 1.5
    mouth.connect(bus(c))
    const osc = voice(c, 'sawtooth', 300 + tone * 130, 270 + tone * 110, now, 0.42, 0.09, mouth)
    const wobble = c.createOscillator()
    const depth = c.createGain()
    wobble.frequency.value = 9
    depth.gain.value = 16
    wobble.connect(depth).connect(osc.frequency)
    wobble.start(now)
    wobble.stop(now + 0.5)
  } else if (what === 'pop') voice(c, 'sine', 420, 880, now, 0.09, 0.09)
  else if (what === 'tinkle') {
    voice(c, 'sine', 1568, 1568, now, 0.35, 0.03)
    voice(c, 'sine', 2349, 2349, now + 0.05, 0.3, 0.02)
  } else if (what === 'bark') {
    const soft = c.createBiquadFilter()
    soft.type = 'lowpass'
    soft.frequency.value = 1100
    soft.connect(bus(c))
    voice(c, 'square', 400 + tone * 80, 240, now, 0.09, 0.05, soft)
  } else if (what === 'jingle') for (let k = 0; k < 4; k++) voice(c, 'triangle', pitch(4 + k * 2), pitch(4 + k * 2), now + k * 0.09, 0.4, 0.06)
}

const rolls = bucket(0.25, 1) // thunder: one clap, and the next no sooner than four seconds on
/**
 * Thunder, as a toy has it: "brrum". Three soft low notes, each a little lower and softer than the one before, with
 * the same an octave up under them so that a small loudspeaker has something to say. Notes, not noise: a real rumble
 * was the one sound here that was not a music box. Under the same switch and through the same output as the small
 * noises.
 * @param loud 0..1
 */
export function thunder(loud = 1) {
  if (!on || !ctx || muted || !rolls(ctx.currentTime)) return
  const [c, now] = [ctx, ctx.currentTime]
  const g = Math.max(0.05, Math.min(1, loud))
  ;[[0, 98, 0.5, 0.3], [0.17, 82, 0.5, 0.22], [0.36, 65, 0.8, 0.18]].forEach(([at, hertz, long, gain]) => {
    voice(c, 'triangle', hertz * 1.12, hertz, now + at, long, gain * g)
    voice(c, 'sine', hertz * 2.24, hertz * 2, now + at, long * 0.7, gain * 0.35 * g)
  })
}

const BEAT = 0.62 // seconds: slow
let box = 0 // the timer of the music box, while a page has asked for it
let [due, beat, round, tune] = [0, 0, 0, [] as number[]]
/**
 * The music box, for a page that wants one: a slow tune in the same five notes as everything else, a low note under
 * it every fourth beat and a high one now and then, all very soft. It plays only while the sound is on and the page
 * is looked at; switched off or hidden it stops, and picks up at the next beat when it may. A few times a second it
 * says to the audio clock what is to sound in the next half second, and that is all the work there is.
 */
export function music(yes: boolean) {
  clearInterval(box)
  box = 0
  if (!yes) return
  due = 0
  box = setInterval(() => {
    if (!on || !ctx || muted || document.hidden || ctx.state !== 'running') return void (due = 0)
    const [c, now] = [ctx, ctx.currentTime]
    if (due < now) due = now + 0.1 // (it was off, or away: on from here, not all at once what was missed)
    for (; due < now + 0.5; due += BEAT, beat = (beat + 1) % 16) {
      if (!beat) tune = phrase(round++)
      const step = tune[beat]
      if (step >= 0) voice(c, 'triangle', pitch(step), pitch(step), due, 1.5, 0.035)
      if (beat % 4 === 0) voice(c, 'sine', pitch(beat % 8 ? 2 : 0, 98), pitch(beat % 8 ? 2 : 0, 98), due, 2.2, 0.05)
      if (beat === 10 && round % 2) voice(c, 'sine', pitch(tune[9] >= 0 ? tune[9] : 5, 784), pitch(tune[9] >= 0 ? tune[9] : 5, 784), due + BEAT / 2, 0.9, 0.012)
    }
  }, 200) as unknown as number
}
