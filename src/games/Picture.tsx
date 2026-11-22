// The picture of a game: the canvas, the finish every game here gets (soft shading in the corners, a little glow, gentle
// colours), and the pump that draws the frames and keeps count of them, so that a machine that cannot keep up gets a
// lighter picture, a step at a time. A game's page puts its scene inside, and is told the step the picture is at:
//
//   <Picture>{(tier) => <Stage tier={tier} />}</Picture>
//
// and the scene, which makes its world and moves it on in a `useFrame`, has that world draw its shadows to match:
//
//   useEffect(() => world.shadows(tier), [world, tier])   // `shade` in `basics.ts` does it for a light
//
// The steps. 0 is all of it. 1 saves where it barely shows: the soft shading in the corners and the shadows at half
// size, the edges of things smoothed half as much. 2 also draws no more pixels than the page has (softer, on a fine
// screen). 3 leaves the edges unsmoothed. 4 has no soft shading at all, shadows at a quarter, and three pixels for every
// four of the page. It only ever leaves 0 on a machine that cannot keep up. (What costs is all in the finish: measured
// on the island, the game itself and every loose bit in the air come to nothing next to it. On the graphics card of a
// 2021 MacBook Pro, in a window of 1920 by 1080, a frame takes about 23 ms at 0, then 14, 10, 8 and 4 or 5.)
import { Canvas, useFrame, useThree, type CanvasProps } from '@react-three/fiber'
import { Bloom, EffectComposer, N8AO, TiltShift, ToneMapping } from '@react-three/postprocessing'
import { BlendFunction, KernelSize, ToneMappingMode, type TiltShiftEffect } from 'postprocessing'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { LIGHTEST } from './basics.ts'
import { viewing } from './View.ts'

let reached = 0 // the step this page has come to: a new picture on it (a new game) starts from there, not from the top

/**
 * The finish, and the pump. Inside the canvas, after the game's own scene.
 * @param near how close the camera is, from 0 to 1, for a game with a camera of its own (the island): from close up
 * the top and bottom of the picture go soft. A game that uses `View.ts` need not give it: its view is asked.
 */
function Finish({ tier, onTier, near }: { tier: number; onTier: (tier: number) => void; near?: () => number }) {
  const gl = useThree((state) => state.gl)
  const advance = useThree((state) => state.advance)
  const [soft, setSoft] = useState(false) // close enough for the top and bottom of the picture to go soft
  const tilt = useRef<TiltShiftEffect>(null)
  const composer = useRef<unknown>(null)
  const shade = useRef<{ depthDownsampleTarget?: object } | null>(null)
  // The shading at half size (tier 1 and up) needs a hand. The library's half-size buffer answers `texture` with the
  // whole list of its textures, where this version of three.js wants the first of them, and drawing into it throws.
  // (n8ao 2.0.1 with three 0.187. Harmless once that is mended: it then says what the library says.)
  useLayoutEffect(() => {
    const half = shade.current?.depthDownsampleTarget
    if (half)
      Object.defineProperty(half, 'texture', {
        configurable: true,
        get(this: { textures: unknown[] }) {
          return this.textures[0]
        },
      })
  })
  const level = useRef(tier)
  useEffect(() => {
    level.current = tier
  }, [tier])
  useEffect(() => {
    // In the dev server: draw a frame by hand, for when the browser is not drawing any (a tab nobody is looking at),
    // and set the step by hand: `paint()`, `tier(0)` to `tier(4)`.
    if (import.meta.env.DEV) Object.assign(window, { paint: () => advance(performance.now() / 1000), tier: onTier, composer })
  }, [advance, onTier])
  // The frames are drawn from here. The browser offers one every time the screen redraws; on a screen that redraws more
  // than a hundred times a second every other one is taken, which is plenty for this and half the work.
  // It also keeps count. A machine that cannot do forty-two frames a second gets a lighter picture, a step at a time:
  // if the picture is what holds it back, which it finds out by drawing one frame and waiting for it.
  useEffect(() => {
    let frame = 0
    let last = 0
    let wait = 4000 // nothing is counted while the page is still finding its feet, nor right after a step
    let span = 0
    let count = 0
    let slow = 0
    let stalls = 0 // long gaps in a row
    let over = false
    const costs: number[] = [] // how long a frame took to draw at each step, as it was left, in milliseconds
    const context = gl.getContext()
    const pixel = new Uint8Array(4)
    // Reading a pixel back makes the graphics card finish what it has been given: the only way to know how long it took.
    const finish = () => context.readPixels(0, 0, 1, 1, context.RGBA, context.UNSIGNED_BYTE, pixel)
    /** How long a frame takes to draw as things are: one is drawn, and waited for. */
    const cost = (now: number) => {
      finish()
      const from = performance.now()
      advance(now / 1000)
      finish()
      return performance.now() - from
    }
    const step = (next: number) => {
      level.current = next
      onTier(next)
      wait = 1500
      slow = 0
    }
    const pump = (now: number) => {
      frame = requestAnimationFrame(pump)
      const gap = now - last
      if (gap < 9.5) return
      last = now
      advance(now / 1000)
      if (over) return
      // A long gap is a stall, or a page nobody is looking at: not a picture that is too heavy. Three in a row are
      // that picture, on a machine that cannot draw it four times a second: those count, or it would never get a lighter one.
      stalls = gap > 250 ? stalls + 1 : 0
      if (document.hidden || (stalls && stalls < 3)) return void (span = count = 0)
      if ((wait -= gap) > 0) return
      span += gap
      if (++count && span < 2000) return
      const rate = (count * 1000) / span
      span = count = 0
      if (level.current === LIGHTEST) {
        // As light as it gets. If even that made no real difference to what a frame costs, the picture was never the
        // trouble: everything goes back on, and stays on. (What a frame costs, and not how many there were just now:
        // the first few after a step are slow whatever the step, while the graphics card is told the new way of drawing.)
        over = true
        if (cost(now) > costs[0] / 1.2) step(0)
      } else if (rate >= 42) slow = 0
      else if (++slow > 1) {
        // Slow, twice running. One frame is drawn and waited for, to see whether the picture is why.
        const spent = (costs[level.current] = cost(now))
        const room = 1000 / rate // the time a frame is given, as things are
        if (spent < room * 0.45) {
          // It is not: there was time to draw it twice over. Something else sets the pace (a screen held to thirty
          // frames to save its battery, say). So the finest picture that fits that pace is the one to have, for good.
          over = true
          const fits = costs.findIndex((ms) => ms < room * 0.85)
          if (fits !== level.current) step(fits)
        } else step(Math.min(LIGHTEST, level.current + (rate < 20 ? 2 : 1))) // nowhere near: two steps at once
      }
    }
    frame = requestAnimationFrame(pump)
    return () => cancelAnimationFrame(frame)
  }, [advance, onTier, gl])
  useFrame(() => {
    // Up close, the top and the bottom of the picture go soft, as in a photograph of something small. Not on a machine
    // that is already short of breath.
    // (How close: what the game says, if it says; else what its `View` says, which every game that has one gets for nothing.)
    const close = tier ? 0 : near ? near() : (viewing()?.near ?? 0)
    if (close > 0.02 !== soft) setSoft(close > 0.02)
    if (tilt.current) tilt.current.focusArea = 1.4 - 0.65 * close
  })
  return (
    <EffectComposer multisampling={!tier ? 4 : tier < 3 ? 2 : 0} ref={composer as never}>
      {tier < LIGHTEST && <N8AO ref={shade as never} aoRadius={1.2} distanceFalloff={1} intensity={3} color="#5b3a66" halfRes={tier > 0} />}
      {soft && <TiltShift ref={tilt} blendFunction={BlendFunction.NORMAL} kernelSize={KernelSize.SMALL} focusArea={1.4} feather={0.35} />}
      <Bloom mipmapBlur luminanceThreshold={1} intensity={0.4} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  )
}

/**
 * @param children the game's scene, given the step the picture is at
 * @param near see `Finish`
 * Whatever else a canvas takes goes through to it.
 */
export function Picture({ children, near, ...canvas }: Omit<CanvasProps, 'children'> & { children: (tier: number) => ReactNode; near?: () => number }) {
  const [tier, setTier] = useState(reached)
  useEffect(() => {
    reached = tier
  }, [tier])
  return (
    // (`frameloop="never"`: the pump draws the frames. Left to itself the canvas would draw them as well.)
    <Canvas shadows="percentage" frameloop="never" dpr={tier < 2 ? [1, 1.5] : tier < LIGHTEST ? 1 : 0.75} gl={{ antialias: false, powerPreference: 'high-performance' }} camera={{ fov: 30, near: 1, far: 400 }} {...canvas}>
      {children(tier)}
      <Finish tier={tier} onTier={setTier} near={near} />
    </Canvas>
  )
}
