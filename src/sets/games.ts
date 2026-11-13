import { Grid, type ColorName } from '../bricks/voxel.ts'

/** A rounded lump standing on the floor: the ellipsoid with radii (rx, ry, rz) around (cx, cy, cz), cut off below y = 1. */
function blob(g: Grid, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, color: ColorName | null) {
  const y0 = Math.max(1, Math.floor(cy - ry))
  g.each(Math.floor(cx - rx), y0, Math.floor(cz - rz), Math.ceil(rx * 2) + 1, Math.ceil(cy + ry) - y0 + 1, Math.ceil(rz * 2) + 1, (x, y, z) => {
    const dx = (x + 0.5 - cx) / rx
    const dy = (y + 0.5 - cy) / ry
    const dz = (z + 0.5 - cz) / rz
    return dx * dx + dy * dy + dz * dz <= 1 ? color : undefined
  })
}

/**
 * The den's small things, in voxels: x and z are 3x the studs of build(), y = 0 is the floor.
 * Everything here is lower than the cabinet and sits on the free floor around the big props.
 */
export function detail(g: Grid): void {
  // Reading nook, left: a beanbag with a ginger cat asleep on it, a floor lamp and a stack of comics.
  blob(g, 9, 3.5, 34, 6.5, 5.5, 6.5, 'teal')
  blob(g, 9, 9, 34, 3.6, 1.5, 3.1, null)
  g.box(6, 8, 32, 7, 2, 5, 'orange').box(7, 10, 33, 5, 1, 3, 'orange')
  for (const x of [8, 10]) g.box(x, 10, 33, 1, 1, 3, 'darkOrange').set(x, 9, 36, 'darkOrange')
  g.box(4, 8, 35, 5, 3, 3, 'orange').set(4, 11, 36, 'darkOrange').set(8, 11, 36, 'darkOrange')
  g.set(5, 9, 37, 'brown').set(7, 9, 37, 'brown').set(6, 8, 37, 'darkPink')
  g.box(13, 8, 33, 1, 1, 4, 'darkOrange').box(10, 8, 37, 4, 1, 1, 'darkOrange')

  g.cyl(4.5, 1, 21.5, 2.5, 1, 'darkGray').box(4, 2, 21, 1, 26, 1, 'darkGray')
  g.cyl(4.5, 28, 21.5, 3.5, 3, 'lightYellow').cyl(4.5, 31, 21.5, 2.5, 3, 'lightYellow')
  g.cyl(4.5, 28, 21.5, 2.5, 1, 'glowYellow')

  const comics: ColorName[] = ['azure', 'yellow', 'coral', 'white', 'purple']
  comics.forEach((c, i) => g.box(3 + (i % 2), 1 + i, 44 + (i % 3), 6, 1, 8, c))
  g.box(4, 5, 46, 4, 1, 1, 'white').box(5, 5, 49, 2, 1, 2, 'yellow')

  // Play mat, centre: a console with a cartridge in it, two controllers and dice.
  g.box(32, 1, 48, 21, 1, 8, 'teal').box(33, 1, 49, 19, 1, 6, 'sandGreen')
  for (let z = 48; z < 56; z += 2) g.set(31, 1, z, 'white').set(53, 1, z + 1, 'white')
  g.box(39, 2, 49, 7, 3, 4, 'lightGray').box(39, 4, 49, 7, 1, 1, 'darkGray')
  g.box(41, 5, 50, 3, 2, 2, 'coral').box(41, 6, 51, 3, 1, 1, 'white')
  g.set(40, 3, 52, 'black').set(44, 3, 52, 'black').set(42, 3, 52, 'glowGreen')
  for (const [x, button] of [[33, 'red'], [47, 'azure']] as [number, ColorName][]) {
    g.box(x, 2, 51, 5, 1, 3, 'white').set(x + 1, 2, 52, 'black').set(x + 3, 2, 52, button)
    g.set(x === 33 ? 38 : 46, 2, 52, 'black')
  }
  g.box(34, 2, 49, 3, 3, 3, 'white').set(35, 4, 50, 'black').set(34, 4, 51, 'black').set(36, 2, 51, 'black')
  g.ball(49.5, 3.5, 49.5, 1.6, 'purple').set(49, 4, 49, 'white')

  // Pizza night, front left: the box the slice came from, and soda cans.
  g.box(21, 1, 69, 13, 2, 13, 'tan').box(22, 2, 70, 11, 1, 11, null)
  g.box(21, 3, 68, 13, 11, 1, 'tan').box(21, 1, 68, 13, 2, 1, 'darkTan')
  g.cyl(27.5, 2, 75.5, 5, 1, 'nougat').cyl(27.5, 2, 75.5, 4, 1, 'yellow')
  for (const [x, z] of [[25, 73], [29, 73], [26, 77], [24, 75]]) g.set(x, 2, z, 'red')
  g.each(27, 2, 75, 6, 1, 6, (x, _y, z) => (x - 27 >= (z - 75) >> 1 && z - 75 >= (x - 27) >> 1 ? null : undefined))
  g.box(25, 8, 68, 5, 3, 1, 'red').box(26, 7, 68, 3, 5, 1, 'red').box(26, 8, 68, 3, 3, 1, 'yellow')
  for (const [x, z, c] of [[14, 71, 'red'], [10, 75, 'azure']] as [number, number, ColorName][])
    g.box(x, 1, z, 3, 5, 3, c).box(x, 3, z, 3, 1, 3, 'white').box(x, 6, z, 3, 1, 3, 'lightGray').set(x + 1, 6, z + 1, 'darkGray')
  g.box(12, 1, 79, 5, 3, 3, 'brightGreen').box(12, 1, 79, 1, 3, 3, 'lightGray').box(14, 1, 79, 1, 3, 3, 'white')

  // The bunny's corner, front right: a food bowl, a carrot and a baby bunny.
  g.cyl(60.5, 1, 69.5, 3.5, 2, 'mediumBlue').cyl(60.5, 2, 69.5, 2.5, 1, 'orange')
  g.set(60, 2, 68, 'green').set(61, 2, 70, 'darkOrange').set(59, 2, 70, 'darkOrange')
  g.box(65, 1, 75, 4, 2, 2, 'orange').box(69, 1, 75, 2, 1, 2, 'orange').set(71, 1, 76, 'darkOrange')
  g.box(63, 1, 75, 2, 2, 2, 'green').set(62, 2, 75, 'brightGreen').set(62, 1, 76, 'brightGreen')
  const fur: ColorName = 'lightNougat'
  g.box(73, 1, 66, 5, 3, 5, fur).box(72, 4, 67, 7, 5, 4, fur).box(73, 4, 71, 5, 5, 1, fur)
  for (const x of [72, 78]) g.clear(x, 4, 67, 1, 5, 1).clear(x, 8, 67, 1, 1, 4)
  for (const x of [73, 77]) g.box(x, 9, 69, 1, 4, 2, fur).box(x, 10, 70, 1, 2, 1, 'pink').set(x, 1, 71, fur)
  g.set(74, 6, 71, 'black').set(76, 6, 71, 'black').set(75, 5, 71, 'darkPink').box(75, 2, 65, 1, 2, 1, 'white')

  // A skateboard at the very front.
  g.box(44, 2, 78, 16, 1, 4, 'azure').box(46, 2, 79, 12, 1, 2, 'yellow')
  for (const x of [44, 59]) g.box(x, 3, 78, 1, 1, 4, 'azure')
  for (const x of [47, 56]) g.box(x, 1, 78, 1, 1, 4, 'darkGray').set(x, 1, 78, 'white').set(x, 1, 81, 'white')

  // Shelf, back right: game boxes, a row of cartridges, two figurines, and a lava lamp and a small cup on top.
  g.box(72, 1, 4, 11, 19, 1, 'tan')
  for (const x of [72, 82]) g.box(x, 1, 4, 1, 19, 6, 'mediumNougat')
  for (const y of [1, 7, 13, 19]) g.box(72, y, 4, 11, 1, 6, 'mediumNougat')
  g.box(73, 2, 6, 5, 2, 4, 'azure').box(74, 4, 6, 5, 1, 4, 'coral').box(79, 2, 6, 2, 4, 3, 'yellow')
  const carts: ColorName[] = ['red', 'azure', 'yellow', 'white', 'purple', 'teal', 'coral', 'darkBlue', 'pink']
  carts.forEach((c, i) => g.box(73 + i, 8, 6, 1, 4 + (i % 2), 3, c))
  g.box(74, 14, 7, 3, 2, 2, 'lightGray').box(74, 16, 7, 3, 2, 2, 'sandBlue').set(75, 18, 7, 'red')
  g.set(74, 17, 8, 'glowCyan').set(76, 17, 8, 'glowCyan')
  g.box(78, 14, 7, 3, 3, 2, 'mediumLavender').set(78, 16, 8, 'black').set(80, 16, 8, 'black')
  g.box(74, 20, 6, 3, 2, 3, 'darkGray').box(74, 22, 6, 3, 6, 3, 'transPink').box(74, 28, 6, 3, 1, 3, 'darkGray')
  g.set(75, 23, 7, 'glowPink').box(75, 25, 7, 1, 2, 1, 'glowPink').set(75, 29, 7, 'darkGray')
  g.box(78, 20, 6, 3, 1, 3, 'mediumNougat').set(79, 21, 7, 'lightGray').box(78, 22, 6, 3, 2, 3, 'lightGray')
}

/** Brave Bunny & Curvatron, 2014-2015: a cosy arcade with a cabinet, the bunny mascot, a trophy and a slice of pizza. */
export default function build(): Grid {
  const g = new Grid(28, 72, 28)

  // Floor: a soft 4x4 checker.
  g.each(0, 0, 0, 28, 1, 28, (x, _y, z) => (((x >> 2) + (z >> 2)) % 2 ? 'lavender' : 'pink'))

  // Arcade cabinet: x 6..13, back at z 3. Rows of one stud: 0-5 lower body, 6 control panel, 7-13 screen, 14-16 marquee.
  const front = (row: number) => (row < 6 ? 9 : row === 6 ? 10 : row < 14 ? 7 : row < 16 ? 9 : 8)
  for (let row = 0; row < 17; row++) {
    const y = 1 + row * 3
    const band = row === 4
    g.box(7, y, 3, 6, 3, front(row) - 2, band ? 'yellow' : row === 6 ? 'pink' : 'white')
    const sideFront = row > 6 && row < 14 ? 8 : front(row)
    for (const x of [6, 13]) g.box(x, y, 3, 1, 3, sideFront - 2, band ? 'yellow' : 'azure')
  }
  // Coin door.
  g.box(9, 4, 9, 2, 6, 1, 'sandBlue').box(9, 7, 9, 1, 2, 1, 'glowYellow')
  // Control panel: joystick and buttons.
  g.box(7, 21, 8, 6, 1, 3, 'sandBlue')
  g.box(8, 22, 9, 1, 3, 1, 'lightGray').box(8, 25, 9, 1, 3, 1, 'red')
  g.box(10, 22, 9, 1, 2, 1, 'glowYellow').box(12, 22, 9, 1, 2, 1, 'glowCyan').box(11, 22, 10, 1, 2, 1, 'glowGreen')
  // Screen: the ever-curving line.
  g.sprite(7, 22, 7, [
    '......',
    '.ccccc',
    '.p...c',
    '..cc.c',
    '..c..c',
    '..cccc',
    'p.....',
  ], { '.': 'black', c: 'glowCyan', p: 'glowPink' })
  // Marquee.
  g.box(7, 43, 9, 6, 6, 1, 'glowYellow').box(7, 45, 9, 6, 2, 1, 'glowPink')

  // Brave Bunny, front right: a round head with long ears, on a small body with a red scarf.
  const bx = 18
  const bz = 15
  g.box(bx + 1, 1, bz, 6, 9, 5, 'white')
  g.box(bx + 1, 8, bz, 6, 2, 5, 'red').box(bx + 5, 5, bz + 5, 1, 3, 1, 'red')
  g.box(bx + 1, 1, bz + 5, 2, 3, 1, 'white').box(bx + 5, 1, bz + 5, 2, 3, 1, 'white')
  g.box(bx + 3, 3, bz - 1, 2, 3, 1, 'white')
  g.box(bx, 10, bz, 8, 12, 6, 'white')
  for (const x of [bx, bx + 7]) for (const z of [bz, bz + 5]) g.clear(x, 10, z, 1, 12, 1)
  for (const y of [10, 19]) {
    g.clear(bx, y, bz, 1, 3, 6).clear(bx + 7, y, bz, 1, 3, 6)
    g.clear(bx, y, bz, 8, 3, 1).clear(bx, y, bz + 5, 8, 3, 1)
  }
  g.box(bx + 2, 16, bz + 5, 1, 3, 1, 'black').box(bx + 5, 16, bz + 5, 1, 3, 1, 'black')
  g.box(bx + 3, 13, bz + 5, 2, 3, 1, 'darkPink')
  g.box(bx + 1, 13, bz + 5, 1, 3, 1, 'pink').box(bx + 6, 13, bz + 5, 1, 3, 1, 'pink')
  for (const x of [bx + 1, bx + 5]) g.box(x, 22, bz + 2, 2, 9, 2, 'white').box(x, 23, bz + 3, 2, 6, 1, 'pink')

  // Smartphone (Curvatron started on mobile), back right: x 18..23, z 4..5.
  g.box(18, 1, 4, 6, 30, 2, 'mediumLavender')
  for (const x of [18, 23]) g.clear(x, 1, 4, 1, 1, 2).clear(x, 30, 4, 1, 1, 2)
  g.sprite(19, 4, 5, [
    '....',
    'cccc',
    '...c',
    'cc.c',
    'c..c',
    'cccc',
    '....',
    '.p..',
  ], { '.': 'black', c: 'glowCyan', p: 'glowPink' })
  g.box(20, 2, 5, 2, 1, 1, 'white')

  // The curve escapes the cabinet and runs across the floor to the phone.
  g.box(9, 0, 10, 1, 1, 6, 'glowCyan')
  g.box(9, 0, 15, 8, 1, 1, 'glowCyan')
  g.box(16, 0, 9, 1, 1, 6, 'glowCyan')
  g.box(16, 0, 9, 5, 1, 1, 'glowCyan')
  g.box(20, 0, 6, 1, 1, 3, 'glowCyan')

  // Trophy, front left.
  g.box(3, 1, 17, 5, 3, 5, 'mediumNougat')
  g.box(4, 4, 18, 3, 3, 3, 'yellow')
  g.box(5, 7, 19, 1, 3, 1, 'yellow')
  g.box(4, 10, 18, 3, 3, 3, 'yellow')
  g.box(3, 13, 17, 5, 6, 5, 'yellow').clear(4, 15, 18, 3, 4, 3)
  for (const x of [1, 9]) g.box(x, 13, 19, 1, 5, 1, 'yellow')
  for (const x of [2, 8]) g.set(x, 13, 19, 'yellow').set(x, 17, 19, 'yellow')

  // Pizza slice, front centre.
  g.sprite(10, 1, 19, [
    'CCCCCCC',
    'YYYYYYY',
    '.YYYYY.',
    '.YYYYY.',
    '..YYY..',
    '..YYY..',
    '...Y...',
  ], { C: 'nougat', Y: 'yellow' }, { plane: 'xz', depth: 2 })
  g.box(10, 3, 19, 7, 1, 1, 'nougat')
  for (const [x, z] of [[11, 20], [14, 21], [12, 22], [13, 24]]) g.set(x, 3, z, 'red')

  // A potted plant in the back corner.
  g.ball(2.5, 11, 3.5, 2.3, 'brightGreen')
  g.box(1, 1, 2, 3, 4, 3, 'coral')

  return g
}
