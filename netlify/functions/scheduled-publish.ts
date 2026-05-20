/**
 * Netlify Scheduled Function — runs every minute in production.
 * Publishes due scheduled posts via the LinkedIn API.
 *
 *   netlify.toml schedule = "* * * * *"  (configure via Netlify UI or netlify.toml)
 */
import "dotenv/config";
import type { Handler } from "@netlify/functions";
import { db, connect } from "../../server/db/store";
import { publishPost } from "../../server/services/linkedin";

export const handler: Handler = async () => {
  await connect();
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
  return { statusCode: 200, body: JSON.stringify({ processed: results.length, results }) };
};

export const config = { schedule: "* * * * *" };
