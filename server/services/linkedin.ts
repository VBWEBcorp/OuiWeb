import axios from "axios";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db } from "../db/store";
import { encrypt, decrypt } from "../lib/crypto";

const AUTH_URL  = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const API       = "https://api.linkedin.com/v2";

const SCOPES = ["openid", "profile", "email", "w_member_social"].join(" ");

const stateStore = new Map<string, { accountId: string; ts: number }>();

/**
 * Mock LinkedIn mode = enabled when LINKEDIN_CLIENT_ID is empty or
 * LINKEDIN_MOCK=1 is set.  Lets the team test the entire UX (connect,
 * publish, scheduler) without provisioning a real LinkedIn Dev App.
 */
function isMockMode(): boolean {
  return !process.env.LINKEDIN_CLIENT_ID || process.env.LINKEDIN_MOCK === "1";
}

/** Signed mock state — stateless, survives serverless cold starts. */
function signMockState(accountId: string): string {
  const ts = Date.now();
  const payload = `${accountId}.${ts}`;
  const key = process.env.TOKEN_ENC_KEY || "fallback";
  const sig = crypto.createHmac("sha256", key).update(payload).digest("hex").slice(0, 16);
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}
function verifyMockState(state: string, accountId: string): boolean {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const [aid, tsStr, sig] = decoded.split(".");
    if (aid !== accountId) return false;
    if (Date.now() - Number(tsStr) > 10 * 60_000) return false; // 10 min TTL
    const key = process.env.TOKEN_ENC_KEY || "fallback";
    const expect = crypto.createHmac("sha256", key).update(`${aid}.${tsStr}`).digest("hex").slice(0, 16);
    return sig === expect;
  } catch { return false; }
}

/** Build "{protocol}://{host}" from an Express request. */
function originFromReq(req: any): string {
  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || req.protocol || "http";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers["host"] || `localhost:${process.env.PORT || 8787}`;
  return `${proto}://${host}`;
}

/**
 * Builds the authorize URL. For mock mode, the callback URL is on our own
 * domain (derived from the incoming request) and the state is a signed token.
 */
export function authUrl(accountId: string, req?: any): string {
  if (isMockMode()) {
    const state = signMockState(accountId);
    const base = req ? originFromReq(req) : (process.env.APP_URL || `http://localhost:${process.env.PORT || 8787}`);
    return `${base}/api/linkedin/mock-callback?accountId=${encodeURIComponent(accountId)}&state=${state}`;
  }

  const state = crypto.randomBytes(12).toString("hex");
  stateStore.set(state, { accountId, ts: Date.now() });
  for (const [k, v] of stateStore) if (Date.now() - v.ts > 600_000) stateStore.delete(k);

  const clientId = process.env.LINKEDIN_CLIENT_ID!;
  const redirect = process.env.LINKEDIN_REDIRECT_URI;
  if (!redirect) throw new Error("LINKEDIN_REDIRECT_URI manquante");
  const u = new URL(AUTH_URL);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirect);
  u.searchParams.set("state", state);
  u.searchParams.set("scope", SCOPES);
  return u.toString();
}

/** Auto-connect an account with fake credentials — used in mock mode only. */
export async function mockConnect(accountId: string, state: string) {
  if (!verifyMockState(state, accountId)) throw new Error("State invalide");
  const fakeSub = crypto.randomBytes(8).toString("hex");
  const urn = `urn:li:mock:${fakeSub}`;
  await db.updateAccount(accountId, {
    connected: true,
    linkedinUrn: urn,
    accessTokenEnc: encrypt(`mock-token-${fakeSub}`),
    refreshTokenEnc: null,
    tokenExpiresAt: new Date(Date.now() + 60 * 60 * 24 * 30 * 1000).toISOString(),
  });
  return { urn };
}

/** Extracts the OAuth-specific error_description from an axios error so we can
 *  surface a human-readable message instead of "Request failed with status code 401". */
function describeOAuthError(err: any): Error {
  const r = err?.response;
  const status = r?.status;
  const data = r?.data;
  const code = data?.error || data?.serviceErrorCode || "linkedin_error";
  const desc = data?.error_description || data?.message || err?.message || "unknown";
  return new Error(`[${status || "?"} ${code}] ${desc}`);
}

export async function exchangeCode(code: string, state: string) {
  const entry = stateStore.get(state);
  if (!entry) throw new Error("State invalide ou expiré");
  stateStore.delete(state);
  const clientId = process.env.LINKEDIN_CLIENT_ID!;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!;
  const redirect = process.env.LINKEDIN_REDIRECT_URI!;
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect,
  });

  let tokResp;
  try {
    tokResp = await axios.post(TOKEN_URL, params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  } catch (err: any) {
    throw describeOAuthError(err);
  }
  const access_token: string = tokResp.data.access_token;
  const expires_in: number = tokResp.data.expires_in;
  const refresh_token: string | undefined = tokResp.data.refresh_token;

  let userInfo;
  try {
    userInfo = await axios.get("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
  } catch (err: any) {
    throw describeOAuthError(err);
  }
  const sub: string = userInfo.data.sub;
  const urn = `urn:li:person:${sub}`;

  await db.updateAccount(entry.accountId, {
    connected: true,
    linkedinUrn: urn,
    accessTokenEnc: encrypt(access_token),
    refreshTokenEnc: refresh_token ? encrypt(refresh_token) : null,
    tokenExpiresAt: new Date(Date.now() + expires_in * 1000).toISOString(),
  });

  return { accountId: entry.accountId, urn };
}

/** Loads the raw bytes (+ mime) of a media item, whether stored on R2 (http URL)
 *  or on the local disk fallback (`/media/<file>` → data/uploads/<file>). */
async function loadMediaBytes(url: string): Promise<{ buffer: Buffer; mime: string }> {
  if (/^https?:\/\//i.test(url)) {
    const resp = await axios.get(url, { responseType: "arraybuffer" });
    const mime = String(resp.headers["content-type"] || "application/octet-stream").split(";")[0];
    return { buffer: Buffer.from(resp.data), mime };
  }
  // Local fallback: "/media/<filename>"
  const filename = url.replace(/^\/media\//, "");
  const file = path.resolve(process.cwd(), "data", "uploads", filename);
  const buffer = fs.readFileSync(file);
  const ext = path.extname(file).toLowerCase();
  const mimeByExt: Record<string, string> = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif",
    ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm",
  };
  return { buffer, mime: mimeByExt[ext] || "application/octet-stream" };
}

/**
 * Registers and uploads a single image/video to LinkedIn, returning its
 * `urn:li:digitalmediaAsset:…` URN. LinkedIn does NOT accept arbitrary external
 * image URLs in a UGC post — binary media must go through this 3-step flow:
 * registerUpload → PUT bytes to the returned uploadUrl → reference the asset URN.
 */
async function uploadAsset(token: string, ownerUrn: string, kind: "image" | "video", url: string): Promise<string> {
  const recipe = kind === "video"
    ? "urn:li:digitalmediaRecipe:feedshare-video"
    : "urn:li:digitalmediaRecipe:feedshare-image";

  const register = await axios.post(
    `${API}/assets?action=registerUpload`,
    {
      registerUploadRequest: {
        recipes: [recipe],
        owner: ownerUrn,
        serviceRelationships: [
          { relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" },
        ],
      },
    },
    { headers: { Authorization: `Bearer ${token}`, "X-Restli-Protocol-Version": "2.0.0", "Content-Type": "application/json" } },
  );

  const asset: string = register.data.value.asset;
  const uploadUrl: string =
    register.data.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;

  const { buffer, mime } = await loadMediaBytes(url);
  await axios.put(uploadUrl, buffer, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": mime },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  // Video is processed asynchronously by LinkedIn — referencing the asset in a
  // post before it's AVAILABLE makes the post fail. Images are ready immediately.
  if (kind === "video") {
    await waitForAsset(token, asset);
  }

  return asset;
}

/** Polls an asset until LinkedIn finishes processing it (or throws on timeout/error). */
async function waitForAsset(token: string, assetUrn: string, timeoutMs = 90_000): Promise<void> {
  const id = assetUrn.split(":").pop();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await axios.get(`${API}/assets/${id}`, {
      headers: { Authorization: `Bearer ${token}`, "X-Restli-Protocol-Version": "2.0.0" },
    });
    const statuses: string[] = (r.data.recipes || []).map((x: any) => x.status);
    if (statuses.includes("AVAILABLE")) return;
    if (statuses.some((s) => s === "CLIENT_ERROR" || s === "SERVER_ERROR")) {
      throw new Error("LinkedIn n'a pas pu traiter la vidéo (format ou durée non supportés ?)");
    }
    await new Promise((res) => setTimeout(res, 3000));
  }
  throw new Error("Traitement de la vidéo trop long côté LinkedIn — réessaie dans quelques minutes.");
}

export async function publishPost(accountId: string, content: string, media: { kind: string; url: string }[] = []) {
  const account = await db.account(accountId);
  if (!account) throw new Error("Compte introuvable");
  if (!account.connected || !account.accessTokenEnc || !account.linkedinUrn) {
    throw new Error("Compte LinkedIn non connecté");
  }

  // ── Mock path : simulate a successful publish (for dev / demo) ──
  if (account.linkedinUrn.startsWith("urn:li:mock:")) {
    await new Promise((r) => setTimeout(r, 1200 + Math.random() * 600));
    const fakeId = `urn:li:share:MOCK-${crypto.randomBytes(6).toString("hex")}`;
    console.log(`[linkedin:mock] ✓ Publication simulée → ${fakeId} · ${content.slice(0, 60)}…`);
    return fakeId;
  }

  // ── Real LinkedIn path ──
  const token = decrypt(account.accessTokenEnc);
  const owner = account.linkedinUrn;

  // Determine the share category from the first media item (LinkedIn can't mix categories).
  const first = media[0];
  const category = !first ? "NONE" : (first.kind === "video" ? "VIDEO" : first.kind === "link" ? "ARTICLE" : "IMAGE");

  let shareMedia: any[] | undefined;
  try {
    if (category === "IMAGE") {
      const images = media.filter((m) => m.kind === "image");
      const assets = await Promise.all(images.map((m) => uploadAsset(token, owner, "image", m.url)));
      shareMedia = assets.map((asset) => ({ status: "READY", media: asset, description: { text: "" }, title: { text: "" } }));
    } else if (category === "VIDEO") {
      const asset = await uploadAsset(token, owner, "video", first.url);
      shareMedia = [{ status: "READY", media: asset, description: { text: "" }, title: { text: "" } }];
    } else if (category === "ARTICLE") {
      // Links keep using originalUrl — that's the one case the field is valid for.
      shareMedia = [{ status: "READY", originalUrl: first.url, description: { text: "" }, title: { text: "" } }];
    }
  } catch (err: any) {
    throw describeOAuthError(err);
  }

  const body: any = {
    author: owner,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: content },
        shareMediaCategory: category,
        ...(shareMedia ? { media: shareMedia } : {}),
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };

  try {
    const r = await axios.post(`${API}/ugcPosts`, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Type": "application/json",
      },
    });
    return r.headers["x-restli-id"] || r.data.id;
  } catch (err: any) {
    throw describeOAuthError(err);
  }
}
