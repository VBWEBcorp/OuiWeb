import axios from "axios";
import crypto from "node:crypto";
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

export function authUrl(accountId: string): string {
  const state = crypto.randomBytes(12).toString("hex");
  stateStore.set(state, { accountId, ts: Date.now() });
  for (const [k, v] of stateStore) if (Date.now() - v.ts > 600_000) stateStore.delete(k);

  if (isMockMode()) {
    // Point to our own mock callback that auto-connects the account.
    const port = process.env.PORT || 8787;
    const base = process.env.APP_URL?.includes(":5173")
      ? `http://localhost:${port}`
      : process.env.APP_URL || `http://localhost:${port}`;
    return `${base}/api/linkedin/mock-callback?accountId=${encodeURIComponent(accountId)}&state=${state}`;
  }

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
  const entry = stateStore.get(state);
  if (!entry || entry.accountId !== accountId) throw new Error("State invalide");
  stateStore.delete(state);
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
  const tokResp = await axios.post(TOKEN_URL, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  const access_token: string = tokResp.data.access_token;
  const expires_in: number = tokResp.data.expires_in;
  const refresh_token: string | undefined = tokResp.data.refresh_token;

  const userInfo = await axios.get("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
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
  const body: any = {
    author: account.linkedinUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: content },
        shareMediaCategory: media.length === 0 ? "NONE" : (media[0].kind === "video" ? "VIDEO" : media[0].kind === "link" ? "ARTICLE" : "IMAGE"),
        media: media.length === 0 ? undefined : media.map((m) => ({
          status: "READY",
          originalUrl: m.url,
          description: { text: "" },
          title: { text: "" },
        })),
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };
  const r = await axios.post(`${API}/ugcPosts`, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    },
  });
  return r.headers["x-restli-id"] || r.data.id;
}
