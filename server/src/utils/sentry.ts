import * as Sentry from '@sentry/node'

export function initSentry() {
  if (!process.env.SENTRY_DSN) {
    console.warn('SENTRY_DSN not set, Sentry error tracking disabled')
    return null
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,
    integrations: [
      Sentry.httpIntegration(),
    ],
    beforeSend(event, hint) {
      if (event.exception) {
        const error = hint.originalException
        if (error instanceof Error) {
          // Filter out common non-actionable errors
          if (error.message.includes('ECONNREFUSED') ||
              error.message.includes('ENOTFOUND') ||
              error.message.includes('timeout') ||
              error.message.includes('Rate limit exceeded')) {
            return null
          }
        }
      }
      return event
    },
  })

  console.log('Sentry initialized for error tracking')
  return Sentry
}

export function captureException(error: Error, context?: Record<string, unknown>) {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, { extra: context })
  }
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  if (process.env.SENTRY_DSN) {
    Sentry.captureMessage(message, level)
  }
}

export function setUserContext(user: { id: string; email?: string; role?: string }) {
  if (process.env.SENTRY_DSN) {
    Sentry.setUser(user)
  }
}

export function clearUserContext() {
  if (process.env.SENTRY_DSN) {
    Sentry.setUser(null)
  }
}

export function startSpan<T>(name: string, op: string, fn: () => T): T {
  if (process.env.SENTRY_DSN) {
    return Sentry.startSpan({ name, op }, fn)
  }
  return fn()
}