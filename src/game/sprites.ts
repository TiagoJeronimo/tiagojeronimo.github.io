import { shapeOf, type Kind } from './critters.ts'

// Small pictures for the map, in the manner of pixel art. The animals are drawn from the very boxes they are made of
// in the world, seen from the front, so a picture can never drift away from the animal. A handful of other things are
// drawn by hand: one character a pixel, a dot for nothing.

const SIDEWAYS = ['snail', 'fish', 'capybara']

const ART: Record<string, { rows: string[]; ink: Record<string, string> }> = {
  clover: {
    rows: ['.........', '..gg.gg..', '.gGGgGGg.', '.gGGgGGg.', '..ggsgg..', '.gGGgGGg.', '.gGGgGGg.', '..gg.gg..', '....s....'],
    ink: { g: '#3f8f52', G: '#67bd72', s: '#4f9a5a' },
  },
  well: {
    rows: ['.rrrrrrr.', '.rRRRRRr.', '..b...b..', '..b...b..', '.sssssss.', '.sWWWWWs.', '.sWWWWWs.', '.sssssss.', '.........'],
    ink: { r: '#d96f60', R: '#e9806f', b: '#8a6d58', s: '#b7b2ba', W: '#86cdf5' },
  },
  nest: {
    rows: ['.........', '...eee...', '..eEeee..', '..eeeee..', '.nneeenn.', 'nNnnnnnNn', '.nNNNNNn.', '..nnnnn..', '.........'],
    ink: { e: '#bfe0f5', E: '#eef8fd', n: '#8a6d58', N: '#b89572' },
  },
  castle: {
    rows: ['....pf...', '....pff..', '....p....', '.s.sss.s.', '.sssssss.', '.sSsSsSs.', '.sssssss.', '.sssdsss.', '.sssdsss.'],
    ink: { f: '#ff7a6b', p: '#8a6d58', s: '#ecd696', S: '#f8ecc0', d: '#c9a86a' },
  },
  chest: {
    rows: ['.........', '.wwwwwww.', 'wWWWWWWWw', 'wwwwgwwww', 'wbbbgbbbw', 'wbbbbbbbw', 'wbbbbbbbw', '.wwwwwww.', '.........'],
    ink: { w: '#8a6d58', W: '#9a7b62', b: '#b58f6c', g: '#ffd45c' },
  },
  bottle: {
    rows: ['....c....', '...ccc...', '...ggg...', '..gGggg..', '..gpppg..', '..gpppg..', '..gpppg..', '..ggggg..', '.........'],
    ink: { c: '#b8956a', g: '#8fd6b0', G: '#c4efdc', p: '#fff3df' },
  },
  heart: {
    rows: ['.........', '.hh...hh.', 'hHHh.hHHh', 'hHWHhHHHh', 'hHHHHHHHh', '.hHHHHHh.', '..hHHHh..', '...hHh...', '....h....'],
    ink: { h: '#f0719a', H: '#ff8fb0', W: '#ffd0de' },
  },
  notes: {
    rows: ['...ppppp.', '...p...p.', '...p...p.', '...p...p.', '.yyp.bbp.', 'yyyp.bbb.', 'yyy..bbb.', '.y....b..', '.........'],
    ink: { p: '#4a4458', y: '#ffd45c', b: '#86b6f5' },
  },
  snowman: {
    rows: ['...www...', '..wkwkw..', '..wwoww..', '...rrr...', 'b.wwwww.b', '.bwwkwwb.', '..wwwww..', '.wwwkwww.', '.wwwwwww.'],
    ink: { w: '#ffffff', k: '#3a3340', o: '#ffa23f', r: '#e9605a', b: '#8a6d58' },
  },
  compass: {
    rows: ['....r....', '...rrr...', '....r....', '....k....', 'k.kkkkk.k', '....k....', '....k....', '...kkk...', '....k....'],
    ink: { r: '#e0527f', k: '#4a4458' },
  },
  stamp: {
    rows: ['....s....', '...sss...', 'sssssssss', '.sssssss.', '..sssss..', '..sssss..', '.sss.sss.', '.ss...ss.', '.........'],
    ink: { s: '#e0527f' },
  },
}

/**
 * Draws a picture into a small square canvas.
 * @param what the name of a hand-drawn one, or an animal as "kind/colour" with the colour in hex
 * @param shade as a dark shape only: something not found yet
 */
export function draw(canvas: HTMLCanvasElement, what: string, shade = false) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const n = canvas.width
  ctx.clearRect(0, 0, n, n)
  const dark = 'rgba(63, 59, 78, 0.28)'
  const art = ART[what]
  if (art) {
    const cell = Math.floor(n / art.rows.length)
    const pad = Math.floor((n - cell * art.rows.length) / 2)
    art.rows.forEach((row, j) =>
      [...row].forEach((c, i) => {
        if (c === '.') return
        ctx.fillStyle = shade ? dark : art.ink[c]
        ctx.fillRect(pad + i * cell, pad + j * cell, cell, cell)
      }),
    )
    return
  }
  const [kind, hex] = what.split('/')
  // Most are best seen from the front. A few have their shape along their length: those are seen from the side.
  boxed(ctx, n, shapeOf(kind as Kind, parseInt(hex ?? 'ffffff', 16)).map((part) => (SIDEWAYS.includes(kind) ? [part[2], part[1], part[0], part[5], part[4], part[3], part[6]] : part)), shade)
}

/**
 * Draws a thing into a small square canvas from the boxes it is made of in the world, seen from the front:
 * [x, y, z, wide, high, deep, colour] each. The log on the map uses it for whatever a line is about.
 */
export function sketch(canvas: HTMLCanvasElement, boxes: number[][]) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.width)
  boxed(ctx, canvas.width, boxes, false)
}

function boxed(ctx: CanvasRenderingContext2D, n: number, parts: number[][], shade: boolean) {
  const dark = 'rgba(63, 59, 78, 0.28)'
  const lows = parts.map(([x, y, , wide, high]) => [x - wide / 2, y - high / 2, x + wide / 2, y + high / 2])
  const [x0, y0, x1, y1] = [Math.min(...lows.map((b) => b[0])), Math.min(...lows.map((b) => b[1])), Math.max(...lows.map((b) => b[2])), Math.max(...lows.map((b) => b[3]))]
  const scale = (n - 2) / Math.max(x1 - x0, y1 - y0)
  const left = (n - (x1 - x0) * scale) / 2
  const foot = n - 1 - (n - 2 - (y1 - y0) * scale) / 2
  // From the back to the front, so that what is nearer is drawn over what is behind it.
  for (const [x, y, , wide, high, , color] of [...parts].sort((a, b) => a[2] + a[5] / 2 - (b[2] + b[5] / 2))) {
    const px = Math.round(left + (x - wide / 2 - x0) * scale)
    const py = Math.round(foot - (y + high / 2 - y0) * scale)
    const pw = Math.max(1, Math.round(wide * scale))
    const ph = Math.max(1, Math.round(high * scale))
    ctx.fillStyle = shade ? dark : `#${color.toString(16).padStart(6, '0')}`
    ctx.fillRect(px, py, pw, ph)
    if (shade || ph < 3) continue
    // A lighter top edge and a darker foot give each box a little body.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)'
    ctx.fillRect(px, py, pw, 1)
    ctx.fillStyle = 'rgba(40, 30, 60, 0.14)'
    ctx.fillRect(px, py + ph - 1, pw, 1)
  }
}
