// src/routes/notification.routes.ts
import { Router, Request, Response } from 'express';
import { Receiver } from '@upstash/qstash';
import { notifyReminder24h } from '../notifications/notification.service';
import { prisma } from '../config/database';
import { verifyUnsubscribeToken } from '../utils/unsubscribeToken';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

/**
 * QStash webhook — receives scheduled reminder calls
 * POST /api/notifications/reminder
 */
router.post('/reminder', async (req: Request, res: Response) => {
  try {
    // ✅ Verify the request is genuinely from QStash (security)
    const signature = req.headers['upstash-signature'] as string;

    if (!req.rawBody) {
      // Should never happen — express.json()'s verify hook in app.ts/server.ts
      // always sets this. Fail closed rather than fall back to a
      // re-serialized body, which isn't guaranteed to match what was signed.
      console.error('❌ QStash webhook: raw body was not captured — refusing to verify');
      return res.status(500).json({ error: 'Internal configuration error' });
    }

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const isValid = await receiver.verify({
      signature,
      body: req.rawBody,
      url: `${backendUrl}/api/notifications/reminder`,
    });

    if (!isValid) {
      console.warn('⚠️  Invalid QStash signature — request rejected');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { appointmentId, scheduledForDate } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId required' });
    }

    await notifyReminder24h(appointmentId, scheduledForDate);

    res.json({ success: true, message: `Reminder sent for ${appointmentId}` });

  } catch (error: any) {
    console.error('❌ Reminder webhook error:', error);
    // Return 500 so QStash will retry
    res.status(500).json({ error: error.message });
  }
});

/**
 * Unsubscribe from notifications (GDPR / CAN-SPAM compliance)
 * GET /api/notifications/unsubscribe?token=xxx&type=email|sms|all
 *
 * `token` is a signed, single-purpose token minted per-user in
 * notifications/email.service.ts — never a raw email address, which would
 * let anyone silently unsubscribe another user just by knowing their address.
 */
router.get('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { token, type = 'all' } = req.query as { token: string; type: string };

    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    let userId: string;
    try {
      userId = verifyUnsubscribeToken(token);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired unsubscribe link' });
    }

    const updateData: any = {};
    if (type === 'email' || type === 'all') updateData.email_notifications = false;
    if (type === 'sms'   || type === 'all') updateData.sms_notifications = false;

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    console.log(`🚫 User ${userId} unsubscribed from ${type} notifications`);

    // Redirect to a confirmation page
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/unsubscribed?type=${type}`);

  } catch (error: any) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

/**
 * Re-subscribe to notifications
 * POST /api/notifications/resubscribe
 *
 * This isn't a one-click email link, so it's a normal authenticated action
 * (e.g. from an account-settings page) rather than a signed token.
 */
router.post('/resubscribe', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { type = 'all' } = req.body;

    const updateData: any = {};
    if (type === 'email' || type === 'all') updateData.email_notifications = true;
    if (type === 'sms'   || type === 'all') updateData.sms_notifications = true;

    await prisma.user.update({ where: { id: req.user.userId }, data: updateData });

    res.json({ success: true, message: `Re-subscribed to ${type} notifications` });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;