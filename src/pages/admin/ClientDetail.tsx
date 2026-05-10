import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AdminClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const [client, setClient] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [market, setMarket] = useState<any>(null);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    if (!clientId) return;
    const { data: c } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
    setClient(c);
    if (c) {
      const [{ data: p }, { data: m }, { data: sp }, { data: po }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", c.owner_user_id).maybeSingle(),
        supabase.from("client_markets").select("*").eq("client_id", c.id).maybeSingle(),
        supabase.from("client_specialties").select("specialty").eq("client_id", c.id),
        supabase.from("posts").select("*").eq("client_id", c.id).order("created_at", { ascending: false }),
      ]);
      setProfile(p);
      setMarket(m);
      setSpecialties((sp ?? []).map((s: any) => s.specialty));
      setPosts(po ?? []);
    }
  };

  useEffect(() => {
    load();
  }, [clientId]);

  const generate = async () => {
    if (!clientId) return;
    setGenerating(true);
    const { error } = await supabase.functions.invoke("generate-post", { body: { client_id: clientId } });
    setGenerating(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Post generated");
      load();
    }
  };

  if (!client) return <div className="text-sm text-muted-foreground">Loading...</div>;

  const stage = (client as any).pipeline_stage ?? "draft";
  const STAGE_LABEL: Record<string, string> = {
    draft: "Draft",
    intake_sent: "Intake sent",
    intake_complete: "Intake complete",
    site_live: "Site live",
    topics_ready: "Topics ready",
    autopilot: "Autopilot",
  };
  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/admin" className="text-sm text-primary hover:underline">← Clients</Link>
          <h1 className="page-title mt-2">{profile?.full_name ?? client.business_name ?? "Client"}</h1>
          <p className="text-sm text-muted-foreground">{profile?.email}</p>
        </div>
        <span className="px-3 py-1.5 rounded-md text-xs font-semibold" style={{ background: "hsl(160 84% 30% / 0.1)", color: "hsl(160 84% 30%)" }}>
          {STAGE_LABEL[stage] ?? stage}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="findr-card">
          <p className="section-label mb-3">BUSINESS</p>
          <div className="text-sm space-y-1">
            <div><span className="text-muted-foreground">Brokerage:</span> {client.brokerage ?? "—"}</div>
            <div><span className="text-muted-foreground">Years:</span> {client.years_experience ?? "—"}</div>
            <div><span className="text-muted-foreground">Phone:</span> {client.phone ?? "—"}</div>
            <div><span className="text-muted-foreground">Site:</span> {client.site_url ?? "—"} ({client.site_status})</div>
          </div>
        </div>
        <div className="findr-card">
          <p className="section-label mb-3">MARKET</p>
          <div className="text-sm space-y-1">
            <div><span className="text-muted-foreground">Primary:</span> {market?.primary_city ?? "—"}, {market?.primary_state ?? "—"}</div>
            <div><span className="text-muted-foreground">Cities:</span> {market?.cities?.join(", ") || "—"}</div>
            <div><span className="text-muted-foreground">Neighborhoods:</span> {market?.neighborhoods?.join(", ") || "—"}</div>
            <div><span className="text-muted-foreground">Counties:</span> {market?.counties?.join(", ") || "—"}</div>
          </div>
        </div>
      </div>

      <div className="findr-card">
        <p className="section-label mb-3">SPECIALTIES</p>
        <div className="flex flex-wrap gap-2">
          {specialties.length === 0 ? (
            <span className="text-sm text-muted-foreground">None</span>
          ) : (
            specialties.map((s) => (
              <span key={s} className="px-2.5 py-1 rounded-md text-xs font-medium" style={{ background: "hsl(160 84% 30% / 0.1)", color: "hsl(160 84% 30%)" }}>{s}</span>
            ))
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="section-label">POSTS ({posts.length})</p>
          <Button size="sm" onClick={generate} disabled={generating}>
            {generating ? "Generating..." : "Generate post"}
          </Button>
        </div>
        <div className="findr-card !p-0">
          {posts.length === 0 ? (
            <div className="px-6 py-10 text-sm text-muted-foreground">No posts yet.</div>
          ) : (
            posts.map((p, i) => (
              <div key={p.id}>
                <Link to={`/admin/posts/${p.id}`} className="grid grid-cols-[1fr_120px_100px] gap-4 px-6 py-4 hover:bg-muted/30 transition-colors">
                  <span className="text-sm font-medium truncate">{p.title}</span>
                  <span className="text-xs text-muted-foreground self-center">{p.status}</span>
                  <span className="text-xs text-muted-foreground self-center">{new Date(p.created_at).toLocaleDateString()}</span>
                </Link>
                {i < posts.length - 1 && <div className="fading-divider mx-6" />}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
