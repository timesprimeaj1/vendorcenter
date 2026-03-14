import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../../middleware/auth.js";
import { AuthRequest } from "../../middleware/auth.js";
import { trackActivity } from "../activity/activity.service.js";
import {
  createService,
  listDeletedServicesByVendor,
  listServiceHistory,
  listServices,
  listServicesByVendor,
  scheduleServicePriceUpdate,
  softDeleteService,
} from "./services.repository.js";

export const servicesRouter = Router();

// Vendor: get own services
servicesRouter.get("/mine", requireRole(["vendor"]), async (req: AuthRequest, res) => {
  const services = await listServicesByVendor(req.actor!.id);
  res.json({ success: true, data: services });
});

servicesRouter.get("/mine/deleted", requireRole(["vendor"]), async (req: AuthRequest, res) => {
  const services = await listDeletedServicesByVendor(req.actor!.id);
  res.json({ success: true, data: services });
});

servicesRouter.post("/", requireRole(["vendor"]), async (req: AuthRequest, res) => {
  const parsed = z
    .object({
      name: z.string().min(2),
      price: z.number().nonnegative(),
      availability: z.enum(["available", "unavailable"]),
      locations: z.array(z.string()).default([]),
      images: z.array(z.string().url()).default([])
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }

  const service = await createService({
    vendorId: req.actor!.id,
    ...parsed.data
  });

  trackActivity({
    actorId: req.actor!.id,
    role: req.actor!.role,
    action: "service.created",
    entity: "service",
    metadata: parsed.data
  });

  res.status(201).json({ success: true, data: service });
});

servicesRouter.get("/", async (_req, res) => {
  res.json({ success: true, data: await listServices() });
});

servicesRouter.patch("/:serviceId", requireRole(["vendor"]), async (req: AuthRequest, res) => {
  const parsed = z.object({
    newPrice: z.number().positive(),
    effectiveInDays: z.union([z.literal(1), z.literal(2)]),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }

  const updated = await scheduleServicePriceUpdate({
    serviceId: req.params.serviceId,
    vendorId: req.actor!.id,
    newPrice: parsed.data.newPrice,
    daysDelay: parsed.data.effectiveInDays,
  });

  if (!updated) {
    res.status(404).json({ success: false, error: "Service not found" });
    return;
  }

  trackActivity({
    actorId: req.actor!.id,
    role: req.actor!.role,
    action: "service.price_update_scheduled",
    entity: "service",
    metadata: { serviceId: updated.id, newPrice: parsed.data.newPrice, effectiveInDays: parsed.data.effectiveInDays },
  });

  res.json({ success: true, data: updated });
});

servicesRouter.delete("/:serviceId", requireRole(["vendor"]), async (req: AuthRequest, res) => {
  const parsed = z.object({ reason: z.string().max(250).optional() }).safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }

  const deleted = await softDeleteService({
    serviceId: req.params.serviceId,
    vendorId: req.actor!.id,
    reason: parsed.data.reason,
  });

  if (!deleted) {
    res.status(404).json({ success: false, error: "Service not found" });
    return;
  }

  trackActivity({
    actorId: req.actor!.id,
    role: req.actor!.role,
    action: "service.deleted",
    entity: "service",
    metadata: { serviceId: deleted.id, reason: parsed.data.reason || null },
  });

  res.json({ success: true, data: deleted });
});

servicesRouter.get("/:serviceId/history", requireRole(["vendor"]), async (req: AuthRequest, res) => {
  const history = await listServiceHistory(req.params.serviceId, req.actor!.id);
  res.json({ success: true, data: history });
});
