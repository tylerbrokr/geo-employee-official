import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deriveSiteLiveness } from "@/lib/siteStatus";

type EventKind = "published" | "visibility" | "area" | "cache" | "indexnow";

interface EngineEvent {
  id: string;
  at: string;
  kind: EventKind;
  label: string;
  description: string;
  href?: string;
  sublabel?: string;
}

const KIND_LABEL: Record<EventKind, string> = {
  published: "Published",
  visibility: "Visibility",
  area: "Area page",
  cache: "Cache purge",
  indexnow: "IndexNow",
};

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface Props {
  clientId: string;
  limit?: number;
}

export function EngineLog({ clientId, limit = 25 }: Props) {
  const [events, setEvents] = useState<EngineEvent[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Fetch in parallel. For visibility, always pull N+1 so the oldest displayed row still has a delta.
      const [posts, vis, areas, purges, indexnow, site] = await Promise.all([
        supabase.from("posts").select("id,title,slug,published_at")
          .eq("client_id", clientId).eq("status", "published")
          .order("published_at", { ascending: false }).limit(limit),
        supabase.from("client_visibility_reports").select("id,total_score,created_at")
          .eq("client_id", clientId).order("created_at", { ascending: false }).limit(limit + 1),
        supabase.from("client_areas").select("id,name,ai_generated_at")
          .eq("client_id", clientId).not("ai_generated_at", "is", null)
          .order("ai_generated_at", { ascending: false }).limit(limit),
        supabase.from("site_cache_purges").select("id,paths,purge_trigger,status,created_at")
          .eq("client_id", clientId).order("created_at", { ascending: false }).limit(limit),
        supabase.from("indexnow_submissions").select("id,url_count,status,http_status,error_message,submitted_at")
          .eq("client_id", clientId).order("submitted_at", { ascending: false }).limit(limit),
        supabase.from("client_sites").select("subdomain,custom_domain,dns_verified")
          .eq("client_id", clientId).maybeSingle(),
      ]);

      const { liveUrl } = deriveSiteLiveness(site.data as any);
      const merged: EngineEvent[] = [];

      (posts.data ?? []).forEach((p: any) => {
        if (!p.published_at) return;
        merged.push({
          id: `post-${p.id}`,
          at: p.published_at,
          kind: "published",
          label: KIND_LABEL.published,
          description: p.title,
          href: liveUrl ? `${liveUrl}/blog/${p.slug}` : undefined,
        });
      });

      const visRows = (vis.data ?? []).slice().reverse(); // oldest first for delta math
      visRows.forEach((row: any, idx: number) => {
        if (idx === 0) return; // need a previous row for a delta
        const prev = visRows[idx - 1];
        const delta = row.total_score - prev.total_score;
        const sign = delta > 0 ? "+" : "";
        merged.push({
          id: `vis-${row.id}`,
          at: row.created_at,
          kind: "visibility",
          label: KIND_LABEL.visibility,
          description: `Visibility score ${row.total_score}/100 (${sign}${delta} vs previous)`,
        });
      });
      // If only one report exists, still show it with no delta noted.
      if ((vis.data ?? []).length === 1) {
        const row: any = vis.data![0];
        merged.push({
          id: `vis-${row.id}`,
          at: row.created_at,
          kind: "visibility",
          label: KIND_LABEL.visibility,
          description: `Visibility score ${row.total_score}/100 (first reading)`,
        });
      }

      (areas.data ?? []).forEach((a: any) => {
        merged.push({
          id: `area-${a.id}-${a.ai_generated_at}`,
          at: a.ai_generated_at,
          kind: "area",
          label: KIND_LABEL.area,
          description: `Regenerated area page: ${a.name}`,
        });
      });

      (purges.data ?? []).forEach((p: any) => {
        const paths = Array.isArray(p.paths) ? p.paths.join(", ") : "";
        merged.push({
          id: `purge-${p.id}`,
          at: p.created_at,
          kind: "cache",
          label: KIND_LABEL.cache,
          description: `Cache purge (${p.purge_trigger}) ${p.status}`,
          sublabel: paths,
        });
      });

      (indexnow.data ?? []).forEach((s: any) => {
        merged.push({
          id: `inx-${s.id}`,
          at: s.submitted_at,
          kind: "indexnow",
          label: KIND_LABEL.indexnow,
          description: `IndexNow ping: ${s.url_count} URL${s.url_count === 1 ? "" : "s"} (${s.status}${s.http_status ? ` ${s.http_status}` : ""})`,
          sublabel: s.error_message || undefined,
        });
      });

      merged.sort((a, b) => +new Date(b.at) - +new Date(a.at));
      if (!cancelled) setEvents(merged.slice(0, limit));
    })();
    return () => { cancelled = true; };
  }, [clientId, limit]);

  if (events === null) return <div className="text-sm text-ink/50">Loading…</div>;
  if (events.length === 0) {
    return <div className="findr-card text-sm text-ink/50">No engine activity yet. Events will appear here as your site publishes posts and pings search engines.</div>;
  }

  return (
    <div className="findr-card !p-0">
      {events.map((e, i) => (
        <div key={e.id}>
          <div className="px-6 py-4 flex items-start gap-4">
            <div className="w-24 shrink-0">
              <div className="text-xs text-ink/50" title={new Date(e.at).toLocaleString()}>{relTime(e.at)}</div>
            </div>
            <div className="w-28 shrink-0">
              <span className={`text-[11px] font-medium uppercase tracking-wide ${e.kind === "published" ? "text-gold" : "text-ink/60"}`}>
                {e.label}
              </span>
            </div>
            <div className="flex-1 min-w-0 text-sm">
              {e.href ? (
                <a href={e.href} target="_blank" rel="noreferrer" className="font-medium hover:underline">{e.description}</a>
              ) : (
                <span className="font-medium">{e.description}</span>
              )}
              {e.sublabel && <div className="text-xs text-ink/50 mt-0.5 truncate">{e.sublabel}</div>}
            </div>
          </div>
          {i < events.length - 1 && <div className="fading-divider mx-6" />}
        </div>
      ))}
    </div>
  );
}
