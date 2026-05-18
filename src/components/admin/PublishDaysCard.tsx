import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const DAYS = [
  { dow: 0, short: "Sun", long: "Sunday" },
  { dow: 1, short: "Mon", long: "Monday" },
  { dow: 2, short: "Tue", long: "Tuesday" },
  { dow: 3, short: "Wed", long: "Wednesday" },
  { dow: 4, short: "Thu", long: "Thursday" },
  { dow: 5, short: "Fri", long: "Friday" },
  { dow: 6, short: "Sat", long: "Saturday" },
];

export function PublishDaysCard({
  clientId,
  initialDays,
  onSaved,
}: {
  clientId: string;
  initialDays: number[];
  onSaved: () => void;
}) {
  const [days, setDays] = useState<number[]>(initialDays ?? []);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDays(initialDays ?? []); }, [JSON.stringify(initialDays)]);

  const toggle = (dow: number) => {
    setDays((prev) => {
      if (prev.includes(dow)) {
        if (prev.length <= 1) return prev; // enforce min 1
        return prev.filter((d) => d !== dow);
      }
      return [...prev, dow].sort((a, b) => a - b);
    });
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("clients")
      .update({ autopilot_days: days })
      .eq("id", clientId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Publish days saved");
    onSaved();
  };

  const dirty = JSON.stringify(days) !== JSON.stringify(initialDays ?? []);

  return (
    <div className="findr-card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="section-label">PUBLISH DAYS</p>
          <p className="text-xs text-muted-foreground mt-1">
            Which weekdays this client's autopilot publishes. Baseline is 2 days per week.
          </p>
        </div>
        {dirty && (
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {DAYS.map(({ dow, short }) => {
          const active = days.includes(dow);
          return (
            <button
              key={dow}
              type="button"
              onClick={() => toggle(dow)}
              className={`px-3 py-1.5 text-xs font-medium border transition-opacity ${
                active
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-ink/60 border-ink/15 hover:text-ink"
              }`}
            >
              {short}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function formatPublishDays(days: number[] | null | undefined): string {
  if (!days || !days.length) return "—";
  return [...days].sort((a, b) => a - b).map((d) => DAYS[d]?.short ?? "").filter(Boolean).join(" · ");
}
