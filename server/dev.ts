import "dotenv/config";

process.on("unhandledRejection", (e: any) => {
  console.warn("[unhandledRejection]", e?.message || e);
});

import express from "express";
import cors from "cors";
import path from "node:path";
import { buildRouter } from "./routes";
import { db, connect } from "./db/store";
import { publishPost } from "./services/linkedin";

const app = express();
app.use(cors({ origin: ["http://localhost:5173"], credentials: true }));
app.use(express.json({ limit: "10mb" }));

// Static serving for uploaded media
app.use("/media", express.static(path.resolve(process.cwd(), "data", "uploads"), { maxAge: "1y" }));

app.use("/api", buildRouter());

app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 8787);
app.listen(PORT, async () => {
  await connect();

  console.log(`\n  ▲ OUIWEB API · http://localhost:${PORT}`);

  console.log(`  ▲ Frontend     · http://localhost:5173\n`);
});

/* In-process scheduler — 15s tick in dev (60s = Netlify cron in prod) */
async function tick() {
  try {
    const due = await db.dueScheduled();
    for (const p of due) {
      try {
        const linkedinPostId = await publishPost(p.accountId, p.content, p.media);
        await db.updatePost(p._id, {
          status: "published",
          publishedAt: new Date().toISOString(),
          linkedinPostId,
          error: null,
        });
        console.log(`[scheduler] ✓ Published ${p._id}`);
      } catch (e: any) {
        await db.updatePost(p._id, { status: "failed", error: e.message });
        console.warn(`[scheduler] ✗ ${p._id} :: ${e.message}`);
      }
    }
  } catch {}
}
// Run a tick on startup (catches anything past-due after server restart)
setTimeout(tick, 2000);
setInterval(tick, 15_000);
