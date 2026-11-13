import { useEffect, useRef, useState } from 'react'
import { chapters, links } from './content.ts'
import Scene from './Scene.tsx'
import { toggleSound } from './sound.ts'
import { actions, CALM, scroll, useUi } from './store.ts'

const LAST = chapters.length - 1

export default function App() {
  const { chapter, ready, loose } = useUi()
  const [sound, setSound] = useState(false)
  const cards = useRef<(HTMLElement | null)[]>([])
  const track = useRef<HTMLDivElement>(null)
  const heading = useRef(0) // chapter we are on, or on our way to
  const stepped = useRef(0) // when we last started moving there ourselves

  // One scroll stop per chapter. The smoothed position drives both the cards and the 3D world.
  useEffect(() => {
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const stop = (track.current!.firstElementChild as HTMLElement).offsetHeight
      const target = Math.min(Math.max(scrollY / stop, 0), LAST)
      scroll.s += (target - scroll.s) * (1 - Math.exp(-dt * 7))
      if (CALM || Math.abs(target - scroll.s) < 0.0005) scroll.s = target
      // At rest on a chapter that we did not just step to ourselves: the visitor swiped, used the scrollbar or reloaded.
      if (scroll.s === target && now - stepped.current > 1500 && Math.abs(target - Math.round(target)) < 0.01)
        heading.current = Math.round(target)
      cards.current.forEach((card, i) => {
        if (!card) return
        const away = scroll.s - i
        // Solid near its chapter, gone halfway to the next, and out of the way while the visitor zooms into the model.
        const opacity = Math.min(Math.max(1 - (Math.abs(away) - 0.3) / 0.2, 0), 1) * Math.max(1 - (scroll.zoom - 1) * 2, 0)
        card.style.opacity = String(opacity)
        card.style.transform = `translate3d(0, ${(-away * 80).toFixed(1)}px, 0)`
        card.style.visibility = opacity > 0.01 ? 'visible' : 'hidden'
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  // Paging. Touch swipes, the scrollbar and the space bar scroll natively and the browser snaps them to a chapter
  // (see index.css). Wheels, trackpads, arrow keys and the dots step exactly one chapter at a time from here.
  const go = (i: number) => {
    heading.current = Math.min(Math.max(i, 0), LAST)
    stepped.current = performance.now()
    scrollTo({ top: heading.current * (track.current!.firstElementChild as HTMLElement).offsetHeight, behavior: 'smooth' })
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const step = { ArrowDown: 1, PageDown: 1, ArrowRight: 1, ArrowUp: -1, PageUp: -1, ArrowLeft: -1 }[e.key]
      if (!step || e.metaKey || e.ctrlKey || e.altKey) return
      e.preventDefault()
      go(heading.current + step)
    }

    // One push of the wheel or one swipe on a trackpad is one chapter, however hard it was.
    // A trackpad keeps sending events while it coasts, so after a step we wait, then only step again
    // on a clearly new push: after a pause, when the motion picks up again, or on a full wheel notch.
    let last = 0 // time of the previous wheel event
    let wait = 0 // no new step before this time
    let trail: number[] = [] // size of the last few events
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return // pinch zoom and sideways swipes are not ours
      // Text that overflows its card on a small screen scrolls first.
      const card = (e.target as Element).closest?.('.card')
      if (card && card.scrollHeight > card.clientHeight + 1) {
        const room = e.deltaY > 0 ? card.scrollHeight - card.clientHeight - card.scrollTop : card.scrollTop
        if (room > 1) return
      }
      e.preventDefault()
      const size = Math.abs(e.deltaY) * (e.deltaMode === 1 ? 40 : 1)
      const fresh = e.timeStamp - last > 140
      if (fresh) trail = []
      const rising = trail.length > 0 && size >= 8 && size - Math.min(...trail) >= 5
      last = e.timeStamp
      trail = [...trail.slice(-3), size]
      if (size < 2 || e.timeStamp < wait || !(fresh || rising || size >= 80)) return
      wait = e.timeStamp + 450
      go(heading.current + Math.sign(e.deltaY))
    }

    addEventListener('keydown', onKey)
    addEventListener('wheel', onWheel, { passive: false })
    return () => {
      removeEventListener('keydown', onKey)
      removeEventListener('wheel', onWheel)
    }
  }, [])

  return (
    <>
      <Scene />

      <header className="top">
        <button className="mark" onClick={() => go(0)} data-shown={chapter > 0}>
          Tiago Silva
        </button>
        <button className="sound" aria-pressed={sound} onClick={() => setSound(toggleSound())}>
          Sound {sound ? 'on' : 'off'}
        </button>
        <nav className="dots" aria-label="Chapters">
          {chapters.map((c, i) => (
            <button key={i} className={i === chapter ? 'on' : ''} onClick={() => go(i)} aria-label={c.nav} title={c.nav} />
          ))}
        </nav>
      </header>

      <main>
        {chapters.map((c, i) => (
          <section
            key={i}
            ref={(el) => {
              cards.current[i] = el
            }}
            className={`card ${i === 0 ? 'hero' : i === LAST ? 'finale' : ''}`}
          >
            {i === 0 ? (
              <>
                <h1 className="sr-only">{c.title}</h1>
                <p className="lead">{c.role}</p>
                <p className="lead soft">{c.body[0]}</p>
                <p className="hint">
                  <span className="bob" aria-hidden />
                  Scroll to build
                </p>
              </>
            ) : (
              <>
                {c.kicker && <p className="kicker">{c.kicker}</p>}
                <h2>{c.title}</h2>
                {c.role && <p className="role">{c.role}</p>}
                {c.body.map((text) => (
                  <p key={text}>{text}</p>
                ))}
                {c.quote && (
                  <blockquote>
                    “{c.quote.text}”<cite>{c.quote.by}</cite>
                  </blockquote>
                )}
                {c.tags && (
                  <ul className="tags">
                    {c.tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                )}
                {i === LAST && (
                  <div className="links">
                    {links.map((link) => (
                      <a key={link.label} className="btn" href={link.href} target="_blank" rel="noreferrer">
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        ))}
      </main>

      <div className="tools" data-shown={ready}>
        <span className="fine">Drag a block or the background. Pinch to zoom.</span>
        <span className="coarse">Tap the blocks</span>
        <button className="btn" onClick={loose ? actions.rebuild : actions.smash}>
          {loose ? 'Rebuild' : 'Smash it'}
        </button>
      </div>

      <div className="track" ref={track} aria-hidden>
        {chapters.map((_, i) => (
          <div key={i} />
        ))}
      </div>
    </>
  )
}
