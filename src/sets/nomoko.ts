import { Grid, type ColorName } from '../bricks/voxel.ts'

/** Nomoko, 2020-2022: a city block on a map (left) and its airy digital twin (right), with a map pin on the seam. */
export default function build(): Grid {
  const g = new Grid(28, 72, 28)

  // Ground. Left: the map (cream land, grey streets, a river down the outer edge).
  g.each(0, 0, 0, 14, 1, 28, (x, _y, z) => {
    if (x < 3) return 'azure'
    return x === 8 || z === 7 || z === 8 || z === 15 || z === 16 || z >= 24 ? 'lightGray' : 'white'
  })
  // Right: the twin's ground, pale blue with a glowing line down every street.
  g.each(14, 0, 0, 14, 1, 28, (x, _y, z) => {
    if (x > 24) return 'mediumBlue'
    return x === 14 || x === 19 || z === 7 || z === 15 || z === 24 ? 'glowCyan' : 'lightBlue'
  })

  // A real building: cube courses of wall (a hollow ring) and glass, wall on top.
  const solid = (x: number, z: number, w: number, d: number, pairs: number, wall: ColorName) => {
    for (let f = 0; f <= pairs; f++) {
      g.box(x, 1 + f * 6, z, w, 3, d, wall)
      if (f < pairs) g.clear(x + 1, 1 + f * 6, z + 1, w - 2, 3, d - 2).box(x, 4 + f * 6, z, w, 3, d, 'transLightBlue')
    }
  }
  // Its twin: the same volume in see-through blue, with a glowing line at every floor and around the top.
  const twin = (x: number, z: number, w: number, d: number, pairs: number, ghost: ColorName) => {
    const top = pairs * 6 + 3
    for (let f = 0; f <= pairs; f++) {
      g.box(x, 1 + f * 6, z, w, 3, d, ghost)
      if (f < pairs) g.box(x, 4 + f * 6, z, w, 2, d, 'transLightBlue').box(x, 6 + f * 6, z, w, 1, d, 'glowCyan')
    }
    g.box(x, top, z, w, 1, d, 'glowCyan')
  }

  // The city, and each building mirrored about the seam at x = 14.
  const city: [number, number, number, number, number, ColorName, ColorName][] = [
    [4, 2, 4, 4, 5, 'white', 'transClear'],
    [9, 1, 4, 6, 3, 'lavender', 'transBlue'],
    [4, 10, 4, 4, 2, 'sandBlue', 'transBlue'],
    [4, 18, 4, 5, 1, 'tan', 'transClear'],
  ]
  for (const [x, z, w, d, pairs, wall, ghost] of city) {
    solid(x, z, w, d, pairs, wall)
    twin(28 - x - w, z, w, d, pairs, ghost)
  }

  // Rooftops: plant room and a beacon on the tower, a roof garden, a pitched roof and a door on the little house.
  g.box(5, 34, 3, 2, 3, 2, 'lightGray').box(5, 37, 3, 1, 6, 1, 'darkGray').box(5, 43, 3, 1, 3, 1, 'glowRed')
  g.box(21, 34, 3, 2, 3, 2, 'transLightBlue').box(22, 37, 3, 1, 9, 1, 'glowCyan')
  g.box(10, 22, 3, 2, 3, 2, 'green')
  g.box(16, 22, 3, 2, 3, 2, 'transGreen')
  g.box(4, 10, 18, 4, 3, 5, 'darkOrange').box(5, 13, 19, 2, 3, 3, 'darkOrange').box(5, 1, 22, 1, 3, 1, 'darkOrange')
  g.box(20, 10, 18, 4, 3, 5, 'transClear').box(21, 13, 19, 2, 2, 3, 'transClear').box(21, 15, 19, 2, 1, 3, 'glowCyan')

  // Park with two trees, and its outline in the twin.
  g.box(9, 0, 9, 4, 1, 6, 'sandGreen')
  g.box(10, 1, 10, 1, 3, 1, 'brown').box(9, 4, 9, 3, 6, 3, 'green').box(10, 10, 10, 1, 3, 1, 'green')
  g.box(11, 1, 13, 1, 3, 1, 'brown').box(11, 4, 13, 1, 6, 1, 'green')
  g.each(15, 0, 9, 4, 1, 6, (x, _y, z) => (x === 15 || x === 18 || z === 9 || z === 14 ? 'glowGreen' : undefined))
  g.box(17, 1, 10, 1, 3, 1, 'glowCyan').box(16, 4, 9, 3, 6, 3, 'transGreen').box(17, 10, 10, 1, 3, 1, 'transGreen')
  g.box(16, 1, 13, 1, 3, 1, 'glowCyan').box(16, 4, 13, 1, 6, 1, 'transGreen')

  // A little sailboat on the river, and its ghost.
  g.box(1, 1, 19, 1, 2, 3, 'coral').box(1, 3, 20, 1, 6, 1, 'white').box(1, 3, 21, 1, 3, 1, 'white')
  g.box(26, 1, 19, 1, 2, 3, 'transBlue').box(26, 3, 20, 1, 6, 1, 'transClear').box(26, 3, 21, 1, 3, 1, 'transClear')

  // A survey drone over the city, held up by its scan beam.
  g.box(5, 16, 11, 2, 9, 2, 'transLightBlue')
  g.box(5, 25, 11, 2, 3, 2, 'yellow').box(5, 26, 12, 2, 1, 1, 'black')
  for (const x of [4, 7]) g.box(x, 27, 10, 1, 1, 4, 'darkGray').set(x, 28, 10, 'white').set(x, 28, 13, 'white')

  // The map pin, standing on the seam: nine cube courses from the tip up to a round head, white dot on the front.
  ;[0.5, 0.5, 0.5, 4.5, 8.5, 8.5, 8.5, 4.5, 0.5].forEach((r2, i) =>
    g.each(11, 1 + i * 3, 20, 6, 3, 6, (x, _y, z) => ((x - 13.5) ** 2 + (z - 22.5) ** 2 <= r2 ? 'red' : undefined)),
  )
  g.box(13, 15, 25, 2, 6, 1, 'white')

  return g
}
