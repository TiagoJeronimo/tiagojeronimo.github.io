// The sheep's server: a Cloudflare Worker with a D1 database (see `../AGENTS.md`). Plain web Requests and Responses,
// no SDK: Stripe is spoken to with `fetch`, and its signature is checked here with Web Crypto. All SQL is in `sql.ts`.
import { CURRENCY, LEAST, MOST, isId, newId, seedOf, tidy } from '../../src/games/sheep/dress.ts'
import type { Gate } from './access.ts'
import { admin } from './admin.ts'
import { signed } from './signed.ts'
import { flock, put, taken, type Db } from './sql.ts'

export type Env = Gate & {
  DB: Db
  /** Stripe's secret key (test mode: `sk_test_...`) and the webhook's signing secret (`whsec_...`). Never sent, never logged. */
  STRIPE_SECRET: string
  STRIPE_WEBHOOK_SECRET: string
  /** The pages that may call, comma-separated. */
  ORIGINS: string
  /** Where the game is, for Stripe to send the giver back to. */
  SITE: string
}

/**
 * The version of Stripe's API the worker speaks, pinned so that a change in the account's default cannot change what
 * its words mean. (`embedded_page` is this version's name for a checkout that sits inside the game's own card.)
 */
const STRIPE_VERSION = '2026-11-18.endive'
const SMALL = 4 * 1024 // a checkout is a few hundred bytes
const LARGE = 256 * 1024 // Stripe's events are a few kilobytes

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
const no = (status: number, error: string, headers?: Record<string, string>) => json({ error }, status, headers)

/** The body as text, or null if it is longer than `most` bytes (by what it says, and by what came). */
async function read(request: Request, most: number) {
  if (Number(request.headers.get('content-length') ?? 0) > most) return null
  const text = await request.text()
  return new TextEncoder().encode(text).length > most ? null : text
}

/** The CORS headers for this caller: none at all unless its origin is one of ours. */
function cors(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('origin') ?? ''
  const ours = env.ORIGINS.split(',').map((one) => one.trim()).filter(Boolean)
  return ours.includes(origin) ? { 'access-control-allow-origin': origin, vary: 'Origin' } : { vary: 'Origin' }
}

async function checkout(request: Request, env: Env, allow: Record<string, string>) {
  if (!allow['access-control-allow-origin']) return no(403, 'origin', allow)
  if (!env.STRIPE_SECRET) return no(503, 'not set up', allow)
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) return no(415, 'json', allow)
  const text = await read(request, SMALL)
  if (text === null) return no(413, 'too big', allow)
  let given: { id?: unknown; amount?: unknown; name?: unknown; message?: unknown; look?: unknown }
  try {
    given = JSON.parse(text)
  } catch {
    return no(400, 'json', allow)
  }
  if (!given || typeof given !== 'object') return no(400, 'json', allow)
  const { id, amount } = given
  if (!isId(id)) return no(400, 'id', allow)
  if (!Number.isInteger(amount) || (amount as number) < LEAST || (amount as number) > MOST) return no(400, 'amount', allow)
  if (await taken(env.DB, id)) return no(409, 'id taken', allow)
  // The same rule as the page's: a page can be made to send anything.
  const { name, message, look } = tidy(given)
  const form = new URLSearchParams({
    mode: 'payment',
    ui_mode: 'embedded_page',
    submit_type: 'donate',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': CURRENCY,
    'line_items[0][price_data][unit_amount]': String(amount),
    'line_items[0][price_data][product_data][name]': 'A sheep in the field',
    // Paid in the card, the page drops the sheep itself (Stripe's `onComplete`). Only a way of paying that has to go
    // to a bank's own page comes back here, by the address, as the page has always been able to take it.
    redirect_on_completion: 'if_required',
    return_url: `${env.SITE}/games/sheep/?sheep=${id}`,
    // What the sheep is, for when Stripe says it is paid for. Each value is far under Stripe's 500 characters.
    'metadata[id]': String(id),
    'metadata[name]': name,
    'metadata[message]': message,
    'metadata[look]': JSON.stringify(look),
  })
  const answer = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.STRIPE_SECRET}`, 'content-type': 'application/x-www-form-urlencoded', 'stripe-version': STRIPE_VERSION },
    body: form,
  })
  if (!answer.ok) {
    console.error('sheep-api: stripe said', answer.status) // the status only: its body may name the key
    return no(502, 'stripe', allow)
  }
  // The session's client secret is for the giver's browser, which Stripe.js mounts the form with: it can pay this one
  // session and nothing else. It is not the account's secret.
  const { client_secret: clientSecret } = (await answer.json()) as { client_secret?: unknown }
  return typeof clientSecret === 'string' && clientSecret.startsWith('cs_') ? json({ clientSecret }, 200, allow) : no(502, 'stripe', allow)
}

type Session = { id?: unknown; payment_status?: unknown; amount_total?: unknown; metadata?: Record<string, unknown> }

async function stripe(request: Request, env: Env) {
  const text = await read(request, LARGE)
  if (text === null) return no(413, 'too big')
  if (!(await signed(request.headers.get('stripe-signature'), text, env.STRIPE_WEBHOOK_SECRET))) return no(400, 'signature')
  const event = JSON.parse(text) as { type?: unknown; data?: { object?: Session } }
  // A card is paid at once; a slower way to pay (a bank debit, if ever turned on) says so later, in the second event.
  if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') return json({ ignored: true })
  const session = event.data?.object ?? {}
  if (session.payment_status !== 'paid' || typeof session.id !== 'string' || !Number.isInteger(session.amount_total)) return json({ ignored: true })
  const meta = session.metadata ?? {}
  let look: unknown = {}
  try {
    look = JSON.parse(String(meta.look ?? '{}'))
  } catch {
    // then it wears nothing
  }
  const kept = tidy({ name: meta.name, message: meta.message, look })
  let id = Number(meta.id)
  // ponytail: a race between two checkouts of one id is caught here and not in the checkout, by giving the second a
  // number of its own; its giver then finds no sheep of theirs to drop, but it is in the field all the same.
  if (!isId(id) || (await taken(env.DB, id))) id = newId()
  // The amount is what Stripe says was paid, never what the page asked for.
  await put(env.DB, { id, session: session.id, seed: seedOf(id), look: JSON.stringify(kept.look), name: kept.name, message: kept.message, amount: session.amount_total as number })
  return json({ ok: true })
}

async function handle(request: Request, env: Env) {
  const { pathname } = new URL(request.url)
  // The owner's page has its own door (`admin.ts`): Access's word, no CORS, nothing cached.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return admin(request, env)
  const allow = cors(request, env)
  if (request.method === 'OPTIONS' && (pathname === '/sheep' || pathname === '/checkout')) {
    if (!allow['access-control-allow-origin']) return new Response(null, { status: 403, headers: allow })
    return new Response(null, { status: 204, headers: { ...allow, 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' } })
  }
  if (request.method === 'GET' && pathname === '/sheep') {
    const sheep = (await flock(env.DB)).map(({ look, ...rest }) => ({ ...rest, look: JSON.parse(look) as unknown }))
    return json(sheep, 200, { ...allow, 'cache-control': 'public, max-age=60' })
  }
  if (request.method === 'POST' && pathname === '/checkout') return checkout(request, env, allow)
  if (request.method === 'POST' && pathname === '/stripe') return stripe(request, env)
  return no(404, 'not here', allow)
}

export default {
  async fetch(request: Request, env: Env) {
    try {
      return await handle(request, env)
    } catch (error) {
      // What went wrong stays here; the caller gets two words.
      console.error('sheep-api:', error instanceof Error ? error.message : 'unknown')
      return no(500, 'server', { 'cache-control': 'no-store' })
    }
  },
}
