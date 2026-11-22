// Who is asking for /admin. Cloudflare Access stands in front of it and signs each request it lets through with a
// JWT (`Cf-Access-Jwt-Assertion`, RS256). The worker checks that signature itself, against Access's published keys,
// so that the page is shut even if Access is switched off or the worker is reached some other way.

export type Gate = { ACCESS_TEAM?: string; ACCESS_AUD?: string; ADMIN_EMAILS?: string; ADMIN_DEV_BYPASS?: string }

/** The value `ADMIN_DEV_BYPASS` must have, in `.dev.vars` only, to open /admin without Access on this machine. */
export const BYPASS = 'on-this-machine-only'
const HOMES = ['localhost', '127.0.0.1', '[::1]']

// (Spelt out so that Node's types, which stand in for the Worker's in the type check, are enough.)
type Key = Awaited<ReturnType<typeof crypto.subtle.importKey>>

const HOUR = 3600
const MINUTE = 60
let cache: { team: string; at: number; keys: Map<string, Key> } | null = null

/** Access's keys for this team, kept for an hour. An unknown `kid` (Access turns its keys) fetches again, at most once a minute. */
async function keys(team: string, now: number, again: boolean) {
  if (cache?.team === team && now - cache.at < (again ? MINUTE : HOUR)) return cache.keys
  const answer = await fetch(`https://${team}.cloudflareaccess.com/cdn-cgi/access/certs`)
  if (!answer.ok) throw new Error(`access certs ${answer.status}`)
  const { keys: list } = (await answer.json()) as { keys?: { kid?: unknown; kty?: unknown; n?: unknown; e?: unknown }[] }
  const found = new Map<string, Key>()
  for (const { kid, kty, n, e } of list ?? []) {
    if (typeof kid !== 'string' || kty !== 'RSA' || typeof n !== 'string' || typeof e !== 'string') continue
    found.set(kid, await crypto.subtle.importKey('jwk', { kty, n, e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']))
  }
  cache = { team, at: now, keys: found }
  return found
}

const bytes = (part: string) => {
  const plain = atob(part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (part.length % 4)) % 4))
  return Uint8Array.from(plain, (c) => c.charCodeAt(0))
}
const claims = (part: string) => JSON.parse(new TextDecoder().decode(bytes(part))) as Record<string, unknown>

/**
 * The email of whoever Access let in, or null: a JWT signed with RS256 by one of the team's keys, for this
 * application (`aud`), from this team (`iss`), in date, for an address in `ADMIN_EMAILS`. Anything else, or anything
 * not set up, is null: the page fails shut.
 */
export async function admitted(token: string | null, gate: Gate, now = Date.now() / 1000) {
  const { ACCESS_TEAM: team = '', ACCESS_AUD: aud = '', ADMIN_EMAILS: emails = '' } = gate
  const allowed = emails.split(',').map((one) => one.trim().toLowerCase()).filter(Boolean)
  if (!token || !/^[a-z0-9-]+$/.test(team) || !aud || !allowed.length) return null
  try {
    const [head, body, signature, ...more] = token.split('.')
    if (more.length || !head || !body || !signature) return null
    const { alg, kid } = claims(head)
    if (alg !== 'RS256' || typeof kid !== 'string') return null // never `none`, never HS256 with a public key for a secret
    const key = (await keys(team, now, false)).get(kid) ?? (await keys(team, now, true)).get(kid)
    if (!key || !(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, bytes(signature), new TextEncoder().encode(`${head}.${body}`)))) return null
    const { iss, aud: to, exp, nbf, email } = claims(body)
    if (iss !== `https://${team}.cloudflareaccess.com`) return null
    if (!(Array.isArray(to) ? to.includes(aud) : to === aud)) return null
    if (typeof exp !== 'number' || exp <= now || (nbf !== undefined && (typeof nbf !== 'number' || nbf > now))) return null
    return typeof email === 'string' && allowed.includes(email.toLowerCase()) ? email : null
  } catch (error) {
    console.error('sheep-api: access', error instanceof Error ? error.message : 'unknown') // never the token
    return null
  }
}

/**
 * The way in on this machine without Access: only with `ADMIN_DEV_BYPASS` set to `BYPASS`, which belongs in
 * `.dev.vars` and nowhere else, and only for a request to localhost, which no request through Cloudflare's edge is.
 */
export const bypassed = (request: Request, gate: Gate) => gate.ADMIN_DEV_BYPASS === BYPASS && HOMES.includes(new URL(request.url).hostname)
