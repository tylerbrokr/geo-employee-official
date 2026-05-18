import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

interface Check {
  id: string;
  label: string;
  category: "profile" | "infra" | "schema" | "content";
  points: number;
  max: number;
  status: "pass" | "fail" | "partial";
  detail: string;
  fix_hint: string;
}

interface Report {
  id: string;
  total_score: number;
  profile_score: number;
  infra_score: number;
  schema_score: number;
  content_score: number;
  checks: Check[];
  hostname: string | null;
  created_at: string;
}

const CATEGORY_LABELS: Record<Check["category"], string> = {
  profile: "Profile",
  infra: "Infrastructure",
  schema: "Schema + meta",
  content: "Content + freshness",
};

function band(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "Excellent", color: "hsl(160 84% 30%)" };
  if (score >= 75) return { label: "Good", color: "hsl(160 84% 30%)" };
  if (score >= 50) return { label: "Needs work", color: "hsl(35 90% 45%)" };
  return { label: "At risk", color: "hsl(0 75% 45%)" };
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.floor(h / 24)} d ago`;
}

const DAY_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function formatDays(days: number[]): string {
  return [...days].sort((a,b)=>a-b).map(d => DAY_SHORT[d]).filter(Boolean).join("/");
}

export function VisibilityCard({ clientId }: { clientId: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [site, setSite] = useState<{ last_indexnow_at: string | null; last_indexnow_count: number | null } | null>(null);
  const [days, setDays] = useState<number[]>([]);
  const [bufferCount, setBufferCount] = useState<number>(0);

  const load = async () => {
    const [{ data: r }, { data: s }, { data: c }, { count }] = await Promise.all([
      supabase
        .from("client_visibility_reports")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("client_sites")
        .select("last_indexnow_at,last_indexnow_count")
        .eq("client_id", clientId)
        .maybeSingle(),
      supabase
        .from("clients")
        .select("autopilot_days,autopilot_enabled")
        .eq("id", clientId)
        .maybeSingle(),
      supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .in("status", ["draft", "pending_review", "scheduled"]),
    ]);
    setReport(r as any);
    setSite((s as any) ?? null);
    setDays(((c as any)?.autopilot_days ?? []) as number[]);
    setBufferCount(count ?? 0);
    setLoading(false);
  };

  useEffect(() => { load(); }, [clientId]);

  const run = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("score-ai-visibility", { body: { client_id: clientId } });
    setRunning(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Failed");
      return;
    }
    toast.success("Visibility check complete");
    load();
  };

  if (loading) return null;

  if (!report) {
    return (
      <div className="findr-card flex items-center justify-between">
        <div>
          <p className="section-label">AI VISIBILITY</p>
          <p className="text-sm text-muted-foreground mt-1">No report yet. Run the first check to see how this site scores for LLM citation.</p>
        </div>
        <Button size="sm" onClick={run} disabled={running} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${running ? "animate-spin" : ""}`} />
          {running ? "Running..." : "Run check"}
        </Button>
      </div>
    );
  }

  const b = band(report.total_score);
  const cats: Check["category"][] = ["profile", "infra", "schema", "content"];
  const catData = cats.map((c) => {
    const subset = report.checks.filter((x) => x.category === c);
    const points = subset.reduce((s, x) => s + x.points, 0);
    const max = subset.reduce((s, x) => s + x.max, 0);
    const failing = subset.filter((x) => x.status !== "pass");
    return { c, points, max, failing };
  });

  return (
    <div className="findr-card">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="section-label">AI VISIBILITY</p>
          <p className="text-xs text-muted-foreground mt-1">
            <span style={{ color: b.color }} className="font-semibold">{b.label}</span>
            <span className="mx-2">·</span>
            last checked {relTime(report.created_at)}
            {report.hostname && <> · {report.hostname}</>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-3xl font-semibold leading-none" style={{ color: b.color }}>
              {report.total_score}
              <span className="text-base text-muted-foreground font-normal">/100</span>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={run} disabled={running} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${running ? "animate-spin" : ""}`} />
            {running ? "Running..." : "Re-run"}
          </Button>
        </div>
      </div>

      <div className="w-full h-2 bg-muted overflow-hidden mb-5">
        <div className="h-full transition-all" style={{ width: `${report.total_score}%`, background: b.color }} />
      </div>

      <div className="text-xs text-muted-foreground mb-4 flex flex-wrap gap-x-4 gap-y-1">
        <span>
          autopilot{" "}
          {days.length ? <span className="font-medium text-foreground">on · {formatDays(days)} · {bufferCount} buffered draft{bufferCount === 1 ? "" : "s"}</span> : <span className="font-medium text-foreground">off</span>}
        </span>
        <span>
          IndexNow:{" "}
          {site?.last_indexnow_at
            ? <span className="font-medium text-foreground">last ping {relTime(site.last_indexnow_at)} · {site.last_indexnow_count ?? 0} URL{(site.last_indexnow_count ?? 0) === 1 ? "" : "s"}</span>
            : <span className="font-medium text-foreground">no pings yet</span>}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {catData.map(({ c, points, max, failing }) => (
          <div key={c} className="border-l border-border pl-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{CATEGORY_LABELS[c]}</div>
            <div className="text-lg font-semibold mt-1">{points}<span className="text-sm text-muted-foreground">/{max}</span></div>
            <div className="text-xs text-muted-foreground mt-1">
              {failing.length === 0 ? "all checks passing" : `${failing.length} issue${failing.length > 1 ? "s" : ""}`}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setExpanded((e) => !e)}
        className="mt-5 text-xs font-medium text-foreground hover:text-muted-foreground flex items-center gap-1 transition-colors"
      >
        {expanded ? <>Hide full checklist <ChevronUp className="w-3 h-3" /></> : <>View full checklist <ChevronDown className="w-3 h-3" /></>}
      </button>

      {expanded && (
        <div className="mt-4 border-t border-border pt-4 space-y-1">
          {cats.map((c) => {
            const subset = report.checks.filter((x) => x.category === c);
            return (
              <div key={c} className="mb-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{CATEGORY_LABELS[c]}</div>
                {subset.map((check) => {
                  const color = check.status === "pass" ? "hsl(160 84% 30%)" : check.status === "partial" ? "hsl(35 90% 45%)" : "hsl(0 75% 45%)";
                  const mark = check.status === "pass" ? "✓" : check.status === "partial" ? "◐" : "✗";
                  return (
                    <div key={check.id} className="grid grid-cols-[20px_1fr_60px] gap-3 py-2 text-sm">
                      <span style={{ color }} className="font-semibold">{mark}</span>
                      <div>
                        <div>{check.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{check.detail}</div>
                        {check.status !== "pass" && (
                          <div className="text-xs text-muted-foreground mt-0.5 italic">→ {check.fix_hint}</div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground text-right tabular-nums">{check.points}/{check.max}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
