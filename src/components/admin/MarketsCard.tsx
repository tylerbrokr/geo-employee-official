// Admin Markets editor.
// Lets Blake/Tyler fix typos and edit the geographic chips that drive every
// area page. On save we update client_markets directly; the existing
// `mark_areas_stale_on_markets_change` trigger flags areas as stale, and the
// next "Sync from markets" run on the Areas tab will canonicalize names,
// delete orphaned slug rows, and regenerate copy.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { X, Plus } from "lucide-react";

interface Market {
  id?: string;
  primary_city: string | null;
  primary_state: string | null;
  cities: string[];
  neighborhoods: string[];
  counties: string[];
}

const empty: Market = { primary_city: "", primary_state: "", cities: [], neighborhoods: [], counties: [] };

export function MarketsCard({ clientId, market: initial, onSaved }: { clientId: string; market: any; onSaved: () => void }) {
  const [m, setM] = useState<Market>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setM({
      id: initial?.id,
      primary_city: initial?.primary_city ?? "",
      primary_state: initial?.primary_state ?? "",
      cities: initial?.cities ?? [],
      neighborhoods: initial?.neighborhoods ?? [],
      counties: initial?.counties ?? [],
    });
  }, [initial]);

  const dirty = JSON.stringify({
    primary_city: initial?.primary_city ?? "",
    primary_state: initial?.primary_state ?? "",
    cities: initial?.cities ?? [],
    neighborhoods: initial?.neighborhoods ?? [],
    counties: initial?.counties ?? [],
  }) !== JSON.stringify({
    primary_city: m.primary_city,
    primary_state: m.primary_state,
    cities: m.cities,
    neighborhoods: m.neighborhoods,
    counties: m.counties,
  });

  const save = async () => {
    setSaving(true);
    const payload = {
      client_id: clientId,
      primary_city: m.primary_city?.trim() || null,
      primary_state: m.primary_state?.trim()?.toUpperCase() || null,
      cities: m.cities.map((s) => s.trim()).filter(Boolean),
      neighborhoods: m.neighborhoods.map((s) => s.trim()).filter(Boolean),
      counties: m.counties.map((s) => s.trim()).filter(Boolean),
    };
    const { error } = m.id
      ? await supabase.from("client_markets").update(payload).eq("id", m.id)
      : await supabase.from("client_markets").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Markets updated. Run 'Sync from markets' on the Areas tab to regenerate.");
    onSaved();
  };

  return (
    <div className="findr-card space-y-5">
      <div className="flex items-center justify-between">
        <p className="section-label">MARKETS</p>
        {dirty && (
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save markets"}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Fix typos here. Saving marks all area pages stale; the AI will canonicalize names and rewrite copy on the next sync.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Primary city</label>
          <Input value={m.primary_city ?? ""} onChange={(e) => setM({ ...m, primary_city: e.target.value })} className="h-9" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Primary state (2-letter)</label>
          <Input value={m.primary_state ?? ""} maxLength={2} onChange={(e) => setM({ ...m, primary_state: e.target.value.toUpperCase() })} className="h-9" />
        </div>
      </div>

      <ChipEditor label="Cities" items={m.cities} onChange={(v) => setM({ ...m, cities: v })} />
      <ChipEditor label="Neighborhoods" items={m.neighborhoods} onChange={(v) => setM({ ...m, neighborhoods: v })} />
      <ChipEditor label="Counties (no 'County' suffix)" items={m.counties} onChange={(v) => setM({ ...m, counties: v })} />
    </div>
  );
}

function ChipEditor({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  };
  const update = (i: number, v: string) => onChange(items.map((x, idx) => (idx === i ? v : x)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">{label}</label>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <Input value={it} onChange={(e) => update(i, e.target.value)} className="h-9 text-sm" />
            <button onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder={`Add ${label.toLowerCase().split(" ")[0]}...`}
            className="h-9 text-sm"
          />
          <Button size="sm" variant="outline" onClick={add} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Add</Button>
        </div>
      </div>
    </div>
  );
}
