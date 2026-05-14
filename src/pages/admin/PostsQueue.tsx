import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

function clientLabel(p: any): string {
  const c = p.clients;
  if (!c) return "—";
  const siteName = Array.isArray(c.client_sites)
    ? c.client_sites[0]?.agent_display_name
    : c.client_sites?.agent_display_name;
  return (
    siteName ||
    c.profiles?.full_name ||
    c.business_name ||
    c.brokerage ||
    c.profiles?.email ||
    "—"
  );
}

export default function AdminPostsQueue() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("posts")
        .select(`
          id, title, status, created_at, scheduled_for, published_at, client_id,
          clients!inner(
            business_name,
            brokerage,
            owner_user_id,
            profiles:owner_user_id ( full_name, email ),
            client_sites ( agent_display_name )
          )
        `)
        .order("created_at", { ascending: false })
        .limit(200);
      setPosts(data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <h1 className="page-title mb-6">Posts Queue</h1>
      <div className="findr-card !p-0">
        <div className="grid grid-cols-[1.5fr_1fr_110px_120px_120px] gap-4 px-6 py-3">
          <span className="section-label">Title</span>
          <span className="section-label">Client</span>
          <span className="section-label">Status</span>
          <span className="section-label">Scheduled</span>
          <span className="section-label">Created</span>
        </div>
        <div className="fading-divider mx-6" />
        {loading ? (
          <div className="px-6 py-10 text-sm text-muted-foreground">Loading...</div>
        ) : posts.length === 0 ? (
          <div className="px-6 py-10 text-sm text-muted-foreground">No posts yet.</div>
        ) : (
          posts.map((p, i) => {
            const dateForStatus = p.published_at ?? p.scheduled_for;
            return (
              <div key={p.id}>
                <Link to={`/admin/posts/${p.id}`} className="grid grid-cols-[1.5fr_1fr_110px_120px_120px] gap-4 px-6 py-4 hover:bg-muted/30 transition-colors">
                  <span className="text-sm font-medium truncate">{p.title}</span>
                  <span className="text-sm text-muted-foreground truncate">{clientLabel(p)}</span>
                  <span className="text-xs flex items-center gap-1.5 self-center">
                    <span className={`w-1.5 h-1.5 rounded-full ${p.status === "published" ? "bg-emerald" : "bg-muted-foreground/50"}`} />
                    {p.status}
                  </span>
                  <span className="text-xs text-muted-foreground self-center">
                    {dateForStatus ? new Date(dateForStatus).toLocaleDateString() : "—"}
                  </span>
                  <span className="text-xs text-muted-foreground self-center">{new Date(p.created_at).toLocaleDateString()}</span>
                </Link>
                {i < posts.length - 1 && <div className="fading-divider mx-6" />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
