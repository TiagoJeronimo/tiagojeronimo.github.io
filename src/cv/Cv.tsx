import { useEffect, type CSSProperties } from 'react'
import { chapters, links, me, outside, type Chapter } from '../content.ts'
import { trackLink } from '../analytics.ts'
import posthog from '../posthog.ts'

/** One chapter of the CV: when, where, what it was, and what I did there. */
function Entry({ chapter }: { chapter: Chapter }) {
  return (
    <article style={{ '--mark': chapter.accent, '--tile': chapter.bg } as CSSProperties}>
      <p className="when">{chapter.years}</p>
      <div>
        <h3>
          {chapter.logos?.map((logo) => (
            <img key={logo} src={logo} alt="" />
          ))}
          {chapter.org}
        </h3>
        {chapter.role && <p className="role">{chapter.role}</p>}
        <p className="title">{chapter.title}</p>
        {chapter.body.map((line) => (
          <p key={line}>{line}</p>
        ))}
        {chapter.quote && (
          <blockquote>
            {chapter.quote.text}
            <cite>{chapter.quote.by}</cite>
          </blockquote>
        )}
        {chapter.tags && (
          <ul className="tags">
            {chapter.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        )}
        {chapter.sites && (
          <p className="sites">
            {chapter.sites.map((site) => (
              <a key={site.href} href={site.href} {...outside(site.href)} onClick={() => trackLink(site.href, site.label, 'cv_experience', { slug: chapter.id, kind: chapter.part })}>
                {site.label}
              </a>
            ))}
          </p>
        )}
      </div>
    </article>
  )
}

const PARTS: [title: string, parts: Chapter['part'][]][] = [
  ['Experience', ['work', 'play']],
  ['Education', ['study']],
  ['Off screen', ['off']],
]

/** The CV: plain, quick to load, and fit to print. */
export default function Cv() {
  useEffect(() => {
    const print = () => posthog.capture('cv_print_requested')
    addEventListener('beforeprint', print)
    return () => removeEventListener('beforeprint', print)
  }, [])
  return (
    <main className="cv">
      <header>
        <a className="sound back" href="/">
          ← Things I’ve made
        </a>
        <h1>{me.name}</h1>
        <p className="lead">{me.role}</p>
        <p>{me.open}</p>
        <ul className="contact">
          {links
            .filter((link) => !link.casual)
            .map((link) => (
              <li key={link.label}>
                <a href={link.href} {...outside(link.href)} onClick={() => trackLink(link.href, link.label, 'cv_header')}>
                  {link.label}
                </a>
              </li>
            ))}
        </ul>
      </header>
      {PARTS.map(([title, parts]) => (
        <section key={title}>
          <h2>{title}</h2>
          {chapters
            .filter((chapter) => parts.includes(chapter.part))
            .map((chapter) => (
              <Entry key={chapter.id} chapter={chapter} />
            ))}
        </section>
      ))}
    </main>
  )
}
