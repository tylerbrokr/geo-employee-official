import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Sparkles, Trash2, Plus, Rocket, Mail } from "lucide-react";

const STAGE_LABEL: Record<string, string> = {
  draft: "Draft",
  intake_sent: "Intake sent",
  intake_complete: "Intake complete",
  site_live: "Site live",
  topics_ready: "Topics ready",
  autopilot: "Autopilot",
};

export default function AdminClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [market, setMarket] = useState<any>(null);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generatingTopics, setGeneratingTopics] = useState(false);
  const [goingLive, setGoingLive] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const deleteClient = async () => {
    if (!clientId) return;
    const label = profile?.full_name ?? profile?.email ?? client?.business_name ?? "this client";
    if (!confirm(`Delete ${label}? This permanently removes the client, their account, and all related data. This cannot be undone.`)) return;
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke("delete-client", { body: { client_id: clientId } });
    setDeleting(false);
    if (error || (data as any)?.error) {
      toast.error(error?.message ?? (data as any)?.error ?? "Delete failed");
      return;
    }
    toast.success("Client deleted");
    navigate("/admin");
  };

  const load = async () => {
    if (!clientId) return;
    const { data: c } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
    setClient(c);
    if (c) {
      const [{ data: p }, { data: m }, { data: sp }, { data: po }, { data: tp }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", c.owner_user_id).maybeSingle(),
        supabase.from("client_markets").select("*").eq("client_id", c.id).maybeSingle(),
        supabase.from("client_specialties").select("specialty").eq("client_id", c.id),
        supabase.from("posts").select("*").eq("client_id", c.id).order("created_at", { ascending: false }),
        supabase.from("client_topics").select("*").eq("client_id", c.id).order("position", { ascending: true }),
      ]);
      setProfile(p);
      setMarket(m);
      setSpecialties((sp ?? []).map((s: any) => s.specialty));
      setPosts(po ?? []);
      setTopics(tp ?? []);
    }
  };

  useEffect(() => { load(); }, [clientId]);

  const generate = async () => {
    if (!clientId) return;
    setGenerating(true);
    const { error } = await supabase.functions.invoke("generate-post", { body: { client_id: clientId } });
    setGenerating(false);
    if (error) toast.error(error.message);
    else { toast.success("Post generated"); load(); }
  };

  const generateTopics = async () => {
    if (!clientId) return;
    setGeneratingTopics(true);
    const { data, error } = await supabase.functions.invoke("generate-master-topics", { body: { client_id: clientId, count: 30 } });
    setGeneratingTopics(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Failed");
    } else {
      toast.success(`Generated ${(data as any).count} topics`);
      load();
    }
  };

  const updateTopic = async (id: string, patch: any) => {
    const { error } = await supabase.from("client_topics").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  const deleteTopic = async (id: string) => {
    const { error } = await supabase.from("client_topics").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Topic removed"); load(); }
  };

  const addTopic = async () => {
    if (!clientId) return;
    const maxPos = topics.length ? Math.max(...topics.map((t) => t.position)) : -1;
    const { error } = await supabase.from("client_topics").insert({
      client_id: clientId,
      kind: "geo",
      title: "New topic",
      status: "queued",
      position: maxPos + 1,
    });
    if (error) toast.error(error.message);
    else load();
  };

  const goLive = async () => {
    if (!clientId) return;
    setGoingLive(true);
    const todayDow = new Date().getUTCDay();
    const { error } = await supabase.from("clients").update({
      autopilot_enabled: true,
      autopilot_day: todayDow,
      autopilot_started_at: new Date().toISOString(),
      pipeline_stage: "autopilot",
    }).eq("id", clientId);
    setGoingLive(false);
    if (error) toast.error(error.message);
    else { toast.success("Autopilot is live — first post will publish next cycle"); load(); }
  };

  const pauseAutopilot = async () => {
    if (!clientId) return;
    const { error } = await supabase.from("clients").update({
      autopilot_enabled: false,
      pipeline_stage: "topics_ready",
    }).eq("id", clientId);
    if (error) toast.error(error.message);
    else { toast.success("Autopilot paused"); load(); }
  };

  const resendIntakeEmail = async () => {
    if (!profile?.email) { toast.error("No email on file"); return; }
    setResendingEmail(true);
    const { data, error } = await supabase.functions.invoke("create-client", {
      body: { email: profile.email, full_name: profile.full_name, business_name: client.business_name, resend: true },
    });
    setResendingEmail(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Failed");
      return;
    }
    if ((data as any).email_sent) toast.success(`Intake email sent to ${profile.email}`);
    else toast.error((data as any).email_error ?? "Email did not send");
  };

  if (!client) return <div className="text-sm text-muted-foreground">Loading...</div>;

  const stage = client.pipeline_stage ?? "draft";
  const queuedCount = topics.filter((t) => t.status === "queued").length;
  const canGoLive = stage === "topics_ready" || (queuedCount >= 1 && !client.autopilot_enabled);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/admin" className="text-sm text-primary hover:underline">← Clients</Link>
          <h1 className="page-title mt-2">{profile?.full_name ?? client.business_name ?? "Client"}</h1>
          <p className="text-sm text-muted-foreground">{profile?.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-md text-xs font-semibold" style={{ background: "hsl(160 84% 30% / 0.1)", color: "hsl(160 84% 30%)" }}>
            {STAGE_LABEL[stage] ?? stage}
          </span>
          <Button size="sm" variant="outline" onClick={resendIntakeEmail} disabled={resendingEmail} className="gap-2">
            <Mail className="w-4 h-4" /> {resendingEmail ? "Sending..." : "Resend intake email"}
          </Button>
          {client.autopilot_enabled ? (
            <Button size="sm" variant="outline" onClick={pauseAutopilot}>Pause autopilot</Button>
          ) : (
            <Button size="sm" onClick={goLive} disabled={goingLive || !canGoLive} className="gap-2">
              <Rocket className="w-4 h-4" /> {goingLive ? "Starting..." : "Go Live"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={deleteClient} disabled={deleting} className="gap-2 text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4" /> {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="topics">Topics ({topics.length})</TabsTrigger>
          <TabsTrigger value="posts">Posts ({posts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
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

          <div className="findr-card">
            <p className="section-label mb-3">VOICE & STORY</p>
            {(() => {
              const fields: [string, string | undefined][] = [
                ["Voice", client.voice],
                ["Values", client.values_text],
                ["Ideal client", client.ideal_client],
                ["Story", client.brokerage_story],
                ["Differentiators", client.differentiators],
              ];
              const hasAny = fields.some(([, v]) => v && v.trim());
              if (!hasAny) return <span className="text-sm text-muted-foreground">Not yet provided.</span>;
              return (
                <div className="space-y-3 text-sm">
                  {fields.map(([label, val]) => val && val.trim() ? (
                    <div key={label}>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
                      <div className="whitespace-pre-line">{val}</div>
                    </div>
                  ) : null)}
                  {client.property_types?.length ? (
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Property types</div>
                      <div className="flex flex-wrap gap-1.5">
                        {client.property_types.map((p: string) => (
                          <span key={p} className="px-2 py-0.5 rounded-md text-xs font-medium bg-muted">{p}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </div>
        </TabsContent>

        <TabsContent value="topics" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {queuedCount} queued · {topics.filter((t) => t.status === "used").length} used · {topics.filter((t) => t.status === "skipped").length} skipped
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={addTopic} className="gap-2">
                <Plus className="w-4 h-4" /> Add topic
              </Button>
              <Button size="sm" onClick={generateTopics} disabled={generatingTopics} className="gap-2">
                <Sparkles className="w-4 h-4" /> {generatingTopics ? "Generating..." : topics.length ? "Generate more" : "Generate Master Topics"}
              </Button>
            </div>
          </div>

          <div className="findr-card !p-0">
            {topics.length === 0 ? (
              <div className="px-6 py-10 text-sm text-muted-foreground">
                No topics yet. Click <span className="font-medium">Generate Master Topics</span> once intake is complete.
              </div>
            ) : (
              topics.map((t, i) => (
                <div key={t.id}>
                  <div className="grid grid-cols-[80px_1fr_140px_110px_40px] gap-3 items-center px-6 py-3">
                    <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: t.kind === "geo" ? "hsl(160 84% 30%)" : "hsl(220 9% 46%)" }}>
                      {t.kind}
                    </span>
                    <Input
                      defaultValue={t.title}
                      onBlur={(e) => e.target.value !== t.title && updateTopic(t.id, { title: e.target.value })}
                      className="h-9 rounded-[8px] border-transparent hover:border-input focus:border-input bg-transparent"
                    />
                    <Input
                      defaultValue={t.primary_keyword ?? ""}
                      placeholder="Primary keyword"
                      onBlur={(e) => e.target.value !== (t.primary_keyword ?? "") && updateTopic(t.id, { primary_keyword: e.target.value || null })}
                      className="h-9 rounded-[8px] border-transparent hover:border-input focus:border-input bg-transparent text-xs"
                    />
                    <select
                      defaultValue={t.status}
                      onChange={(e) => updateTopic(t.id, { status: e.target.value })}
                      className="h-9 rounded-[8px] border border-input bg-background text-xs px-2"
                    >
                      <option value="queued">Queued</option>
                      <option value="skipped">Skipped</option>
                      <option value="used">Used</option>
                    </select>
                    <button onClick={() => deleteTopic(t.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {i < topics.length - 1 && <div className="fading-divider mx-6" />}
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="posts" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{posts.length} total</p>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
