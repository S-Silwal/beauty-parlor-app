// src/services/review.service.ts
import { prisma } from "../config/database";
import { AppError } from "../utils/AppError";

export class ReviewService {
  // ── Create a review (customer, one per completed appointment) ──────────────
  // Gate: must be logged in (enforced by the `authenticate` middleware before
  // this ever runs), must own the appointment, and the appointment must be
  // COMPLETED — i.e. the person actually received the service. Every check
  // is re-verified here rather than trusted from the client.
  static async createReview(
    userId: string,
    data: { appointment_id: string; rating: number; comment?: string }
  ) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: data.appointment_id },
    });
    if (!appointment) throw new AppError("Appointment not found", 404);

    if (appointment.user_id !== userId) {
      throw new AppError("You can only review your own appointments", 403);
    }

    if (appointment.status !== "COMPLETED") {
      throw new AppError("You can only rate a service after it has been completed", 409);
    }

    const existing = await prisma.review.findUnique({
      where: { appointment_id: data.appointment_id },
    });
    if (existing) {
      throw new AppError("You've already reviewed this appointment", 409);
    }

    return prisma.review.create({
      data: {
        user_id: userId,
        service_id: appointment.service_id,
        appointment_id: data.appointment_id,
        rating: data.rating,
        comment: data.comment,
      },
    });
  }

  // ── This user's own reviews (My Bookings page uses this to know which
  //    completed bookings are already rated) ─────────────────────────────────
  static async getMyReviews(userId: string) {
    return prisma.review.findMany({
      where: { user_id: userId },
      select: { appointment_id: true, rating: true, comment: true },
    });
  }

  // ── Public aggregate stats — powers the homepage "Average Rating" stat ─────
  static async getReviewStats() {
    const result = await prisma.review.aggregate({
      _avg: { rating: true },
      _count: { id: true },
    });

    return {
      averageRating: result._avg.rating !== null ? Number(result._avg.rating.toFixed(1)) : null,
      totalReviews: result._count.id,
    };
  }

  // ── Public reviews list — powers the homepage's public review cards, and
  //    (with requireComment=false) the full /reviews page ──────────────────
  // By default only reviews that actually left a comment are worth showing
  // as a quote card (a bare star rating has nothing to quote) — that's the
  // homepage's existing behavior, unchanged. Passing requireComment=false
  // additionally includes star-only reviews (comment left null), for a
  // dedicated "read every verified review" page. Either way, this only
  // ever exposes the reviewer's first name — never their full name, email,
  // phone, or user id — and every row here is already gated at creation
  // time (ReviewService.createReview) to a real customer's own COMPLETED
  // appointment, so there is no separate "verified" flag to check: existing
  // in this table *is* verified.
  static async getPublicReviews(limit = 20, requireComment = true) {
    const reviews = await prisma.review.findMany({
      where: requireComment ? { comment: { not: null } } : undefined,
      orderBy: { created_at: "desc" },
      take: Math.min(Math.max(limit, 1), 50),
      include: {
        user: { select: { name: true } },
        service: { select: { name: true } },
      },
    });

    return reviews
      .filter((r) => !requireComment || (r.comment && r.comment.trim().length > 0))
      .map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        service_name: r.service.name,
        reviewer_name: r.user.name.trim().split(/\s+/)[0] || "Guest",
        created_at: r.created_at,
      }));
  }
}
