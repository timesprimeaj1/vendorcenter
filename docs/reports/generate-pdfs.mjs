/**
 * Generate styled PDFs from markdown report files.
 * Uses: marked (MD→tokens) + pdfkit (PDF rendering)
 * Run: node docs/reports/generate-pdfs.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Lexer } from "marked";
import PDFDocument from "pdfkit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── CONFIG ──────────────────────────────────────────────────
const FILES = [
  "FULL_PROJECT_REPORT.md",
  "SIX_WEEK_REPORT.md",
  "TEAM_DIVISION_PLAN.md",
  "ANUJ_STUDY_GUIDE.md",
  "PRODUCTION_AUDIT_REPORT.md",
];

const COLORS = {
  primary: "#1a1a2e",
  secondary: "#16213e",
  accent: "#0f3460",
  link: "#2563eb",
  heading1: "#0f172a",
  heading2: "#1e293b",
  heading3: "#334155",
  body: "#374151",
  muted: "#6b7280",
  tableBorder: "#d1d5db",
  tableHeaderBg: "#f1f5f9",
  tableStripeBg: "#f8fafc",
  codeBg: "#f3f4f6",
  hrLine: "#cbd5e1",
  white: "#ffffff",
};

const FONTS = { main: "Helvetica", bold: "Helvetica-Bold", italic: "Helvetica-Oblique", mono: "Courier" };
const PAGE = { top: 65, bottom: 60, left: 60, right: 60 };
const LINE_GAP = 2;

// ── UNICODE SANITIZER ───────────────────────────────────────
// PDFKit's built-in fonts (Helvetica, Courier) don't support Unicode
// box-drawing, emojis, or special arrows. Replace with ASCII equivalents.
const UNICODE_MAP = [
  [/\u2705/g, "[Done]"],     // ✅
  [/\u2714/g, "[Done]"],     // ✔
  [/\u274C/g, "[X]"],        // ❌
  [/\u26A0\uFE0F?/g, "[!]"],// ⚠️
  [/\uD83D\uDD0D/g, ""],    // 🔍
  [/\uD83D[\uDE00-\uDEFF]/g, ""], // common emojis
  [/\uD83C[\uDF00-\uDFFF]/g, ""], // symbols & pictographs
  [/\uD83E[\uDD00-\uDDFF]/g, ""], // supplemental symbols
  [/\u2192/g, "->"],         // →
  [/\u2190/g, "<-"],         // ←
  [/\u2191/g, "^"],          // ↑
  [/\u2193/g, "v"],          // ↓
  [/\u21D2/g, "=>"],         // ⇒
  [/\u25B6/g, ">"],          // ▶
  [/\u25BC/g, "v"],          // ▼
  [/\u25BA/g, ">"],          // ►
  [/\u2014/g, "--"],         // —
  [/\u2013/g, "-"],          // –
  [/\u2026/g, "..."],        // …
  [/\u2018/g, "'"],          // '
  [/\u2019/g, "'"],          // '
  [/\u201C/g, '"'],          // "
  [/\u201D/g, '"'],          // "
  [/\u2264/g, "<="],         // ≤
  [/\u2265/g, ">="],         // ≥
  // Box-drawing characters
  [/[\u2500-\u257F]/g, ""],  // box drawing block
  [/[\u2580-\u259F]/g, ""],  // block elements
];

function sanitize(text) {
  if (!text) return "";
  let s = text;
  for (const [pattern, replacement] of UNICODE_MAP) {
    s = s.replace(pattern, replacement);
  }
  return s;
}

// ── HELPERS ─────────────────────────────────────────────────

function stripInline(text) {
  if (!text) return "";
  return sanitize(text)
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/<[^>]+>/g, "");
}

/** Render inline markdown (bold, italic, code, links) into a single doc.text() with formatting. */
function renderInlineText(doc, text, baseOpts = {}) {
  if (!text) return;
  const cleaned = sanitize(text.replace(/<[^>]+>/g, ""));
  // Split into segments: **bold**, *italic*, `code`, [link](url), plain
  const parts = [];
  let remaining = cleaned;
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[([^\]]+)\]\(([^)]+)\)|~~(.+?)~~)/;

  while (remaining.length > 0) {
    const m = remaining.match(regex);
    if (!m) {
      parts.push({ text: remaining, style: "plain" });
      break;
    }
    if (m.index > 0) {
      parts.push({ text: remaining.slice(0, m.index), style: "plain" });
    }
    if (m[2]) parts.push({ text: m[2], style: "bold" });
    else if (m[3]) parts.push({ text: m[3], style: "italic" });
    else if (m[4]) parts.push({ text: m[4], style: "code" });
    else if (m[5]) parts.push({ text: m[5], style: "link", url: m[6] });
    else if (m[7]) parts.push({ text: m[7], style: "strikethrough" });
    remaining = remaining.slice(m.index + m[0].length);
  }

  if (parts.length === 0) return;

  // If only one segment, render simply
  if (parts.length === 1) {
    const p = parts[0];
    const opts = { ...baseOpts, continued: false };
    switch (p.style) {
      case "bold":
        doc.font(FONTS.bold).text(p.text, opts);
        doc.font(FONTS.main);
        break;
      case "italic":
        doc.font(FONTS.italic).text(p.text, opts);
        doc.font(FONTS.main);
        break;
      case "code":
        doc.font(FONTS.mono).fontSize((baseOpts.fontSize || 10.5) - 1).text(p.text, opts);
        doc.font(FONTS.main).fontSize(baseOpts.fontSize || 10.5);
        break;
      case "link":
        doc.fillColor(COLORS.link).text(p.text, { ...opts, link: p.url, underline: true });
        doc.fillColor(baseOpts.color || COLORS.body);
        break;
      default:
        doc.text(p.text, opts);
    }
    return;
  }

  // Multiple segments — use continued
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const isLast = i === parts.length - 1;
    const opts = { ...baseOpts, continued: !isLast };
    delete opts.fontSize; // fontSize set via doc.fontSize

    switch (p.style) {
      case "bold":
        doc.font(FONTS.bold).text(p.text, opts);
        if (isLast) doc.font(FONTS.main);
        break;
      case "italic":
        doc.font(FONTS.italic).text(p.text, opts);
        if (isLast) doc.font(FONTS.main);
        break;
      case "code":
        doc.font(FONTS.mono).text(p.text, opts);
        if (isLast) doc.font(FONTS.main);
        break;
      case "link":
        doc.fillColor(COLORS.link).text(p.text, { ...opts, link: p.url, underline: true });
        doc.fillColor(baseOpts.color || COLORS.body);
        break;
      default:
        doc.font(FONTS.main).text(p.text, opts);
        break;
    }
  }
  // Reset font after mixed inline
  doc.font(FONTS.main);
}

function ensureSpace(doc, needed) {
  const remaining = doc.page.height - PAGE.bottom - doc.y;
  if (remaining < needed) doc.addPage();
}

// ── TABLE RENDERER ──────────────────────────────────────────

function renderTable(doc, token) {
  const headers = token.header.map((h) => stripInline(h.text || h.raw || ""));
  const rows = token.rows.map((r) => r.map((c) => stripInline(c.text || c.raw || "")));
  const colCount = headers.length;
  if (colCount === 0) return;

  const usableWidth = doc.page.width - PAGE.left - PAGE.right;
  const cellPad = 6;
  const fontSize = colCount > 4 ? 8 : colCount > 3 ? 8.5 : 9;

  // Calculate column widths based on content (proportional)
  const colWidths = [];
  const minWidth = 50;
  for (let c = 0; c < colCount; c++) {
    let maxLen = headers[c].length;
    for (const row of rows) {
      if (row[c] && row[c].length > maxLen) maxLen = row[c].length;
    }
    colWidths.push(Math.max(minWidth, maxLen));
  }
  const totalWeight = colWidths.reduce((a, b) => a + b, 0);
  for (let c = 0; c < colCount; c++) {
    colWidths[c] = Math.floor((colWidths[c] / totalWeight) * usableWidth);
  }
  // Distribute rounding remainder to last column
  const allocated = colWidths.reduce((a, b) => a + b, 0);
  colWidths[colCount - 1] += usableWidth - allocated;

  // Measure row height: find the tallest cell in a row
  function measureRowHeight(cells, isBold) {
    let maxH = 0;
    doc.save();
    doc.font(isBold ? FONTS.bold : FONTS.main).fontSize(fontSize);
    for (let c = 0; c < colCount; c++) {
      const textW = colWidths[c] - cellPad * 2;
      const h = doc.heightOfString(cells[c] || "", { width: Math.max(textW, 20), lineGap: 1 });
      if (h > maxH) maxH = h;
    }
    doc.restore();
    return maxH + cellPad * 2;
  }

  // Draw a single row at absolute Y position — does NOT move doc.y
  function drawRow(cells, y, rowH, isHeader, isStripe) {
    doc.save();
    let x = PAGE.left;
    for (let c = 0; c < colCount; c++) {
      const w = colWidths[c];

      // Background fill
      if (isHeader) {
        doc.rect(x, y, w, rowH).fill(COLORS.tableHeaderBg);
      } else if (isStripe) {
        doc.rect(x, y, w, rowH).fill(COLORS.tableStripeBg);
      }

      // Border
      doc.rect(x, y, w, rowH).strokeColor(COLORS.tableBorder).lineWidth(0.5).stroke();

      // Cell text — positioned absolutely, no doc.y mutation
      const textW = w - cellPad * 2;
      doc.fillColor(isHeader ? COLORS.heading2 : COLORS.body)
        .font(isHeader ? FONTS.bold : FONTS.main)
        .fontSize(fontSize)
        .text(cells[c] || "", x + cellPad, y + cellPad, {
          width: Math.max(textW, 20),
          height: rowH - cellPad,
          lineGap: 1,
          ellipsis: false,
        });

      x += w;
    }
    doc.restore();
  }

  doc.moveDown(0.3);

  // Draw header row
  const headerH = measureRowHeight(headers, true);
  ensureSpace(doc, headerH + 30);
  let y = doc.y;
  drawRow(headers, y, headerH, true, false);
  y += headerH;

  // Draw data rows
  for (let r = 0; r < rows.length; r++) {
    const rowH = measureRowHeight(rows[r], false);
    ensureSpace(doc, rowH + 5);
    // If page break happened, reset y to new page position
    if (doc.y > y || doc.y < y - 100) y = doc.y;
    drawRow(rows[r], y, rowH, false, r % 2 === 1);
    y += rowH;
  }

  // Set doc.y past the table
  doc.x = PAGE.left;
  doc.y = y;
  doc.moveDown(0.5);
}

// ── CODE BLOCK RENDERER ────────────────────────────────────

function renderCode(doc, token) {
  const text = sanitize((token.text || "").replace(/\n+$/, ""));
  const fontSize = 8.5;
  const pad = 10;
  const usableWidth = doc.page.width - PAGE.left - PAGE.right;

  doc.font(FONTS.mono).fontSize(fontSize);
  const textHeight = doc.heightOfString(text, { width: usableWidth - pad * 2 });
  const blockHeight = textHeight + pad * 2;

  ensureSpace(doc, blockHeight + 10);
  const y = doc.y;

  // Background box
  doc.roundedRect(PAGE.left, y, usableWidth, blockHeight, 4).fill(COLORS.codeBg);
  doc.fillColor(COLORS.body).font(FONTS.mono).fontSize(fontSize);
  doc.text(text, PAGE.left + pad, y + pad, { width: usableWidth - pad * 2, lineGap: 2 });
  doc.y = y + blockHeight;
  doc.font(FONTS.main).fontSize(10.5);
  doc.moveDown(0.5);
}

// ── COVER PAGE ──────────────────────────────────────────────

function renderCover(doc, title, subtitle) {
  // Gradient-like header block
  const blockH = 240;
  doc.rect(0, 0, doc.page.width, blockH).fill(COLORS.primary);
  doc.rect(0, blockH - 4, doc.page.width, 4).fill(COLORS.link);

  doc.fillColor(COLORS.white).font(FONTS.bold).fontSize(28);
  doc.text(title, PAGE.left, 80, { width: doc.page.width - PAGE.left - PAGE.right, align: "center" });

  if (subtitle) {
    doc.fontSize(13).font(FONTS.main).fillColor("#94a3b8");
    doc.text(subtitle, PAGE.left, doc.y + 8, { width: doc.page.width - PAGE.left - PAGE.right, align: "center" });
  }

  doc.fillColor(COLORS.muted).font(FONTS.main).fontSize(10);
  doc.text("VendorCenter — AI-Powered Local Service Marketplace", PAGE.left, blockH + 30, {
    width: doc.page.width - PAGE.left - PAGE.right,
    align: "center",
  });
  doc.text(`Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`, {
    align: "center",
  });

  doc.moveDown(3);
  doc.fillColor(COLORS.body);
}

// ── HEADER / FOOTER ─────────────────────────────────────────

function addHeaderFooter(doc, reportTitle) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    // Header line (skip page 1 = cover)
    if (i > 0) {
      doc.save();
      doc.fontSize(7.5).font(FONTS.main).fillColor(COLORS.muted);
      doc.text(reportTitle, PAGE.left, 20, { width: doc.page.width - PAGE.left - PAGE.right, align: "left" });
      doc.text("VendorCenter", PAGE.left, 20, { width: doc.page.width - PAGE.left - PAGE.right, align: "right" });
      doc.moveTo(PAGE.left, 35).lineTo(doc.page.width - PAGE.right, 35).strokeColor(COLORS.hrLine).lineWidth(0.5).stroke();
      doc.restore();
    }
    // Footer
    doc.save();
    doc.fontSize(8).font(FONTS.main).fillColor(COLORS.muted);
    const footerY = doc.page.height - 35;
    doc.moveTo(PAGE.left, footerY - 8).lineTo(doc.page.width - PAGE.right, footerY - 8).strokeColor(COLORS.hrLine).lineWidth(0.5).stroke();
    doc.text(`Page ${i + 1} of ${range.count}`, PAGE.left, footerY, { width: doc.page.width - PAGE.left - PAGE.right, align: "center" });
    doc.restore();
  }
}

// ── MAIN TOKEN RENDERER ─────────────────────────────────────

function renderTokens(doc, tokens, isFirstPage) {
  let skipFirstHeading = isFirstPage; // Skip the first h1 (already on cover)

  for (const token of tokens) {
    switch (token.type) {
      case "heading": {
        if (skipFirstHeading && token.depth === 1) {
          skipFirstHeading = false;
          break;
        }
        const sizes = { 1: 22, 2: 16, 3: 13, 4: 11.5, 5: 10.5, 6: 10 };
        const colors = { 1: COLORS.heading1, 2: COLORS.heading2, 3: COLORS.heading3, 4: COLORS.heading3, 5: COLORS.body, 6: COLORS.body };
        const sz = sizes[token.depth] || 10.5;
        const clr = colors[token.depth] || COLORS.body;

        ensureSpace(doc, sz + 30);

        if (token.depth <= 2) doc.moveDown(0.8);
        else doc.moveDown(0.4);

        const headingText = stripInline(token.text);

        if (token.depth === 1) {
          // Major section header
          doc.moveDown(0.6);
          doc.font(FONTS.bold).fontSize(sz).fillColor(clr);
          doc.text(headingText);
          const lineY = doc.y + 2;
          doc.moveTo(PAGE.left, lineY).lineTo(PAGE.left + 120, lineY).strokeColor(COLORS.link).lineWidth(2).stroke();
          doc.moveDown(0.5);
        } else if (token.depth === 2) {
          doc.font(FONTS.bold).fontSize(sz).fillColor(clr);
          doc.text(headingText);
          const lineY = doc.y + 1;
          doc.moveTo(PAGE.left, lineY).lineTo(PAGE.left + 80, lineY).strokeColor(COLORS.hrLine).lineWidth(1).stroke();
          doc.moveDown(0.4);
        } else {
          doc.font(FONTS.bold).fontSize(sz).fillColor(clr);
          doc.text(headingText);
          doc.moveDown(0.2);
        }
        doc.font(FONTS.main).fontSize(10.5).fillColor(COLORS.body);
        break;
      }

      case "paragraph": {
        ensureSpace(doc, 20);
        doc.fontSize(10.5).fillColor(COLORS.body).font(FONTS.main);
        renderInlineText(doc, token.raw || token.text, { color: COLORS.body, lineGap: LINE_GAP });
        doc.moveDown(0.4);
        break;
      }

      case "list": {
        const bullet = token.ordered ? "num" : "bullet";
        for (let li = 0; li < token.items.length; li++) {
          const item = token.items[li];
          ensureSpace(doc, 18);
          const prefix = bullet === "num" ? `${li + 1}. ` : "•  ";
          const rawText = stripInline(item.text || item.raw || "");
          doc.fontSize(10.5).fillColor(COLORS.body).font(FONTS.main);
          doc.text(prefix + rawText, PAGE.left + 15, doc.y, {
            width: doc.page.width - PAGE.left - PAGE.right - 15,
            lineGap: LINE_GAP,
          });
          doc.moveDown(0.15);

          // Sub-items
          if (item.tokens) {
            for (const sub of item.tokens) {
              if (sub.type === "list") {
                for (let si = 0; si < sub.items.length; si++) {
                  ensureSpace(doc, 16);
                  const sp = sub.ordered ? `${si + 1}. ` : "–  ";
                  const subText = stripInline(sub.items[si].text || sub.items[si].raw || "");
                  doc.fontSize(10).fillColor(COLORS.muted).font(FONTS.main);
                  doc.text(sp + subText, PAGE.left + 35, doc.y, {
                    width: doc.page.width - PAGE.left - PAGE.right - 35,
                    lineGap: LINE_GAP,
                  });
                  doc.moveDown(0.1);
                }
              }
            }
          }
        }
        doc.moveDown(0.3);
        doc.fillColor(COLORS.body);
        break;
      }

      case "table": {
        renderTable(doc, token);
        break;
      }

      case "code": {
        renderCode(doc, token);
        break;
      }

      case "hr": {
        doc.moveDown(0.5);
        const hrY = doc.y;
        doc.moveTo(PAGE.left, hrY).lineTo(doc.page.width - PAGE.right, hrY).strokeColor(COLORS.hrLine).lineWidth(0.75).stroke();
        doc.moveDown(0.5);
        break;
      }

      case "blockquote": {
        ensureSpace(doc, 30);
        const quoteText = stripInline(token.text || token.raw || "");
        const x = PAGE.left + 12;
        const barX = PAGE.left + 3;
        doc.font(FONTS.italic).fontSize(10.5).fillColor(COLORS.muted);
        const qh = doc.heightOfString(quoteText, { width: doc.page.width - PAGE.left - PAGE.right - 20 });
        const qy = doc.y;
        doc.moveTo(barX, qy).lineTo(barX, qy + qh + 4).strokeColor(COLORS.link).lineWidth(2.5).stroke();
        doc.text(quoteText, x, qy, { width: doc.page.width - PAGE.left - PAGE.right - 20 });
        doc.font(FONTS.main).fillColor(COLORS.body).moveDown(0.4);
        break;
      }

      case "space":
        doc.moveDown(0.2);
        break;

      case "html":
        // Skip HTML comments/tags
        break;

      default:
        if (token.text || token.raw) {
          doc.fontSize(10.5).fillColor(COLORS.body).font(FONTS.main);
          doc.text(stripInline(token.text || token.raw), { lineGap: LINE_GAP });
          doc.moveDown(0.3);
        }
    }
  }
}

// ── GENERATE PDF ────────────────────────────────────────────

function generatePdf(mdFile) {
  const mdPath = path.join(__dirname, mdFile);
  const pdfPath = mdPath.replace(/\.md$/, ".pdf");
  const mdContent = fs.readFileSync(mdPath, "utf-8");

  // Tokenize markdown
  const lexer = new Lexer();
  const tokens = lexer.lex(mdContent);

  // Extract title from first h1
  const firstH1 = tokens.find((t) => t.type === "heading" && t.depth === 1);
  const title = firstH1 ? stripInline(firstH1.text) : mdFile.replace(".md", "");

  // Extract subtitle (first non-heading text containing key info)
  let subtitle = "";
  for (const t of tokens) {
    if (t.type === "paragraph" && (t.text || "").includes("Team Members")) {
      subtitle = stripInline(t.text).split("\n").slice(0, 2).join("  |  ");
      break;
    }
  }

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: PAGE.top, bottom: PAGE.bottom, left: PAGE.left, right: PAGE.right },
    bufferPages: true,
    info: { Title: title, Author: "VendorCenter Team", Subject: "Project Report" },
  });

  const stream = fs.createWriteStream(pdfPath);
  doc.pipe(stream);

  // Cover page
  renderCover(doc, title, subtitle);

  // Start content on new page
  doc.addPage();

  // Render all tokens
  renderTokens(doc, tokens, true);

  // Add headers and footers
  addHeaderFooter(doc, title);

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on("finish", () => {
      const stats = fs.statSync(pdfPath);
      const sizeKB = (stats.size / 1024).toFixed(0);
      console.log(`  ✅ ${path.basename(pdfPath)} (${sizeKB} KB)`);
      resolve(pdfPath);
    });
    stream.on("error", reject);
  });
}

// ── MAIN ────────────────────────────────────────────────────

async function main() {
  console.log("\n📄 Generating PDFs from markdown reports...\n");

  for (const file of FILES) {
    const mdPath = path.join(__dirname, file);
    if (!fs.existsSync(mdPath)) {
      console.log(`  ⚠️  Skipping ${file} (not found)`);
      continue;
    }
    await generatePdf(file);
  }

  console.log("\n✅ All PDFs generated in docs/reports/\n");
}

main().catch((err) => {
  console.error("❌ PDF generation failed:", err);
  process.exit(1);
});
