// Who I am and where I have been: the words of the CV page, and of the "Work" cards on the front page.
// It comes from the CV and the reference letter, and from what Tiago has said himself since (the job title is the one
// he gives on LinkedIn). Nothing is to be made up here.

export const me = {
  name: 'Tiago Jerónimo Silva',
  role: 'Senior Full-Stack Engineer · Product Engineering · Zürich',
  line: 'I build products for the web.',
  open: 'I’m open to senior and staff product engineering roles, and to founding engineer roles. Based in Zürich.',
}

/** Where else to find me. One marked `casual` is for the front page, not for a CV. */
export const links: { label: string; href: string; casual?: boolean }[] = [
  { label: 'Email', href: 'mailto:tiagosilvajeronimo@gmail.com' },
  { label: 'LinkedIn', href: 'https://linkedin.com/in/tiagojs' },
  { label: 'GitHub', href: 'https://github.com/TiagoJeronimo' },
  { label: 'Instagram', href: 'https://www.instagram.com/tiago.jeron.silv/', casual: true },
]

/** What a link that leaves the site gets: it opens in a tab of its own, so that the site stays where it was. */
export const outside = (href: string) => (/^https?:/.test(href) ? { target: '_blank', rel: 'noreferrer' } : {})

export interface Chapter {
  id: string
  /** Where it goes on the CV page: a job, the studio with friends, the degree, or the rest of life. */
  part: 'work' | 'play' | 'study' | 'off'
  /** The place, or the name of the chapter. */
  org: string
  years?: string
  title: string
  role?: string
  body: string[]
  tags?: string[]
  quote?: { text: string; by: string }
  /** Its two colours: a pale one to stand on, and a strong one for the marks. */
  bg: string
  accent: string
  /** The public sites of the place, where I am sure of them. */
  sites?: { label: string; href: string }[]
  /** A small word of my own at the end of its card on the front page. Not for the CV: that keeps a straight face. */
  aside?: string
  /** The marks of the place, from `public/logos`: so that it is told at a glance for the real place it is. */
  logos?: string[]
  /** A picture of the place's own public site as it was when I worked there, for its card on the front page, where it
      is shown small on a white card. Mine, taken from the site itself or from the web archive's copy of it. */
  shot?: string
}

/** The chapters, newest first. */
export const chapters: Chapter[] = [
  {
    id: 'smallpdf',
    part: 'work',
    org: 'Smallpdf · Sign.com',
    years: '2022–2026',
    title: 'Building a signing product, end to end.',
    role: 'Senior Full-Stack Engineer · Zürich',
    body: [
      'Smallpdf is the most used online PDF software and one of the 200 most visited websites in the world. I started on the core product, then moved to Sign.com, its e-signature product.',
      'I delivered the full signing experience, team collaboration and account management, shipped growth and monetisation experiments (often several in parallel), built and maintained payments and plans, took technical ownership of core frontend areas and mentored other engineers.',
    ],
    quote: {
      text: '… a champion of AI in both how he builds and what he builds.',
      by: 'Christina Petushenko, General Manager, Sign.com',
    },
    tags: ['React', 'TypeScript', 'Experiments', 'Payments', 'LLMs'],
    bg: '#dde2ff',
    accent: '#5b68d6',
    sites: [
      { label: 'smallpdf.com', href: 'https://smallpdf.com' },
      { label: 'sign.com', href: 'https://sign.com' },
    ],
    aside: 'I have signed more test documents than anybody should. None of them count.',
    logos: ['/logos/smallpdf.png', '/logos/sign.png'],
    shot: '/thumbs/sign-com.jpg',
  },
  {
    id: 'nomoko',
    part: 'work',
    org: 'Nomoko',
    years: '2020–2022',
    title: 'A map-heavy app, built from scratch.',
    role: 'Senior Frontend Developer · Zürich',
    body: [
      'I built Nomoko’s main app from scratch in React and TypeScript, with heavy use of mapbox-gl. For a while I was the only frontend developer.',
      'I created the component library, started the move to micro frontends, helped run the frontend and QA teams, and took part in hiring.',
    ],
    tags: ['React', 'TypeScript', 'mapbox-gl', 'Storybook', 'Micro frontends'],
    bg: '#d2eef2',
    accent: '#2f9aa8',
    aside: 'For a while I was the whole frontend team. The stand-ups were efficient.',
    logos: ['/logos/nomoko.jpg'],
    shot: '/thumbs/nomoko-platform.jpg',
  },
  {
    id: 'drover',
    part: 'work',
    org: 'Drover',
    years: '2019–2020',
    title: 'Startup speed, and an A/B test tool.',
    role: 'Frontend Developer · Lisbon, for a London startup',
    body: [
      'I worked on the main website of Drover while it grew from Series A to Series B. It was later acquired by Cazoo.',
      'Server-side rendered React and TypeScript, tested with Jest. I also built the A/B testing tool that let us run experiments on both the server and the client.',
    ],
    tags: ['React', 'TypeScript', 'Node.js SSR', 'Jest'],
    bg: '#fff1c2',
    accent: '#c98a12',
    aside: 'Building an A/B test tool teaches you humility. I am usually B.',
    logos: ['/logos/drover.jpg'],
    shot: '/thumbs/drover-site.jpg',
  },
  {
    id: 'runtime',
    part: 'work',
    org: 'Runtime Revolution',
    years: '2018–2019',
    title: 'Products for clients, from zero.',
    role: 'Frontend Developer · Lisbon',
    body: ['Web and mobile projects for clients, mostly in the USA. I built several of them from scratch, worked directly with the clients and helped shape the designs.'],
    tags: ['React', 'React Native', 'TypeScript', 'Firebase'],
    bg: '#ffe0d6',
    accent: '#e2694f',
    aside: 'Starting from zero is a skill. I have had a lot of practice.',
    logos: ['/logos/runtime-revolution.png'],
    shot: '/thumbs/runtime-site.jpg',
  },
  {
    id: 'research',
    part: 'work',
    org: 'INESC-ID',
    years: '2017–2018',
    title: 'Research, in augmented reality.',
    role: 'Researcher & Developer · IT-MEDEX project',
    body: [
      'My master’s thesis: planning implants on 3D medical images, with a tablet as the controller inside an augmented-reality scene.',
      'Built in Unity and C# as part of IT-MEDEX, a project on interactive tablets for collaborative work with 3D medical images.',
    ],
    tags: ['Unity', 'C#', 'Augmented reality'],
    bg: '#d4f4e4',
    accent: '#3aa57c',
    sites: [{ label: 'The code, on GitHub', href: 'https://github.com/TiagoJeronimo/ImplantAR' }],
    aside: '3D is easy, until somebody has to point at something in it.',
    logos: ['/logos/inesc-id.png'],
    shot: '/thumbs/implantar-marker.jpg',
  },
  {
    id: 'brave-bunny',
    part: 'play',
    org: 'Brave Bunny',
    years: '2014–2016',
    title: 'Games came first.',
    role: 'A tiny game studio with friends',
    body: [
      'We made small games, entered game jams and competitions, and won a few awards along the way, including 2nd place at the Microsoft PizzaNight Games Competition.',
      'Curvatron started as a well-received mobile game on Android and iOS and ended up on Steam, where it is free to play now.',
    ],
    tags: ['JavaScript', 'Unity', 'C#'],
    bg: '#e6dcff',
    accent: '#8a63d2',
    sites: [{ label: 'bravebunny.github.io', href: 'https://bravebunny.github.io/' }],
  },
  {
    id: 'lisbon',
    part: 'study',
    org: 'Instituto Superior Técnico',
    years: '2012–2017',
    title: 'It started in Lisbon.',
    role: 'BSc + MSc in Information Systems and Computer Engineering',
    body: [
      'Five years of computer engineering, majoring in Interaction & Visualization and in Games, with an Erasmus semester in Kraków.',
      'Every summer from 2010 to 2016 I worked as a metalworker.',
    ],
    tags: ['Interaction & Visualization', 'Games', 'Erasmus · Kraków'],
    bg: '#d6ecff',
    accent: '#4d8fd6',
  },
  {
    id: 'off-screen',
    part: 'off',
    org: 'Off screen',
    title: 'Mountains, waves and a camera.',
    body: [
      'Hiking, climbing, snowboarding, surfing and camping. Photography, cinematography and animation. Music. And Lego, obviously.',
      'On the side I made Snap Marker, a minimalist Chrome extension to draw, highlight text and point at things on any web page.',
    ],
    tags: ['Portuguese · native', 'English · fluent', 'Spanish · basic', 'German · elementary'],
    bg: '#ffdfe8',
    accent: '#d6578a',
  },
]
