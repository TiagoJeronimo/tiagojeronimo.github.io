export const liveFilters = [
  { type: 'event', key: 'environment', operator: 'exact', value: ['production'] },
  { type: 'event', key: '$host', operator: 'exact', value: ['tiagojeronimo.github.io'] },
  { type: 'event', key: '$current_url', operator: 'not_icontains', value: 'analytics_check=' },
]

const property = (key, value) => ({ type: 'event', key, operator: 'exact', value: [value] })
const event = (name, properties = [], math = 'total') => ({ kind: 'EventsNode', event: name, name, math, properties })
const live = `timestamp >= now() - INTERVAL 30 DAY
  AND properties.environment = 'production'
  AND properties.$host = 'tiagojeronimo.github.io'
  AND properties.$current_url NOT ILIKE '%analytics_check=%'
  AND {filters}`
const trends = (series) => ({
  kind: 'InsightVizNode',
  source: {
    kind: 'TrendsQuery', interval: 'day', dateRange: { date_from: '-30d' },
    properties: liveFilters, filterTestAccounts: true, series,
    trendsFilter: { display: 'ActionsLineGraph', showLegend: true },
  },
})
const funnel = (series, aggregate) => ({
  kind: 'InsightVizNode',
  source: {
    kind: 'FunnelsQuery', dateRange: { date_from: '-30d' }, properties: liveFilters,
    filterTestAccounts: true, series,
    funnelsFilter: {
      funnelOrderType: 'ordered', funnelWindowInterval: 2, funnelWindowIntervalUnit: 'hour',
      funnelVizType: 'steps', funnelAggregateByHogQL: aggregate, breakdownAttributionType: 'first_touch',
    },
  },
})
const table = (query) => ({
  kind: 'DataVisualizationNode', display: 'ActionsTable',
  source: { kind: 'HogQLQuery', query, filters: { filterTestAccounts: true } },
})

export const dashboard = {
  name: 'Portfolio: interest, contact and play',
  description: '[web-cv:portfolio-insights:v1]\n\nProduction portfolio traffic, with internal/test users excluded by default; toggle the filter to include your visits. Cards and contact count sessions, games count attempts (play_id), and tables show the last 30 days.',
  tags: ['web-cv', 'portfolio-insights'],
}

export const insights = [
  {
    id: 'visitors', name: 'Who visits the front page and the CV?',
    description: 'Daily unique browsers on the front page and the CV, and how many open the CV print dialog. Not identified people; a print request does not prove a print or a saved PDF.',
    query: trends([
      event('$pageview', [property('$pathname', '/')], 'dau'),
      event('$pageview', [property('$pathname', '/cv/')], 'dau'),
      event('cv_print_requested', [], 'dau'),
    ]),
  },
  {
    id: 'project-interest', name: 'Which cards get seen, and which get opened?',
    description: 'Sessions where half a card was visible, and sessions that opened it from the card (deep links not counted). Visibility is not proof of attention.',
    query: table(`SELECT properties.project_slug AS project,
  uniqIf(properties.$session_id, event = 'portfolio_project_seen') AS seen,
  uniqIf(properties.$session_id, event = 'portfolio_project_opened' AND properties.source = 'card') AS opened,
  round(100.0 * opened / nullIf(seen, 0), 1) AS open_percent
FROM events WHERE ${live}
  AND event IN ('portfolio_project_seen', 'portfolio_project_opened')
GROUP BY project ORDER BY seen DESC LIMIT 30`),
  },
  {
    id: 'contact-intent', name: 'Where do people try to make contact?',
    description: 'Email-link clicks and successful address copies, by placement. A click does not prove a message was sent.',
    query: table(`SELECT properties.method AS method, properties.source AS placement,
  count() AS actions, uniq(properties.$session_id) AS sessions
FROM events WHERE ${live} AND event = 'portfolio_contact_intent'
GROUP BY method, placement ORDER BY sessions DESC LIMIT 20`),
  },
  {
    id: 'game-launches', name: 'How many game launches, and does the phone warning stop them?',
    description: 'Launch presses per game, how many met the phone warning, and what those visitors chose. A launch press is not a start; the game funnels begin at the first playable frame.',
    query: table(`SELECT properties.game AS game,
  countIf(event = 'portfolio_game_launch_requested') AS launches,
  countIf(event = 'portfolio_game_launch_requested' AND toString(properties.needs_warning) = 'true') AS warned,
  countIf(event = 'portfolio_game_warning_decided' AND properties.decision = 'continue') AS went_on,
  countIf(event = 'portfolio_game_warning_decided' AND properties.decision != 'continue') AS turned_back
FROM events WHERE ${live}
  AND event IN ('portfolio_game_launch_requested', 'portfolio_game_warning_decided')
GROUP BY game ORDER BY launches DESC LIMIT 10`),
  },
  {
    id: 'island-progress', name: 'How far do fresh Island games get?',
    description: 'Fresh starts through 25%, 50%, 75% of puzzles found, then completion, within two hours. One play_id is one attempt; resumed games are left out. A missing completion does not prove a quit.',
    query: funnel([
      event('island_new_game_started'),
      ...[25, 50, 75].map(value => event('island_progress_reached', [property('milestone', value)])),
      event('island_completed'),
    ], 'properties.play_id'),
  },
  {
    id: 'castle-progress', name: 'How far does the Castle courtship get?',
    description: 'Days from the first playable frame through four delivered gifts to a wedding, within two hours, grouped by play_id so restarts do not add up to a false win.',
    query: funnel([
      event('castle_day_started'),
      ...[1, 2, 3, 4].map(value => event('castle_courtship_progressed', [property('gifts_delivered', value)])),
      event('castle_day_ended', [property('outcome', 'win')]),
    ], 'properties.play_id'),
  },
  {
    id: 'castle-outcomes', name: 'How do Castle days end?',
    description: 'Endings (the wedding, or the side that gave up) and median visible-tab playing time of finished days. Unfinished visits are not counted.',
    query: table(`SELECT properties.outcome AS outcome, properties.ending AS ending,
  count() AS days, round(median(toFloat(properties.active_seconds)), 1) AS median_active_seconds
FROM events WHERE ${live} AND event = 'castle_day_ended'
  AND properties.active_seconds IS NOT NULL
GROUP BY outcome, ending ORDER BY days DESC LIMIT 10`),
  },
]
