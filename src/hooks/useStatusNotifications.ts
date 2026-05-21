/**
 * Watches the posts query for status transitions (scheduled → published / failed)
 * and fires native browser notifications. Mount once at the App level.
 */
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Api } from "../lib/api";
import { useStore } from "../lib/store";
import { useNotificationsEnabled } from "../lib/auth";

export function useStatusNotifications() {
  const enabled = useNotificationsEnabled();
  const accountId = useStore((s) => s.currentAccountId);

  const { data: posts = [] } = useQuery({
    queryKey: ["posts", accountId, "all"],
    queryFn: () => Api.listPosts(accountId!, "all"),
    enabled: !!accountId,
    refetchInterval: 10_000,
  });

  // Map<postId, previousStatus> ; null = first load not yet recorded
  const prev = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    const granted = typeof Notification !== "undefined" && Notification.permission === "granted";
    if (!enabled || !granted) {
      prev.current = null;
      return;
    }

    const current = new Map(posts.map((p) => [p._id, p.status]));

    // Skip first run — establish baseline without notifying
    if (!prev.current) {
      prev.current = current;
      return;
    }

    for (const [id, status] of current) {
      const old = prev.current.get(id);
      if (!old || old === status) continue;
      const post = posts.find((p) => p._id === id);
      if (!post) continue;

      if (old === "scheduled" && status === "published") {
        const n = new Notification("📤 OUIWEB · Post publié", {
          body: post.content.slice(0, 140),
          icon: "/favicon.svg",
          tag: id,
        });
        n.onclick = () => {
          window.focus();
          window.location.href = `/compose/${id}`;
          n.close();
        };
      } else if (old === "scheduled" && status === "failed") {
        const n = new Notification("⚠️ OUIWEB · Échec de publication", {
          body: post.error || "Raison inconnue",
          icon: "/favicon.svg",
          tag: id,
        });
        n.onclick = () => {
          window.focus();
          window.location.href = `/compose/${id}`;
          n.close();
        };
      }
    }

    prev.current = current;
  }, [posts, enabled]);
}
