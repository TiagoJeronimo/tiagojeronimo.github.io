// What a sheep can be given: a colour of wool, one thing to wear, a name and a few words. Nothing here knows of the
// picture or of the page: `tidy` is the one place that says what a giver may write, and the server (`sheep-api/`)
// runs the same function on what it is sent, since a page can be made to send anything.

/** The wools there are. A look names one by its place here; a sheep with no look takes one by its seed. */
export const WOOL = [0xfffaf0, 0xf7ecd9, 0xffd9e6, 0xe6dcf7, 0xd6f0e0, 0xd4e8fb, 0xfff0b8, 0xf9d9c4]
/** The things to wear. */
export const WEARS = ['hat', 'bell', 'scarf', 'flowers'] as const
export type Wear = (typeof WEARS)[number]
/**
 * What a very old sheep can be remembering, one at a time: each is a keepsake she has on (`KEEPSAKES` in `model.ts`).
 * And the colours of her blanket: a look's `wool` names one of these for her, since her own wool is past dyeing.
 */
export const MEMORIES = ['wedding', 'love', 'lamb', 'duck', 'hat', 'river'] as const
export type Memory = (typeof MEMORIES)[number]
export const BLANKETS = [0xc9b3e6, 0xf2a0a8, 0xf3c069, 0x9ed3b0, 0x9cc4f0, 0xe7a3cf, 0xc9a27c, 0xf4e3bd]
/** What each of those colours is called, where the card says which blanket she is under. */
export const BLANKET_NAMES = ['lilac', 'rose', 'honey', 'sage', 'sky', 'pink', 'fawn', 'cream']
/** What she is remembering, as it is said of her in the field. */
export const REMEMBERS: Record<Memory, string> = {
  wedding: 'remembering her wedding',
  love: 'remembering her first love',
  lamb: 'remembering her baby',
  duck: 'remembering the summer of the duck',
  hat: 'remembering the hat',
  river: 'remembering the river',
}
/**
 * `elder` is for the very old sheep that is had for nothing (see `plan`): pale, stooped and slow. It is the page's own
 * to say, of a sheep that lives in the page and nowhere else: `fit` leaves it out, so no server ever keeps one.
 */
export type Look = { wool?: number; items?: Item[]; memory?: Memory; elder?: boolean }
/**
 * What a sheep may have, of which a look names two at the most (`items`), in any mix: the things to wear, and the two
 * things a bigger gift can bring along, in either currency: from 5, butterflies about the sheep; from 10, a small dog
 * that follows it. Those two are the giver's to choose, of what the gift allows (`allowed`): the server keeps what was
 * asked for and paid for, and no more (a page cannot ask its way to one).
 */
export const EXTRAS = ['butterflies', 'dog'] as const
export type Extra = (typeof EXTRAS)[number]
export const ITEMS = [...WEARS, ...EXTRAS] as const
export type Item = (typeof ITEMS)[number]
export const isWear = (item: Item): item is Wear => WEARS.some((one) => one === item)
export const allowed = (cents: number): Extra[] => (cents >= 1000 ? ['butterflies', 'dog'] : cents >= 500 ? ['butterflies'] : [])
/** Whether a sheep can have two things at once: two that are not the same thing, and not the hat with the flowers, which are in the same place on its head. */
export const pairs = (one: Item, other: Item) => one !== other && !(one === 'hat' && other === 'flowers') && !(one === 'flowers' && other === 'hat')
/** What of a look's items is worn, and what of them came with the gift. */
export const worn = (look: Look = {}) => (look.items ?? []).filter(isWear)
export const extras = (look: Look = {}) => (look.items ?? []).filter((item): item is Extra => !isWear(item))
/** How long a name and a message may be, in letters. */
export const NAME = 24
export const MESSAGE = 80

/**
 * A gift, in cents (of a euro or of a franc), between these, whichever the currency. Stripe keeps 0.25 and a little of
 * every payment, so less than 2 is mostly theirs; the most is there so that a slip of the finger does not cost anyone a
 * fortune. (The owner's to judge. Stripe's own least is 0.50 in both.)
 */
export const LEAST = 200
export const MOST = 10000
/**
 * The currencies a gift can be in: euros, and Swiss francs, which TWINT (Switzerland's way of paying) takes and
 * nothing else. The first is the one when nothing says otherwise.
 */
export const CURRENCIES = ['eur', 'chf'] as const
export type Currency = (typeof CURRENCIES)[number]
export const isCurrency = (currency: unknown): currency is Currency => CURRENCIES.some((one) => one === currency)
/** How an amount is written in a currency: "€3", "CHF 3"; with `cents`, "€3.00", "CHF 3.00". */
export const money = (amount: number, currency: Currency, cents = false) => `${currency === 'chf' ? 'CHF ' : '€'}${cents ? amount.toFixed(2) : amount}`

/**
 * A new sheep's number, picked by the page before paying: 2^32 and up, so it is never the resident's (which is 1), and
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

/**
 * What comes of pressing the button, by the gift (in euros) and whether there is a server to pay through. A gift of
 * nothing at all is the very old sheep: one that is in the page for as long as the page is open, and is written down
 * nowhere, neither on a server nor in the browser; nothing is asked of anybody, and nothing is sent. With a gift and
 * a server, the checkout; with a gift and none, the stand-in of step 2, kept in this browser.
 */
export const plan = (gift: number, server: boolean) => (gift === 0 ? 'elder' : server ? 'checkout' : 'stand-in')

/** A look with only what there is in it: a wool that exists, two items at the most that there are and that go together, a memory there is. Anything else is left out. */
export function fit(look: unknown): Look {
  const { wool, items, memory } = (look && typeof look === 'object' ? look : {}) as { wool?: unknown; items?: unknown; memory?: unknown }
  const kept = MEMORIES.find((one) => one === memory)
  const got: Item[] = []
  for (const asked of Array.isArray(items) ? items : []) {
    const item = ITEMS.find((one) => one === asked)
    if (item && got.length < 2 && got.every((had) => pairs(had, item))) got.push(item)
  }
  return { ...(typeof wool === 'number' && Number.isInteger(wool) && wool >= 0 && wool < WOOL.length ? { wool } : {}), ...(got.length ? { items: got } : {}), ...(kept ? { memory: kept } : {}) }
}

/** What a giver wrote, made fit to show: a short name (or "a sheep"), a message of plain words, a look that exists. */
export function tidy(given: { name?: unknown; message?: unknown; look?: unknown }) {
  return { name: plain(given.name, NAME) || 'a sheep', message: plain(given.message, MESSAGE), look: fit(given.look) }
}
