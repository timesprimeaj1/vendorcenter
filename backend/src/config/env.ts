import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({
  path: path.resolve(__dirname, "../../../.env"),
  override: true
});

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
  brevoApiKey: process.env.BREVO_API_KEY ?? "",

  emailFromNoreply:
    process.env.EMAIL_FROM_NOREPLY ?? "noreply@vendorcenter.in",

  emailTransportMode:
    process.env.EMAIL_TRANSPORT_MODE ?? "mock",

  otpLength: Number(process.env.OTP_LENGTH ?? 6),
  otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES ?? 5),
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),

  corsOrigins: process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:3001,http://localhost:4173,http://localhost:5173",
  securityStrictMode: process.env.SECURITY_STRICT_MODE === "true",

  emailFromDomain:
    process.env.EMAIL_FROM_DOMAIN ?? "vendorcenter.in",

  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceKey:
    process.env.SUPABASE_SERVICE_KEY ?? "",

  s3Bucket:
    process.env.S3_BUCKET ?? "vendorcenter-media",

  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiApiKeys: (process.env.GEMINI_API_KEYS ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean),
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  groqModel: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
  groqBaseUrl: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",

  selfHostedLlmUrl: process.env.SELF_HOSTED_LLM_URL ?? "",
  selfHostedLlmModel: process.env.SELF_HOSTED_LLM_MODEL ?? "vendorcenter-3b",
};

const DEFAULT_ACCESS_SECRET = "change_me_access";
const DEFAULT_REFRESH_SECRET = "change_me_refresh";

export function getSecurityConfigStatus() {
  const usingDefaultAccessSecret = env.jwtAccessSecret === DEFAULT_ACCESS_SECRET;
  const usingDefaultRefreshSecret = env.jwtRefreshSecret === DEFAULT_REFRESH_SECRET;
  const corsWildcard = env.corsOrigins.trim() === "*";

  return {
    usingDefaultAccessSecret,
    usingDefaultRefreshSecret,
    corsWildcard,
    strictModeEnabled: env.securityStrictMode,
  };
}