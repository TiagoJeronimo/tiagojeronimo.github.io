import { COLORS, Grid } from '../bricks/voxel.ts'
import type { ColorName } from '../bricks/voxel.ts'

/** Lisbon, 2012-2017: a street of townhouses, the yellow tram, calçada waves, books and a graduation cap. */
export default function build(): Grid {
  const g = new Grid(28, 72, 28)

  // Ground: pavement at the back, street with rails, black-and-white wave mosaic at the front.
  g.box(0, 0, 0, 28, 1, 14, 'tan')
  g.box(0, 0, 14, 28, 1, 7, 'lightGray')
  g.box(0, 0, 15, 28, 1, 1, 'darkGray')
  g.box(0, 0, 19, 28, 1, 1, 'darkGray')
  g.each(0, 0, 21, 28, 1, 7, (x, _y, z) => ((z + Math.round(1.3 * Math.sin((x * Math.PI) / 4))) % 4 < 2 ? 'black' : 'white'))

  // Pink townhouse.
  g.box(2, 1, 2, 9, 24, 7, 'pink')
  g.sprite(2, 1, 8, [
    'PPPPPPPPP',
    'PWWPPPWWP',
    'PWWPPPWWP',
    'PPPPPPPPP',
    'PPPPPPPPP',
    'PDDPPPWWP',
    'PDDPPPWWP',
    'PDDPPPPPP',
  ], { P: 'pink', W: 'transLightBlue', D: 'darkGreen' })
  g.box(2, 12, 9, 9, 1, 1, 'black')
  g.box(2, 13, 9, 9, 2, 1, 'black').clear(3, 13, 9, 7, 2, 1)
  g.box(1, 25, 1, 11, 1, 9, 'darkOrange')
  for (let i = 0; i < 4; i++) g.box(2 + i, 26 + i * 2, 2 + i, 9 - i * 2, 2, 7 - i * 2, 'darkOrange')

  // Azulejo house.
  g.box(12, 1, 3, 8, 18, 6, 'white')
  g.sprite(12, 1, 8, [
    'ABABABAB',
    'BWWBAWWA',
    'AWWABWWB',
    'BABABABA',
    'ABADDBAB',
    'BABDDABA',
  ], { A: 'white', B: 'mediumBlue', W: 'transLightBlue', D: 'brown' })
  g.box(11, 19, 2, 10, 1, 8, 'darkOrange')
  for (let i = 0; i < 3; i++) g.box(12 + i, 20 + i * 2, 3 + i, 8 - i * 2, 2, 6 - i * 2, 'darkOrange')

  // Tall yellow house.
  g.box(21, 1, 2, 6, 30, 7, 'lightYellow')
  g.sprite(21, 1, 8, [
    'YYYYYY',
    'YWWWWY',
    'YYYYYY',
    'YWYYWY',
    'YWYYWY',
    'YYYYYY',
    'YWYYWY',
    'YWYYWY',
    'YYDDYY',
    'YYDDYY',
  ], { Y: 'lightYellow', W: 'transLightBlue', D: 'darkRed' })
  g.box(20, 31, 1, 8, 1, 9, 'darkOrange')
  for (let i = 0; i < 3; i++) g.box(21 + i, 32 + i * 2, 2 + i, 6 - i * 2, 2, 7 - i * 2, 'darkOrange')

  // The tram, running along the rails.
  g.box(8, 1, 16, 12, 3, 3, 'black')
  for (const x of [9, 10, 17, 18]) g.box(x, 1, 15, 1, 3, 5, 'darkGray')
  g.box(7, 4, 15, 14, 9, 5, 'yellow')
  g.box(7, 13, 15, 14, 6, 5, 'white').clear(8, 13, 16, 12, 6, 3)
  for (const x of [8, 9, 11, 12, 15, 16, 18, 19]) {
    g.box(x, 13, 15, 1, 6, 1, 'transLightBlue')
    g.box(x, 13, 19, 1, 6, 1, 'transLightBlue')
  }
  g.box(7, 13, 16, 1, 6, 3, 'transLightBlue')
  g.box(20, 13, 16, 1, 6, 3, 'transLightBlue')
  g.box(7, 19, 15, 14, 1, 5, 'yellow')
  g.box(8, 20, 16, 12, 2, 3, 'lightGray')
  g.set(20, 6, 17, 'glowYellow').set(7, 6, 17, 'glowRed')
  for (let i = 0; i < 4; i++) g.box(13 - i, 22 + i, 17, 2, 1, 1, 'darkGray')

  // Jacaranda.
  g.box(3, 1, 23, 2, 15, 2, 'brown')
  g.ball(4, 22, 24, 3.2, 'mediumLavender')

  // Street lamp.
  g.box(26, 1, 12, 1, 18, 1, 'black')
  g.box(25, 19, 11, 3, 1, 3, 'black')
  g.set(26, 18, 13, 'glowYellow')

  // A stack of books with a graduation cap on top.
  g.box(19, 1, 22, 7, 3, 5, 'red').box(25, 1, 23, 1, 3, 3, 'white')
  g.box(20, 4, 22, 6, 3, 5, 'azure').box(20, 4, 23, 1, 3, 3, 'white')
  g.box(19, 7, 23, 6, 3, 4, 'brightGreen').box(24, 7, 24, 1, 3, 2, 'white')
  g.box(21, 10, 24, 3, 2, 2, 'black')
  g.box(20, 12, 23, 5, 1, 4, 'black')
  g.set(22, 13, 24, 'yellow').set(23, 13, 24, 'yellow').set(24, 13, 24, 'yellow')
  g.box(25, 10, 24, 1, 3, 1, 'yellow')

  return g
}

/** The tiny things, drawn on the refined grid (voxels): a lived-in street and a student room behind the pink balcony. */
export function detail(g: Grid): void {
  /** Colour of a cell, or undefined when it is empty. */
  const at = (x: number, y: number, z: number): ColorName | undefined =>
    x < 0 || z < 0 || x >= g.sx || z >= g.sz ? undefined : COLORS[g.cells[x + g.sx * (z + g.sz * (y + g.oy))] - 1]
  /** Recolour cells that are already filled, so a surface gets texture without changing shape. */
  const paint = (
    x: number, y: number, z: number, w: number, h: number, d: number,
    fn: (x: number, y: number, z: number, was: ColorName) => ColorName | undefined,
  ) =>
    g.each(x, y, z, w, h, d, (i, j, k) => {
      const was = at(i, j, k)
      return was ? fn(i, j, k, was) : undefined
    })
  /** A repeatable random number in 0..1 for a cell. */
  const rnd = (x: number, y: number, z: number) => {
    let h = Math.imul(x, 374761393) + Math.imul(y, 1103515245) + Math.imul(z, 668265263)
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
  }

  // --- Roofs: a few sun-bleached and mossy tiles, then chimneys ---
  paint(3, 19, 3, 81, 19, 27, (x, y, z, was) => {
    if (was !== 'darkOrange') return undefined
    const r = rnd(x, y, z)
    return r < 0.1 ? 'coral' : r < 0.18 ? 'mediumNougat' : undefined
  })
  const chimney = (x: number, y: number, z: number, h: number) => {
    g.box(x, y, z, 3, h, 3, 'white').box(x, y + h - 2, z, 3, 1, 3, 'lightGray')
    g.box(x - 1, y + h, z - 1, 5, 1, 5, 'darkOrange').box(x, y + h + 1, z, 3, 1, 3, 'darkOrange')
  }
  chimney(10, 28, 12, 7)
  chimney(64, 33, 14, 7)
  chimney(54, 22, 10, 5)

  // --- Pink house: the upper front is open, with a student room behind the balcony ---
  g.clear(8, 13, 18, 23, 12, 9)
  g.each(8, 12, 18, 23, 1, 9, (x) => (x % 4 === 3 ? 'mediumNougat' : 'nougat'))
  g.box(8, 13, 17, 23, 12, 1, 'white').box(7, 13, 18, 1, 12, 9, 'white').box(31, 13, 18, 1, 12, 9, 'white')
  // Rug.
  g.each(12, 12, 22, 13, 1, 4, (x, _y, z) =>
    x === 12 || x === 24 || z === 22 || z === 25 ? 'darkRed' : (x + z) % 2 ? 'coral' : 'lightYellow')
  // Bed along the right wall, a quilt, a pillow and a poster above it.
  g.box(26, 13, 18, 5, 1, 8, 'brown').box(26, 14, 18, 5, 1, 8, 'white').box(26, 15, 17, 5, 2, 1, 'brown')
  g.each(26, 14, 21, 5, 1, 5, (x, _y, z) => ((x + z) % 2 ? 'azure' : 'lightBlue'))
  g.box(27, 15, 18, 3, 1, 2, 'lightYellow')
  g.sprite(31, 16, 21, ['KKKKK', 'KPPPK', 'KOYOK', 'KBBBK', 'KKKKK'], { K: 'black', P: 'purple', O: 'orange', Y: 'yellow', B: 'azure' }, { plane: 'zy' })
  // Desk with a computer, a keyboard, a mug and a tiny cactus.
  g.box(12, 13, 18, 1, 1, 3, 'brown').box(18, 13, 18, 1, 1, 3, 'brown').box(12, 14, 18, 7, 1, 3, 'brown')
  g.sprite(13, 15, 18, ['KKKKK', 'KCCCK', 'KCCCK'], { K: 'black', C: 'glowCyan' })
  g.box(14, 15, 20, 3, 1, 1, 'lightGray').set(17, 15, 19, 'red').set(12, 15, 19, 'darkOrange').set(12, 16, 19, 'green')
  g.box(15, 13, 22, 1, 1, 2, 'black').box(14, 14, 22, 3, 1, 2, 'coral')
  // Bookcase.
  g.box(19, 13, 18, 7, 5, 2, 'brown')
  const spines: ColorName[] = ['red', 'azure', 'yellow', 'white', 'green', 'purple', 'orange', 'lightBlue', 'darkRed', 'lime']
  for (let i = 0; i < 10; i++) g.set(20 + (i % 5), i < 5 ? 14 : 16, 19, spines[i])
  g.set(21, 18, 18, 'darkOrange').set(21, 19, 18, 'green').set(24, 18, 18, 'yellow')
  // A big plant in the corner and a lamp hanging from the ceiling.
  g.box(9, 13, 24, 2, 2, 2, 'darkOrange').ball(10, 17, 25, 2.2, 'darkGreen')
  g.set(9, 18, 25, 'green').set(11, 17, 26, 'green').set(10, 16, 26, 'green')
  g.box(18, 21, 22, 1, 4, 1, 'black').box(17, 20, 21, 3, 1, 3, 'yellow').set(18, 19, 22, 'glowYellow')

  // The balcony: an iron railing and two pots of geraniums.
  g.clear(6, 13, 27, 3, 2, 3).clear(30, 13, 27, 3, 2, 3)
  g.box(7, 12, 27, 25, 1, 3, 'lightGray').box(7, 14, 29, 25, 1, 1, 'black').box(7, 14, 27, 1, 1, 2, 'black').box(31, 14, 27, 1, 1, 2, 'black')
  for (let x = 7; x <= 31; x += 3) g.set(x, 13, 29, 'black')
  g.set(7, 13, 27, 'black').set(31, 13, 27, 'black')
  // Festival bunting under the balcony.
  const flags: ColorName[] = ['red', 'yellow', 'azure', 'lime', 'darkPink']
  for (let x = 8; x <= 30; x += 2) g.box(x, x % 4 ? 11 : 10, 29, 1, x % 4 ? 1 : 2, 1, flags[(x / 2) % 5])
  for (const [x, c] of [[9, 'red'], [28, 'darkPink']] as const) {
    g.box(x, 13, 27, 2, 1, 2, 'darkOrange').box(x, 14, 27, 2, 1, 2, 'green')
    g.set(x, 15, 27, c).set(x + 1, 15, 28, c).set(x + 1, 14, 28, c)
  }

  // Front door: a stone frame, a fanlight, a knob, a mat, a wall lantern and plants on both sides.
  g.box(8, 1, 26, 1, 10, 1, 'white').box(15, 1, 26, 1, 10, 1, 'white').box(8, 10, 26, 8, 1, 1, 'white')
  g.clear(9, 1, 26, 6, 9, 1).box(10, 9, 25, 4, 1, 1, 'transLightBlue').set(13, 5, 26, 'yellow')
  g.box(9, 1, 27, 6, 1, 2, 'darkRed').box(10, 1, 27, 4, 1, 1, 'coral')
  g.set(16, 9, 27, 'black').set(16, 8, 27, 'glowYellow')
  g.box(5, 1, 27, 2, 2, 2, 'darkOrange').box(5, 3, 27, 2, 2, 2, 'green').set(5, 5, 27, 'green').set(6, 4, 28, 'pink').set(5, 3, 28, 'pink')
  g.box(17, 1, 27, 3, 2, 3, 'darkOrange').box(18, 3, 28, 1, 3, 1, 'brown').ball(18, 8, 29, 2.2, 'darkGreen')
  g.set(17, 7, 30, 'yellow').set(16, 8, 28, 'yellow').set(18, 9, 29, 'yellow')

  // --- Azulejo house: finer tiles, window sills, a ginger cat on one and a flower box on the other ---
  paint(36, 1, 24, 24, 18, 3, (x, y, _z, was) => {
    if (was !== 'white' && was !== 'mediumBlue') return undefined
    const u = (x - 37) & 3
    const v = (y - 1) & 3
    return u === 3 && v === 3 ? 'blue' : (u + v) % 2 === 1 && u < 3 && v < 3 ? 'mediumBlue' : 'white'
  })
  g.box(38, 9, 27, 8, 1, 1, 'white').box(50, 9, 27, 8, 1, 2, 'white')
  g.sprite(52, 10, 27, ['O.O', 'OOO', 'OWO', 'OOO'], { O: 'orange', W: 'white' }, { depth: 2 })
  g.set(52, 12, 28, 'black').set(54, 12, 28, 'black').set(55, 10, 28, 'orange').set(56, 10, 28, 'orange').set(56, 11, 28, 'orange')
  g.box(39, 10, 27, 6, 1, 1, 'brown').each(39, 11, 27, 6, 1, 1, (x) => (x % 2 ? 'red' : 'green'))
  g.set(40, 12, 27, 'green').set(43, 12, 27, 'pink')

  // --- Yellow house: teal shutters, sills, a flower box with trailing ivy, a framed door ---
  for (const x of [65, 69, 74, 78]) paint(x, 16, 26, 1, 6, 1, () => 'teal')
  g.box(65, 15, 27, 5, 1, 1, 'white').box(74, 15, 27, 5, 1, 1, 'white').box(65, 24, 27, 14, 1, 1, 'white')
  g.each(66, 25, 27, 12, 1, 1, (x) => (x % 3 === 0 ? 'red' : 'green'))
  for (const [x, n] of [[67, 2], [72, 1], [76, 3]]) g.box(x, 24 - n, 27, 1, n, 1, 'green')
  g.box(68, 1, 26, 1, 6, 1, 'white').box(75, 1, 26, 1, 6, 1, 'white').box(69, 7, 26, 6, 1, 1, 'white')
  g.set(73, 3, 27, 'yellow').box(68, 1, 27, 8, 1, 2, 'lightGray')

  // Lanterns hanging from the eaves.
  for (const [x, y] of [[4, 24], [61, 30]]) g.set(x, y, 28, 'black').set(x, y - 1, 28, 'black').set(x, y - 2, 28, 'glowOrange')

  // --- Up on the roofs: a black cat on the pink ridge, a TV antenna, and laundry drying between two houses ---
  g.box(18, 33, 17, 3, 1, 1, 'black').sprite(18, 34, 16, ['K.K', 'KKK', 'KKK', 'KKK'], { K: 'black' }, { depth: 2 })
  g.set(18, 36, 17, 'yellow').set(20, 36, 17, 'yellow').set(21, 34, 17, 'black').set(22, 34, 17, 'black').set(22, 35, 17, 'black')
  g.box(72, 38, 16, 1, 7, 1, 'darkGray').box(69, 43, 16, 7, 1, 1, 'darkGray').box(70, 41, 16, 5, 1, 1, 'darkGray')
  g.box(33, 24, 27, 5, 1, 1, 'white').box(37, 23, 27, 24, 1, 1, 'white').box(60, 24, 27, 5, 1, 1, 'white')
  g.sprite(39, 20, 27, ['XXXXX', '.XXX.', '.XXX.'], { X: 'azure' })
  g.sprite(45, 20, 27, ['XXX', 'X.X', 'X.X'], { X: 'darkBlue' })
  g.sprite(49, 21, 27, ['X..X.', 'XX.XX'], { X: 'red' })
  g.sprite(55, 20, 27, ['PPPP', 'WWWW', 'PPPP'], { P: 'darkPink', W: 'white' })

  // A bougainvillea climbing the side wall of the pink house, and a side window with a flower box.
  g.box(4, 1, 21, 2, 2, 2, 'darkOrange')
  for (let y = 3; y <= 24; y++)
    for (let z = 8; z <= 24; z++) {
      const mid = 21 - y * 0.35
      const r = rnd(5, y, z)
      if (Math.abs(z - mid) <= 1 + y / 7 && r < 0.72) g.set(5, y, z, r < 0.2 && y > 8 ? 'magenta' : r < 0.36 && y > 5 ? 'darkPink' : r < 0.55 ? 'green' : 'darkGreen')
    }
  g.box(5, 3, 21, 1, 2, 1, 'brown')
}
