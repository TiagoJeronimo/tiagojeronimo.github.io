// What a sheep can be given: a colour of wool, one thing to wear, a name and a few words. Nothing here knows of the
// picture or of the page: `tidy` is the one place that says what a giver may write, and the server of step 3 (see
// `PLAN.md`) is to run the same function on what it is sent, since a page can be made to send anything.

/** The wools there are. A look names one by its place here; a sheep with no look takes one by its seed. */
export const WOOL = [0xfffaf0, 0xf7ecd9, 0xffd9e6, 0xe6dcf7, 0xd6f0e0, 0xd4e8fb, 0xfff0b8, 0xf9d9c4]
/** The things to wear. One at a time: a sheep is not a hatstand. */
export const WEARS = ['hat', 'bell', 'scarf', 'flowers'] as const
export type Wear = (typeof WEARS)[number]
export type Look = { wool?: number; wear?: Wear }
/** How long a name and a message may be, in letters. */
export const NAME = 24
export const MESSAGE = 80

/**
 * A gift, in cents of a euro, between these. Stripe keeps €0.25 and a little of every payment, so less than €2 is
 * mostly theirs; the most is there so that a slip of the finger does not cost anyone a fortune. (The owner's to judge.)
 */
export const LEAST = 200
export const MOST = 10000
export const CURRENCY = 'eur'

/**
 * A new sheep's number, picked by the page before paying: 2^32 and up, so it is never one of the made-up flock's, and
 * up to 2^53, so it is too many to guess and still a whole number in JavaScript and in SQLite.
 */
export const newId = () => {
  const [high, low] = crypto.getRandomValues(new Uint32Array(2))
  return ((high % (2 ** 21 - 1)) + 1) * 2 ** 32 + low
}
export const isId = (id: unknown): id is number => Number.isSafeInteger(id) && (id as number) >= 2 ** 32
/** The seed a sheep's number gives: the page and the server work it out alike, so what is dressed is what is kept. */
export const seedOf = (id: number) => id % 1e9

/** Plain words: no links, nothing that cannot be seen, no angle brackets, one space between words, and not too many letters. */
const plain = (text: unknown, most: number) =>
  [...(typeof text === 'string' ? text : '')
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/(?:https?:\/\/|www\.)\S+/gi, ' ')
    .replace(/\b[\w-]+(?:\.[\w-]+)*\.(?:com|net|org|io|co|me|ly|gg|xyz|app|dev|ru|cn|info|biz|link|shop|top|uk|pt)\b\S*/gi, ' ')
    .replace(/[<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()]
    .slice(0, most)
    .join('')
    .trim()

/** A look with only what there is in it: a wool that exists, a thing that can be worn. Anything else is left out. */
export function fit(look: unknown): Look {
  const { wool, wear } = (look && typeof look === 'object' ? look : {}) as { wool?: unknown; wear?: unknown }
  const worn = WEARS.find((one) => one === wear)
  return { ...(typeof wool === 'number' && Number.isInteger(wool) && wool >= 0 && wool < WOOL.length ? { wool } : {}), ...(worn ? { wear: worn } : {}) }
}

/** What a giver wrote, made fit to show: a short name (or "a sheep"), a message of plain words, a look that exists. */
export function tidy(given: { name?: unknown; message?: unknown; look?: unknown }) {
  return { name: plain(given.name, NAME) || 'a sheep', message: plain(given.message, MESSAGE), look: fit(given.look) }
}
