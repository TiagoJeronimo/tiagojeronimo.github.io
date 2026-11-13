import { audio } from '../sound.ts'

// A small tune that grows with the world: one more voice for every isle that has come up, and brighter
// the more of the land is awake. All of it is made here; there are no sound files. It keeps to the same
// five notes the waking ground plays (G A B D E), so the two never clash.
const FIVE = [0, 2, 4, 7, 9]
/** The n-th note of the scale, counted from G above middle C (or from `base`). */
const pitch = (n: number, base = 392) => base * 2 ** ((12 * Math.floor(n / 5) + FIVE[((n % 5) + 5) % 5]) / 12)
const ROOTS = [0, 4, 3, 0] // the note each of the four bars rests on: G, E, D, G

let world = { voices: 0, life: 0, night: false, frog: false }
let timer = 0
let due = 0 // when the next step is to sound, on the audio clock
let step = 0
let walk = 2 // where the melody is on the scale
let out: { ctx: AudioContext; filter: BiquadFilterNode; gain: GainNode; hiss: AudioBuffer } | undefined

/**
 * Tell the tune how the world is doing. It only sounds while the sound is switched on.
 * @param voices how many isles there are
 * @param life 0..1, how much of the land is awake
 * @param frog the frog sings along at night
 */
export function music(voices: number, life: number, night: boolean, frog: boolean) {
  world = { voices, life, night, frog }
  if (audio()) timer ||= window.setInterval(tick, 120) // no clock ticking away while the sound is off
}

export function hush() {
  clearInterval(timer)
  timer = 0
  due = 0
}

function tone(ctx: AudioContext, to: AudioNode, type: OscillatorType, freq: number, at: number, peak: number, attack: number, decay: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay)
  osc.connect(gain).connect(to)
  osc.start(at)
  osc.stop(at + attack + decay + 0.05)
}

/** Schedules the steps that fall due in the next third of a second. */
function tick() {
  const ctx = audio()
  if (!ctx) return void (due = 0) // the sound is off
  if (out?.ctx !== ctx) {
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    const hiss = ctx.createBuffer(1, 2048, ctx.sampleRate)
    hiss.getChannelData(0).forEach((_, i, data) => (data[i] = Math.random() * 2 - 1))
    filter.type = 'lowpass'
    gain.gain.value = 0.5
    filter.connect(gain).connect(ctx.destination)
    out = { ctx, filter, gain, hiss }
  }
  const { voices, life, night, frog } = world
  const beat = night ? 0.5 : 0.4 // nights go slower
  // The more of the land is awake, the brighter it sounds.
  out.filter.frequency.setTargetAtTime((night ? 700 : 1100) + life * (night ? 2200 : 5200), ctx.currentTime, 0.5)
  if (due < ctx.currentTime) due = ctx.currentTime + 0.1
  for (; due < ctx.currentTime + 0.35; due += beat, step++) {
    const at = due
    const to = out.filter
    const k = step % 8
    const bar = Math.floor(step / 8) % 4
    const root = ROOTS[bar]
    // The first voice: a melody that wanders up and down the scale.
    if (k === 0 || Math.random() < 0.3 + life * 0.35) {
      walk = Math.min(9, Math.max(0, walk + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]))
      tone(ctx, to, 'triangle', pitch(walk), at, 0.07, 0.01, 0.9)
      // With every isle there, a second voice answers it from higher up.
      if (voices >= 7 && Math.random() < 0.5) tone(ctx, to, 'sine', pitch(walk + 5), at + beat / 2, 0.03, 0.01, 0.7)
    }
    // A second isle brings a bass note at the start and the middle of each bar.
    if (voices >= 2 && k % 4 === 0) tone(ctx, to, 'sine', pitch(root - 10), at, 0.11, 0.02, 1.4)
    // A third, a soft held chord under each bar.
    if (voices >= 3 && k === 0) for (const up of [0, 2, 3]) tone(ctx, to, 'sine', pitch(root - 5 + up), at, 0.028, 0.9, beat * 8)
    // A fourth, bells: high up and far apart.
    if (voices >= 4 && Math.random() < 0.14) tone(ctx, to, 'triangle', pitch(5 + Math.floor(Math.random() * 6), 784), at, 0.035, 0.005, 1.8)
    // A fifth, an answer on the off beats.
    if (voices >= 5 && k % 2 === 1 && Math.random() < 0.35) tone(ctx, to, 'triangle', pitch(walk - 2), at, 0.045, 0.01, 0.5)
    // A sixth, something to keep time: a soft tick, past the filter so that it stays crisp.
    if (voices >= 6 && k % 2 === 0) {
      const source = ctx.createBufferSource()
      const high = ctx.createBiquadFilter()
      const gain = ctx.createGain()
      source.buffer = out.hiss
      high.type = 'highpass'
      high.frequency.value = 6000
      gain.gain.setValueAtTime(k === 0 ? 0.03 : 0.015, at)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.06)
      source.connect(high).connect(gain).connect(out.gain)
      source.start(at)
      source.stop(at + 0.08)
    }
    // And the frog, once it has its night-light, joins in after dark: two low croaks every other bar.
    if (frog && night && k === 6 && bar % 2) for (const late of [0, 0.17]) tone(ctx, to, 'square', pitch(root - 10), at + late, 0.03, 0.01, 0.1)
  }
}
