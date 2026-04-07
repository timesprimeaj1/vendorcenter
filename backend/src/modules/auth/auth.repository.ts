import { pool } from "../../db/pool.js";
import { AppRole } from "../../shared/types.js";

export interface DbUser {
  id: string;
  email: string | null;
  role: AppRole;
  password_hash: string | null;
  name: string | null;
  phone: string | null;
  business_name: string | null;
  profile_picture_url: string | null;
  verified: boolean;
  firebase_uid: string | null;
  auth_provider: string;
  suspended: boolean;
}

export async function findUserByEmail(email: string, role?: AppRole) {
  if (role) {
    const result = await pool.query<DbUser>(
      "SELECT id, email, role, password_hash, name, phone, business_name, profile_picture_url, verified, firebase_uid, auth_provider, COALESCE(suspended, false) AS suspended FROM users WHERE email = $1 AND role = $2 LIMIT 1",
      [email, role]
    );
    return result.rows[0] ?? null;
  }
  const result = await pool.query<DbUser>(
    "SELECT id, email, role, password_hash, name, phone, business_name, profile_picture_url, verified, firebase_uid, auth_provider, COALESCE(suspended, false) AS suspended FROM users WHERE email = $1 LIMIT 1",
    [email]
  );
  return result.rows[0] ?? null;
}

export async function findUserById(id: string) {
  const result = await pool.query<DbUser>(
    "SELECT id, email, role, password_hash, name, phone, business_name, profile_picture_url, verified, firebase_uid, auth_provider, COALESCE(suspended, false) AS suspended FROM users WHERE id = $1 LIMIT 1",
    [id]
  );
  return result.rows[0] ?? null;
}

export async function createUser(input: { email: string; role: AppRole; passwordHash: string; name?: string; phone?: string; businessName?: string }) {
  const result = await pool.query<DbUser>(
    "INSERT INTO users (email, role, password_hash, name, phone, business_name) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, role, name, phone, business_name, verified",
    [input.email, input.role, input.passwordHash, input.name || null, input.phone || null, input.businessName || null]
  );
  return result.rows[0];
}

export async function markUserVerified(email: string) {
  await pool.query("UPDATE users SET verified = true, updated_at = NOW() WHERE email = $1", [email]);
}

export async function updatePassword(email: string, passwordHash: string) {
  await pool.query("UPDATE users SET password_hash = $2, updated_at = NOW() WHERE email = $1", [email, passwordHash]);
}

export async function updateUserProfile(id: string, input: { name?: string; phone?: string; profilePictureUrl?: string }) {
  const result = await pool.query<DbUser>(
    `UPDATE users SET name = COALESCE($2, name), phone = COALESCE($3, phone), profile_picture_url = COALESCE($4, profile_picture_url), updated_at = NOW()
     WHERE id = $1
     RETURNING id, email, role, name, phone, business_name, profile_picture_url, verified`,
    [id, input.name ?? null, input.phone ?? null, input.profilePictureUrl ?? null]
  );
  return result.rows[0] ?? null;
}

export async function createSession(input: { userId: string; refreshTokenHash: string; expiresAt: Date; userAgent?: string; ipAddress?: string }) {
  await pool.query(
    "INSERT INTO auth_sessions (user_id, refresh_token_hash, expires_at, user_agent, ip_address) VALUES ($1, $2, $3, $4, $5)",
    [input.userId, input.refreshTokenHash, input.expiresAt, input.userAgent ?? null, input.ipAddress ?? null]
  );
}

// ─── Phone Auth ───────────────────────────────────

export async function findUserByPhone(phone: string, role?: AppRole) {
  if (role) {
    const result = await pool.query<DbUser>(
      "SELECT id, email, role, password_hash, name, phone, business_name, profile_picture_url, verified, firebase_uid, auth_provider, COALESCE(suspended, false) AS suspended FROM users WHERE phone = $1 AND role = $2 LIMIT 1",
      [phone, role]
    );
    return result.rows[0] ?? null;
  }
  const result = await pool.query<DbUser>(
    "SELECT id, email, role, password_hash, name, phone, business_name, profile_picture_url, verified, firebase_uid, auth_provider, COALESCE(suspended, false) AS suspended FROM users WHERE phone = $1 LIMIT 1",
    [phone]
  );
  return result.rows[0] ?? null;
}

export async function findUserByFirebaseUid(firebaseUid: string, role?: AppRole) {
  if (role) {
    const result = await pool.query<DbUser>(
      "SELECT id, email, role, password_hash, name, phone, business_name, profile_picture_url, verified, firebase_uid, auth_provider, COALESCE(suspended, false) AS suspended FROM users WHERE firebase_uid = $1 AND role = $2 LIMIT 1",
      [firebaseUid, role]
    );
    return result.rows[0] ?? null;
  }
  const result = await pool.query<DbUser>(
    "SELECT id, email, role, password_hash, name, phone, business_name, profile_picture_url, verified, firebase_uid, auth_provider, COALESCE(suspended, false) AS suspended FROM users WHERE firebase_uid = $1 LIMIT 1",
    [firebaseUid]
  );
  return result.rows[0] ?? null;
}

export async function createPhoneUser(input: { phone: string; firebaseUid: string; role: AppRole; name?: string }) {
  const result = await pool.query<DbUser>(
    `INSERT INTO users (phone, firebase_uid, role, name, verified, auth_provider, phone_verified_at)
     VALUES ($1, $2, $3, $4, true, 'phone', NOW())
     RETURNING id, email, role, name, phone, business_name, profile_picture_url, verified, firebase_uid, auth_provider`,
    [input.phone, input.firebaseUid, input.role, input.name || null]
  );
  const user = result.rows[0];
  // Also insert into user_roles
  await pool.query(
    "INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id, role) DO NOTHING",
    [user.id, input.role]
  );
  return user;
}

export async function linkFirebaseUid(userId: string, firebaseUid: string) {
  await pool.query(
    "UPDATE users SET firebase_uid = $2, auth_provider = 'phone', phone_verified_at = NOW(), updated_at = NOW() WHERE id = $1",
    [userId, firebaseUid]
  );
}

export async function addUserRole(userId: string, role: AppRole) {
  await pool.query(
    "INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id, role) DO NOTHING",
    [userId, role]
  );
}

export async function getUserRoles(userId: string): Promise<AppRole[]> {
  const result = await pool.query<{ role: AppRole }>(
    "SELECT role FROM user_roles WHERE user_id = $1",
    [userId]
  );
  return result.rows.map(r => r.role);
}
