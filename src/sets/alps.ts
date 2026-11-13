import { Grid } from '../bricks/voxel.ts'

/** Off screen: a Matterhorn with a Swiss flag, pines, a tent and campfire, a surfboard, a snowboard, a lake and a camera. */
export default function build(): Grid {
  const g = new Grid(28, 72, 28)

  // Ground: snow at the back, meadow at the front, a lake in the front-right corner.
  g.each(0, 0, 0, 28, 1, 28, (x, _y, z) => {
    if (((x - 21) / 5.5) ** 2 + ((z - 24.5) / 2.6) ** 2 <= 1) return 'azure'
    return z < 16 + 2 * ((x >> 2) % 2) ? 'white' : 'brightGreen'
  })
  g.box(19, 0, 25, 3, 1, 1, 'lightBlue').box(22, 0, 23, 2, 1, 1, 'lightBlue')

  // The mountain: a sharp main peak and a low shoulder. Heights are in cubes; the inside is hollowed automatically.
  const peak = (x: number, z: number, ax: number, az: number, h: number, l: number, r: number, b: number, f: number) => {
    const dx = Math.abs(x + 0.5 - ax) / (x + 0.5 < ax ? l : r)
    const dz = Math.abs(z + 0.5 - az) / (z + 0.5 < az ? b : f)
    return Math.round(h * Math.max(0, 1 - (dx ** 1.4 + dz ** 1.4) ** (1 / 1.4)) ** 1.15)
  }
  const height = (x: number, z: number) =>
    Math.max(peak(x, z, 14.5, 5.5, 17, 13, 10, 6.5, 10.5), peak(x, z, 6.5, 6.5, 9, 6, 6, 5, 7))
  g.each(0, 1, 0, 28, 51, 17, (x, y, z) => {
    const h = height(x, z)
    const cube = Math.ceil(y / 3)
    if (cube > h) return undefined
    if (cube > 6 + ((x >> 1) % 2)) return 'white'
    return x < 14 ? 'mediumLavender' : 'sandBlue'
  })
  g.box(15, 49, 5, 1, 3, 1, 'white')

  // Swiss flag on the summit.
  g.box(14, 52, 5, 1, 18, 1, 'brown')
  g.sprite(15, 55, 5, ['RRRRR', 'RRWRR', 'RWWWR', 'RRWRR', 'RRRRR'], { R: 'red', W: 'white' })

  // Pines with snowy tips.
  const pine = (cx: number, cz: number, radii: number[]) => {
    g.box(cx - 1, 1, cz - 1, 2, 6, 2, 'brown')
    radii.forEach((r, i) => g.cyl(cx, 7 + i * 6, cz, r, 6, 'darkGreen'))
    g.box(cx - 1, 4 + radii.length * 6, cz - 1, 2, 3, 2, 'white')
  }
  pine(4, 18, [3, 2, 1])
  pine(25, 11, [3, 2, 1])

  // Surfboard leaning on the front pine.
  const board = ['.W.', 'WAW', 'WAW', 'WAW', 'WAW', 'WAW', 'WAW', 'WAW']
  g.sprite(3, 1, 22, board.slice(4), { W: 'white', A: 'azure' })
  g.sprite(3, 10, 21, board.slice(0, 5), { W: 'white', A: 'azure' })

  // Snowboard standing in the snow.
  g.sprite(17, 1, 16, ['TT', 'TT', 'YY', 'TT', 'TT', 'YY', 'TT'], { T: 'teal', Y: 'yellow' })

  // Tent with its doorway facing the front.
  g.sprite(9, 1, 17, ['...O...', '..OOO..', '.OOOOO.', '.OOOOO.', 'OOOOOOO'], { O: 'orange' }, { depth: 6 })
  g.sprite(11, 1, 22, ['.D.', 'DDD', 'DDD'], { D: 'brown' })

  // Campfire.
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.box(18 + dx, 1, 21 + dz, 1, 2, 1, 'lightGray')
  g.box(17, 1, 21, 3, 3, 1, 'brown').box(18, 1, 20, 1, 3, 3, 'brown')
  g.box(18, 4, 21, 1, 6, 1, 'glowOrange').box(18, 10, 21, 1, 3, 1, 'glowYellow')
  g.box(17, 4, 21, 1, 3, 1, 'transOrange').box(19, 4, 21, 1, 2, 1, 'transOrange').box(18, 4, 22, 1, 3, 1, 'transOrange')

  // Camera on a tripod, with a big lens.
  g.box(22, 1, 20, 4, 1, 1, 'darkGray').box(23, 1, 19, 2, 1, 3, 'darkGray')
  g.box(23, 2, 20, 2, 8, 1, 'darkGray')
  g.box(22, 10, 19, 4, 6, 2, 'red')
  g.box(23, 10, 21, 2, 6, 1, 'darkBlue').box(23, 10, 22, 2, 6, 1, 'lightBlue')
  g.box(22, 16, 19, 2, 3, 2, 'white').box(25, 16, 19, 1, 1, 1, 'yellow')

  return g
}
