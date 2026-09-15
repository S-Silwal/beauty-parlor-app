// src/services/auth.service.ts
import { prisma } from "../config/database";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Resend } from "resend";
import { RegisterInput } from "../validators";
import { authConfig } from "../config/auth";
import { emailConfig } from "../config/email";
import { AppError } from "../utils/AppError";

const resend = new Resend(emailConfig.resendApiKey);

export type AuthEmailEvent = "EMAIL_VERIFICATION" | "PASSWORD_RESET" | "MFA_OTP";

// ── Email helper ─────────────────────────────────────────────────────────────
// Verification/reset/OTP emails used to only console.error on failure, with
// no record anywhere that it happened (unlike the booking-flow emails in
// notifications/email.service.ts, which always write to NotificationLog).
// A customer who never got their reset link had no recourse, and support
// had no way to see it happened either — see H11 in
// PRODUCTION_READINESS_AUDIT.md. This now logs the same way the booking
// flow does, WITHOUT changing the anti-enumeration behavior of the callers
// below: they still always report success regardless of delivery, and this
// function still never throws — it only makes the failure visible in
// NotificationLog (and therefore to an admin/ops query) instead of
// vanishing into console output no one is watching.
async function sendAuthEmail(
  to: string,
  subject: string,
  html: string,
  event: AuthEmailEvent,
  userId: string,
) {
  const log = await prisma.notificationLog.create({
    data: {
      user_id:  userId,
      type:     "EMAIL",
      event,
      status:   "PENDING",
      recipient: to,
    },
  });

  try {
    const result = await resend.emails.send({
      from: emailConfig.fromEmail,
      to,
      subject,
      html,
    });

    // The Resend SDK resolves instead of rejecting on API-level failures —
    // the failure comes back as `result.error`, not a thrown exception (see
    // notifications/email.service.ts's sendEmail for the same pattern).
    if (result.error) {
      throw new Error(result.error.message);
    }

    await prisma.notificationLog.update({
      where: { id: log.id },
      data:  { status: "SENT", sent_at: new Date(), external_id: result.data?.id },
    });

    console.log(`📧 Auth email sent to ${to}: ${subject}`);
  } catch (err: any) {
    await prisma.notificationLog.update({
      where: { id: log.id },
      data:  { status: "FAILED", error_message: err.message },
    });
    console.error(`❌ Failed to send auth email to ${to}:`, err.message);
  }
}

// ── Email templates ──────────────────────────────────────────────────────────
function verificationEmailHtml(name: string, verifyUrl: string): string {
  return `
<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#F7F3EE;margin:0;padding:0;}
  .wrap{max-width:560px;margin:32px auto;padding:0 16px;}
  .card{background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 24px rgba(44,40,37,.08);}
  .hdr{background:#2C2825;padding:32px 40px;text-align:center;}
  .logo{font-size:24px;font-weight:300;color:#F7F3EE;letter-spacing:.04em;}
  .logo em{font-style:italic;color:#D4B896;}
  .bar{height:3px;background:linear-gradient(to right,#B89A6A,#D4B896,#B89A6A);}
  .body{padding:40px;}
  .h1{font-size:24px;font-weight:300;color:#2C2825;margin:0 0 8px;}
  .h1 em{font-style:italic;color:#B89A6A;}
  .p{font-size:15px;line-height:1.8;color:#6B635A;margin:0 0 16px;}
  .btn{display:inline-block;background:#2C2825;color:#F7F3EE!important;text-decoration:none;
       padding:14px 36px;border-radius:4px;font-size:12px;font-weight:700;
       letter-spacing:.14em;text-transform:uppercase;margin:16px 0;}
  .note{font-size:12px;color:#9E968E;margin-top:24px;padding-top:16px;border-top:1px solid #EDE6DC;}
  .ft{padding:24px 40px;text-align:center;border-top:1px solid #EDE6DC;}
  .ft p{font-size:12px;color:#9E968E;}
</style></head><body>
<div class="wrap"><div class="card">
  <div class="hdr"><div class="logo">Crown <em>&amp; Glow</em></div></div>
  <div class="bar"></div>
  <div class="body">
    <h1 class="h1">Verify your <em>email</em></h1>
    <p class="p">Hi ${name.split(' ')[0]}, welcome to Crown &amp; Glow!</p>
    <p class="p">Please verify your email address to activate your account and start booking appointments.</p>
    <center><a href="${verifyUrl}" class="btn">Verify Email Address</a></center>
    <p class="note">This link expires in <strong>24 hours</strong>. If you didn't create an account, you can safely ignore this email.</p>
  </div>
  <div class="ft"><p>Crown &amp; Glow · 456 Glow Avenue, Suite 200, Indianapolis, IN 46204</p></div>
</div></div></body></html>`;
}

function otpEmailHtml(name: string, code: string): string {
  return `
<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#F7F3EE;margin:0;padding:0;}
  .wrap{max-width:560px;margin:32px auto;padding:0 16px;}
  .card{background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 24px rgba(44,40,37,.08);}
  .hdr{background:#2C2825;padding:32px 40px;text-align:center;}
  .logo{font-size:24px;font-weight:300;color:#F7F3EE;letter-spacing:.04em;}
  .logo em{font-style:italic;color:#D4B896;}
  .bar{height:3px;background:linear-gradient(to right,#B89A6A,#D4B896,#B89A6A);}
  .body{padding:40px;}
  .h1{font-size:24px;font-weight:300;color:#2C2825;margin:0 0 8px;}
  .h1 em{font-style:italic;color:#B89A6A;}
  .p{font-size:15px;line-height:1.8;color:#6B635A;margin:0 0 16px;}
  .code{display:inline-block;background:#F7F3EE;color:#2C2825;letter-spacing:.3em;
        font-size:32px;font-weight:700;padding:16px 28px;border-radius:8px;margin:8px 0 16px;}
  .note{font-size:12px;color:#9E968E;margin-top:24px;padding-top:16px;border-top:1px solid #EDE6DC;}
  .ft{padding:24px 40px;text-align:center;border-top:1px solid #EDE6DC;}
  .ft p{font-size:12px;color:#9E968E;}
</style></head><body>
<div class="wrap"><div class="card">
  <div class="hdr"><div class="logo">Crown <em>&amp; Glow</em></div></div>
  <div class="bar"></div>
  <div class="body">
    <h1 class="h1">Your login <em>code</em></h1>
    <p class="p">Hi ${name.split(' ')[0]}, use this code to finish signing in:</p>
    <center><div class="code">${code}</div></center>
    <p class="note">This code expires in <strong>10 minutes</strong>. If you didn't try to log in, you can safely ignore this email — your account is still secure.</p>
  </div>
  <div class="ft"><p>Crown &amp; Glow · 456 Glow Avenue, Suite 200, Indianapolis, IN 46204</p></div>
</div></div></body></html>`;
}

function resetPasswordEmailHtml(name: string, resetUrl: string): string {
  return `
<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#F7F3EE;margin:0;padding:0;}
  .wrap{max-width:560px;margin:32px auto;padding:0 16px;}
  .card{background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 24px rgba(44,40,37,.08);}
  .hdr{background:#2C2825;padding:32px 40px;text-align:center;}
  .logo{font-size:24px;font-weight:300;color:#F7F3EE;letter-spacing:.04em;}
  .logo em{font-style:italic;color:#D4B896;}
  .bar{height:3px;background:linear-gradient(to right,#B89A6A,#D4B896,#B89A6A);}
  .body{padding:40px;}
  .h1{font-size:24px;font-weight:300;color:#2C2825;margin:0 0 8px;}
  .h1 em{font-style:italic;color:#B89A6A;}
  .p{font-size:15px;line-height:1.8;color:#6B635A;margin:0 0 16px;}
  .btn{display:inline-block;background:#B89A6A;color:#2C2825!important;text-decoration:none;
       padding:14px 36px;border-radius:4px;font-size:12px;font-weight:700;
       letter-spacing:.14em;text-transform:uppercase;margin:16px 0;}
  .note{font-size:12px;color:#9E968E;margin-top:24px;padding-top:16px;border-top:1px solid #EDE6DC;}
  .ft{padding:24px 40px;text-align:center;border-top:1px solid #EDE6DC;}
  .ft p{font-size:12px;color:#9E968E;}
</style></head><body>
<div class="wrap"><div class="card">
  <div class="hdr"><div class="logo">Crown <em>&amp; Glow</em></div></div>
  <div class="bar"></div>
  <div class="body">
    <h1 class="h1">Reset your <em>password</em></h1>
    <p class="p">Hi ${name.split(' ')[0]}, we received a request to reset your password.</p>
    <p class="p">Click the button below to choose a new password. This link is valid for <strong>1 hour</strong>.</p>
    <center><a href="${resetUrl}" class="btn">Reset My Password</a></center>
    <p class="note">If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
  </div>
  <div class="ft"><p>Crown &amp; Glow · 456 Glow Avenue, Suite 200, Indianapolis, IN 46204</p></div>
</div></div></body></html>`;
}

export class AuthService {

  // ====================== REGISTER ======================
  static async register(data: RegisterInput) {
    const existingEmail = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (existingEmail) throw new AppError("User with this email already exists", 409);

    if (data.phone) {
      const existingPhone = await prisma.user.findUnique({
        where: { phone: data.phone },
      });
      if (existingPhone) throw new AppError("This phone number is already registered to another account", 409);
    }

    // ✅ FIX 1 — was: bcrypt.hash(newPassword, ...) — newPassword doesn't exist here
    // register() receives data.password, not newPassword
    const password_hash = await bcrypt.hash(data.password, authConfig.bcryptRounds);

    const user = await prisma.user.create({
      data: {
        name:          data.name.trim(),
        email:         data.email.toLowerCase().trim(),
        phone:         data.phone ?? null,
        password_hash,
        role:          "CUSTOMER",
        is_verified:   false,
      },
      select: {
        id:          true,
        name:        true,
        email:       true,
        phone:       true,
        role:        true,
        is_verified: true,
      },
    });

    await AuthService.sendVerificationEmail(user.id, user.email, user.name);
    return { user };
  }

  // ====================== EMAIL VERIFICATION ======================
  static async sendVerificationEmail(userId: string, email: string, name: string) {
    const token     = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + authConfig.verificationTokenExpiryMs);

    await prisma.emailVerificationToken.deleteMany({ where: { user_id: userId } });
    await prisma.emailVerificationToken.create({
      data: { user_id: userId, token, expires_at: expiresAt },
    });

    const verifyUrl = `${authConfig.frontendUrl}/verify-email?token=${token}`;
    const html      = verificationEmailHtml(name, verifyUrl);

    await sendAuthEmail(email, emailConfig.subjects.verification, html, "EMAIL_VERIFICATION", userId);

    console.log(`📧 Verification email sent to ${email}`);
    // The URL contains a live, usable verification token — never log it
    // outside development, where the real email may not be reachable.
    if (process.env.NODE_ENV !== "production") {
      console.log(`🔗 Verify URL (dev): ${verifyUrl}`);
    }
  }

  static async verifyEmail(token: string) {
    const record = await prisma.emailVerificationToken.findUnique({
      where:   { token },
      include: { user: true },
    });

    if (!record)                  throw new AppError("Invalid verification link", 400);
    if (record.expires_at < new Date()) throw new AppError("Verification link has expired. Please request a new one.", 400);
    if (record.used)              throw new AppError("This verification link has already been used.", 409);
    if (record.user.is_verified)  throw new AppError("Email is already verified.", 409);

    await prisma.user.update({
      where: { id: record.user_id },
      data:  { is_verified: true },
    });

    await prisma.emailVerificationToken.update({
      where: { token },
      data:  { used: true },
    });

    console.log(`✅ Email verified for user ${record.user.email}`);
    return { message: "Email verified successfully", user: record.user };
  }

  static async resendVerificationEmail(email: string) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    // Don't reveal whether this email is registered or already verified —
    // mirrors forgotPassword()'s anti-enumeration behavior.
    if (user && !user.is_verified) {
      await AuthService.sendVerificationEmail(user.id, user.email, user.name);
    }

    return { message: "If an account with this email needs verification, a new link has been sent." };
  }

  // ====================== LOGIN ======================
  static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id:                  true,
        name:                true,
        email:               true,
        password_hash:       true,
        role:                true,
        is_verified:         true,
        mfa_enabled:         true,
        failedLoginAttempts: true,
        accountLockedUntil:  true,
      },
    });

    if (!user) throw new AppError("Invalid email or password", 401);

    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      throw new AppError(`Account is locked until ${user.accountLockedUntil.toLocaleString()}`, 403);
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordCorrect) {
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data:  { failedLoginAttempts: { increment: 1 } },
      });

      if (updatedUser.failedLoginAttempts >= authConfig.maxFailedAttempts) {
        await prisma.user.update({
          where: { id: user.id },
          data:  { accountLockedUntil: new Date(Date.now() + authConfig.lockDurationMs) },
        });
        throw new AppError("Too many failed attempts. Account locked for 30 minutes.", 403);
      }

      throw new AppError("Invalid email or password", 401);
    }

    if (!user.is_verified) {
      throw new AppError("Please verify your email before logging in. Check your inbox for the verification link.", 403);
    }

    await prisma.user.update({
      where: { id: user.id },
      data:  { failedLoginAttempts: 0, accountLockedUntil: null },
    });

    if (user.mfa_enabled) {
      await this.generateOTP(user.id);
      return {
        mfaRequired: true,
        userId:      user.id,
        message:     "MFA verification required. Check your email.",
      };
    }

    return this.generateTokens(user);
  }

  // ====================== TOKEN GENERATION ======================
  private static async generateTokens(user: any) {
    const accessToken = jwt.sign(
      { userId: user.id, role: user.role },
      authConfig.jwtSecret,
      { expiresIn: authConfig.accessTokenExpiry }
    );

    // jti makes each token byte-distinct even when two logins for the same
    // user land in the same second — without it, `{userId}` + a second-
    // granularity `iat`/`exp` produces an identical JWT string, and the
    // second insert 409s on refresh_tokens.token's unique constraint.
    const refreshToken = jwt.sign(
      { userId: user.id, jti: crypto.randomUUID() },
      authConfig.refreshSecret,
      { expiresIn: authConfig.refreshTokenExpiry }
    );

    await prisma.refreshToken.create({
      data: {
        user_id:    user.id,
        token:      refreshToken,
        expires_at: new Date(Date.now() + authConfig.refreshTokenMs),
      },
    });

    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken,
      refreshToken,
      mfaRequired: false,
    };
  }

  // ====================== REFRESH TOKEN ======================
  static async refreshAccessToken(oldRefreshToken: string) {
    jwt.verify(oldRefreshToken, authConfig.refreshSecret);

    const storedToken = await prisma.refreshToken.findUnique({
      where:   { token: oldRefreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.expires_at < new Date()) {
      throw new AppError("Invalid or expired refresh token", 401);
    }

    await prisma.refreshToken.delete({ where: { token: oldRefreshToken } });

    const newAccessToken = jwt.sign(
      { userId: storedToken.user.id, role: storedToken.user.role },
      authConfig.jwtSecret,
      { expiresIn: authConfig.accessTokenExpiry }
    );

    const newRefreshToken = jwt.sign(
      { userId: storedToken.user.id, jti: crypto.randomUUID() },
      authConfig.refreshSecret,
      { expiresIn: authConfig.refreshTokenExpiry }
    );

    await prisma.refreshToken.create({
      data: {
        user_id:    storedToken.user.id,
        token:      newRefreshToken,
        expires_at: new Date(Date.now() + authConfig.refreshTokenMs),
      },
    });

    return {
      accessToken:  newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id:    storedToken.user.id,
        name:  storedToken.user.name,
        email: storedToken.user.email,
        role:  storedToken.user.role,
      },
    };
  }

  // ====================== LOGOUT ======================
  static async logout(refreshToken: string) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }

  // ====================== OTP ======================
  static async generateOTP(userId: string) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    await prisma.otpCode.deleteMany({ where: { user_id: userId } });
    await prisma.otpCode.create({
      data: {
        user_id:    userId,
        code,
        expires_at: new Date(Date.now() + authConfig.otpExpiryMs),
      },
    });

    // Look the user up here (rather than requiring every caller to pass
    // email/name) so this stays correct no matter where generateOTP() is
    // called from. This used to only console.log the code in dev and never
    // actually send it — meaning any account with MFA enabled could never
    // receive its login code in production and was permanently locked out.
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { email: true, name: true },
    });

    if (user) {
      await sendAuthEmail(user.email, emailConfig.subjects.mfaOtp, otpEmailHtml(user.name, code), "MFA_OTP", userId);
    } else {
      console.error(`⚠️  generateOTP() called for unknown user ${userId} — OTP not delivered`);
    }

    // The OTP itself is a live login credential — never log it outside
    // development.
    if (process.env.NODE_ENV !== "production") {
      console.log(`🔐 OTP for ${userId}: ${code}`);
    }
    return { message: "OTP sent successfully" };
  }

  static async verifyOTP(userId: string, code: string) {
    const otp = await prisma.otpCode.findFirst({
      where: {
        user_id:    userId,
        code,
        expires_at: { gt: new Date() },
        used:       false,
      },
    });

    if (!otp) throw new AppError("Invalid or expired OTP", 400);

    await prisma.otpCode.update({
      where: { id: otp.id },
      data:  { used: true },
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError("User not found", 404);

    return this.generateTokens(user);
  }

  // ====================== MFA ======================
  static async enableMFA(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data:  { mfa_enabled: true },
    });
  }

  static async disableMFA(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data:  { mfa_enabled: false },
    });
  }

  // ====================== PASSWORD RESET ======================
  static async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      console.log(`Password reset requested for non-existent email: ${email}`);
      return { message: "If an account exists, a reset link has been sent" };
    }

    const token     = crypto.randomBytes(32).toString("hex");
    // ✅ FIX 2 — was: Date.now() + 60 * 60 * 1000 (magic number left behind)
    const expiresAt = new Date(Date.now() + authConfig.resetTokenExpiryMs);

    await prisma.passwordResetToken.deleteMany({ where: { user_id: user.id } });
    await prisma.passwordResetToken.create({
      data: { user_id: user.id, token, expires_at: expiresAt },
    });

    // ✅ FIX 3 — was: FRONTEND_URL (old variable that no longer exists)
    const resetUrl = `${authConfig.frontendUrl}/reset-password?token=${token}`;
    const html     = resetPasswordEmailHtml(user.name, resetUrl);

    // ✅ FIX 4 — was: hardcoded subject string
    await sendAuthEmail(user.email, emailConfig.subjects.resetPassword, html, "PASSWORD_RESET", user.id);

    // The URL contains a live, usable password-reset token — never log it
    // outside development.
    if (process.env.NODE_ENV !== "production") {
      console.log(`🔗 Reset URL (dev): ${resetUrl}`);
    }
    return { message: "If an account exists, a reset link has been sent" };
  }

  static async resetPassword(token: string, newPassword: string) {
    const record = await prisma.passwordResetToken.findUnique({
      where:   { token },
      include: { user: true },
    });

    if (!record)                  throw new AppError("Invalid or expired reset link", 400);
    if (record.expires_at < new Date()) throw new AppError("Reset link has expired. Please request a new one.", 400);
    if (record.used)              throw new AppError("This reset link has already been used.", 409);

    // ✅ FIX 5 — was: bcrypt.hash(newPassword, 10) — magic number 10 left behind
    const password_hash = await bcrypt.hash(newPassword, authConfig.bcryptRounds);

    await prisma.user.update({
      where: { id: record.user_id },
      data:  { password_hash },
    });

    await prisma.passwordResetToken.update({
      where: { token },
      data:  { used: true },
    });

    await prisma.refreshToken.deleteMany({ where: { user_id: record.user_id } });

    console.log(`✅ Password reset for user ${record.user.email}`);
    return { message: "Password reset successfully" };
  }

  // ====================== CURRENT USER ======================
  static async getCurrentUser(userId: string) {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id:          true,
        name:        true,
        email:       true,
        phone:       true,
        role:        true,
        is_verified: true,
        mfa_enabled: true,
      },
    });
  }
}