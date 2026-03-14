/**
 * PDF receipt generator for VendorCenter bookings.
 * Uses pdfkit to generate a clean, branded receipt PDF.
 */

import PDFDocument from "pdfkit";

export interface ReceiptData {
  bookingId: string;
  transactionId: string;
  serviceName: string;
  customerEmail: string;
  customerName?: string;
  vendorName?: string;
  amount?: string;
  paymentStatus: string;
  date: string;
  bookingStatus?: string;
  notes?: string;
  workStartedAt?: string;
  completionRequestedAt?: string;
  completedAt?: string;
  rejectionReason?: string;
}

export function generateBookingReceipt(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Uint8Array[] = [];

    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header bar
    doc.rect(0, 0, doc.page.width, 80).fill("#1a1a2e");
    doc.fontSize(24).fillColor("#ffffff").text("VendorCenter", 50, 28);
    doc.fontSize(10).fillColor("#d1d5db").text("vendorcenter.in", 50, 55);

    // Title
    doc.moveDown(3);
    doc.fontSize(18).fillColor("#1a1a2e").text("Payment Receipt", { align: "center" });
    doc.moveDown(0.5);

    // Horizontal rule
    const y1 = doc.y;
    doc.moveTo(50, y1).lineTo(doc.page.width - 50, y1).strokeColor("#e5e7eb").stroke();
    doc.moveDown(1);

    // Receipt details
    const rows: [string, string][] = [
      ["Booking ID", `#${data.bookingId.slice(0, 8).toUpperCase()}`],
      ["Transaction ID", data.transactionId],
      ["Service", data.serviceName],
    ];
    if (data.customerName) rows.push(["Customer Name", data.customerName]);
    rows.push(["Customer Email", data.customerEmail]);
    if (data.vendorName) rows.push(["Vendor", data.vendorName]);
    if (data.amount) rows.push(["Amount", `₹ ${data.amount}`]);
    if (data.bookingStatus) rows.push(["Booking Status", data.bookingStatus.replace("_", " ").toUpperCase()]);
    rows.push(["Payment Status", data.paymentStatus.toUpperCase()]);
    if (data.workStartedAt) rows.push(["Work Started", data.workStartedAt]);
    if (data.completionRequestedAt) rows.push(["Completion Requested", data.completionRequestedAt]);
    if (data.completedAt) rows.push(["Completed At", data.completedAt]);
    if (data.rejectionReason) rows.push(["Cancellation Reason", data.rejectionReason]);
    if (data.notes) rows.push(["Customer Notes", data.notes]);
    rows.push(["Date", data.date]);

    for (const [label, value] of rows) {
      const rowY = doc.y;
      doc.fontSize(11).fillColor("#6b7280").text(label, 60, rowY, { width: 160 });
      doc.fontSize(11).fillColor("#1a1a2e").text(value, 230, rowY, { width: 300 });
      doc.moveDown(0.6);
    }

    // Bottom rule
    doc.moveDown(1);
    const y2 = doc.y;
    doc.moveTo(50, y2).lineTo(doc.page.width - 50, y2).strokeColor("#e5e7eb").stroke();
    doc.moveDown(1);

    // Footer
    doc.fontSize(9).fillColor("#9ca3af").text(
      "This is a computer-generated receipt and does not require a signature.",
      { align: "center" }
    );
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor("#9ca3af").text(
      `© ${new Date().getFullYear()} VendorCenter`,
      { align: "center" }
    );

    doc.end();
  });
}
