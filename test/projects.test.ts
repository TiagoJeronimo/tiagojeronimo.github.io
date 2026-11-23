// Run with `npm test`. Checks the list the front page is made from: every card can be opened by its own address,
// has something to show and somewhere to lead, and a picture it names is really there.
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { ART } from '../src/home/art.ts'
import { hello, helloOld, KINDS, projects } from '../src/home/projects.ts'

const slugs = projects.map((project) => project.slug)
assert.equal(new Set(slugs).size, slugs.length, `two cards share an address: ${slugs}`)
for (const project of projects) {
  const say = (what: string) => `${project.slug}: ${what}`
  assert.match(project.slug, /^[a-z0-9-]+$/, say('its address has more in it than small letters, digits and dashes'))
  assert.ok(project.kind in KINDS, say(`an unknown kind, ${project.kind}`))
  assert.ok(project.title && project.blurb && project.body.length, say('no title, no line for the card, or nothing for the panel'))
  assert.ok(ART[project.art], say(`no drawing called ${project.art}`))
  for (const file of [project.picture, project.small, project.after, ...(project.more ?? []), ...(project.logos ?? [])]) assert.ok(!file || existsSync(`public${file}`), say(`a picture of its is missing: public${file}`))
  // A picture that is shown small has a small copy of itself beside it, and so has the poster's (`Shot` in `Home.tsx`).
  if (project.picture?.endsWith('.jpg') && (project.framed || project.wide)) assert.ok(existsSync(`public${project.picture.replace('.jpg', '-s.jpg')}`), say(`the small copy of its picture is missing: public${project.picture.replace('.jpg', '-s.jpg')}`))
  assert.ok(project.links.length, say('it leads nowhere'))
  for (const link of project.links) assert.match(link.href, /^(https:\/\/|\/)/, say(`an odd link: ${link.href}`))
}
// Every drawing is twelve across and nine down, and uses no colour it does not have ('a' is the card's own).
for (const [name, { rows, ink }] of Object.entries(ART)) {
  assert.ok(rows.length === 9 && rows.every((row) => row.length === 12), `the drawing ${name} is not 12 by 9`)
  const odd = [...new Set(rows.join(''))].filter((c) => c !== '.' && c !== 'a' && !ink[c])
  assert.equal(odd.length, 0, `the drawing ${name} uses colours it does not have: ${odd}`)
}
assert.ok(helloOld.old && ART[helloOld.art] && helloOld.slug !== hello.slug && helloOld.links.length, 'the older card that says how to reach me is short of something')
assert.ok(ART[hello.art] && hello.kind in KINDS && hello.links.length, 'the card that says how to reach me is short of a drawing, a kind or a link')
console.log(`projects: ok (${projects.length} cards)`)
