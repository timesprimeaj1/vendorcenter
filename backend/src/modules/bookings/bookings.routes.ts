import { Router } from "express";
import crypto from "node:crypto";
import { nanoid } from "nanoid";
import { z } from "zod";
import { requireRole } from "../../middleware/auth.js";
import { AuthRequest } from "../../middleware/auth.js";
import {
  clearCompletionOtp,
  createBooking,
  getBookingById,
  getCompletionOtp,
  listBookingsByRole,
  markBookingInProgress,
  markCompletionRequested,
  markPaymentSuccess,
  rejectBookingWithReason,
  setCompletionOtp,
  updateBookingFinalAmount,
  updateBookingStatus,
} from "./bookings.repository.js";
import { trackActivity } from "../activity/activity.service.js";
import { sendBookingConfirmation, sendCompletionOtpEmail, sendNotificationEmail, sendWorkCompletionEmail } from "../../services/emailService.js";
import { findUserById } from "../auth/auth.repository.js";
import { generateBookingReceipt } from "../../services/pdfService.js";
import { getVendorProfile } from "../vendors/vendors.repository.js";

const statusSchema = z.enum(["pending", "confirmed", "in_progress", "completed", "cancelled"]);

export const bookingsRouter = Router();

bookingsRouter.post("/", requireRole(["customer"]), async (req: AuthRequest, res) => {
  const parsed = z
    .object({
      vendorId: z.string().min(3),
      serviceName: z.string().min(2),
      scheduledDate: z.string().optional(),
      scheduledTime: z.string().optional(),
      notes: z.string().max(500).optional()
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }

  const booking = await createBooking({
    customerId: req.actor!.id,
    vendorId: parsed.data.vendorId,
    serviceName: parsed.data.serviceName,
    transactionId: `txn_${nanoid(12)}`,
    scheduledDate: parsed.data.scheduledDate,
    scheduledTime: parsed.data.scheduledTime,
    notes: parsed.data.notes
  });
  trackActivity({
    actorId: req.actor!.id,
    role: req.actor!.role,
    action: "booking.created",
    entity: "booking",
    metadata: { bookingId: booking.id, vendorId: booking.vendorId }
  });

  // Send booking intimation email (request created, pending vendor action)
  const customer = await findUserById(req.actor!.id);
  if (customer?.email) {
    sendBookingConfirmation({
      recipientEmail: customer.email,
      bookingId: booking.id,
      serviceName: booking.serviceName,
      transactionId: booking.transactionId,
      status: "pending",
      createdAt: new Date(booking.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    }).catch((err) => console.error("[booking] failed to queue confirmation email", err));
  }

  res.status(201).json({ success: true, data: booking });
});

bookingsRouter.patch("/:bookingId/status", requireRole(["vendor", "admin", "employee"]), async (req: AuthRequest, res) => {
  const parsed = z.object({ status: statusSchema }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }

  if (parsed.data.status === "cancelled") {
    res.status(400).json({ success: false, error: "Use reject endpoint to cancel with reason" });
    return;
  }

  const booking = await updateBookingStatus(req.params.bookingId, parsed.data.status);
  if (!booking) {
    res.status(404).json({ success: false, error: "Booking not found" });
    return;
  }

  trackActivity({
    actorId: req.actor!.id,
    role: req.actor!.role,
    action: "booking.status_updated",
    entity: "booking",
    metadata: { bookingId: booking.id, status: booking.status }
  });

  // Send confirmation email to customer when vendor confirms the booking
  if (parsed.data.status === "confirmed") {
    const customer = await findUserById(booking.customerId);
    const vendorProfile = await getVendorProfile(booking.vendorId);
    if (customer?.email) {
      sendBookingConfirmation({
        recipientEmail: customer.email,
        bookingId: booking.id,
        serviceName: booking.serviceName,
        vendorName: vendorProfile?.businessName || undefined,
        transactionId: booking.transactionId,
        status: "confirmed",
        createdAt: new Date(booking.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        location: vendorProfile?.zone || undefined,
      }).catch((err) => console.error("[booking] failed to send acceptance email", err));
    }
  }

  // Record work-start timestamp when moved to in_progress
  if (parsed.data.status === "in_progress") {
    await markBookingInProgress(booking.id);
  }

  res.json({ success: true, data: booking });
});

bookingsRouter.post("/:bookingId/reject", requireRole(["vendor"]), async (req: AuthRequest, res) => {
  const parsed = z.object({ reason: z.string().min(5).max(250) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }

  const booking = await getBookingById(req.params.bookingId);
  if (!booking) {
    res.status(404).json({ success: false, error: "Booking not found" });
    return;
  }
  if (booking.vendorId !== req.actor!.id) {
    res.status(403).json({ success: false, error: "Not your booking" });
    return;
  }
  if (booking.status !== "pending" && booking.status !== "confirmed") {
    res.status(400).json({ success: false, error: "Only pending/confirmed bookings can be rejected" });
    return;
  }

  const rejected = await rejectBookingWithReason(booking.id, parsed.data.reason);
  if (!rejected) {
    res.status(404).json({ success: false, error: "Booking not found" });
    return;
  }

  const customer = await findUserById(rejected.customerId);
  const vendorProfile = await getVendorProfile(rejected.vendorId);
  if (customer?.email) {
    const html = `
      <h2 style="margin:0 0 12px;color:#111827">Booking Cancelled By Vendor</h2>
      <p style="color:#374151;margin:0 0 12px">Your booking #${rejected.id.slice(0, 8).toUpperCase()} for <strong>${rejected.serviceName}</strong> was cancelled by the vendor.</p>
      <p style="color:#374151;margin:0 0 8px"><strong>Vendor:</strong> ${vendorProfile?.businessName || "Vendor"}</p>
      <p style="color:#374151;margin:0 0 8px"><strong>Reason:</strong> ${parsed.data.reason}</p>
      <p style="color:#6b7280;margin:8px 0 0">You can book another vendor from your dashboard.</p>`;
    sendNotificationEmail({
      recipientEmail: customer.email,
      sender: "bookings",
      subject: `Booking Cancelled — #${rejected.id.slice(0, 8).toUpperCase()}`,
      bodyHtml: html,
    }).catch((err) => console.error("[booking] failed to send rejection email", err));
  }

  trackActivity({
    actorId: req.actor!.id,
    role: "vendor",
    action: "booking.rejected",
    entity: "booking",
    metadata: { bookingId: rejected.id, reason: parsed.data.reason },
  });

  res.json({ success: true, data: rejected });
});

bookingsRouter.get("/", requireRole(["customer", "vendor", "admin", "employee"]), async (req: AuthRequest, res) => {
  const bookings = await listBookingsByRole(req.actor!.role, req.actor!.id);
  res.json({ success: true, data: bookings });
});

bookingsRouter.get("/:bookingId/receipt", requireRole(["customer", "vendor", "admin", "employee"]), async (req: AuthRequest, res) => {
  const booking = await getBookingById(req.params.bookingId);
  if (!booking) {
    res.status(404).json({ success: false, error: "Booking not found" });
    return;
  }

  // Only allow the customer or vendor of this booking (or admin/employee) to download
  if (req.actor!.role === "customer" && booking.customerId !== req.actor!.id) {
    res.status(403).json({ success: false, error: "Forbidden" });
    return;
  }
  if (req.actor!.role === "vendor" && booking.vendorId !== req.actor!.id) {
    res.status(403).json({ success: false, error: "Forbidden" });
    return;
  }

  const customer = await findUserById(booking.customerId);
  const vendorProfile = await getVendorProfile(booking.vendorId);

  const pdfBuffer = await generateBookingReceipt({
    bookingId: booking.id,
    transactionId: booking.transactionId,
    serviceName: booking.serviceName,
    customerEmail: customer?.email || "",
    customerName: customer?.name || undefined,
    vendorName: vendorProfile?.businessName || undefined,
    paymentStatus: booking.paymentStatus,
    date: new Date(booking.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    bookingStatus: booking.status,
    workStartedAt: booking.workStartedAt ? new Date(booking.workStartedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : undefined,
    completionRequestedAt: booking.completionRequestedAt ? new Date(booking.completionRequestedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : undefined,
    rejectionReason: booking.rejectionReason || undefined,
    notes: booking.notes || undefined,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="receipt-${booking.id.slice(0, 8)}.pdf"`);
  res.send(pdfBuffer);
});

// ── Vendor adjusts final amount ──
bookingsRouter.patch("/:bookingId/final-amount", requireRole(["vendor"]), async (req: AuthRequest, res) => {
  const parsed = z.object({ amount: z.number().min(0) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }

  const booking = await getBookingById(req.params.bookingId);
  if (!booking) {
    res.status(404).json({ success: false, error: "Booking not found" });
    return;
  }
  if (booking.vendorId !== req.actor!.id) {
    res.status(403).json({ success: false, error: "Not your booking" });
    return;
  }
  if (booking.status === "completed" || booking.status === "cancelled") {
    res.status(400).json({ success: false, error: "Cannot adjust amount for this booking status" });
    return;
  }

  const updated = await updateBookingFinalAmount(req.params.bookingId, parsed.data.amount);
  res.json({ success: true, data: updated });
});

// ── Vendor marks work done → sends payment intimation to customer ──
bookingsRouter.post("/:bookingId/complete", requireRole(["vendor"]), async (req: AuthRequest, res) => {
  const booking = await getBookingById(req.params.bookingId);
  if (!booking) {
    res.status(404).json({ success: false, error: "Booking not found" });
    return;
  }
  if (booking.vendorId !== req.actor!.id) {
    res.status(403).json({ success: false, error: "Not your booking" });
    return;
  }
  if (booking.status !== "in_progress") {
    res.status(400).json({ success: false, error: "Booking must be in progress to mark complete" });
    return;
  }

  await markCompletionRequested(booking.id);

  const customer = await findUserById(booking.customerId);
  const vendorProfile = await getVendorProfile(booking.vendorId);
  const amountStr = booking.finalAmount ? (booking.finalAmount / 100).toFixed(2) : undefined;

  // Demo payment link (customer confirms dummy payment then OTP is generated)
  const paymentLink = `https://vendorcenter.in/pay/${booking.id}?amount=${booking.finalAmount ?? 0}&txn=${booking.transactionId}`;

  if (customer?.email) {
    sendNotificationEmail({
      recipientEmail: customer.email,
      sender: "payments",
      subject: `Payment Pending For Booking #${booking.id.slice(0, 8).toUpperCase()}`,
      bodyHtml: `
        <h2 style="margin:0 0 12px;color:#111827">Work Marked As Done</h2>
        <p style="color:#374151;margin:0 0 10px">Vendor <strong>${vendorProfile?.businessName || "Vendor"}</strong> marked your service as done.</p>
        <p style="color:#374151;margin:0 0 10px">Please complete the payment to generate verification OTP.</p>
        <p style="color:#374151;margin:0 0 10px"><strong>Service:</strong> ${booking.serviceName}</p>
        <p style="color:#374151;margin:0 0 10px"><strong>Amount:</strong> ${amountStr ? `₹ ${amountStr}` : "To be confirmed"}</p>
        <p style="margin:16px 0"><a href="${paymentLink}" style="background:#f97316;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block">Proceed To Payment</a></p>
        <p style="color:#6b7280;margin:0">After payment, OTP will be sent to your email. Share that OTP with the vendor to complete booking.</p>`,
    }).catch((err) => console.error("[booking] failed to send payment intimation email", err));
  }

  trackActivity({
    actorId: req.actor!.id,
    role: "vendor",
    action: "booking.completion_requested",
    entity: "booking",
    metadata: { bookingId: booking.id }
  });

  res.json({ success: true, data: { message: "Payment intimation sent to customer", bookingId: booking.id } });
});

// ── Customer confirms dummy payment → receives OTP to share with vendor ──
bookingsRouter.post("/:bookingId/pay", requireRole(["customer"]), async (req: AuthRequest, res) => {
  const booking = await getBookingById(req.params.bookingId);
  if (!booking) {
    res.status(404).json({ success: false, error: "Booking not found" });
    return;
  }
  if (booking.customerId !== req.actor!.id) {
    res.status(403).json({ success: false, error: "Not your booking" });
    return;
  }
  if (booking.status !== "in_progress") {
    res.status(400).json({ success: false, error: "Booking is not in progress" });
    return;
  }

  const token = `tok_${nanoid(8)}`;
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const otpHash = crypto.createHash("sha256").update(code).digest("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await markPaymentSuccess(booking.id);
  await setCompletionOtp(booking.id, otpHash, expiresAt);

  const customer = await findUserById(booking.customerId);
  const vendorProfile = await getVendorProfile(booking.vendorId);
  const amountStr = booking.finalAmount ? (booking.finalAmount / 100).toFixed(2) : undefined;
  if (customer?.email) {
    await sendCompletionOtpEmail({
      recipientEmail: customer.email,
      code,
      serviceName: booking.serviceName,
      vendorName: vendorProfile?.businessName || undefined,
      amount: amountStr,
      paymentLink: undefined,
    }).catch((err) => console.error("[booking] failed to send post-payment OTP", err));
  }

  trackActivity({
    actorId: req.actor!.id,
    role: "customer",
    action: "booking.payment_confirmed",
    entity: "booking",
    metadata: { bookingId: booking.id, token },
  });

  res.json({ success: true, data: { bookingId: booking.id, paymentToken: token, otpSent: true } });
});

// ── Vendor verifies completion OTP from customer → marks booking completed ──
bookingsRouter.post("/:bookingId/verify-completion", requireRole(["vendor"]), async (req: AuthRequest, res) => {
  const parsed = z.object({ code: z.string().length(6) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }

  const booking = await getBookingById(req.params.bookingId);
  if (!booking) {
    res.status(404).json({ success: false, error: "Booking not found" });
    return;
  }
  if (booking.vendorId !== req.actor!.id) {
    res.status(403).json({ success: false, error: "Not your booking" });
    return;
  }

  const otp = await getCompletionOtp(booking.id);
  if (!otp || !otp.otpHash) {
    res.status(400).json({ success: false, error: "No completion OTP pending. Request one first." });
    return;
  }
  if (otp.expiresAt && Date.now() > new Date(otp.expiresAt).getTime()) {
    await clearCompletionOtp(booking.id);
    res.status(410).json({ success: false, error: "OTP expired. Please request a new one." });
    return;
  }

  const inputHash = crypto.createHash("sha256").update(parsed.data.code).digest("hex");
  if (inputHash !== otp.otpHash) {
    res.status(401).json({ success: false, error: "Invalid OTP code" });
    return;
  }

  // OTP valid — mark completed
  await clearCompletionOtp(booking.id);
  const updated = await updateBookingStatus(booking.id, "completed");

  // Send work completion email to customer from payments@vendorcenter.in
  const customer = await findUserById(booking.customerId);
  const vendorProfile = await getVendorProfile(booking.vendorId);
  const amountStr = booking.finalAmount ? (booking.finalAmount / 100).toFixed(2) : undefined;

  if (customer?.email) {
    const pdfBuffer = await generateBookingReceipt({
      bookingId: booking.id,
      transactionId: booking.transactionId,
      serviceName: booking.serviceName,
      customerEmail: customer.email,
      customerName: customer.name || undefined,
      vendorName: vendorProfile?.businessName || undefined,
      paymentStatus: "success",
      date: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      amount: amountStr,
      bookingStatus: "completed",
      workStartedAt: booking.workStartedAt ? new Date(booking.workStartedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : undefined,
      completionRequestedAt: booking.completionRequestedAt ? new Date(booking.completionRequestedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : undefined,
      completedAt: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      notes: booking.notes || undefined,
    });

    await sendWorkCompletionEmail({
      recipientEmail: customer.email,
      bookingId: booking.id,
      serviceName: booking.serviceName,
      vendorName: vendorProfile?.businessName || undefined,
      amount: amountStr,
      completedAt: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      pdfBuffer,
    }).catch((err) => console.error("[booking] failed to send completion email", err));
  }

  trackActivity({
    actorId: req.actor!.id,
    role: "vendor",
    action: "booking.completed_verified",
    entity: "booking",
    metadata: { bookingId: booking.id }
  });

  res.json({ success: true, data: updated });
});
