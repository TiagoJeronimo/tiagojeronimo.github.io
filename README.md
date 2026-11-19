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
| `portfolio_project_opened` | A project card is opened. |
| `portfolio_filter_selected` | A category filter is pressed. |
| `portfolio_link_clicked` | A project, email or social link is pressed. |
| `portfolio_video_started` | An embedded video's play button is pressed. |
| `island_new_game_started` | A fresh island first reports its playable state, including the first visit. |
| `island_game_resumed` | An unfinished island with previous knocks is loaded. |
| `island_completed` | An island becomes complete during this visit. Loading a finished save does not count again. |
| `island_postcard_created` | A postcard image is created. |
| `castle_day_started` | A new castle day starts running. |
| `castle_day_ended` | The day ends, with `outcome` (`win` or `loss`) and `ending` (`wedding`, `castle` or `camp`). |
| `castle_day_restarted` | The player presses Start over or Another day. |

Named events include an `environment` property to distinguish local testing from production. In PostHog's Activity
view, open a card and change a filter to check that events arrive. After publishing, repeat that check on the live site.

## If you are an AI

Hello again. Read `AGENTS.md` first. It is a great deal shorter than the README you wrote last time.
