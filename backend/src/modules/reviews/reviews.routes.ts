import { Router } from "express";
import { z } from "zod";
import { requireRole, AuthRequest } from "../../middleware/auth.js";
import { trackActivity } from "../activity/activity.service.js";
import { bookingForReview, createReview, refreshVendorRatingAggregate, getVendorRating, getReviewedBookingIds, listRecentPublicReviews } from "./reviews.repository.js";

export const reviewsRouter = Router();

reviewsRouter.get("/public", async (req, res) => {
  const parsed = z
    .object({
      limit: z.coerce.number().int().positive().max(100).default(6),
      vendorId: z.string().optional(),
    })
    .safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }

  const reviews = await listRecentPublicReviews(parsed.data.limit, parsed.data.vendorId);
  res.json({ success: true, data: reviews });
});

reviewsRouter.post("/", requireRole(["customer"]), async (req: AuthRequest, res) => {
  const parsed = z
    .object({
      bookingId: z.string().uuid(),
      rating: z.number().int().min(1).max(5),
      reviewText: z.string().max(2000).optional(),
      mediaUrls: z.array(z.string().url()).default([])
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }

  const booking = await bookingForReview(parsed.data.bookingId);
  if (!booking) {
    res.status(404).json({ success: false, error: "Booking not found" });
    return;
  }

  if (booking.customerId !== req.actor!.id) {
    res.status(403).json({ success: false, error: "Only booking owner can review" });
    return;
  }

  if (booking.status !== "completed") {
    res.status(409).json({ success: false, error: "Review allowed only after completion" });
    return;
  }

  const review = await createReview({
    bookingId: parsed.data.bookingId,
    customerId: req.actor!.id,
    vendorId: booking.vendorId,
    rating: parsed.data.rating,
    reviewText: parsed.data.reviewText,
    mediaUrls: parsed.data.mediaUrls
  });

  await refreshVendorRatingAggregate(booking.vendorId);

  trackActivity({
    actorId: req.actor!.id,
    role: req.actor!.role,
    action: "review.created",
    entity: "review",
    metadata: { bookingId: parsed.data.bookingId, vendorId: booking.vendorId, rating: parsed.data.rating }
  });

  res.status(201).json({ success: true, data: review });
});

reviewsRouter.get("/vendor/:vendorId/rating", async (req, res) => {
  const rating = await getVendorRating(req.params.vendorId);
  res.json({ success: true, data: rating });
});

reviewsRouter.get("/my-reviewed", requireRole(["customer"]), async (req: AuthRequest, res) => {
  const bookingIds = await getReviewedBookingIds(req.actor!.id);
  res.json({ success: true, data: bookingIds });
});
