// The one sheep that is in the field whoever else is: Claude the sheep, the test sheep, which nobody gave. It is
// always there, beside every sheep that was given, so the field is never empty. (Its number is 1: a given sheep's is
// 2^32 or more, so the two are never the same.) The seed decides how a sheep looks and what it is like (see
// `Sheep.ts`), but for what its `look` says: its wool and the one thing it wears (see `dress.ts`).
import type { Look } from './dress.ts'

export type Entry = { id: number; seed: number; name: string; message: string; date: string; look?: Look }

export const FLOCK: Entry[] = [{ id: 1, seed: 101, name: 'Claude the sheep', message: 'Test sheep. Walked a thousand simulated days before you came. Never once fed.', date: '2026-11-22', look: { wool: 0, wear: 'scarf' } }]

// The sheep in the cave at the back of the mountain. It is nobody's gift and none of the flock: it is there to be found.
// TODO(owner): its line is a placeholder until he writes the real one.
export const RECLUSE: Entry = { id: 0, seed: 7, name: 'A sheep in a cave', message: 'It will have something to say.', date: '', look: { wool: 0 } }
