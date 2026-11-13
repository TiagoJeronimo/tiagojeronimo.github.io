// Small pictures drawn by hand for the cards that have no photograph of their own: one character a pixel, a dot for
// nothing, twelve across and nine down (4 by 3, like the cards). An `a` is the card's own strong colour.

export const ART: Record<string, { rows: string[]; ink: Record<string, string> }> = {
  // A bunny, for the studio of that name.
  bunny: {
    rows: ['...WW..WW...', '...WP..PW...', '...WP..PW...', '..WWWWWWWW..', '..WKWWWWKW..', '..WWWWNWWW..', '..WWWWWWWW..', '...WWWWWW...', '............'],
    ink: { W: '#ffffff', P: '#f5a3b5', K: '#3f3b4e', N: '#f08fa8' },
  },
  // A broccoli, looking back. It stands at the foot of the page with the bunny and the fox.
  broccoli: {
    rows: ['.....LG.....', '..LG.GG.LG..', '..GGGGGGGG..', '..GKGGGGKG..', '..GGGGGGGG..', '...GSSSSG...', '....SSSS....', '....SSSS....', '............'],
    ink: { G: '#5fb56a', L: '#93db8d', S: '#cdeaa0', K: '#3f3b4e' },
  },
  // A castle, with its gate and its flag.
  castle: {
    rows: ['.....Paa....', '.....P......', '.S.S.SS.S.S.', '.SSS.SS.SSS.', '.SSSSSSSSSS.', '.SSSSDDSSSS.', '.SSSSDDSSSS.', '.SSSSDDSSSS.', '............'],
    ink: { S: '#b7b2ba', D: '#9a7b62', P: '#8a6d58' },
  },
  // A snake that turns: one button, many players.
  snake: {
    rows: ['............', '..aaaaaa....', '..a....a....', '..a....a..H.', '..a....aaaa.', '..a.........', '..aaaaaaa...', '..........o.', '............'],
    ink: { H: '#ffd45c', o: '#ff8fb0' },
  },
  // A fox, a little confused.
  fox: {
    rows: ['..O......O..', '..OO....OO..', '..OOOOOOOO..', '..OOOOOOOO..', '..OKOOOOKO..', '..WWOOOOWW..', '..WWWNNWWW..', '...WWWWWW...', '............'],
    ink: { O: '#f08a4b', W: '#ffffff', K: '#3f3b4e', N: '#3f3b4e' },
  },
  // A raccoon: it sleeps on the card that was open last. Its eyes are the white in its mask.
  raccoon: {
    rows: ['..M......M..', '..GG....GG..', '..GGGGGGGG..', '..GGGWWGGG..', '..MKMGGMKM..', '..MMWWWWMM..', '...WWNNWW...', '....WWWW....', '............'],
    ink: { G: '#a3a7b5', M: '#4b4759', W: '#ffffff', K: '#ffffff', N: '#3f3b4e' },
  },
  // A llama, as much of it as shows over the top of a card: ears, a face, and a neck that goes on down.
  llama: {
    rows: ['...C....C...', '...C....C...', '...CCCCCC...', '...CKCCKC...', '...CCWWCC...', '....CNNC....', '....CCCC....', '....CCCC....', '....CCCC....'],
    ink: { C: '#d9a066', W: '#f7e3c4', K: '#3f3b4e', N: '#8a5a3c' },
  },
  // A letter, for the card that says how to reach me.
  envelope: {
    rows: ['............', '.WWWWWWWWWW.', '.WaWWWWWWaW.', '.WWaWWWWaWW.', '.WWWaWWaWWW.', '.WWWWaaWWWW.', '.WWWWWWWWWW.', '.WWWWWWWWWW.', '............'],
    ink: { W: '#ffffff' },
  },
  // A snail. Three of them hide on the page.
  snail: {
    rows: ['............', '............', '...SSSS..K.K', '..SSssSS.B.B', '..SsSSsS.BBB', '..SSssSSBBBB', '.BBBBBBBBBBB', '............', '............'],
    ink: { S: '#f0a35e', s: '#c9793a', B: '#f3e2a6', K: '#3f3b4e' },
  },
  // A moon and a sun, each with a face, for the button that brings the night and takes it away.
  moon: {
    rows: ['.....MMMM...', '...MMMM.....', '..MMMM......', '..MKM.......', '..MPM.......', '..MMMM......', '...MMMM.....', '.....MMMM...', '............'],
    ink: { M: '#7f8be6', K: '#3f3b4e', P: '#f5a3b5' },
  },
  sun: {
    rows: ['.....rr.....', '..r......r..', '....YYYY....', '...YYYYYY...', 'rr.YKYYKY.rr', '...PYooYP...', '....YYYY....', '..r......r..', '.....rr.....'],
    ink: { Y: '#ffcf4a', r: '#f6a43a', o: '#e8833a', K: '#3f3b4e', P: '#ffa48c' },
  },
  // A worm, at home in its fruit: it stands out of the top of it. Its foot, its neck and its head have an ink each (G,
  // N and H, all one green), so that the styles can move them apart: under the cursor it leans, ducks and peeps.
  worm: {
    rows: ['........HK..', '......s.N...', '.....sl.G...', '...RRRRRR...', '..RwRRRRRR..', '..RRRRRRRR..', '..RRRRRRRR..', '..RRRRRRRR..', '...RRRRRR...'],
    ink: { R: '#ee6a62', w: '#f8958c', s: '#8a6d58', l: '#67bd72', G: '#b7e07a', N: '#b7e07a', H: '#b7e07a', K: '#3f3b4e' },
  },
  // A marker, and the line it has just drawn.
  marker: {
    rows: ['............', '.........PP.', '........PPP.', '.......PPP..', '......TTP...', '..YYYYYT....', '.YYYYYYY....', '..YYYYY.....', '............'],
    ink: { Y: '#ffe07a', P: '#5b68d6', T: '#3f3b4e' },
  },
  // A screen with something to play on it.
  film: {
    rows: ['............', '.FFFFFFFFFF.', '.FwwwwwwwwF.', '.FwwwawwwwF.', '.FwwwaawwwF.', '.FwwwawwwwF.', '.FwwwwwwwwF.', '.FFFFFFFFFF.', '............'],
    ink: { F: '#3f3b4e', w: '#fffaf0' },
  },
  // A page, signed.
  page: {
    rows: ['............', '...WWWWWW...', '...WllllW...', '...WWWWWW...', '...WlllWW...', '...WWWWWW...', '...WaaWaW...', '...WWaaWW...', '............'],
    ink: { W: '#ffffff', l: '#c3c8ea' },
  },
  // A pin on a map: land, and water.
  pin: {
    rows: ['............', '.....aa.....', '....aWWa....', '....aWWa....', '.....aa.....', '..gg.aa.bbb.', '.gggg..bbbb.', '.gggggbbbbb.', '............'],
    ink: { W: '#ffffff', g: '#a5dbb0', b: '#a6d8ee' },
  },
  // A rocket: a startup, in a hurry.
  rocket: {
    rows: ['.....WW.....', '....WWWW....', '....WaaW....', '....WWWW....', '...aWWWWa...', '...a.WW.a...', '.....ff.....', '.....f......', '............'],
    ink: { W: '#ffffff', f: '#ffb347' },
  },
  // A window and a phone: products for other people.
  screens: {
    rows: ['............', '.FFFFFFF.FFF', '.FaaaaaF.FwF', '.FwwwwwF.FwF', '.FwwwwwF.FwF', '.FFFFFFF.FaF', '...FFF...FFF', '............', '............'],
    ink: { F: '#3f3b4e', w: '#ffffff' },
  },
  // A cube that hangs over a tablet: there, and not there.
  cube: {
    rows: ['............', '....aaaa....', '...aAAAAa...', '...aAAAAa...', '....aaaa....', '............', '..FFFFFFFF..', '..FwwwwwwF..', '..FFFFFFFF..'],
    ink: { A: '#bfeeda', F: '#3f3b4e', w: '#ffffff' },
  },
}
