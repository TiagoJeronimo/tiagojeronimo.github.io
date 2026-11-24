import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { Object3D, PerspectiveCamera } from 'three'
import { View } from './View.ts'

/** What the page needs of a world (`Castle`, `Sheep`): it is moved on, it sets its shadows, it gives back what it holds. */
type World = { update(dt: number): void; shadows(tier: number): void; dispose(): void }

type Options = {
  /** The name `window` knows the world by in development (`window.castle`, and `window.view`). */
  name: string
  /** The cubes of the ground, which the camera keeps its eye on (see `View`). */
  land: Object3D
  /** How far the camera may go from the middle (see `View`). */
  span: number
  onKnown: (known: string) => void
  lift?: number
  yaw?: number
  /** Told of the camera once it is made. Keep it the same between renders, or the camera is made again. */
  onView?: (view: View) => void
}

/**
 * What every game's `Stage` does the same way: the camera (`View`), the world moved on every frame, its shadows to
 * match the step of the picture, and its end. Returns the camera, for what the game does with it each frame (`step`,
 * which is called after the world and the camera have moved).
 */
export function useStage<W extends World>(world: W, tier: number, { name, land, span, onKnown, lift, yaw, onView }: Options, step?: (view: View | null, camera: PerspectiveCamera, width: number, height: number) => void) {
  const gl = useThree((state) => state.gl)
  const view = useRef<View>(null)
  useEffect(() => {
    const held = (view.current = new View(gl.domElement, land, span, onKnown, lift))
    if (yaw !== undefined) held.yaw = yaw
    onView?.(held)
    if (import.meta.env.DEV) Object.assign(window, { [name]: world, view: held }) // at hand in the console
    return () => held.dispose()
  }, [gl, world, land, span, onKnown, lift, yaw, onView, name])
  useEffect(() => () => world.dispose(), [world])
  useEffect(() => world.shadows(tier), [world, tier])
  useFrame(({ camera, size }, dt) => {
    world.update(Math.min(dt, 0.05))
    const held = view.current
    held?.update(Math.min(dt, 0.05), camera as PerspectiveCamera, size.width, size.height)
    step?.(held, camera as PerspectiveCamera, size.width, size.height)
  })
  return view
}
