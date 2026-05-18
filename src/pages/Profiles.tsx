import { DashboardLayout } from "@/components/DashboardLayout";
import { useClient } from "@/hooks/useClient";
import { NapChecklist } from "@/components/NapChecklist";

export default function Profiles() {
  const { client, loading } = useClient();

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="page-title">Profiles</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI assistants cross-check your NAP across Google, Bing, Zillow, Realtor, and Facebook. Match every profile to the canonical NAP below so your authority signal is consistent.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-ink/50">Loading…</div>
      ) : client ? (
        <NapChecklist clientId={client.id} />
      ) : (
        <div className="text-sm text-ink/50">No client found.</div>
      )}
    </DashboardLayout>
  );
}
