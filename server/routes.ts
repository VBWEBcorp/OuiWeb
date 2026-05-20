/**
 * Shared route handlers — consumed by both the Express dev server
 * and the Netlify Functions in /netlify/functions.
 */
import { Router } from "express";
import multer from "multer";
import { db, connect } from "./db/store";
import { generateVariants, improveText, hashtags, hooks } from "./services/deepseek";
import { authUrl, exchangeCode, publishPost, mockConnect } from "./services/linkedin";
import { uploadMedia, storageStatus } from "./services/storage";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const LINKEDIN_LIMITS = {
  image: { mimes: ["image/jpeg", "image/png", "image/gif"], maxBytes: 100 * 1024 * 1024 },
  video: { mimes: ["video/mp4", "video/quicktime", "video/x-m4v"], maxBytes: 200 * 1024 * 1024 },
};

/** Parse OUIWEB_DEMO_PASSWORDS once at module load. */
function parsePasswords(): Record<string, string[]> {
  const raw = process.env.OUIWEB_DEMO_PASSWORDS || "vbweb:demo|ouibo:demo";
  const map: Record<string, string[]> = {};
  raw.split("|").forEach((chunk) => {
    const [tid, list] = chunk.split(":");
    if (tid && list) map[tid.trim()] = list.split(",").map((s) => s.trim()).filter(Boolean);
  });
  return map;
}
const PASSWORDS = parsePasswords();

/** Email → tenant resolution (kept in sync with frontend logic for UX hints). */
function resolveTenant(email: string): "vbweb" | "ouibo" | null {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  if (e.endsWith("@vbweb.fr") || e.includes("victor")) return "vbweb";
  if (e.endsWith("@ouibo.fr") || e.includes("yannick") || e.includes("ouibo")) return "ouibo";
  return null;
}

export function buildRouter() {
  const r = Router();

  r.use(async (_req, _res, next) => { await connect(); next(); });

  /* ─── Auth — login with tenant-scoped password ─── */
  r.post("/auth/login", (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email et mot de passe requis" });
    const tid = resolveTenant(String(email));
    if (!tid) return res.status(401).json({ error: "Email non reconnu" });
    const allowed = PASSWORDS[tid] || [];
    if (!allowed.includes(String(password))) {
      return res.status(401).json({ error: "Mot de passe incorrect" });
    }
    res.json({ ok: true, tenantId: tid });
  });

  /**
   * Returns the tenant on the request (header) and asserts that the given
   * accountId belongs to it. Used by every endpoint that reads/writes data
   * scoped to an account, to prevent cross-tenant data leaks.
   */
  async function assertAccountInTenant(req: any, accountId: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
    const tenantId = req.header("x-tenant-id") || req.query?.tenantId;
    if (!tenantId) return { ok: false, status: 400, error: "Tenant manquant" };
    const acc = await db.account(accountId);
    if (!acc) return { ok: false, status: 404, error: "Compte introuvable" };
    if (acc.tenantId !== tenantId) return { ok: false, status: 403, error: "Ce compte ne fait pas partie de ton espace" };
    return { ok: true };
  }
  async function assertPostInTenant(req: any, postId: string) {
    const tenantId = req.header("x-tenant-id") || req.query?.tenantId;
    if (!tenantId) return { ok: false as const, status: 400, error: "Tenant manquant" };
    const p = await db.post(postId);
    if (!p) return { ok: false as const, status: 404, error: "Post introuvable" };
    const acc = await db.account(p.accountId);
    if (!acc || acc.tenantId !== tenantId) {
      return { ok: false as const, status: 403, error: "Ce post ne fait pas partie de ton espace" };
    }
    return { ok: true as const, post: p };
  }

  /* ─── Accounts & Persona ─── */
  r.get("/accounts", async (req, res) => {
    const tenantId = (req.header("x-tenant-id") || String(req.query.tenantId || "")) || undefined;
    const list = await db.accounts(tenantId);
    res.json(list.map(({ accessTokenEnc, refreshTokenEnc, ...rest }) => rest));
  });

  r.get("/accounts/:id/persona", async (req, res) => {
    const g = await assertAccountInTenant(req, req.params.id);
    if (!g.ok) return res.status(g.status).json({ error: g.error });
    const p = await db.persona(req.params.id);
    res.json(p || { accountId: req.params.id });
  });

  r.put("/accounts/:id/persona", async (req, res) => {
    const g = await assertAccountInTenant(req, req.params.id);
    if (!g.ok) return res.status(g.status).json({ error: g.error });
    const p = await db.upsertPersona(req.params.id, req.body || {});
    res.json(p);
  });

  /* Disconnect a LinkedIn account (revokes our stored token) */
  r.delete("/accounts/:id/linkedin", async (req, res) => {
    const g = await assertAccountInTenant(req, req.params.id);
    if (!g.ok) return res.status(g.status).json({ error: g.error });
    const updated = await db.updateAccount(req.params.id, {
      connected: false,
      linkedinUrn: null,
      accessTokenEnc: null,
      refreshTokenEnc: null,
      tokenExpiresAt: null,
    });
    res.json({ ok: true, account: updated });
  });

  /* ─── Posts ─── */
  r.get("/posts", async (req, res) => {
    const accountId = String(req.query.accountId || "");
    if (!accountId) return res.status(400).json({ error: "accountId requis" });
    const g = await assertAccountInTenant(req, accountId);
    if (!g.ok) return res.status(g.status).json({ error: g.error });
    const status = req.query.status ? String(req.query.status) : undefined;
    res.json(await db.posts(accountId, status));
  });

  r.get("/posts/:id", async (req, res) => {
    const g = await assertPostInTenant(req, req.params.id);
    if (!g.ok) return res.status(g.status).json({ error: g.error });
    res.json(g.post);
  });

  r.post("/posts", async (req, res) => {
    const b = req.body || {};
    if (!b.accountId) return res.status(400).json({ error: "accountId requis" });
    const g = await assertAccountInTenant(req, b.accountId);
    if (!g.ok) return res.status(g.status).json({ error: g.error });
    const post = await db.createPost({
      accountId: b.accountId,
      content: b.content || "",
      type: b.type || "storytelling",
      tone: b.tone || "professional",
      status: b.status || "draft",
      scheduledAt: b.scheduledAt || null,
      publishedAt: null,
      linkedinPostId: null,
      media: b.media || [],
      error: null,
    });
    res.json(post);
  });

  r.put("/posts/:id", async (req, res) => {
    const g = await assertPostInTenant(req, req.params.id);
    if (!g.ok) return res.status(g.status).json({ error: g.error });
    const p = await db.updatePost(req.params.id, req.body || {});
    if (!p) return res.status(404).json({ error: "Post introuvable" });
    res.json(p);
  });

  r.delete("/posts/:id", async (req, res) => {
    const g = await assertPostInTenant(req, req.params.id);
    if (!g.ok) return res.status(g.status).json({ error: g.error });
    await db.deletePost(req.params.id);
    res.json({ ok: true });
  });

  r.post("/posts/:id/schedule", async (req, res) => {
    const g = await assertPostInTenant(req, req.params.id);
    if (!g.ok) return res.status(g.status).json({ error: g.error });
    const { scheduledAt } = req.body || {};
    if (!scheduledAt) return res.status(400).json({ error: "scheduledAt requis" });
    // Block scheduling if the LinkedIn account isn't connected (would silently fail later)
    const acc = await db.account(g.post.accountId);
    if (!acc?.connected) {
      return res.status(412).json({ error: "Compte LinkedIn non connecté — connecte-le avant de programmer" });
    }
    const p = await db.updatePost(req.params.id, { status: "scheduled", scheduledAt, error: null });
    res.json(p);
  });

  r.post("/posts/:id/publish", async (req, res) => {
    const g = await assertPostInTenant(req, req.params.id);
    if (!g.ok) return res.status(g.status).json({ error: g.error });
    const post = g.post;
    const acc = await db.account(post.accountId);
    if (!acc?.connected) {
      return res.status(412).json({ error: "Compte LinkedIn non connecté — connecte-le avant de publier" });
    }
    try {
      const linkedinPostId = await publishPost(post.accountId, post.content, post.media);
      const updated = await db.updatePost(post._id, {
        status: "published",
        publishedAt: new Date().toISOString(),
        linkedinPostId,
        error: null,
      });
      res.json(updated);
    } catch (e: any) {
      await db.updatePost(post._id, { status: "failed", error: e.message });
      res.status(502).json({ error: e.message });
    }
  });

  /* ─── AI ─── */
  r.post("/ai/generate", async (req, res) => {
    try {
      const { accountId } = req.body || {};
      if (accountId) {
        const g = await assertAccountInTenant(req, accountId);
        if (!g.ok) return res.status(g.status).json({ error: g.error });
      }
      const out = await generateVariants(req.body || {});
      res.json(out);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  r.post("/ai/improve", async (req, res) => {
    try {
      const { text, accountId, mode } = req.body || {};
      if (accountId) {
        const g = await assertAccountInTenant(req, accountId);
        if (!g.ok) return res.status(g.status).json({ error: g.error });
      }
      res.json(await improveText(text, accountId, mode));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  r.post("/ai/hashtags", async (req, res) => {
    try { res.json(await hashtags(req.body?.text || "")); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  r.post("/ai/hooks", async (req, res) => {
    try { res.json(await hooks(req.body?.topic || "")); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  /* ─── LinkedIn OAuth ─── */
  r.get("/linkedin/status", (_req, res) => {
    const mock = !process.env.LINKEDIN_CLIENT_ID || process.env.LINKEDIN_MOCK === "1";
    res.json({ mock });
  });

  r.get("/linkedin/authorize", async (req, res) => {
    try {
      const accountId = String(req.query.accountId || "");
      if (!accountId) return res.status(400).json({ error: "accountId requis" });
      const g = await assertAccountInTenant(req, accountId);
      if (!g.ok) return res.status(g.status).json({ error: g.error });
      const url = authUrl(accountId);
      const mock = !process.env.LINKEDIN_CLIENT_ID || process.env.LINKEDIN_MOCK === "1";
      res.json({ url, mock });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  /* Mock callback : auto-connects an account without real OAuth */
  r.get("/linkedin/mock-callback", async (req, res) => {
    try {
      const accountId = String(req.query.accountId || "");
      const state = String(req.query.state || "");
      await mockConnect(accountId, state);
      res.send(`<html><body style="background:#0a0a0b;color:#fff;font-family:system-ui;display:grid;place-items:center;height:100vh;text-align:center;">
        <div>
          <div style="font-size:48px;margin-bottom:8px">🧪</div>
          <h2 style="margin:0">Mode démo LinkedIn</h2>
          <p style="opacity:.7;margin-top:8px">Connexion simulée — pour brancher vraiment LinkedIn,<br/>configure <code>LINKEDIN_CLIENT_ID</code> dans .env.</p>
        </div>
        <script>setTimeout(()=>window.close(), 1200);</script>
      </body></html>`);
    } catch (e: any) {
      res.status(400).send("Erreur mock-connect : " + e.message);
    }
  });

  r.get("/linkedin/callback", async (req, res) => {
    try {
      const code = String(req.query.code || "");
      const state = String(req.query.state || "");
      await exchangeCode(code, state);
      res.send(`<html><body style="background:#0a0a0b;color:#fff;font-family:system-ui;display:grid;place-items:center;height:100vh;">
        <div style="text-align:center">
          <h2>✅ Compte LinkedIn connecté</h2>
          <p>Tu peux fermer cette fenêtre.</p>
        </div>
        <script>setTimeout(()=>window.close(), 800);</script>
      </body></html>`);
    } catch (e: any) {
      res.status(400).send("Erreur OAuth: " + e.message);
    }
  });

  /* ─── Media upload (R2 if enabled, local fallback otherwise) ─── */
  r.post("/media/upload", upload.single("file"), async (req, res) => {
    try {
      const f = req.file;
      if (!f) return res.status(400).json({ error: "Fichier manquant" });
      const isImage = f.mimetype.startsWith("image/");
      const isVideo = f.mimetype.startsWith("video/");
      if (!isImage && !isVideo) {
        return res.status(415).json({ error: "Format non supporté (image/* ou video/* uniquement)" });
      }
      const cfg = isImage ? LINKEDIN_LIMITS.image : LINKEDIN_LIMITS.video;
      if (f.size > cfg.maxBytes) {
        return res.status(413).json({ error: "Fichier trop volumineux pour LinkedIn" });
      }
      // Derive extension safely (lowercase, alphanumeric only)
      const rawExt = (f.originalname.match(/\.[a-zA-Z0-9]{1,5}$/)?.[0] || "").toLowerCase();
      const ext = rawExt || (isImage ? ".jpg" : ".mp4");
      const filename = `${db.newId()}${ext}`;
      const url = await uploadMedia(f.buffer, filename, f.mimetype);
      await db.addMedia({ url, kind: isImage ? "image" : "video", size: f.size, mime: f.mimetype });
      res.json({ url, kind: isImage ? "image" : "video" });
    } catch (e: any) {
      console.warn("[media/upload]", e?.message || e);
      res.status(500).json({ error: e.message });
    }
  });

  /* ─── Storage status (for UI badge) ─── */
  r.get("/storage/status", (_req, res) => {
    res.json(storageStatus());
  });

  /* ─── Analytics ─── */
  r.get("/analytics", async (req, res) => {
    const accountId = String(req.query.accountId || "");
    if (!accountId) return res.status(400).json({ error: "accountId requis" });
    const g = await assertAccountInTenant(req, accountId);
    if (!g.ok) return res.status(g.status).json({ error: g.error });
    const posts = await db.posts(accountId);
    const counters = { total: posts.length, drafts: 0, scheduled: 0, published: 0, archived: 0, failed: 0 };
    posts.forEach((p) => { (counters as any)[p.status === "draft" ? "drafts" : p.status]++; });

    const perDay: { date: string; count: number }[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const count = posts.filter((p) => (p.publishedAt || p.scheduledAt || "").slice(0, 10) === key).length;
      perDay.push({ date: key, count });
    }
    res.json({ ...counters, perDay });
  });

  /* ─── Scheduler tick ─── */
  r.post("/scheduler/tick", async (_req, res) => {
    const due = await db.dueScheduled();
    const results: any[] = [];
    for (const p of due) {
      try {
        const linkedinPostId = await publishPost(p.accountId, p.content, p.media);
        await db.updatePost(p._id, {
          status: "published",
          publishedAt: new Date().toISOString(),
          linkedinPostId,
          error: null,
        });
        results.push({ id: p._id, ok: true });
      } catch (e: any) {
        await db.updatePost(p._id, { status: "failed", error: e.message });
        results.push({ id: p._id, ok: false, error: e.message });
      }
    }
    res.json({ processed: results.length, results });
  });

  return r;
}
