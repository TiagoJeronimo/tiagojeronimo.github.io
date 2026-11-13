import { Grid } from '../bricks/voxel.ts'

/** y of cube row n: a cube is 3 plates tall, rows start on top of the 1-plate ground. */
const Y = (row: number) => 1 + row * 3

/** INESC-ID, 2017-2018: a tablet driving an AR hologram of a bone with an implant, and a first-aid case. */
export default function build(): Grid {
  const g = new Grid(28, 48, 24)

  // Lab floor: soft checker, rounded corners, a glowing scan ring under the hologram.
  g.each(0, 0, 0, 28, 1, 24, (x, _y, z) => {
    const d = Math.hypot(x + 0.5 - 19, z + 0.5 - 13)
    if (d > 5.7 && d < 6.7) return 'glowCyan'
    return ((x >> 2) + (z >> 2)) % 2 ? 'white' : 'lavender'
  })
  for (const x of [0, 27])
    for (const z of [0, 23]) g.set(x, 0, z, null).set(x ? 26 : 1, 0, z, null).set(x, 0, z ? 22 : 1, null)

  // Tablet on its stand, facing the front.
  g.box(2, Y(0), 3, 8, 3, 6, 'lightGray')
  g.box(4, Y(1), 4, 4, 12, 2, 'lightGray')
  g.box(1, Y(1), 6, 10, 24, 1, 'lightGray')
  g.box(1, Y(1), 7, 10, 24, 1, 'black')
  for (const x of [1, 10]) for (const row of [1, 8]) g.clear(x, Y(row), 6, 1, 3, 2)
  g.sprite(2, Y(2), 7, [
    'AAAAAAAA',
    'AWAAAAWA',
    'AWWWPWWA',
    'AWAAAAWA',
    'AAAAAAAA',
    'YYAAAAGG',
  ], { A: 'azure', W: 'white', P: 'glowPink', Y: 'glowYellow', G: 'glowGreen' })

  // Projector puck and beam.
  g.cyl(19, Y(0), 13, 4, 3, 'white')
  g.cyl(19, 4, 13, 3, 1, 'sandBlue')
  g.cyl(19, 5, 13, 2, 1, 'glowCyan')
  g.box(17, Y(0), 16, 1, 3, 1, 'glowYellow').box(20, Y(0), 16, 1, 3, 1, 'glowPink')
  const R = 5 // cube row of the bottom of the bone's shaft
  g.box(18, 6, 12, 2, Y(R) - 6, 2, 'transLightBlue')

  // The hologram: a chunky bone spanning x = 12..25, symmetric about the beam.
  const B = 'transBlue'
  g.box(15, Y(R), 12, 8, 6, 2, B)
  for (const flip of [false, true]) {
    const at = (x: number, w: number) => (flip ? 38 - x - w : x)
    g.box(at(13, 3), Y(R), 12, 3, 6, 2, B)
    for (const row of [R - 1, R + 2]) {
      g.box(at(12, 4), Y(row), 12, 4, 3, 2, B)
      g.box(at(13, 2), Y(row), 11, 2, 3, 4, B)
    }
    g.box(at(13, 2), Y(R - 2), 12, 2, 3, 2, B)
    g.box(at(13, 2), Y(R + 3), 12, 2, 3, 2, B)
  }

  // The implant: a threaded screw going into the shaft from above.
  for (let y = Y(R + 1); y < Y(R + 4); y++) g.box(18, y, 12, 2, 1, 2, y % 2 ? 'lightGray' : 'darkGray')
  g.box(17, Y(R + 4), 11, 4, 3, 4, 'lightGray')
  g.box(17, Y(R + 4) + 2, 12, 4, 1, 2, 'darkGray')

  // AR tracking frame: four glowing corner brackets on clear posts.
  for (const [post, arm] of [[10, 11], [27, 25]]) {
    g.box(post, Y(0), 13, 1, Y(R + 5) - Y(0), 1, 'transClear')
    for (const [corner, upright] of [[R - 3, R - 3], [R + 4, R + 3]]) {
      g.box(post, Y(upright), 13, 1, 6, 1, 'glowCyan')
      g.box(arm, Y(corner), 13, 2, 3, 1, 'glowCyan')
    }
  }

  // Pedestal with a first-aid case.
  g.box(1, Y(0), 17, 7, 6, 4, 'lightBlue')
  g.box(2, Y(2), 17, 5, 9, 3, 'red')
  g.sprite(2, Y(2), 19, ['RRWRR', 'RWWWR', 'RRWRR'], { R: 'red', W: 'white' })
  g.box(3, Y(5), 18, 3, 1, 1, 'white')

  return g
}

/** The lab corner around it, drawn in voxels: x and z are 3x the ones above, y = 1 is the first layer on the floor. */
export function detail(g: Grid): void {
  // --- Reading corner, left: a rug, a side table with a notebook, a mug and a rubber duck, and a stool.
  g.each(1, 1, 28, 27, 1, 17, (x, _y, z) => {
    const e = ((x + 0.5 - 14) / 13) ** 2 + ((z + 0.5 - 36) / 8) ** 2
    return e > 1 ? undefined : e > 0.8 ? 'darkPink' : e > 0.52 && e < 0.64 ? 'white' : 'pink'
  })
  for (const x of [3, 17]) for (const z of [30, 40]) g.box(x, 1, z, 2, 6, 2, 'mediumNougat')
  g.box(3, 7, 30, 16, 2, 12, 'tan')
  g.sprite(5, 9, 33, [
    'BBBBBBBBBBB',
    'BWWWWSWWWWB',
    'BWttWSWrrWB',
    'BWWWWSWrWWB',
    'BWtttSWrrWB',
    'BWttWSWWWWB',
    'BWWWWSWWWWB',
    'BBBBBBBBBBB',
  ], { B: 'darkBlue', W: 'white', S: 'lightGray', t: 'sandBlue', r: 'coral' }, { plane: 'xz' })
  g.box(11, 10, 38, 3, 1, 1, 'yellow').set(10, 10, 38, 'black').set(14, 10, 38, 'darkPink')
  g.box(15, 9, 30, 3, 3, 3, 'coral').set(16, 11, 31, 'brown').set(18, 10, 31, 'coral')
  g.box(16, 12, 31, 1, 2, 1, 'transClear').box(15, 13, 31, 1, 2, 1, 'transClear')
  g.box(5, 9, 30, 3, 2, 3, 'yellow').box(5, 11, 31, 3, 2, 2, 'yellow').set(6, 11, 30, 'yellow')
  g.set(6, 11, 33, 'orange').set(5, 12, 32, 'black').set(7, 12, 32, 'black')
  g.cyl(23.5, 1, 35.5, 2, 1, 'darkGray').box(23, 2, 35, 1, 4, 1, 'darkGray').cyl(23.5, 6, 35.5, 2.5, 2, 'coral')

  // --- Lab bench along the back: a lamp, a microscope, test tubes, a flask and the AR goggles.
  g.box(42, 1, 4, 26, 8, 9, 'tan').box(41, 9, 3, 28, 2, 11, 'white')
  g.box(50, 1, 12, 1, 8, 1, 'darkTan').box(59, 1, 12, 1, 8, 1, 'darkTan')
  g.box(42, 5, 12, 8, 1, 1, 'darkTan').box(60, 5, 12, 8, 1, 1, 'darkTan')
  for (const [x, y] of [[45, 7], [45, 3], [54, 6], [63, 7], [63, 3]]) g.box(x, y, 13, 2, 1, 1, 'white')
  // Desk lamp.
  g.box(42, 11, 4, 3, 1, 3, 'darkBlue').box(43, 12, 5, 1, 7, 1, 'darkGray').box(44, 18, 5, 2, 1, 1, 'darkGray')
  g.box(45, 17, 4, 3, 1, 3, 'coral').set(46, 18, 5, 'coral').set(46, 16, 5, 'glowYellow')
  // Microscope, seen in profile from the left.
  g.box(49, 11, 7, 4, 1, 6, 'black').box(50, 12, 7, 2, 2, 2, 'white').box(50, 14, 7, 2, 3, 1, 'white')
  g.box(49, 13, 9, 4, 1, 3, 'lightGray').box(50, 14, 10, 2, 1, 1, 'transLightBlue').box(50, 15, 10, 2, 2, 1, 'darkGray')
  g.box(50, 17, 7, 2, 2, 4, 'white').box(50, 19, 7, 2, 1, 2, 'black').box(50, 20, 7, 2, 1, 1, 'black')
  g.set(49, 13, 7, 'darkGray').set(52, 13, 7, 'darkGray')
  // Rack of test tubes.
  g.box(55, 11, 5, 9, 1, 3, 'nougat').box(55, 14, 5, 9, 1, 1, 'nougat').box(55, 14, 7, 9, 1, 1, 'nougat')
  for (const x of [55, 63]) g.box(x, 12, 5, 1, 2, 3, 'nougat')
  ;(['darkPink', 'lime', 'yellow', 'azure'] as const).forEach((liquid, i) => {
    g.box(56 + 2 * i, 12, 6, 1, 2 + (i % 2), 1, liquid).box(56 + 2 * i, 14 + (i % 2), 6, 1, 4 - (i % 2), 1, 'transClear')
  })
  // Flask with something green in it.
  g.cyl(57.5, 11, 10.5, 2, 2, 'transGreen').cyl(57.5, 13, 10.5, 1.5, 1, 'transGreen').cyl(57.5, 14, 10.5, 1, 1, 'transClear')
  g.box(57, 15, 10, 1, 2, 1, 'transClear')
  // AR goggles.
  g.box(61, 11, 11, 7, 3, 2, 'black').box(62, 12, 12, 5, 1, 1, 'glowCyan')
  g.box(61, 12, 8, 1, 1, 3, 'darkGray').box(67, 12, 8, 1, 1, 3, 'darkGray').box(62, 12, 8, 5, 1, 1, 'darkGray')

  // --- Front: a plant, the lab cat watching the hologram, a paper bin and somebody's backpack.
  g.cyl(74.5, 1, 63.5, 2.5, 4, 'darkOrange').cyl(74.5, 4, 63.5, 1.5, 1, 'brown').box(74, 5, 63, 1, 4, 1, 'brown')
  g.ball(74.5, 11, 63.5, 3.4, 'green').ball(72.5, 12.5, 62.5, 2.2, 'brightGreen').ball(76.5, 13, 64.5, 2.2, 'darkGreen')
  g.ball(74.5, 15, 63.5, 2, 'brightGreen')
  g.box(74, 1, 54, 4, 3, 3, 'orange').box(73, 1, 54, 1, 3, 3, 'white').box(72, 4, 54, 3, 3, 3, 'orange')
  g.set(73, 2, 54, 'orange').set(73, 2, 56, 'orange').set(73, 3, 54, 'orange').set(73, 3, 56, 'orange')
  g.set(73, 7, 54, 'orange').set(73, 7, 56, 'orange').set(72, 5, 54, 'black').set(72, 5, 56, 'black')
  g.set(72, 4, 54, 'white').set(72, 4, 56, 'white').set(72, 4, 55, 'darkPink')
  g.box(75, 3, 54, 1, 1, 3, 'darkOrange').box(77, 3, 54, 1, 1, 3, 'darkOrange')
  g.box(78, 1, 55, 2, 1, 1, 'orange').box(79, 2, 55, 1, 2, 1, 'orange').set(79, 4, 55, 'darkOrange')
  g.cyl(32.5, 1, 65.5, 2.5, 5, 'sandBlue').cyl(32.5, 5, 65.5, 1.5, 1, null).set(32, 5, 65, 'white').set(33, 5, 66, 'lightYellow')
  g.set(36, 1, 68, 'white').set(29, 1, 63, 'lightYellow')
  g.box(13, 1, 63, 7, 8, 3, 'mediumLavender').box(14, 2, 66, 5, 3, 1, 'purple').box(14, 6, 65, 5, 1, 1, 'yellow')
  g.set(13, 8, 63, null).set(13, 8, 64, null).set(13, 8, 65, null).set(19, 8, 63, null).set(19, 8, 64, null).set(19, 8, 65, null)
  g.box(15, 9, 64, 3, 1, 1, 'purple')
}
