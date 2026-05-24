// src/config/email.ts
import dotenv from "dotenv";
dotenv.config();

export const emailConfig = {
  // Resend
  resendApiKey:  process.env.RESEND_API_KEY!,//authenticates your backend with resend's servers
  fromEmail:     process.env.RESEND_FROM_EMAIL || 
                 "Crown & Glow <hello@crownandglow.com>",

  // Subject lines — all in one place
  subjects: {
    verification:   "✉️ Verify your Crown & Glow account",
    resetPassword:  "🔐 Reset your Crown & Glow password",
    bookingConfirm: "📅 Your Crown & Glow booking is confirmed",
  },
};

export type EmailConfigType = typeof emailConfig;