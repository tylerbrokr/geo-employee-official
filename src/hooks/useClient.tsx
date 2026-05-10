import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

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
}

export function useClient() {
  const { user } = useAuth();
  const [client, setClient] = useState<ClientRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) {
      setClient(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("owner_user_id", user.id)
      .maybeSingle();
    setClient((data as ClientRow) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { client, loading, refetch };
}
