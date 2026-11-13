import { Grid } from '../bricks/voxel.ts'
import type { ColorName } from '../bricks/voxel.ts'

/** Flowers in the grass: coarse x, z and colour. `detail` turns each into a little cluster. */
const FLOWERS = [[22, 11, 'white'], [24, 13, 'pink'], [21, 14, 'yellow'], [25, 9, 'white'], [6, 14, 'white'], [1, 16, 'pink'], [6, 24, 'yellow'], [2, 25, 'white'], [20, 26, 'pink']] as const

/** Drover, 2019-2020: a little car at a fork in the road, one branch signed A and the other B, plus a London phone box. */
export default function build(): Grid {
  const g = new Grid(28, 72, 28)

  // Ground: grass, with a road that runs back from the front edge and splits in two at z = 12.
  const branch = (z: number, side: number) => 14 + side * (12 - z) * 0.75
  g.each(0, 0, 0, 28, 1, 28, (x, _y, z) => {
    const c = x + 0.5
    const road = z >= 12 ? Math.abs(c - 14) < 5 : Math.abs(c - branch(z, -1)) <= 4 || Math.abs(c - branch(z, 1)) <= 4
    if (!road) return 'brightGreen'
    const dash =
      z >= 12
        ? (x === 13 || x === 14) && z <= 13
        : (z % 4 === 1 || z % 4 === 2) && z < 10 && (x === Math.floor(branch(z, -1)) || x === Math.floor(branch(z, 1)))
    return dash ? 'white' : 'darkGray'
  })

  // The two options: a big A and a big B on gantry signs over each branch.
  for (const x of [3, 9, 18, 24]) g.box(x, 1, 2, 1, 18, 1, 'lightGray')
  g.sprite(3, 19, 2, [
    '.PPPPP.',
    'PPWWWPP',
    'PWPPPWP',
    'PWPPPWP',
    'PWWWWWP',
    'PWPPPWP',
    'PWPPPWP',
    'PWPPPWP',
    'PPPPPPP',
  ], { P: 'purple', W: 'white' })
  g.sprite(18, 19, 2, [
    '.MMMMM.',
    'MWWWWMM',
    'MWMMMWM',
    'MWMMMWM',
    'MWWWWMM',
    'MWMMMWM',
    'MWMMMWM',
    'MWWWWMM',
    'MMMMMMM',
  ], { M: 'magenta', W: 'white' })

  // The car: a round little hatchback driving away from us toward the fork (nose at z = 15, tail at z = 26).
  for (const z of [16, 23])
    for (const x of [10, 17]) g.box(x, 2, z, 1, 7, 3, 'black').box(x, 1, z + 1, 1, 9, 1, 'black').box(x, 4, z + 1, 1, 3, 1, 'white')
  g.box(11, 4, 16, 6, 9, 10, 'azure')
  for (const z of [15, 26]) g.box(12, 5, z, 4, 6, 1, 'azure').box(12, 4, z, 4, 1, 1, 'white')
  g.box(12, 7, 15, 1, 3, 1, 'glowYellow').box(15, 7, 15, 1, 3, 1, 'glowYellow').box(13, 6, 15, 2, 1, 1, 'black')
  g.box(12, 7, 26, 1, 3, 1, 'glowRed').box(15, 7, 26, 1, 3, 1, 'glowRed').box(13, 6, 26, 2, 2, 1, 'yellow')
  g.box(11, 13, 19, 6, 6, 5, 'transLightBlue').clear(12, 13, 19, 4, 6, 5)
  for (const z of [18, 24]) g.box(12, 13, z, 4, 6, 1, 'transLightBlue').box(12, 19, z, 4, 1, 1, 'white')
  for (const x of [11, 16]) g.box(x, 13, 21, 1, 6, 1, 'azure')
  g.box(11, 19, 19, 6, 1, 5, 'white').box(12, 20, 19, 4, 1, 5, 'white')
  for (const x of [12, 15]) g.box(x, 12, 16, 1, 1, 2, 'white').set(x, 10, 15, 'white').set(x, 12, 25, 'white').set(x, 10, 26, 'white')

  // London: a red telephone box.
  g.box(3, 1, 18, 3, 24, 3, 'red').clear(4, 4, 19, 1, 18, 1)
  for (const [x, z] of [[4, 18], [4, 20], [3, 19], [5, 19]]) {
    g.box(x, 4, z, 1, 15, 1, 'transClear').box(x, 19, z, 1, 3, 1, 'white')
    g.set(x, 8, z, 'red').set(x, 13, z, 'red')
  }
  g.box(4, 9, 19, 1, 3, 1, 'black')
  g.set(4, 25, 19, 'red')

  // Trees. The canopy is a ball stepped per cube course (not per plate), so it stays chunky.
  const canopy = (cx: number, cy: number, cz: number, r: number) =>
    g.each(Math.floor(cx - r), cy - 9, Math.floor(cz - r), Math.ceil(r * 2) + 1, 18, Math.ceil(r * 2) + 1, (x, y, z) => {
      const dy = Math.floor((y - cy) / 3) + 0.5
      return (x + 0.5 - cx) ** 2 + dy ** 2 + (z + 0.5 - cz) ** 2 <= r * r ? 'green' : undefined
    })
  g.box(13, 1, 3, 2, 12, 2, 'brown')
  canopy(14, 19, 4, 3.2)
  g.box(22, 1, 20, 2, 9, 2, 'brown')
  canopy(23, 16, 21, 3.2)
  g.box(3, 1, 10, 1, 9, 1, 'brown')
  canopy(3.5, 13, 10.5, 2.4)

  // Flowers in the grass.
  for (const [x, z, c] of FLOWERS) g.set(x, 1, z, c)

  return g
}

/** The tiny things, drawn on the refined grid (voxels): a London park corner around the fork in the road. */
export function detail(g: Grid): void {
  // Each flower tile becomes a cluster of three blooms on stems.
  for (const [cx, cz, c] of FLOWERS) {
    const x = cx * 3
    const z = cz * 3
    g.clear(x, 1, z, 3, 1, 3)
    g.set(x, 1, z + 1, 'green').set(x, 2, z + 1, c).set(x + 1, 1, z + 2, 'green').set(x + 1, 2, z + 2, c)
    g.box(x + 2, 1, z, 1, 2, 1, 'green').set(x + 2, 3, z, c)
  }

  // --- London corner: a pillar box next to the phone box, a bench with a newspaper, a street lamp ---
  g.cyl(22, 1, 59, 2, 8, 'red').cyl(22, 1, 59, 2, 1, 'black').cyl(22, 9, 59, 1, 1, 'red')
  g.box(21, 6, 60, 2, 1, 1, 'black').box(21, 4, 60, 2, 1, 1, 'white')
  for (const x of [5, 15]) {
    g.box(x, 1, 67, 1, 6, 1, 'black').box(x, 1, 69, 1, 2, 1, 'black').box(x, 5, 68, 1, 1, 2, 'black')
  }
  g.box(5, 3, 67, 11, 1, 3, 'mediumNougat').box(6, 5, 67, 9, 2, 1, 'mediumNougat')
  g.box(8, 4, 68, 3, 1, 2, 'white').set(9, 4, 68, 'lightGray').set(8, 4, 69, 'lightGray').set(10, 4, 69, 'lightGray')
  g.box(23, 1, 70, 3, 1, 1, 'black').box(24, 1, 69, 1, 1, 3, 'black').box(24, 2, 70, 1, 14, 1, 'black')
  g.box(23, 16, 69, 3, 1, 3, 'black').box(23, 17, 69, 3, 2, 3, 'transYellow').box(24, 17, 70, 1, 2, 1, 'glowYellow')
  g.box(23, 19, 69, 3, 1, 3, 'black').set(24, 20, 70, 'black')

  // A corgi chasing a red ball.
  g.sprite(5, 1, 75, ['....O.O', '....OOO', 'OOOOOOW', '.OOOOW.', '.W..W..'], { O: 'orange', W: 'white' }, { depth: 2 })
  g.set(10, 4, 76, 'black').box(15, 1, 75, 2, 2, 2, 'red')

  // A white picket fence along the front, with an open gate.
  g.box(1, 2, 82, 16, 1, 1, 'white').box(22, 2, 82, 4, 1, 1, 'white')
  for (let x = 1; x <= 25; x += 2) if (x < 17 || x > 21) g.box(x, 1, 82, 1, 3, 1, 'white')
  for (const x of [17, 21]) g.box(x, 1, 82, 1, 4, 1, 'white').set(x, 5, 82, 'lightGray')
  g.box(21, 2, 79, 1, 1, 3, 'white').box(21, 1, 79, 1, 3, 1, 'white').box(21, 1, 81, 1, 3, 1, 'white')

  // Two traffic cones where the road forks.
  for (const x of [37, 44]) g.box(x, 1, 24, 3, 1, 3, 'orange').set(x + 1, 2, 25, 'orange').set(x + 1, 3, 25, 'white').set(x + 1, 4, 25, 'orange')

  // A picnic: a checked blanket, a basket, a bottle, cups, an apple and a sandwich.
  g.each(59, 1, 40, 11, 1, 9, (x, _y, z) => (((x >> 1) + (z >> 1)) % 2 ? 'red' : 'white'))
  g.box(60, 2, 41, 3, 2, 2, 'mediumNougat').box(60, 4, 41, 3, 1, 2, 'tan').set(61, 5, 41, 'brown').set(61, 5, 42, 'brown')
  g.box(64, 2, 45, 1, 2, 1, 'darkGreen').set(66, 2, 43, 'red').set(63, 2, 47, 'azure').set(66, 2, 47, 'azure')
  g.box(67, 2, 45, 2, 1, 1, 'tan').set(68, 3, 45, 'lime')

  // A robin on top of the A sign.
  const robin: [number, number, ColorName][] = [[18, 46, 'brown'], [19, 46, 'brown'], [20, 46, 'red'], [20, 47, 'brown'], [21, 47, 'orange']]
  for (const [x, y, c] of robin) g.set(x, y, 7, c)
}
