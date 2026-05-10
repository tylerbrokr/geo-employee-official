import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function AdminPostsQueue() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("posts")
        .select("id, title, status, created_at, client_id, clients!inner(business_name, owner_user_id)")
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
        <div className="grid grid-cols-[1.5fr_1fr_120px_120px] gap-4 px-6 py-3">
          <span className="section-label">Title</span>
          <span className="section-label">Client</span>
          <span className="section-label">Status</span>
          <span className="section-label">Created</span>
        </div>
        <div className="fading-divider mx-6" />
        {loading ? (
          <div className="px-6 py-10 text-sm text-muted-foreground">Loading...</div>
        ) : posts.length === 0 ? (
          <div className="px-6 py-10 text-sm text-muted-foreground">No posts yet.</div>
        ) : (
          posts.map((p, i) => (
            <div key={p.id}>
              <Link to={`/admin/posts/${p.id}`} className="grid grid-cols-[1.5fr_1fr_120px_120px] gap-4 px-6 py-4 hover:bg-muted/30 transition-colors">
                <span className="text-sm font-medium truncate">{p.title}</span>
                <span className="text-sm text-muted-foreground truncate">{p.clients?.business_name ?? "—"}</span>
                <span className="text-xs flex items-center gap-1.5 self-center">
                  <span className={`w-1.5 h-1.5 rounded-full ${p.status === "published" ? "bg-emerald" : "bg-muted-foreground/50"}`} />
                  {p.status}
                </span>
                <span className="text-xs text-muted-foreground self-center">{new Date(p.created_at).toLocaleDateString()}</span>
              </Link>
              {i < posts.length - 1 && <div className="fading-divider mx-6" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
