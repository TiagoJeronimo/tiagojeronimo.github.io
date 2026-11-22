import { pathToFileURL } from 'node:url'
import { dashboard, insights } from '../analytics/dashboard.mjs'

/** Validate queries first, then update only this dashboard's marked insights. Re-running must not make copies. */
export async function syncDashboard(request) {
  for (const insight of insights) {
    const result = await request('POST', 'query/', { query: insight.query.source, name: insight.name })
    if (result.error || result.query_status?.error) throw new Error(`Query validation failed: ${insight.name}`)
  }
  const matches = []
  let page = `dashboards/?limit=100&search=${encodeURIComponent(dashboard.name)}`
  while (page) {
    const result = await request('GET', page)
    matches.push(...result.results.filter(item => !item.deleted && item.name === dashboard.name))
    page = result.next
  }
  if (matches.length > 1) throw new Error('Multiple dashboards have this name; choose one explicitly before updating.')
  if (matches[0] && !matches[0].description?.startsWith('[web-cv:portfolio-insights:v1]')) throw new Error('A dashboard with this name exists without our marker; refusing to overwrite it.')
  const board = matches[0]
    ? await request('PATCH', `dashboards/${matches[0].id}/`, dashboard)
    : await request('POST', 'dashboards/', dashboard)
  const detail = await request('GET', `dashboards/${board.id}/`)
  const existing = detail.tiles?.filter(tile => !tile.deleted && tile.insight).map(tile => tile.insight) ?? []
  for (const [index, insight] of insights.entries()) {
    const marker = `[web-cv:${insight.id}]`
    const matching = existing.filter(item => item.description?.startsWith(marker))
    if (matching.length > 1) throw new Error(`Duplicate marked insight: ${insight.id}`)
    const body = { name: insight.name, description: `${marker}\n\n${insight.description}`, query: insight.query, order: index }
    if (matching[0]) await request('PATCH', `insights/${matching[0].id}/`, body)
    else await request('POST', 'insights/', { ...body, dashboards: [board.id] })
  }
  const verified = await request('GET', `dashboards/${board.id}/`)
  const tiles = verified.tiles?.filter(tile => !tile.deleted && tile.insight) ?? []
  for (const insight of insights) {
    if (!tiles.some(tile => tile.insight.description?.startsWith(`[web-cv:${insight.id}]`))) {
      throw new Error(`Dashboard verification failed: missing ${insight.id}`)
    }
  }
  return { dashboardId: board.id, insightCount: insights.length }
}

async function main() {
  if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify({ dashboard, insights }, null, 2))
    return
  }
  const key = process.env.POSTHOG_PERSONAL_API_KEY
  const project = process.env.POSTHOG_PROJECT_ID
  const host = new URL(process.env.POSTHOG_API_HOST ?? 'https://us.posthog.com')
  if (!key || !project || !/^\d+$/.test(project)) throw new Error('Set POSTHOG_PERSONAL_API_KEY and numeric POSTHOG_PROJECT_ID. These are server-side settings, never VITE_ variables.')
  if (host.protocol !== 'https:' || !['us.posthog.com', 'eu.posthog.com'].includes(host.hostname)) throw new Error('POSTHOG_API_HOST must be https://us.posthog.com or https://eu.posthog.com.')
  const root = new URL(`/api/projects/${project}/`, host)
  const request = async (method, path, body) => {
    const url = new URL(path, root)
    if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) throw new Error('Refusing an API URL outside the selected PostHog project.')
    const response = await fetch(url, {
      method, redirect: 'error', signal: AbortSignal.timeout(60000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    if (!response.ok) throw new Error(`PostHog ${method} ${url.pathname} returned ${response.status}; check API permissions or the query definition.`)
    return response.json()
  }
  const result = await syncDashboard(request)
  console.log(`${host.origin}/project/${project}/dashboard/${result.dashboardId} (${result.insightCount} insights)`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
