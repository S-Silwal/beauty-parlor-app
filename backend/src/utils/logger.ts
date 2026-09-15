// src/utils/logger.ts
//
// A lightweight structured-logging shim — historically NOT a replacement for
// a real error-tracking service (Sentry/Bugsnag/etc). This project had
// neither (see H6 / "Ops" in the audits): diagnosis meant reading raw
// console output with no aggregation, no alerting, and no correlation.
// What this gives you with zero new dependencies or accounts, always on:
//   - every line is structured JSON (timestamp, level, message, metadata)
//     instead of an ad-hoc string, so it's at least machine-parseable if
//     shipped to a log aggregator later
//   - a `requestId` passed in `meta` ties a log line back to the specific
//     HTTP request that triggered it (see requestContext.middleware.ts) —
//     directly closes the "no correlation between a failed booking and the
//     notification attempt it triggered" gap the audit called out
//
// Optional real error-tracking forwarding (the "no error tracking" scorecard
// gap): this project can't create a Sentry account on your behalf, so
// instead of faking that integration, `error()` calls now ALSO forward to
// Sentry when — and only when — you've both (a) set SENTRY_DSN in .env and
// (b) run `npm install @sentry/node`. Neither exists by default, so behavior
// is unchanged (console-only) until you opt in. The require is lazy and
// wrapped in try/catch specifically so a missing/not-yet-installed package
// never crashes the app — see forwardToSentry() below.
type LogLevel = "info" | "warn" | "error";

interface LogMeta {
  requestId?: string;
  [key: string]: unknown;
}

// Cache the result of trying to load @sentry/node so we don't retry a
// `require` (and re-pay the module resolution cost) on every single error
// log line — one attempt, remembered for the life of the process.
let sentryModule: { captureException: (err: unknown, ctx?: unknown) => void } | null | undefined;

function getSentry() {
  if (sentryModule !== undefined) return sentryModule;

  if (!process.env.SENTRY_DSN) {
    sentryModule = null;
    return sentryModule;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require("@sentry/node");
    Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV });
    sentryModule = Sentry;
  } catch {
    // @sentry/node isn't installed — SENTRY_DSN alone shouldn't be able to
    // break the app. Warn once via plain console (not logger.error, to avoid
    // recursion) so the misconfiguration is still visible.
    console.warn(
      "SENTRY_DSN is set but @sentry/node is not installed — run `npm install @sentry/node` " +
      "to enable real error tracking. Falling back to console-only logging."
    );
    sentryModule = null;
  }

  return sentryModule;
}

function forwardToSentry(message: string, meta?: LogMeta) {
  const sentry = getSentry();
  if (!sentry) return;

  try {
    sentry.captureException(new Error(message), { extra: meta });
  } catch {
    // Never let the tracking integration itself take down error logging.
  }
}

function write(level: LogLevel, message: string, meta?: LogMeta) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta ?? {}),
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
    forwardToSentry(message, meta);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (message: string, meta?: LogMeta) => write("info", message, meta),
  warn: (message: string, meta?: LogMeta) => write("warn", message, meta),
  error: (message: string, meta?: LogMeta) => write("error", message, meta),
};
