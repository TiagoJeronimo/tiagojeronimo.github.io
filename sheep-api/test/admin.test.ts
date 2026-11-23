// Run with `npm test` (or `node sheep-api/test/admin.test.ts`). The owner's page without Cloudflare: Access's JWT is
// made here with a key of the test's own, and Access's keys come from a fake `fetch`. Who gets in (and who does not:
// a wrong key, audience, issuer, time or email, `alg: none`, no token); hide and show, twice over; a hidden sheep
// keeps its place in the field without its words; hostile words come out as text; another site cannot post; nothing
// under /admin is cached or open to CORS; and the way in on this machine is shut without its setting or off localhost.
import assert from 'node:assert/strict'
import { newId } from '../../src/games/sheep/dress.ts'
import { BYPASS, admitted, type Gate } from '../src/access.ts'
import worker, { type Env } from '../src/index.ts'
import { put } from '../src/sql.ts'
import { d1, fresh } from './d1.ts'

const TEAM = 'sheepfold'
const AUD = 'aud-tag-for-the-test-0123456789abcdef'
const OWNER = 'owner@example.com'
const gate: Gate = { ACCESS_TEAM: TEAM, ACCESS_AUD: AUD, ADMIN_EMAILS: `someone@example.com, ${OWNER.toUpperCase()}` }
const sqlite = fresh()
const env: Env = { ...gate, DB: d1(sqlite), STRIPE_SECRET: 'sk_test_unused', STRIPE_WEBHOOK_SECRET: 'whsec_unused', ORIGINS: 'https://tiagojeronimo.github.io', SITE: 'https://tiagojeronimo.github.io' }

// Access's key, and a stranger's.
const pair = () => crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
const access = await pair()
const stranger = await pair()
const KID = 'kid-1'
let fetched = 0
globalThis.fetch = (async (url: string) => {
  assert.equal(url, `https://${TEAM}.cloudflareaccess.com/cdn-cgi/access/certs`, 'keys from the team, nowhere else')
  fetched++
  return Response.json({ keys: [{ ...(await crypto.subtle.exportKey('jwk', access.publicKey)), kid: KID }] })
}) as typeof fetch

const b64 = (data: Uint8Array | string) => Buffer.from(data).toString('base64url')
const now = () => Math.floor(Date.now() / 1000)
async function jwt(claims: Record<string, unknown> = {}, { key = access.privateKey, head = { alg: 'RS256', kid: KID } as Record<string, unknown> } = {}) {
  const body = { iss: `https://${TEAM}.cloudflareaccess.com`, aud: [AUD], email: OWNER, iat: now(), nbf: now(), exp: now() + 600, ...claims }
  const signing = `${b64(JSON.stringify(head))}.${b64(JSON.stringify(body))}`
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signing)))
  return `${signing}.${b64(signature)}`
}

// Who gets in.
{
  const loud = console.error
  console.error = () => {}
  assert.equal(await admitted(await jwt(), gate), OWNER, 'the owner, by Access')
  assert.equal(await admitted(await jwt({ aud: AUD }), gate), OWNER, 'aud as one string')
  assert.equal(await admitted(await jwt({ email: 'Owner@Example.com' }), gate), 'Owner@Example.com', 'the email in any case')
  assert.equal(await admitted(await jwt({}, { key: stranger.privateKey }), gate), null, 'signed by somebody else')
  assert.equal(await admitted(await jwt({}, { head: { alg: 'RS256', kid: 'other' } }), gate), null, 'a key Access does not have')
  assert.equal(await admitted(await jwt({ aud: ['another-app'] }), gate), null, 'for another application')
  assert.equal(await admitted(await jwt({ iss: 'https://evil.cloudflareaccess.com' }), gate), null, 'from another team')
  assert.equal(await admitted(await jwt({ exp: now() - 1 }), gate), null, 'expired')
  assert.equal(await admitted(await jwt({ exp: undefined }), gate), null, 'never expires')
  assert.equal(await admitted(await jwt({ nbf: now() + 600 }), gate), null, 'not yet')
  assert.equal(await admitted(await jwt({ email: 'visitor@example.com' }), gate), null, 'somebody Access let in, but not on the list')
  assert.equal(await admitted(await jwt({ email: undefined }), gate), null, 'no email')
  const good = await jwt()
  const [head, body] = good.split('.')
  assert.equal(await admitted(`${b64(JSON.stringify({ alg: 'none', kid: KID }))}.${body}.`, gate), null, 'alg: none')
  assert.equal(await admitted(`${b64(JSON.stringify({ alg: 'none', kid: KID }))}.${body}`, gate), null, 'alg: none, no signature at all')
  assert.equal(await admitted(`${b64(JSON.stringify({ alg: 'HS256', kid: KID }))}.${body}.${good.split('.')[2]}`, gate), null, 'HS256')
  const richer = b64(JSON.stringify({ ...JSON.parse(Buffer.from(body!, 'base64url').toString()), email: 'someone@example.com', exp: now() + 9999 }))
  assert.equal(await admitted(`${head}.${richer}.${good.split('.')[2]}`, gate), null, 'the claims changed under the signature')
  for (const junk of [null, '', 'a.b', 'a.b.c', 'a.b.c.d', '...', `${good}.`]) assert.equal(await admitted(junk, gate), null, String(junk))
  // Not set up is shut, whatever comes.
  for (const missing of ['ACCESS_TEAM', 'ACCESS_AUD', 'ADMIN_EMAILS'] as const) assert.equal(await admitted(good, { ...gate, [missing]: '' }), null, `no ${missing}`)
  assert.equal(await admitted(good, { ...gate, ACCESS_TEAM: 'evil.com/x?' }), null, 'a team is a plain name')
  console.error = loud
  assert.ok(fetched >= 1 && fetched <= 3, `keys are kept, not fetched for every request (${fetched})`)
}

// The page.
const owner = await jwt()
const PAGE = 'https://sheep-api.example.workers.dev'
const look = (headers: Record<string, string> = { 'cf-access-jwt-assertion': owner }, path = '/admin', host = PAGE) => worker.fetch(new Request(`${host}${path}`, { headers }), env)
const post = (path: string, fields: Record<string, string>, headers: Record<string, string> = {}, host = PAGE) =>
  worker.fetch(new Request(`${host}${path}`, { method: 'POST', headers: { 'cf-access-jwt-assertion': owner, origin: host, 'sec-fetch-site': 'same-origin', 'content-type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams(fields) }), env)
const shut = (response: Response, what: string) => {
  assert.equal(response.headers.get('cache-control'), 'no-store', `${what}: never cached`)
  assert.equal(response.headers.get('access-control-allow-origin'), null, `${what}: no CORS`)
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
  assert.equal(response.headers.get('x-frame-options'), 'DENY')
}

const quiet = newId()
const loud = newId()
await put(env.DB, { id: loud, session: 'cs_1', seed: 1, look: '{}', name: 'Gwen', message: 'Baa', amount: 300, currency: 'eur' })
await put(env.DB, { id: quiet, session: 'cs_2', seed: 2, look: '{}', name: '<script>alert(1)</script>', message: `"quoted" & 'single' <img src=x onerror=alert(1)>`, amount: 1250, currency: 'eur' })
sqlite.prepare("UPDATE sheep SET created = '2026-11-20T10:00:00Z' WHERE id = ?").run(loud)

{
  const shown = await look()
  shut(shown, 'the page')
  assert.equal(shown.status, 200)
  assert.match(shown.headers.get('content-security-policy')!, /^default-src 'none'; style-src 'sha256-[A-Za-z0-9+/=]+'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'$/)
  const html = await shown.text()
  assert.ok(!html.includes('<script') && !html.includes('<img'), 'hostile words are text, not tags')
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'))
  assert.ok(html.includes('&quot;quoted&quot; &amp; &#39;single&#39; &lt;img src=x onerror=alert(1)&gt;'))
  assert.ok(html.indexOf(String(quiet)) < html.indexOf(String(loud)), 'newest first')
  assert.ok(html.includes('€12.50') && html.includes('€3.00') && html.includes('€15.50 in all'))
  // A gift in francs: shown in francs, and summed apart from the euros.
  await put(env.DB, { id: newId(), session: 'pi_chf', seed: 3, look: '{}', name: 'Heidi', message: '', amount: 800, currency: 'chf' })
  const both = await look().then((r) => r.text())
  assert.ok(both.includes('CHF 8.00 ·') && both.includes('3 sheep') && both.includes('€15.50 and CHF 8.00 in all'), 'a sum to each currency')
  sqlite.prepare("DELETE FROM sheep WHERE session = 'pi_chf'").run()
  const tokens = [...html.matchAll(/name="token" value="([0-9a-f]{64})"/g)].map((m) => m[1])
  assert.equal(tokens.length, 2)
  const token = tokens[0]!

  // Hide, twice: one hidden sheep. Show, twice: back as it was.
  const field = async () => (await (await worker.fetch(new Request(`${PAGE}/sheep`), env)).json()) as { id: number; name: string; message: string }[]
  for (let k = 0; k < 2; k++) {
    const done = await post('/admin/hide', { id: String(loud), token })
    assert.equal(done.status, 303)
    assert.equal(done.headers.get('location'), '/admin')
    shut(done, 'a hide')
  }
  assert.equal(sqlite.prepare('SELECT hidden FROM sheep WHERE id = ?').get(loud)!.hidden, 1)
  const gone = (await field()).find((one) => one.id === loud)!
  assert.deepEqual([gone.name, gone.message], ['a sheep', ''], 'in the field, without its words')
  assert.ok((await look().then((r) => r.text())).includes('Gwen'), 'the owner still sees them')
  for (let k = 0; k < 2; k++) assert.equal((await post('/admin/show', { id: String(loud), token })).status, 303)
  const back = (await field()).find((one) => one.id === loud)!
  assert.deepEqual([back.name, back.message], ['Gwen', 'Baa'])
  assert.equal((await post('/admin/hide', { id: '12345', token })).status, 303, 'no such sheep: nothing to do')

  // Forgery and nonsense.
  const refused = async (response: Promise<Response>, status: number, what: string) => {
    const got = await response
    assert.equal(got.status, status, what)
    shut(got, what)
    assert.ok(!(await got.text()).includes('Gwen'), `${what}: says nothing`)
  }
  await refused(post('/admin/hide', { id: String(loud), token }, { origin: 'https://evil.example' }), 403, 'from another origin')
  await refused(post('/admin/hide', { id: String(loud), token }, { origin: '' }), 403, 'no origin')
  await refused(post('/admin/hide', { id: String(loud), token }, { 'sec-fetch-site': 'cross-site' }), 403, 'the browser says cross-site')
  await refused(post('/admin/hide', { id: String(loud), token }, { 'sec-fetch-site': 'cross-site', origin: PAGE }), 403, 'cross-site, whatever Origin says')
  await refused(post('/admin/hide', { id: String(loud), token }, { 'sec-fetch-site': '', origin: 'null' }), 403, "an older browser's null origin")
  assert.equal((await post('/admin/hide', { id: String(loud), token }, { origin: 'null' })).status, 303, "this page's own post: same-origin, and Origin null by the page's no-referrer")
  assert.equal((await post('/admin/show', { id: String(loud), token }, { 'sec-fetch-site': '' })).status, 303, 'an older browser: Origin ours, no Sec-Fetch-Site')
  await refused(post('/admin/hide', { id: String(loud), token }, { 'sec-fetch-site': 'same-site' }), 403, 'a sibling site')
  await refused(post('/admin/hide', { id: String(loud) }), 403, 'no token')
  await refused(post('/admin/hide', { id: String(loud), token: 'f'.repeat(64) }), 403, 'a wrong token')
  await refused(post('/admin/hide', { id: String(loud), token }, { 'cf-access-jwt-assertion': await jwt({ iat: now() - 5 }) }), 403, "another session's token")
  await refused(post('/admin/hide', { id: String(loud), token }, { 'content-type': 'application/json' }), 415, 'not a form')
  await refused(post('/admin/hide', { id: 'x'.repeat(2000), token }), 413, 'too long')
  await refused(post('/admin/hide', { id: 'one', token }), 400, 'not a number')
  await refused(post('/admin/delete', { id: String(loud), token }), 404, 'no such action')
  await refused(look(undefined, '/admin/hide'), 404, 'a GET does nothing')
  assert.equal(sqlite.prepare('SELECT hidden FROM sheep WHERE id = ?').get(loud)!.hidden, 0, 'and none of that changed anything')

  // Without Access's word: nothing, before anything else is looked at.
  const loudly = console.error
  console.error = () => {}
  await refused(look({}), 401, 'no token')
  await refused(look({ 'cf-access-jwt-assertion': await jwt({ email: 'visitor@example.com' }) }), 403, 'not the owner')
  await refused(look({ 'cf-access-jwt-assertion': await jwt({}, { key: stranger.privateKey }) }), 403, 'forged')
  await refused(look({}, '/admin/'), 401, 'a path under it')
  await refused(look({ origin: 'https://tiagojeronimo.github.io' }), 401, 'our own origin is no key')
  await refused(post('/admin/hide', { id: String(loud), token }, { 'cf-access-jwt-assertion': '' }), 401, 'a post without Access')
  const pre = await worker.fetch(new Request(`${PAGE}/admin`, { method: 'OPTIONS', headers: { origin: 'https://tiagojeronimo.github.io' } }), env)
  shut(pre, 'a preflight')
  assert.equal(pre.status, 401)
  console.error = loudly
}

// The way in on this machine.
{
  const dev = { ...env, ADMIN_DEV_BYPASS: BYPASS }
  const at = (host: string, bypass: Env) => worker.fetch(new Request(`${host}/admin`), bypass)
  assert.equal((await at('http://localhost:8787', dev)).status, 200, 'set, on localhost')
  assert.equal((await at('http://127.0.0.1:8787', dev)).status, 200)
  assert.equal((await at('http://localhost:8787', env)).status, 401, 'not set')
  for (const value of ['1', 'true', 'yes', `${BYPASS} `, BYPASS.toUpperCase()]) assert.equal((await at('http://localhost:8787', { ...env, ADMIN_DEV_BYPASS: value })).status, 401, `set to ${value}`)
  for (const host of [PAGE, 'https://localhost.evil.example', 'https://sheep.tiagojeronimo.example']) assert.equal((await at(host, dev)).status, 401, `set, but at ${host}`)
  // A post on this machine still needs its own origin and the page's token.
  const html = await (await at('http://localhost:8787', dev)).text()
  const token = html.match(/name="token" value="([0-9a-f]{64})"/)![1]!
  const local = (headers: Record<string, string>, fields: Record<string, string>) =>
    worker.fetch(new Request('http://localhost:8787/admin/hide', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams(fields) }), dev)
  assert.equal((await local({ origin: 'http://localhost:5173' }, { id: String(loud), token })).status, 403, "the game's origin is not the page's")
  assert.equal((await local({ origin: 'http://localhost:8787' }, { id: String(loud), token })).status, 303)
}

// The public calls are as they were.
{
  const field = await worker.fetch(new Request(`${PAGE}/sheep`, { headers: { origin: 'https://tiagojeronimo.github.io' } }), env)
  assert.equal(field.status, 200)
  assert.equal(field.headers.get('access-control-allow-origin'), 'https://tiagojeronimo.github.io')
  assert.equal(field.headers.get('cache-control'), 'public, max-age=5')
  assert.equal((await worker.fetch(new Request(`${PAGE}/administrator`), env)).status, 404)
}
console.log('sheep-api admin: all good')
