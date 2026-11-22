// Stripe's signature on what it sends, checked by hand with Web Crypto (no SDK). On its own file because a Worker's
// main module may export nothing but its handler.

/** How old a signed call from Stripe may be, in seconds, before it is taken for a replay. Stripe's own libraries say 300. */
export const TOLERANCE = 300
/** Whether Stripe signed this: `t=<time>,v1=<hex>` over `${t}.${body}` with HMAC-SHA256, and not too long ago. */
export async function signed(header: string | null, body: string, secret: string, now = Date.now() / 1000) {
  if (!secret) return false
  const parts = (header ?? '').split(',').map((part) => part.split('='))
  const t = parts.find(([key]) => key === 't')?.[1] ?? ''
  if (!/^\d+$/.test(t) || Math.abs(now - Number(t)) > TOLERANCE) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const data = new TextEncoder().encode(`${t}.${body}`)
  for (const [name, hex] of parts) {
    if (name !== 'v1' || !/^[0-9a-f]{64}$/.test(hex ?? '')) continue
    // `verify` compares in constant time, so there is no compare of our own to get wrong.
    const signature = new Uint8Array(hex.match(/../g)!.map((pair) => parseInt(pair, 16)))
    if (await crypto.subtle.verify('HMAC', key, signature, data)) return true
  }
  return false
}
