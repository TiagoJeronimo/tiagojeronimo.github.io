// Voxel models: a grid you draw into, and everything that turns it into the cubes on screen.
// A model is drawn coarse: x and z in studs, y in plates (3 plates = 1 stud). +x is right, +y is up, +z is the front.
// `assemble` then refines it 3x in x and z, so every cell becomes a perfect cube a third of a stud across.
// No imports on purpose: this file runs in the browser and in plain `node`.

/** Height of one plate in studs. Also the edge of one refined voxel. */
export const PLATE = 1 / 3

// A warm pastel palette. Names starting with `trans` render see-through, names starting with `glow` render emissive.
export const PALETTE = {
  white: 0xfffaf0,
  lightGray: 0xe2ddd6,
  darkGray: 0x9a95a3,
  black: 0x4a4458,
  red: 0xee6a62,
  darkRed: 0xc9545a,
  coral: 0xff9a85,
  orange: 0xffa552,
  darkOrange: 0xe58a5c,
  yellow: 0xffd45c,
  lightYellow: 0xffecaa,
  lime: 0xbfe36a,
  brightGreen: 0x8fd16b,
  green: 0x67bd72,
  darkGreen: 0x449a6a,
  sandGreen: 0xb5e0c4,
  olive: 0xb8ba6e,
  teal: 0x52c7ba,
  azure: 0x5cbcf0,
  lightBlue: 0xc0e4ff,
  mediumBlue: 0x86b6f5,
  blue: 0x5d8ff0,
  darkBlue: 0x4e5fa3,
  sandBlue: 0x8fa6d1,
  lavender: 0xe9dcfb,
  mediumLavender: 0xc4a4f0,
  purple: 0x9b78dc,
  magenta: 0xd470bd,
  pink: 0xffc2d9,
  darkPink: 0xf78bb5,
  lightNougat: 0xffddc0,
  nougat: 0xf0b088,
  mediumNougat: 0xcf9668,
  tan: 0xf3deb0,
  darkTan: 0xc7b28a,
  brown: 0x8f6044,
  transClear: 0xffffff,
  transLightBlue: 0xc8f1ff,
  transBlue: 0x7fb2ff,
  transGreen: 0xa8f0a0,
  transYellow: 0xffe680,
  transOrange: 0xffb870,
  transRed: 0xff8a80,
  transPink: 0xffb0dc,
  glowWhite: 0xffffff,
  glowYellow: 0xffe27a,
  glowOrange: 0xffab5c,
  glowPink: 0xff8cc8,
  glowCyan: 0x7ae8ff,
  glowBlue: 0x7aa2ff,
  glowGreen: 0x8cffa8,
  glowRed: 0xff7a70,
} as const

export type ColorName = keyof typeof PALETTE
export const COLORS = Object.keys(PALETTE) as ColorName[]

const ID = Object.fromEntries(COLORS.map((c, i) => [c, i + 1])) as Record<ColorName, number>
const SEE_THROUGH = COLORS.map((c) => c.startsWith('trans'))

/** A sprite legend: character -> colour (null carves the cell, unknown characters are skipped). */
export type Legend = Record<string, ColorName | null>

export class Grid {
  sx: number
  sy: number
  sz: number
  /** 0 = empty, otherwise the index into COLORS plus one. */
  cells: Uint8Array
  /** Height of one y step measured in x steps: 1/3 for a model drawn in studs and plates, 1 once refined into cubes. */
  aspect: number
  /** Added to every y that is written, so detail code can keep y = 0 at ground level with a slab underneath. */
  oy = 0

  constructor(sx: number, sy: number, sz: number, aspect = PLATE) {
    this.sx = sx
    this.sy = sy
    this.sz = sz
    this.aspect = aspect
    this.cells = new Uint8Array(sx * sy * sz)
  }

  /** One cell. `color: null` empties it. Out-of-range writes are ignored. */
  set(x: number, y: number, z: number, color: ColorName | null): this {
    if (color && !ID[color]) throw new Error(`unknown colour "${color}"`)
    y += this.oy
    if (x < 0 || y < 0 || z < 0 || x >= this.sx || y >= this.sy || z >= this.sz) return this
    this.cells[x + this.sx * (z + this.sz * y)] = color ? ID[color] : 0
    return this
  }

  /** Solid box from the min corner (x, y, z): w wide, h tall, d deep. */
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: ColorName | null): this {
    for (let k = 0; k < h; k++)
      for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) this.set(x + i, y + k, z + j, color)
    return this
  }

  /** Carve a box out. */
  clear(x: number, y: number, z: number, w: number, h: number, d: number): this {
    return this.box(x, y, z, w, h, d, null)
  }

  /** Vertical cylinder. (cx, cz) is the centre and may be fractional, e.g. 4.5 for an even diameter. */
  cyl(cx: number, y: number, cz: number, r: number, h: number, color: ColorName | null): this {
    for (let z = Math.floor(cz - r); z <= cz + r; z++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++)
        if ((x + 0.5 - cx) ** 2 + (z + 0.5 - cz) ** 2 <= r * r) for (let k = 0; k < h; k++) this.set(x, y + k, z, color)
    return this
  }

  /** Ball of radius r, measured in x steps. cy is a y like every other. */
  ball(cx: number, cy: number, cz: number, r: number, color: ColorName | null): this {
    const ry = Math.ceil(r / this.aspect)
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let z = Math.floor(cz - r); z <= cz + r; z++)
        for (let x = Math.floor(cx - r); x <= cx + r; x++)
          if ((x + 0.5 - cx) ** 2 + ((y + 0.5 - cy) * this.aspect) ** 2 + (z + 0.5 - cz) ** 2 <= r * r)
            this.set(x, y, z, color)
    return this
  }

  /** Procedural fill: fn returns a colour, null to carve, or undefined to leave the cell alone. */
  each(
    x: number, y: number, z: number, w: number, h: number, d: number,
    fn: (x: number, y: number, z: number) => ColorName | null | undefined,
  ): this {
    for (let k = y; k < y + h; k++)
      for (let j = z; j < z + d; j++)
        for (let i = x; i < x + w; i++) {
          const c = fn(i, k, j)
          if (c !== undefined) this.set(i, k, j, c)
        }
    return this
  }

  /**
   * Extruded pixel art. (x, y, z) is the min corner of the sprite.
   * plane 'xy': faces the front. rows[0] is the TOP row, columns run along +x, extruded `depth` along +z.
   * plane 'zy': faces the side.  rows[0] is the TOP row, columns run along +z, extruded `depth` along +x.
   * plane 'xz': lies flat.       rows[0] is the BACK row (min z), columns run along +x, `depth` thick.
   * `px` is the height of one pixel for the two upright planes. By default pixels are square.
   */
  sprite(
    x: number, y: number, z: number, rows: string[], legend: Legend,
    opts: { plane?: 'xy' | 'zy' | 'xz'; depth?: number; px?: number } = {},
  ): this {
    const { plane = 'xy', depth = 1, px = Math.round(1 / this.aspect) } = opts
    rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const color = legend[row[c]]
        if (color === undefined) continue
        if (plane === 'xz') this.box(x + c, y, z + r, 1, depth, 1, color)
        else {
          const up = y + (rows.length - 1 - r) * px
          if (plane === 'xy') this.box(x + c, up, z, 1, px, depth, color)
          else this.box(x, up, z + c, depth, px, 1, color)
        }
      }
    })
    return this
  }
}

// --- from a drawn model to a finished diorama ---------------------------------------------------

/** What a file in src/sets exports: the coarse model, and optionally its tiny details. */
export interface Model {
  /** Drawn in studs and plates. */
  default: () => Grid
  /**
   * Drawn on the refined grid, in voxels: x and z are 3x the coarse ones, y is the same, and y = 0 is still
   * the ground layer (the slab is below it, at negative y).
   */
  detail?: (g: Grid) => void
}

/** Voxels of slab under every model: two studs thick, like a slice cut out of a bigger world. */
export const SLAB = 6

/** Split every cell n x n in x and z. With n = 3 a studs-and-plates model becomes a grid of perfect cubes. */
function refine(g: Grid, n: number) {
  const out = new Grid(g.sx * n, g.sy, g.sz * n, g.aspect * n)
  for (let y = 0; y < g.sy; y++)
    for (let z = 0; z < g.sz; z++)
      for (let x = 0; x < g.sx; x++) {
        const c = g.cells[x + g.sx * (z + g.sz * y)]
        if (c) for (let j = 0; j < n; j++) out.cells.fill(c, x * n + out.sx * (z * n + j + out.sz * y), x * n + n + out.sx * (z * n + j + out.sz * y))
      }
  return out
}

const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]

/** Knock the hard edges off: a voxel on an outer edge or corner goes, as long as the shape is 3 or more thick there. */
function soften(g: Grid) {
  const { sx, sy, sz, cells } = g
  const at = (x: number, y: number, z: number) =>
    y < 0 ? 1 : x < 0 || z < 0 || x >= sx || y >= sy || z >= sz ? 0 : cells[x + sx * (z + sz * y)]
  const gone: number[] = []
  for (let y = 0; y < sy; y++)
    for (let z = 0; z < sz; z++)
      for (let x = 0; x < sx; x++) {
        if (!cells[x + sx * (z + sz * y)]) continue
        let open = 0
        let thick = true
        for (const [dx, dy, dz] of AXES) {
          const fore = at(x + dx, y + dy, z + dz)
          const back = at(x - dx, y - dy, z - dz)
          if (fore && back) continue
          open++
          const s = fore ? 2 : -2
          if ((!fore && !back) || !at(x + s * dx, y + s * dy, z + s * dz)) thick = false
        }
        if (open > 1 && thick) gone.push(x + sx * (z + sz * y))
      }
  for (const i of gone) cells[i] = 0
}

const GRASS: Partial<Record<ColorName, ColorName>> = {
  brightGreen: 'lime', green: 'brightGreen', lime: 'brightGreen', darkGreen: 'green', sandGreen: 'brightGreen',
}
const PETALS: ColorName[] = ['white', 'yellow', 'pink', 'mediumLavender', 'coral', 'white']

/** A repeatable random number in 0..1 for a spot on the ground, so a meadow looks the same on every visit. */
function noise(x: number, z: number) {
  let h = Math.imul(x, 374761393) + Math.imul(z, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Life at ground level: bushes, mushrooms, tufts and flowers on green ground, a few pebbles on pavement. */
function cover(g: Grid, ground: number) {
  const { sx, sz, cells } = g
  const at = (x: number, y: number, z: number) => (x < 0 || z < 0 || x >= sx || z >= sz ? 0 : cells[x + sx * (z + sz * y)])
  const lawn = (x: number, z: number) => GRASS[COLORS[at(x, ground, z) - 1]]
  // Open lawn: grass underfoot and nothing standing on it for a voxel around.
  const open = (x: number, z: number) => {
    for (let j = -2; j <= 2; j++)
      for (let i = -2; i <= 2; i++)
        if (!lawn(x + i, z + j) || at(x + i, ground + 1, z + j) || at(x + i, ground + 2, z + j) || at(x + i, ground + 3, z + j)) return false
    return true
  }

  // First the few bigger plants, where there is room for them.
  for (let z = 0; z < sz; z++)
    for (let x = 0; x < sx; x++) {
      const r = noise(x + 911, z + 577)
      if (r > 0.0042 || !open(x, z)) continue
      const petal = PETALS[Math.floor(r * 100000) % PETALS.length]
      if (r < 0.003) {
        // A round little bush with a few blossoms.
        g.box(x - 1, ground + 1, z - 1, 3, 2, 3, 'green').set(x, ground + 3, z, 'green')
        for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.set(x + i, ground + 2, z + j, null)
        g.set(x - 1, ground + 2, z, petal).set(x + 1, ground + 1, z + 1, petal).set(x, ground + 3, z, r < 0.0015 ? petal : 'brightGreen')
      } else {
        // A toadstool.
        g.set(x, ground + 1, z, 'white').box(x - 1, ground + 2, z - 1, 3, 1, 3, 'red').set(x, ground + 3, z, 'red')
        g.set(x - 1, ground + 2, z - 1, 'white').set(x + 1, ground + 2, z + 1, 'white')
      }
    }

  // Then tufts and single flowers everywhere else.
  for (let z = 0; z < sz; z++)
    for (let x = 0; x < sx; x++) {
      const c = at(x, ground, z)
      if (!c || at(x, ground + 1, z) || at(x, ground + 2, z)) continue
      const name = COLORS[c - 1]
      const r = noise(x, z)
      const tuft = GRASS[name]
      if (tuft) {
        if (r < 0.012) g.set(x, ground + 1, z, 'green').set(x, ground + 2, z, PETALS[Math.floor(r * 500)])
        else if (r < 0.36) g.set(x, ground + 1, z, r < 0.2 ? name : tuft)
        if (r > 0.3 && r < 0.36) g.set(x, ground + 2, z, tuft)
      } else if ((name === 'tan' || name === 'lightYellow') && r < 0.025) g.set(x, ground + 1, z, 'darkTan')
    }
}

/**
 * Everything between a model file and the screen: refine it into cubes, stand it on a slab, soften the edges,
 * add its hand-made details and some ground cover.
 * @param slab the two layers of the slab, bottom first, or null for a model that stands on another one
 * @param n how fine: 3 for cube voxels, 1 to keep the coarse model as drawn (for slow devices)
 */
export function assemble(model: Model, slab: [ColorName, ColorName] | null, n = 3): Grid {
  const fine = refine(model.default(), n)
  if (!slab && n === 1) return fine
  const g = new Grid(fine.sx, fine.sy + (slab ? SLAB : 0), fine.sz, fine.aspect)
  g.cells.set(fine.cells, slab ? fine.sx * fine.sz * SLAB : 0)
  if (slab)
    for (let z = 0; z < fine.sz; z++)
      for (let x = 0; x < fine.sx; x++)
        if (fine.cells[x + fine.sx * z]) g.box(x, 0, z, 1, SLAB / 2, 1, slab[0]).box(x, SLAB / 2, z, 1, SLAB / 2, 1, slab[1])
  if (n > 1) {
    soften(g)
    g.oy = slab ? SLAB : 0
    model.detail?.(g)
    g.oy = 0
    if (slab) cover(g, SLAB)
  }
  return g
}

// --- from a grid to the pieces that are drawn and simulated ----------------------------------------

/** One cube on screen. */
export interface Voxel {
  x: number
  y: number
  z: number
  color: ColorName
  /** Index of the chunk it belongs to. */
  chunk: number
}

/**
 * One stud-sized block of the grid. Voxels fly in one by one when a model builds;
 * under physics they move chunk by chunk, which keeps a smash to a couple of thousand bodies.
 */
export interface Chunk {
  /** Bounds of its filled cells: min corner and size, in cells. */
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
  /** Its voxels: a range into the voxel list. Empty when the whole chunk is buried. */
  start: number
  end: number
  /** Chunks it touches face to face: they hold each other up. */
  neighbors: number[]
  /** Sits on the floor. */
  grounded: boolean
}

/** List the voxels anyone can see, grouped into chunks. */
export function chunked(g: Grid): { voxels: Voxel[]; chunks: Chunk[] } {
  const { sx, sy, sz, cells } = g
  const n = Math.round(g.aspect / PLATE) // cells per stud in x and z; y is always 3 per stud
  const bx = Math.ceil(sx / n)
  const bz = Math.ceil(sz / n)
  const at = (x: number, y: number, z: number) =>
    x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz ? 0 : cells[x + sx * (z + sz * y)]
  // A see-through cell hides behind any filled neighbour of its own kind; an opaque one only behind opaque ones.
  const blocks = (v: number, see: boolean) => v !== 0 && (see || !SEE_THROUGH[v - 1])

  const ids = new Map<number, number>()
  const chunks: (Chunk & { hi: number[] })[] = []
  const found: Voxel[] = []
  const links: Set<number>[] = []
  const chunkAt = (x: number, y: number, z: number) => {
    const key = Math.floor(x / n) + bx * (Math.floor(z / n) + bz * Math.floor(y / 3))
    let id = ids.get(key)
    if (id === undefined) {
      ids.set(key, (id = chunks.length))
      chunks.push({ x, y, z, w: 0, h: 0, d: 0, start: 0, end: 0, neighbors: [], grounded: false, hi: [x, y, z] })
      links.push(new Set())
    }
    return id
  }

  for (let y = 0; y < sy; y++)
    for (let z = 0; z < sz; z++)
      for (let x = 0; x < sx; x++) {
        const c = cells[x + sx * (z + sz * y)]
        if (!c) continue
        const id = chunkAt(x, y, z)
        const chunk = chunks[id]
        chunk.x = Math.min(chunk.x, x)
        chunk.y = Math.min(chunk.y, y)
        chunk.z = Math.min(chunk.z, z)
        chunk.hi = [Math.max(chunk.hi[0], x), Math.max(chunk.hi[1], y), Math.max(chunk.hi[2], z)]
        if (y === 0) chunk.grounded = true
        for (const [dx, dy, dz] of AXES) {
          const next = at(x + dx, y + dy, z + dz)
          if (!next) continue
          const other = chunkAt(x + dx, y + dy, z + dz)
          if (other !== id) {
            links[id].add(other)
            links[other].add(id)
          }
        }
        const see = SEE_THROUGH[c - 1]
        const buried =
          blocks(at(x - 1, y, z), see) && blocks(at(x + 1, y, z), see) && (y === 0 || blocks(at(x, y - 1, z), see)) &&
          blocks(at(x, y + 1, z), see) && blocks(at(x, y, z - 1), see) && blocks(at(x, y, z + 1), see)
        if (!buried) found.push({ x, y, z, color: COLORS[c - 1], chunk: id })
      }

  found.sort((a, b) => a.chunk - b.chunk)
  found.forEach((v, i) => {
    const chunk = chunks[v.chunk]
    if (chunk.end === 0) chunk.start = i
    chunk.end = i + 1
  })
  chunks.forEach((chunk, id) => {
    chunk.w = chunk.hi[0] - chunk.x + 1
    chunk.h = chunk.hi[1] - chunk.y + 1
    chunk.d = chunk.hi[2] - chunk.z + 1
    chunk.neighbors = [...links[id]]
  })
  return { voxels: found, chunks }
}
