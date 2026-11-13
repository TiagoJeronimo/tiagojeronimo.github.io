import { Grid, type ColorName, type Legend } from '../bricks/voxel.ts'

// One letter per colour, shared by every sprite in detail().
const K: Legend = {
  w: 'white', l: 'lightGray', d: 'darkGray', k: 'black', r: 'red', R: 'darkRed', c: 'coral', o: 'orange', O: 'darkOrange',
  y: 'yellow', Y: 'lightYellow', m: 'lime', b: 'brightGreen', g: 'green', G: 'darkGreen', t: 'tan', T: 'darkTan',
  n: 'brown', N: 'nougat', M: 'mediumNougat', p: 'pink', P: 'darkPink', a: 'azure', B: 'blue', u: 'mediumBlue',
  U: 'lightBlue', v: 'mediumLavender', V: 'purple', e: 'teal', s: 'lightNougat', '*': 'glowYellow', _: null,
}

// 7 rows tall, strokes 2 studs wide so they can be built from 2xN bricks.
const FONT: Record<string, string[]> = {
  T: ['######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..'],
  I: ['##', '##', '##', '##', '##', '##', '##'],
  A: ['.####.', '##..##', '##..##', '######', '##..##', '##..##', '##..##'],
  G: ['.#####', '##....', '##....', '##.###', '##..##', '##..##', '.####.'],
  O: ['.####.', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
  S: ['.#####', '##....', '##....', '.####.', '....##', '....##', '#####.'],
  L: ['##....', '##....', '##....', '##....', '##....', '##....', '######'],
  V: ['##..##', '##..##', '##..##', '##..##', '##..##', '.####.', '..##..'],
}

function word(g: Grid, text: string, x: number, y: number, z: number, depth: number, colors: ColorName[]) {
  ;[...text].forEach((ch, i) => {
    g.sprite(x, y, z, FONT[ch], { '#': colors[i] }, { depth })
    x += FONT[ch][0].length + 1
  })
}

/** The hero: TIAGO standing on a plinth, SILVA in relief on its front. The right end is left free for the figure. */
export default function build(): Grid {
  const g = new Grid(46, 48, 16)
  g.box(0, 0, 0, 46, 1, 16, 'green')
  for (const x of [0, 45]) for (const z of [0, 15]) g.set(x, 0, z, null)
  g.box(1, 1, 3, 32, 24, 4, 'darkBlue')
  word(g, 'TIAGO', 2, 25, 4, 2, ['red', 'orange', 'yellow', 'lime', 'azure'])
  word(g, 'SILVA', 2, 1, 7, 3, ['mediumBlue', 'mediumLavender', 'darkPink', 'coral', 'yellow'])
  return g
}

/** A tulip seen from the front: stem, two leaves and a cup-shaped bloom. */
function tulip(g: Grid, x: number, z: number, color: ColorName) {
  g.box(x, 1, z, 1, 3, 1, 'green').set(x - 1, 1, z, 'brightGreen').set(x + 1, 2, z, 'brightGreen')
  g.sprite(x - 1, 4, z, ['#.#', '###', '.#.'], { '#': color })
}

/** A toadstool: white stem `h` tall and `w` wide (1 or 2), red cap with white dots. */
function toadstool(g: Grid, x: number, z: number, w: number, h: number) {
  const c = w / 2
  g.box(x, 1, z, w, h, w, 'white')
  g.cyl(x + c, h + 1, z + c, c + 2, 1, 'red').cyl(x + c, h + 2, z + c, c + 1.3, 1, 'red').cyl(x + c, h + 3, z + c, c + 0.3, 1, 'red')
  g.set(x, h + 3, z, 'white').set(x - 1, h + 2, z + w, 'white').set(x + w, h + 2, z - 1, 'white').set(x + w + 1, h + 1, z + w - 1, 'white')
}

/** A terracotta pot: three wide, three tall. Whatever grows in it starts at y = 4. */
function pot(g: Grid, x: number, z: number) {
  g.box(x, 1, z, 3, 2, 3, 'darkOrange').box(x, 3, z, 3, 1, 3, 'nougat').set(x + 1, 3, z + 1, 'brown')
}

/**
 * The garden around the sign, in voxels. From left to right along the front: a bird house and toadstools,
 * a pond cut open at the edge, a picnic, a dog with its ball, and a front door in the last A with its path.
 */
export function detail(g: Grid): void {
  // --- Pond: the water runs out to the front edge, so the slab shows it in section, with a fish in it.
  g.each(19, -6, 37, 22, 7, 11, (x, y, z) => {
    if (((x + 0.5 - 30) / 10) ** 2 + ((z + 0.5 - 45) / 7.5) ** 2 > 1) return undefined
    return y === 0 ? null : y === -6 ? 'tan' : 'transBlue'
  })
  g.sprite(27, -4, 47, ['O.oo.', '.ooko', 'O.oo.'], K)
  g.box(23, -5, 47, 1, 3, 1, 'green').box(24, -5, 47, 1, 2, 1, 'brightGreen').box(36, -5, 47, 1, 4, 1, 'green').box(35, -5, 47, 1, 2, 1, 'brightGreen')
  g.set(31, -5, 47, 'darkGray').set(32, -5, 47, 'lightGray').set(26, -5, 47, 'lightGray')
  g.sprite(32, -1, 45, ['Oowo'], K, { plane: 'xz' })
  // Lily pads, one with a lotus and one with a frog.
  g.sprite(23, 0, 41, ['ggg', 'gbg', 'gg.'], K, { plane: 'xz' }).sprite(23, 1, 41, ['.p.', 'pYp', '.p.'], K, { plane: 'xz' })
  g.sprite(34, 0, 43, ['.gg', 'gbg', 'gg.'], K, { plane: 'xz' }).box(34, 1, 43, 3, 1, 2, 'brightGreen').set(34, 2, 44, 'black').set(36, 2, 44, 'black')
  g.sprite(27, 0, 38, ['gg', 'g.'], K, { plane: 'xz' })
  // A duckling.
  g.box(28, 0, 40, 5, 2, 3, 'yellow').box(28, 2, 40, 2, 2, 3, 'yellow').set(27, 2, 41, 'orange').set(32, 2, 41, 'yellow')
  g.set(28, 3, 42, 'black').set(28, 3, 40, 'black').box(30, 1, 42, 2, 1, 1, 'lightYellow')
  // Reeds on the bank and a boulder.
  for (const [x, z, h, head] of [[22, 38, 6, 2], [24, 36, 5, 2], [21, 39, 3, 0], [20, 41, 4, 1]])
    g.box(x, 1, z, 1, h, 1, 'darkGreen').box(x, h + 1 - head, z, 1, head, 1, 'brown')
  g.ball(41.5, 1, 42, 2, 'lightGray').set(40, 1, 43, 'darkGray')

  // --- Picnic: a gingham blanket, a cat asleep on it, a basket and a cupcake.
  g.each(44, 1, 38, 13, 1, 9, (x, _, z) => (['white', 'coral', 'red'] as const)[+(x % 4 < 2) + +(z % 4 < 2)])
  g.box(45, 2, 38, 7, 2, 2, 'orange').box(48, 2, 40, 4, 2, 2, 'orange').box(45, 2, 40, 3, 2, 2, 'orange')
  for (const x of [45, 51]) g.set(x, 3, 38, null)
  for (const x of [47, 49, 51]) g.box(x, 3, 38, 1, 1, x === 47 ? 2 : 4, 'darkOrange')
  g.set(45, 4, 40, 'orange').set(47, 4, 40, 'orange').set(45, 3, 41, 'darkOrange').set(47, 3, 41, 'darkOrange')
  g.set(45, 2, 41, 'white').set(46, 2, 41, 'pink').set(47, 2, 41, 'white')
  g.box(52, 2, 40, 1, 1, 3, 'orange').box(49, 2, 42, 3, 1, 1, 'orange').set(48, 2, 42, 'white')
  g.each(52, 2, 43, 4, 3, 3, (x, y) => ((x + y) % 2 ? 'mediumNougat' : 'nougat'))
  g.set(52, 5, 44, 'brown').set(55, 5, 44, 'brown').box(52, 6, 44, 4, 1, 1, 'brown').set(53, 5, 44, 'red').set(54, 5, 44, 'yellow')
  g.box(46, 2, 44, 3, 1, 3, 'white').set(47, 3, 45, 'pink').set(47, 4, 45, 'red').set(50, 2, 45, 'red')

  // --- A front door in the last A, with a lit window, a doormat and stepping stones down to the edge.
  g.sprite(84, 1, 21, ['MMMMMM', 'MnnnnM', 'Mn**nM', 'Mn**nM', 'MnnnnM', 'MnnnyM', 'MnnnnM', 'MnnnnM', 'MnnnnM'], K, { depth: 7 })
  g.box(85, 1, 30, 4, 1, 2, 'coral')
  for (const [x, z] of [[85, 33], [87, 37], [84, 41], [86, 44]]) g.sprite(x, 1, z, ['.ll.', 'llll', '.ll.'], K, { plane: 'xz' })
  // Pots either side of the A: red flowers on the left with a watering can, a clipped ball on the right.
  pot(g, 75, 30)
  g.box(75, 4, 30, 3, 2, 3, 'green').set(75, 6, 32, 'red').set(77, 6, 30, 'red').set(76, 6, 31, 'green').set(76, 7, 31, 'red')
  pot(g, 96, 30)
  g.box(97, 4, 31, 1, 2, 1, 'brown').ball(97.5, 7.5, 31.5, 2, 'green').set(96, 8, 32, 'pink').set(98, 7, 32, 'pink')
  g.sprite(67, 1, 32, ['...eee.', 'e..e..e', 'ee.eeee', '.eeeee.', '...eee.'], K).box(70, 1, 31, 3, 3, 3, 'teal')
  // A mailbox with a heart, its flag up.
  g.box(98, 1, 42, 1, 6, 1, 'brown').box(96, 7, 41, 5, 3, 3, 'red').box(96, 10, 42, 5, 1, 1, 'red')
  g.sprite(97, 7, 43, ['w.w', 'www', '.w.'], K).box(101, 9, 42, 1, 3, 1, 'yellow').set(101, 11, 43, 'yellow')

  // --- Left end: a bird house on a post, toadstools and tulips.
  g.box(2, 1, 32, 1, 11, 1, 'brown').box(1, 12, 31, 3, 3, 3, 'lightYellow').set(2, 13, 33, 'black').set(2, 12, 34, 'brown')
  g.box(0, 15, 30, 5, 1, 5, 'red').box(1, 16, 30, 3, 1, 5, 'red').box(2, 17, 30, 1, 1, 5, 'red')
  toadstool(g, 12, 38, 2, 3)
  toadstool(g, 17, 43, 1, 2)
  toadstool(g, 10, 45, 1, 1)
  for (const [x, z, color] of [[4, 45, 'red'], [8, 43, 'yellow'], [2, 41, 'darkPink'], [6, 39, 'purple']] as const) tulip(g, x, z, color)

  // --- A dog waiting with its ball, and a lantern by the pond.
  g.sprite(68, 2, 42, ['.......www..', '.w.....wwww.', '.w.....wwww.', '.wwwwwwww...', '.wwwwwww....'], K, { depth: 3 })
  for (const z of [42, 44]) g.set(69, 1, z, 'white').set(75, 1, z, 'white').box(75, 4, z, 1, 2, 1, 'brown').set(76, 5, z, 'black')
  g.box(78, 4, 42, 1, 2, 1, null).box(78, 4, 44, 1, 2, 1, null).set(78, 5, 43, 'black').box(74, 3, 42, 1, 1, 3, 'red').box(71, 3, 42, 2, 1, 3, 'brown')
  g.box(81, 1, 43, 2, 2, 2, 'red')
  g.box(41, 1, 37, 1, 5, 1, 'black').box(40, 6, 36, 3, 1, 3, 'black').box(40, 9, 36, 3, 1, 3, 'black').set(41, 10, 37, 'black')
  g.each(40, 7, 36, 3, 2, 3, (x, _, z) => ((x + z) % 2 ? 'glowYellow' : x === 41 ? 'glowYellow' : 'black'))
}
