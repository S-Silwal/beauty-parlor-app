// src/services/auth.service.ts
import { prisma } from "../config/database";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Resend } from "resend";
import { RegisterInput } from "../validators";
import { authConfig } from "../config/auth";
import { emailConfig } from "../config/email";

const resend = new Resend(emailConfig.resendApiKey);

// ── Email helper ─────────────────────────────────────────────────────────────
async function sendAuthEmail(to: string, subject: string, html: string) {
  try {
    await resend.emails.send({
      from: emailConfig.fromEmail,
      to,
      subject,
      html,
    });
    console.log(`📧 Auth email sent to ${to}: ${subject}`);
  } catch (err: any) {
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
    if (existingEmail) throw new Error("User with this email already exists");

    if (data.phone) {
      const existingPhone = await prisma.user.findUnique({
        where: { phone: data.phone },
      });
      if (existingPhone) throw new Error("This phone number is already registered to another account");
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

    await prisma.passwordResetToken.deleteMany({ where: { user_id: userId } });
    await prisma.passwordResetToken.create({
      data: { user_id: userId, token, expires_at: expiresAt },
    });

    const verifyUrl = `${authConfig.frontendUrl}/verify-email?token=${token}`;
    const html      = verificationEmailHtml(name, verifyUrl);

    await sendAuthEmail(email, emailConfig.subjects.verification, html);

    console.log(`📧 Verification email sent to ${email}`);
    console.log(`🔗 Verify URL (dev): ${verifyUrl}`);
  }

  static async verifyEmail(token: string) {
    const record = await prisma.passwordResetToken.findUnique({
      where:   { token },
      include: { user: true },
    });

    if (!record)                  throw new Error("Invalid verification link");
    if (record.expires_at < new Date()) throw new Error("Verification link has expired. Please request a new one.");
    if (record.used)              throw new Error("This verification link has already been used.");
    if (record.user.is_verified)  throw new Error("Email is already verified.");

    await prisma.user.update({
      where: { id: record.user_id },
      data:  { is_verified: true },
    });

    await prisma.passwordResetToken.update({
      where: { token },
      data:  { used: true },
    });

    console.log(`✅ Email verified for user ${record.user.email}`);
    return { message: "Email verified successfully", user: record.user };
  }

  static async resendVerificationEmail(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)            throw new Error("No account found with this email");
    if (user.is_verified) throw new Error("This email is already verified");

    await AuthService.sendVerificationEmail(user.id, user.email, user.name);
    return { message: "Verification email sent" };
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

    if (!user) throw new Error("Invalid email or password");

    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      throw new Error(`Account is locked until ${user.accountLockedUntil.toLocaleString()}`);
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
        throw new Error("Too many failed attempts. Account locked for 30 minutes.");
      }

      throw new Error("Invalid email or password");
    }

    if (!user.is_verified) {
      throw new Error("Please verify your email before logging in. Check your inbox for the verification link.");
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

    const refreshToken = jwt.sign(
      { userId: user.id },
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
      throw new Error("Invalid or expired refresh token");
    }

    await prisma.refreshToken.delete({ where: { token: oldRefreshToken } });

    const newAccessToken = jwt.sign(
      { userId: storedToken.user.id, role: storedToken.user.role },
      authConfig.jwtSecret,
      { expiresIn: authConfig.accessTokenExpiry }
    );

    const newRefreshToken = jwt.sign(
      { userId: storedToken.user.id },
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

    console.log(`🔐 OTP for ${userId}: ${code}`);
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

    if (!otp) throw new Error("Invalid or expired OTP");

    await prisma.otpCode.update({
      where: { id: otp.id },
      data:  { used: true },
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");

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
    await sendAuthEmail(user.email, emailConfig.subjects.resetPassword, html);

    console.log(`🔗 Reset URL (dev): ${resetUrl}`);
    return { message: "If an account exists, a reset link has been sent" };
  }

  static async resetPassword(token: string, newPassword: string) {
    const record = await prisma.passwordResetToken.findUnique({
      where:   { token },
      include: { user: true },
    });

    if (!record)                  throw new Error("Invalid or expired reset link");
    if (record.expires_at < new Date()) throw new Error("Reset link has expired. Please request a new one.");
    if (record.used)              throw new Error("This reset link has already been used.");

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