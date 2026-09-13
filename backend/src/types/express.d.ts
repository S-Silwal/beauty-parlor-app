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
    }
  }
}
