# Going live: the sheep, step by step

For the owner, by hand. Test mode first, live mode last. Never paste a key into a chat: type it into the terminal
prompt or into a dashboard. Each step says what you will see when it worked.

## 1. The worker, on Cloudflare (test keys still)

1. `npx wrangler login` (once). Then `npm run sheep-api:migrate:remote`: makes the tables in the real database.
   (You will be asked to confirm: `Y`.)
2. The three secrets, one command each; each asks for the value, which is not echoed:
   ```bash
   npx wrangler secret put STRIPE_SECRET --config sheep-api/wrangler.toml
   npx wrangler secret put STRIPE_WEBHOOK_SECRET --config sheep-api/wrangler.toml
   ```
   For now: the **test** secret key (`sk_test_...`). The webhook secret comes in step 2 below; put anything for now
   and replace it then.
3. `npm run sheep-api:deploy`. It prints the worker's address, `https://sheep-api.<you>.workers.dev`. Open
   `<address>/sheep`: it should show `[]` (the sheep in the database; the resident is in the game itself).

## 2. Stripe, test mode: the webhook

1. Stripe, **test mode**, Developers, Webhooks, Add endpoint: `<address>/stripe`, and subscribe **only** to
   `payment_intent.succeeded`.
2. Copy its "Signing secret" (`whsec_...`) and run `npx wrangler secret put STRIPE_WEBHOOK_SECRET ...` again with it.
3. Settings, Payment method domains: add `tiagojeronimo.github.io` (Apple Pay and Google Pay need it).
4. Settings, Payment methods: switch off what you do not want in "More" (Klarna, Alipay, Amazon Pay, ...).

## 3. The site knows the worker

GitHub, the repository, Settings, Secrets and variables, Actions, **Variables** (the tab beside Secrets):
`VITE_SHEEP_API` = the worker's address, `VITE_STRIPE_PUBLISHABLE` = the **publishable** key (`pk_test_...`, never `sk_`).
Then `.github/workflows/publish.yml` needs these two lines under the build step's `env:` beside the PostHog ones (the
workflow is yours to edit; I leave it alone):
```yaml
          VITE_SHEEP_API: ${{ vars.VITE_SHEEP_API }}
          VITE_STRIPE_PUBLISHABLE: ${{ vars.VITE_STRIPE_PUBLISHABLE }}
```
Push to `main`. Try a real purchase on the live site with the test card `4242 4242 4242 4242`, any date and CVC:
the sheep should drop, and the database should have it (`<address>/sheep`).

## 4. The owner's page, `/admin` (Cloudflare Access)

The six steps in `sheep-api/AGENTS.md`, "Live, later". Done when `<address>/admin` asks for your email, mails a code,
and shows the list. Until then `/admin` refuses everybody, which is fine.

## 5. Live money

1. Stripe: switch the account to live (it asks for your details and a bank account: that is Stripe's, not mine).
2. Repeat 2 with **live** mode: a live webhook endpoint on the same address, `payment_intent.succeeded` only.
3. `npx wrangler secret put STRIPE_SECRET ...` with `sk_live_...`, and `STRIPE_WEBHOOK_SECRET` with the live one.
4. Change the GitHub variable `VITE_STRIPE_PUBLISHABLE` to `pk_live_...` and push (or re-run the workflow).
5. One real purchase of the smallest gift, yourself. Refund it from Stripe's dashboard if you like.

## 6. Afterwards

- Cloudflare, Security, WAF, Rate limiting: a rule on `/checkout` (say 10 a minute per address).
- The cave sheep's words (`RECLUSE` in `src/games/sheep/flock.ts`, marked `TODO(owner)`).
- A card on the front page, when you want the game seen (`src/home/projects.ts`).
