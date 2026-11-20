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
const trends = (series, breakdown, display = 'ActionsLineGraph') => ({
  kind: 'InsightVizNode',
  source: {
    kind: 'TrendsQuery', interval: 'day', dateRange: { date_from: '-30d' },
    properties: liveFilters, filterTestAccounts: true, series,
    trendsFilter: { display, showLegend: true },
    ...(breakdown ? { breakdownFilter: { breakdowns: [{ property: breakdown, type: 'event' }], breakdown_limit: 20 } } : {}),
  },
})
const funnel = (series, aggregate = 'properties.$session_id', breakdown) => ({
  kind: 'InsightVizNode',
  source: {
    kind: 'FunnelsQuery', dateRange: { date_from: '-30d' }, properties: liveFilters,
    filterTestAccounts: true, series,
    funnelsFilter: {
      funnelOrderType: 'ordered', funnelWindowInterval: 2, funnelWindowIntervalUnit: 'hour',
      funnelVizType: 'steps', funnelAggregateByHogQL: aggregate, breakdownAttributionType: 'first_touch',
    },
    ...(breakdown ? { breakdownFilter: { breakdown, breakdown_type: 'event', breakdown_limit: 10 } } : {}),
  },
})
const table = (query) => ({
  kind: 'DataVisualizationNode', display: 'ActionsTable',
  source: { kind: 'HogQLQuery', query, filters: { filterTestAccounts: true } },
})

export const dashboard = {
  name: 'Portfolio: interest, contact and play',
  description: '[web-cv:portfolio-insights:v1]\n\nProduction portfolio traffic, with internal/test users excluded by default; toggle the filter to include your visits. Browsing funnels count sessions, games count attempts, and SQL tables show the last 30 days.',
  tags: ['web-cv', 'portfolio-insights'],
}

export const insights = [
  {
    id: 'visitors', name: 'How many people visit?',
    description: 'Daily unique browser visitors. Cookie restrictions and multiple devices affect the count; these are not identified people.',
    query: trends([event('$pageview', [], 'dau')]),
  },
  {
    id: 'referrers', name: 'Where do visits come from?',
    description: 'Unique visitors by referring domain. Blank or direct traffic has no usable referrer. This describes visits, not first-touch acquisition.',
    query: trends([event('$pageview', [], 'dau')], '$referring_domain', 'ActionsTable'),
  },
  {
    id: 'project-interest', name: 'Which visible cards earn an open?',
    description: 'One exposure per card and page visit once half the card is visible. Rates use unique sessions, and card-origin opens only; deep links do not inflate the numerator. Visibility is not proof of attention.',
    query: table(`SELECT properties.project_slug AS project,
  uniqIf(properties.$session_id, event = 'portfolio_project_seen') AS exposed_sessions,
  uniqIf(properties.$session_id, event = 'portfolio_project_opened' AND properties.source = 'card') AS opening_sessions,
  round(100.0 * opening_sessions / nullIf(exposed_sessions, 0), 1) AS open_rate_percent
FROM events WHERE ${live}
  AND event IN ('portfolio_project_seen', 'portfolio_project_opened')
GROUP BY project ORDER BY exposed_sessions DESC LIMIT 30`),
  },
  {
    id: 'project-contact', name: 'Does browsing lead to email intent?',
    description: 'Project open followed by an email click or successful address copy in the same session, within two hours. Breakdown uses the first project in the funnel; this is an association, not causal attribution.',
    query: funnel([event('portfolio_project_opened'), event('portfolio_contact_intent')], 'properties.$session_id', 'project_slug'),
  },
  {
    id: 'cv-interest', name: 'Are visitors reading or printing the CV?',
    description: 'Unique CV visitors and people opening the print dialog. Printing can mean saving a PDF; beforeprint cannot prove either action finished.',
    query: trends([event('$pageview', [property('$pathname', '/cv/')], 'dau'), event('cv_print_requested', [], 'dau')]),
  },
  {
    id: 'outbound-interest', name: 'Which links and placements get used?',
    description: 'Link labels, source placements and safe destinations. Email addresses, query strings and fragments are never included in the custom destination property.',
    query: table(`SELECT properties.link_label AS link, properties.destination AS destination,
  properties.source AS placement, count() AS clicks, uniq(properties.$session_id) AS sessions
FROM events WHERE ${live} AND event = 'portfolio_link_clicked'
GROUP BY link, destination, placement ORDER BY sessions DESC LIMIT 30`),
  },
  {
    id: 'contact-intent', name: 'Where do people try to make contact?',
    description: 'Email-link clicks and successful address copies, by placement. A click does not prove a mail app opened or a message was sent.',
    query: table(`SELECT properties.method AS method, properties.source AS placement,
  count() AS actions, uniq(properties.$session_id) AS sessions
FROM events WHERE ${live} AND event = 'portfolio_contact_intent'
GROUP BY method, placement ORDER BY sessions DESC LIMIT 20`),
  },
  {
    id: 'game-launches', name: 'Does the phone warning stop game launches?',
    description: 'Compare launch requests with continue, cancel and dismiss decisions. A launch request is not a game start; the game-start events confirm its first playable frame.',
    query: table(`SELECT properties.game AS game, event AS stage,
  properties.needs_warning AS phone_warning, properties.decision AS decision,
  count() AS actions, uniq(properties.$session_id) AS sessions
FROM events WHERE ${live}
  AND event IN ('portfolio_game_launch_requested', 'portfolio_game_warning_decided')
GROUP BY game, stage, phone_warning, decision ORDER BY game, stage LIMIT 30`),
  },
  {
    id: 'island-progress', name: 'Where do fresh Island attempts stop?',
    description: 'Fresh starts through 25%, 50%, 75% of puzzles found, then full completion, within two hours. Each play_id is one attempt; resumed games are excluded from this fresh-start funnel. Missing completion does not prove an intentional quit.',
    query: funnel([
      event('island_new_game_started'),
      ...[25, 50, 75].map(value => event('island_progress_reached', [property('milestone', value)])),
      event('island_completed'),
    ], 'properties.play_id'),
  },
  {
    id: 'island-hints', name: 'When do Island players ask for a tip?',
    description: 'Hint requests by percentage of puzzles found. Frequent hints can indicate curiosity or difficulty; use the progress funnel and replays to investigate.',
    query: trends([event('island_hint_requested')], 'progress_percent', 'ActionsTable'),
  },
  {
    id: 'castle-progress', name: 'How far does the Castle courtship get?',
    description: 'Attempts from the first playable frame through four delivered gifts and a wedding, within two hours. Attempts are grouped by play_id so restarts do not combine into an artificial win.',
    query: funnel([
      event('castle_day_started'),
      ...[1, 2, 3, 4].map(value => event('castle_courtship_progressed', [property('gifts_delivered', value)])),
      event('castle_day_ended', [property('outcome', 'win')]),
    ], 'properties.play_id'),
  },
  {
    id: 'castle-outcomes', name: 'How do Castle attempts end?',
    description: 'Endings and median visible-tab playing time for completed attempts with the new instrumentation. This excludes unfinished visits; it is not average time for every player. ending identifies the side that gave up or the wedding.',
    query: table(`SELECT properties.outcome AS outcome, properties.ending AS ending,
  count() AS ended_attempts, round(median(toFloat(properties.active_seconds)), 1) AS median_active_seconds
FROM events WHERE ${live} AND event = 'castle_day_ended'
  AND properties.active_seconds IS NOT NULL
GROUP BY outcome, ending ORDER BY ended_attempts DESC LIMIT 10`),
  },
  {
    id: 'browser-errors', name: 'Are browser errors getting in the way?',
    description: 'Captured unhandled errors and promise rejections. Counts depend on browser blocking and SDK loading; zero does not guarantee a bug-free site.',
    query: trends([event('$exception')]),
  },
]
