// The sheep's server: a Cloudflare Worker with a D1 database (see `../AGENTS.md`). Plain web Requests and Responses,
// no SDK: Stripe is spoken to with `fetch`, and its signature is checked here with Web Crypto. All SQL is in `sql.ts`.
import { CURRENCIES, LEAST, MOST, allowed, isCurrency, isId, isWear, newId, seedOf, tidy } from '../../src/games/sheep/dress.ts'
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
  /** Cloudflare's rate limiter for /checkout (see wrangler.toml). Not there in the tests and in `wrangler dev` of old. */
  CHECKOUT_LIMIT?: { limit(options: { key: string }): Promise<{ success: boolean }> }
}

/**
 * The version of Stripe's API the worker speaks, pinned so that a change in the account's default cannot change what
 * its words mean.
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
  let given: { id?: unknown; amount?: unknown; currency?: unknown; name?: unknown; message?: unknown; look?: unknown }
  try {
    given = JSON.parse(text)
  } catch {
    return no(400, 'json', allow)
  }
  if (!given || typeof given !== 'object') return no(400, 'json', allow)
  const { id, amount } = given
  if (!isId(id)) return no(400, 'id', allow)
  if (!Number.isInteger(amount) || (amount as number) < LEAST || (amount as number) > MOST) return no(400, 'amount', allow)
  // Euros unless it says francs (a page from before there were two says nothing).
  const currency = given.currency ?? CURRENCIES[0]
  if (!isCurrency(currency)) return no(400, 'currency', allow)
  if (await taken(env.DB, id)) return no(409, 'id taken', allow)
  // The same rule as the page's: a page can be made to send anything.
  const { name, message, look } = tidy(given)
  // A PaymentIntent, paid in the game's own card by Stripe's Payment Element. Which ways of paying it takes is the
  // owner's, in Stripe's dashboard (cards, Apple Pay, MB WAY, PayPal, ...), as far as each suits the gift and the
  // giver; redirects allowed, since some of them send the giver to their bank or app and back to `?sheep=<id>`. The
  // page's form asks for the same, by saying nothing of its own: the two must agree, or Stripe will not confirm.
  const form = new URLSearchParams({
    amount: String(amount),
    currency,
    'automatic_payment_methods[enabled]': 'true',
    'automatic_payment_methods[allow_redirects]': 'always',
    description: 'A sheep in the field',
    // What the sheep is, for when Stripe says it is paid for. Each value is far under Stripe's 500 characters.
    'metadata[id]': String(id),
    'metadata[name]': name,
    'metadata[message]': message,
    'metadata[look]': JSON.stringify(look),
  })
  const answer = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.STRIPE_SECRET}`, 'content-type': 'application/x-www-form-urlencoded', 'stripe-version': STRIPE_VERSION },
    body: form,
  })
  if (!answer.ok) {
    // The status, and Stripe's code for what was wrong and which field: never its message, which may name the key.
    const { error } = (await answer.json().catch(() => ({}))) as { error?: { code?: unknown; param?: unknown } }
    console.error('sheep-api: stripe said', answer.status, String(error?.code ?? ''), String(error?.param ?? ''))
    return no(502, 'stripe', allow)
  }
  // The intent's client secret is for the giver's browser, which confirms the payment with it: it can pay this one
  // intent and nothing else. It is not the account's secret.
  const { client_secret: clientSecret } = (await answer.json()) as { client_secret?: unknown }
  return typeof clientSecret === 'string' && clientSecret.startsWith('pi_') ? json({ clientSecret }, 200, allow) : no(502, 'stripe', allow)
}

type Intent = { id?: unknown; status?: unknown; amount_received?: unknown; currency?: unknown; metadata?: Record<string, unknown> }

async function stripe(request: Request, env: Env) {
  const text = await read(request, LARGE)
  if (text === null) return no(413, 'too big')
  if (!(await signed(request.headers.get('stripe-signature'), text, env.STRIPE_WEBHOOK_SECRET))) return no(400, 'signature')
  const event = JSON.parse(text) as { type?: unknown; data?: { object?: Intent } }
  // Only money that has arrived makes a sheep: `payment_intent.succeeded`, which Stripe sends once a payment is in,
  // however it was paid. Every other event (and a payment of something that is not a sheep) is thanked for and let be.
  if (event.type !== 'payment_intent.succeeded') return json({ ignored: true })
  const intent = event.data?.object ?? {}
  const meta = intent.metadata ?? {}
  if (intent.status !== 'succeeded' || typeof intent.id !== 'string' || !Number.isInteger(intent.amount_received) || !isCurrency(intent.currency) || meta.id === undefined) return json({ ignored: true })
  let look: unknown = {}
  try {
    look = JSON.parse(String(meta.look ?? '{}'))
  } catch {
    // then it wears nothing
  }
  const kept = tidy({ name: meta.name, message: meta.message, look })
  // What the gift brings along: what the giver chose, of what the money that came allows. Never more than was paid for.
  const paid = allowed(intent.amount_received as number)
  const items = (kept.look.items ?? []).filter((item) => isWear(item) || paid.includes(item))
  delete kept.look.items
  if (items.length) kept.look.items = items
  let id = Number(meta.id)
  // ponytail: a race between two checkouts of one id is caught here and not in the checkout, by giving the second a
  // number of its own; its giver then finds no sheep of theirs to drop, but it is in the field all the same.
  if (!isId(id) || (await taken(env.DB, id))) id = newId()
  // The amount is what Stripe says was paid, never what the page asked for. The intent's id is the unique key (the
  // column is still called `session`, from when it held a Checkout Session's): the same news twice is one sheep.
  await put(env.DB, { id, session: intent.id, seed: seedOf(id), look: JSON.stringify(kept.look), name: kept.name, message: kept.message, amount: intent.amount_received as number, currency: intent.currency as string })
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
  if (request.method === 'POST' && pathname === '/checkout') {
    // (By the caller's address: ten a minute is far more than a giver needs, and far less than a script would.)
    if (env.CHECKOUT_LIMIT && !(await env.CHECKOUT_LIMIT.limit({ key: request.headers.get('cf-connecting-ip') ?? 'none' })).success) return no(429, 'slow down', allow)
    return checkout(request, env, allow)
  }
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
