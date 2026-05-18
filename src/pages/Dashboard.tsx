import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useClient } from "@/hooks/useClient";
import { supabase } from "@/integrations/supabase/client";
import { SiteBuildStatus } from "@/components/SiteBuildStatus";
import { nextScheduledPost, weekdayList, formatPublishDate } from "@/lib/autopilot";

export default function Dashboard() {
  const { user } = useAuth();
  const { client, isLive, liveUrl } = useClient();
  const [counts, setCounts] = useState({ published: 0, scheduled: 0, thisMonth: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [scheduled, setScheduled] = useState<any[]>([]);
  const nextPost = nextScheduledPost(scheduled);
  const weekday = weekdayList(client?.autopilot_days);

  useEffect(() => {
    if (!client) return;
    (async () => {
      const { data: posts } = await supabase
        .from("posts")
        .select("*")
        .eq("client_id", client.id)
        .order("published_at", { ascending: false, nullsFirst: false });

      const all = posts ?? [];
      const pub = all.filter((p) => p.status === "published");
      const sched = all.filter((p) => p.status === "scheduled");
      const monthStart = new Date();
      monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const thisMonth = pub.filter((p) => p.published_at && new Date(p.published_at) >= monthStart).length;

      setCounts({ published: pub.length, scheduled: sched.length, thisMonth });
      setRecent(pub.slice(0, 4));
      setScheduled(sched.slice(0, 2));
    })();
  }, [client]);

  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] || "there";

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="mb-8">
          <h1 className="page-title">Welcome back, {firstName}.</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {counts.thisMonth > 0
              ? `Your content engine published ${counts.thisMonth} post${counts.thisMonth === 1 ? "" : "s"} this month.`
              : "We'll start publishing once your site is live."}
          </p>
        </div>

        {isLive ? (
          <div className="findr-card-elevated mb-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-label mb-2">YOUR GEO SITE</p>
                <p className="text-base font-semibold text-primary">{liveUrl}</p>
                {liveUrl && (
                  <div className="flex gap-3 mt-4">
                    <Button variant="default" size="sm" asChild><a href={liveUrl} target="_blank" rel="noreferrer">Visit Site</a></Button>
                  </div>
                )}
              </div>
              <div className="hidden sm:flex items-center gap-3">
                <div className="relative flex items-center justify-center w-12 h-12">
                  <span className="w-3 h-3 rounded-full bg-emerald emerald-pulse" />
                </div>
                <div>
                  <p className="text-sm font-medium">Live</p>
                  <p className="text-xs text-muted-foreground">Auto-publishing</p>
                </div>
              </div>
            </div>
          </div>
        ) : client ? (
          <div className="mb-8">
            <SiteBuildStatus client={client as any} />
          </div>
        ) : null}

        {isLive && nextPost && (
          <div className="findr-card mb-8" style={{ borderLeft: "2px solid hsl(160 84% 30%)" }}>
            <p className="section-label mb-2">NEXT POST</p>
            <p className="text-sm font-medium">{nextPost.title}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Publishes {formatPublishDate(nextPost.scheduled_for)}
              {weekday ? `. Posts go live weekly on ${weekday}s.` : "."}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {[
            { label: "Posts Published", value: counts.published, sub: "total since launch" },
            { label: "This Month", value: counts.thisMonth, sub: "published" },
            { label: "Scheduled", value: counts.scheduled, sub: "upcoming" },
          ].map((s) => (
            <div key={s.label} className="findr-card" style={{ borderTop: "2px solid hsl(160 84% 30%)" }}>
              <p className="section-label mb-2">{s.label}</p>
              <p className="stat-number">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="mb-10">
          <p className="section-label mb-4">RECENT POSTS</p>
          <div className="findr-card !p-0">
            {recent.length === 0 ? (
              <div className="px-6 py-10 text-sm text-muted-foreground">No published posts yet.</div>
            ) : (
              recent.map((post, i) => (
                <div key={post.id}>
                  <div className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium truncate">{post.title}</span>
                      {post.tag && (
                        <span className="flex items-center gap-1.5 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
                          <span className="text-xs text-primary">{post.tag}</span>
                        </span>
                      )}
                    </div>
                    <span className="text-[13px] text-muted-foreground shrink-0 ml-4">
                      {post.published_at ? new Date(post.published_at).toLocaleDateString() : ""}
                    </span>
                  </div>
                  {i < recent.length - 1 && <div className="fading-divider mx-6" />}
                </div>
              ))
            )}
          </div>
          <Link to="/portal/posts" className="inline-block mt-3 text-sm font-medium text-primary hover:underline">View all posts →</Link>
        </div>

        {scheduled.length > 0 && (
          <div>
            <p className="section-label mb-4">SCHEDULED</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scheduled.map((post) => (
                <div key={post.id} className="findr-card">
                  <p className="text-sm font-medium mb-1">{post.title}</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    {post.scheduled_for ? `Publishes ${new Date(post.scheduled_for).toLocaleDateString()}` : "Scheduled"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
