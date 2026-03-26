/**
 * One-time script to generate and backfill embeddings for existing data.
 *
 * Against Supabase (production — has pgvector):
 *   DATABASE_URL="postgresql://postgres.xxx:password@host:5432/postgres" npx tsx src/scripts/generate-embeddings.ts
 *
 * Against local PostgreSQL (requires pgvector installed locally):
 *   npx tsx src/scripts/generate-embeddings.ts
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env"), override: true });

import { generateBatchEmbeddings } from "../services/embeddingService.js";

// Use SUPABASE_DATABASE_URL or DATABASE_URL if provided (Supabase), otherwise fall back to local vars
const connectionUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
const dbPool = connectionUrl
  ? new Pool({
      connectionString: connectionUrl.replace(/[?&]sslmode=[^&]*/g, "").replace(/\?$/, ""),
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      host: process.env.DB_HOST ?? "localhost",
      port: Number(process.env.DB_PORT ?? 5432),
      database: process.env.DB_NAME ?? "vendorcenter",
      user: process.env.DB_USER ?? "postgres",
      password: process.env.DB_PASSWORD ?? "change_me",
    });

// ═══ Service Categories with keywords + descriptions ═══
const CATEGORIES = [
  { category: "Plumbing", keywords: "plumber pipe leak tap faucet drain toilet bathroom water", description: "Plumbing services: pipe repair, leak fixing, faucet installation, drain cleaning, toilet repair" },
  { category: "Electrical", keywords: "electrician wiring switch fan light inverter mcb", description: "Electrical services: wiring, switch installation, fan repair, light fixtures, inverter setup" },
  { category: "AC Repair", keywords: "ac air conditioner air conditioning cooling hvac ac service ac installation", description: "AC repair and servicing: air conditioner installation, maintenance, cooling issues, HVAC" },
  { category: "Cleaning", keywords: "clean cleaning cleaner maid housekeeping deep cleaning home cleaning sanitization", description: "Cleaning services: home cleaning, deep cleaning, sanitization, housekeeping, maid service" },
  { category: "Painting", keywords: "paint painting painter wall whitewash", description: "Painting services: wall painting, whitewash, home painting, exterior and interior painting" },
  { category: "Carpentry", keywords: "carpenter carpentry furniture wood cupboard wardrobe door", description: "Carpentry services: furniture repair, cupboard making, wardrobe, door installation, woodwork" },
  { category: "Pest Control", keywords: "pest termite cockroach pest control rats mosquito bedbugs", description: "Pest control: termite treatment, cockroach control, rat removal, mosquito fogging, bedbug treatment" },
  { category: "Salon", keywords: "salon haircut beauty spa grooming facial makeup bridal mehndi", description: "Salon and beauty services: haircut, facial, spa, bridal makeup, mehndi, grooming" },
  { category: "Appliance Repair", keywords: "appliance fridge washing microwave washing machine refrigerator geyser", description: "Appliance repair: fridge, washing machine, microwave, geyser, refrigerator repair" },
  { category: "Moving", keywords: "moving packers movers relocation shifting packers and movers transport", description: "Moving and relocation: packers and movers, house shifting, transport, relocation services" },
  { category: "Photography", keywords: "photography photographer photo photo shoot videography", description: "Photography and videography services: photo shoots, event photography, wedding videography" },
  { category: "Catering", keywords: "catering caterer food cook chef tiffin", description: "Catering services: event catering, food preparation, tiffin service, personal chef" },
  { category: "Mobile Repair", keywords: "mobile mobile repair phone phone repair screen repair", description: "Mobile phone repair: screen replacement, battery change, software issues" },
  { category: "Computer Repair", keywords: "laptop computer laptop repair printer", description: "Computer and laptop repair: hardware issues, software troubleshooting, printer repair" },
  { category: "Tutoring", keywords: "tutor tutoring tuition teacher coaching", description: "Tutoring and education: home tuition, coaching classes, online tutoring" },
  { category: "Fitness", keywords: "fitness personal trainer yoga gym", description: "Fitness services: personal training, yoga classes, home gym setup" },
];

// ═══ FAQ entries ═══
const FAQS = [
  { question: "How do I book a service?", answer: "Booking is easy! Search for a service, pick a vendor based on ratings and reviews, choose a time, and book. Payments are secure and you can track your booking status in real-time.", lang: "en" },
  { question: "How do I cancel my booking?", answer: "You can cancel your booking from the My Bookings section in your account. If the vendor hasn't started work yet, you'll get a full refund.", lang: "en" },
  { question: "How does payment work?", answer: "VendorCenter uses secure payment processing. You pay after the service is completed and you're satisfied. Your payment details are encrypted and never shared with vendors.", lang: "en" },
  { question: "Are vendors verified?", answer: "Yes! All vendors on VendorCenter go through a verification process. We check their identity, work samples, and portfolio before they can offer services.", lang: "en" },
  { question: "How do I become a vendor?", answer: "To become a vendor, register with your business details, upload your portfolio and documents, and our team will verify your profile. Once approved, you can start receiving bookings!", lang: "en" },
  { question: "What if I'm not satisfied with the service?", answer: "Your satisfaction matters! If you're not happy with the service, you can raise a complaint from your booking page. Our support team will help resolve the issue.", lang: "en" },
  { question: "How are vendor ratings calculated?", answer: "Vendor ratings are based on genuine customer reviews after completed bookings. The average rating and total review count are displayed on each vendor's profile.", lang: "en" },
  { question: "Is my personal data safe?", answer: "Absolutely! VendorCenter follows strict data privacy practices. Your personal information is encrypted and never shared without your consent.", lang: "en" },
  { question: "What areas do you service?", answer: "VendorCenter operates across multiple zones and cities. When you share your location, we show vendors available in your area. We're expanding to new cities regularly!", lang: "en" },
  { question: "Can I reschedule my booking?", answer: "You can reschedule your booking by contacting the vendor through the booking page. Both you and the vendor need to agree on the new time.", lang: "en" },
  { question: "How do I contact support?", answer: "You can reach our support team through the Help section in the app, or email us. We typically respond within 24 hours.", lang: "en" },
  { question: "What payment methods are accepted?", answer: "We accept all major payment methods including UPI, debit cards, credit cards, and net banking. All transactions are securely processed.", lang: "en" },
];

async function backfillCategoryEmbeddings() {
  console.log("[backfill] Generating category embeddings...");
  const texts = CATEGORIES.map((c) => `${c.category}: ${c.description} ${c.keywords}`);
  const embeddings = await generateBatchEmbeddings(texts);

  for (let i = 0; i < CATEGORIES.length; i++) {
    const c = CATEGORIES[i];
    const vectorStr = `[${embeddings[i].join(",")}]`;
    await dbPool.query(
      `INSERT INTO service_category_embeddings (category, keywords, description, embedding)
       VALUES ($1, $2, $3, $4::vector)
       ON CONFLICT (category) DO UPDATE SET keywords = $2, description = $3, embedding = $4::vector`,
      [c.category, c.keywords, c.description, vectorStr],
    );
  }
  console.log(`[backfill] ${CATEGORIES.length} category embeddings saved.`);
}

async function backfillFaqEmbeddings() {
  console.log("[backfill] Generating FAQ embeddings...");
  const texts = FAQS.map((f) => f.question);
  const embeddings = await generateBatchEmbeddings(texts);

  for (let i = 0; i < FAQS.length; i++) {
    const f = FAQS[i];
    const vectorStr = `[${embeddings[i].join(",")}]`;
    await dbPool.query(
      `INSERT INTO faq_embeddings (question, answer, embedding, lang)
       VALUES ($1, $2, $3::vector, $4)`,
      [f.question, f.answer, vectorStr, f.lang],
    );
  }
  console.log(`[backfill] ${FAQS.length} FAQ embeddings saved.`);
}

async function backfillVendorProfileEmbeddings() {
  console.log("[backfill] Generating vendor profile embeddings...");
  const { rows } = await dbPool.query(
    `SELECT vendor_id, business_name, service_categories FROM vendor_profiles WHERE embedding IS NULL`,
  );

  if (rows.length === 0) {
    console.log("[backfill] No vendor profiles to embed (all already have embeddings or none exist).");
    return;
  }

  const batchSize = 32;
  let count = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const texts = batch.map((r: any) => {
      const cats = Array.isArray(r.service_categories) ? r.service_categories.join(", ") : "";
      return `${r.business_name} ${cats}`.trim();
    });

    const embeddings = await generateBatchEmbeddings(texts);

    for (let j = 0; j < batch.length; j++) {
      const vectorStr = `[${embeddings[j].join(",")}]`;
      await dbPool.query(
        `UPDATE vendor_profiles SET embedding = $1::vector WHERE vendor_id = $2`,
        [vectorStr, batch[j].vendor_id],
      );
      count++;
    }
  }

  console.log(`[backfill] ${count} vendor profile embeddings saved.`);
}

async function backfillVendorServiceEmbeddings() {
  console.log("[backfill] Generating vendor service embeddings...");
  const { rows } = await dbPool.query(
    `SELECT id, name FROM vendor_services WHERE embedding IS NULL AND is_deleted = false`,
  );

  if (rows.length === 0) {
    console.log("[backfill] No vendor services to embed.");
    return;
  }

  const batchSize = 32;
  let count = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const texts = batch.map((r: any) => r.name);
    const embeddings = await generateBatchEmbeddings(texts);

    for (let j = 0; j < batch.length; j++) {
      const vectorStr = `[${embeddings[j].join(",")}]`;
      await dbPool.query(
        `UPDATE vendor_services SET embedding = $1::vector WHERE id = $2`,
        [vectorStr, batch[j].id],
      );
      count++;
    }
  }

  console.log(`[backfill] ${count} vendor service embeddings saved.`);
}

async function main() {
  console.log("===========================================");
  console.log("  Embedding Backfill Script - VendorCenter");
  console.log("===========================================\n");
  console.log(`[backfill] Using ${connectionUrl ? "Supabase (SUPABASE_DATABASE_URL)" : "local DB vars"}\n`);

  try {
    // Ensure pgvector extension exists
    await dbPool.query("CREATE EXTENSION IF NOT EXISTS vector");

    // Ensure tables exist (in case migrations haven't run on this DB)
    await dbPool.query(`CREATE TABLE IF NOT EXISTS service_category_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category TEXT UNIQUE NOT NULL,
      keywords TEXT,
      description TEXT,
      embedding vector(384),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await dbPool.query(`CREATE TABLE IF NOT EXISTS faq_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      embedding vector(384),
      lang TEXT NOT NULL DEFAULT 'en',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    // Add embedding columns if missing
    await dbPool.query(`ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS embedding vector(384)`).catch(() => {});
    await dbPool.query(`ALTER TABLE vendor_services ADD COLUMN IF NOT EXISTS embedding vector(384)`).catch(() => {});

    await backfillCategoryEmbeddings();
    await backfillFaqEmbeddings();
    await backfillVendorProfileEmbeddings();
    await backfillVendorServiceEmbeddings();

    console.log("\n[backfill] All embeddings generated successfully. Done.");
  } catch (err) {
    console.error("[backfill] FATAL:", err);
    process.exit(1);
  } finally {
    await dbPool.end();
  }
}

main();
