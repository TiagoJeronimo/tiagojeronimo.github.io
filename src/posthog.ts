import posthog from 'posthog-js'

const apiKey = import.meta.env.VITE_POSTHOG_KEY
const apiHost = import.meta.env.VITE_POSTHOG_HOST

export const isPostHogEnabled = Boolean(apiKey && apiHost)

export const posthogLogger = {
  info: (message: string, attributes?: Record<string, string | number | boolean>) => {
    if (isPostHogEnabled) posthog.logger.info(message, attributes)
  },
}

if (!apiKey) {
  if (import.meta.env.DEV) {
    throw new Error('VITE_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_KEY is configured')
  }
} else if (!apiHost) {
  if (import.meta.env.DEV) {
    throw new Error('VITE_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_HOST is configured')
  }
} else {
  posthog.init(apiKey, {
    api_host: apiHost,
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    },
    logs: {
      serviceName: 'web-cv',
      environment: import.meta.env.MODE,
    },
  })
}

export default posthog
