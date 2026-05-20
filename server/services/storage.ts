/**
 * Media storage abstraction.
 *
 * Uses Cloudflare R2 (S3-compatible) when fully configured, otherwise falls
 * back to local disk (`data/uploads/`) served by Express via `/media/:filename`.
 * The frontend doesn't care — it just receives a URL.
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "node:fs";
import path from "node:path";

function r2Enabled(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_PUBLIC_URL
  );
}

let client: S3Client | null = null;
function getClient(): S3Client | null {
  if (!r2Enabled()) return null;
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
    console.log("[storage] ✓ Cloudflare R2 enabled (" + process.env.R2_BUCKET_NAME + ")");
  }
  return client;
}

/**
 * Uploads a buffer and returns the public URL.
 * `key` is the filename (e.g. "abc.jpg"), without prefix.
 */
export async function uploadMedia(buffer: Buffer, key: string, mime: string): Promise<string> {
  const c = getClient();
  if (c && r2Enabled()) {
    const prefix = (process.env.R2_PREFIX || "linkflow").replace(/\/+$/, "");
    const fullKey = prefix ? `${prefix}/${key}` : key;
    await c.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: fullKey,
      Body: buffer,
      ContentType: mime,
      CacheControl: "public, max-age=31536000, immutable",
    }));
    const base = process.env.R2_PUBLIC_URL!.replace(/\/+$/, "");
    return `${base}/${fullKey}`;
  }
  // Fallback : local FS (dev sans R2)
  const dir = path.resolve(process.cwd(), "data", "uploads");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, key), buffer);
  return `/media/${key}`;
}

export function storageStatus() {
  if (r2Enabled()) {
    return {
      provider: "r2" as const,
      bucket: process.env.R2_BUCKET_NAME,
      publicUrl: process.env.R2_PUBLIC_URL,
    };
  }
  return { provider: "local" as const };
}
