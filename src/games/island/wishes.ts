import { note } from '../../sound.ts'
import type { Critter } from './critters.ts'
import { BARK, GROUND, NEAR, NEVER, WOOD, any, step, tx, tz, type Thing } from './grid.ts'
import type { Island } from './Island.ts'

/**
 * Somebody in the friend book. Every one of them has a wish: to begin with, a pat. A few have a second one,
 * for something from somewhere else in the world. When they have had all they wished for, the book says what became of them.
 */
export interface Friend {
  /** The kind of animal, or the name some of them go by. */
  id: string
  name: string
  /** A word about it, shown while its second wish has not been told yet. */
  line: string
  /** What there is to say once it has everything it wished for. */
  after: string
  met: boolean
  patted: boolean
  /** It has a second wish, for a thing. */
  more?: boolean
  /** That wish, once it has let on. */
  wish?: string
  granted?: boolean
}

const FRIENDS = [
  ['bird', 'Bluebird', 'Knew where the meadow was all along.', 'Spent years in a cage planning what it would do with freedom. Mostly it sits on things. It has started calling that the plan.'],
  ['bunny', 'Bunnies', 'Leave clover wherever they land.', 'Asked for one carrot and got it. Now wonder, quietly, whether the number to ask for was two.'],
  ['tortoise', 'Tortoise', 'Sat on a spring for years and never noticed.', 'Slept on the only spring for years and nobody was cross. It is still working out how it feels about that.'],
  ['chick', 'Chicks', 'Loud for their size.', 'Have been outside for one whole day, and have opinions about all of it.'],
  ['flock', 'The flock', 'Carry seeds, and drop them where there is room.', 'Left when it got hard and came back when it got nice. They would rather that was not brought up.'],
  ['duck', 'Ducks', 'Turn up the moment a pond is a pond.', 'Never once thought about tomorrow, and look how that turned out. It is unfair, and they do not know it is.'],
  ['beaver', 'Beaver', 'Builds it, and takes it down again.', 'Built a dam, slept beside it, took it apart, built a lodge. Calls it a career.'],
  ['fish', 'River fish', 'Follow the water wherever it goes.', 'Have seen the whole river now. It turns out to be mostly river.'],
  ['penguin', 'Penguin', 'Slides first, thinks later.', 'Was frozen solid for years, and refers to it as a quiet period.'],
  ['frog', 'Frog', 'Sends rain to wherever it is wanted.', 'Can make it rain anywhere in the world. Uses this, mostly, to be listened to.'],
  ['ghost', 'Swamp ghost', 'Shy. Only out at night.', 'Nobody knows who it used to be, least of all the ghost. It has decided to find that restful.'],
  ['crab', 'Crab', 'Walks sideways and rakes the sand.', 'Wanted a coconut, got a coconut, paid with a pearl. Is fairly sure it came out ahead, and has stopped doing the sums.'],
  ['dragon', 'Dragon', 'Very small. Very warm.', 'Very small, very warm, and the owner of exactly one thing. Considers itself rich, which is the only way anybody ever is.'],
  ['mole', 'Mole', 'Digs straight for what it wants.', 'Dug straight to the thing it wanted without ever once seeing it. Recommends this.'],
  ['marmot', 'Marmots', 'Sleep through anything but a bell.', 'Slept through the end of the world and the beginning of the next one. Got up for a bell.'],
  ['goat', 'Goat', 'Likes its ledge.', 'Stood on its ledge while everything was dead, and stands on it now that everything is alive. The ledge was never the problem.'],
  ['eagle', 'Eagle', 'Sees the whole world from up there.', 'Sees the whole world from up there, and has no notes.'],
  ['owl', 'Owls', 'Come out when a bell rings in the dark.', 'Came because somebody rang a bell in the dark. Stayed because nobody asked them to leave.'],
]

// A thought bubble, seen from the front, and the little pictures that go in it: [x, y, z, width, height, depth, colour].
// Small and soft: a square with its corners taken off (a wide slab with a narrower one above and below it), two crumbs
// of it trailing down towards whoever is thinking, and a picture of a few boxes, plain enough to read from a way off.
const PAPER = 0xfffdf6
const BUBBLE = [
  [0, 0.21, 0, 0.44, 0.26, 0.05, PAPER],
  [0, 0.365, 0, 0.32, 0.05, 0.05, PAPER],
  [0, 0.055, 0, 0.32, 0.05, 0.05, PAPER],
  [-0.1, -0.03, 0, 0.08, 0.07, 0.05, PAPER],
  [-0.17, -0.12, 0, 0.05, 0.045, 0.05, PAPER],
]
const SOON = 60 // how long somebody has been free before a bubble comes up over it (seconds), and
const APART = 20 // how long after one bubble the next may come: never two at once
const ICONS: Record<string, number[][]> = {
  firefly: [[0, 0.19, 0.04, 0.13, 0.13, 0.04, 0xf5e04a], [0, 0.285, 0.04, 0.08, 0.06, 0.04, 0x4a4458], [0.1, 0.25, 0.04, 0.08, 0.05, 0.03, 0x9fd6ff], [-0.1, 0.25, 0.04, 0.08, 0.05, 0.03, 0x9fd6ff]],
  carrot: [[0, 0.2, 0.04, 0.13, 0.13, 0.04, 0xff9a3c], [0, 0.11, 0.04, 0.07, 0.07, 0.04, 0xf08a2c], [0, 0.3, 0.04, 0.11, 0.07, 0.04, 0x67bd72]],
  fish: [[-0.03, 0.21, 0.04, 0.2, 0.13, 0.04, 0xff9a5c], [0.11, 0.21, 0.04, 0.06, 0.18, 0.04, 0xff7a3c], [-0.09, 0.235, 0.05, 0.03, 0.03, 0.03, 0x3a3340]],
  branch: [[-0.06, 0.15, 0.04, 0.16, 0.05, 0.04, BARK], [0.06, 0.2, 0.04, 0.14, 0.05, 0.04, BARK], [0.12, 0.28, 0.04, 0.1, 0.09, 0.04, 0x8fd16b]], // a twig that steps up to the right, and one leaf at its end
  coconut: [[0, 0.21, 0.04, 0.2, 0.2, 0.04, 0x8a6d58], [-0.04, 0.245, 0.05, 0.035, 0.035, 0.03, 0x4a3b3b], [0.04, 0.245, 0.05, 0.035, 0.035, 0.03, 0x4a3b3b], [0, 0.18, 0.05, 0.035, 0.035, 0.03, 0x4a3b3b]], // its three eyes
  pearl: [[0, 0.12, 0.04, 0.26, 0.07, 0.04, 0xff9ab0], [0, 0.225, 0.04, 0.14, 0.14, 0.04, 0xcfe0ff], [-0.03, 0.255, 0.05, 0.04, 0.04, 0.03, 0xffffff]],
}

interface Wish {
  /** Whose it is: a name from the friend book. */
  who: string
  /** What the bubble shows. */
  icon: string
  /** How far above its head the bubble floats. */
  high: number
  /** The wish in words, and a nudge towards where the thing is. */
  want: string
  thanks: string
  /** What it does in return. */
  give: (owner: Critter) => void
  /** Where, right now, something that would grant it is: it sparkles now and then. */
  where?: () => number[] | undefined
  owner?: Critter
  bubble?: Critter
  since?: number
  /** The wished thing is on its way. */
  sent?: boolean
  granted?: boolean
}

/**
 * Animals with wishes. A minute or so after an animal is free, a small bubble over its head shows what it would like
 * (and the friend book says it in words). The thing is somewhere else in the world; a click on it sends it over. The
 * animal gives something back. None of it is needed to finish. This also keeps the friend book.
 */
export function wishes(w: Island) {
  const { critters, bits } = w
  for (const [id, name, line, after] of FRIENDS) w.friends.push({ id, name, line, after, met: false, patted: false })
  const friend = (id: string) => w.friends.find((f) => f.id === id)
  /** Where one of the things the animals leave behind stands, once it is there. */
  const spotted = (key: string) => {
    const thing = w.things.find((one) => one.key === key && one.tap)
    return thing && w.above(thing.tile, 0.9)
  }
  const secret = {
    chest: w.extra('secret', { where: 'meadow', icon: 'chest', hint: 'Give the bunnies what they wish for, then look where they dig. Gratitude takes odd forms.', at: () => spotted('chest') }),
    bottle: w.extra('secret', { where: 'snow', icon: 'bottle', hint: 'A penguin with company goes diving for presents. Being lonely was the only thing keeping it dry.', at: () => spotted('bottle') }),
    everybody: w.extra('secret', {
      icon: 'heart',
      hint: 'Nobody likes to be the only one who never got a pat. Go round again. Somebody is counting.',
      at: () => {
        const left = critters.list.find((c) => !c.hidden && c.thing === undefined && friend(c.friend ?? c.kind)?.patted === false)
        return left && [left.x, left.y + 0.7, left.z]
      },
    }),
  }
  const isle = (name: string) => w.tiles[w.index(name)]
  const open = (wish: Wish) => !!wish.bubble && !wish.granted
  /** Out and about: there to be seen, and no longer asleep, caged or frozen in. */
  const free = (c: Critter) => !c.hidden && (c.thing === undefined || !w.things[c.thing].hits)
  /** The free tile of an isle that is furthest from (or nearest to) a place. */
  const spot = (name: string, x: number, z: number, far: boolean, ok: (u: number) => boolean = () => true) =>
    isle(name)
      .filter((u) => w.free(u) && ok(u))
      .sort((a, b) => (Math.hypot(tx(a) - x, tz(a) - z) - Math.hypot(tx(b) - x, tz(b) - z)) * (far ? -1 : 1))[0]
  const beside = (mark: string) => (u: number) => NEAR.some(([di, dj]) => w.mark[step(u, di, dj)] === mark)

  const grant = (wish: Wish) => {
    const owner = wish.owner!
    wish.granted = true
    friend(wish.who)!.granted = true
    wish.bubble!.hidden = true
    owner.tip = undefined
    owner.pet = 1
    for (let k = 0; k < 6; k++) bits.spawn(owner.x + any() * 0.4, owner.y + 0.5, owner.z + any() * 0.4, any() * 1.5, 2.4, any() * 1.5, 0.13, 0xff8fb0, 1, NEVER, 0, 2)
    for (let k = 0; k < 3; k++) w.after(k * 0.13, () => note(0.5 + k * 0.2, 0.12))
    w.breath()
    w.say(wish.thanks, wish.who)
    wish.give(owner)
  }
  /** The wished thing flies over, in one big arc, to whoever wished for it. */
  const send = (wish: Wish, x: number, y: number, z: number, color: number, top?: number) => {
    const owner = wish.owner!
    const flight = 1.2
    wish.sent = true
    const [vx, vy, vz] = [(owner.x - x) / flight, (owner.y + 0.4 - y) / flight + 11 * flight, (owner.z - z) / flight]
    bits.spawn(x, y, z, vx, vy, vz, 0.2, color, flight + 0.05, NEVER, 0)
    if (top !== undefined) bits.spawn(x, y + 0.17, z, vx, vy, vz, 0.13, top, flight + 0.05, NEVER, 0) // the green of a carrot goes with it
    w.after(flight, () => grant(wish))
    // The camera goes over with it, and stays for the thanks: whoever wished is often an isle or two away.
    const from = w.time
    w.trail(() => (w.time - from < flight ? [x + vx * (w.time - from), z + vz * (w.time - from)] : [owner.x, owner.z]), flight + 1.6)
  }

  // The frog would like a night-light. One fat firefly is about after dark; it settles on the lily pad, and the frog sings.
  const light = critters.spawn('glow', 0, GROUND + 3, 0, 0xe9ff8a, undefined, 3)
  light.hidden = true
  light.grow = 1.5
  light.tip = 'A firefly, fatter than the rest. It is not sorry'
  const candle = w.candle() // a night-light has to give light
  light.next = w.flit
  const frog: Wish = {
    who: 'frog',
    icon: 'firefly',
    high: 0.5,
    want: 'The frog would like a night-light. It can call the weather, and it is scared of the dark. Fireflies only come out at night, and one of them is fatter than the rest.',
    thanks: 'A night-light for the frog. The firefly settles beside it, and the frog begins to sing: five notes, over and over, like somebody with one good idea. The ring next door seems to be listening.',
    give: () => (w.memo.frogSong = 1),
    where: () => (light.hidden ? undefined : [light.x, light.y, light.z]),
  }
  light.onPat = () => {
    if (!open(frog) || frog.sent) return w.pat(light)
    frog.sent = true
    light.next = undefined
    critters.go(light, frog.owner!.x + 0.26, frog.owner!.y + 0.24, frog.owner!.z + 0.1, 1.5, 1.5, () => grant(frog))
    w.watch(light, 3.1) // and the camera goes with it, as with every wish on its way
  }

  // The bunnies would like a carrot. There are rows of them in the kitchen garden, once it has had its drink.
  const carrots = () => w.things.filter((thing) => thing.up && thing.pick && w.mark[thing.tile] === 'c' && w.isle[thing.tile] === w.index('garden'))
  const bunny: Wish = {
    who: 'bunny',
    icon: 'carrot',
    high: 0.82,
    want: 'The bunnies would like a carrot. One, between three. They are new to wanting things. There is a kitchen garden across the water, if somebody waters it.',
    thanks: 'A carrot for the bunnies. They share it three ways, which is not much carrot each, and then start digging like mad. It is how they say thank you. Or how they panic.',
    give: (owner) =>
      w.after(1.6, () => {
        const tile = spot('meadow', owner.x, owner.z, false)
        if (tile === undefined) return
        w.clear(tile)
        const t: number = w.thing(tile, {
          auto: false,
          key: 'chest', // it comes up wherever the bunnies happen to be
          tip: 'A chest. It did not bury itself',
          sound: 'creak',
          tap: () => {
            w.things[t].tap = undefined
            w.things[t].tip = 'A chest, open. Seed packets, mostly'
            // The lid goes up and back, and stands open; a few coins jump out and roll off.
            w.solid.size(lid, 0.64, 0.44, 0.1)
            w.solid.place(lid, tx(tile), w.h[tile] + 0.62, tz(tile) - 0.24)
            w.solid.poke(lid, 14)
            w.solid.show(gold)
            for (let k = 0; k < 6; k++) bits.spawn(tx(tile), w.h[tile] + 0.5, tz(tile), any() * 3, 4 + Math.random() * 2.5, 0.6 + Math.random() * 2, 0.11, 0xffd45c, 2.4, w.h[tile], 0.45, 22, 2.5)
            secret.chest('A secret: the chest the bunnies dug up. Old seed packets, and one gold coin. Somebody was saving up for something. It turns out it was this.')
          },
        })
        for (let k = 0; k < 8; k++) bits.spawn(tx(tile), w.h[tile] + 0.2, tz(tile), any() * 4, 3 + Math.random() * 3, any() * 4, 0.16, 0xb8956a, 1.2, w.h[tile], 0.3)
        w.put(t, 0, 0.2, 0, 0.6, 0.4, 0.44, 0xa98463)
        const lid = w.put(t, 0, 0.46, 0, 0.64, 0.14, 0.48, WOOD)
        w.put(t, 0, 0.36, 0.23, 0.1, 0.12, 0.04, 0xffd45c)
        const gold = w.scar(t, 0, 0.42, 0, 0.44, 0.06, 0.3, 0xffd45c) // what is in it, once it is open
        w.solid.paint(gold, 0xffd45c, 2)
        w.say('Up comes a chest. Go on, open it. You were always going to.', 'bunny')
      }),
    where: () => {
      const row = carrots()
      const thing = row[Math.floor(Math.random() * row.length)]
      return thing && [tx(thing.tile), w.h[thing.tile] + 0.4, tz(thing.tile)]
    },
  }
  w.onKnock.push((thing) => {
    if (!open(bunny) || bunny.sent || !carrots().includes(thing)) return false
    // One carrot comes out of the ground and flies over: the patch stays, with the other one in it.
    const at = thing.pick?.()
    if (!at) return false
    send(bunny, at[0], at[1], at[2], 0xff9a3c, 0x67bd72)
    return true
  })

  // The penguin would like a fish for company. The island's river has fish; one will jump all the way to the pond.
  const school: Critter[] = []
  const penguin: Wish = {
    who: 'penguin',
    icon: 'fish',
    high: 0.86,
    want: "The penguin would like a fish, for company. Not to eat. It was clear about that, twice. There are fish in the island's river.",
    thanks: 'A fish for the pond up north. The penguin has company now, and no idea what to say to it. It dives to fetch something instead.',
    where: () => school.map((fish) => [fish.x, fish.y + 0.3, fish.z])[Math.floor(Math.random() * school.length)],
    give: (owner) =>
      w.after(2.2, () => {
        const tile = spot('snow', owner.x, owner.z, false, beside('i'))
        if (tile === undefined) return
        w.clear(tile)
        const t: number = w.thing(tile, {
          auto: false,
          key: 'bottle',
          tip: 'A bottle, with something in it. Probably opinions',
          sound: 'pop',
          tap: () => {
            w.things[t].tap = undefined
            w.things[t].tip = 'A bottle, empty. The note got where it was going'
            secret.bottle('A secret: a note in a bottle. “The island is not dead, only asleep. Be gentle with it, and be curious.” Whoever wrote that meant it. Awkward for the rest of us.')
          },
        })
        w.splash(owner.x, owner.y + 0.3, owner.z, 8)
        w.put(t, 0, 0.16, 0, 0.18, 0.3, 0.18, 0x8fd6b0)
        w.put(t, 0, 0.36, 0, 0.08, 0.1, 0.08, 0x8fd6b0)
        w.put(t, 0, 0.44, 0, 0.1, 0.06, 0.1, 0xb8956a)
        w.put(t, 0, 0.16, 0.1, 0.1, 0.16, 0.02, 0xfff3df)
        w.say('The penguin comes up with a bottle and leaves it on the bank, the way a cat would. There is something in it.', 'penguin')
      }),
  }
  const leap = (fish: Critter) => {
    if (!open(penguin) || penguin.sent) return w.pat(fish)
    const pond = isle('snow').find((u) => w.mark[u] === 'i' && w.filled[u])
    if (pond === undefined) return w.pat(fish)
    penguin.sent = true
    fish.next = undefined
    w.watch(fish, 2.4) // a long way to jump: the camera sees it off and in
    critters.go(fish, tx(pond), w.h[pond] + 0.36, tz(pond), 2.2, 6, () => {
      w.splash(fish.x, fish.y + 0.2, fish.z, 6)
      fish.next = w.paddle
      grant(penguin)
    })
  }

  type Leafed = Thing & { perch: number[] }
  const leafy = (thing: Thing): thing is Leafed => !!thing.perch && !!thing.up && !['palm', 'shroom'].includes(w.look(thing.tile).tree)
  const palm = (thing: Thing): thing is Leafed => !!thing.perch && !!thing.up && w.look(thing.tile).tree === 'palm'
  // The beaver would like one good branch. Any tree in leaf has one to spare. It finishes a lodge, and was not building for one.
  const beaver: Wish = {
    who: 'beaver',
    icon: 'branch',
    high: 0.66,
    want: 'The beaver would like one good branch. Any tree in leaf has one to spare. It has looked at every branch here, and it has notes.',
    thanks: 'A branch for the beaver. It was the last one missing: a lodge goes up on the pond. And it was not building for one. It just never mentioned it. Beavers.',
    where: () => {
      const trees = w.things.filter(leafy)
      return trees[Math.floor(Math.random() * trees.length)]?.perch
    },
    give: () => {
      // In a corner of the pond, out of the way: not where the water comes in, and not at the far end, where the ducks land.
      const pond = isle('island').filter((u) => w.mark[u] === 'p')
      const wet = (u: number) => NEAR.filter(([di, dj]) => pond.includes(step(u, di, dj))).length
      const tile = pond.slice(0, -2).filter((u) => !beside('r')(u)).sort((a, b) => wet(a) - wet(b))[0] ?? pond[0]
      if (tile === undefined) return
      const t = w.thing(tile)
      w.blocked[tile] = 1 // nobody swims through it
      w.put(t, 0, 0.62, 0, 0.84, 0.36, 0.84, WOOD)
      w.put(t, 0, 0.88, 0, 0.54, 0.2, 0.54, BARK)
      w.put(t, 0.3, 0.8, 0.22, 0.5, 0.08, 0.1, BARK)
      w.put(t, -0.2, 0.8, -0.3, 0.1, 0.08, 0.5, BARK)
      for (let k = 0; k < 2; k++) {
        const kit = critters.spawn('beaver', tx(tile) + 0.5 - k, w.h[tile] + (w.filled[tile] ? 0.2 : 0), tz(tile) + 0.6, 0xb07a55)
        kit.grow = 0.55
        kit.next = w.paddle
      }
    },
  }
  w.onKnock.push((thing) => {
    if (!open(beaver) || beaver.sent || !leafy(thing)) return false
    for (let k = 0; k < 6; k++) bits.spawn(tx(thing.tile) + any(), thing.perch[1], tz(thing.tile) + any(), any() * 2, 1, any() * 2, 0.14, 0x8fd16b, 1.4, w.h[thing.tile], 0, 5)
    send(beaver, tx(thing.tile), thing.perch[1] - 0.6, tz(thing.tile), BARK)
    return true
  })

  // The crab would like a coconut. The palms have them once they are in leaf. It cracks it, and leaves a pearl.
  let pearl: number[] | undefined
  const crab: Wish = {
    who: 'crab',
    icon: 'coconut',
    high: 0.58,
    want: 'The crab would like a coconut. The palms on the beach have them, once they are in leaf. It has claws made for exactly this and no way up a tree. Nobody thought the crab through.',
    thanks: 'A coconut for the crab. It cracks it in one go and leaves you a pearl for your trouble. It thinks that is what a coconut costs. Do not tell it.',
    where: () => {
      const palms = w.things.filter(palm)
      return palms[Math.floor(Math.random() * palms.length)]?.perch
    },
    give: (owner) =>
      w.after(1.2, () => {
        const tile = spot('beach', owner.x, owner.z, false)
        if (tile === undefined) return
        w.clear(tile)
        pearl = [tx(tile), w.h[tile] + 0.4, tz(tile)]
        const t: number = w.thing(tile, {
          auto: false,
          key: 'pearl',
          sound: 'plink',
          tip: 'A pearl. How an oyster deals with a problem',
          tap: () => {
            if (!open(dragon) || dragon.sent) return w.say('A pearl. You have no pockets. Somebody small and warm would treasure this.')
            w.things[t].tap = undefined
            w.burst(t)
            send(dragon, tx(tile), w.h[tile] + 0.3, tz(tile), 0xffffff)
          },
        })
        w.put(t, 0, 0.05, 0, 0.36, 0.1, 0.3, 0xffd9e6)
        w.put(t, 0, 0.22, -0.16, 0.36, 0.3, 0.06, 0xffc9d6)
        w.solid.paint(w.put(t, 0, 0.2, 0, 0.18, 0.18, 0.18, 0xffffff), 0xffffff, 1.8)
      }),
  }
  w.onKnock.push((thing) => {
    if (!open(crab) || crab.sent || !palm(thing)) return false
    send(crab, thing.perch[0], thing.perch[1] - 0.3, thing.perch[2], BARK)
    return true
  })

  // The dragon would like something precious of its own. The crab's pearl will do. It says thank you the only way it knows.
  let show = 0 // fireworks until then
  const dragon: Wish = {
    who: 'dragon',
    icon: 'pearl',
    high: 0.76,
    want: 'The dragon would like something precious of its own. A dragon is supposed to have a hoard. This one has a view. Crabs know where pearls come from.',
    thanks: 'A pearl for the dragon. It has never owned anything before, and says thank you the only way it knows: loudly, in the sky, at everybody.',
    where: () => pearl,
    give: (owner) => {
      show = w.time + 12
      // And again, for a little, whenever it is patted: it has found out that this works.
      owner.tip = 'A dragon with a pearl. A pat, and it says thank you again, in the sky'
      owner.onPat = () => {
        w.pat(owner)
        show = Math.max(show, w.time + 7)
      }
    },
  }

  const list = [beaver, penguin, bunny, crab, frog, dragon] // the easier ones first
  for (const wish of list) friend(wish.who)!.more = true
  let clock = 0
  let last = -APART // when the last bubble came up
  let finale = false
  w.ticks.push((dt, time) => {
    candle.position.set(light.x, light.y, light.z)
    candle.intensity += ((w.night && !light.hidden ? 2.2 : 0) - candle.intensity) * Math.min(1, dt * 3)
    // Every bubble floats over its animal's head and faces the camera.
    for (const wish of list) {
      if (!wish.bubble || !wish.owner) continue
      Object.assign(wish.bubble, { x: wish.owner.x, y: wish.owner.y + wish.high + 0.3 + Math.sin(time * 2) * 0.04, z: wish.owner.z, face: w.turn, yaw: w.turn, grow: 1.7 + Math.sin(time * 3) * 0.06 })
    }
    // The dragon's thanks, and again when the whole world is awake.
    if (w.finished && !finale && dragon.granted) {
      finale = true
      show = time + 14
    }
    if (time < show && Math.random() < dt * 2.4) w.firework()

    if ((clock += dt) < 0.5) return
    clock = 0
    // The friend book: whoever is out and about has been met.
    for (const c of critters.list) {
      const known = friend(c.friend ?? c.kind)
      if (known && free(c) && c.size > 0.5) known.met = true
    }
    if (w.friends.every((f) => f.patted)) secret.everybody("A secret: everybody's friend. There is nobody left who has not had a pat. You were thorough about being kind. Somebody should be.")
    // Fish move into the island's river once it runs.
    if (w.memo.river && !school.length) {
      const river = isle('island').filter((u) => w.mark[u] === 'r' && w.filled[u])
      for (const u of [river[2], river[river.length - 3]]) {
        if (u === undefined) continue
        const fish = critters.spawn('fish', tx(u), w.h[u] + 0.36, tz(u), school.length ? 0xffb21f : 0xff7a2f)
        fish.grow = 1.4
        fish.next = w.paddle
        fish.onPat = () => leap(fish)
        school.push(fish)
      }
    }
    // The fat firefly is only about after dark, and only while the frog is wishing for it. Once given, it stays.
    light.hidden = !frog.granted && !(open(frog) && w.night)
    // Whatever would grant an open wish gives a little sparkle now and then, so that it can be found.
    for (const wish of list) {
      const at = open(wish) && !wish.sent ? wish.where?.() : undefined
      if (at) for (let k = 0; k < 3; k++) bits.spawn(at[0] + any() * 0.5, at[1] + any() * 0.3, at[2] + any() * 0.5, 0, 0.7, 0, 0.1, 0xfff3a8, 0.9, NEVER, 0, -0.4, 3)
    }
    // A new bubble, for somebody who has been free for a minute or so. One at a time, a while apart, and never more than
    // three in all. (A game being put back does not wait: what was granted then has to be open to be granted again.)
    let showing = list.filter(open).length
    for (const wish of list) {
      const owner = wish.bubble ? undefined : critters.list.find((c) => (c.friend ?? c.kind) === wish.who && free(c))
      if (!owner || showing >= 3 || (!w.replaying && (time - (wish.since ??= time) < SOON || time - last < APART))) continue
      const known = friend(wish.who)!
      last = time
      wish.owner = owner
      wish.bubble = critters.spawn('bubble', owner.x, owner.y + wish.high, owner.z, 0, [...BUBBLE, ...ICONS[wish.icon]])
      wish.bubble.key = `bubble:${wish.who}`
      // A click on the bubble is a click on its animal, and says the wish.
      wish.bubble.onPat = () => {
        if (owner.thing !== undefined) return w.strike(owner.thing)
        w.say(wish.want, wish.who)
        return owner.onPat ? owner.onPat() : w.pat(owner)
      }
      wish.bubble.tip = owner.tip = wish.want
      w.whisper(wish.want, wish.who)
      known.wish = wish.want
      known.granted = false
      note(0.85, 0.08)
      showing++
    }
  })
}
