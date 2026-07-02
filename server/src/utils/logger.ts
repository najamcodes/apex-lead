import pino from 'pino'
import pinoPretty from 'pino-pretty'

const isDevelopment = process.env.NODE_ENV !== 'production'

const logger = pino(
  {
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    transport: isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
    formatters: {
      level: (label) => {
        return { level: label }
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      service: 'leadgen-desk-api',
      environment: process.env.NODE_ENV || 'development',
    },
  }
)

export { logger }

export function createChildLogger(bindings: Record<string, any>) {
  return logger.child(bindings)
}

export function logRequest(c: any, next: any) {
  const start = Date.now()
  const method = c.req.method
  const path = c.req.path
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'

  return next().then(() => {
    const duration = Date.now() - start
    const status = c.res.status
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'

    logger[level]({
      method,
      path,
      status,
      durationMs: duration,
      ip,
      userAgent: c.req.header('user-agent'),
    }, `${method} ${path} ${status} ${duration}ms`)
  })
}

export function logError(error: Error, context?: Record<string, any>) {
  logger.error({ err: error, ...context }, error.message)
}

export function logInfo(message: string, context?: Record<string, any>) {
  logger.info(context, message)
}

export function logWarn(message: string, context?: Record<string, any>) {
  logger.warn(context, message)
}

export function logDebug(message: string, context?: Record<string, any>) {
  logger.debug(context, message)
}