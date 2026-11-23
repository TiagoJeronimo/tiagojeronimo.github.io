# The sheep: "Buy me a sheep", at `/games/sheep/` (steps 1 to 4 of `PLAN.md`: built, not yet on the front page)

A small island in the castle's manner: a meadow with a high knoll, a pond with a duck on it, a mountain at the back
(a lumpy heap of rock with grass round its foot), a brook that runs out of the rock and down to the pond over little
steps, trees (some in blossom), rocks, a fence with two bales; the sheep going about at a hop (one resident, Claude the sheep, and whoever was given); and one
more in a lit cave in the back of the mountain.
A visitor can dress a sheep of their own and put it in the field, for nothing and in their own browser only. Built
with `VITE_SHEEP_API` set (the address of `sheep-api/`, the server of step 3), the page pays through Stripe and shows
everybody's sheep instead; the live site is built without it until step 5 of `PLAN.md`, which still holds the plan. How it looks
and how they move follows `../AGENTS.md`, "Look and movement": the first version did not, and was sent back.

## Files

| File | What |
| --- | --- |
| `Sheep.ts` | The world, no React. At its top: the numbers (`REACH SPAN ROUND REGROW DAY SLEEP WAKE HOP STEPS GLAD STONY SNOWY`); the water and the things by tile (`BROOK LAKE DUCK FENCE BALES CAVE FLOOR ROOF`); the land, worked out once (`LAND` heights, `ROCK` bare stone, `KIND` 1 ground 2 brook 3 pond 4 cave, `BLOCK`, `TREES ROCKS SHORE FALLS`); the parts (`EWE`, `BODY`, `HEAD`, and the scenery's). Then the class. |
| `model.ts` | The sheep as cubes, for the field and for the window it is dressed in alike: `EWE` (its eleven boxes), `WORN` (what it can wear), `BODY HEAD NOSE LEGS` (its measures), `AGED`, `KEEPSAKES` and `GREY` (the very old sheep's), `limbs` (its cubes in a pool: eleven, three for what it wears, two for horns), `clothe` (its look put on), `pose` (its cubes put where it is: the hop, the legs, the head, the ears); and the thought bubble: `BUBBLE`, `THINK` (the pictures), `LINES`, `speak` (its cubes put where it is). |
| `Fitting.tsx` | The window a sheep is dressed in: a small canvas of its own, a very small island with the sheep on it, no finish. |
| `dress.ts` | No three, no page: `WOOL` (the wools), `WEARS` (`hat bell scarf flowers`), `Look` (`{ wool?, wear? }`), `NAME` and `MESSAGE` (24 and 80 letters), `fit(look)` and `tidy({ name, message, look })`, which says what a giver may write (no links, plain words); the gift (`LEAST MOST`, and its currencies `CURRENCIES isCurrency`, written by `money`), a new sheep's number (`newId isId`) and its seed (`seedOf`). The server (`sheep-api/`) imports all of it. |
| `flock.ts` | An `Entry` is `{ id, seed, name, message, date, look? }`. `FLOCK` is the one sheep that is always in the field and that nobody gave: Claude the sheep (id 1, the test sheep; the owner's idea and name). It is first in `world.ewes`, with every given sheep after it. Also `RECLUSE`, the one in the cave, which is not in `FLOCK`: its line is a placeholder (a `TODO` there) until the owner writes it. |
| `crowd.ts` | `CROWD`: twenty made-up sheep. For the tests (`new Sheep(CROWD)`: play, chases, leaps, company), and in development only for `/games/sheep/?crowd`, to watch a full field. The page's use of it is behind `import.meta.env.DEV`, so it is not in what is published: keep it so. |
| `SheepPage.tsx`, `sheep.css` | The page: `Stage`; a click on a sheep (it hops, and a bubble sits over it: name, message, date, what it is doing now and what it has on); the button in the top bar, the card to dress a sheep (`.dress`), the line while one is being put down (`.place`); and this browser's own sheep, kept under `sheep/mine` (`mine`), or with a server (`API`) everybody's (`herd`), the checkout, and the wait for a sheep Stripe has not told the server about yet (`waiting`, `news`). |

## The world from outside

`new Sheep(list?, seed?)`; `update(dt)`, `shadows(tier)`, `dispose()`. A new sheep: `add(entry)` puts one straight in;
`bring(entry, x?, z?)` hangs one in the air (`guest`), `dress(look)` and `sign(entry)` change it, `hang(x, z)` moves it
over the nearest place it fits, `drop(x?, z?)` lets it go (it is in `ewes` from then, and the number comes back),
`dismiss()` sends it away, `room()` says whether there are cubes for one more. For the page: `pick(instance)`, `glad(i)`,
`doing(ewe)`, `ewes`, `hermit` (the cave's sheep: `pick` says `HERMIT`, -2, for it), `sky`, `dark`, `time`, `ground` (what the camera points at), `flock`. For tests: `height(x, z)`
(the bed, under water), `pond`, `blocked`, `long`, `bite`, `fits`, `bites`. In the dev server: `window.sheep`, `window.view`.

## How it goes

- A sheep's seed gives its wool, size (0.8 to 1), pace, nature (`greedy swimmer nosy follower`) and where it starts,
  through `rnd`: every visitor sees the same. Only what it does is by `chance()` from the world's seed, so a test can
  play a day again. (Petals, foam and dreams are `Math.random`: they decide nothing.)
- `fits(self, s, face, x, z)` is the one rule of where a sheep is: its body and head rectangles over level ground
  (`LAND` 1) or the brook, the body not over the pond (the head may be: that is how it drinks), off every `BLOCK`ed
  tile (trees, rocks, fence, bales, stump, reeds) and clear of every other sheep. No step or turn is made that does
  not fit, so nothing clips; `test/sheep.test.ts` proves it on the cubes.
- `choose` picks what to do: hungry, the long grass under its nose or the nearest; thirsty, the nearest free place
  in `SHORE`; then by nature (swimmers stand in the brook, followers and the nosy go up to a friend, and both hop
  when they meet); sometimes it only looks about; else it wanders. `go` sets off, `walk` takes a step, `arrived`
  and `rest` end it. A way is across then along (or the other way about): it goes the way it looks, turns standing
  between hops, and where the way is shut (`balk`) takes the other leg or stops. Given up after 16 seconds.
- `draw` puts the cubes: all of it up together at a hop (`stride`, `hop`), each leg down to what is under it (in the
  brook, to the bed, and all of it lower: see below), head down by `nod` to graze or drink, folded up by `lie` to sleep, ears up for a
  moment now and then (`flick`). A sheep that has not changed sends nothing to the graphics card (`mark`).
- Grass: level tiles with nothing on them. A bite (`bite`, the tile under the head) paints the slab `SHORT` and
  hides its blades and flowers; all are back after `REGROW` seconds and up to 15 more.
- A sheep is 11 boxes, on purpose few: legs, one box of wool, a short tail, a big dark head with a tuft of wool, low
  ears, a pink nose. No eyes (the owner had them taken off): it shows what it feels by moving, and its ears flick.
- The mountain is a round heap inside the edge (`mount` in the land), a step at a time on every side, so no face of
  it is wide and flat and grass lies round its foot. Its stone (`ROCK`: the mountain from `STONY` up) is clean grey,
  with lumps and loose stones on it and rubble on the grass below: no moss, no grass, no flowers; snow from `SNOWY`.
- Water is the island's (`Island.ts`, where a bed is laid): a whole tile of it to the tile, 0.44 deep on a bed, as
  see-through and with the same waves (but drawn as one piece: see `pour` below). The pond is that and the brook is that too, a tile wide, both with whole tiles for edges
  as on the island: no small pieces of bank cut into corners (the owner asked what they were). Reeds stand in the
  water at some of the pond's outward corners, and no sheep puts its head over those tiles. The brook starts in the rock and goes down one step at a time; a tile it steps down from
  (`DEEP`) holds a whole cube of water, down to the water below, so it comes down as blocks one under the next. No
  thin sheet, no drops streaming: a fleck of foam at each step now and then. No rock within three tiles of the
  fence and the hay.
- The brook can be waded: `height` gives its bed, and a sheep wholly in it stands 0.3 lower, up to its wool (`draw`).
- The cave is `CAVE`, four tiles in the back of the mountain: a floor at `FLOOR`, a hollow, rock over and round it at
  uneven heights, a step of grass before its mouth. In it a bed of hay, a stone, a lantern and two toadstools that
  glow, and a warm `PointLight`. Its sheep is drawn by the same `draw` (on `base`, its floor), hops when clicked,
  and never moves: `fits` and the flock know nothing of it.
- A look: `wool` is a place in `WOOL` (else the seed picks), `wear` one of `WEARS`. What is worn is up to three more
  boxes (`WORN`), on the three cubes every sheep keeps for it (`SLOTS`), drawn by the same `pose`: on the head and no
  further back than it (hat, flowers, the bell under an ear), or on the back with the body (the scarf). `BODY` is a
  little wider than the wool, for the scarf's end. The test's whole day has all four in the field.
- Buying (`SheepPage.tsx`, `Fitting.tsx`): the button in the top bar opens one card in the middle of the window
  (`.veil`, `.dress`: a dialogue, Escape or "Never mind" or a click beside it puts it away, Tab stays inside it),
  in two halves. On the right the sheep in a window of its own (`Fitting`: a small plain canvas with a very small island of the field's kind, earth under grass, blades and
  flowers in the wind, a little tree, a stone, a toadstool, all of it inside the frame and in the middle of it (the camera is fitted to a ball round the island, by the
  window's shape, and goes round the ball's middle; the canvas is measured by its own size, since the card pops up
  from small); and the sheep on it, drawn
  by `model.ts` as the field's are, hopping, nodding, hopping again and thinking something in a cube bubble when it
  is given a thing; the picture goes slowly all the way round, and a drag turns it; the sky and two clouds are the
  window's own, in CSS) and
  under it its wool and one thing to wear (each row with a small label over it, "Wool", "Wearing"), its name ("Your sheep's
  name") and a few words with their count ("What is the sheep thinking about?"), each with its label over it and
  a sheep's noise in the box for a hint ("Baa-a-a", "Baaa… meh"). On the left, from the top of the card, the gift (€3, €5,
  €10, or a number from `LEAST` to `MOST`), a line that says plainly what it is, what the sheep has on, and the
  button. On a narrow screen the halves are one over the other (the sheep, its looks, the gift), and the button
  stays at the foot of the card. Nothing is in the field while a sheep is dressed, and the view does not move.
  (Typing in the card does not move the view either: `View.ts` leaves keys typed into a text field alone.)
- The very old sheep (`plan` in `dress.ts`, `elder` in a `Look`, `AGED`, `KEEPSAKES` and `GREY` in `model.ts`; all
  of its words are in the card and nowhere else): a gift of nothing, by the quiet "€0" (the first of the amounts) or
  a 0 in the box. The card goes the colour of the end of an afternoon (`.dress.elder`: faded cream and lilac paper,
  a little gold round it), its window a dusk of peach and lavender with a small low sun, a wooden bench where the
  tree was, and the sheep in it old. The left half is "A very old sheep": five short paragraphs, dry first and kind
  at the end (who she is; her good life: grass, a river, a duck, a brief affair with a hat; tired, as after a nice
  day out; she dies, said once and softly, when the tab closes, because nothing keeps her: not a server, not this
  browser's memory; and the offer, on which it ends). By the owner's word the text never says that she is what a
  gift of nothing gets, never says what she will do in the field, and has no line about a better gift: a test
  reads the card for all three. The button is "Take her in". It never goes to `/checkout`, never to `localStorage`
  or `sessionStorage`, and leaves the address alone: the sheep is `bring`'s and the world's, in memory. One to a
  visit. `fit` leaves `elder` out of any look that comes from outside, so no server keeps one.
  - Her card has other rows than the others': "Blanket" for "Wool" (`BLANKETS`, eight colours; a look's `wool`
    names one for her: her own wool is `GREY` whatever is picked) and "Memories" for "Wearing" (`MEMORIES`, one at
    a time or none; a look's `memory`, which `fit` lets through if it is one there is). The bold line under the text says both, live: "A sheep, very old,
    keeping her memories to herself, under a lilac blanket." (`BLANKET_NAMES`; the name is real text, drawn in the
    blanket's colour made a little deeper so it reads on the paper; `woolOf` in `model.ts` says which blanket an
    unpicked one is). `give` in the page empties
    the look when the gift goes to or from nothing, since the rows are not the same rows. A memory is only ever
    drawn on a very old sheep, and a thing to wear never on her (`clothe`).
  - The memories, each a keepsake of six boxes at the most (`KEEPSAKES`): `wedding` (a veil of lace on her head, a
    posy at one ear, a gold ring at the other), `love` (a pressed flower over an ear, a pink sealed letter on her
    back), `lamb` (a very small lamb lying on her back: it rides, so that nothing of her is outside the two
    rectangles `fits` knows of), `duck` (a small duck sitting on her back; the pond's ducks do not land on her),
    `hat` (the straw hat), `river` (a blue stone on a string from her ear). Selected in the field, she is said to
    be "remembering her wedding" and so on (`REMEMBERS`), where another sheep is said to be in a hat.
  - How she looks (`clothe` sets `old` on the body; `pose` reads it): grey wool; a white beard under her chin; a
    knitted blanket over her back and down both sides with a pale fringe (`AGED`: six boxes, in the last places
    of `wear`, after the six for a keepsake); ears hung low (`DROOP`), head held a little down (`STOOP`) and never
    lower than her beard reaches the grass (`REACH`), hops less than half as high. No box of her is in another,
    in any memory, standing, hopping, head down or asleep: the test tries them all.
  - How she goes (`potter`): at 0.3 of her pace, long stands, a mouthful, a few steps to somewhere near; asleep
    where she is by night. She starts no game, runs nowhere, leaps nothing, is not leapt (`still`), chased or
    poked awake. A small gold glint over her now and then.
  - The others like her, which is the one special thing (`call`, `beside`, `fondly`, `BESIDE`, goal `visit`,
    `fond` counts it): a sheep with nothing to do goes and stands a step or two off her (from far off, a few tiles
    at a time), gives a small hop, and thinks a heart, a smile or a blush; one beside her mostly stays; six at
    the most, so she is not crowded; nobody runs within `BESIDE` of her (`haste` in `walk`); at night, once, a
    sheep goes to lie down near her. All of it by `chance()`, and none of it in a field with no old sheep in it.
  - Not to be added, by the owner's word: anything outside the card but the sheep herself, changes to the tab's
    title or icon, sound, or anything that gets in the way of closing the tab (no `beforeunload`). The earlier,
    darker idea for the free sheep (others ran from it) is gone, words and all: do not bring it back.
- What a sheep has: `Look.items`, two at the most of the six there are, in any mix (`ITEMS` in `dress.ts`: the
  four things to wear, `WEARS`, and the two a bigger gift can bring, `EXTRAS`: the butterflies from a gift of 5, the
  dog too from 10, `allowed(cents)`). `pairs` says which two go together: not the same thing twice, not the hat with
  the flowers, which are in one place. `fit` keeps the first two that are real and go together; the worker then drops
  an extra that the money that came does not allow, and never adds one. `worn(look)` and `extras(look)` split the
  list. `clothe` puts on the parts of what is worn: five boxes at the most, in the six kept (a test says so of
  every pair). The very old sheep has none of this: one memory. Extras are drawn by `model.ts` for the field and the
  window alike, in a pool of their own (`pets` in `Sheep.ts` and in `Fitting.tsx`); `pet(e)` makes them wherever a
  sheep joins `ewes`.
  - In the card, one row of seven chips at one spacing ("nothing" and the six): `don` keeps two at the most (a
    third takes the earlier one's place, a tap on one that is on takes it off, the hat and the flowers take each
    other's place, "nothing" clears). The butterflies and the dog are shut (disabled, dim, with the gift they take:
    `money(5, currency)`) until the gift is that much; `give` lets go of one when the gift goes back under it.
    Nothing is ever chosen for the giver.
  - `butterflies` (from 5): three to a sheep (`swarm`, `flutter`, `flits`), each in a slow loop round it, out past
    the thought over its head and above its hat, wings going. They have no state: where they are is the time.
    They are in nothing of their own sheep's (the test says so); a tree or a neighbour's thought they may brush.
  - `dog` (from 10): `PUP` (thirteen boxes, three of them the marks over its head when it barks), `kennel`, `hound`;
    in the world a `Dog` in `dogs`, moved by `heel`. It is on the ground by the sheep's rule: `sits` is its `fits`
    (level grass only, no water, clear of blocks, tufts, every sheep, every dog), `fits` and `plantable` mind its
    `rect`, and it goes at a hop, the way it looks, across then along. It keeps near its sheep (behind one that is
    walking), barks at another sheep near by (which turns to look, with a `what` over it: `wuffed`), and when its
    sheep stands it jumps up on its back for a few seconds (`jump`, `up`, `down`: by a clock, up first and then
    across, its sheep `pinned` the while, its `rect` nowhere; `rode`). It lies down when its sheep sleeps, and is
    `away` until its sheep has landed. The bark is three yellow marks, not the word: words cannot be cubes.
- A sheep's card (`.bubble` in `sheep.css`, the markup in `SheepPage.tsx`): four kinds of thing, kept apart. Its
  name, with a small square of its wool; what its giver wrote, set in as a thing said (the main thing; none, for the
  sheep in the cave, until the owner writes it); small tags for what it is doing (green, `doing(e)`) and for each
  thing it has (lilac, with the chip's picture; for the very old sheep, her memory); and "Arrived" with the date,
  small. What it is doing stays on the card for `HOLD` (3.5 s) once written, whatever the sheep does underneath.
- Calm (asked for by the owner: the label on a card changed every second or so). Measured over three days of
  twenty sheep, a `doing` label lasted a median of 1.1 s, and 93% of them under 5 s; it is now 8 s, and 23%. What
  did it, and is to be kept: `rest` is 4.5 to 11.5 s; a mouthful is 6 to 10 s, a drink 6 to 9; they sleep from
  `SLEEP` 0.75 to `WAKE` 0.7 of the dark (about 30 s); `go` does not begin a walk whose first move does not fit
  (`begins`): the sheep stays as it is, and backs off half a tile (goal `back`, the one time it does not go the way
  it looks) or turns, to make itself room, since a sheep hemmed in against a bank or a tree used to try the same
  walk for ever; one that is hungry goes to where its nose will be over the grass, not to the middle of the tile;
  one that is thirsty and did not get there tries another third of the bank, and every fourth time wanders
  (`dry`). `doing` says "leaping over a friend" from the stamp to the landing, "playing chase" for both of a game,
  "grazing" for the last step or two to the grass, and "off for a snack" for the planted grass. So that the field
  is not sleepy for it, a sheep that does think is likelier to play (leap, zoom, chase, sniff: the odds in `choose`).
- The card's two buttons (`.dress .foot`): small (36 px), side by side on one line at every width, as tall as each
  other and on the same 3 px lip. If a label will not fit, the label is made shorter: they never stack.
- "Put it in the field": with no server (`VITE_SHEEP_API` unset) nothing is charged and the card says so; the entry
  goes through `tidy`, is kept in this browser, the address is made `?sheep=<id>` as Stripe's return makes it, and
  the sheep comes to hang over the field (`bring`: `ALOFT`, 6 over the grass, the yellow arrow of `../basics.ts`
  over it, always over a place it could stand, and from the cursor). With a server, Stripe's Payment Element is in
  the left half of the card from the moment it opens, under the gift (`paid`, `counter`, `elements`; Stripe.js from
  `js.stripe.com` by a script tag the first time the card opens, never on page load; the publishable key
  `VITE_STRIPE_PUBLISHABLE`, and the card says so if there is none). No payment exists until the button is pressed
  (Stripe's deferred intent): a gift that changes is `elements.update`d, and one outside `LEAST`..`MOST` fades the
  form, disables the button and says why in the card's line. Not for the very old sheep: her card has no form.
  The gift is in euros or Swiss francs (`currency`; `CURRENCIES`, `money` in `dress.ts`): francs to start with for
  a browser whose language says Switzerland (`de-CH`, `fr-CH`, Swiss German) or whose clock is Zurich's, whatever its language,
  else euros (`homeCurrency`); a small switch, "€ | CHF", at the end of the gift's heading changes it, and the pick
  is kept (`sheep/currency`). The numbers stay; their sign follows ("€3", "CHF 3"); `LEAST`..`MOST` holds in both.
  Without a server it is always euros and there is no switch, so the live site is as it was. The
  button: `elements.submit()` (Stripe checks what was typed), `/checkout` (the worker makes the PaymentIntent),
  `confirmPayment` with `redirect: 'if_required'` (3-D Secure asks in a window over the page). Meanwhile the looks
  and the gift are locked (`inert`) and the card cannot be put away (`held`). Paid, the sheep as it was sent comes to
  the same hanging at once, from what the page knows, with no wait for the server; Stripe tells the worker in its own
  time, for everybody else. A way of paying that must go to a bank's page comes back to `?sheep=<id>` (with Stripe's
  own parameters, which the drop clears), and from there as below (`waiting`, `news`). The form is dressed as the
  card (`APPEARANCE`: the card's paper, ink, pink, corners and the page's letters, `FONTS`). The ways of paying are
  whatever the owner has switched on in Stripe's dashboard and suits the currency, the amount and the giver (the
  worker's PaymentIntent asks the same), as rows, one open under the one picked, three and then "More" (Klarna and the rest live there)
  (`layout: accordion`; tabs hid all but two behind a small menu), in the order of `ORDER` (card always first, then TWINT, MB WAY,
  the wallets, PayPal: one list for both currencies, so the second row follows the giver: TWINT takes only francs, MB WAY only euros and Portugal); no Link
  (it asks for an email and a telephone, and doubles the card's height). A refusal (a declined card) is Stripe's own
  words in the card's line, with "Nothing was paid." Taken but still settling (`processing`): the card goes, and a
  line says the sheep comes once it is paid (`news`). Back from a way of paying that went away (PayPal, TWINT, a
  bank), Stripe's `redirect_status` says how it went (`returned`): `succeeded`, the sheep is waited for as before;
  `processing`, the settling line; anything else, a line that nothing was paid, with "Try again", which opens the
  card anew. For those two the address is put back plain at once. A click drops it (`drop`:
  it falls under `GRAVITY`, by how long it has fallen and so the same at any frame rate; then a puff, a heart, a
  hop), its bubble opens, and the address is put back. The place is not kept: on the next visit the sheep stands
  where its seed says. The field has cubes for `SPARE` (8) more sheep than it began with; after that the button
  says the field is full.
- Life (all of it by `chance()`, so a seed plays the same day again; `did` counts each thing as it happens):
  - **Play**: the zoomies (`zoom`: two or three fast runs, ears up); chase (`mate`, `lead`, `fun`: one runs, the other
    runs at it, and at every bump they hop and change over; `play` is the next move, `part` lets go of both, whichever
    stops, and night stops it). A run is the same walk, faster (`rush`): hop, quarter turns, across then along, `fits`.
  - **Leaping** (`leap`, `vault`, `still`, `blocker`; `did.leap`, and of those `cross` and `lark`, and `frog`): a
    sheep goes over another, up on to its back (`UP`), a moment on top with a bounce (`ATOP`), and down the far
    side (`DOWN`), by how long it has been at it, so the same at any frame rate. Out of impatience: one whose way is
    shut a second time by a sheep that is only standing there stamps, pulls a face (`vexed`) and goes over, and on
    with its errand. For the fun of it (`lark`): a playful one goes and stands square on to a friend (`vault`) and
    leaps it; and sometimes the one leapt takes its turn over the leaper, and so on: leapfrog (`frogs`). Only over
    one that is `still` (on its feet, standing or head down, nothing else going on, no duck), straight ahead, with a
    place just beyond where the leaper `fits` and nothing else on the way; one leap at a time in the field, none
    while a duck is on the wing. While it is in the air the leaper keeps the whole stretch from where it left to
    where it lands (its `rect` is that), the one underneath is `pinned` (it stays as it is, and does not hop), and
    wherever any of the leaper is over the other it is no lower than the top of the other (hat and all). The test
    checks every cube at every step of every leap.
  - **Night**: one that likes company waits to see who lies down first, then goes and lies beside it (`nap`); a nosy
    one goes and wakes a sleeper, which starts up with a hop (`poke`). Each sheep thinks of it twice a night at most.
  - **Big grass** is planted by the visitor, and never comes up by itself. A click anywhere on the land
    (`plant(x, y, z, now?)`, with the point that was hit) puts a tuft on the tile that was clicked if it is
    `plantable`, and else on the nearest tile that is, within three tiles: so a click on the pond plants on its
    bank, one on a sheep beside the sheep, one on a tree beside the tree. `plantable`: dry ground of any height
    (meadow, slope, knoll, rock, snow) with nothing standing on it (`bare`: no tree, rock, lump, rubble, fence or
    bale; flowers and blades do not count, they hide while the tuft stands), no tuft, and no part of a sheep over
    it (a sheep beside it is no matter). Only with nothing near at all does a small puff say no. The tuft stands at
    its tile's own height. `PAUSE` (0.35 s, by the clock on the wall: `now`, which tests give) between two;
    `TREATS` (5) at the most, and then the oldest goes; each stands `RIPE` (60) seconds; every eighth, by a count
    and the world's seed, is golden.
  - **What the sheep do about it**, none of it by chance beyond the world's own: the nearest three that notice run
    for it (`after`; the greedy from further), and anybody with nothing to do who sees one goes too, up to four a
    tuft, day or night (`scent`): so a row of tufts is a trail, followed one after another. No sheep is over a
    tuft's tile (`fits`). The first with its nose at it eats it (`sniffs`); a nosy one sends up petals as it does;
    one beaten by a nose bumps and hops, and the rest are put out; a golden one sets everybody near hopping, and
    its eater has sparks round its head for a while (`crown`). One planted right beside a sleeper wakes it with a
    start. One up a slope or on the rock cannot be got at: a sheep runs to the nearest place it can stand, looks
    up at it with a "?" and a hop, and does not come back to it (`gazed`).
  - **The page**: a click with a sheep's bubble open only closes the bubble; while a sheep is dressed or put down a
    click is that flow's. The field's own hint, "Click the grass to plant a snack", is in the shared `.hints`
    style at the foot of the window and goes once a tuft has been planted (`g` in `sheep/known`): `Hints` itself
    has a fixed list, and is not the sheep's to change.
  - **Nothing shows where a click will plant, or that it will**: no marker on a tile, no lit tile, nothing at the
    cursor. The owner had a frame, then a lit tile, then a small tuft at the cursor, each taken out in turn.
  - **Water**: in the brook a sheep splashes (`splash` state: a hop and drops at a time), and may call a friend over
    (`ford` finds the stretch). Anybody may, swimmers often.
  - **Ducks** (`ducks`): three go round the pond a third apart, one sits on a level stretch of the brook in the
    rocks; each has its tail up now and then. When a sheep starts to drink, a duck may fly to its back (`rider`), ride
    for a while (the sheep stays put, and hops), and fly home. That is how "fly to their back" was read.
  - **Small things**: a sheep smells a flower under its nose and petals go up; two birds on the fence's end posts;
    fireflies at night over the pond and before the cave. (A sleeper has no bubble: the bits of its dream are enough.)
  - **Thoughts** (`say`, `said`, set by `think`): a picture in a thought bubble over a sheep's head for a moment
    (faces: `smile blush oh gasp sweat stars`, each a round yellow face with dot eyes, pink cheeks and a mouth; and
    things: `heart grass note spark drop bang what flower`, the heart and the drops with a glint on them). The bubble is the island's, box for box, of
    cubes in the world (`BUBBLE`, the pictures in `THINK`, drawn by `bubbles` from a pool of `THOUGHTS`, six, in
    the ground's cubes): paper white, a slab with its corners off, two crumbs down to the thinker, a picture of a
    few boxes standing proud of the paper; it pops up on the cubes' own spring, bobs and breathes as the island's
    does, and faces the quarter turn nearest the camera (`watch(yaw)`, from the page), since cubes do not turn. It
    is over its own sheep, higher than the top of any sheep at the top of any hop, and gives way to another bubble
    too near, to a sheep coming down out of the sky near by, and to a duck on the wing: so it is in nothing, and the
    test says so. None over a sleeper or a sheep with a duck on it; none over the sheep whose own bubble with its
    name in is open, and none while a sheep is dressed or put down (`hush`, from the page). The bubble with a
    sheep's name and words in it cannot be cubes: it is on the page (`.bubble`), in the same paper and with the
    same two crumbs.
  - A sheep on an errand that finds its way shut tries the other way round twice (`tries`) before it gives up.
- The water is one mesh (`pour`), not a box a tile: the top of every tile and a side only where the brook steps down.
  Boxes of see-through water showed every join, since each drew its sides inside the water. It still is whole blocks
  of water as far as anything else knows (`height`, wading).
- The door in the mountain (`PORCH`, `TRAIL`, `door`, `knock`, `latch`, `portal`, `DOOR` = -3): on the side seen
  first, to the right, a small round-topped door of planks in a frame of stone, set in a block of rock over a clean
  step of stone, half behind a boulder, with a lantern, hoof marks on the step and a trodden path over three tiles
  of meadow up to it (walkable, nothing grows on them, not grazed). Nobody can stand on the step. On the planks,
  standing proud of them: a gold knob, a lock with a keyhole, and an L in gold (fifty in Roman numerals: an
  upright and a foot; it was XX first, and the owner changed it). It is locked and never opens (the owner's word): a click (`glad(DOOR)`) rattles it on the cubes'
  spring with a little dust, and that is all. Its cubes are the ground's, with `DOOR` for their owner; the page
  asks `portal`, for the pointer over it and the click. It has no bubble (the owner's word): `latch()`, "a locked
  door", is all it has to say, and nothing shows it. It is not in `ewes` or `FLOCK`.
- The day is `DAY` seconds (180): bright, dark in the middle (`dark`, a wave squared: dusk and dawn are slow, the
  deep of the night brief). A visit begins at `MORNING` (0.78 of the way round: a little after sunrise), not at
  noon. The light goes by `LIGHT`, a table of stops at the top of `Sheep.ts` by how high the sun
  stands (noon is 2.75 for the sun and 1.12 for the soft light, on purpose under the castle's 3.2 and 1.25: the
  owner found the open meadow too bright at those): blue night, violet, rose with a low orange sun, gold, clear day, and the same way back at dusk. The sun is
  high at noon and low at sunrise and sunset (long shadows), and nothing jumps: the test holds every light value to
  a change of under 0.006 a step, over the end of one day into the next. Fireflies thicken and thin with the dark.
  `new Sheep(list, seed, start)` begins at a time of day; the page keeps the time in `sessionStorage`
  (`sheep/time`) and begins there again, so that a reload (or the dev server putting the page together again) does
  not leap from midnight to noon. Sheep lie down above `SLEEP` (0.9) and get up below `WAKE` (0.85): each sleeps about
  half a minute of the day, and the test holds it to between 15 and 35 seconds. Fireflies are out above 0.6.
- With a server (`VITE_SHEEP_API`): the page waits for `GET /sheep` before it builds the field: Claude the sheep, and with it
  every sheep that comes back (none, if the server is down: Claude is there all the same); a new sheep's number is `newId` and its seed `seedOf` it; "Put it in the field" posts the sheep and
  the gift (an input in euros, `LEAST` to `MOST`) to `/checkout` and pays in the card (above); back at `?sheep=<id>`, that
  sheep hangs to be dropped, or if it is not in the list yet the page asks again for 15 s (`waiting`) and then says
  so (`news`: `late`). Nothing is kept in this browser then.

## Still to do

Step 5 of `PLAN.md` (the admin page of step 4 is in `sheep-api/`); a card on the
front page (not until the owner says); more residents in `flock.ts` (it is one, by his word). For the owner to judge: every default of steps 2 and 3,
listed in `PLAN.md`.
Not yet judged by the owner: round 3 (the heaped mountain, water as cubes, sheep without eyes, the cave). The cave sheep's line is his to write. Known and left: legs pass through blades of grass, as in the castle.
