// Twenty made-up sheep: the crowd the tests fill a field with (play, chases, leaps, company), and that the page puts
// in the field in development only, at `/games/sheep/?crowd`, to be watched. It is never in what is published.
import type { Entry } from './flock.ts'

export const CROWD: Entry[] = [
  { id: 1, seed: 101, name: 'Biscuit', message: 'For the long walk to the river.', date: '2026-03-02' },
  { id: 2, seed: 102, name: 'Mrs Pemberton', message: 'Do not let her near the tree.', date: '2026-03-09', look: { wear: 'hat' } },
  { id: 3, seed: 103, name: 'Nimbus', message: 'Thank you for the little games.', date: '2026-03-15' },
  { id: 4, seed: 104, name: 'a sheep', message: 'Baa.', date: '2026-03-21' },
  { id: 5, seed: 105, name: 'Dot', message: 'Small gift, small sheep, same wool.', date: '2026-04-01', look: { wear: 'flowers' } },
  { id: 6, seed: 106, name: 'Gerald', message: 'He asked to be put by the water.', date: '2026-04-04', look: { wear: 'scarf' } },
  { id: 7, seed: 107, name: 'Marshmallow', message: 'Eat the good grass first.', date: '2026-04-11' },
  { id: 8, seed: 108, name: 'Ines', message: 'From Lisbon, with grass.', date: '2026-04-19' },
  { id: 9, seed: 109, name: 'Tuesday', message: 'Born on a Wednesday, so it is a long story.', date: '2026-04-27' },
  { id: 10, seed: 110, name: 'Cloud', message: 'Keep it fluffy.', date: '2026-05-03', look: { wool: 0 } },
  { id: 11, seed: 111, name: 'Professor Wool', message: 'Has opinions on the hill.', date: '2026-05-10' },
  { id: 12, seed: 112, name: 'Pip', message: 'Found your site, stayed for the sheep.', date: '2026-05-18' },
  { id: 13, seed: 113, name: 'a sheep', message: 'Thanks for the castle.', date: '2026-05-25' },
  { id: 14, seed: 114, name: 'Custard', message: 'He is the yellow one. Probably.', date: '2026-06-02', look: { wool: 6 } },
  { id: 15, seed: 115, name: 'Olive', message: 'Go and have a nap, you.', date: '2026-06-14', look: { wool: 4, wear: 'scarf' } },
  { id: 16, seed: 116, name: 'Bartholomew', message: 'It took me three tries to spell him.', date: '2026-06-30' },
  { id: 17, seed: 117, name: 'Lint', message: 'Hello from a very small desk.', date: '2026-07-08' },
  { id: 18, seed: 118, name: 'Sir Baa-a-lot', message: 'Please knight him.', date: '2026-07-21', look: { wear: 'bell' } },
  { id: 19, seed: 119, name: 'Fern', message: 'For the island, mostly.', date: '2026-08-05', look: { wear: 'flowers' } },
  { id: 20, seed: 120, name: 'Mop', message: 'Wanders. Always wanders.', date: '2026-08-16' },
]
