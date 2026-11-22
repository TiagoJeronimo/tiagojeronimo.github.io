// The owner's page: every sheep, newest first, with its words, and a button to hide them (the sheep stays: somebody
// paid for it) or show them again. Plain HTML made here, no script at all, behind Access and a check of its own.
//
// Forgery from another site is stopped twice. A post must come from this page's own origin: `Sec-Fetch-Site:
// same-origin`, which every current browser sends and no page can set; or, from an older browser without it, an
// `Origin` that is ours. (With `Referrer-Policy: no-referrer` a browser sends `Origin: null` with a form's post, so
// `Origin` alone would shut the owner out.) And it must carry a token made from the Access JWT of the request that
// drew the page, which another site never sees: so no secret of our own to keep, and a new token with every session.
import { admitted, bypassed, type Gate } from './access.ts'
import { hide, ledger, type Db, type Kept } from './sql.ts'

const STYLE = `
:root{color-scheme:light dark;--bg:#fbf7ef;--ink:#2e2a3a;--soft:#6d6680;--card:#fff;--line:#e6dfd2;--accent:#ff7a8a}
@media (prefers-color-scheme:dark){:root{--bg:#1f1d26;--ink:#efeaf6;--soft:#a69fb6;--card:#2a2733;--line:#3a3646}}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 system-ui,sans-serif}
main{max-width:44rem;margin:0 auto;padding:24px 16px 48px}
h1{font-size:1.5rem;margin:0 0 4px}
p.lede{color:var(--soft);margin:0 0 20px}
ol{list-style:none;margin:0;padding:0;display:grid;gap:10px}
li{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;display:flex;gap:12px;align-items:flex-start}
li>div{flex:1;min-width:0}
li.hidden{opacity:.6}
li.hidden q{text-decoration:line-through}
q{display:block;margin:2px 0 6px;overflow-wrap:anywhere}
q:empty{display:none}
small{color:var(--soft)}
button{font:inherit;font-weight:650;border:0;border-radius:999px;padding:8px 14px;background:var(--ink);color:var(--bg);cursor:pointer}
li.hidden button{background:var(--accent);color:#2e2a3a}
`

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
const digest = (text: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
/** The form's token: from the Access JWT, which only a page drawn for it knows. */
const token = async (jwt: string) => hex(await digest(`sheep-admin:${jwt}`))

/** What every answer under /admin carries: never kept, never framed, never sniffed, never referred, no CORS. */
const SHUT = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
}
const page = async (html: string, status = 200) => {
  const style = btoa(String.fromCharCode(...new Uint8Array(await digest(STYLE))))
  return new Response(html, {
    status,
    headers: {
      ...SHUT,
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': `default-src 'none'; style-src 'sha256-${style}'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
    },
  })
}
const plain = (status: number, text: string, more: Record<string, string> = {}) => new Response(text, { status, headers: { ...SHUT, 'content-type': 'text/plain; charset=utf-8', ...more } })

const euros = (cents: number) => `€${(cents / 100).toFixed(2)}`
function row(sheep: Kept, form: string) {
  const hidden = !!sheep.hidden
  return `<li${hidden ? ' class="hidden"' : ''}><div><strong>${escape(sheep.name)}</strong><q>${escape(sheep.message)}</q><small>${escape(sheep.created.slice(0, 16).replace('T', ' '))} · ${euros(sheep.amount)} · #${sheep.id}${hidden ? ' · hidden' : ''}</small></div><form method="post" action="/admin/${hidden ? 'show' : 'hide'}"><input type="hidden" name="id" value="${sheep.id}">${form}<button>${hidden ? 'Show' : 'Hide'}</button></form></li>`
}

async function list(db: Db, jwt: string) {
  const all = await ledger(db)
  const form = `<input type="hidden" name="token" value="${await token(jwt)}">`
  const quiet = all.filter((one) => one.hidden).length
  const total = all.reduce((sum, one) => sum + one.amount, 0)
  return page(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>The sheep's messages</title><style>${STYLE}</style></head>
<body><main><h1>The sheep's messages</h1>
<p class="lede">${all.length} sheep, ${euros(total)} in all${quiet ? `, ${quiet} keeping quiet` : ''}. Newest first. Hide takes a sheep's name and words off the field; the sheep stays, since somebody paid for it.</p>
${all.length ? `<ol>${all.map((one) => row(one, form)).join('')}</ol>` : '<p>No sheep yet. The field is very peaceful.</p>'}
</main></body></html>`)
}

/** Everything under /admin. Nobody gets past the first lines without Access's word (or, on this machine, the bypass). */
export async function admin(request: Request, env: Gate & { DB: Db }) {
  const jwt = request.headers.get('cf-access-jwt-assertion')
  if (!bypassed(request, env)) {
    if (!jwt) return plain(401, 'No.')
    if (!(await admitted(jwt, env))) return plain(403, 'No.')
  }
  const { pathname, origin } = new URL(request.url)
  if (request.method === 'GET' && pathname === '/admin') return list(env.DB, jwt ?? '')
  const to = pathname === '/admin/hide' ? true : pathname === '/admin/show' ? false : null
  if (request.method !== 'POST' || to === null) return plain(404, 'Not here.')
  const site = request.headers.get('sec-fetch-site') || null
  const from = request.headers.get('origin')
  const same = site === 'same-origin' ? from === null || from === 'null' || from === origin : site === null && from === origin
  if (!same) return plain(403, 'No.')
  if (!(request.headers.get('content-type') ?? '').startsWith('application/x-www-form-urlencoded')) return plain(415, 'A form, please.')
  if (Number(request.headers.get('content-length') ?? 0) > 1024) return plain(413, 'Too long.')
  const text = await request.text()
  if (text.length > 1024) return plain(413, 'Too long.')
  const given = new URLSearchParams(text)
  if (given.get('token') !== (await token(jwt ?? ''))) return plain(403, 'No.')
  const id = Number(given.get('id'))
  if (!Number.isSafeInteger(id)) return plain(400, 'Which sheep?')
  await hide(env.DB, id, to)
  return plain(303, '', { location: '/admin' })
}
