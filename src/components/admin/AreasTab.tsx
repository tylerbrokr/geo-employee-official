import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Sparkles, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Faq { q: string; a: string }
interface Area {
  id: string;
  slug: string;
  area_type: "city" | "neighborhood" | "county";
  name: string;
  state: string | null;
  intro: string;
  market_blurb: string;
  faqs: Faq[];
  meta_title: string;
  meta_description: string;
  stale: boolean;
  ai_generated_at: string | null;
}

export function AreasTab({ clientId }: { clientId: string }) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("client_areas")
      .select("*")
      .eq("client_id", clientId)
      .order("area_type", { ascending: true })
      .order("name", { ascending: true });
    setAreas((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, [clientId]);

  // Poll while any area is stale
  useEffect(() => {
    if (!areas.some((a) => a.stale) && !busy) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areas, busy]);

  const regenAll = async () => {
    setBusy("all");
    const { data, error } = await supabase.functions.invoke("generate-area-pages", {
      body: { client_id: clientId, regenerate_all: true },
    });
    setBusy(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Failed");
      return;
    }
    toast.success(`Regenerated ${(data as any).generated} of ${(data as any).total} areas`);
    load();
  };

  const syncFromMarkets = async () => {
    setBusy("sync");
    const { data, error } = await supabase.functions.invoke("generate-area-pages", {
      body: { client_id: clientId },
    });
    setBusy(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Failed");
      return;
    }
    toast.success(`Synced. ${(data as any).generated} new or stale areas generated.`);
    load();
  };

  const regenOne = async (areaId: string) => {
    setBusy(areaId);
    const { data, error } = await supabase.functions.invoke("generate-area-pages", {
      body: { client_id: clientId, area_id: areaId },
    });
    setBusy(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Failed");
      return;
    }
    toast.success("Area regenerated");
    load();
  };

  const saveField = async (areaId: string, patch: Partial<Area>) => {
    const { error } = await supabase.from("client_areas").update(patch as any).eq("id", areaId);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    load();
  };

  const deleteArea = async (areaId: string) => {
    if (!confirm("Delete this area page? Re-syncing from markets will recreate it.")) return;
    const { error } = await supabase.from("client_areas").delete().eq("id", areaId);
    if (error) { toast.error(error.message); return; }
    load();
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {areas.length} area pages · {areas.filter((a) => a.stale).length} stale
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={syncFromMarkets} disabled={busy === "sync"} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${busy === "sync" ? "animate-spin" : ""}`} />
            {busy === "sync" ? "Syncing..." : "Sync from markets"}
          </Button>
          <Button size="sm" onClick={regenAll} disabled={busy === "all"} className="gap-2">
            <Sparkles className="w-4 h-4" /> {busy === "all" ? "Regenerating..." : "Regenerate all"}
          </Button>
        </div>
      </div>

      {areas.length === 0 ? (
        <div className="findr-card text-sm text-muted-foreground">
          No area pages yet. Click <span className="font-medium">Sync from markets</span> to create one page per city, neighborhood, and county in the client's market.
        </div>
      ) : (
        <div className="findr-card !p-0">
          {areas.map((a, i) => {
            const isOpen = openId === a.id;
            return (
              <div key={a.id}>
                <div className="px-6 py-4">
                  <div className="grid grid-cols-[16px_80px_1fr_180px_120px] gap-3 items-center">
                    <button onClick={() => setOpenId(isOpen ? null : a.id)} className="text-muted-foreground hover:text-foreground">
                      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{a.area_type}</span>
                    <div>
                      <div className="text-sm font-medium">{a.name}{a.state ? `, ${a.state}` : ""}</div>
                      <div className="text-xs text-muted-foreground font-mono">/areas/{a.slug}</div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {a.stale
                        ? <span className="text-amber-700">Stale</span>
                        : a.ai_generated_at
                          ? `Generated ${formatDistanceToNow(new Date(a.ai_generated_at))} ago`
                          : "Not generated"}
                    </span>
                    <div className="flex gap-1.5 justify-end">
                      <Button size="sm" variant="outline" onClick={() => regenOne(a.id)} disabled={busy === a.id} className="h-7 text-xs gap-1.5">
                        <Sparkles className="w-3 h-3" /> {busy === a.id ? "..." : "Regenerate"}
                      </Button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-4 space-y-4 pl-7">
                      <Field label="Intro" value={a.intro} onSave={(v) => saveField(a.id, { intro: v })} rows={2} />
                      <Field label="Market blurb" value={a.market_blurb} onSave={(v) => saveField(a.id, { market_blurb: v })} rows={6} />
                      <Field label="Meta title" value={a.meta_title} onSave={(v) => saveField(a.id, { meta_title: v })} rows={1} />
                      <Field label="Meta description" value={a.meta_description} onSave={(v) => saveField(a.id, { meta_description: v })} rows={2} />
                      <FaqEditor faqs={a.faqs ?? []} onSave={(v) => saveField(a.id, { faqs: v as any })} />
                      <button onClick={() => deleteArea(a.id)} className="text-xs text-destructive hover:underline">Delete this area</button>
                    </div>
                  )}
                </div>
                {i < areas.length - 1 && <div className="fading-divider mx-6" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onSave, rows }: { label: string; value: string; onSave: (v: string) => void; rows: number }) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  const dirty = v !== value;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</label>
        {dirty && <button onClick={() => onSave(v)} className="text-xs text-primary hover:underline">Save</button>}
      </div>
      {rows === 1 ? (
        <Input value={v} onChange={(e) => setV(e.target.value)} className="h-9 text-sm" />
      ) : (
        <Textarea value={v} onChange={(e) => setV(e.target.value)} rows={rows} className="text-sm" />
      )}
    </div>
  );
}

function FaqEditor({ faqs, onSave }: { faqs: Faq[]; onSave: (faqs: Faq[]) => void }) {
  const [list, setList] = useState<Faq[]>(faqs);
  useEffect(() => { setList(faqs); }, [faqs]);
  const dirty = JSON.stringify(list) !== JSON.stringify(faqs);

  const update = (i: number, patch: Partial<Faq>) => {
    setList((l) => l.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  };
  const add = () => setList((l) => [...l, { q: "", a: "" }]);
  const remove = (i: number) => setList((l) => l.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">FAQs ({list.length})</label>
        <div className="flex gap-2">
          <button onClick={add} className="text-xs text-primary hover:underline">+ Add</button>
          {dirty && <button onClick={() => onSave(list)} className="text-xs text-primary hover:underline">Save</button>}
        </div>
      </div>
      <div className="space-y-3">
        {list.map((f, i) => (
          <div key={i} className="border border-input p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Q{i + 1}</span>
              <button onClick={() => remove(i)} className="text-xs text-destructive hover:underline">Remove</button>
            </div>
            <Input value={f.q} onChange={(e) => update(i, { q: e.target.value })} placeholder="Question" className="h-9 text-sm" />
            <Textarea value={f.a} onChange={(e) => update(i, { a: e.target.value })} rows={3} placeholder="Answer" className="text-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}
