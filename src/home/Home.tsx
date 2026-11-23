import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { flushSync } from 'react-dom'
import { links, me, outside } from '../content.ts'
import { ART } from './art.ts'
import { hello, KINDS, projects, type Kind, type Project } from './projects.ts'
import posthog, { isPostHogEnabled } from '../posthog.ts'
import { trackLink } from '../analytics.ts'

/** A small picture drawn by hand, a character a pixel: sharp at any size. An `a` takes the card's own strong colour.
    The drawing carries its name (`art-fox`) and every pixel its ink (`i-K`), so that the styles can move a part of it. */
function Art({ name, accent = '' }: { name: string; accent?: string }) {
  const { rows, ink } = ART[name]
  return (
    <svg className={`art-${name}`} viewBox={`0 0 ${rows[0].length} ${rows.length}`} shapeRendering="crispEdges" aria-hidden="true">
      {rows.flatMap((row, y) => [...row].map((c, x) => (c === '.' ? null : <rect key={`${x} ${y}`} className={`i-${c}`} x={x} y={y} width={1.03} height={1.03} fill={c === 'a' ? accent : ink[c]} />)))}
    </svg>
  )
}

const mark = (project: Project) => project.accent ?? KINDS[project.kind].accent
const colours = (project: Project) => ({ '--tile': project.bg ?? KINDS[project.kind].bg, '--mark': mark(project) }) as CSSProperties

/** What this browser keeps of the page between visits: whether it is night. It may refuse, and then nothing is kept. */
const kept = (key: string) => {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}
const keep = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // then it is not kept
  }
}
/** Somebody who has asked their device for less movement gets none of the page's. */
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** Every card there is: the projects, and after them the one that says how to reach me. */
const cards = [...projects, hello]

/**
 * A sticker comes off under the pointer. Once it has been pulled a little way, a copy of it follows the pointer about
 * the page and stays wherever it is let go (the thing itself is hidden where it was), until the page is loaded again.
 * A copy can be picked up again like the thing it was.
 */
function lift(el: HTMLElement, x0: number, y0: number) {
  const box = el.getBoundingClientRect()
  let copy: HTMLElement | undefined
  const move = (event: PointerEvent) => {
    if (!copy) {
      if (Math.hypot(event.clientX - x0, event.clientY - y0) < 6) return
      copy = el.classList.contains('sticker') ? el : (el.cloneNode(true) as HTMLElement)
      if (copy !== el) {
        copy.classList.add('sticker')
        copy.style.width = `${box.width}px`
        copy.style.height = `${box.height}px`
        copy.onpointerdown = (down) => lift(down.currentTarget as HTMLElement, down.clientX, down.clientY)
        document.body.append(copy)
        el.style.visibility = 'hidden'
      }
    }
    copy.style.left = `${box.left + scrollX + event.clientX - x0}px`
    copy.style.top = `${box.top + scrollY + event.clientY - y0}px`
  }
  const drop = () => {
    removeEventListener('pointermove', move)
    removeEventListener('pointerup', drop)
    removeEventListener('pointercancel', drop)
    if (!copy) return
    // The click that ends a pull is not a click on whatever lies underneath.
    const swallow = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
    }
    addEventListener('click', swallow, true)
    setTimeout(() => removeEventListener('click', swallow, true))
  }
  addEventListener('pointermove', move)
  addEventListener('pointerup', drop)
  addEventListener('pointercancel', drop)
}

/**
 * What a card shows of its project: its picture, or else its drawing. `as` says where: on an ordinary card (which takes
 * the cut made for that shape, where there is one), on the poster (the wide card, which writes the name beside the
 * picture: `.wide .shot` in the styles), or in the sheet.
 */
function Shot({ project, as = 'card' }: { project: Project; as?: 'card' | 'poster' | 'sheet' }) {
  const picture = (as === 'card' && project.small) || project.picture
  // A picture that is shown small has a smaller copy of itself beside it (`-s`), and so has the poster's, for a phone:
  // the browser takes whichever is enough for the size it is shown at.
  const lean = picture?.endsWith('.jpg') && (project.framed || (project.wide && as !== 'card'))
  const [late, setLate] = useState(false) // the second picture waits until the page has had time for the first
  // And nothing turns to meet it until it has really come: a ground that had turned by itself stood in one colour
  // beside a picture in another.
  const [woken, setWoken] = useState(false)
  useEffect(() => {
    if (!project.after) return
    const timer = setTimeout(() => setLate(true), 2500)
    return () => clearTimeout(timer)
  }, [project.after])
  return (
    <div className={`shot${project.whole ? ' whole' : ''}${project.framed ? ' framed' : ''}${woken && as !== 'card' ? ' woken' : ''}`} data-title={project.title}>
      {picture ? (
        <img
          src={picture}
          srcSet={lean ? `${picture.replace('.jpg', '-s.jpg')} ${project.framed ? 640 : 1000}w, ${picture} ${project.framed ? 1000 : 1600}w` : undefined}
          sizes={lean ? (as === 'sheet' ? '100vw' : as === 'poster' ? '(max-width: 36rem) 128vw, 46rem' : '(max-width: 36rem) 78vw, 250px') : undefined}
          alt=""
          loading={as === 'poster' ? 'eager' : 'lazy'}
          fetchPriority={as === 'poster' ? 'high' : undefined}
        />
      ) : (
        <Art name={project.art} accent={mark(project)} />
      )}
      {/* What it becomes, laid over what it is: it comes up under the cursor. */}
      {as !== 'card' && project.after && late && <img className="after" src={project.after} alt="" onLoad={() => setWoken(true)} />}
      {/* The marks of a place I worked, in the corner: so that the card is told at a glance for the real place it is.
          They come off like stickers. */}
      {project.logos && (
        <span className="logos">
          {project.logos.map((logo) => (
            <img key={logo} className="badge" src={logo} alt="" loading="lazy" draggable={false} onPointerDown={(event) => lift(event.currentTarget, event.clientX, event.clientY)} />
          ))}
        </span>
      )}
    </div>
  )
}

/** A video in the panel. Nothing is fetched from YouTube until somebody presses play. */
function Player({ project }: { project: Project }) {
  const [playing, setPlaying] = useState(false)
  if (playing) return <iframe className="shot" src={`https://www.youtube-nocookie.com/embed/${project.video}?autoplay=1`} title={project.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
  return (
    <button
      className="play"
      onClick={() => {
        if (isPostHogEnabled) posthog.capture('portfolio_video_started', { project_slug: project.slug })
        setPlaying(true)
      }}
      aria-label={`Play ${project.title}`}
    >
      <Shot project={project} as="sheet" />
      <span className="btn">Play it here</span>
    </button>
  )
}

/** The link that writes to me. Under the cursor (or the keyboard) it also shows the address itself, with a button that copies it. */
function Mail({ href }: { href: string }) {
  const address = href.replace('mailto:', '')
  const [copied, setCopied] = useState(false)
  const copy = () =>
    navigator.clipboard?.writeText(address).then(() => {
      posthog.capture('portfolio_contact_intent', { method: 'copy_email', source: 'home_header' })
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }).catch(() => {})
  return (
    <span className="mail">
      <a
        className="sound"
        href={href}
        onClick={() => {
          trackLink(href, 'Email', 'home_header')
        }}
      >
        Email
      </a>
      <span className="tip">
        <span>
          {address}
          <button className="sound" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </span>
      </span>
    </span>
  )
}

/** One of the three at the foot of the page. It blinks, and a click gets an answer out of it. */
function Pet({ name, word }: { name: string; word: string }) {
  const [pats, setPats] = useState(0)
  return (
    <button className="pet" onClick={() => setPats(pats + 1)} aria-label={`Pat the ${name}`}>
      {/* (Made afresh at every pat, which is what starts its little jump again.) */}
      <span key={pats} className={pats ? 'pat' : undefined}>
        <Art name={name} />
      </span>
      {pats > 0 && <i key={-pats}>{word}</i>}
    </button>
  )
}

// Three snails hide on the page: one behind a card, one on the line over the old stuff, one inside a sheet. The foot of
// the page counts those found, until the page is loaded again.
const BEHIND = 'brave-bunny'
const INSIDE = 'smallpdf'
function Snail({ id, found, find }: { id: string; found: string; find: (id: string) => void }) {
  const [caught, setCaught] = useState(false)
  if (found.includes(id)) return null
  return (
    // Found, it jumps out of its hiding place and is gone (`caught` in the styles): it is counted when that is over.
    <button
      className={`snail s-${id}${caught ? ' caught' : ''}`}
      onClick={() => (still() ? find(id) : setCaught(true))}
      onAnimationEnd={(event) => event.animationName === 'caught' && find(id)}
      aria-label="A snail, hiding"
    >
      <Art name="snail" />
    </button>
  )
}

/** The raccoon on its visit to a card: it comes along the top, has a sleep, and goes (`visit` in the styles). A click
    wakes it, and it is off at once. */
function Raccoon({ leave }: { leave: () => void }) {
  const [off, setOff] = useState(false)
  return (
    <button className={off ? 'nap off' : 'nap'} onClick={() => setOff(true)} onAnimationEnd={(event) => (event.animationName === 'visit' || event.animationName === 'scurry') && leave()} aria-label="Wake the raccoon">
      <Art name="raccoon" />
    </button>
  )
}

/** The project named in the address, after the `#`: none when there is nothing there. */
const named = () => decodeURIComponent(location.hash.slice(1))

/** The two games are made for a mouse and a keyboard. Whoever asks for one on a phone is told so first: see `play`. */
const GAMES = ['/games/island/', '/games/castle/']
const PHONE = '(pointer: coarse) and (max-width: 600px), (pointer: coarse) and (max-height: 500px)' // held upright, or on its side

export default function Home() {
  const [kind, setKind] = useState<Kind | 'all'>('all')
  const [slug, setSlug] = useState(named)
  const [night, setNight] = useState(() => kept('home/night') === '1')
  const [found, setFound] = useState('') // the snails found, on this visit: they hide again at the next
  const [seen, setSeen] = useState<string[]>([]) // the cards opened, on this visit: each gets a stamp
  const [hop, setHop] = useState<{ slug: string; n: number }>() // the card the llama is walking behind just now,
  const [coon, setCoon] = useState<{ slug: string; n: number }>() // and the one the raccoon is visiting
  const [big, setBig] = useState<string>() // one of a sheet's small pictures, being looked at big
  const [warned, setWarned] = useState<{ href: string; source: string }>() // the game somebody has asked for on a phone, while they are told what to expect
  const impressions = useRef(new Set<string>())
  const viewed = useRef('')
  const openSource = useRef('direct')
  const sheet = useRef<HTMLDialogElement>(null)
  const zoom = useRef<HTMLDialogElement>(null)
  const notice = useRef<HTMLDialogElement>(null)
  const from = useRef<DOMRect>(undefined) // where the card that was clicked stands: the sheet grows out of it
  const open = cards.find((project) => project.slug === slug)
  const kinds = (Object.keys(KINDS) as Kind[]).filter((one) => projects.some((project) => project.kind === one))

  // The address says which project is open, so that one can be linked to, and the back button shuts it.
  useEffect(() => {
    const follow = () => {
      openSource.current = 'history'
      setSlug(named())
    }
    addEventListener('popstate', follow)
    addEventListener('hashchange', follow)
    return () => {
      removeEventListener('popstate', follow)
      removeEventListener('hashchange', follow)
    }
  }, [])
  useEffect(() => {
    const dialog = sheet.current!
    if (open && !dialog.open) {
      dialog.showModal()
      // The sheet itself takes the keyboard when it opens, and not the first thing in it that could: that would be a
      // link at the bottom, which the browser would scroll down to. Tab goes on to the links from there.
      dialog.focus()
      // It grows out of the card that was clicked; opened by its address, it only steps forward a little.
      const card = from.current
      const to = dialog.getBoundingClientRect()
      const start = card ? { transformOrigin: '0 0', opacity: 0.6, transform: `translate(${card.x - to.x}px, ${card.y - to.y}px) scale(${card.width / to.width}, ${card.height / to.height})` } : { transformOrigin: 'center', opacity: 0, transform: 'scale(0.94)' }
      if (!still()) dialog.animate([start, { transformOrigin: start.transformOrigin }], { duration: card ? 320 : 220, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.05)' })
    }
    from.current = undefined
    if (!open && dialog.open) dialog.close()
    dialog.scrollTop = 0
  }, [open])
  useEffect(() => {
    if (open && viewed.current !== open.slug) {
      posthog.capture('portfolio_project_opened', { project_slug: open.slug, project_kind: open.kind, source: openSource.current, filter: kind })
    }
    viewed.current = open?.slug ?? ''
  }, [open, kind])
  // One impression per card and visit, once at least half of it is visible. Filtering does not inflate the count.
  useEffect(() => {
    if (!isPostHogEnabled || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.5) continue
        const slug = (entry.target as HTMLElement).dataset.slug!
        if (impressions.current.has(slug)) continue
        const project = cards.find((card) => card.slug === slug)
        if (!project) continue
        impressions.current.add(slug)
        posthog.capture('portfolio_project_seen', { project_slug: slug, project_kind: project.kind, filter: kind, source: entry.target.classList.contains('wide') ? 'poster' : 'grid' })
        observer.unobserve(entry.target)
      }
    }, { threshold: 0.5 })
    for (const card of document.querySelectorAll('.grid li[data-slug]')) observer.observe(card)
    return () => observer.disconnect()
  }, [kind])
  // A card that has been opened is stamped.
  if (open && !seen.includes(open.slug)) setSeen([...seen, open.slug])
  // A small picture that was clicked comes up big, over the sheet, until a click or the Escape key.
  useEffect(() => {
    const dialog = zoom.current!
    if (big && !dialog.open) dialog.showModal()
    if (!big && dialog.open) dialog.close()
  }, [big])
  // A link to one of the games, clicked on a phone, does not go there at once: a word comes up first, and a button
  // that goes all the same.
  const play = (href: string, source: string) => (event: { preventDefault(): void }) => {
    if (!GAMES.includes(href)) return
    const needsWarning = matchMedia(PHONE).matches
    posthog.capture('portfolio_game_launch_requested', { game: href.split('/')[2], source, needs_warning: needsWarning }, { send_instantly: true, transport: 'sendBeacon' })
    if (!needsWarning) return
    event.preventDefault()
    setWarned({ href, source })
  }
  const warningDecision = (decision: 'continue' | 'cancel' | 'dismiss') => {
    if (warned) posthog.capture('portfolio_game_warning_decided', { game: warned.href.split('/')[2], source: warned.source, decision }, { send_instantly: true, transport: 'sendBeacon' })
    if (decision !== 'continue') setWarned(undefined)
  }
  useEffect(() => {
    const dialog = notice.current!
    if (warned && !dialog.open) dialog.showModal()
    if (!warned && dialog.open) dialog.close()
  }, [warned])
  // Night is a mark on the page itself, which the styles go by.
  useEffect(() => {
    document.documentElement.toggleAttribute('data-night', night)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', night ? '#1d2136' : '#fff4e0')
    keep('home/night', night ? '1' : '')
    return () => document.documentElement.removeAttribute('data-night')
  }, [night])
  // Two visitors come by now and then, each in its own time and to whichever card it likes. A llama walks past behind
  // one: its head comes up over the top, goes along, and down again. A raccoon comes along the top of one, has a
  // sleep there, and goes.
  useEffect(() => {
    if (still()) return
    const somewhere = () => {
      const places = [...document.querySelectorAll<HTMLElement>('.grid li[data-slug]')]
      return !document.hidden && places.length ? { slug: places[Math.floor(Math.random() * places.length)].dataset.slug!, n: Date.now() } : undefined
    }
    const first = setTimeout(() => setCoon(somewhere()), 12000)
    const llama = setInterval(() => setHop((there) => there ?? somewhere()), 24000)
    const raccoon = setInterval(() => setCoon((there) => there ?? somewhere()), 37000)
    return () => {
      clearTimeout(first)
      clearInterval(llama)
      clearInterval(raccoon)
    }
  }, [])

  const show = (to: string) => {
    openSource.current = 'card'
    history.pushState({ card: true }, '', `#${to}`)
    setSlug(to)
  }
  const shut = () => {
    if ((history.state as { card?: boolean } | null)?.card) return history.back() // back to the grid, where it was opened from
    history.replaceState(null, '', location.pathname + location.search)
    setSlug('')
  }
  /** A chip is pressed: the cards slide to their new places, where the browser knows how. (Whoever is visiting is gone.) */
  const pick = (one: Kind | 'all') => {
    if (isPostHogEnabled) posthog.capture('portfolio_filter_selected', { filter: one })
    const go = () => {
      setKind(one)
      setHop(undefined)
      setCoon(undefined)
    }
    if (still() || !('startViewTransition' in document)) return go()
    document.startViewTransition(() => flushSync(go))
  }
  const find = (id: string) => setFound(found + id)
  const shown = cards.filter((project) => kind === 'all' || project.kind === kind)
  const card = (project: Project, n: number) => {
    const poster = project.wide && kind === 'all'
    // One of my two games, on a card of the ordinary shape. (Its own card: not another that happens to lead to it, as
    // the old islands of cubes do.)
    const game = !poster && project.kind === 'games' && GAMES.includes(project.links[0].href)
    return (
      <li key={project.slug} data-slug={project.slug} className={[poster && 'wide', game && 'game', seen.includes(project.slug) && 'seen'].filter(Boolean).join(' ') || undefined} style={{ ...colours(project), '--n': n, viewTransitionName: `card-${project.slug}` } as CSSProperties}>
        {project.slug === BEHIND && <Snail id="a" found={found} find={find} />}
        {coon?.slug === project.slug && <Raccoon key={coon.n} leave={() => setCoon(undefined)} />}
        {hop?.slug === project.slug && (
          <span key={hop.n} className="hop" onAnimationEnd={(event) => event.animationName === 'stroll' && setHop(undefined)} aria-hidden="true">
            <Art name="llama" />
          </span>
        )}
        <a
          className="tile"
          href={`#${project.slug}`}
          draggable={false}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey) return // a new tab, or a new window: the address will open it there
            event.preventDefault()
            from.current = event.currentTarget.getBoundingClientRect()
            show(project.slug)
          }}
        >
          <Shot project={project} as={poster ? 'poster' : 'card'} />
          <span className="what">
            <strong>{project.title}</strong>
            {project.role && <span className="role">{project.role}</span>}
            <span className="blurb">{project.blurb}</span>
            <span className="meta">
              <i>{KINDS[project.kind].name}</i>
              {project.when}
            </span>
          </span>
        </a>
        {/* The poster carries its main link as a button, so that the thing itself is one click away; and so does the
            card of a game, in the corner of its picture. It lies over the card and is not inside it: a link within a
            link is no link. */}
        {(poster || game) && (
          <a
            className="btn now"
            href={project.links[0].href}
            {...outside(project.links[0].href)}
            onClick={(event) => {
              trackLink(project.links[0].href, project.links[0].label, 'card', project)
              play(project.links[0].href, 'card')(event)
            }}
          >
            {project.links[0].label}
          </a>
        )}
      </li>
    )
  }

  return (
    <main className="home">
      <header className="hello">
        <div>
          <h1>{me.name}</h1>
          <p className="lead">{me.role}</p>
          <p>{me.line} Here is some of what I’ve made, at work and for fun.</p>
          {/* The tip, in plain sight and with a face: the whole of it is the link, a small sheep and a few words. */}
          <a className="coffee" href="/games/sheep/" onClick={() => trackLink('/games/sheep/', 'Buy me a sheep', 'home_header')}>
            <Art name="sheep" />
            <span>
              <b>Buy me a sheep.</b> Like this site, or any of the games? It is a tip, and the sheep is the receipt.
            </span>
          </a>
        </div>
        <nav aria-label="Elsewhere">
          <a className="btn" href="/cv/" onClick={() => trackLink('/cv/', 'My CV', 'home_header')}>
            My CV
          </a>
          {links.map((link) =>
            link.href.startsWith('mailto:') ? (
              <Mail key={link.label} href={link.href} />
            ) : (
              <a
                key={link.label}
                className="sound"
                href={link.href}
                {...outside(link.href)}
                onClick={() => {
                  trackLink(link.href, link.label, 'home_header')
                }}
              >
                {link.label}
              </a>
            ),
          )}
          <button className="sound lamp" aria-pressed={night} onClick={() => setNight(!night)} aria-label="Night" title={night ? 'Day' : 'Night'}>
            <Art name={night ? 'sun' : 'moon'} />
          </button>
        </nav>
      </header>

      <div className="kinds" role="group" aria-label="Show only">
        {(['all', ...kinds] as const).map((one) => (
          <button key={one} className="sound" aria-pressed={kind === one} onClick={() => pick(one)}>
            {one === 'all' ? 'All' : KINDS[one].name} <small>{one === 'all' ? projects.length : projects.filter((project) => project.kind === one).length}</small>
          </button>
        ))}
      </div>

      {shown.some((project) => !project.old) && <ul className="grid">{shown.filter((project) => !project.old).map(card)}</ul>}
      {/* The old stuff, under a line of its own. */}
      {shown.some((project) => project.old) && (
        <section className="old" aria-labelledby="old-title">
          <Snail id="b" found={found} find={find} />
          <h2 id="old-title">Old stuff</h2>
          <p>Made years ago, for no reason. Still here for the same one.</p>
          <ul className="grid">{shown.filter((project) => project.old).map(card)}</ul>
        </section>
      )}

      {/* One project, close up. Shut by its button, the Escape key, the back button, or a click beside it. */}
      <dialog className="sheet" ref={sheet} tabIndex={-1} style={open && colours(open)} aria-labelledby="sheet-title" onClose={() => open && shut()} onClick={(event) => event.target === sheet.current && shut()}>
        {open && (
          <article>
            {open.video ? <Player key={open.slug} project={open} /> : <Shot project={open} as="sheet" />}
            <div className="about">
              {open.slug === INSIDE && <Snail id="c" found={found} find={find} />}
              <p className="meta">
                <i>{KINDS[open.kind].name}</i>
                {open.when}
              </p>
              <h2 id="sheet-title">{open.title}</h2>
              {open.role && <p className="role">{open.role}</p>}
              {open.kind === 'work' && <p className="lead">{open.blurb}</p>}
              {open.body.map((line) => (
                <p key={line}>{line}</p>
              ))}
              {open.aside && <p className="aside">{open.aside}</p>}
              {/* More pictures of the same thing, where there are any: small, and a click shows one big. */}
              {open.more && (
                <p className="more">
                  {open.more.map((picture) => (
                    <button key={picture} onClick={() => setBig(picture)} aria-label="See this picture bigger">
                      <img src={picture} alt="" loading="lazy" />
                    </button>
                  ))}
                </p>
              )}
              {open.tags && (
                <ul className="tags">
                  {open.tags.map((tag) => (
                    <li key={tag} className="sound">
                      {tag}
                    </li>
                  ))}
                </ul>
              )}
              <div className="go">
                {open.links.map((link, k) => (
                  <a
                    key={link.href}
                    className={k ? 'sound' : 'btn'}
                    href={link.href}
                    {...outside(link.href)}
                    onClick={(event) => {
                      trackLink(link.href, link.label, 'sheet', open)
                      play(link.href, 'sheet')(event)
                    }}
                  >
                    {link.label}
                  </a>
                ))}
                <button className="sound" onClick={shut}>
                  Close
                </button>
              </div>
            </div>
          </article>
        )}
      </dialog>

      <dialog className="zoom" ref={zoom} onClose={() => setBig(undefined)} onClick={() => setBig(undefined)} aria-label="The picture, bigger">
        {big && <img src={big} alt="" />}
      </dialog>

      {/* A word before a game is opened on a phone. Shut by its button, the Escape key, or a click beside it. */}
      <dialog className="notice" ref={notice} aria-labelledby="notice-title" onClose={() => warningDecision('dismiss')} onClick={(event) => event.target === notice.current && warningDecision('dismiss')}>
        <h2 id="notice-title">Made for a computer</h2>
        <p>This game is meant to be played on a computer. It will open on your phone, but it probably won’t work very well.</p>
        <div className="go">
          <a className="btn" href={warned?.href} onClick={() => warningDecision('continue')}>
            Play anyway
          </a>
          <button className="sound" onClick={() => warningDecision('cancel')}>
            Not now
          </button>
        </div>
      </dialog>

      {/* By night the fireflies are out, down the whole length of the page: scrolling goes past them. */}
      {night && (
        <div className="flies" aria-hidden="true">
          {Array.from({ length: 30 }, (_, k) => (
            <i key={k} style={{ '--x': `${(k * 37 + 9) % 100}%`, '--y': `${(k * 53 + 17) % 100}%`, '--dx': `${((k * 29) % 90) - 45}px`, '--dy': `${((k * 41) % 70) - 50}px`, '--t': `${7 + (k % 5) * 1.7}s`, '--d': `${-k * 1.3}s` } as CSSProperties} />
          ))}
        </div>
      )}

      <footer>
        <span className="row">
          <Pet name="bunny" word={night ? 'zzz' : 'boing'} />
          <Pet name="fox" word={night ? 'zzz' : 'hm?'} />
          <Pet name="broccoli" word={night ? 'zzz' : 'no.'} />
        </span>
        <p>
          {me.name} · Zürich · <a href="/cv/" onClick={() => trackLink('/cv/', 'CV', 'home_footer')}>CV</a>
        </p>
        <p className="tray" aria-live="polite">
          {/* (A snail that has been found comes off like a sticker.) */}
          <span className="row" aria-hidden="true">
            {[0, 1, 2].map((k) => (
              <span key={k} className={k < found.length ? 'got' : 'lost'} onPointerDown={k < found.length ? (event) => lift(event.currentTarget, event.clientX, event.clientY) : undefined}>
                <Art name="snail" />
              </span>
            ))}
          </span>
          {found.length === 0 ? 'Three snails are hiding on this page.' : found.length < 3 ? `${found.length} of 3 snails found.` : 'All three snails found. There is no prize. There is this sentence.'}
        </p>
        {seen.length > 0 && <p aria-live="polite">{seen.length < cards.length ? `${seen.length} of ${cards.length} cards opened.` : `All ${cards.length} cards opened. You have now read more of this page than I have.`}</p>}
      </footer>
    </main>
  )
}
