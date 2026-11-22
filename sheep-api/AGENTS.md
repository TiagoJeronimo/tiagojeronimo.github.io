# sheep-api: the sheep's server (step 3 of `src/games/sheep/PLAN.md`: built, runs locally, not deployed)

One Cloudflare Worker and a D1 database. Plain web `Request`s and `Response`s, no SDK: Stripe is called with `fetch`,
and its signature is checked by hand with Web Crypto. Every word of SQL is in `src/sql.ts`, so moving to Vercel
(Turso or Postgres) is that file and the entry point. What a giver may write is `tidy` from
`src/games/sheep/dress.ts`, imported, the same function the page runs; so are the gift's bounds (`LEAST MOST
CURRENCY`), the sheep's number (`newId isId`) and its seed (`seedOf`).

| File | What |
| --- | --- |
| `src/index.ts` | The worker: routes, CORS, the checkout, Stripe's news. Exports only its handler (workerd will not start otherwise). |
| `src/signed.ts` | `signed(header, body, secret)`: Stripe's `t=...,v1=...`, HMAC-SHA256, 300 s either way (`TOLERANCE`). |
| `src/sql.ts` | `Db` (the little of D1 used), `flock`, `taken`, `put`. |
| `migrations/0001_sheep.sql` | The table `sheep`: `id session(unique) seed look name message amount created hidden`. |
| `test/api.test.ts` | The handler over node's own SQLite (`node:sqlite`, with the real migration) and a fake `fetch` for Stripe. In `npm test`. |
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

Wrangler's telemetry is off (`send_metrics` in `wrangler.toml`, `WRANGLER_SEND_METRICS` in the scripts). Nothing
here needs a Cloudflare login until it is deployed (step 5).
