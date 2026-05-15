import { DashboardLayout } from "@/components/DashboardLayout";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useClient } from "@/hooks/useClient";
import { SiteBuildStatus } from "@/components/SiteBuildStatus";
import { nextScheduledPost, weekdayName, formatPublishDate } from "@/lib/autopilot";

type Tab = "All" | "Published" | "Scheduled";

export default function Posts() {
  const { client } = useClient();
  const [tab, setTab] = useState<Tab>("All");
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    if (!client) return;
    supabase
      .from("posts")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setPosts(data ?? []));
  }, [client]);

  const filtered = posts
    .filter((p) => {
      if (tab === "All") return true;
      if (tab === "Published") return p.status === "published";
      return p.status === "scheduled";
    })
    .sort((a, b) => {
      if (tab === "Scheduled") {
        const av = a.scheduled_for ? new Date(a.scheduled_for).getTime() : Infinity;
        const bv = b.scheduled_for ? new Date(b.scheduled_for).getTime() : Infinity;
        return av - bv;
      }
      return 0;
    });

  const next = nextScheduledPost(posts);
  const weekday = weekdayName(client?.autopilot_day);

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="mb-2">
          <h1 className="page-title">Posts</h1>
          <p className="section-label mt-2">{posts.filter((p) => p.status === "published").length} POSTS PUBLISHED</p>
          {next && (
            <p className="text-sm text-muted-foreground mt-2">
              {weekday ? `Posts publish weekly on ${weekday}s. ` : ""}Next post: {formatPublishDate(next.scheduled_for)}.
            </p>
          )}
        </div>

        <div className="flex gap-6 mt-6 mb-6">
          {(["Published", "Scheduled", "All"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`pb-3 text-sm font-medium border-b-2 -mb-px ${
              tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>{t}</button>
          ))}
        </div>
        <div className="fading-divider mb-6" />

        <div className="findr-card !p-0">
          <div className="grid grid-cols-[1fr_100px_120px] gap-4 px-6 py-3">
            <span className="section-label">Post</span>
            <span className="section-label">Date</span>
            <span className="section-label">Status</span>
          </div>
          <div className="fading-divider mx-6" />
          {filtered.length === 0 ? (
            client && client.site_status !== "live" ? (
              <div className="px-6 py-2">
                <SiteBuildStatus
                  client={client as any}
                  variant="slim"
                  slimMessage="Your first posts are being written. They'll appear here as drafts roll in."
                />
              </div>
            ) : (
              <div className="px-6 py-10 text-sm text-muted-foreground">No posts to show yet.</div>
            )
          ) : (
            filtered.map((post, i) => (
              <div key={post.id}>
                <div className="grid grid-cols-[1fr_100px_120px] gap-4 px-6 py-4 hover:bg-muted/30">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{post.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{post.target_keyword ?? ""}</p>
                  </div>
                  <span className="text-[13px] text-muted-foreground self-center">
                    {(post.published_at || post.scheduled_for) ? new Date(post.published_at ?? post.scheduled_for).toLocaleDateString() : "—"}
                  </span>
                  <span className="self-center flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${post.status === "published" ? "bg-emerald" : "bg-muted-foreground/50"}`} />
                    <span className={`text-xs ${post.status === "published" ? "text-primary" : "text-muted-foreground"} capitalize`}>{post.status}</span>
                  </span>
                </div>
                {i < filtered.length - 1 && <div className="fading-divider mx-6" />}
              </div>
            ))
          )}
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
