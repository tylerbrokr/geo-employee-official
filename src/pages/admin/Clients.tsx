import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { NewClientModal } from "@/components/admin/NewClientModal";
import { Plus } from "lucide-react";

interface Row {
  id: string;
  business_name: string | null;
  brokerage: string | null;
  site_status: string;
  created_at: string;
  email: string | null;
  full_name: string | null;
  pipeline_stage: string;
}

export default function AdminClients() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: clients } = await supabase
      .from("clients")
      .select("id, owner_user_id, business_name, brokerage, site_status, created_at, pipeline_stage")
      .order("created_at", { ascending: false });

    const ownerIds = (clients ?? []).map((c) => c.owner_user_id);

    // Defense-in-depth: filter out any user who has the admin role
    const { data: adminRoles } = ownerIds.length
      ? await supabase.from("user_roles").select("user_id").eq("role", "admin").in("user_id", ownerIds)
      : { data: [] };
    const adminSet = new Set((adminRoles ?? []).map((r: any) => r.user_id));

    const visible = (clients ?? []).filter((c: any) => !adminSet.has(c.owner_user_id));
    const ids = visible.map((c: any) => c.owner_user_id);

    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
      : { data: [] };
    const profMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    setRows(
      visible.map((c: any) => ({
        id: c.id,
        business_name: c.business_name,
        brokerage: c.brokerage,
        site_status: c.site_status,
        created_at: c.created_at,
        pipeline_stage: c.pipeline_stage,
        full_name: profMap.get(c.owner_user_id)?.full_name ?? null,
        email: profMap.get(c.owner_user_id)?.email ?? null,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const STAGE_LABEL: Record<string, string> = {
    draft: "Draft",
    intake_sent: "Intake sent",
    intake_complete: "Intake complete",
    site_live: "Site live",
    topics_ready: "Topics ready",
    autopilot: "Autopilot",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Clients</h1>
        <Button onClick={() => setModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New client
        </Button>
      </div>
      <div className="findr-card !p-0">
        <div className="grid grid-cols-[1.5fr_1.4fr_1fr_140px_110px] gap-4 px-6 py-3">
          <span className="section-label">Name</span>
          <span className="section-label">Brokerage</span>
          <span className="section-label">Email</span>
          <span className="section-label">Stage</span>
          <span className="section-label">Joined</span>
        </div>
        <div className="fading-divider mx-6" />
        {loading ? (
          <div className="px-6 py-10 text-sm text-muted-foreground">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-10 text-sm text-muted-foreground">No clients yet. Create one to get started.</div>
        ) : (
          rows.map((r, i) => (
            <div key={r.id}>
              <Link to={`/admin/clients/${r.id}`} className="grid grid-cols-[1.5fr_1.4fr_1fr_140px_110px] gap-4 px-6 py-4 hover:bg-muted/30 transition-colors">
                <span className="text-sm font-medium text-foreground truncate">{r.full_name ?? r.business_name ?? "Unnamed"}</span>
                <span className="text-sm text-muted-foreground truncate">{r.brokerage ?? "—"}</span>
                <span className="text-sm text-muted-foreground truncate">{r.email ?? "—"}</span>
                <span className="text-xs self-center">
                  <span className="px-2 py-1 rounded-md font-medium" style={{ background: "hsl(160 84% 30% / 0.1)", color: "hsl(160 84% 30%)" }}>
                    {STAGE_LABEL[r.pipeline_stage] ?? r.pipeline_stage}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground self-center">{new Date(r.created_at).toLocaleDateString()}</span>
              </Link>
              {i < rows.length - 1 && <div className="fading-divider mx-6" />}
            </div>
          ))
        )}
      </div>

      <NewClientModal open={modalOpen} onOpenChange={setModalOpen} onCreated={() => { setModalOpen(false); load(); }} />
    </div>
  );
}
