import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireRole, type AuthRequest } from "../../middleware/auth.js";
import { pool } from "../../db/pool.js";
import { trackActivity } from "../activity/activity.service.js";

export const adminRouter = Router();

adminRouter.get("/dashboard", requireRole(["admin"]), (_req, res) => {
  res.json({
    success: true,
    data: {
      manage: ["vendors", "zones", "services", "bookings", "payments", "users", "employees", "analytics"]
    }
  });
});

// Live platform stats for dashboard cards
adminRouter.get("/stats", requireRole(["admin"]), async (_req, res, next) => {
  try {
    const [usersR, vendorsR, bookingsR, pendingR, revenueR] = await Promise.all([
      pool.query("SELECT count(*)::int AS total FROM users WHERE role = 'customer'"),
      pool.query("SELECT count(*)::int AS total FROM users WHERE role = 'vendor'"),
      pool.query("SELECT count(*)::int AS total FROM bookings"),
      pool.query("SELECT count(*)::int AS total FROM vendor_profiles WHERE verification_status = 'under_review'"),
      pool.query("SELECT coalesce(sum(final_amount),0)::numeric AS total FROM bookings WHERE status = 'completed'"),
    ]);
    res.json({
      success: true,
      data: {
        totalCustomers: usersR.rows[0].total,
        totalVendors: vendorsR.rows[0].total,
        totalBookings: bookingsR.rows[0].total,
        pendingApprovals: pendingR.rows[0].total,
        totalRevenue: Number(revenueR.rows[0].total),
      },
    });
  } catch (err) { next(err); }
});

// All users list for admin user management
adminRouter.get("/users", requireRole(["admin"]), async (req, res, next) => {
  try {
    const role = req.query.role as string | undefined;
    let query = "SELECT id, email, role, name, phone, verified, COALESCE(suspended, false) AS suspended, created_at FROM users";
    const params: string[] = [];
    if (role && ["customer", "vendor", "admin", "employee"].includes(role)) {
      query += " WHERE role = $1";
      params.push(role);
    }
    query += " ORDER BY created_at DESC LIMIT 500";
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// All bookings list for admin
adminRouter.get("/bookings", requireRole(["admin", "employee"]), async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT b.id, b.customer_id, b.vendor_id, b.service_name, b.status,
             b.scheduled_date, b.scheduled_time, b.final_amount, b.notes, b.created_at,
             cu.email AS customer_email, cu.name AS customer_name,
             vu.email AS vendor_email, vp.business_name
      FROM bookings b
      LEFT JOIN users cu ON cu.id = b.customer_id
      LEFT JOIN users vu ON vu.id = b.vendor_id
      LEFT JOIN vendor_profiles vp ON vp.vendor_id = b.vendor_id
      ORDER BY b.created_at DESC
      LIMIT 500
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// Recent activity for admin dashboard
adminRouter.get("/recent-activity", requireRole(["admin"]), async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT id, actor_id, role, action, entity, metadata, created_at
      FROM activity_logs
      ORDER BY created_at DESC
      LIMIT 20
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// ─── Delete user (admin only, cannot delete yourself) ──────────────
adminRouter.delete("/users/:id", requireRole(["admin"]), async (req: AuthRequest, res, next) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.actor?.id) {
      res.status(400).json({ success: false, error: "Cannot delete your own account" });
      return;
    }

    // Check target exists
    const target = await pool.query("SELECT id, email, role FROM users WHERE id = $1", [targetId]);
    if (target.rows.length === 0) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    const targetUser = target.rows[0];

    // Delete related data first (cascade-style)
    await pool.query("DELETE FROM auth_sessions WHERE user_id = $1", [targetId]);
    await pool.query("DELETE FROM user_roles WHERE user_id = $1", [targetId]);
    if (targetUser.role === "vendor") {
      await pool.query("DELETE FROM vendor_profiles WHERE vendor_id = $1", [targetId]);
    }
    await pool.query("DELETE FROM users WHERE id = $1", [targetId]);

    trackActivity({
      actorId: req.actor!.id,
      role: "admin",
      action: "admin.user_deleted",
      entity: "user",
      metadata: { deletedUserId: targetId, deletedEmail: targetUser.email, deletedRole: targetUser.role },
    });

    res.json({ success: true, data: { message: `User ${targetUser.email} deleted` } });
  } catch (err) { next(err); }
});

// ─── Update user role (admin only) ──────────────────────────────
adminRouter.patch("/users/:id/role", requireRole(["admin"]), async (req: AuthRequest, res, next) => {
  try {
    const targetId = req.params.id;
    const parsed = z.object({ role: z.enum(["customer", "vendor", "admin", "employee"]) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.flatten() });
      return;
    }

    if (targetId === req.actor?.id) {
      res.status(400).json({ success: false, error: "Cannot change your own role" });
      return;
    }

    const result = await pool.query(
      "UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1 RETURNING id, email, role, name",
      [targetId, parsed.data.role]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    // Sync user_roles table
    await pool.query("DELETE FROM user_roles WHERE user_id = $1", [targetId]);
    await pool.query(
      "INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id, role) DO NOTHING",
      [targetId, parsed.data.role]
    );

    trackActivity({
      actorId: req.actor!.id,
      role: "admin",
      action: "admin.role_changed",
      entity: "user",
      metadata: { targetId, newRole: parsed.data.role },
    });

    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// ─── Suspend / unsuspend user (admin only) ────────────────────────
adminRouter.patch("/users/:id/suspend", requireRole(["admin"]), async (req: AuthRequest, res, next) => {
  try {
    const targetId = req.params.id;
    const parsed = z.object({ suspended: z.boolean() }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.flatten() });
      return;
    }

    if (targetId === req.actor?.id) {
      res.status(400).json({ success: false, error: "Cannot suspend your own account" });
      return;
    }

    const result = await pool.query(
      "UPDATE users SET suspended = $2, updated_at = NOW() WHERE id = $1 RETURNING id, email, role, name, suspended",
      [targetId, parsed.data.suspended]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    // If suspending, revoke all sessions
    if (parsed.data.suspended) {
      await pool.query("DELETE FROM auth_sessions WHERE user_id = $1", [targetId]);
    }

    trackActivity({
      actorId: req.actor!.id,
      role: "admin",
      action: parsed.data.suspended ? "admin.user_suspended" : "admin.user_unsuspended",
      entity: "user",
      metadata: { targetId },
    });

    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// ─── Create employee/sub-admin (admin only) ───────────────────────
adminRouter.post("/employees", requireRole(["admin"]), async (req: AuthRequest, res, next) => {
  try {
    const parsed = z.object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().min(1),
      phone: z.string().optional(),
      role: z.enum(["employee", "admin"]).default("employee"),
      permissions: z.array(z.string()).optional(),
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.flatten() });
      return;
    }

    // Check email uniqueness for this role
    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1 AND role = $2 LIMIT 1",
      [parsed.data.email, parsed.data.role]
    );
    if (existing.rows.length > 0) {
      res.status(409).json({ success: false, error: `A ${parsed.data.role} with this email already exists` });
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const result = await pool.query(
      `INSERT INTO users (email, role, password_hash, name, phone, verified)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, email, role, name, phone, verified`,
      [parsed.data.email, parsed.data.role, passwordHash, parsed.data.name, parsed.data.phone || null]
    );

    const newUser = result.rows[0];

    // Insert into user_roles
    await pool.query(
      "INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id, role) DO NOTHING",
      [newUser.id, parsed.data.role]
    );

    // Store permissions if provided
    if (parsed.data.permissions && parsed.data.permissions.length > 0) {
      for (const perm of parsed.data.permissions) {
        await pool.query(
          "INSERT INTO employee_permissions (user_id, permission) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [newUser.id, perm]
        );
      }
    }

    trackActivity({
      actorId: req.actor!.id,
      role: "admin",
      action: "admin.employee_created",
      entity: "user",
      metadata: { newUserId: newUser.id, newEmail: parsed.data.email, assignedRole: parsed.data.role },
    });

    res.status(201).json({ success: true, data: newUser });
  } catch (err) { next(err); }
});

// ─── Force cancel/complete booking (admin only) ──────────────────
adminRouter.patch("/bookings/:id/status", requireRole(["admin"]), async (req: AuthRequest, res, next) => {
  try {
    const parsed = z.object({ status: z.enum(["cancelled", "completed"]) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.flatten() });
      return;
    }

    const result = await pool.query(
      "UPDATE bookings SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING id, status, service_name",
      [req.params.id, parsed.data.status]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "Booking not found" });
      return;
    }

    trackActivity({
      actorId: req.actor!.id,
      role: "admin",
      action: `admin.booking_${parsed.data.status}`,
      entity: "booking",
      metadata: { bookingId: req.params.id },
    });

    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});
