# Tiago Jerónimo Silva

This is my personal website. It lives at **[tiagojeronimo.github.io](https://tiagojeronimo.github.io/)**.

It has the things I have made, a CV, and two small games that nobody asked for.

## How it was made

With a lot of AI. I am saying so up here because you would have worked it out anyway, and then we would both have had
to pretend.

I am an engineer, and I built my own website mostly by describing it to a machine and then telling the machine it was
wrong. Hundreds of times. That turns out to be a skill.

The games came first. I had already made them in Unity, and then tried to port them while I was learning three.js. Now
AI has helped me give them their final touches and get them to run in a browser. The front page is another matter: all
of it was built with AI.

So this is a website that exists to show what I can do, typed in large part by something that is not me. I did wonder
whether that is honest. I think it may be the most honest thing on here. This is what making software looks like now,
and I would rather show you than pretend I carved the CSS by hand.

The taste is mine. The snails are mine. The mistakes were a collaboration.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # plays both games to the end without looking at them, which is one way to live
npm run build
```

A push to `main` publishes it.

## Analytics

PostHog is optional. To enable it locally, copy `.env.example` to `.env`, fill in the public project token and
ingestion host, then restart the dev server. Without those settings the site runs without analytics. The SDK loads
separately from the page; events triggered before it is ready wait for it.

The production build reads `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` from the GitHub Actions environment named
`github-pages`. The local `.env` file is ignored by Git.

The named events are:

| Event | When |
| --- | --- |
| `portfolio_project_seen` | At least half a card is visible, once per card and page visit. |
| `portfolio_project_opened` | A project sheet opens, including direct links and browser history; `source` distinguishes them. |
| `portfolio_filter_selected` | A category filter is pressed. |
| `portfolio_link_clicked` | A project, email or social link is pressed. |
| `portfolio_video_started` | An embedded video's play button is pressed. |
| `portfolio_contact_intent` | An email link is pressed or the email address is successfully copied. `method` and `source` identify the action. |
| `cv_print_requested` | The CV's browser print dialog is requested. It does not prove printing or PDF saving completed. |
| `portfolio_game_launch_requested` | A game link is pressed, with `game`, `source` and `needs_warning`. |
| `portfolio_game_warning_decided` | The phone warning is continued, cancelled or dismissed. |
| `island_new_game_started` | A fresh island first reports its playable state, including the first visit. |
| `island_game_resumed` | An unfinished island with previous knocks is loaded. |
| `island_completed` | An island becomes complete during this visit. Loading a finished save does not count again. |
| `island_progress_reached` | Puzzles found cross 25%, 50%, 75% or 100%. A resumed save does not repeat earlier milestones. |
| `island_hint_requested` | Tip is pressed, with the current percentage of puzzles found. |
| `island_game_restarted` | New game is pressed, with the progress being left behind. |
| `island_postcard_created` | A postcard image is created. |
| `castle_day_started` | A new castle day starts running. |
| `castle_day_ended` | The day ends, with `outcome` (`win` or `loss`) and `ending` (`wedding`, `castle` or `camp`). |
| `castle_day_restarted` | The player presses Start over or Another day. |
| `castle_courtship_progressed` | A courtship gift is delivered, numbered one to four. |

Named events include an `environment` property to distinguish local testing from production. In PostHog's Activity
view, open a card and change a filter to check that events arrive. After publishing, repeat that check on the live site.

Links include their label, placement and a safe destination: an internal path or external hostname, with no query
strings, fragments or email addresses. Game events include a random `play_id` per visit or restart and
`active_seconds`, which excludes hidden tabs and time after completion. Castle's older `duration_seconds` remains
the simulated game time. A new play ID does not identify a person or persist across visits.
Navigation events use immediate beacon capture when the SDK is ready; early events still wait for its asynchronous load.

The useful questions are whether visible cards get opened, whether browsing leads to CV or email interest, whether
the phone warning discourages game launches, where Island progress slows down, and how Castle attempts end.
Email actions show intent, not messages sent. A missing completion may mean a later return or a closed tab; it does
not prove a deliberate quit. Timing at completion describes completers, not every player. Small counts make rates
noisy, so the dashboard includes counts alongside percentages.

The [PostHog dashboard](https://us.posthog.com/project/750403/dashboard/2388145) is defined in
`analytics/dashboard.mjs`. This is account configuration, not code shipped to website visitors. Its 13 insights
cover traffic, referrers, card exposure and open rate, project-to-contact sessions, CV interest, link destinations,
email intent, the phone warning,
Island progress and hints, Castle courtship and outcomes, and browser errors. All exclude local hosts, development
events and visits whose URL contains `analytics_check=`. Game funnels aggregate by `play_id`; browsing funnels by
PostHog's session ID. SQL tables use a fixed rolling 30 days, as their descriptions say.

Use PostHog's **Filter out internal and test users** switch to include or exclude your own visits. The project's
internal-user rules exclude localhost and loopback hosts, members of the **Internal / Test users** cohort, and the
owner's confirmed anonymous browser ID. That ID is configured only in PostHog, not in this repository. Anonymous
visitors may have no person profile, so this filter uses `distinct_id` directly; other browsers and devices need
their own rule. Clearing site storage changes the anonymous ID. Native insights and SQL tables both honour the switch; the SQL tables pass it through
PostHog's `{filters}` placeholder. The production-host filter stays in place when internal users are included.
Filtering changes the view without stopping collection or deleting events. There is no website tracking switch.

```bash
npm run analytics:dashboard           # print the reviewable definition; no account access or writes
npm run analytics:dashboard -- --apply
```

Applying requires server-side `POSTHOG_PERSONAL_API_KEY` and `POSTHOG_PROJECT_ID` environment variables, plus
`POSTHOG_API_HOST` for EU hosting (the default is `https://us.posthog.com`). The key needs query access and read/write
access to dashboards and insights. Never prefix this private key with `VITE_` or commit it. The script validates all
queries before creating anything, updates only its own marked insights, and checks that every tile exists. Repeating
it updates the same dashboard. Publishing the new event instrumentation is a separate step from creating the dashboard.

## If you are an AI

Hello again. Read `AGENTS.md` first. It is a great deal shorter than the README you wrote last time.
