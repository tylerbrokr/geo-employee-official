import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { deriveSiteLiveness, type ClientSiteRow } from "@/lib/siteStatus";

export interface ClientRow {
  id: string;
  owner_user_id: string;
  business_name: string | null;
  brokerage: string | null;
  years_experience: string | null;
  phone: string | null;
  headshot_url: string | null;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  site_url: string | null;
  site_status: "pending" | "building" | "live";
  autopilot_day: number | null;
  autopilot_days: number[] | null;
  autopilot_enabled: boolean;
  last_autopublish_at: string | null;
}

export function useClient() {
  const { user } = useAuth();
  const [client, setClient] = useState<ClientRow | null>(null);
  const [site, setSite] = useState<ClientSiteRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) {
      setClient(null);
      setSite(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("owner_user_id", user.id)
      .maybeSingle();
    setClient((data as ClientRow) ?? null);

    if (data?.id) {
      const { data: s } = await supabase
        .from("client_sites")
        .select("subdomain, custom_domain, dns_verified")
        .eq("client_id", data.id)
        .maybeSingle();
      setSite((s as ClientSiteRow) ?? null);
    } else {
      setSite(null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const { isLive, liveUrl } = deriveSiteLiveness(site);

  return { client, site, isLive, liveUrl, loading, refetch };
}
