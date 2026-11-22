# Buy me a sheep: the plan

Brainstormed with the owner on 2026-11-22. Steps 1 to 3 of the build order are built (see `AGENTS.md` beside this,
and `sheep-api/AGENTS.md` for the server); the rest is still the plan.

## The idea

A third game in the same style as the island and the castle: a big field of pastel cubes with mountains, a river,
grass and a tree or two. It is also the site's way to take donations. Anyone can give what they like, and every gift
adds a sheep to the field. The giver dresses the sheep and leaves a short message. A click on any sheep shows its
message in a bubble. Every sheep in the field was put there by somebody. They wander, flock, drink at the river and
eat the grass.

Working name: "Buy me a sheep". It's a coffee, but woolly.

## Decided

- **Payments: Stripe directly**, not Ko-fi or Buy Me a Coffee. The fee is only Stripe's (below), Apple Pay and Google
  Pay come with it, and it is the only option that sends the donor back to the game afterwards. The cost: no PayPal.
- **Server: one Cloudflare Worker with a D1 database**, on the free plan. Vercel's free Hobby plan is for
  "personal or non-commercial use", and taking money for a sheep is at best a grey area there, so Vercel would mean
  Pro at about $20 a month.
- **The site stays on GitHub Pages** at `tiagojeronimo.github.io/games/sheep/`. The worker has its own address, which
  visitors never see.
- **Order: dress, pay, place.** The sheep is dressed in the game's own UI first, then paid for on Stripe's page, and
  placed only once the donor is back.
- **The spot is not stored.** Placing is a moment for the donor: their sheep hangs from the cursor and drops where they
  click. For everyone else each sheep starts at a spot picked from its seed, so a crowd never piles onto one favourite.
- **Messages show at once.** The owner reads them later on a private admin page, where delete hides the message and
  keeps the sheep, because somebody paid for it.
- **Portable.** Plain web-standard request handlers and all SQL in one small file, so the worker can move to Vercel
  (with Turso or Postgres) in an afternoon.

## Step 2, as built: defaults for the owner to judge

None of these was decided with him. Each is small and easy to change.

- **Wool**: the eight pastel wools the made-up flock already had (`WOOL` in `dress.ts`). No wool chosen: the seed picks.
- **To wear**, one at a time: a straw hat, a bell (under one ear), a scarf (red, over the back), flowers (three, on
  the head). Or nothing. No gift unlocks anything.
- **Name**: optional, up to 24 letters; none is "a sheep". **Message**: optional, up to 80 letters. Links, angle
  brackets and invisible characters are taken out of both (`tidy`); nothing else is judged.
- **No amount, no minimum, no payment form**: one button, "Put it in the field", and a line that says paying is not
  built and the sheep lives in this browser only.
- **The words**: the button in the top bar is "Buy me a sheep"; the card is "A sheep of your own"; while placing,
  "Click where it should land. It will wander off anyway."
- **Placing**: the sheep hangs over the nearest place it could stand, so what is seen is where it lands; a click
  anywhere drops it there. It cannot be moved afterwards.
- **Kept**: in `localStorage` (`sheep/mine`), until step 3. Eight new sheep to a visit, then "The field is full for now".
- **The bubble** says what a sheep has on, after what it is doing.
- A few of the made-up flock were given looks, so that the field shows them.

## Step 3, as built: defaults for the owner to judge

- **The gift**: €2 to €100 (`LEAST`, `MOST` in `dress.ts`), in euros only, €3 filled in. Stripe's page says "Donate".
- **The sheep's number** is picked by the page (`newId`, 2^32 to 2^53, random) and its seed is that number's last nine
  digits, so what is dressed is what comes back. Two checkouts with one number: the second sheep gets a new one.
- **The field, with a server**: only the real sheep; the made-up flock only while there are none (or the server is
  down). One real sheep means a field of one.
- **Hidden** sheep stay in the field as "a sheep" with no message, as decided above (the brief for step 3 said to
  leave them out: the plan won).
- **Back from Stripe before Stripe's word**: the page asks again every 1.5 s for 15 s, then says to look again in a
  minute. The words: "Paid on Stripe's page, from €2. It is a donation; the sheep is the thank-you, and it stays."

## Still to decide

- **The choices when dressing**: a few colours and three or four things to wear (hat, bell, scarf, ...)? Does a bigger
  gift unlock something, like a golden bell from €10, as a thank-you and not a sales pitch?
- **A minimum gift.** Stripe's fixed €0.25 eats small gifts: €1 keeps €0.73, €3 keeps €2.70. €2 or €3 is suggested.
- **Can a donor ever move their sheep later?** Suggested: no. It walks about anyway.
- **A big crowd**: at 500 sheep the field is a carpet. Older sheep could gather into a flock on the far hill, or the
  field could be larger than the screen.
- **Names**: shown only if the donor gives one; otherwise "a sheep".
- **The words on the page**: plain that this is a donation and the sheep a thank-you, in the site's voice.

## How it fits together

```
game (GitHub Pages) ──GET /sheep──────────▶ worker (Cloudflare) ──▶ D1: table sheep
game ──POST /checkout──▶ worker ──▶ Stripe checkout ──▶ donor pays
Stripe ──POST /stripe (signed)──▶ worker: saves the sheep
Stripe ──returns donor to──▶ /games/sheep/?sheep=<id> ──▶ game: the donor drops their sheep in
owner ──/admin (behind Cloudflare Access)──▶ worker: list messages, hide one
```

| Call | Who | What |
| --- | --- | --- |
| `GET /sheep` | the game, on load | every sheep: id, seed, look, name, message, date. No spot. Cached for a minute. |
| `POST /checkout` | the game, on Buy | takes the id the game picked, the look, name, message, amount; creates a Stripe Checkout Session with them in `metadata`; returns its address |
| `POST /stripe` | Stripe | checks the `Stripe-Signature` (Web Crypto, no SDK); on `checkout.session.completed`, saves the sheep. Must be safe to receive twice. |
| `/admin` | the owner | messages, newest first, with a hide button. Cloudflare Access puts an email code in front of it. |

- **Table `sheep`**: `id`, `session` (Stripe's, unique), `seed`, `look` (JSON), `name`, `message`, `amount`,
  `created`, `hidden`.
- **Returning donor**: the game finds `?sheep=<id>` in the list, retrying for a few seconds in case Stripe's call is
  slow, and offers the drop. If the donor closed the tab, the sheep is in the field anyway.
- **Guards**: messages up to about 80 characters, links stripped, names short. The server checks this too, not only
  the game. CORS allows only the site's origin.
- **Secrets** (Stripe key, webhook secret) live in Cloudflare's settings, never in the repo or in `VITE_` variables.
- **No new npm packages for the site.** The worker talks to Stripe with `fetch`. `wrangler` (Cloudflare's tool) is
  needed to deploy: ask before adding it, and write the lock file with npm 11.19.1 (see the root `AGENTS.md`).
- **Where the code goes**: the game in `src/games/sheep/` and `games/sheep/index.html`, built from the shared kit like
  the castle. The worker in `sheep-api/` at the root, with its own `wrangler.toml` and tests.

## The game

- The field: a world of `Cubes` like the others: grass, a river with a bank, mountains at the back, a tree or two.
  The same view, gestures, hints and corners as the other games.
- Each sheep's seed decides its colour, size and nature (greedy, a swimmer, nosy, a follower), so every visitor sees
  the same sheep. Only the walking is worked out on each machine.
- What sheep do: wander, follow each other into small flocks, drink at the river, eat grass (which goes short and
  grows back), bump, sleep at night.
- A click on a sheep shows a bubble: the name, the message, and when it came.
- Until money flows, a few of the owner's own sheep live there, so the field is never empty.
- A world class that steps in node, with `test/sheep.test.ts`, as the other games have.

## Build order

1. (Built.) The field and sheep wandering, with made-up sheep from a local list. The owner judges whether watching
   them is fun.
2. (Built.) Dressing a sheep, the bubble, and the drop after a fake return.
3. (Built, locally; not yet tried against Stripe itself.) The worker and D1 with `wrangler dev`: `GET /sheep`,
   `POST /checkout`, `POST /stripe`, in `sheep-api/`. The page uses it only when built with `VITE_SHEEP_API` set, so
   the live site is still step 2's. For the owner, to try it with Stripe's test mode: make a Stripe account (test mode
   needs no bank details), copy `sheep-api/.dev.vars.example` to `.dev.vars` and paste the test secret key, run the
   four commands in `sheep-api/AGENTS.md`, put the `whsec_` that `stripe listen` prints into `.dev.vars` and restart
   the worker, then buy a sheep with card 4242 4242 4242 4242. No Cloudflare account is needed for this.
4. The admin page behind Access.
5. Live: the owner's accounts and keys, Stripe in live mode, a card on the front page.

The owner makes the accounts, since they hold his money and identity: **Stripe** (live mode needs his details and a
bank account) and **Cloudflare**. Keys are pasted into Cloudflare's dashboard by him, not into a chat.

## Costs (checked 2026-11-22, for a Stripe account in the eurozone)

- **Stripe**, per payment: 1.5% + €0.25 for standard EEA cards, 2.8% + €0.25 premium EEA cards, 2.5% + €0.25 UK cards,
  3.15% + €0.25 other cards (+2% for a currency change). Apple Pay and Google Pay cost the same as the card behind
  them. No monthly fee. Other countries' accounts have other rates.
- **Cloudflare free plan**: 100,000 worker calls a day, 10 ms of CPU per call, D1 with 5 million rows read and
  100,000 written a day and 5 GB stored, Access free up to 50 users. Over a limit, calls fail until midnight UTC; data
  is kept and nothing is billed. The paid Workers plan is $5 a month.
