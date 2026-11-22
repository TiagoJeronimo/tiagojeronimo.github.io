# sheep-api: the sheep's server (steps 3 and 4 of `src/games/sheep/PLAN.md`: built, runs locally, not deployed)

One Cloudflare Worker and a D1 database. Plain web `Request`s and `Response`s, no SDK: Stripe is called with `fetch`,
and its signature is checked by hand with Web Crypto. Every word of SQL is in `src/sql.ts`, so moving to Vercel
(Turso or Postgres) is that file and the entry point. What a giver may write is `tidy` from
`src/games/sheep/dress.ts`, imported, the same function the page runs; so are the gift's bounds (`LEAST MOST
CURRENCY`), the sheep's number (`newId isId`) and its seed (`seedOf`).

| File | What |
| --- | --- |
| `src/index.ts` | The worker: routes, CORS, the checkout, Stripe's news. Exports only its handler (workerd will not start otherwise). Anything under `/admin` goes to `admin.ts` before CORS is even worked out. |
| `src/admin.ts` | The owner's page: HTML made here, no script, a CSP that allows only its own style (by hash) and posts to itself. Hide and Show are forms with a token; `no-store`, `nosniff`, `no-referrer`, `DENY` on every answer. |
| `src/access.ts` | `admitted(jwt, env)`: Cloudflare Access's JWT, RS256 by Web Crypto against the team's keys (kept an hour, fetched again at most once a minute for a new `kid`), `aud`, `iss`, `exp`, `nbf`, and the email in `ADMIN_EMAILS`. `bypassed(request, env)`: the way in on this machine. |
| `src/signed.ts` | `signed(header, body, secret)`: Stripe's `t=...,v1=...`, HMAC-SHA256, 300 s either way (`TOLERANCE`). |
| `src/sql.ts` | `Db` (the little of D1 used), `flock`, `taken`, `put`; for the owner, `ledger` and `hide`. |
| `migrations/0001_sheep.sql` | The table `sheep`: `id session(unique) seed look name message amount created hidden`. |
| `test/api.test.ts`, `test/admin.test.ts`, `test/d1.ts` | The handler over node's own SQLite (`node:sqlite`, with the real migration: `d1.ts`), a fake `fetch` for Stripe and for Access's keys, and JWTs signed with a key made in the test. In `npm test`. |
| `wrangler.toml`, `.dev.vars.example` | Config with no secrets; the secrets go in `.dev.vars` (ignored by git). |

## The calls

- `GET /sheep`: every sheep, oldest first: `id seed look name message date`. No spot, amount or session. A hidden one
  is listed as "a sheep" with no message (the plan: hiding keeps the sheep). `cache-control: max-age=60`.
- `POST /checkout` (JSON, from one of `ORIGINS`, 4 KB at most): `{ id, amount, name, message, look }`. `amount` in
  cents, whole, `LEAST` to `MOST`; `id` from `newId`, not taken. Tidied, then a Stripe Checkout Session (euro, donate)
  with the sheep in `metadata` and `success_url` `SITE/games/sheep/?sheep=<id>`. Answers `{ url }`.
- `POST /stripe` (256 KB at most): signature first; then `checkout.session.completed` (or
  `async_payment_succeeded`) with `payment_status: 'paid'` puts the sheep in, tidied again, its seed from its number,
  `amount` from `amount_total`. `session` is unique, so the same news twice is one sheep. A number taken by another
  session gets a new one. Anything else: 200, `{ ignored: true }`.
- `GET /admin`: every sheep, newest first, words and all, with date, amount, number, and a Hide or Show button.
  `POST /admin/hide`, `POST /admin/show` (a form: `id`, `token`) set `hidden` and send the owner back (303). The same
  twice does nothing more. Nothing under `/admin` answers without a valid Access JWT for an email in `ADMIN_EMAILS`
  (401 without one, 403 with a bad one, the word "No." either way); with any of the three settings unset, nothing
  answers at all.
- Forged posts: the browser's `Sec-Fetch-Site` must say `same-origin` (or, without it, `Origin` must be ours; with
  the page's `no-referrer` a browser sends `Origin: null`, so that alone would not do), and the form's token is a
  hash of the Access JWT that drew the page, which another site cannot know.
- Errors are `{ error: '<a word or two>' }`; the reason stays in the worker's log, without Stripe's body (it can name
  the key).

## Locally

```bash
cp sheep-api/.dev.vars.example sheep-api/.dev.vars   # then paste Stripe's TEST keys into it
npm run sheep-api:migrate                            # once: the table, in sheep-api/.wrangler (ignored)
npm run sheep-api:dev                                # http://localhost:8787
VITE_SHEEP_API=http://localhost:8787 npm run dev     # the game, talking to it
stripe listen --forward-to localhost:8787/stripe     # Stripe's news to this machine; prints the whsec_ for .dev.vars
```

The owner's page on this machine: `ADMIN_DEV_BYPASS=on-this-machine-only` in `.dev.vars` (the example has it), then
http://localhost:8787/admin. It opens only with that exact value and only for a request to `localhost`, `127.0.0.1`
or `[::1]`, which nothing through Cloudflare's edge is; it never goes in `wrangler.toml` or in Cloudflare. Without it
the page says "No.", as it does to everybody when live.

Wrangler's telemetry is off (`send_metrics` in `wrangler.toml`, `WRANGLER_SEND_METRICS` in the scripts). Nothing
here needs a Cloudflare login until it is deployed (step 5).

## Live, later (step 5): the owner, by hand, in Cloudflare

1. Zero Trust, Settings: pick the team name (it is `<team>.cloudflareaccess.com`). Authentication: add "One-time PIN".
2. Access, Applications, Add, Self-hosted: the worker's own address (`sheep-api.<account>.workers.dev`, or a custom
   domain) with the path `admin`, and a second entry for `admin/*`. Session a day or so. Under its cookie settings, SameSite
   `Lax` and HTTP-only on: a third shut door against forged posts.
3. A policy: Allow, Include "Emails" = his address only. Not "Everyone": with the PIN, everyone means anyone with an inbox.
4. From the application's page, copy the "Application Audience (AUD) Tag".
5. `npx wrangler secret put ACCESS_TEAM` (the team name), `ACCESS_AUD` (the tag), `ADMIN_EMAILS` (his address), with
   `--config sheep-api/wrangler.toml`; or the same three as Secrets in the worker's settings. Never `ADMIN_DEV_BYPASS`.
6. Open `/admin` on the worker's address: Access asks for his email, mails a code, and the page shows.
