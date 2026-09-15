import "express";

declare global {
  namespace Express {
    interface Request {
      /**
       * Raw request body bytes, captured by the express.json() `verify` hook.
       * Needed for webhook signature verification (QStash) where the
       * byte-exact body must be checked — a re-serialized copy of the
       * already-parsed body is not guaranteed to match what was signed.
       */
      rawBody?: string;

      /**
       * Unique ID assigned to this request by requestContext.middleware.ts,
       * echoed back as the X-Request-Id response header. Lets a support
       * request ("my booking failed") or a log line for a background
       * notification failure be tied back to the specific HTTP request that
       * triggered it — see H6 in PRODUCTION_READINESS_AUDIT.md.
       */
      requestId?: string;
    }
  }
}
