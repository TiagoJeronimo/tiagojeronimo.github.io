-- Every sheep somebody paid for. `session` is Stripe's checkout session, unique, so that the same news from Stripe
-- twice puts in one sheep. `hidden` is for the admin page (step 4): it hides a message and keeps the sheep.
CREATE TABLE sheep (
  id INTEGER PRIMARY KEY,
  session TEXT NOT NULL UNIQUE,
  seed INTEGER NOT NULL,
  look TEXT NOT NULL DEFAULT '{}',
  name TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  amount INTEGER NOT NULL,
  created TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  hidden INTEGER NOT NULL DEFAULT 0
);
