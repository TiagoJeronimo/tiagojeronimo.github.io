// Run with `npm test`. Checks the logic everything else stands on: turning a drawn model into voxels and chunks.
import assert from 'node:assert/strict'
import { assemble, chunked, Grid, SLAB } from '../src/bricks/voxel.ts'

// A coarse model: ground, a solid box, a pane of glass in its front, one loose cube.
const draw = () => {
  const g = new Grid(9, 12, 7)
  return g.box(0, 0, 0, 9, 1, 7, 'green').box(1, 1, 1, 6, 9, 5, 'red').box(2, 4, 5, 3, 3, 1, 'transBlue').set(8, 1, 6, 'yellow')
}

// 1. Without refining, chunks are one stud wide and three plates tall, and the voxels are exactly the visible cells.
const coarse = draw()
const flat = chunked(coarse)
const cell = (x: number, y: number, z: number) => flat.voxels.find((v) => v.x === x && v.y === y && v.z === z)
assert.ok(cell(1, 1, 1), 'surface cells show')
assert.ok(!cell(3, 5, 3), 'buried cells do not')
assert.ok(cell(3, 5, 4), 'a cell behind glass shows')
assert.ok(cell(3, 5, 5), 'the glass itself shows')
assert.ok(!cell(3, 0, 3), 'ground under the box is hidden')
for (const chunk of flat.chunks) {
  assert.ok(chunk.w === 1 && chunk.d === 1 && chunk.h <= 3, 'a coarse chunk is one stud wide and at most three plates tall')
  for (const v of flat.voxels.slice(chunk.start, chunk.end))
    assert.ok(v.x === chunk.x && v.z === chunk.z && v.y >= chunk.y && v.y < chunk.y + chunk.h, 'voxels lie inside their chunk')
}
assert.equal(flat.chunks.reduce((n, c) => n + (c.end - c.start), 0), flat.voxels.length, 'every voxel belongs to one chunk')

// 2. Chunks that touch are linked both ways, and only the bottom layer is grounded.
flat.chunks.forEach((chunk, i) => {
  for (const other of chunk.neighbors) assert.ok(flat.chunks[other].neighbors.includes(i), 'links go both ways')
  assert.equal(chunk.grounded, chunk.y === 0, 'only chunks on the floor are grounded')
})
const loose = flat.chunks.find((c) => c.x === 8 && c.z === 6 && c.y === 0)!
assert.ok(loose.h === 2, 'the ground plate and the cube on it share a chunk')

// 3. Assembling refines 3x into cubes, adds the slab, softens edges and runs the detail pass at ground level.
const fine = assemble({ default: draw, detail: (g) => void g.set(0, 3, 0, 'pink') }, ['brown', 'tan'])
assert.deepEqual([fine.sx, fine.sy, fine.sz, fine.aspect], [27, 12 + SLAB, 21, 1], 'three times finer in x and z, on a slab')
const name = (x: number, y: number, z: number) => fine.cells[x + fine.sx * (z + fine.sz * y)]
assert.ok(name(4, 0, 4) && name(4, SLAB - 1, 4), 'the slab fills the space under the ground')
assert.ok(name(0, SLAB + 3, 0), 'detail is drawn with y = 0 at the ground')
assert.ok(!name(3, SLAB + 9, 3), 'the top corner of the box is knocked off')
assert.ok(name(6, SLAB + 9, 6), 'the middle of its top is not')
assert.ok(!name(0, SLAB, 0), 'so is the corner of the base')
const cubes = chunked(fine)
for (const chunk of cubes.chunks) assert.ok(chunk.w <= 3 && chunk.h <= 3 && chunk.d <= 3, 'a fine chunk is at most one stud each way')

// 4. The coarse fallback keeps the model as drawn, on its slab.
const plain = assemble({ default: draw }, ['brown', 'tan'], 1)
assert.deepEqual([plain.sx, plain.sy, plain.sz], [9, 12 + SLAB, 7])

console.log('voxel: ok')
