# The words this project uses

One line a word. The code, its comments and the notes for agents all use them this way.

## The site

- **card**: one project on the front page. **sheet**: the card opened, a `<dialog>` with the rest of its words.
- **poster**: the wide card that leads the grid. **chip**: a filter button for one **kind** (games, web, work, ...).
- **old stuff**: cards marked `old`, under a dashed line of their own.
- **blurb** / **body**: a card's one line, and the paragraphs in its sheet.

## Every game

- **world**: a game with no page round it: a plain class that can be stepped in node. **page**: the React round it.
- **stage**: the component inside the canvas that makes the world, moves it on each frame and takes the clicks.
- **picture**: canvas, finish and pump together (`Picture.tsx`). **finish**: soft shading in the corners, glow, tone.
- **pump**: the loop that draws the frames and counts them. **step** or **tier**: how finely the picture is drawn,
  0 (all of it) to 4 (the lightest), going down only on a machine that cannot keep up.
- **tile**: one square of ground. **cube**: one box of a pool (`Cubes`), drawn with all the others in one call.
- **bit**: a loose cube that flies and falls (`Bits`): leaves, splashes, sparks.
- **view**: the camera (`View.ts`). **land**: the mesh it points at. **span** or **reach**: how far the land goes.
- **hints**: the three lines that say how to get about, each gone once it has been done (`m`ove, `z`oom, `t`urn).
- **label** or **tip**: the words by the cursor for what it rests on. They say what is so now.
- **pat**: a click on an animal. **knock** or **strike**: a click on a thing.

## The island

- **isle**: one piece of land with a map of its own; the first is "the island". **map**: its rows, a character a tile.
- **variant**: another map of the same isle. **deal**: shuffle an isle's **loose** things by a **seed** (0 is as drawn).
- **bed**: a low tile that carries water once it gets there. **filled**: it has.
- **wake**: a tile comes alive (grass, leaves) when water is near. **life**: how much of the world is awake.
- **thing**: whatever stands on a tile and can be knocked: boulder, frog, windmill. Its fields are in `grid.ts`.
- **hits**: knocks left before it gives. **todo**: to be solved some other way. **found**: it has been dealt with.
- **tap**: what a knock does once there is nothing left to break. **play**: a knock on a toy, which counts for nothing.
- **clue**: what the game says about a thing when the player is stuck. **fuss**: what it says at the sixth useless knock.
- **memo**: notes the isles leave when something happens. **combo**: what happens when two notes are both true.
- **secret**: a find that is not needed to finish. **snail**: one hides on each isle. **wish**: what a **friend** wants.
- **critter**: an animal, or anything else that moves in one piece (sails, a balloon).
- **done**: everything with `hits` or `todo` is found. **won**: done, and every tile there is has woken.
- **reel**: the ending while it rolls up the picture. **epilogue**: the ending.

## The castle

- **piece**: a stretch of wall, a tower, the gate or the keep. **course**: one layer of its stones. **tooth**: a
  stone on top of a wall.
- **team**: 0 or 1, the colour a soldier wears. **owner**: the team the castle belongs to just now.
- **duty**: what a soldier has to do this frame. **laze**: what it does with nothing to do.
- **seat**: a place at a picnic. **peace**: everybody is sitting, with some of each colour.
