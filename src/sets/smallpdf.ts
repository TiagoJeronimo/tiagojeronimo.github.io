import { Grid } from '../bricks/voxel.ts'

/** Smallpdf / Sign.com, 2022-2026: a signed document, the pen that signed it, a growth chart, a robot and some coins. */
export default function build(): Grid {
  const g = new Grid(28, 60, 28)

  // Ground: white with a light-blue border.
  g.box(0, 0, 0, 28, 1, 28, 'lightBlue')
  g.box(2, 0, 2, 24, 1, 24, 'white')

  // The document: 12 wide, 16 tall, facing the front. The first pass only cuts the dog-ear through both layers.
  const page = [
    'WWWWWWWWW...',
    'WTTTTTWWWF..',
    'WWWWWWWWWFF.',
    'WGGGGGGWWFFF',
    'WWWWWWWWWWWW',
    'WGGGGGGGGGGW',
    'WWWWWWWWWWCW',
    'WGGGGGWCWCWW',
    'WWWWWWWWCWWW',
    'WGGGGGGWWWWW',
    'WWWWWWWWWWWW',
    'WWBWWBWWWWWW',
    'WBWBBWBWBWWW',
    'WBWBWWBBWWWW',
    'WKKKKKKKKKKW',
    'WWWWWWWWWWWW',
  ]
  g.box(7, 1, 8, 12, 48, 2, 'white')
  g.sprite(7, 1, 8, page, { '.': null }, { depth: 2 })
  g.sprite(7, 1, 9, page, { T: 'mediumBlue', G: 'lightGray', F: 'lightBlue', C: 'green', B: 'blue', K: 'darkBlue' })
  // Easel leg behind it.
  for (let k = 0; k < 6; k++) g.box(12, 16 - 3 * k, 6 - k, 2, 3, 2, 'mediumNougat')

  // The pen: nib on the end of the signature, held at a writing angle in front of the page.
  for (let r = 0; r < 13; r++) {
    const c = r < 2 ? 'yellow' : r === 2 ? 'lightGray' : r === 10 ? 'yellow' : r > 10 ? 'darkBlue' : 'blue'
    g.box(16 + (r >> 1), 7 + 3 * r, 10, Math.min(r + 1, 3), 3, r ? 2 : 1, c)
  }
  for (let r = 6; r < 10; r++) g.box(18 + (r >> 1), 7 + 3 * r, 12, 1, 3, 1, 'lightGray')

  // Growth chart: four rising bars on an axis, with a trend arrow behind them.
  g.box(16, 1, 17, 12, 1, 5, 'darkBlue')
  ;[6, 9, 15, 21].forEach((h, i) => {
    g.box(17 + i * 3, 2, 19, 2, h, 2, 'brightGreen')
    g.box(17 + i * 3, 2 + h, 19, 2, 1, 2, 'glowGreen')
  })
  for (let k = 0; k <= 10; k++) g.box(16 + k, 2 + 3 * k, 17, 2, 3, 2, 'coral')
  g.box(23, 32, 17, 4, 3, 2, 'coral').box(27, 23, 17, 1, 9, 2, 'coral')

  // The robot, waving.
  g.box(2, 1, 22, 2, 3, 3, 'darkBlue').box(6, 1, 22, 2, 3, 3, 'darkBlue')
  g.box(2, 4, 22, 6, 6, 3, 'mediumBlue')
  g.box(4, 6, 24, 2, 3, 1, 'glowYellow')
  g.box(1, 4, 23, 1, 6, 1, 'lightGray')
  g.box(8, 7, 23, 2, 3, 1, 'lightGray').box(9, 10, 23, 1, 12, 1, 'lightGray').box(9, 22, 23, 1, 3, 1, 'mediumBlue')
  g.box(1, 10, 21, 8, 15, 5, 'lightGray')
  g.sprite(1, 10, 25, [
    'LLLLLLLL',
    'LCCLLCCL',
    'LCCLLCCL',
    'PLMLLMLP',
    'LLLMMLLL',
  ], { C: 'glowCyan', M: 'darkBlue', P: 'pink' })
  g.box(4, 25, 23, 2, 3, 1, 'darkGray').box(4, 28, 22, 2, 3, 2, 'glowYellow')

  // Coins.
  for (let i = 0; i < 4; i++) g.cyl(13, 1 + i * 3, 22, 2, 3, i % 2 ? 'lightYellow' : 'yellow')
  for (let i = 0; i < 2; i++) g.cyl(16, 1 + i * 3, 25, 2, 3, i % 2 ? 'lightYellow' : 'yellow')

  return g
}

/** The desk world around it, drawn in voxels: x and z are 3x the ones above, y = 1 is the first layer on the ground. */
export function detail(g: Grid): void {
  // --- Back left: a plant and a filing box full of folders.
  g.cyl(12.5, 1, 22.5, 2.5, 4, 'darkOrange').cyl(12.5, 4, 22.5, 1.5, 1, 'brown').box(12, 5, 22, 1, 6, 1, 'brown')
  g.ball(12.5, 13, 22.5, 3.6, 'green').ball(10, 15, 21.5, 2.4, 'brightGreen').ball(15, 16, 23.5, 2.4, 'darkGreen')
  g.ball(12.5, 18, 22.5, 2.2, 'brightGreen')
  g.box(5, 1, 9, 9, 6, 7, 'sandBlue').clear(6, 4, 10, 7, 3, 5).box(8, 3, 15, 3, 2, 1, 'white')
  g.box(6, 4, 10, 7, 6, 1, 'yellow').box(6, 4, 12, 7, 5, 1, 'coral').box(6, 4, 14, 7, 4, 1, 'teal')
  g.box(7, 10, 10, 2, 1, 1, 'yellow').box(10, 9, 12, 2, 1, 1, 'coral').box(8, 8, 14, 2, 1, 1, 'teal')

  // --- Back right: a desk lamp, a pencil pot and a mug of coffee.
  g.cyl(73.5, 1, 12.5, 2.5, 1, 'darkBlue').box(73, 2, 12, 1, 18, 1, 'darkGray').box(68, 19, 12, 5, 1, 1, 'darkGray')
  g.box(66, 17, 11, 3, 2, 3, 'coral').set(67, 19, 12, 'coral').set(67, 16, 12, 'glowYellow')
  g.cyl(62.5, 1, 14.5, 2, 5, 'teal').box(62, 6, 14, 1, 4, 1, 'yellow').set(62, 10, 14, 'darkPink')
  g.box(63, 6, 15, 1, 3, 1, 'red').box(61, 6, 15, 1, 2, 1, 'blue').box(63, 6, 13, 1, 5, 1, 'lime')
  g.cyl(66.5, 1, 22.5, 2, 4, 'purple').cyl(66.5, 4, 22.5, 1, 1, 'brown').box(69, 2, 22, 1, 2, 1, 'purple')
  g.box(66, 5, 22, 1, 2, 1, 'transClear').box(67, 6, 22, 1, 2, 1, 'transClear')

  // --- Front: a piggy bank next to the coins, a little trophy for the chart and a calculator.
  g.ball(61, 6, 75, 4.2, 'pink')
  for (const x of [59, 62]) for (const z of [73, 76]) g.set(x, 1, z, 'darkPink')
  g.box(65, 5, 74, 1, 2, 2, 'darkPink').set(64, 7, 73, 'black').set(64, 7, 76, 'black')
  g.set(62, 10, 73, 'darkPink').set(62, 10, 76, 'darkPink').box(56, 6, 75, 1, 2, 1, 'darkPink')
  g.box(59, 9, 75, 3, 1, 1, 'black').box(59, 10, 75, 3, 2, 1, 'yellow')
  g.box(71, 1, 67, 3, 1, 3, 'darkBlue').box(72, 2, 68, 1, 2, 1, 'yellow').box(71, 4, 67, 3, 1, 3, 'yellow')
  g.box(70, 5, 67, 5, 3, 3, 'yellow').set(72, 7, 68, null).set(69, 6, 68, 'yellow').set(75, 6, 68, 'yellow')
  g.box(71, 5, 69, 1, 2, 1, 'lightYellow')
  g.box(69, 1, 72, 8, 1, 10, 'darkBlue').sprite(69, 2, 72, [
    'KKKKKKKK',
    'KGGGGGGK',
    'KGGGGGGK',
    'KKKKKKKK',
    'KWKWKWOK',
    'KKKKKKKK',
    'KWKWKWOK',
    'KKKKKKKK',
    'KWKWKWRK',
    'KKKKKKKK',
  ], { K: 'darkBlue', G: 'sandGreen', W: 'white', O: 'orange', R: 'coral' }, { plane: 'xz' })

  // --- A second, tiny robot delivering an envelope.
  g.box(21, 1, 42, 2, 1, 2, 'darkBlue').box(24, 1, 42, 2, 1, 2, 'darkBlue').box(21, 2, 42, 5, 3, 2, 'mediumBlue')
  g.box(20, 5, 41, 7, 5, 4, 'lightGray').box(21, 7, 44, 2, 2, 1, 'glowCyan').box(24, 7, 44, 2, 2, 1, 'glowCyan')
  g.set(23, 6, 44, 'darkBlue').set(20, 6, 44, 'pink').set(26, 6, 44, 'pink')
  g.box(19, 8, 43, 1, 3, 1, 'lightGray').box(27, 8, 43, 1, 3, 1, 'lightGray')
  g.sprite(18, 11, 43, [
    'TTTTTTTTTTT',
    'TDTTTTTTTDT',
    'TTDDTTTDDTT',
    'TTTTDRDTTTT',
    'TTTTTTTTTTT',
    'TTTTTTTTTTT',
  ], { T: 'tan', D: 'darkTan', R: 'red' })

  // --- On the page: a "sign here" tab, a sticky note and confetti around the check mark.
  g.box(18, 9, 30, 6, 3, 1, 'darkPink').set(24, 10, 30, 'darkPink')
  g.box(19, 34, 30, 6, 6, 1, 'yellow').box(20, 37, 30, 4, 1, 1, 'darkOrange').box(20, 35, 30, 3, 1, 1, 'darkOrange')
  ;([[40, 31, 'yellow'], [44, 33, 'darkPink'], [47, 30, 'azure'], [54, 33, 'coral'], [41, 22, 'purple'], [51, 21, 'yellow'],
    [54, 25, 'darkPink'], [38, 27, 'azure'], [46, 19, 'coral'], [55, 29, 'purple']] as const)
    .forEach(([x, y, c]) => g.set(x, y, 30, c))
}
