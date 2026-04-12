import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireRole, requirePermission, type AuthRequest } from "../../middleware/auth.js";
import { pool } from "../../db/pool.js";
import { trackActivity } from "../activity/activity.service.js";

export const adminRouter = Router();

adminRouter.get("/dashboard", requireRole(["admin", "employee"]), (_req, res) => {
  res.json({
    success: true,
    data: {
      manage: ["vendors", "zones", "services", "bookings", "payments", "users", "employees", "analytics"]
    }
  });
});

// Live platform stats for dashboard cards
adminRouter.get("/stats", requireRole(["admin", "employee"]), async (_req, res, next) => {
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
        totalRevenue: Math.round(Number(revenueR.rows[0].total) / 100),
      },
    });
  } catch (err) { next(err); }
});

// All users list for admin user management
adminRouter.get("/users", requireRole(["admin", "employee"]), requirePermission(["users.view"]), async (req, res, next) => {
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
adminRouter.get("/bookings", requireRole(["admin", "employee"]), requirePermission(["bookings.view"]), async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT b.id, b.customer_id, b.vendor_id, b.service_name, b.status,
             b.scheduled_date, b.scheduled_time, b.final_amount, b.notes, b.created_at,
             b.service_pincode,
             cu.email AS customer_email, cu.name AS customer_name,
             vu.email AS vendor_email, vp.business_name
      FROM bookings b
      LEFT JOIN users cu ON cu.id::text = b.customer_id
      LEFT JOIN users vu ON vu.id::text = b.vendor_id
      LEFT JOIN vendor_profiles vp ON vp.vendor_id = b.vendor_id
      ORDER BY b.created_at DESC
      LIMIT 500
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// Recent activity for admin dashboard
adminRouter.get("/recent-activity", requireRole(["admin", "employee"]), async (_req, res, next) => {
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

    // Prevent suspending admin accounts
    const targetR = await pool.query("SELECT role FROM users WHERE id = $1", [targetId]);
    if (targetR.rows[0]?.role === 'admin' && req.actor?.role !== 'admin') {
      res.status(403).json({ success: false, error: "Only admins can suspend admin accounts" });
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

// ─── Create employee/sub-admin (admin or employee with users.view) ─
adminRouter.post("/employees", requireRole(["admin", "employee"]), requirePermission(["users.view"]), async (req: AuthRequest, res, next) => {
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

    // Employees can only create other employees, not admins/sub-admins
    if (req.actor!.role === "employee" && parsed.data.role !== "employee") {
      res.status(403).json({ success: false, error: "Employees can only create other employees, not sub-admins" });
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

    // If created by employee → not verified (needs admin approval)
    // If created by admin → verified immediately
    const isVerified = req.actor!.role === "admin";

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const result = await pool.query(
      `INSERT INTO users (email, role, password_hash, name, phone, verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, role, name, phone, verified`,
      [parsed.data.email, parsed.data.role, passwordHash, parsed.data.name, parsed.data.phone || null, isVerified]
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
      role: req.actor!.role,
      action: "admin.employee_created",
      entity: "user",
      metadata: {
        newUserId: newUser.id,
        newEmail: parsed.data.email,
        assignedRole: parsed.data.role,
        pendingApproval: !isVerified,
        createdBy: req.actor!.role,
      },
    });

    res.status(201).json({ success: true, data: newUser });
  } catch (err) { next(err); }
});

// ─── Get employee permissions ─────────────────────────────────────
adminRouter.get("/employees/:id/permissions", requireRole(["admin", "employee"]), async (req: AuthRequest, res, next) => {
  try {
    const targetId = req.params.id;

    // Employees can only view their own permissions; admins can view anyone's
    if (req.actor!.role === "employee" && req.actor!.id !== targetId) {
      res.status(403).json({ success: false, error: "Employees can only view their own permissions" });
      return;
    }

    const result = await pool.query<{ permission: string }>(
      "SELECT permission FROM employee_permissions WHERE user_id = $1 ORDER BY permission",
      [targetId]
    );

    res.json({ success: true, data: result.rows.map(r => r.permission) });
  } catch (err) { next(err); }
});

// ─── Update employee permissions (admin only) ─────────────────────
adminRouter.put("/employees/:id/permissions", requireRole(["admin"]), async (req: AuthRequest, res, next) => {
  try {
    const targetId = req.params.id;
    const parsed = z.object({
      permissions: z.array(z.string()),
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.flatten() });
      return;
    }

    // Verify target is an employee
    const target = await pool.query("SELECT id, role, email FROM users WHERE id = $1 LIMIT 1", [targetId]);
    if (target.rows.length === 0) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }
    if (target.rows[0].role !== "employee") {
      res.status(400).json({ success: false, error: "Permissions can only be set for employees" });
      return;
    }

    // Replace all permissions: delete old, insert new
    await pool.query("DELETE FROM employee_permissions WHERE user_id = $1", [targetId]);
    for (const perm of parsed.data.permissions) {
      await pool.query(
        "INSERT INTO employee_permissions (user_id, permission) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [targetId, perm]
      );
    }

    trackActivity({
      actorId: req.actor!.id,
      role: "admin",
      action: "admin.permissions_updated",
      entity: "user",
      metadata: { targetId, permissions: parsed.data.permissions },
    });

    res.json({ success: true, data: { permissions: parsed.data.permissions } });
  } catch (err) { next(err); }
});

// ─── Verify/approve employee (admin only) ─────────────────────────
adminRouter.patch("/employees/:id/verify", requireRole(["admin"]), async (req: AuthRequest, res, next) => {
  try {
    const targetId = req.params.id;

    const result = await pool.query(
      "UPDATE users SET verified = true, updated_at = NOW() WHERE id = $1 AND role IN ('employee', 'admin') RETURNING id, email, role, name, verified",
      [targetId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "Employee not found" });
      return;
    }

    trackActivity({
      actorId: req.actor!.id,
      role: "admin",
      action: "admin.employee_verified",
      entity: "user",
      metadata: { targetId, email: result.rows[0].email },
    });

    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// ─── Get current user's permissions (for frontend sidebar gating) ─
adminRouter.get("/me/permissions", requireRole(["admin", "employee"]), async (req: AuthRequest, res, next) => {
  try {
    // Admin gets all permissions
    if (req.actor!.role === "admin") {
      res.json({
        success: true,
        data: {
          role: "admin",
          permissions: ["*"],
          verified: true,
        },
      });
      return;
    }

    // Check if employee is verified
    const userResult = await pool.query<{ verified: boolean }>(
      "SELECT verified FROM users WHERE id = $1 LIMIT 1",
      [req.actor!.id]
    );

    const result = await pool.query<{ permission: string }>(
      "SELECT permission FROM employee_permissions WHERE user_id = $1 ORDER BY permission",
      [req.actor!.id]
    );

    res.json({
      success: true,
      data: {
        role: "employee",
        permissions: result.rows.map(r => r.permission),
        verified: userResult.rows[0]?.verified ?? false,
      },
    });
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

// ─── OTP events: view count + cleanup (admin only) ────────────────
adminRouter.get("/otp-events", requireRole(["admin"]), async (_req, res, next) => {
  try {
    const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const countResult = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM otp_events WHERE channel = 'phone_sms' AND created_at >= $1",
      [windowStart]
    );
    const totalResult = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM otp_events WHERE channel = 'phone_sms'"
    );
    res.json({
      success: true,
      data: {
        last24h: parseInt(countResult.rows[0]?.count ?? "0", 10),
        total: parseInt(totalResult.rows[0]?.count ?? "0", 10),
        windowStart,
      },
    });
  } catch (err) { next(err); }
});

adminRouter.delete("/otp-events", requireRole(["admin"]), async (req: AuthRequest, res, next) => {
  try {
    const result = await pool.query("DELETE FROM otp_events WHERE channel = 'phone_sms' RETURNING id");
    trackActivity({
      actorId: req.actor!.id,
      role: "admin",
      action: "admin.otp_events_cleared",
      entity: "otp_events",
      metadata: { deletedCount: result.rowCount },
    });
    res.json({ success: true, data: { deleted: result.rowCount } });
  } catch (err) { next(err); }
});
