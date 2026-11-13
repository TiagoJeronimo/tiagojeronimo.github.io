import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, DepthOfField, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode, type DepthOfFieldEffect } from 'postprocessing'
import type { PerspectiveCamera } from 'three'
import { FOV, World } from './World.ts'

// Quality tiers: 0 = everything, 1 = no depth of field or multisampling, 2 = also the coarse models.
function Stage({ tier, onSlow }: { tier: number; onSlow: () => void }) {
  const lite = tier > 0
  const fine = tier < 2 ? 3 : 1
  const scene = useThree((state) => state.scene)
  const gl = useThree((state) => state.gl)
  const world = useRef<World>(null)
  const dof = useRef<DepthOfFieldEffect>(null)
  const frames = useRef({ count: 0, time: 0 })

  useEffect(() => {
    const created = (world.current = new World(scene, gl, fine))
    return () => {
      created.dispose()
      world.current = null
    }
  }, [scene, gl, fine])

  useFrame(({ camera, size }, dt) => {
    const current = world.current
    if (!current) return
    current.update(Math.min(dt, 0.05), camera as PerspectiveCamera, size.width, size.height)
    if (dof.current) {
      dof.current.target = current.focus
      dof.current.cocMaterial.focusRange = current.focusRange
    }
    // Step down a tier whenever the machine cannot hold ~38 fps (measured over 150 frames after a 3 s warm-up).
    const f = frames.current
    f.time += dt
    if (tier < 2 && f.time > 3 && ++f.count === 150) {
      if ((f.time - 3) / 150 > 1 / 38) onSlow()
      f.count = 0
      f.time = 3
    }
  })

  return (
    <EffectComposer multisampling={lite ? 0 : 4}>
      <N8AO aoRadius={1.5} distanceFalloff={1} intensity={3.2} color="#5b3a66" quality={lite ? 'low' : 'medium'} />
      {lite ? <SMAA /> : <DepthOfField ref={dof} focusRange={46} bokehScale={2.4} />}
      <Bloom mipmapBlur luminanceThreshold={1} intensity={0.45} />
      <Vignette offset={0.2} darkness={0.32} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  )
}

export default function Scene() {
  // Phones and tablets start one tier down; anything that turns out slow steps down after a few seconds.
  // `?tier=0|1|2` in the URL forces a starting tier, to see what slower devices get.
  const [tier, setTier] = useState(() => {
    const forced = new URLSearchParams(location.search).get('tier')
    return forced ? Number(forced) : matchMedia('(pointer: coarse)').matches ? 1 : 0
  })
  return (
    <Canvas
      flat
      shadows="percentage"
      dpr={[1, 1.5]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      camera={{ fov: FOV, near: 1, far: 6000 }}
      style={{ position: 'fixed', inset: 0 }}
      aria-hidden
    >
      <Stage tier={tier} onSlow={() => setTier((t) => t + 1)} />
    </Canvas>
  )
}
