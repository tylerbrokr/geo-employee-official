import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChangeRequestModal } from "./ChangeRequestModal";
import type { ClientRow } from "@/hooks/useClient";

type StageState = "complete" | "active" | "pending";

interface Step {
  label: string;
  state: StageState;
}

interface Props {
  client: ClientRow & { pipeline_stage?: string; created_at?: string };
  variant?: "full" | "slim";
  slimMessage?: string;
}

export function SiteBuildStatus({ client, variant = "full", slimMessage }: Props) {
  const [topicCount, setTopicCount] = useState<number | null>(null);
  const [postCount, setPostCount] = useState<number | null>(null);
  const [siteRow, setSiteRow] = useState<{ dns_verified: boolean } | null>(null);
  const [crOpen, setCrOpen] = useState(false);

  useEffect(() => {
    if (!client?.id) return;
    (async () => {
      const [{ count: tc }, { count: pc }, { data: sr }] = await Promise.all([
        supabase.from("client_topics").select("id", { count: "exact", head: true }).eq("client_id", client.id),
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("client_id", client.id),
        supabase.from("client_sites").select("dns_verified").eq("client_id", client.id).maybeSingle(),
      ]);
      setTopicCount(tc ?? 0);
      setPostCount(pc ?? 0);
      setSiteRow((sr as any) ?? null);
    })();
  }, [client?.id]);

  const stage = (client as any)?.pipeline_stage ?? "draft";
  const isLive = client?.site_status === "live";

  // Compute step states
  const intakeDone = stage === "intake_complete" || stage === "in_production" || stage === "live";
  const topicsDone = (topicCount ?? 0) > 0;
  const postsDone = (postCount ?? 0) > 0;
  const siteDone = isLive;

  const firstActiveIdx = [intakeDone, topicsDone, postsDone, siteDone].findIndex((d) => !d);
  const mark = (i: number, done: boolean): StageState =>
    done ? "complete" : i === firstActiveIdx ? "active" : "pending";

  const steps: Step[] = [
    { label: "Intake received", state: mark(0, intakeDone) },
    { label: "Topic research", state: mark(1, topicsDone) },
    { label: "First posts drafted", state: mark(2, postsDone) },
    { label: "Site provisioned", state: mark(3, siteDone) },
  ];

  if (variant === "slim") {
    return (
      <div className="border border-ink/[0.08] bg-[#faf8f4] px-6 py-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-2 h-2 rounded-full bg-[#c9a96e] gold-pulse" />
          <p className="text-[10px] tracking-[2px] uppercase text-ink/50">In progress</p>
        </div>
        <p className="text-[15px] text-ink leading-relaxed">
          {slimMessage ?? "GEO is building your site. We'll let you know the moment it's ready."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border border-ink/[0.08] bg-[#faf8f4] px-8 py-10">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-[#c9a96e] gold-pulse" />
          <p className="text-[10px] tracking-[2px] uppercase text-ink/50">Build in progress</p>
        </div>
        <h2 className="font-display text-[32px] leading-[1.15] text-ink mb-2">GEO is building your site.</h2>
        <p className="text-[14px] text-ink/60 mb-8 max-w-[480px]">
          Live within 7 days. We'll email you the moment it's ready.
        </p>

        <div className="space-y-3 mb-8 max-w-[440px]">
          {steps.map((s, i) => (
            <div key={s.label} className="flex items-center gap-3 py-2 border-b border-ink/[0.06] last:border-b-0">
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  s.state === "complete"
                    ? "bg-[#c9a96e]"
                    : s.state === "active"
                    ? "bg-[#c9a96e] gold-pulse"
                    : "bg-ink/15"
                }`}
              />
              <span
                className={`text-[14px] flex-1 ${
                  s.state === "pending" ? "text-ink/40" : "text-ink"
                }`}
              >
                {s.label}
              </span>
              <span className="text-[11px] tracking-[1.5px] uppercase text-ink/40">
                {s.state === "complete" ? "Done" : s.state === "active" ? "Now" : ""}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between flex-wrap gap-4 pt-4 border-t border-ink/[0.06]">
          <p className="text-[12px] text-ink/50">
            {(client as any)?.created_at
              ? `Started ${new Date((client as any).created_at).toLocaleDateString()}.`
              : ""}
          </p>
          <button
            onClick={() => setCrOpen(true)}
            className="text-[13px] text-ink underline underline-offset-4 decoration-ink/30 hover:decoration-ink"
          >
            Have something to add?
          </button>
        </div>
      </div>
      <ChangeRequestModal open={crOpen} onClose={() => setCrOpen(false)} />
    </>
  );
}
