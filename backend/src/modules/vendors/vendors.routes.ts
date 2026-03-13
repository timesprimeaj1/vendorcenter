import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../../middleware/auth.js";
import { AuthRequest } from "../../middleware/auth.js";
import { trackActivity } from "../activity/activity.service.js";
import {
  createVendorProfile,
  listVendorProfiles,
  listVendorProfilesByStatus,
  updateVendorVerificationStatus,
  getActiveCategories,
  getVendorsByCategory,
  getVendorProfile,
  updateVendorProfile,
  updateVendorPortfolioUrls,
  listApprovedVendors
} from "./vendors.repository.js";

export const vendorsRouter = Router();

// Public: get active service categories with vendor counts (optionally location-aware)
vendorsRouter.get("/categories", async (req, res) => {
  const parsed = z.object({
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().positive().max(100).default(25),
  }).safeParse(req.query);

  const lat = parsed.success ? parsed.data.lat : undefined;
  const lng = parsed.success ? parsed.data.lng : undefined;
  const radius = parsed.success ? parsed.data.radius : 25;

  const cats = await getActiveCategories(lat, lng, radius);
  res.json({ success: true, data: cats });
});

// Public: get approved vendors by category (optionally near a location)
vendorsRouter.get("/by-category", async (req, res) => {
  const parsed = z.object({
    category: z.string().min(1),
    lat: z.coerce.number().optional(),
    lng: z.coerce.number().optional(),
    radius: z.coerce.number().positive().optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
  }).safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }

  const { category, lat, lng, radius, minRating } = parsed.data;
  const vendors = await getVendorsByCategory(category, lat, lng, radius, minRating);
  res.json({ success: true, data: vendors });
});

// Public: list all approved vendors (optionally near a location)
vendorsRouter.get("/approved", async (req, res) => {
  const parsed = z.object({
    lat: z.coerce.number().optional(),
    lng: z.coerce.number().optional(),
    radius: z.coerce.number().positive().optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
  }).safeParse(req.query);

  const lat = parsed.success ? parsed.data.lat : undefined;
  const lng = parsed.success ? parsed.data.lng : undefined;
  const radius = parsed.success ? parsed.data.radius : undefined;
  const minRating = parsed.success ? parsed.data.minRating : undefined;
  const vendors = await listApprovedVendors(lat, lng, radius, minRating);
  res.json({ success: true, data: vendors });
});

const onboardingSchema = z.object({
  businessName: z.string().min(2),
  serviceCategories: z.array(z.string().min(2)).min(1),
  latitude: z.number(),
  longitude: z.number(),
  zone: z.string().min(2),
  serviceRadiusKm: z.number().positive(),
  workingHours: z.string().min(3),
  documentUrls: z.array(z.string()).default([]),
  portfolioUrls: z.array(z.string()).default([]),
});

vendorsRouter.post("/onboarding", requireRole(["vendor"]), async (req: AuthRequest, res) => {
  const parsed = onboardingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }

  const profile = await createVendorProfile({
    vendorId: req.actor!.id,
    ...parsed.data
  });

  trackActivity({
    actorId: req.actor!.id,
    role: req.actor!.role,
    action: "vendor.onboarding_submitted",
    entity: "vendor",
    metadata: parsed.data
  });

  res.status(201).json({ success: true, data: profile });
});

// Vendor: get own profile
vendorsRouter.get("/me", requireRole(["vendor"]), async (req: AuthRequest, res) => {
  const profile = await getVendorProfile(req.actor!.id);
  if (!profile) {
    res.status(404).json({ success: false, error: "Profile not found. Please complete onboarding." });
    return;
  }
  res.json({ success: true, data: profile });
});

// Vendor: edit profile (one-time only)
vendorsRouter.patch("/me", requireRole(["vendor"]), async (req: AuthRequest, res) => {
  const parsed = z.object({
    businessName: z.string().min(2),
    serviceCategories: z.array(z.string().min(2)).min(1),
    latitude: z.number(),
    longitude: z.number(),
    zone: z.string().min(2),
    serviceRadiusKm: z.number().positive(),
    workingHours: z.string().min(3),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }

  const updated = await updateVendorProfile(req.actor!.id, parsed.data);
  if (!updated) {
    res.status(403).json({ success: false, error: "Profile has already been edited. No further edits allowed." });
    return;
  }

  trackActivity({
    actorId: req.actor!.id,
    role: req.actor!.role,
    action: "vendor.profile_edited",
    entity: "vendor",
    metadata: parsed.data,
  });

  res.json({ success: true, data: updated });
});

// Vendor: update portfolio photos (no one-time edit restriction)
vendorsRouter.patch("/me/portfolio", requireRole(["vendor"]), async (req: AuthRequest, res) => {
  const parsed = z.object({
    portfolioUrls: z.array(z.string()).max(6),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }

  const updated = await updateVendorPortfolioUrls(req.actor!.id, parsed.data.portfolioUrls);
  if (!updated) {
    res.status(404).json({ success: false, error: "Profile not found" });
    return;
  }

  res.json({ success: true, data: updated });
});

// Public: get vendor detail by vendorId
vendorsRouter.get("/detail/:vendorId", async (req, res) => {
  const profile = await getVendorProfile(req.params.vendorId);
  if (!profile) {
    res.status(404).json({ success: false, error: "Vendor not found" });
    return;
  }
  // Also get vendor services
  const { pool } = await import("../../db/pool.js");
  const svcResult = await pool.query(
    `SELECT id, name, price, availability, images FROM vendor_services WHERE vendor_id = $1 AND availability = 'available' ORDER BY created_at DESC`,
    [req.params.vendorId]
  );
  // Get user info for profile picture
  const userResult = await pool.query(
    `SELECT name, profile_picture_url FROM users WHERE id = $1 LIMIT 1`,
    [req.params.vendorId]
  );
  const userInfo = userResult.rows[0];
  // Strip private documents from public response
  const { documentUrls, ...publicProfile } = profile;
  res.json({
    success: true,
    data: {
      ...publicProfile,
      ownerName: userInfo?.name || null,
      profilePictureUrl: userInfo?.profile_picture_url || null,
      services: svcResult.rows.map(s => ({ id: s.id, name: s.name, price: s.price, images: s.images })),
    },
  });
});

vendorsRouter.get("/", requireRole(["admin", "employee"]), async (_req, res) => {
  res.json({ success: true, data: await listVendorProfiles() });
});

vendorsRouter.get("/queue", requireRole(["admin", "employee"]), async (req, res) => {
  const parsed = z
    .object({
      status: z.enum(["under_review", "approved", "rejected"]).default("under_review")
    })
    .safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }

  res.json({ success: true, data: await listVendorProfilesByStatus(parsed.data.status) });
});

vendorsRouter.patch("/:vendorId/verification", requireRole(["admin", "employee"]), async (req: AuthRequest, res) => {
  const parsed = z.object({ status: z.enum(["under_review", "approved", "rejected"]) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }

  const updated = await updateVendorVerificationStatus(req.params.vendorId, parsed.data.status);
  if (!updated) {
    res.status(404).json({ success: false, error: "Vendor profile not found" });
    return;
  }

  trackActivity({
    actorId: req.actor!.id,
    role: req.actor!.role,
    action: "vendor.verification_status_updated",
    entity: "vendor",
    metadata: { vendorId: req.params.vendorId, status: parsed.data.status }
  });

  res.json({ success: true, data: updated });
});
