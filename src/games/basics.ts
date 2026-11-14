// What every game here is made of, before it is anything of its own: the colours, the neighbours of a tile, chance, and
// how fine its shadows are. (The cubes themselves are in `cubes.ts`.)
import type { DirectionalLight } from 'three'

/** The four tiles next to one, as steps across and along; and the eight round it. */
export const NEAR = [[1, 0], [-1, 0], [0, 1], [0, -1]]
export const RING = [...NEAR, [1, 1], [-1, 1], [1, -1], [-1, -1]]
/** A floor no loose cube ever reaches: for a bit that is to fall until its time is up (see `Bits.spawn`). */
export const NEVER = -99

// The palette. Where there are three of a colour, a thing takes them by turns, so that no two cubes side by side match.
export const LEAF = [0x9bd873, 0x8fd16b, 0xbfe36a]
export const FRUIT = [0xa9de7c, 0x97d470, 0xc4e77e]
export const BLOSSOM = [0xffc2d9, 0xf78bb5, 0xffd9e6]
export const STONE = [0xb7b2ba, 0xa39eab, 0xc6c2c8]
export const WOOD = 0x9a7b62
export const BARK = 0x8a6d58
export const WATER = 0xbfe6ff
export const LAVA = 0xff7a2f

/** A repeatable random number in 0..1 from an integer, so that a world looks the same on every visit. */
export const rnd = (n: number) => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
/** And one that is not: anywhere from -0.5 to 0.5, for what may differ every time. */
export const any = () => Math.random() - 0.5

/** The last step down in how finely a picture is drawn: see `Picture.tsx`. */
export const LIGHTEST = 4
/**
 * A sun's shadows at the size that goes with a step of the picture: all of it at 0 (less on a phone), half of that
 * from 1, a quarter at the lightest. They are blurred over as many fewer of their own squares, so they stay as soft as
 * they were. A world calls it once when its light is made, with 0, and again whenever the step changes.
 */
export function shade(sun: DirectionalLight, tier: number) {
  const part = !tier ? 1 : tier < LIGHTEST ? 0.5 : 0.25
  sun.shadow.mapSize.setScalar((globalThis.matchMedia?.('(pointer: coarse)').matches === false ? 4096 : 2048) * part)
  sun.shadow.radius = 5 * part
  sun.shadow.map?.dispose()
  sun.shadow.map = null
}
