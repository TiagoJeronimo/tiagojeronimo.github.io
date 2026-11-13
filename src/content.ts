import type { ColorName } from './bricks/voxel.ts'

export interface Chapter {
  /** Model in src/sets. The first chapter is the hero, the last one the overview. */
  set: string
  nav: string
  bg: string
  accent: string
  kicker?: string
  title: string
  role?: string
  body: string[]
  tags?: string[]
  quote?: { text: string; by: string }
  /** The two layers of the slab the model stands on, bottom first. Soil by default. */
  slab?: [ColorName, ColorName]
  /** Camera angle around the set in degrees: az < 0 looks from the front-left, el is the height. */
  view?: { az?: number; el?: number }
}

export const INK = '#3f3b4e'

export const links = [
  { label: 'Email', href: 'mailto:tiagosilvajeronimo@gmail.com' },
  { label: 'LinkedIn', href: 'https://linkedin.com/in/tiagojs' },
  { label: 'GitHub', href: 'https://github.com/TiagoJeronimo' },
]

export const chapters: Chapter[] = [
  {
    set: 'name',
    nav: 'Hello',
    bg: '#fff4e0',
    accent: '#f08a4b',
    title: 'Tiago Silva',
    role: 'Senior software engineer in Zurich.',
    body: ['I build products for the web, block by block.'],
    view: { az: -14, el: 13 },
  },
  {
    set: 'lisbon',
    slab: ['darkTan', 'tan'],
    nav: 'Lisbon',
    bg: '#d6ecff',
    accent: '#4d8fd6',
    kicker: '01 · Lisbon · 2012–2017',
    title: 'It started in Lisbon.',
    role: 'Instituto Superior Técnico · BSc + MSc in Information Systems and Computer Engineering',
    body: [
      'Five years of computer engineering, majoring in Interaction & Visualization and in Games, with an Erasmus semester in Kraków.',
      'Every summer from 2010 to 2016 I worked as a metalworker.',
    ],
    tags: ['Interaction & Visualization', 'Games', 'Erasmus · Kraków'],
  },
  {
    set: 'games',
    slab: ['mediumLavender', 'lavender'],
    nav: 'Games',
    bg: '#e6dcff',
    accent: '#8a63d2',
    kicker: '02 · Brave Bunny · 2014–2015',
    title: 'Games came first.',
    role: 'Brave Bunny · a tiny game studio with friends',
    body: [
      'We made small games, entered game jams and competitions, and won a few awards along the way, including 2nd place at the Microsoft PizzaNight Games Competition.',
      'Curvatron started as a well-received mobile game on Android and iOS and ended up on Steam, where you can still buy it.',
    ],
    tags: ['JavaScript', 'Unity', 'C#'],
  },
  {
    set: 'ar',
    slab: ['lightGray', 'white'],
    nav: 'Research',
    bg: '#d4f4e4',
    accent: '#3aa57c',
    kicker: '03 · INESC-ID · 2017–2018',
    title: 'Then research, in augmented reality.',
    role: 'Researcher & Developer · IT-MEDEX project',
    body: [
      'My master’s thesis: planning implants on 3D medical images, with a tablet as the controller inside an augmented-reality scene.',
      'Built in Unity and C# as part of IT-MEDEX, a project on interactive tablets for collaborative work with 3D medical images.',
    ],
    tags: ['Unity', 'C#', 'Augmented reality'],
  },
  {
    set: 'runtime',
    slab: ['sandBlue', 'lightBlue'],
    nav: 'Runtime Revolution',
    bg: '#ffe0d6',
    accent: '#e2694f',
    kicker: '04 · Runtime Revolution · 2018–2019',
    title: 'Products for clients, from zero.',
    role: 'Frontend Developer · Lisbon',
    body: [
      'Web and mobile projects for clients, mostly in the USA. I built several of them from scratch, worked directly with the clients and helped shape the designs.',
    ],
    tags: ['React', 'React Native', 'TypeScript', 'Firebase'],
    view: { az: 24 },
  },
  {
    set: 'drover',
    nav: 'Drover',
    bg: '#fff1c2',
    accent: '#c98a12',
    kicker: '05 · Drover · 2019–2020',
    title: 'Startup speed, and an A/B test tool.',
    role: 'Frontend Developer · Lisbon, for a London startup',
    body: [
      'I worked on the main website of Drover while it grew from Series A to Series B. It was later acquired by Cazoo.',
      'Server-side rendered React and TypeScript, tested with Jest. I also built the A/B testing tool that let us run experiments on both the server and the client.',
    ],
    tags: ['React', 'TypeScript', 'Node.js SSR', 'Jest'],
  },
  {
    set: 'nomoko',
    slab: ['sandBlue', 'lightBlue'],
    nav: 'Nomoko',
    bg: '#d2eef2',
    accent: '#2f9aa8',
    kicker: '06 · Nomoko · 2020–2022',
    title: 'A map-heavy app, built from scratch.',
    role: 'Senior Frontend Developer · Zurich',
    body: [
      'I built Nomoko’s main app from scratch in React and TypeScript, with heavy use of mapbox-gl. For a while I was the only frontend developer.',
      'I created the component library, started the move to micro frontends, helped run the frontend and QA teams, and took part in hiring.',
    ],
    tags: ['React', 'TypeScript', 'mapbox-gl', 'Storybook', 'Micro frontends'],
  },
  {
    set: 'smallpdf',
    slab: ['mediumBlue', 'lightBlue'],
    nav: 'Smallpdf',
    bg: '#dde2ff',
    accent: '#5b68d6',
    kicker: '07 · Smallpdf · Sign.com · 2022–2026',
    title: 'Product engineering, at scale.',
    role: 'Senior Software Engineer · Zurich',
    body: [
      'Smallpdf is the most used online PDF software and one of the 200 most visited websites in the world. I started on the core product, then moved to Sign.com, its e-signature product.',
      'I delivered the full signing experience, team collaboration and account management, shipped growth and monetisation experiments (often several in parallel), built and maintained payments and plans, took technical ownership of core frontend areas and mentored other engineers.',
    ],
    quote: {
      text: '… a champion of AI in both how he builds and what he builds.',
      by: 'Christina Petushenko, General Manager, Sign.com',
    },
    tags: ['React', 'TypeScript', 'Experiments', 'Payments', 'LLMs'],
    view: { az: 24 },
  },
  {
    set: 'alps',
    nav: 'Off screen',
    bg: '#ffdfe8',
    accent: '#d6578a',
    kicker: '08 · Off screen',
    title: 'Mountains, waves and a camera.',
    body: [
      'Hiking, climbing, snowboarding, surfing and camping. Photography, cinematography and animation. Music. And Lego, obviously.',
      'On the side I made Snap Marker, a minimalist Chrome extension to draw, highlight text and point at things on any web page.',
    ],
    tags: ['Portuguese · native', 'English · fluent', 'Spanish · basic', 'French · elementary'],
  },
  {
    set: 'name',
    nav: 'Contact',
    bg: '#fff4e0',
    accent: '#f08a4b',
    title: 'Let’s build something.',
    body: ['I’m open to senior and staff product engineering roles, and to founding engineer roles. Based in Zurich.'],
  },
]
