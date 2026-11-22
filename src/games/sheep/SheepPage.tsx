import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Vector3, type PerspectiveCamera } from 'three'
import { Back, Hints, Sound } from '../hints.tsx'
import { keep, kept } from '../kept.ts'
import { Picture } from '../Picture.tsx'
import { View } from '../View.ts'
import { note } from '../../sound.ts'
import { FLOCK, RECLUSE } from './flock.ts'
import { HERMIT, Sheep, SPAN } from './Sheep.ts'

const _v = new Vector3()
const when = (date: string) => new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

/** The picture: the field, moved on and drawn every frame, seen through the same camera as the castle's. */
function Stage({ tier, onKnown, onSelect, each }: { tier: number; onKnown: (known: string) => void; onSelect: (sheep: number) => void; each: (world: Sheep, camera: PerspectiveCamera, width: number, height: number) => void }) {
  const world = useMemo(() => new Sheep(), [])
  const gl = useThree((state) => state.gl)
  const view = useRef<View>(null)
  useEffect(() => {
    const held = (view.current = new View(gl.domElement, world.ground.mesh, SPAN, onKnown))
    if (import.meta.env.DEV) Object.assign(window, { sheep: world, view: held }) // at hand in the console
    return () => held.dispose()
  }, [gl, world, onKnown])
  useEffect(() => () => world.dispose(), [world])
  useEffect(() => world.shadows(tier), [world, tier])
  useFrame(({ camera, size }, dt) => {
    world.update(Math.min(dt, 0.05))
    view.current?.update(Math.min(dt, 0.05), camera as PerspectiveCamera, size.width, size.height)
    each(world, camera as PerspectiveCamera, size.width, size.height)
  })
  const which = (event: ThreeEvent<MouseEvent | PointerEvent>) => (event.object === world.flock.mesh ? world.pick(event.instanceId) : -1)
  return (
    <>
      <primitive object={world.sky} attach="background" />
      <primitive
        object={world.group}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          if (event.delta > 6) return // the end of a drag, not a click
          event.stopPropagation()
          const sheep = which(event)
          if (sheep !== -1) note(4 + (Math.abs(sheep) % 5))
          world.glad(sheep) // a sheep that is clicked gives a hop
          onSelect(sheep)
        }}
        onPointerMove={(event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation()
          ;(event.nativeEvent.target as HTMLElement).style.cursor = which(event) !== -1 ? 'pointer' : ''
        }}
        onPointerOut={(event: ThreeEvent<PointerEvent>) => ((event.nativeEvent.target as HTMLElement).style.cursor = '')}
      />
    </>
  )
}

export default function SheepPage() {
  const [known, learn] = useReducer((had: string, more: string) => had + more, '', () => kept('sheep/known'))
  useEffect(() => keep('sheep/known', known), [known])
  const [chosen, choose] = useState(-1)
  const bubble = useRef<HTMLDivElement>(null)
  const saying = useRef<HTMLElement>(null)
  const pick = useRef(-1)
  useEffect(() => void (pick.current = chosen), [chosen])
  // The bubble stays over its sheep, and says what the sheep is doing now.
  const each = useCallback((world: Sheep, camera: PerspectiveCamera, width: number, height: number) => {
    const e = pick.current === HERMIT ? world.hermit : world.ewes[pick.current]
    if (!e || !bubble.current) return
    _v.set(e.x, e.y + e.s, e.z).project(camera) // just over its head, and up with it when it hops
    bubble.current.style.translate = `${width / 2 + _v.x * 0.5 * width}px ${height / 2 - _v.y * 0.5 * height}px`
    const now = world.doing(e)
    if (saying.current && saying.current.textContent !== now) saying.current.textContent = now
  }, [])
  const sheep = chosen === HERMIT ? RECLUSE : FLOCK[chosen]
  return (
    <main className="sheep">
      <Picture>{(tier) => <Stage tier={tier} onKnown={learn} onSelect={choose} each={each} />}</Picture>
      <Hints known={known} />
      {/* What a sheep's giver wrote, and what it is doing just now. It is over the sheep it is about. */}
      {sheep && (
        <div className="bubble" ref={bubble} key={sheep.id}>
          <strong>{sheep.name}</strong>
          <p>{sheep.message}</p>
          <small>
            {sheep.date && `${when(sheep.date)} · `}
            <em ref={saying} />
          </small>
        </div>
      )}
      <header className="top">
        <Back />
        <Sound />
      </header>
    </main>
  )
}
