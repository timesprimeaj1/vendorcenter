import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env"), override: true });

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  appName: process.env.APP_NAME ?? "VendorCenter",
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  apiUrl: process.env.API_URL ?? "http://localhost:4000",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? "change_me_access",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? "change_me_refresh",
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES ?? "15m",
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES ?? "7d",
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  emailFromNoreply: process.env.EMAIL_FROM_NOREPLY ?? "noreply@vendorcenter.in",
  emailTransportMode: process.env.EMAIL_TRANSPORT_MODE ?? "mock",
  otpLength: Number(process.env.OTP_LENGTH ?? 6),
  otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES ?? 5),
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),
  corsOrigins: process.env.CORS_ORIGINS ?? "*",
  emailFromDomain: process.env.EMAIL_FROM_DOMAIN ?? "vendorcenter.in",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY ?? "",
  s3Bucket: process.env.S3_BUCKET ?? "vendorcenter-media"
};
