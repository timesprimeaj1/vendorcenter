import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { requireRole, AuthRequest } from "../../middleware/auth.js";
import { trackActivity } from "../activity/activity.service.js";
import { createMediaAsset, listMediaAssets } from "./uploads.repository.js";
import { useCloudStorage, uploadToCloud } from "../../services/storageService.js";

const UPLOAD_DIR = path.resolve("uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Use memory storage in production (for S3 upload), disk in dev
const storage = useCloudStorage()
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = crypto.randomBytes(16).toString("hex") + ext;
        cb(null, name);
      },
    });

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|webp|gif)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

export const uploadsRouter = Router();

uploadsRouter.post("/metadata", requireRole(["customer", "vendor", "admin", "employee"]), async (req: AuthRequest, res) => {
  const parsed = z
    .object({
      mediaType: z.enum(["profile_picture", "service_image", "portfolio_image", "document"]),
      url: z.string().url(),
      metadata: z.record(z.unknown()).optional()
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }

  const media = await createMediaAsset({
    ownerId: req.actor!.id,
    ownerRole: req.actor!.role,
    mediaType: parsed.data.mediaType,
    url: parsed.data.url,
    metadata: parsed.data.metadata
  });

  trackActivity({
    actorId: req.actor!.id,
    role: req.actor!.role,
    action: "upload.metadata_created",
    entity: "media_asset",
    metadata: { mediaType: parsed.data.mediaType, url: parsed.data.url }
  });

  res.status(201).json({ success: true, data: media });
});

uploadsRouter.get("/my", requireRole(["customer", "vendor", "admin", "employee"]), async (req: AuthRequest, res) => {
  res.json({ success: true, data: await listMediaAssets(req.actor!.id) });
});

// File upload endpoint — saves to disk, returns URL
uploadsRouter.post("/file", requireRole(["customer", "vendor", "admin", "employee"]), (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    next();
  });
}, async (req: AuthRequest, res) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: "No file uploaded" });
    return;
  }

  let url: string;
  if (useCloudStorage()) {
    url = await uploadToCloud(req.file.buffer, req.file.originalname, req.file.mimetype);
  } else {
    url = `/api/uploads/files/${req.file.filename}`;
  }

  res.json({ success: true, data: { url, filename: req.file.originalname } });
});

// Multiple files upload
uploadsRouter.post("/files", requireRole(["customer", "vendor", "admin", "employee"]), (req, res, next) => {
  upload.array("files", 6)(req, res, (err) => {
    if (err) {
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    next();
  });
}, async (req: AuthRequest, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    res.status(400).json({ success: false, error: "No files uploaded" });
    return;
  }

  let urls: string[];
  if (useCloudStorage()) {
    urls = await Promise.all(
      files.map(f => uploadToCloud(f.buffer, f.originalname, f.mimetype))
    );
  } else {
    urls = files.map(f => `/api/uploads/files/${f.filename}`);
  }

  res.json({ success: true, data: { urls } });
});

// Serve uploaded files
uploadsRouter.get("/files/:filename", (req, res) => {
  const filename = path.basename(req.params.filename); // prevent directory traversal
  const filePath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ success: false, error: "File not found" });
    return;
  }
  res.sendFile(filePath);
});
