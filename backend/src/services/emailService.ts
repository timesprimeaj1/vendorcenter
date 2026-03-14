/**
 * Centralized email service for VendorCenter.
 * Provides high-level functions for sending transactional emails via the email_jobs queue.
 */

import { env } from "../config/env.js";
import { queueEmailJob } from "../modules/notifications/notifications.repository.js";
import { otpEmailHtml } from "./emailTemplates/otpTemplate.js";
import { bookingConfirmationHtml } from "./emailTemplates/bookingConfirmation.js";
import { paymentReceiptHtml } from "./emailTemplates/paymentReceipt.js";
import { completionOtpHtml } from "./emailTemplates/completionOtpTemplate.js";
import { workCompletionHtml } from "./emailTemplates/workCompletionTemplate.js";

// Sender identities
const senders = {
  otp: process.env.EMAIL_FROM_OTP ?? "otp@vendorcenter.in",
  noreply: env.emailFromNoreply,
  bookings: process.env.EMAIL_FROM_BOOKINGS ?? "bookings@vendorcenter.in",
  payments: process.env.EMAIL_FROM_PAYMENTS ?? "payments@vendorcenter.in",
  support: process.env.EMAIL_FROM_SUPPORT ?? "support@vendorcenter.in",
  vendors: process.env.EMAIL_FROM_VENDORS ?? "vendors@vendorcenter.in",
  admin: process.env.EMAIL_FROM_ADMIN ?? "admin@vendorcenter.in",
} as const;

// ── OTP ──

export async function sendOtpEmail(opts: {
  recipientEmail: string;
  code: string;
  purpose: string;
  expiryMinutes: number;
}) {
  const purposeLabels: Record<string, string> = {
    signup: "Account Verification",
    vendor_onboarding: "Vendor Onboarding",
    password_reset: "Password Reset",
    employee_login: "Employee Login",
    login: "Login",
  };
  const label = purposeLabels[opts.purpose] ?? "Verification";

  console.log(`[emailService] queueing OTP email for ${opts.recipientEmail} purpose=${opts.purpose}`);
  return queueEmailJob({
    recipientEmail: opts.recipientEmail,
    senderEmail: senders.otp,
    subject: `${opts.code} is your VendorCenter ${label} code`,
    bodyHtml: otpEmailHtml({
      code: opts.code,
      purposeLabel: label,
      expiryMinutes: opts.expiryMinutes,
    }),
  });
}

// ── Booking confirmation ──

export async function sendBookingConfirmation(opts: {
  recipientEmail: string;
  bookingId: string;
  serviceName: string;
  vendorName?: string;
  transactionId: string;
  status: string;
  createdAt: string;
  location?: string;
  amount?: string;
}) {
  const isConfirmed = String(opts.status).toLowerCase() === "confirmed";
  const subjectPrefix = isConfirmed ? "Booking Confirmed" : "Booking Request Received";
  console.log(`[emailService] queueing booking confirmation for ${opts.recipientEmail} booking=${opts.bookingId}`);
  return queueEmailJob({
    recipientEmail: opts.recipientEmail,
    senderEmail: senders.noreply,
    subject: `${subjectPrefix} — #${opts.bookingId.slice(0, 8).toUpperCase()}`,
    bodyHtml: bookingConfirmationHtml({
      bookingId: opts.bookingId,
      serviceName: opts.serviceName,
      vendorName: opts.vendorName,
      transactionId: opts.transactionId,
      status: opts.status,
      createdAt: opts.createdAt,
      location: opts.location,
      amount: opts.amount,
    }),
  });
}

// ── Payment receipt ──

export async function sendPaymentReceipt(opts: {
  recipientEmail: string;
  bookingId: string;
  transactionId: string;
  serviceName: string;
  amount?: string;
  paymentStatus: string;
  paidAt: string;
  vendorName?: string;
  pdfBuffer?: Buffer;
}) {
  const attachments = opts.pdfBuffer
    ? [{ filename: `receipt_${opts.transactionId}.pdf`, content: opts.pdfBuffer.toString("base64"), encoding: "base64" as const }]
    : undefined;

  console.log(`[emailService] queueing payment receipt for ${opts.recipientEmail} booking=${opts.bookingId} hasPdf=${!!opts.pdfBuffer}`);
  return queueEmailJob({
    recipientEmail: opts.recipientEmail,
    senderEmail: senders.payments,
    subject: `Payment Receipt — #${opts.bookingId.slice(0, 8).toUpperCase()}`,
    bodyHtml: paymentReceiptHtml({
      bookingId: opts.bookingId,
      transactionId: opts.transactionId,
      serviceName: opts.serviceName,
      amount: opts.amount,
      paymentStatus: opts.paymentStatus,
      paidAt: opts.paidAt,
      vendorName: opts.vendorName,
    }),
    attachments,
  });
}

// ── Generic / notification email ──

export async function sendNotificationEmail(opts: {
  recipientEmail: string;
  subject: string;
  bodyHtml: string;
  sender?: keyof typeof senders;
}) {
  return queueEmailJob({
    recipientEmail: opts.recipientEmail,
    senderEmail: senders[opts.sender ?? "noreply"],
    subject: opts.subject,
    bodyHtml: opts.bodyHtml,
  });
}

// ── Completion OTP (sent to customer when vendor finishes work) ──

export async function sendCompletionOtpEmail(opts: {
  recipientEmail: string;
  code: string;
  serviceName: string;
  vendorName?: string;
  amount?: string;
  paymentLink?: string;
}) {
  console.log(`[emailService] queueing completion OTP for ${opts.recipientEmail}`);
  return queueEmailJob({
    recipientEmail: opts.recipientEmail,
    senderEmail: senders.payments,
    subject: `${opts.code} — Verify Work Completion & Payment`,
    bodyHtml: completionOtpHtml({
      code: opts.code,
      serviceName: opts.serviceName,
      vendorName: opts.vendorName,
      amount: opts.amount,
      paymentLink: opts.paymentLink,
    }),
  });
}

// ── Work completion confirmation (sent to customer after OTP verified) ──

export async function sendWorkCompletionEmail(opts: {
  recipientEmail: string;
  bookingId: string;
  serviceName: string;
  vendorName?: string;
  amount?: string;
  completedAt: string;
  pdfBuffer?: Buffer;
}) {
  const attachments = opts.pdfBuffer
    ? [{ filename: `receipt-${opts.bookingId.slice(0, 8)}.pdf`, content: opts.pdfBuffer.toString("base64"), encoding: "base64" as const }]
    : undefined;

  console.log(`[emailService] queueing work completion email for ${opts.recipientEmail} booking=${opts.bookingId}`);
  return queueEmailJob({
    recipientEmail: opts.recipientEmail,
    senderEmail: senders.payments,
    subject: `Work Completed — #${opts.bookingId.slice(0, 8).toUpperCase()}`,
    bodyHtml: workCompletionHtml({
      bookingId: opts.bookingId,
      serviceName: opts.serviceName,
      vendorName: opts.vendorName,
      amount: opts.amount,
      completedAt: opts.completedAt,
    }),
    attachments,
  });
}
