// Run with `npm test` (or `node sheep-api/test/api.test.ts`). The sheep's server without wrangler or the network: its
// handler is called with web Requests, over node's own SQLite with the real migration in it, and Stripe is a fake
// `fetch`. Stripe's signature: right, wrong, old, tampered with, missing. The same news twice is one sheep. A checkout
// is checked as the page's card is (`tidy`), and its amount; a hidden sheep says nothing; CORS answers only our
// origins; and no secret ever comes back in an answer.
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { LEAST, MOST, newId, seedOf } from '../../src/games/sheep/dress.ts'
import worker, { type Env } from '../src/index.ts'
import { TOLERANCE, signed } from '../src/signed.ts'
import type { Db } from '../src/sql.ts'
import { d1, fresh } from './d1.ts'

const sqlite = fresh()

const SECRET = 'sk_test_not_a_real_key_0123456789'
const HOOK = 'whsec_not_a_real_secret_0123456789'
const SITE = 'https://tiagojeronimo.github.io'
const env: Env = { DB: d1(sqlite), STRIPE_SECRET: SECRET, STRIPE_WEBHOOK_SECRET: HOOK, ORIGINS: `${SITE}, http://localhost:5173`, SITE }

// Stripe, as far as a checkout goes: it says where to pay, and the test keeps what it was asked.
let asked: URLSearchParams | null = null
let stripeUp = true
globalThis.fetch = (async (url: string, init: RequestInit) => {
  assert.equal(url, 'https://api.stripe.com/v1/payment_intents', 'a PaymentIntent')
  asked = new URLSearchParams(String(init.body))
  assert.equal((init.headers as Record<string, string>).authorization, `Bearer ${SECRET}`)
  assert.equal((init.headers as Record<string, string>)['stripe-version'], '2026-11-18.endive', 'the API version is pinned')
  return stripeUp ? Response.json({ id: 'pi_test_1', client_secret: 'pi_test_1_secret_abc' }) : new Response('{"error":{"message":"Invalid API Key provided: sk_test_****6789"}}', { status: 401 })
}) as typeof fetch

const call = (path: string, init: RequestInit = {}) => worker.fetch(new Request(`https://sheep.example${path}`, init), env)
const said: string[] = []
/** Every answer is read through this, which also checks that no secret is in it. */
async function answer(response: Response) {
  const text = await response.text()
  said.push(text, JSON.stringify([...response.headers]))
  return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : null }
}
const buy = (body: unknown, origin = SITE, type = 'application/json') =>
  call('/checkout', { method: 'POST', headers: { origin, 'content-type': type }, body: typeof body === 'string' ? body : JSON.stringify(body) }).then(answer)

// Stripe's signature, made as Stripe makes it.
const sign = (body: string, t = Math.floor(Date.now() / 1000), secret = HOOK) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`
const news = (session: Record<string, unknown>, type = 'payment_intent.succeeded') => JSON.stringify({ id: 'evt_1', type, data: { object: session } })
const tell = (body: string, signature: string | null = sign(body)) =>
  call('/stripe', { method: 'POST', headers: { 'content-type': 'application/json', ...(signature ? { 'stripe-signature': signature } : {}) }, body }).then(answer)
const field = async (origin = SITE) => answer(await call('/sheep', { headers: { origin } }))

// The signature on its own.
{
  const body = news({ id: 'cs_x' })
  const now = Date.now() / 1000
  assert.equal(await signed(sign(body), body, HOOK), true, 'right')
  assert.equal(await signed(sign(body, undefined, 'whsec_other'), body, HOOK), false, 'signed with another secret')
  assert.equal(await signed(sign(body), body.replace('cs_x', 'cs_y'), HOOK), false, 'the body changed')
  assert.equal(await signed(sign(body, Math.floor(now - TOLERANCE - 10)), body, HOOK), false, 'too old: a replay')
  assert.equal(await signed(sign(body, Math.floor(now + TOLERANCE + 10)), body, HOOK), false, 'from the future')
  const t = Math.floor(now)
  assert.equal(await signed(`t=${t + 1},${sign(body, t).split(',')[1]}`, body, HOOK), false, 'the time changed')
  assert.equal(await signed(`t=${t},v1=zz`, body, HOOK), false, 'not hex')
  assert.equal(await signed(`t=${t},v0=${sign(body, t).split('v1=')[1]}`, body, HOOK), false, 'only v1 counts')
  assert.equal(await signed(`t=${t},v1=${'0'.repeat(64)},${sign(body, t).split(',')[1]}`, body, HOOK), true, 'one good v1 among several')
  assert.equal(await signed(null, body, HOOK), false, 'none')
  assert.equal(await signed(sign(body, t, ''), body, ''), false, 'no secret set up: nothing is signed')
}

// The rate limit: a caller over it is told to slow down, and Stripe is not asked; one under it is served.
{
  const limits: string[] = []
  let over = true
  const limited: Env = { ...env, CHECKOUT_LIMIT: { limit: async ({ key }) => (limits.push(key), { success: !over }) } }
  const post = () => worker.fetch(new Request('https://x.test/checkout', { method: 'POST', headers: { origin: SITE, 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7' }, body: JSON.stringify({ id: newId(), amount: 300, name: 'x', message: '', look: {} }) }), limited)
  asked = null
  assert.equal((await post()).status, 429, 'over the limit')
  assert.equal(asked, null, 'and Stripe is not asked')
  assert.deepEqual(limits, ['203.0.113.7'], 'counted by the caller\'s address')
  over = false
  assert.equal((await post()).status, 200, 'under it')
}

// A checkout.
{
  const id = newId()
  const good = { id, amount: 300, name: 'Wooliam  <b>', message: 'Hello see https://spam.example and www.x.com or buy.cheap.io now', look: { wool: 3, items: ['hat'], crown: true } }
  const done = await buy(good)
  assert.equal(done.status, 200)
  assert.deepEqual(done.body, { clientSecret: 'pi_test_1_secret_abc' }, "the intent's client secret, and nothing else")
  assert.equal(done.headers.get('access-control-allow-origin'), SITE)
  assert.ok(asked)
  const sent = asked as URLSearchParams
  assert.equal(sent.get('amount'), '300')
  assert.equal(sent.get('currency'), 'eur', 'euros when the page says nothing')
  assert.equal((await buy({ ...good, id: newId(), currency: 'chf' })).status, 200)
  assert.equal((asked as URLSearchParams).get('currency'), 'chf', 'francs when it says so')
  for (const currency of ['usd', 'CHF', '', 7]) {
    const got = await buy({ ...good, id: newId(), currency })
    assert.deepEqual([got.status, got.body.error], [400, 'currency'], String(currency))
  }
  assert.equal(sent.get('automatic_payment_methods[enabled]'), 'true', "the ways to pay are the dashboard's, as in the page's form")
  assert.equal(sent.get('automatic_payment_methods[allow_redirects]'), 'always', 'PayPal and the like go away and come back')
  assert.equal(sent.get('allowed_payment_method_types[0]'), null, 'no list of our own: it would not match the form')
  assert.equal(sent.get('payment_method_types[0]'), null, 'gone from this API version')
  assert.equal(sent.get('ui_mode'), null, 'no Checkout Session any more')
  assert.equal(sent.get('metadata[id]'), String(id))
  assert.equal(sent.get('metadata[name]'), 'Wooliam b', 'angle brackets out')
  assert.equal(sent.get('metadata[message]'), 'Hello see and or now', 'links out')
  assert.equal(sent.get('metadata[look]'), '{"wool":3,"items":["hat"]}', 'only what there is')
  for (const [key, value] of sent) if (key.startsWith('metadata')) assert.ok(value.length <= 500, `${key} fits in Stripe's metadata`)
  assert.equal((await buy({ ...good, id: newId(), message: 'x'.repeat(500) })).status, 200)
  assert.equal((asked as URLSearchParams).get('metadata[message]'), 'x'.repeat(80), 'a long message is cut to 80')
  assert.equal((await buy({ ...good, id: newId(), name: 'y'.repeat(99) })).status, 200)
  assert.equal((asked as URLSearchParams).get('metadata[name]'), 'y'.repeat(24), 'a long name is cut to 24')

  // What is not a checkout.
  const bad = async (body: unknown, status: number, error: string, ...rest: [string?, string?]) => {
    const got = await buy(body, ...rest)
    assert.equal(got.status, status, JSON.stringify(body).slice(0, 80))
    assert.equal(got.body.error, error)
  }
  for (const amount of [LEAST - 1, MOST + 1, 0, -300, 2.5, '300', null, undefined, Infinity]) await bad({ ...good, id: newId(), amount }, 400, 'amount')
  for (const amount of [LEAST, MOST]) assert.equal((await buy({ ...good, id: newId(), amount })).status, 200, 'the least and the most are allowed')
  for (const wrong of [undefined, 7, 2 ** 53, 2 ** 40 + 0.5, '4294967297', -(2 ** 40)]) await bad({ ...good, id: wrong }, 400, 'id')
  await bad({}, 400, 'id')
  await bad('not json', 400, 'json')
  await bad('null', 400, 'json')
  await bad(good, 415, 'json', SITE, 'text/plain')
  await bad({ ...good, message: 'x'.repeat(5000) }, 413, 'too big')
  await bad(good, 403, 'origin', 'https://evil.example')
  stripeUp = false
  const loud = console.error
  console.error = (...what: unknown[]) => assert.deepEqual(what, ['sheep-api: stripe said', 401, '', ''], "the status is logged, and Stripe's code and field, never its message")
  await bad({ ...good, id: newId() }, 502, 'stripe')
  console.error = loud
  stripeUp = true
  // A name and a message are not needed: a sheep with neither is "a sheep".
  assert.equal((await buy({ id: newId(), amount: 500 })).status, 200)
  assert.equal((asked as URLSearchParams).get('metadata[name]'), 'a sheep')
}

// Stripe says a sheep is paid for: it is in the field, once, however many times Stripe says so.
{
  const id = newId()
  const session = { id: 'pi_test_paid', object: 'payment_intent', status: 'succeeded', amount: 700, amount_received: 750, currency: 'eur', metadata: { id: String(id), name: 'Gwen', message: 'Baa', look: '{"wool":2,"items":["dog","butterflies"]}' } }
  const body = news(session)
  assert.equal((await tell(body)).status, 200)
  assert.equal((await tell(body)).status, 200, 'the same news twice is fine')
  assert.equal((await tell(news(session, 'charge.succeeded'))).body.ignored, true, 'the same payment, other news')
  const rows = sqlite.prepare('SELECT * FROM sheep WHERE session = ?').all('pi_test_paid')
  assert.equal(rows.length, 1, 'and one sheep')
  assert.equal(rows[0].amount, 750, 'the amount is what Stripe says was paid')
  assert.equal(rows[0].currency, 'eur')
  const franc = newId()
  await tell(news({ ...session, id: 'pi_test_chf', currency: 'chf', amount_received: 500, metadata: { ...session.metadata, id: String(franc) } }))
  const chf = sqlite.prepare('SELECT * FROM sheep WHERE session = ?').get('pi_test_chf')!
  assert.deepEqual([chf.id, chf.amount, chf.currency], [franc, 500, 'chf'], 'francs are kept as francs')
  assert.equal(rows[0].seed, seedOf(id), 'the seed is worked out from the number, here')
  assert.equal((await answer(await call('/checkout', { method: 'POST', headers: { origin: SITE, 'content-type': 'application/json' }, body: JSON.stringify({ id, amount: 300 }) }))).status, 409, 'its number is taken now')

  // Not signed, or not about a paid sheep: nothing goes in.
  const before = sqlite.prepare('SELECT count(*) AS n FROM sheep').get()!.n
  assert.equal((await tell(news({ ...session, id: 'pi_forged' }), null)).status, 400)
  assert.equal((await tell(news({ ...session, id: 'pi_forged' }), sign(body))).status, 400, "another body's signature")
  assert.equal((await tell(news({ ...session, id: 'pi_forged' }), sign(news({ ...session, id: 'pi_forged' }), Math.floor(Date.now() / 1000) - 3600))).status, 400, 'an old one')
  assert.equal((await tell(news({ ...session, id: 'pi_unpaid', status: 'requires_payment_method' }))).body.ignored, true)
  assert.equal((await tell(news({ ...session, id: 'pi_other' }, 'payment_intent.created'))).body.ignored, true, 'other news is thanked for and let be')
  assert.equal((await tell(news({ ...session, id: 'pi_old' }, 'checkout.session.completed'))).body.ignored, true, 'the old Checkout news is no longer a sheep')
  assert.equal((await tell(news({ ...session, id: 'pi_usd', currency: 'usd' }))).body.ignored, true, 'not in euros: not ours')
  assert.equal((await tell(news({ ...session, id: 'pi_coffee', metadata: {} }))).body.ignored, true, 'a payment that is not a sheep (the account may take others)')
  assert.equal((await tell(news({ ...session, id: 'pi_nothing', amount_received: undefined }))).body.ignored, true)
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM sheep').get()!.n, before)

  // A second session for a number that is taken (two tabs, or somebody copying): the sheep goes in with a number of its own.
  await tell(news({ ...session, id: 'pi_test_twin', metadata: { ...session.metadata, name: '<script>Twin' } }))
  const twin = sqlite.prepare('SELECT * FROM sheep WHERE session = ?').get('pi_test_twin')!
  assert.notEqual(twin.id, id)
  assert.equal(twin.seed, seedOf(twin.id as number))
  assert.equal(twin.name, 'script Twin', 'what Stripe hands back is tidied again')

  // The field.
  const seen = await field()
  assert.equal(seen.status, 200)
  assert.equal(seen.headers.get('cache-control'), 'public, max-age=5')
  const gwen = seen.body.find((one: { id: number }) => one.id === id)
  assert.deepEqual(gwen, { id, seed: seedOf(id), look: { wool: 2, items: ['butterflies'] }, name: 'Gwen', message: 'Baa', date: new Date().toISOString().slice(0, 10) })
  assert.ok(seen.body.every((one: object) => !('spot' in one) && !('amount' in one) && !('session' in one)), 'no spot, no amount, no session')

  // What a gift brings is what was asked for, of what the money allows: a gift of 10 that asked for a scarf and the dog
  // has both (and the one above, which asked for both and paid 7.50, has the butterflies alone).
  const rex = newId()
  assert.equal((await tell(news({ id: 'pi_test_dog', object: 'payment_intent', status: 'succeeded', amount: 1000, amount_received: 1000, currency: 'chf', metadata: { id: String(rex), name: 'Rex', message: '', look: '{"items":["scarf","dog"]}' } }))).status, 200)
  assert.deepEqual((await field()).body.find((one: { id: number }) => one.id === rex).look, { items: ['scarf', 'dog'] })

  // Hidden: the sheep stays, its words do not.
  sqlite.prepare('UPDATE sheep SET hidden = 1 WHERE id = ?').run(id)
  const quiet = (await field()).body.find((one: { id: number }) => one.id === id)
  assert.equal(quiet.name, 'a sheep')
  assert.equal(quiet.message, '')
}

// CORS: our origins get an answer they may read; anybody else's does not.
{
  for (const origin of [SITE, 'http://localhost:5173']) {
    assert.equal((await field(origin)).headers.get('access-control-allow-origin'), origin)
    const pre = await call('/checkout', { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST' } })
    assert.equal(pre.status, 204)
    assert.equal(pre.headers.get('access-control-allow-origin'), origin)
  }
  for (const origin of ['https://evil.example', 'http://localhost:5175', `${SITE}.evil.example`, 'null', '']) {
    assert.equal((await field(origin)).headers.get('access-control-allow-origin'), null, origin)
    assert.equal((await call('/checkout', { method: 'OPTIONS', headers: { origin } })).status, 403)
  }
  assert.equal((await answer(await call('/nowhere'))).status, 404)
  assert.equal((await answer(await call('/sheep', { method: 'DELETE' }))).status, 404)
}

// Something breaks inside: two words back, no stack.
{
  const broken = { ...env, DB: { prepare: () => { throw new Error(`no such table, key ${SECRET}`) } } as unknown as Db }
  const quiet = console.error
  console.error = () => {}
  const got = await answer(await worker.fetch(new Request('https://sheep.example/sheep'), broken))
  console.error = quiet
  assert.equal(got.status, 500)
  assert.deepEqual(got.body, { error: 'server' })
}

for (const text of said) for (const secret of [SECRET, HOOK, 'sk_test', 'whsec']) assert.ok(!text.includes(secret), `no secret in an answer: ${text.slice(0, 80)}`)
console.log('sheep-api: all good')
