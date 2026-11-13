import { Grid } from '../bricks/voxel.ts'

/** A little Tiago for the hero: big head, hoodie, his right arm raised in a wave. No ground: feet at y = 0. */
export default function build(): Grid {
  const g = new Grid(12, 45, 8)

  // Shoes, two short legs, hips.
  for (const x of [4, 8]) g.box(x, 0, 2, 2, 2, 5, 'white').box(x, 2, 2, 2, 3, 4, 'darkBlue')
  g.box(4, 5, 2, 6, 4, 4, 'darkBlue')

  // Hoodie, with a hood bump at the back, a little block on the chest and two drawstrings.
  g.box(4, 9, 2, 6, 12, 4, 'azure')
  g.box(4, 18, 1, 6, 3, 1, 'azure')
  g.box(6, 14, 5, 2, 3, 1, 'yellow')
  g.box(5, 18, 5, 1, 3, 1, 'white').box(8, 18, 5, 1, 3, 1, 'white')

  // His left arm hangs down (viewer's right).
  g.box(10, 13, 3, 2, 8, 2, 'azure').box(10, 10, 3, 2, 3, 2, 'lightNougat')
  // His right arm waves (viewer's left): out from the shoulder, then up beside the head.
  g.box(1, 17, 3, 3, 3, 2, 'azure')
  g.box(0, 20, 3, 2, 10, 2, 'azure').box(0, 30, 3, 2, 3, 2, 'lightNougat')

  // Head, then short brown hair: top, back, sides and a fringe that frames the face.
  g.box(3, 21, 1, 8, 18, 6, 'lightNougat')
  g.box(3, 39, 1, 8, 2, 6, 'brown').box(4, 41, 2, 6, 1, 4, 'brown')
  g.box(3, 27, 1, 8, 12, 1, 'brown')
  for (const x of [3, 10]) g.box(x, 27, 1, 1, 12, 3, 'brown').box(x, 33, 4, 1, 6, 3, 'brown')
  g.box(3, 36, 6, 8, 3, 1, 'brown')
  for (const x of [4, 9]) g.box(x, 33, 6, 1, 3, 1, 'brown')
  // Soft corners.
  for (const x of [3, 10]) for (const z of [1, 6]) g.clear(x, 21, z, 1, 21, 1)

  // Face: eyes, rosy cheeks, a small smile.
  g.box(5, 30, 6, 1, 3, 1, 'black').box(8, 30, 6, 1, 3, 1, 'black')
  g.box(4, 27, 6, 1, 3, 1, 'pink').box(9, 27, 6, 1, 3, 1, 'pink')
  g.box(6, 25, 6, 2, 1, 1, 'black').set(5, 26, 6, 'black').set(8, 26, 6, 'black')

  return g
}

/**
 * His things, in voxels: a coffee in his free hand, headphones round his neck, a backpack,
 * a small robot waving along at his feet, and a face with a little more life in it.
 */
export function detail(g: Grid): void {
  // Face: a sparkle in each eye, ears, a fringe swept to one side and a tuft on top.
  for (const x of [15, 24]) g.set(x, 32, 20, 'white')
  for (const x of [8, 33]) g.box(x, 28, 12, 1, 4, 3, 'lightNougat')
  g.box(15, 35, 20, 5, 1, 1, 'brown').box(15, 34, 20, 3, 1, 1, 'brown').box(24, 35, 20, 3, 1, 1, 'brown')
  g.box(19, 42, 10, 4, 1, 3, 'brown').box(20, 43, 11, 2, 1, 1, 'brown')

  // Fingers on the waving hand.
  g.box(0, 30, 10, 6, 3, 4, 'lightNougat')
  for (const [x, h] of [[0, 2], [2, 3], [4, 2]]) g.box(x, 33, 10, 1, h, 4, 'lightNougat')
  g.box(6, 31, 11, 1, 1, 2, 'lightNougat')

  // Hoodie: thin drawstrings, two studs on the chest brick, rolled-up jeans and soles.
  for (const x of [15, 24]) g.box(x, 18, 15, 3, 3, 3, 'azure')
  for (const x of [17, 24]) g.box(x, 14, 17, 1, 6, 1, 'white').set(x, 13, 17, 'lightGray')
  g.set(19, 17, 17, 'yellow').set(22, 17, 17, 'yellow')
  for (const x of [12, 24]) g.box(x, 2, 6, 6, 1, 12, 'sandBlue').box(x, 0, 6, 6, 1, 15, 'lightGray')

  // Headphones resting round his neck.
  for (const x of [13, 26]) g.box(x, 17, 18, 3, 3, 2, 'black').set(x + 1, 18, 19, 'coral').box(x + 1, 20, 16, 1, 1, 2, 'black')

  // Backpack, with a front pocket and straps over the shoulders.
  g.box(14, 9, 2, 14, 9, 4, 'orange').box(16, 10, 1, 10, 5, 1, 'darkOrange').box(16, 15, 1, 10, 1, 1, 'lightYellow')
  for (const x of [14, 27]) g.box(x, 9, 2, 1, 9, 1, null).box(x, 10, 17, 1, 7, 1, 'darkOrange')
  g.box(14, 17, 2, 14, 1, 1, null)

  // His free arm bends forward to hold a coffee.
  g.clear(30, 10, 9, 6, 11, 6)
  g.box(30, 14, 9, 5, 7, 6, 'azure').box(30, 13, 13, 5, 4, 7, 'azure').box(30, 13, 20, 5, 4, 2, 'lightNougat')
  g.box(31, 15, 20, 3, 5, 3, 'white').box(31, 16, 20, 3, 2, 3, 'mediumNougat').box(31, 19, 20, 3, 1, 3, 'brown')

  // A little robot, waving too.
  for (const x of [2, 5]) g.box(x, 0, 15, 2, 2, 4, 'darkGray')
  g.box(2, 2, 15, 5, 4, 3, 'lightGray').set(4, 4, 17, 'coral').box(3, 6, 15, 3, 1, 3, 'darkGray')
  g.box(1, 7, 14, 7, 5, 5, 'white').box(2, 8, 18, 5, 3, 1, 'black').set(3, 9, 18, 'glowCyan').set(5, 9, 18, 'glowCyan')
  g.box(4, 12, 16, 1, 1, 1, 'darkGray').set(4, 13, 16, 'glowRed')
  g.box(7, 3, 16, 1, 3, 1, 'darkGray').set(1, 5, 16, 'darkGray').box(0, 5, 16, 1, 4, 1, 'darkGray')
}
