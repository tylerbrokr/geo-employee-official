import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Save, RotateCcw, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const FIELDS: { key: string; label: string; rows: number; max: number; help: string }[] = [
  { key: "tagline", label: "Tagline", rows: 2, max: 80, help: "Sits under the agent's name on the homepage." },
  { key: "bio_short", label: "Short bio", rows: 3, max: 240, help: "1–2 sentences. Used in hero and cards." },
  { key: "bio_long", label: "Long bio", rows: 8, max: 1200, help: "Full about section. 2–4 short paragraphs." },
  { key: "ideal_client_blurb", label: "Ideal client", rows: 3, max: 280, help: "Cleaned-up version of the intake answer." },
  { key: "area_blurb", label: "Areas intro", rows: 3, max: 280, help: "Intro for the /areas page." },
  { key: "meta_title", label: "Meta title", rows: 1, max: 60, help: "Browser tab + Google result title." },
  { key: "meta_description", label: "Meta description", rows: 2, max: 160, help: "Google search snippet." },
];

export function SiteCopyTab({ clientId }: { clientId: string }) {
  const [copy, setCopy] = useState<any>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("site_copy").select("*").eq("client_id", clientId).maybeSingle();
    setCopy(data);
    if (data) {
      const d: Record<string, string> = {};
      for (const f of FIELDS) d[f.key] = data[f.key] ?? "";
      setDrafts(d);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [clientId]);

  // Poll while stale or while busy
  useEffect(() => {
    if (!copy?.stale && !busy) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [copy?.stale, busy]);

  const regenerate = async (only_field?: string, ignore_manual = false) => {
    setBusy(only_field ?? "all");
    const { data, error } = await supabase.functions.invoke("generate-site-copy", {
      body: { client_id: clientId, only_field, ignore_manual },
    });
    setBusy(null);
    if (error || (data as any)?.error) {
      toast.error(error?.message ?? (data as any)?.error ?? "Generation failed");
      return;
    }
    toast.success(only_field ? `${only_field} regenerated` : "Site copy regenerated");
    load();
  };

  const saveField = async (key: string) => {
    setBusy(key);
    const manuallyEdited = { ...(copy?.manually_edited ?? {}), [key]: true };
    const update: any = { manually_edited: manuallyEdited };
    update[key] = drafts[key];
    const { error } = await supabase
      .from("site_copy")
      .update(update)
      .eq("client_id", clientId);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    // Enqueue a homepage purge
    const { data: site } = await supabase.from("client_sites").select("subdomain, custom_domain, dns_verified").eq("client_id", clientId).maybeSingle();
    if (site) {
      const hostname = site.dns_verified && site.custom_domain ? site.custom_domain : site.subdomain ? `${site.subdomain}.mygeosite.com` : null;
      if (hostname) {
        await supabase.from("site_cache_purges").insert({ client_id: clientId, hostname, paths: ["/"], purge_trigger: "manual" });
      }
    }
    load();
  };

  const resetField = async (key: string) => {
    const me = { ...(copy?.manually_edited ?? {}) };
    delete me[key];
    await supabase.from("site_copy").update({ manually_edited: me }).eq("client_id", clientId);
    await regenerate(key);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!copy) {
    return (
      <div className="findr-card">
        <p className="text-sm text-muted-foreground">No site copy yet. Provision the site first on the Domain tab.</p>
      </div>
    );
  }

  const manual = (copy.manually_edited ?? {}) as Record<string, boolean>;

  return (
    <div className="space-y-6">
      <div className="findr-card flex items-start justify-between gap-6">
        <div>
          <p className="section-label mb-2">SITE COPY</p>
          <p className="text-sm text-muted-foreground">
            {copy.ai_generated_at
              ? `Last generated ${formatDistanceToNow(new Date(copy.ai_generated_at), { addSuffix: true })} · ${copy.ai_model ?? "AI"}`
              : "Not generated yet."}
          </p>
          {copy.stale && (
            <p className="text-xs mt-2 text-[hsl(36_43%_45%)] flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Intake updated. New copy will regenerate within ~2 minutes.
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={busy === "all"}
          onClick={() => {
            if (Object.keys(manual).length > 0 && !confirm("Regenerate all fields, including ones you've hand-edited?")) return;
            regenerate(undefined, true);
          }}
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${busy === "all" ? "animate-spin" : ""}`} />
          Regenerate all
        </Button>
      </div>

      {FIELDS.map((f) => {
        const isManual = !!manual[f.key];
        const value = drafts[f.key] ?? "";
        const dirty = value !== (copy[f.key] ?? "");
        return (
          <div key={f.key} className="findr-card space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm">{f.label}</h3>
                  <Badge variant={isManual ? "default" : "secondary"} className="text-[10px] h-4 px-1.5">
                    {isManual ? "EDITED" : "AI"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{f.help}</p>
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {value.length} / {f.max}
              </span>
            </div>
            <Textarea
              rows={f.rows}
              value={value}
              maxLength={f.max * 2}
              onChange={(e) => setDrafts({ ...drafts, [f.key]: e.target.value })}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={!dirty || busy === f.key} onClick={() => saveField(f.key)}>
                <Save className="w-3.5 h-3.5 mr-1.5" /> Save
              </Button>
              <Button size="sm" variant="ghost" disabled={busy === f.key} onClick={() => regenerate(f.key)}>
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${busy === f.key ? "animate-spin" : ""}`} /> Regenerate
              </Button>
              {isManual && (
                <Button size="sm" variant="ghost" disabled={busy === f.key} onClick={() => resetField(f.key)}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset to AI
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
