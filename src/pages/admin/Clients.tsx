import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Row {
  id: string;
  business_name: string | null;
  brokerage: string | null;
  site_status: string;
  created_at: string;
  email: string | null;
  full_name: string | null;
}

export default function AdminClients() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: clients } = await supabase
        .from("clients")
        .select("id, owner_user_id, business_name, brokerage, site_status, created_at")
        .order("created_at", { ascending: false });

      const ids = (clients ?? []).map((c) => c.owner_user_id);
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
        : { data: [] };
      const profMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

      setRows(
        (clients ?? []).map((c: any) => ({
          id: c.id,
          business_name: c.business_name,
          brokerage: c.brokerage,
          site_status: c.site_status,
          created_at: c.created_at,
          full_name: profMap.get(c.owner_user_id)?.full_name ?? null,
          email: profMap.get(c.owner_user_id)?.email ?? null,
        }))
      );
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <h1 className="page-title mb-6">Clients</h1>
      <div className="findr-card !p-0">
        <div className="grid grid-cols-[1.5fr_1.5fr_1fr_120px_120px] gap-4 px-6 py-3">
          <span className="section-label">Name</span>
          <span className="section-label">Brokerage</span>
          <span className="section-label">Email</span>
          <span className="section-label">Site</span>
          <span className="section-label">Joined</span>
        </div>
        <div className="fading-divider mx-6" />
        {loading ? (
          <div className="px-6 py-10 text-sm text-muted-foreground">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-10 text-sm text-muted-foreground">No clients yet.</div>
        ) : (
          rows.map((r, i) => (
            <div key={r.id}>
              <Link to={`/admin/clients/${r.id}`} className="grid grid-cols-[1.5fr_1.5fr_1fr_120px_120px] gap-4 px-6 py-4 hover:bg-muted/30 transition-colors">
                <span className="text-sm font-medium text-foreground truncate">{r.full_name ?? r.business_name ?? "Unnamed"}</span>
                <span className="text-sm text-muted-foreground truncate">{r.brokerage ?? "—"}</span>
                <span className="text-sm text-muted-foreground truncate">{r.email ?? "—"}</span>
                <span className="text-xs flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${r.site_status === "live" ? "bg-emerald" : "bg-muted-foreground/50"}`} />
                  {r.site_status}
                </span>
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
              </Link>
              {i < rows.length - 1 && <div className="fading-divider mx-6" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
