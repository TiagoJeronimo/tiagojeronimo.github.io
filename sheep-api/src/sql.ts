// Every word of SQL the worker says, and nothing else: to move off D1 (to Turso, or Postgres on Vercel) is to change
// this file. `Db` is the little of D1's binding that is used, so the tests can hand in node's own SQLite instead.

export type Statement = {
  bind(...values: unknown[]): Statement
  all<T>(): Promise<{ results: T[] }>
  first<T>(): Promise<T | null>
  run(): Promise<{ meta: { changes: number } }>
}
export type Db = { prepare(query: string): Statement }

export type Row = { id: number; seed: number; look: string; name: string; message: string; date: string }

/**
 * Every sheep, oldest first. A hidden one stays in the field, since somebody paid for it, but says nothing: its name
 * and message are left out (hiding keeps the sheep, since somebody paid for it).
 */
export const flock = (db: Db) =>
  db
    .prepare(
      `SELECT id, seed, look,
         CASE hidden WHEN 0 THEN name ELSE 'a sheep' END AS name,
         CASE hidden WHEN 0 THEN message ELSE '' END AS message,
         substr(created, 1, 10) AS date
       FROM sheep ORDER BY created, id`,
    )
    .all<Row>()
    .then((done) => done.results)

export const taken = async (db: Db, id: number) => !!(await db.prepare('SELECT 1 FROM sheep WHERE id = ?').bind(id).first())

export type Kept = { id: number; name: string; message: string; amount: number; currency: string; created: string; hidden: number }

/** Every sheep for the admin page, newest first, words and all, hidden or not. */
export const ledger = (db: Db) =>
  db
    .prepare('SELECT id, name, message, amount, currency, created, hidden FROM sheep ORDER BY created DESC, id DESC')
    .all<Kept>()
    .then((done) => done.results)

/** Hides a sheep's words, or shows them again. The same twice is the same. */
export const hide = (db: Db, id: number, hidden: boolean) => db.prepare('UPDATE sheep SET hidden = ? WHERE id = ?').bind(hidden ? 1 : 0, id).run()

/** Puts a sheep in. @returns false if this payment's sheep is in already (Stripe said so before). `session` holds the
 * PaymentIntent's id (it held a Checkout Session's, once). */
export const put = async (db: Db, sheep: { id: number; session: string; seed: number; look: string; name: string; message: string; amount: number; currency: string }) =>
  (
    await db
      .prepare('INSERT INTO sheep (id, session, seed, look, name, message, amount, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (session) DO NOTHING')
      .bind(sheep.id, sheep.session, sheep.seed, sheep.look, sheep.name, sheep.message, sheep.amount, sheep.currency)
      .run()
  ).meta.changes > 0
