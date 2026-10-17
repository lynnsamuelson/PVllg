// The app's logging wrapper. Log with `log.info(...)` etc., never `console` directly, so a
// reporting service (e.g. Sentry) can be wired in here later without touching callers.
export const log = {
  debug: (...args) => import.meta.env.DEV && console.debug(...args),
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};
