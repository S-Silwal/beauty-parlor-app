// src/routes/notification.routes.ts
import { Router, Request, Response } from 'express';
import { Receiver } from '@upstash/qstash';
import { notifyReminder24h } from '../notifications/notification.service';
import { prisma } from '../config/database';

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
    const body = JSON.stringify(req.body);

    const isValid = await receiver.verify({
      signature,
      body,
      url: `${process.env.BACKEND_URL}/api/notifications/reminder`,
    });

    if (!isValid) {
      console.warn('⚠️  Invalid QStash signature — request rejected');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { appointmentId } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId required' });
    }

    await notifyReminder24h(appointmentId);

    res.json({ success: true, message: `Reminder sent for ${appointmentId}` });

  } catch (error: any) {
    console.error('❌ Reminder webhook error:', error);
    // Return 500 so QStash will retry
    res.status(500).json({ error: error.message });
  }
});

/**
 * Unsubscribe from notifications (GDPR / CAN-SPAM compliance)
 * GET /api/notifications/unsubscribe?email=xxx&type=email|sms|all
 */
router.get('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { email, type = 'all' } = req.query as { email: string; type: string };

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const updateData: any = {};
    if (type === 'email' || type === 'all') updateData.email_notifications = false;
    if (type === 'sms'   || type === 'all') updateData.sms_notifications = false;

    await prisma.user.update({
      where: { email },
      data: updateData,
    });

    console.log(`🚫 User ${email} unsubscribed from ${type} notifications`);

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
 */
router.post('/resubscribe', async (req: Request, res: Response) => {
  try {
    const { email, type = 'all' } = req.body;

    if (!email) return res.status(400).json({ error: 'Email required' });

    const updateData: any = {};
    if (type === 'email' || type === 'all') updateData.email_notifications = true;
    if (type === 'sms'   || type === 'all') updateData.sms_notifications = true;

    await prisma.user.update({ where: { email }, data: updateData });

    res.json({ success: true, message: `Re-subscribed to ${type} notifications` });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;