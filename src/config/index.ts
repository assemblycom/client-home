export const copilotAPIUrl = process.env.COPILOT_API_URL || ''
export const copilotAPIKey = process.env.COPILOT_API_KEY || ''

export const tasksAppApiKey = process.env.TASKS_API_KEY || ''
export const tasksAppId = process.env.TASKS_APP_ID || ''

export const apiUrl = `${
  process.env.VERCEL_ENV === 'development' ? 'http://' : 'https://'
}${process.env.VERCEL_URL}`

export const pauseUpdates = !!process.env.FLG_PAUSE_UPDATES

export const SentryConfig = {
  DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
  ENVIRONMENT: process.env.SENTRY_ENVIRONMENT || 'development',
}
