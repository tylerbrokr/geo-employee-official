import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function AdminChangeRequests() {
  const [rows, setRows] = useState<any[]>([]);
  const [response, setResponse] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await supabase
      .from("change_requests")
      .select("*, clients!inner(business_name, owner_user_id)")
      .order("created_at", { ascending: false });
    setRows(data ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const resolve = async (id: string) => {
    const msg = response[id]?.trim();
    const { error } = await supabase
      .from("change_requests")
      .update({
        status: "resolved",
        admin_response: msg || null,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Resolved");
      load();
    }
  };

  return (
    <div>
      <h1 className="page-title mb-6">Change Requests</h1>
      <div className="space-y-3">
        {rows.length === 0 && <div className="text-sm text-muted-foreground">No requests yet.</div>}
        {rows.map((r) => (
          <div key={r.id} className="findr-card">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full ${r.status === "resolved" ? "bg-muted-foreground/50" : "bg-emerald"}`} />
                <span className="font-medium">{r.clients?.business_name ?? "Client"}</span>
                <span className="text-muted-foreground">· {r.category}</span>
                <span className="text-muted-foreground">· {new Date(r.created_at).toLocaleString()}</span>
                <span className="ml-2 px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{r.status}</span>
              </div>
            </div>
            <p className="text-sm text-foreground mb-3 whitespace-pre-wrap">{r.message}</p>
            {r.status !== "resolved" && (
              <div className="space-y-2">
                <Textarea
                  rows={2}
                  placeholder="Optional response to client"
                  value={response[r.id] ?? ""}
                  onChange={(e) => setResponse({ ...response, [r.id]: e.target.value })}
                  className="rounded-[12px]"
                />
                <Button size="sm" onClick={() => resolve(r.id)}>Mark resolved</Button>
              </div>
            )}
            {r.admin_response && (
              <div className="mt-2 text-xs text-muted-foreground italic">Response: {r.admin_response}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
