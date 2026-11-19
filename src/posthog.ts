type Properties = Record<string, string | number | boolean>
interface AnalyticsClient {
  capture(event: string, properties?: Properties): unknown
  logger: { info(message: string, attributes?: Properties): unknown }
}

/** Early clicks wait for the SDK; unavailable analytics never stop the page or its controls. */
export function createAnalytics(load?: () => Promise<AnalyticsClient>) {
  const ready = load ? Promise.resolve().then(load).catch(() => undefined) : undefined
  const send = (run: (client: AnalyticsClient) => unknown) => {
    void ready?.then((client) => client && run(client)).catch(() => {})
  }
  return {
    capture: (event: string, properties?: Properties) => send((client) => client.capture(event, properties)),
    info: (message: string, attributes?: Properties) => send((client) => client.logger.info(message, attributes)),
  }
}

const env = import.meta.env
const apiKey = env?.VITE_POSTHOG_KEY
const apiHost = env?.VITE_POSTHOG_HOST
export const isPostHogEnabled = Boolean(apiKey && apiHost)

const analytics = createAnalytics(isPostHogEnabled ? async () => {
  // The front page can render while the separate analytics bundle is fetched.
  const { default: posthog } = await import('posthog-js')
  posthog.init(apiKey, {
    api_host: apiHost,
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    },
    logs: { serviceName: 'web-cv', environment: env.MODE },
  })
  posthog.register({ environment: env.MODE })
  return posthog
} : undefined)

export const posthogLogger = { info: analytics.info }
export default { capture: analytics.capture }
