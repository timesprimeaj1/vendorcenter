import { pool } from "../../db/pool.js";

export type BookingStatus = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";

export interface DbBooking {
  id: string;
  customerId: string;
  vendorId: string;
  serviceName: string;
  status: BookingStatus;
  transactionId: string;
  paymentStatus: "pending" | "success" | "failed" | "refunded";
  scheduledDate: string | null;
  scheduledTime: string | null;
  notes: string | null;
  finalAmount: number | null;
  workStartedAt: string | null;
  completionRequestedAt: string | null;
  paymentRequestTokenHash: string | null;
  paymentRequestExpires: string | null;
  rejectionReason: string | null;
  completionOtpHash: string | null;
  completionOtpExpires: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function createBooking(input: { customerId: string; vendorId: string; serviceName: string; transactionId: string; scheduledDate?: string; scheduledTime?: string; notes?: string }) {
  const result = await pool.query<DbBooking>(
    `INSERT INTO bookings (customer_id, vendor_id, service_name, status, transaction_id, payment_status, scheduled_date, scheduled_time, notes)
     VALUES ($1, $2, $3, 'pending', $4, 'pending', $5, $6, $7)
    RETURNING id, customer_id as "customerId", vendor_id as "vendorId", service_name as "serviceName", status, transaction_id as "transactionId", payment_status as "paymentStatus", scheduled_date as "scheduledDate", scheduled_time as "scheduledTime", notes, final_amount as "finalAmount", work_started_at as "workStartedAt", completion_requested_at as "completionRequestedAt", payment_request_token_hash as "paymentRequestTokenHash", payment_request_expires as "paymentRequestExpires", rejection_reason as "rejectionReason", created_at as "createdAt", updated_at as "updatedAt"`,
    [input.customerId, input.vendorId, input.serviceName, input.transactionId, input.scheduledDate || null, input.scheduledTime || null, input.notes || null]
  );
  return result.rows[0];
}

export async function updateBookingStatus(bookingId: string, status: BookingStatus) {
  const result = await pool.query<DbBooking>(
    `UPDATE bookings
     SET status = $2, updated_at = NOW()
     WHERE id = $1
    RETURNING id, customer_id as "customerId", vendor_id as "vendorId", service_name as "serviceName", status, transaction_id as "transactionId", payment_status as "paymentStatus", scheduled_date as "scheduledDate", scheduled_time as "scheduledTime", notes, final_amount as "finalAmount", work_started_at as "workStartedAt", completion_requested_at as "completionRequestedAt", payment_request_token_hash as "paymentRequestTokenHash", payment_request_expires as "paymentRequestExpires", rejection_reason as "rejectionReason", created_at as "createdAt", updated_at as "updatedAt"`,
    [bookingId, status]
  );
  return result.rows[0] ?? null;
}

export async function getBookingById(bookingId: string) {
  const result = await pool.query<DbBooking>(
    `SELECT id, customer_id as "customerId", vendor_id as "vendorId", service_name as "serviceName", status, transaction_id as "transactionId", payment_status as "paymentStatus", scheduled_date as "scheduledDate", scheduled_time as "scheduledTime", notes, final_amount as "finalAmount", work_started_at as "workStartedAt", completion_requested_at as "completionRequestedAt", payment_request_token_hash as "paymentRequestTokenHash", payment_request_expires as "paymentRequestExpires", rejection_reason as "rejectionReason", created_at as "createdAt", updated_at as "updatedAt"
     FROM bookings WHERE id = $1`,
    [bookingId]
  );
  return result.rows[0] ?? null;
}

export async function listBookingsByRole(role: "customer" | "vendor" | "admin" | "employee", actorId: string) {
  if (role === "customer") {
    const result = await pool.query<DbBooking>(
      `SELECT b.id,
              b.customer_id as "customerId",
              b.vendor_id as "vendorId",
              b.service_name as "serviceName",
              b.status,
              b.transaction_id as "transactionId",
              b.payment_status as "paymentStatus",
              b.scheduled_date as "scheduledDate",
              b.scheduled_time as "scheduledTime",
              b.notes,
              b.final_amount as "finalAmount",
              b.work_started_at as "workStartedAt",
              b.completion_requested_at as "completionRequestedAt",
              b.payment_request_token_hash as "paymentRequestTokenHash",
              b.payment_request_expires as "paymentRequestExpires",
              b.rejection_reason as "rejectionReason",
              b.created_at as "createdAt",
              b.updated_at as "updatedAt",
              vp.business_name as "vendorName",
              COALESCE(vra.average_rating, 0)::float8 as "vendorRating"
       FROM bookings b
       LEFT JOIN vendor_profiles vp ON vp.vendor_id = b.vendor_id
       LEFT JOIN vendor_rating_aggregates vra ON vra.vendor_id = b.vendor_id
       WHERE b.customer_id = $1
       ORDER BY b.created_at DESC`,
      [actorId]
    );
    return result.rows;
  }

  if (role === "vendor") {
    const result = await pool.query<DbBooking>(
      `SELECT id, customer_id as "customerId", vendor_id as "vendorId", service_name as "serviceName", status, transaction_id as "transactionId", payment_status as "paymentStatus", scheduled_date as "scheduledDate", scheduled_time as "scheduledTime", notes, final_amount as "finalAmount", work_started_at as "workStartedAt", completion_requested_at as "completionRequestedAt", payment_request_token_hash as "paymentRequestTokenHash", payment_request_expires as "paymentRequestExpires", rejection_reason as "rejectionReason", created_at as "createdAt", updated_at as "updatedAt"
       FROM bookings WHERE vendor_id = $1 ORDER BY created_at DESC`,
      [actorId]
    );
    return result.rows;
  }

  const result = await pool.query<DbBooking>(
    `SELECT id, customer_id as "customerId", vendor_id as "vendorId", service_name as "serviceName", status, transaction_id as "transactionId", payment_status as "paymentStatus", scheduled_date as "scheduledDate", scheduled_time as "scheduledTime", notes, final_amount as "finalAmount", work_started_at as "workStartedAt", completion_requested_at as "completionRequestedAt", payment_request_token_hash as "paymentRequestTokenHash", payment_request_expires as "paymentRequestExpires", rejection_reason as "rejectionReason", created_at as "createdAt", updated_at as "updatedAt"
     FROM bookings ORDER BY created_at DESC`
  );
  return result.rows;
}

export async function listTransactions() {
  const result = await pool.query<{
    bookingId: string;
    transactionId: string;
    paymentStatus: "pending" | "success" | "failed" | "refunded";
  }>(
    `SELECT id as "bookingId", transaction_id as "transactionId", payment_status as "paymentStatus"
     FROM bookings ORDER BY created_at DESC`
  );
  return result.rows;
}

export async function getBookingStats() {
  const result = await pool.query<{ total: string }>("SELECT COUNT(*)::text as total FROM bookings");
  return Number(result.rows[0]?.total ?? "0");
}

export async function getVendorBookingStats(vendorId: string) {
  const result = await pool.query<{ total: string }>("SELECT COUNT(*)::text as total FROM bookings WHERE vendor_id = $1", [vendorId]);
  return Number(result.rows[0]?.total ?? "0");
}

export async function updateBookingFinalAmount(bookingId: string, finalAmount: number) {
  const result = await pool.query<DbBooking>(
    `UPDATE bookings
     SET final_amount = $2,
       payment_status = CASE WHEN status = 'completed' THEN payment_status ELSE 'pending' END,
       completion_requested_at = NULL,
       payment_request_token_hash = NULL,
       payment_request_expires = NULL,
       completion_otp_hash = NULL,
       completion_otp_expires = NULL,
       updated_at = NOW()
     WHERE id = $1
     RETURNING id, customer_id as "customerId", vendor_id as "vendorId", service_name as "serviceName", status, transaction_id as "transactionId", payment_status as "paymentStatus", scheduled_date as "scheduledDate", scheduled_time as "scheduledTime", notes, final_amount as "finalAmount", work_started_at as "workStartedAt", completion_requested_at as "completionRequestedAt", payment_request_token_hash as "paymentRequestTokenHash", payment_request_expires as "paymentRequestExpires", rejection_reason as "rejectionReason", created_at as "createdAt", updated_at as "updatedAt"`,
    [bookingId, finalAmount]
  );
  return result.rows[0] ?? null;
}

export async function markBookingInProgress(bookingId: string) {
  const result = await pool.query<DbBooking>(
    `UPDATE bookings
     SET status = 'in_progress',
         work_started_at = COALESCE(work_started_at, NOW()),
         rejection_reason = NULL,
         updated_at = NOW()
     WHERE id = $1
    RETURNING id, customer_id as "customerId", vendor_id as "vendorId", service_name as "serviceName", status, transaction_id as "transactionId", payment_status as "paymentStatus", scheduled_date as "scheduledDate", scheduled_time as "scheduledTime", notes, final_amount as "finalAmount", work_started_at as "workStartedAt", completion_requested_at as "completionRequestedAt", payment_request_token_hash as "paymentRequestTokenHash", payment_request_expires as "paymentRequestExpires", rejection_reason as "rejectionReason", created_at as "createdAt", updated_at as "updatedAt"`,
    [bookingId]
  );
  return result.rows[0] ?? null;
}

export async function rejectBookingWithReason(bookingId: string, reason: string) {
  const result = await pool.query<DbBooking>(
    `UPDATE bookings
     SET status = 'cancelled',
         rejection_reason = $2,
         completion_otp_hash = NULL,
         completion_otp_expires = NULL,
         updated_at = NOW()
     WHERE id = $1
    RETURNING id, customer_id as "customerId", vendor_id as "vendorId", service_name as "serviceName", status, transaction_id as "transactionId", payment_status as "paymentStatus", scheduled_date as "scheduledDate", scheduled_time as "scheduledTime", notes, final_amount as "finalAmount", work_started_at as "workStartedAt", completion_requested_at as "completionRequestedAt", payment_request_token_hash as "paymentRequestTokenHash", payment_request_expires as "paymentRequestExpires", rejection_reason as "rejectionReason", created_at as "createdAt", updated_at as "updatedAt"`,
    [bookingId, reason]
  );
  return result.rows[0] ?? null;
}

export async function markCompletionRequested(bookingId: string) {
  const result = await pool.query<DbBooking>(
    `UPDATE bookings
     SET completion_requested_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, customer_id as "customerId", vendor_id as "vendorId", service_name as "serviceName", status, transaction_id as "transactionId", payment_status as "paymentStatus", scheduled_date as "scheduledDate", scheduled_time as "scheduledTime", notes, final_amount as "finalAmount", work_started_at as "workStartedAt", completion_requested_at as "completionRequestedAt", payment_request_token_hash as "paymentRequestTokenHash", payment_request_expires as "paymentRequestExpires", rejection_reason as "rejectionReason", created_at as "createdAt", updated_at as "updatedAt"`,
    [bookingId]
  );
  return result.rows[0] ?? null;
}

export async function setPaymentRequestToken(bookingId: string, tokenHash: string, expiresAt: Date) {
  await pool.query(
    `UPDATE bookings
     SET payment_request_token_hash = $2,
         payment_request_expires = $3,
         updated_at = NOW()
     WHERE id = $1`,
    [bookingId, tokenHash, expiresAt]
  );
}

export async function markPaymentSuccess(bookingId: string) {
  const result = await pool.query<DbBooking>(
    `UPDATE bookings
     SET payment_status = 'success',
         payment_request_token_hash = NULL,
         payment_request_expires = NULL,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, customer_id as "customerId", vendor_id as "vendorId", service_name as "serviceName", status, transaction_id as "transactionId", payment_status as "paymentStatus", scheduled_date as "scheduledDate", scheduled_time as "scheduledTime", notes, final_amount as "finalAmount", work_started_at as "workStartedAt", completion_requested_at as "completionRequestedAt", payment_request_token_hash as "paymentRequestTokenHash", payment_request_expires as "paymentRequestExpires", rejection_reason as "rejectionReason", created_at as "createdAt", updated_at as "updatedAt"`,
    [bookingId]
  );
  return result.rows[0] ?? null;
}

export async function setCompletionOtp(bookingId: string, otpHash: string, expiresAt: Date) {
  await pool.query(
    `UPDATE bookings SET completion_otp_hash = $2, completion_otp_expires = $3, updated_at = NOW() WHERE id = $1`,
    [bookingId, otpHash, expiresAt]
  );
}

export async function getCompletionOtp(bookingId: string) {
  const result = await pool.query<{ completion_otp_hash: string | null; completion_otp_expires: string | null }>(
    `SELECT completion_otp_hash, completion_otp_expires FROM bookings WHERE id = $1`,
    [bookingId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return { otpHash: row.completion_otp_hash, expiresAt: row.completion_otp_expires };
}

export async function clearCompletionOtp(bookingId: string) {
  await pool.query(
    `UPDATE bookings SET completion_otp_hash = NULL, completion_otp_expires = NULL, updated_at = NOW() WHERE id = $1`,
    [bookingId]
  );
}
