import assert from 'node:assert/strict'
import { dashboard, insights } from '../analytics/dashboard.mjs'
import { syncDashboard } from '../scripts/posthog-dashboard.mjs'

assert.equal(new Set(insights.map(insight => insight.id)).size, insights.length)
for (const insight of insights) {
  const definition = JSON.stringify(insight.query)
  assert.ok(definition.includes('production'), `${insight.id} needs a production filter`)
  assert.ok(definition.includes('tiagojeronimo.github.io'), `${insight.id} must exclude local previews`)
  assert.ok(definition.includes('analytics_check='), `${insight.id} must exclude verification traffic`)
  const source = insight.query.source
  if (source.kind === 'HogQLQuery') {
    assert.ok(source.query.includes('{filters}'), `${insight.id} must apply PostHog's internal-user toggle`)
    assert.equal(source.filters.filterTestAccounts, true)
  } else assert.equal(source.filterTestAccounts, true)
}

// A failed query must prevent partial dashboard creation, and a second successful run must update rather than copy.
await assert.rejects(syncDashboard(async () => { throw new Error('invalid query') }), /invalid query/)
await assert.rejects(syncDashboard(async (_method, path) => path === 'query/' ? { results: [] } : { results: [{ id: 1, name: dashboard.name, description: 'Manually maintained' }], next: null }), /refusing to overwrite/)
let board
const saved = []
let creates = 0
const request = async (method, path, body) => {
  if (path === 'query/') return { results: [] }
  if (path.startsWith('dashboards/?')) return { results: board ? [board] : [], next: null }
  if (path === 'dashboards/' && method === 'POST') { board = { ...body, id: 42 }; creates++; return board }
  if (path === 'dashboards/42/' && method === 'GET') return { ...board, tiles: saved.map(insight => ({ insight })) }
  if (path === 'dashboards/42/' && method === 'PATCH') { board = { ...board, ...body }; return board }
  if (path === 'insights/' && method === 'POST') { const insight = { ...body, id: saved.length + 1 }; saved.push(insight); creates++; return insight }
  if (path.startsWith('insights/') && method === 'PATCH') { const id = Number(path.split('/')[1]); Object.assign(saved.find(insight => insight.id === id), body); return saved.find(insight => insight.id === id) }
  throw new Error(`Unexpected request: ${method} ${path}`)
}
assert.deepEqual(await syncDashboard(request), { dashboardId: 42, insightCount: insights.length })
assert.equal(board.name, dashboard.name)
await syncDashboard(request)
assert.equal(creates, insights.length + 1, 're-running must not create duplicate dashboards or insights')
assert.equal(saved.length, insights.length)
console.log('dashboard: ok')
