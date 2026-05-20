import "dotenv/config";
import { db, connect } from "../db/store";
import { publishPost } from "../services/linkedin";

(async () => {
  await connect();
  const due = await db.dueScheduled();
  console.log(`[tick] ${due.length} post(s) due`);
  for (const p of due) {
    try {
      const id = await publishPost(p.accountId, p.content, p.media);
      await db.updatePost(p._id, { status: "published", publishedAt: new Date().toISOString(), linkedinPostId: id, error: null });
      console.log("✓", p._id);
    } catch (e: any) {
      await db.updatePost(p._id, { status: "failed", error: e.message });
      console.warn("✗", p._id, e.message);
    }
  }
  process.exit(0);
})();
