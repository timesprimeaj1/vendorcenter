import { baseTemplate } from "./baseTemplate.js";

export function bookingConfirmationHtml(opts: {
  bookingId: string;
  serviceName: string;
  vendorName?: string;
  transactionId: string;
  status: string;
  createdAt: string;
  location?: string;
  amount?: string;
}) {
  const normalizedStatus = String(opts.status || "pending").toLowerCase();
  const isConfirmed = normalizedStatus === "confirmed";
  const heading = isConfirmed ? "Booking Confirmed!" : "Booking Request Received";
  const subheading = isConfirmed
    ? "Your booking has been confirmed by vendor."
    : "Your request is received and waiting for vendor acceptance.";
  const preheader = isConfirmed
    ? `Booking #${opts.bookingId.slice(0, 8).toUpperCase()} confirmed for ${opts.serviceName}`
    : `Booking request #${opts.bookingId.slice(0, 8).toUpperCase()} created for ${opts.serviceName}`;

  const vendorLine = opts.vendorName
    ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Vendor</td><td style="padding:6px 0;color:#1a1a2e;font-size:14px;text-align:right;font-weight:500">${opts.vendorName}</td></tr>`
    : "";
  const locationLine = opts.location
    ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px">Location</td><td style="padding:6px 0;color:#1a1a2e;font-size:14px;text-align:right;font-weight:500">${opts.location}</td></tr>`
    : "";
  const amountLine = opts.amount
    ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;font-weight:600">Amount Paid</td><td style="padding:6px 0;color:#1a1a2e;font-size:18px;text-align:right;font-weight:700">&#8377; ${opts.amount}</td></tr>`
    : "";

  const content = `
    <h2 style="text-align:center;color:#1a1a2e;margin:0 0 4px;font-size:22px">${heading}</h2>
    <p style="text-align:center;color:#6b7280;margin:0 0 24px;font-size:14px">${subheading}</p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;text-align:center;margin-bottom:24px">
      <span style="font-size:28px">&#10004;</span>
      <p style="margin:4px 0 0;color:#166534;font-weight:600;font-size:15px">Booking #${opts.bookingId.slice(0, 8).toUpperCase()}</p>
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:14px">Service</td>
        <td style="padding:6px 0;color:#1a1a2e;font-size:14px;text-align:right;font-weight:500">${opts.serviceName}</td>
      </tr>
      ${vendorLine}
      ${locationLine}
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:14px">Booking Date</td>
        <td style="padding:6px 0;color:#1a1a2e;font-size:14px;text-align:right">${opts.createdAt}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:14px">Transaction ID</td>
        <td style="padding:6px 0;color:#1a1a2e;font-size:14px;text-align:right;font-family:monospace;font-size:13px">${opts.transactionId}</td>
      </tr>
      ${amountLine}
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:14px">Status</td>
        <td style="padding:6px 0;text-align:right"><span style="display:inline-block;padding:3px 10px;border-radius:6px;background:#fef3c7;color:#92400e;font-size:12px;font-weight:600;text-transform:uppercase">${opts.status}</span></td>
      </tr>
    </table>

    <p style="text-align:center;color:#9ca3af;font-size:13px">You can track your booking in your VendorCenter dashboard.</p>`;

  return baseTemplate(content, { preheader });
}
