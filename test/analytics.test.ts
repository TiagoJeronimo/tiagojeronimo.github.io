import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers/promises'
import { createAnalytics, isPostHogEnabled } from '../src/posthog.ts'
import { gameEvents } from '../src/games/tracking.ts'

// A slow or blocked analytics download must not lose early clicks or reject into the app.
const calls: string[] = []
const loaded = Promise.withResolvers<{
  capture(event: string): void
  logger: { info(message: string): void }
}>()
const analytics = createAnalytics(() => loaded.promise)
analytics.capture('first click')
analytics.info('first log')
assert.deepEqual(calls, [])
loaded.resolve({ capture: (event) => { calls.push(event) }, logger: { info: (message) => { calls.push(message) } } })
await setImmediate()
analytics.capture('later click')
await setImmediate()
assert.deepEqual(calls, ['first click', 'first log', 'later click'])

assert.equal(isPostHogEnabled, false, 'node has no Vite configuration; importing analytics must remain safe')
createAnalytics().capture('disabled')
createAnalytics(() => { throw new Error('download blocked') }).capture('blocked')
createAnalytics(async () => ({ capture: () => { throw new Error('capture failed') }, logger: { info() {} } })).capture('failed')
await setImmediate()

// First-time and resumed games each report their first playable snapshot and finish only once.
type State = { done: boolean; knocks: number }
const events: string[] = []
const observe = () => gameEvents<State>(
  (state) => state.done,
  (state) => events.push(state.knocks ? 'resumed' : 'started'),
  () => events.push('completed'),
)
const first = observe()
first({ done: false, knocks: 0 })
first({ done: false, knocks: 1 })
first({ done: true, knocks: 27 })
first({ done: true, knocks: 28 })
first({ done: false, knocks: 28 })
first({ done: true, knocks: 28 })
assert.deepEqual(events, ['started', 'completed'])

const resumed = observe()
resumed({ done: false, knocks: 12 })
resumed({ done: true, knocks: 27 })
const saved = observe()
saved({ done: true, knocks: 27 })
saved({ done: true, knocks: 28 })
saved({ done: false, knocks: 28 })
saved({ done: true, knocks: 28 })
assert.deepEqual(events, ['started', 'completed', 'resumed', 'completed'])

const endings: string[] = []
for (const ending of ['wedding', 'castle', 'camp']) {
  const day = gameEvents<string>(Boolean, () => endings.push('started'), (over) => endings.push(over))
  day('')
  day(ending)
  day(ending)
}
assert.deepEqual(endings, ['started', 'wedding', 'started', 'castle', 'started', 'camp'])
console.log('analytics: ok')
