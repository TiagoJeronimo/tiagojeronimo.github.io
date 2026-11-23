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

## 4. The owner's page, `/admin` (Cloudflare Access): done once, for the record

Zero Trust, Access controls, Applications, Self-hosted: two public hostnames typed with "Switch to custom input",
`sheep-api.<name>.workers.dev/admin` and `.../admin/*` (never "Add Workers": it would lock `/stripe` and `/checkout`
too), and a policy that allows only the owner's email. The application's AUD tag is in the login page's address
(`kid=`). Secrets: `ACCESS_TEAM` (the team's name, the name Zero Trust gave it), `ACCESS_AUD`, `ADMIN_EMAILS`. Login is with the
Cloudflare account itself, whose email must match `ADMIN_EMAILS`. Done when `/admin` shows the list.

## 5. Live money

1. Stripe: switch the account to live (it asks for your details and a bank account: that is Stripe's, not mine).
2. Repeat 2 with **live** mode: a live webhook endpoint on the same address, `payment_intent.succeeded` only.
3. `npx wrangler secret put STRIPE_SECRET ...` with a **restricted** live key (`rk_live_...`, the one permission
   PaymentIntents: Write: the worker only creates payments), and `STRIPE_WEBHOOK_SECRET` with the live endpoint's.
   The live webhook must be made in the live account itself (the sandbox has its own, apart); a payment with no
   endpoint to hear of it makes no sheep, and the buyer still sees theirs drop.
4. Change the GitHub variable `VITE_STRIPE_PUBLISHABLE` to `pk_live_...` and push (or re-run the workflow).
5. One real purchase of the smallest gift, yourself. Refund it from Stripe's dashboard if you like.

## 6. What is left (2026-11-23)

Done since: the rate limit on `/checkout` (ten a minute per address, a binding in `wrangler.toml`), the card on the front
page (a sign-off at its foot), the cave sheep's line, the worker's logs kept (`[observability]`).

- **TWINT** is under Stripe's review. It wants a legal-notice page with a full address; not wanted, so skip it.
- **PayPal**: connect it in Stripe (it asks to share details with PayPal) or leave it out.
- **A legal notice, terms and privacy page**: probably wanted for selling online from Switzerland or the EU; ask someone
  who knows. It says who you are, what is kept (a sheep's name and words are public), who takes the money (Stripe),
  the analytics (PostHog), and that tips are not refunded but for a mistake.
- **Two-factor** on Cloudflare (the `/admin` login is that account), Stripe and GitHub.
- **Stripe's emails**: for a payment, and for a webhook that fails, so that a payment with no sheep reaches you.
- **Hide** what should not be in the field, on `/admin`: a refunded or disputed payment's sheep stays until you do.
