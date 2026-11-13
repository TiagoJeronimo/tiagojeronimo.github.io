import { Grid, type ColorName } from '../bricks/voxel.ts'

/** y of cube row n: a cube is 3 plates tall, rows start on top of the 1-plate ground. */
const Y = (row: number) => 1 + row * 3

/** Runtime Revolution, 2018-2019: a laptop and a phone running client apps, and a rocket launching behind them. */
export default function build(): Grid {
  const g = new Grid(28, 48, 24)

  // Ground: soft checker, rounded corners, a navy strip along the front.
  g.each(0, 0, 0, 28, 1, 24, (x, _y, z) => (z >= 22 ? 'darkBlue' : ((x >> 2) + (z >> 2)) % 2 ? 'white' : 'lightGray'))
  for (const x of [0, 27])
    for (const z of [0, 23]) g.set(x, 0, z, null).set(x ? 26 : 1, 0, z, null).set(x, 0, z ? 22 : 1, null)

  // Launch pad, flame and rocket, centred on (15.5, 6.5).
  const cx = 15.5
  const cz = 6.5
  const trim: ColorName = 'red' // nose cone and fins
  g.cyl(cx, Y(0), cz, 5.6, 3, 'sandBlue')
  g.cyl(cx, Y(1), cz, 2, 3, 'glowOrange')
  g.cyl(cx, Y(1), cz, 1, 3, 'glowYellow')
  g.cyl(cx, Y(2), cz, 1.5, 3, 'glowOrange')
  g.box(15, Y(2), 6, 1, 3, 1, 'glowYellow')
  g.cyl(cx, Y(3), cz, 1.5, 3, 'darkGray')
  g.cyl(cx, Y(4), cz, 2.5, 18, 'white')
  g.cyl(cx, Y(5), cz, 2.5, 3, 'yellow')
  g.box(14, Y(6), 8, 3, 9, 1, 'azure')
  g.box(15, Y(7), 8, 1, 3, 1, 'transLightBlue')
  g.box(15, Y(7), 7, 1, 3, 1, 'glowYellow')
  ;[2.5, 2, 1.5, 0.5].forEach((r, i) => g.cyl(cx, Y(10 + i), cz, r, 3, trim))
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    // [cells out from the centre, cube row]
    for (const [out, row] of [[3, 1], [4, 1], [5, 1], [3, 2], [4, 2], [3, 3], [4, 3], [3, 4], [3, 5]])
      g.box(15 + dx * out, Y(row), 6 + dz * out, 1, 3, 1, trim)
  }
  // Smoke puffs around the pad.
  for (const [x, z] of [[12, 10], [17, 10], [9, 4], [20, 4]]) {
    g.box(x, Y(0), z, 3, 3, 3, 'white')
    g.box(x + (x < 15 ? 0 : 1), Y(1), z, 2, 3, 2, 'white')
  }

  // Laptop.
  g.box(1, Y(0), 12, 12, 3, 9, 'lightGray')
  g.each(2, 3, 15, 10, 1, 3, (x, _y, z) => (((x >> 1) + z) % 2 ? 'darkGray' : 'sandBlue'))
  g.box(5, 3, 19, 4, 1, 1, 'white')
  g.box(1, Y(1), 12, 12, 24, 1, 'lightGray')
  g.box(1, Y(1), 13, 12, 24, 1, 'darkBlue')
  for (const x of [1, 12]) g.clear(x, Y(8), 12, 1, 3, 2)
  g.sprite(2, Y(2), 13, [
    'AAAAAAAAYA',
    'WWWWWWWWWW',
    'WYYWPPWGGW',
    'WYYWPPWGGW',
    'WWWWWWWWWW',
    'WLLLLLWBBW',
  ], { A: 'azure', W: 'white', Y: 'yellow', P: 'pink', G: 'brightGreen', L: 'lightGray', B: 'glowBlue' })

  // Phone on a stand.
  g.box(19, Y(0), 14, 9, 3, 4, 'yellow')
  g.box(20, Y(1), 15, 7, 27, 1, 'lightGray')
  g.box(20, Y(1), 16, 7, 27, 1, 'black')
  for (const x of [20, 26]) for (const row of [1, 9]) g.clear(x, Y(row), 15, 1, 3, 2)
  const icons: Record<string, ColorName> = {
    S: 'lavender', W: 'white', a: 'glowPink', b: 'glowYellow', c: 'glowCyan', d: 'glowGreen', e: 'coral',
    f: 'purple', g: 'glowBlue', h: 'glowOrange', i: 'teal',
  }
  g.sprite(21, Y(2), 16, ['aSbSc', 'SSSSS', 'dSeSf', 'SSSSS', 'gShSi', 'SSSSS', 'SWWWS'], icons)

  // Parcels ready to ship.
  g.box(14, Y(0), 18, 3, 6, 3, 'tan')
  g.box(15, Y(0), 20, 1, 6, 1, 'darkTan')
  g.box(15, 6, 18, 1, 1, 3, 'darkTan')
  g.box(16, Y(1), 20, 1, 3, 1, 'white')
  g.box(14, Y(2), 18, 2, 3, 2, 'nougat')
  g.box(17, Y(0), 19, 2, 3, 2, 'nougat')

  return g
}

/**
 * The desk and the launch site's small things, in voxels: x and z are 3x the studs of build(), y = 0 is the ground.
 */
export function detail(g: Grid): void {
  // On the desk, right of the laptop: a mug of coffee with steam, and a mouse on its mat.
  g.cyl(43.5, 1, 42.5, 2.5, 5, 'white').cyl(43.5, 3, 42.5, 2.5, 1, 'azure').cyl(43.5, 5, 42.5, 1.5, 1, 'brown')
  g.box(46, 2, 42, 2, 3, 1, 'white').set(46, 3, 42, null)
  for (const [x, y] of [[43, 6], [43, 7], [44, 7], [44, 8], [44, 9], [43, 9], [43, 10]]) g.set(x, y, 42, 'transClear')
  g.box(40, 1, 46, 10, 1, 7, 'teal')
  g.box(43, 2, 48, 3, 1, 4, 'white').box(43, 3, 49, 3, 1, 2, 'white').set(44, 2, 48, 'darkGray')

  // Sticky notes on the screen's frame, and a rubber duck on top of it.
  g.box(36, 15, 42, 3, 3, 1, 'yellow').box(3, 9, 42, 3, 3, 1, 'pink').box(20, 23, 42, 3, 3, 1, 'lime')
  g.box(25, 28, 37, 5, 2, 4, 'yellow').box(26, 30, 38, 3, 3, 3, 'yellow').set(27, 30, 37, 'yellow')
  g.set(26, 32, 40, 'black').set(28, 32, 40, 'black').set(27, 31, 41, 'orange')

  // A desk lamp reaching over the laptop from behind.
  g.cyl(7.5, 1, 31.5, 3.5, 2, 'teal').box(7, 3, 31, 1, 34, 1, 'darkGray').box(7, 36, 32, 1, 1, 12, 'darkGray')
  g.cyl(7.5, 33, 44.5, 2.5, 3, 'teal').cyl(7.5, 32, 44.5, 3.5, 1, 'teal').cyl(7.5, 32, 44.5, 2.5, 1, 'glowYellow')

  // In front of the laptop: a notebook, a pencil and a pair of headphones.
  g.box(8, 1, 63, 8, 1, 6, 'white').box(8, 2, 63, 8, 1, 6, 'azure').box(11, 2, 64, 4, 1, 2, 'white')
  for (let z = 63; z < 69; z += 2) g.set(8, 2, z, 'darkGray')
  g.box(19, 1, 68, 7, 1, 1, 'yellow').set(18, 1, 68, 'pink').set(26, 1, 68, 'tan').set(27, 1, 68, 'black')
  for (const x of [29, 37]) g.box(x - 1, 1, 64, 3, 4, 4, 'coral').box(x, 5, 65, 1, 2, 2, 'black')
  g.box(30, 7, 65, 7, 1, 2, 'black').box(30, 6, 65, 1, 1, 2, 'black').box(36, 6, 65, 1, 1, 2, 'black')

  // Shipping corner: a cat asleep on the parcels, a trolley with one more box, a stack of books and a plant.
  g.box(42, 10, 55, 6, 2, 4, 'darkGray').box(45, 10, 57, 3, 3, 3, 'darkGray')
  g.set(45, 13, 58, 'darkGray').set(47, 13, 58, 'darkGray').set(45, 11, 59, 'black').set(47, 11, 59, 'black')
  g.set(46, 10, 59, 'pink').box(42, 10, 59, 3, 1, 1, 'black').set(43, 11, 56, 'black').set(43, 11, 57, 'black')
  for (const x of [59, 64]) g.box(x, 1, 56, 1, 11, 1, 'red').box(x === 59 ? 58 : 65, 1, 55, 1, 2, 2, 'black')
  g.box(59, 11, 56, 6, 1, 1, 'red').box(59, 6, 56, 6, 1, 1, 'red').box(59, 1, 57, 6, 1, 4, 'darkGray')
  g.box(60, 2, 57, 4, 4, 4, 'tan').box(61, 2, 57, 1, 4, 4, 'darkTan').box(62, 3, 60, 2, 2, 1, 'white')
  g.box(69, 1, 56, 8, 2, 6, 'azure').box(70, 3, 56, 7, 2, 6, 'coral').box(69, 5, 57, 7, 1, 5, 'yellow')
  g.box(70, 1, 61, 6, 1, 1, 'white').box(71, 3, 61, 5, 1, 1, 'white')
  g.cyl(79.5, 1, 59.5, 2.5, 3, 'coral').ball(79.5, 6.5, 59.5, 2.9, 'brightGreen')
  g.set(79, 9, 59, 'green').set(78, 6, 61, 'lime').set(81, 7, 59, 'green').set(80, 9, 60, 'darkPink')

  // Launch site: a bird on the rocket's nose, a little robot with its toolbox, fuel barrels and a wind sock.
  g.box(45, 43, 18, 3, 3, 3, 'azure').set(46, 43, 20, 'white').set(46, 44, 21, 'orange')
  g.set(45, 45, 20, 'black').set(47, 45, 20, 'black').set(46, 44, 17, 'mediumBlue')
  for (const x of [74, 76]) g.box(x, 1, 20, 1, 2, 1, 'darkGray')
  g.box(73, 3, 19, 5, 4, 3, 'white').box(73, 7, 19, 5, 4, 3, 'lightGray').box(74, 8, 21, 3, 2, 1, 'black')
  g.set(74, 9, 21, 'glowCyan').set(76, 9, 21, 'glowCyan').set(75, 5, 21, 'glowCyan').box(75, 11, 20, 1, 2, 1, 'darkGray')
  g.set(75, 13, 20, 'red').box(72, 4, 20, 1, 3, 1, 'darkGray').box(78, 4, 20, 1, 3, 1, 'darkGray')
  g.box(76, 1, 28, 6, 3, 4, 'red').box(76, 3, 28, 6, 1, 4, 'darkRed').box(78, 4, 30, 2, 1, 1, 'darkGray')
  g.box(76, 1, 34, 5, 1, 1, 'lightGray').set(81, 1, 33, 'lightGray').set(81, 1, 35, 'lightGray')
  for (const [x, z, c] of [[70.5, 7.5, 'red'], [76.5, 9.5, 'yellow']] as [number, number, ColorName][]) {
    g.cyl(x, 1, z, 2.5, 7, c).cyl(x, 8, z, 2.5, 1, 'darkGray').cyl(x, 3, z, 2.5, 1, 'white').cyl(x, 6, z, 2.5, 1, 'white')
    g.set(Math.floor(x) + 1, 9, Math.floor(z), 'black')
  }
  g.box(58, 3, 9, 1, 25, 1, 'lightGray')
  g.box(59, 25, 8, 2, 3, 3, 'orange').box(61, 25, 8, 2, 3, 3, 'white').box(63, 25, 9, 2, 2, 2, 'orange').box(65, 26, 9, 2, 1, 1, 'white')
}
