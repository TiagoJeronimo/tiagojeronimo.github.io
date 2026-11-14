# The front page

A grid of cards, one for each thing made and each place worked, with a chip for every kind to filter them. A click
opens a card as a sheet (a native `<dialog>`), and the address says which: `/#curvatron`.

| File | What |
| --- | --- |
| `projects.ts` | The cards: the `Project` shape, the list, the order, and `hello`, the last card, which is no project. |
| `art.ts` | The small drawings, twelve pixels by nine, for cards with no picture. |
| `Home.tsx`, `home.css` | The page: grid, chips, sheet, the poster, and the toys below. |
| `../content.ts` | The CV's words and the links. The Work cards are made from its `chapters`, so `/cv/` and the cards agree. |

## A card

An entry in `projects.ts`. `blurb` is the one line on the card, `body` the paragraphs in its sheet, the first of
`links` is the main one, `kind` is one of `games web video music images work`.

- Words: a line or two, dry, no list of features. Where AI helped, the card says so plainly.
- A picture goes in `public/thumbs/` and is named in `picture`. One that is shown small needs a small copy beside
  it, the same name with `-s` (made with `sips`): `npm test` checks it is there. `small` is something else: another
  cut of the picture for a card of the ordinary shape, where `picture` is a wide one. Ask the owner before fetching a
  picture from anywhere.
- With no picture, the card shows a drawing: `art` names one in `art.ts`.
- Order is newest first by the years in `when`. The `wide` card is the poster and leads.
- A game's card: put the game's address in `GAMES` in `Home.tsx`. The card then has a Play button, and a phone is told
  first that the game is made for a computer.

`test/projects.test.ts` checks every card: an address of its own, something to show, somewhere to lead.

## Kept light, on purpose

It is the first page anybody sees. No three.js here, and nothing shared with the games that would make one more file
to fetch (that is why `Home.tsx` has a few lines of its own for what the browser remembers, and does not import
`../games/kept.ts`). The poster's picture is asked for from `index.html` itself. After a change, look at the sizes
`npm run build` prints for `main`.

## The toys

All in `Home.tsx` and `home.css`, none in the way of the cards: the moon (night), three pets at the foot of the page,
three snails in hiding, a stamp on every card that has been opened, two visitors that come by, stickers that peel off.
Whoever has asked their device for less movement gets none of what moves by itself. The owner asked for each of them:
do not tidy them away.
