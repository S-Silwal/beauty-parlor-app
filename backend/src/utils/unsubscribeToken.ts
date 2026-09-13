// src/utils/unsubscribeToken.ts
import jwt from "jsonwebtoken";
import { authConfig } from "../config/auth";

const PURPOSE = "notifications-unsubscribe";

interface UnsubscribeTokenPayload {
  userId: string;
  purpose: typeof PURPOSE;
}

/**
 * Signed, single-purpose token identifying a user for the unsubscribe/
 * resubscribe endpoints — never trust a raw email address for this, since
 * anyone who knows (or guesses) an address could otherwise toggle another
 * user's notification preferences.
 */
export function generateUnsubscribeToken(userId: string): string {
  return jwt.sign({ userId, purpose: PURPOSE }, authConfig.jwtSecret, {
    expiresIn: authConfig.unsubscribeTokenExpiry,
  });
}

/** Verifies the token and returns the userId it was issued for. */
export function verifyUnsubscribeToken(token: string): string {
  const decoded = jwt.verify(token, authConfig.jwtSecret) as UnsubscribeTokenPayload;
  if (decoded.purpose !== PURPOSE) {
    throw new Error("Invalid unsubscribe token");
  }
  return decoded.userId;
}
