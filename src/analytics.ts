import posthog from './posthog.ts'

/** Destinations stay useful for comparisons without recording email addresses, search strings or fragments. */
export function linkProperties(href: string, label: string, source: string) {
  if (href.startsWith('mailto:')) return { link_type: 'email', destination: 'email', link_label: label, source }
  const url = new URL(href, 'https://tiagojeronimo.github.io')
  const internal = url.origin === 'https://tiagojeronimo.github.io'
  const game = internal && ['/games/island/', '/games/castle/', '/games/sheep/'].includes(url.pathname)
  const social = /(^|\.)(linkedin\.com|github\.com|instagram\.com)$/.test(url.hostname)
  return {
    link_type: internal ? (url.pathname === '/cv/' ? 'cv' : game ? 'game' : 'internal') : social ? 'social' : 'external',
    destination: internal ? url.pathname : url.hostname,
    link_label: label,
    source,
  }
}

export function trackLink(href: string, label: string, source: string, project?: { slug: string; kind: string }) {
  const properties = {
    ...linkProperties(href, label, source),
    ...(project ? { project_slug: project.slug, project_kind: project.kind } : {}),
  }
  const navigation = { send_instantly: true, transport: 'sendBeacon' as const }
  posthog.capture('portfolio_link_clicked', properties, navigation)
  if (properties.link_type === 'email') posthog.capture('portfolio_contact_intent', { ...properties, method: 'email' }, navigation)
}
