import { env } from "../config/env.js";
import crypto from "crypto";
import path from "path";

const isStorageConfigured = Boolean(env.supabaseUrl && env.supabaseServiceKey);

export function useCloudStorage(): boolean {
  return isStorageConfigured && env.nodeEnv === "production";
}

export async function uploadToCloud(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<string> {
  if (!isStorageConfigured) throw new Error("Supabase Storage not configured");

  const ext = path.extname(originalName);
  const key = `uploads/${crypto.randomBytes(16).toString("hex")}${ext}`;

  const res = await fetch(
    `${env.supabaseUrl}/storage/v1/object/${env.s3Bucket}/${key}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.supabaseServiceKey}`,
        "Content-Type": mimeType,
      },
      body: new Uint8Array(fileBuffer),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Upload failed: ${res.status} ${body}`);
  }

  // Return the public URL
  return `${env.supabaseUrl}/storage/v1/object/public/${env.s3Bucket}/${key}`;
}
