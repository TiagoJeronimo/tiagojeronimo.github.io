import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers/promises'
import { createAnalytics, isPostHogEnabled } from '../src/posthog.ts'
import { gameEvents, gameVisit, milestones } from '../src/games/tracking.ts'
import { linkProperties } from '../src/analytics.ts'

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
assert.deepEqual(calls, ['first click', 'first log', 'later click'], 'a loaded SDK receives navigation events synchronously')
const options: unknown[] = []
const navigation = createAnalytics(async () => ({ capture: (_event, _properties, config) => { options.push(config) }, logger: { info() {} } }))
await setImmediate()
navigation.capture('leaving', {}, { send_instantly: true, transport: 'sendBeacon' })
assert.deepEqual(options, [{ send_instantly: true, transport: 'sendBeacon' }])

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
const reached: number[] = []
const progress = milestones([25, 50, 75, 100], (step) => reached.push(step))
for (const value of [0, 24, 51, 30, 76, 100, 100]) progress(value)
assert.deepEqual(reached, [25, 50, 75, 100])
const restored = milestones([25, 50, 75, 100], (step) => reached.push(step))
for (const value of [62, 70, 80]) restored(value)
assert.deepEqual(reached, [25, 50, 75, 100, 75], 'resuming skips milestones earned before this visit')
const sequence: string[] = []
const stages = milestones([25, 50, 75, 100], (step) => sequence.push(String(step)))
const fastFinish = gameEvents<{ done: boolean; percent: number }>(
  (state) => state.done, () => sequence.push('start'), () => sequence.push('complete'), (state) => stages(state.percent),
)
fastFinish({ done: false, percent: 0 })
fastFinish({ done: true, percent: 100 })
assert.deepEqual(sequence, ['start', '25', '50', '75', '100', 'complete'], 'same-frame milestones must precede completion for ordered funnels')

let time = 0
const visits: Record<string, string | number | boolean>[] = []
const visit = gameVisit('island', (_event, properties) => visits.push(properties), () => time)
visit.active(true)
time = 2000
visit.active(false)
time = 62000
visit.active(true)
time = 65000
visit.active(false)
visit.capture('completed')
time = 100000
visit.capture('postcard')
assert.equal(visits[0].active_seconds, 5, 'time spent in a hidden tab is excluded')
assert.equal(visits[1].active_seconds, 5, 'time after completion is excluded')
assert.equal(visits[0].play_id, visits[1].play_id)
const another = gameVisit('island', (_event, properties) => visits.push(properties), () => time)
another.capture('started')
assert.notEqual(visits[2].play_id, visits[0].play_id, 'a new attempt has its own ID')

const email = linkProperties('mailto:private@example.com?subject=private', 'Email', 'cv_header')
assert.equal(email.destination, 'email')
assert.ok(!JSON.stringify(email).includes('private'))
assert.equal(linkProperties('/cv/?tracking=secret#contact', 'CV', 'home_header').destination, '/cv/')
assert.equal(linkProperties('/games/castle/', 'Play', 'card').link_type, 'game')
assert.equal(linkProperties('https://github.com/example?token=secret', 'GitHub', 'home_header').destination, 'github.com')
console.log('analytics: ok')
