import { chapters, links, me } from '../content.ts'

// Everything on the front page: one entry a card. To add a project, add an entry here; if it has a picture, put that
// in `public/thumbs/` and name it in `picture`. Without one, the card shows the small drawing named in `art`
// (see `art.ts`).

/** The kinds of thing, in the order of their chips: a name, and the two colours a card of that kind has. */
export const KINDS = {
  games: { name: 'Games', bg: '#e6dcff', accent: '#8a63d2' },
  web: { name: 'Web', bg: '#d4f4e4', accent: '#3aa57c' },
  video: { name: 'Video', bg: '#ffe0d6', accent: '#e2694f' },
  music: { name: 'Music', bg: '#ffdfe8', accent: '#d6578a' },
  images: { name: 'Images', bg: '#fff1c2', accent: '#c98a12' },
  work: { name: 'Work', bg: '#dde2ff', accent: '#5b68d6' },
  hello: { name: 'Contact', bg: '#ffe9c7', accent: '#f08a4b' }, // the one card that is no project: see `hello` below
}
export type Kind = keyof typeof KINDS

export interface Project {
  /** Its name in the address: `/#curvatron` opens it. */
  slug: string
  title: string
  kind: Kind
  /** A year, or a span of years. Left out where it is not known. */
  when?: string
  /** One line, for the card. */
  blurb: string
  /** And the rest, for the panel: a paragraph each. */
  body: string[]
  tags?: string[]
  /** Where it leads. The first is the main one. */
  links: { label: string; href: string }[]
  /** A picture of it, from the root of the site: left out, the card shows the drawing instead. */
  picture?: string
  /** Another cut of that picture for a card of the ordinary shape, where the first is made for a wide one. */
  small?: string
  /** What it becomes: a second picture of the wide shape, which fades in over the first under the cursor. */
  after?: string
  /** More pictures of it, shown small in a row in its sheet. */
  more?: string[]
  /** Where I worked: what I was there, said under its name. */
  role?: string
  /** A small word of my own, at the end. */
  aside?: string
  /** The marks of the place, shown small in the corner of its picture. */
  logos?: string[]
  /** The picture is shown whole, with room round it, and not cut to the shape of the card: a logo. */
  whole?: boolean
  /** The picture is shown smaller, on a white card of its own: for a picture that gains nothing by being big. */
  framed?: boolean
  /** Old stuff: it goes under a line of its own at the foot of the page, apart from the rest. */
  old?: boolean
  /** The drawing: a name from `art.ts`. */
  art: string
  /** The two colours of the card, where they are not those of its kind. */
  bg?: string
  accent?: string
  /** A video that plays in the panel: its id on YouTube. */
  video?: string
  /** Twice as wide as the others. */
  wide?: boolean
}

const made: Project[] = [
  {
    slug: 'wake-the-island',
    title: 'Wake the island',
    kind: 'games',
    when: '2020–2026',
    blurb: 'A tiny voxel game: a dry little island, and a few things in the way of its water.',
    body: [
      'You knock on things until they get better. That is the whole game. It is also, I have come to think, most of what I do for a living.',
      'The idea is older than the game. I started it in Unity around 2020, left it in a folder for years, and only finished it now, in the browser, with AI helping me get it to something you can actually play. The island was very patient about it.',
      'Seven isles, twenty-seven things to find, a few animals with wishes, and a balloon with opinions. It plays on a phone too.',
    ],
    tags: ['TypeScript', 'three.js', 'react-three-fiber', 'Vite'],
    links: [{ label: 'Play', href: '/game/' }],
    picture: '/thumbs/wake-the-island-wide.jpg',
    small: '/thumbs/wake-the-island.jpg',
    after: '/thumbs/wake-the-island-woken.jpg',
    art: 'worm',
    wide: true,
  },
  {
    slug: 'storm-the-castle',
    title: 'Storm the castle',
    kind: 'games',
    when: '2021–2026',
    blurb: 'A castle, two colours of soldier, and a cat that both of them say is theirs.',
    body: [
      'You get archers, swordsmen and a hill. Let one go over the castle and it defends it; anywhere else, and it attacks. They take the walls down a stone at a time to get at the cat on the keep. Whoever carries the cat home owns the castle, which then puts itself back together, and it all starts again.',
      'There is a third button, and it is a picnic. It ends the war faster than either of the others. There are also sheep, which both sides stop to pat on the way to battle. I did not plan for any of that to be the moral.',
      'It started in 2021: bored, in covid, I wanted an excuse to try three.js, and got about as far as a castle on a hill. It stayed that way for years. AI helped me get it to something you can play. The cat does not care who wins. I have come to think the cat is right.',
    ],
    tags: ['TypeScript', 'three.js', 'react-three-fiber', 'Vite'],
    links: [{ label: 'Play', href: '/castle/' }],
    picture: '/thumbs/storm-the-castle.jpg',
    small: '/thumbs/storm-the-castle-card.jpg',
    art: 'castle',
  },
  {
    slug: 'curvatron',
    title: 'Curvatron',
    kind: 'games',
    when: '2015–2016',
    blurb: 'One-button snake for up to eight players. Trickier than it looks.',
    body: [
      'A friend and I made it after university classes, mostly as an excuse to learn JavaScript. It got out of hand: first a mobile game on Android and iOS, then Steam, where it is free now.',
      'It was one of the first games ever published on Steam that was made with JavaScript. Nobody had told us it was a strange idea, so it worked.',
      'Built with Phaser, wrapped up for the desktop with NW.js, and wired to Steam with Greenworks. The code is open, for anybody who wants to see how students name variables.',
    ],
    tags: ['JavaScript', 'Phaser', 'NW.js', 'Greenworks'],
    links: [
      { label: 'Steam', href: 'https://store.steampowered.com/app/404700' },
      { label: 'Play in the browser', href: 'https://bravebunny.github.io/curvatron/' },
      { label: 'The code', href: 'https://github.com/bravebunny/curvatron' },
    ],
    picture: '/thumbs/curvatron.png',
    art: 'snake',
  },
  {
    slug: 'brave-bunny',
    title: 'Brave Bunny',
    kind: 'games',
    when: '2014–2016',
    blurb: 'A tiny game studio with friends.',
    body: [
      'A few friends and a name with a rabbit in it. We made small games, entered game jams and competitions, and won a few awards along the way, including 2nd place at the Microsoft PizzaNight Games Competition.',
      'The site still has them all: Extreme Fall!, Caterpillar Racer, Freetanso, Dude, you only get one!, Moonshot, Social Worms. Some were made in a weekend, and some of those show it. All of them got finished, which I now know is the hard part.',
    ],
    tags: ['JavaScript', 'Phaser', 'Unity', 'LibGDX', 'Processing'],
    links: [
      { label: 'Visit the site', href: 'https://bravebunny.github.io/' },
      { label: 'The code', href: 'https://github.com/bravebunny' },
    ],
    picture: '/thumbs/brave-bunny.png',
    whole: true,
    art: 'bunny',
  },
  {
    slug: 'snap-marker',
    title: 'Snap Marker',
    kind: 'web',
    when: '2021',
    blurb: 'A minimalist Chrome extension to draw, highlight text and point at things on any web page.',
    body: [
      'A (very) minimalist Chrome extension: draw on any web page, highlight text, point at things, then copy the picture or download it. Undo and redo work the way your fingers expect.',
      'I made it for one reason: I wanted to know how a Chrome extension gets published. Now I know. It involves a form.',
      'React and TypeScript, with Konva for the drawing, bundled with Webpack, on Manifest V3.',
    ],
    tags: ['TypeScript', 'React', 'Konva', 'Webpack', 'Manifest V3'],
    links: [
      { label: 'Chrome Web Store', href: 'https://chromewebstore.google.com/detail/snap-marker/dmbihikakflbaipddokldeaobgmfhicl' },
      { label: 'The code', href: 'https://github.com/TiagoJeronimo/snap-marker' },
    ],
    picture: '/thumbs/snap-marker.jpg',
    framed: true,
    art: 'marker',
  },
  {
    slug: 'milhoes-de-suor',
    title: 'Milhões de Suor',
    kind: 'video',
    when: '2016',
    blurb: 'A promotional film for a festival. It won.',
    body: ['A promotional film for a festival. It took first place in the “Milhões de Vídeos” promotional video competition, in 2016. Nobody was more surprised than the people who made it.'],
    links: [{ label: 'Watch on YouTube', href: 'https://www.youtube.com/watch?v=12wr5A5_0xo' }],
    picture: '/thumbs/milhoes-de-suor.jpg',
    framed: true,
    old: true,
    art: 'film',
    video: '12wr5A5_0xo',
  },
  {
    slug: 'fruitworm',
    title: 'fruitworm',
    kind: 'video',
    blurb: 'A YouTube channel from when I was younger and bored.',
    body: [
      'A random YouTube channel I made when I was younger and bored: some truly bad animations, and some music. I do not consider it my channel. It considers me its creator, and it has a point.',
      'It stays on this page because everything I can do now started as something bad I made for no reason.',
    ],
    links: [{ label: 'Open the channel', href: 'https://www.youtube.com/@fruitworm9990' }],
    old: true,
    art: 'worm',
    bg: '#ffdfe8',
    accent: '#d6578a',
  },
  {
    slug: 'photoshop-montages',
    title: 'Photoshop montages',
    kind: 'images',
    blurb: 'The kind I used to put together by hand, back when you had to.',
    body: [
      'A bunch of images I made in Photoshop, in the age before AI, mostly when I was bored. Every window and every stare was cut out by hand, with a mouse, like an animal.',
      'A prompt could make these in four seconds now. They took me whole evenings, and I would like that noted somewhere. Here, for instance.',
    ],
    tags: ['Photoshop'],
    links: [{ label: 'See them on Pinterest', href: 'https://pt.pinterest.com/confusedfox/what/' }],
    picture: '/thumbs/photoshop-montages.jpg',
    old: true,
    art: 'fox',
  },
  {
    slug: 'voxel-islands',
    title: 'Voxel islands',
    kind: 'images',
    when: '2019',
    blurb: 'Small worlds made of cubes, from before the one you can play.',
    body: [
      'Voxel stuff I used to make: an island or two, a waterfall off a snowy rock, a hut that is mostly stairs. Nothing moves and nothing can be clicked. I thought they were finished.',
      'Looking at them now, the game at the top of this page was already on its way. Nobody had told me yet.',
    ],
    links: [{ label: 'Play the island that came later', href: '/game/' }],
    picture: '/thumbs/voxel-2.jpg',
    more: ['/thumbs/voxel-1.jpg', '/thumbs/voxel-2.jpg', '/thumbs/voxel-3.jpg'],
    old: true,
    art: 'cube',
  },
  {
    slug: 'voxel-unity',
    title: 'Voxels and Perlin noise',
    kind: 'video',
    when: '2019',
    blurb: 'Unity experiments: a world of cubes that Perlin noise puts where it likes.',
    body: [
      'Experiments in Unity: voxels, and Perlin noise to decide where the ground goes. Perlin noise is the bit of maths that makes random numbers come out smooth, so that the cubes pile up into hills and not into static.',
      'You give it a few numbers and it gives you a landscape. I gave it a lot of numbers.',
      'The island game at the top of this page began in Unity around the same time. I make no claims about cause and effect.',
    ],
    tags: ['Unity', 'C#', 'Voxels', 'Perlin noise'],
    links: [{ label: 'Watch on YouTube', href: 'https://www.youtube.com/watch?v=dRFHiRYaiDk' }],
    picture: '/thumbs/voxel-unity.jpg',
    old: true,
    art: 'film',
    video: 'dRFHiRYaiDk',
  },
]

// Where I have worked: a card each, with the words of the CV (see `content.ts`).
const ART_OF: Record<string, string> = { smallpdf: 'page', nomoko: 'pin', drover: 'rocket', runtime: 'screens', research: 'cube' }
const worked: Project[] = chapters
  .filter((chapter) => chapter.part === 'work')
  .map((chapter) => ({
    slug: chapter.id,
    title: chapter.org,
    kind: 'work',
    when: chapter.years,
    blurb: chapter.title,
    role: chapter.role,
    body: chapter.body,
    aside: chapter.aside,
    logos: chapter.logos,
    picture: chapter.shot,
    framed: Boolean(chapter.shot),
    tags: chapter.tags,
    links: [...(chapter.sites ?? []), { label: 'The whole CV', href: '/cv/' }],
    art: ART_OF[chapter.id],
    bg: chapter.bg,
    accent: chapter.accent,
  }))

// Newest first: by the last year in `when`; of two that end in the same year, what I made comes before where I worked
// (so the two games stand side by side at the head of the page); and then by the first year. The wide one leads
// whatever its years, and what has no year comes last, in the order it was written here.
const years = (project: Project) => {
  const all = project.when?.match(/\d{4}/g)?.map(Number) ?? [0]
  return [all[all.length - 1], all[0]]
}
export const projects: Project[] = [...made, ...worked].sort((a, b) => Number(!!b.wide) - Number(!!a.wide) || years(b)[0] - years(a)[0] || Number(a.kind === 'work') - Number(b.kind === 'work') || years(b)[1] - years(a)[1])

/** The card that says how to reach me. It is no project: it stands last in the grid, is counted with none of them, and
    no chip shows it but All. */
export const hello: Project = {
  slug: 'say-hello',
  title: 'Say hello',
  kind: 'hello',
  blurb: 'Open to senior and staff product engineering roles, and to founding engineer roles.',
  body: [me.open, 'Write to me about a role, a project, or the snails. I answer all three.', 'My reference letter is yours for the asking.'],
  links: [
    { label: 'Write to me', href: links.find((link) => link.label === 'Email')!.href },
    { label: 'LinkedIn', href: links.find((link) => link.label === 'LinkedIn')!.href },
    { label: 'My CV', href: '/cv/' },
  ],
  art: 'envelope',
}
