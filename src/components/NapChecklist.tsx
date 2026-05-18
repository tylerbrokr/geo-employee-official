import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check } from "lucide-react";

export interface NapItem {
  id: string;
  item_key: string;
  status: "pending" | "done" | "skipped";
  completed_at: string | null;
  notes: string | null;
}

interface ItemMeta {
  key: string;
  title: string;
  url: string;
  how: string;
}

const ITEMS: ItemMeta[] = [
  {
    key: "gmb_verified",
    title: "Google Business Profile is verified",
    url: "https://business.google.com/",
    how: "Search for the agent's name on Google. If a profile shows up, click 'Own this business?' and complete postcard or video verification.",
  },
  {
    key: "gmb_nap_matches",
    title: "Google Business Profile NAP matches exactly",
    url: "https://business.google.com/",
    how: "Edit the profile so name, address, and phone match the canonical NAP below character-for-character. No abbreviations, no extra suite numbers.",
  },
  {
    key: "bing_places_claimed",
    title: "Bing Places listing claimed and matches",
    url: "https://www.bingplaces.com/",
    how: "Sign in with the agent's Microsoft account and import from Google or create new. Confirm the NAP matches.",
  },
  {
    key: "zillow_profile_matches",
    title: "Zillow agent profile matches",
    url: "https://www.zillow.com/agent-finder/",
    how: "Open the Zillow profile, edit contact info, and make sure the brokerage name, phone, and address are identical to the canonical NAP.",
  },
  {
    key: "realtor_profile_matches",
    title: "Realtor.com agent profile matches",
    url: "https://www.realtor.com/realestateagents/",
    how: "Edit the Realtor.com profile (via the realtor's NAR account) so the phone and brokerage info match.",
  },
  {
    key: "facebook_page_matches",
    title: "Facebook business page matches",
    url: "https://www.facebook.com/business/",
    how: "Open the agent's Facebook business page, edit About, and confirm phone + address + brokerage match the canonical NAP.",
  },
];

interface NapData {
  phone_e164: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  business_name: string | null;
  brokerage: string | null;
  full_name: string | null;
}

export function NapChecklist({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<NapItem[]>([]);
  const [nap, setNap] = useState<NapData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [{ data: rows }, { data: c }] = await Promise.all([
      supabase.from("nap_checklist").select("*").eq("client_id", clientId),
      supabase.from("clients").select("phone_e164,street_address,city,state,postal_code,business_name,brokerage,owner_user_id").eq("id", clientId).maybeSingle(),
    ]);
    setItems((rows as NapItem[]) ?? []);
    if (c) {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", (c as any).owner_user_id).maybeSingle();
      setNap({ ...c, full_name: profile?.full_name ?? null } as NapData);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [clientId]);

  const toggle = async (item: NapItem) => {
    const next = item.status === "done" ? "pending" : "done";
    const { error } = await supabase
      .from("nap_checklist")
      .update({ status: next, completed_at: next === "done" ? new Date().toISOString() : null })
      .eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  if (loading) return <div className="text-sm text-ink/50">Loading…</div>;

  const done = items.filter((i) => i.status === "done").length;
  const total = items.length || ITEMS.length;
  const napLines = [
    nap?.full_name,
    nap?.brokerage,
    nap?.street_address,
    [nap?.city, nap?.state].filter(Boolean).join(", ") + (nap?.postal_code ? " " + nap.postal_code : ""),
    nap?.phone_e164,
  ].filter((s) => s && String(s).trim().length > 0) as string[];

  return (
    <div className="space-y-6">
      <div className="findr-card">
        <p className="section-label">CANONICAL NAP</p>
        <p className="text-xs text-ink/50 mt-1">Every public profile must match these exact values. Edit on the Account page if anything is wrong.</p>
        <div className="mt-3 text-sm font-medium leading-7 whitespace-pre-line">
          {napLines.length ? napLines.join("\n") : <span className="text-ink/50 font-normal">No NAP on file yet.</span>}
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-3">
          <p className="section-label">PROFILE CHECKLIST</p>
          <p className="text-xs text-ink/50">{done}/{total} complete</p>
        </div>

        <div className="findr-card !p-0">
          {ITEMS.map((meta, i) => {
            const row = items.find((r) => r.item_key === meta.key);
            const isDone = row?.status === "done";
            return (
              <div key={meta.key}>
                <div className="px-6 py-4 flex items-start gap-4">
                  <button
                    onClick={() => row && toggle(row)}
                    disabled={!row}
                    className={`mt-0.5 w-5 h-5 border flex items-center justify-center shrink-0 ${
                      isDone ? "bg-foreground border-foreground text-background" : "border-ink/30 hover:border-ink"
                    }`}
                    aria-label={isDone ? "Mark not done" : "Mark done"}
                  >
                    {isDone && <Check className="w-3 h-3" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${isDone ? "line-through text-ink/40" : ""}`}>{meta.title}</div>
                    <div className="text-xs text-ink/50 mt-1">{meta.how}</div>
                    <a href={meta.url} target="_blank" rel="noopener noreferrer" className="text-xs text-foreground underline mt-1 inline-block">
                      Open {new URL(meta.url).hostname.replace("www.", "")} →
                    </a>
                  </div>
                </div>
                {i < ITEMS.length - 1 && <div className="fading-divider mx-6" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
