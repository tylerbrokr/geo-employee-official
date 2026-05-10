import { DashboardLayout } from "@/components/DashboardLayout";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useClient } from "@/hooks/useClient";

function TagChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-surface text-foreground text-sm px-3 py-1.5 rounded-md">
      {label}
    </span>
  );
}

export default function Market() {
  const { client } = useClient();
  const [market, setMarket] = useState<any>(null);
  const [specialties, setSpecialties] = useState<string[]>([]);

  useEffect(() => {
    if (!client) return;
    supabase.from("client_markets").select("*").eq("client_id", client.id).maybeSingle().then(({ data }) => setMarket(data));
    supabase.from("client_specialties").select("specialty").eq("client_id", client.id).then(({ data }) => setSpecialties((data ?? []).map((s: any) => s.specialty)));
  }, [client]);

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="mb-8">
          <h1 className="page-title">Market</h1>
          <p className="text-sm text-muted-foreground mt-1">
            This data powers your content engine. To make changes, use the <strong>Request a Change</strong> button in the sidebar.
          </p>
        </div>

        <div className="space-y-8">
          <div className="findr-card">
            <p className="section-label mb-3">PRIMARY MARKET</p>
            <span className="text-lg font-semibold">
              {market?.primary_city ? `${market.primary_city}, ${market.primary_state ?? ""}` : "—"}
            </span>
          </div>

          <div className="findr-card">
            <p className="section-label mb-3">SURROUNDING CITIES</p>
            <div className="flex flex-wrap gap-2">
              {(market?.cities ?? []).length === 0 ? <span className="text-sm text-muted-foreground">None yet</span> : market.cities.map((c: string) => <TagChip key={c} label={c} />)}
            </div>
          </div>

          <div className="findr-card">
            <p className="section-label mb-3">NEIGHBORHOODS</p>
            <div className="flex flex-wrap gap-2">
              {(market?.neighborhoods ?? []).length === 0 ? <span className="text-sm text-muted-foreground">None yet</span> : market.neighborhoods.map((c: string) => <TagChip key={c} label={c} />)}
            </div>
          </div>

          <div className="findr-card">
            <p className="section-label mb-3">COUNTIES</p>
            <div className="flex flex-wrap gap-2">
              {(market?.counties ?? []).length === 0 ? <span className="text-sm text-muted-foreground">None yet</span> : market.counties.map((c: string) => <TagChip key={c} label={c} />)}
            </div>
          </div>

          <div className="findr-card">
            <p className="section-label mb-3">YOUR SPECIALTIES</p>
            <div className="flex flex-wrap gap-2">
              {specialties.length === 0 ? <span className="text-sm text-muted-foreground">None selected</span> : specialties.map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground">{s}</span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
