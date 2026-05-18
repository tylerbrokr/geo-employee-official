import { DashboardLayout } from "@/components/DashboardLayout";
import { EngineLog } from "@/components/EngineLog";
import { useClient } from "@/hooks/useClient";

export default function Engine() {
  const { client } = useClient();
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="page-title">Engine activity</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every action your GEO engine takes. Posts published, search engine pings, area refreshes, visibility readings.
        </p>
      </div>
      {client ? <EngineLog clientId={client.id} limit={50} /> : <div className="text-sm text-ink/50">Loading…</div>}
    </DashboardLayout>
  );
}
