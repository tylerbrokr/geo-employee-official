import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { RefreshCw, Globe, Copy, Pencil } from "lucide-react";

interface Props { clientId: string }

const SUBDOMAIN_HOST = "mygeosite.com";

export function DomainTab({ clientId }: Props) {
  const [site, setSite] = useState<any>(null);
  const [purges, setPurges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from("client_sites").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("site_cache_purges").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(10),
    ]);
    setSite(s);
    setPurges(p ?? []);
    setCustomInput(s?.custom_domain ?? "");
    setLoading(false);
  };

  useEffect(() => { load(); }, [clientId]);

  const provision = async (custom_domain?: string | null) => {
    setBusy("provision");
    const { data, error } = await supabase.functions.invoke("provision-site", {
      body: { client_id: clientId, custom_domain: custom_domain ?? null },
    });
    setBusy(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Provision failed");
      return;
    }
    toast.success(custom_domain ? "Custom domain saved" : "Site provisioned");
    load();
  };

  const recheck = async () => {
    setBusy("recheck");
    const { data, error } = await supabase.functions.invoke("verify-domains", {
      body: { client_id: clientId },
    });
    setBusy(null);
    if (error) toast.error(error.message);
    else { toast.success("Re-checked with Cloudflare"); load(); }
    void data;
  };

  const purgeNow = async () => {
    if (!site) return;
    const hostname = site.dns_verified && site.custom_domain
      ? site.custom_domain
      : site.subdomain ? `${site.subdomain}.${SUBDOMAIN_HOST}` : null;
    if (!hostname) { toast.error("No hostname yet"); return; }
    setBusy("purge");
    const { error } = await supabase.from("site_cache_purges").insert({
      client_id: clientId,
      hostname,
      paths: ["/"],
      purge_trigger: "manual",
    });
    setBusy(null);
    if (error) toast.error(error.message);
    else { toast.success("Purge queued"); load(); }
  };

  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success("Copied"); };

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  if (!site) {
    return (
      <div className="findr-card">
        <p className="section-label mb-3">SITE</p>
        <p className="text-sm text-muted-foreground mb-4">No site provisioned yet. Click below to allocate a subdomain.</p>
        <Button size="sm" onClick={() => provision(null)} disabled={busy === "provision"} className="gap-2">
          <Globe className="w-4 h-4" /> {busy === "provision" ? "Provisioning..." : "Provision site"}
        </Button>
      </div>
    );
  }

  const subUrl = site.subdomain ? `https://${site.subdomain}.${SUBDOMAIN_HOST}` : null;
  const customLive = !!(site.custom_domain && site.dns_verified);
  const dns = site.dns_records as any;

  return (
    <div className="space-y-6">
      <div className="findr-card">
        <p className="section-label mb-3">SUBDOMAIN</p>
        {subUrl ? (
          <div className="flex items-center justify-between">
            <a href={subUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">{subUrl}</a>
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live
            </span>
          </div>
        ) : (
          <Button size="sm" onClick={() => provision(null)} disabled={busy === "provision"}>Allocate subdomain</Button>
        )}
      </div>

      <div className="findr-card space-y-4">
        <p className="section-label">CUSTOM DOMAIN</p>
        <div className="flex gap-2">
          <Input
            placeholder="agent.example.com"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            className="h-9"
          />
          <Button size="sm" onClick={() => provision(customInput.trim() || null)} disabled={busy === "provision"}>
            {busy === "provision" ? "Saving..." : site.custom_domain ? "Update" : "Set"}
          </Button>
        </div>

        {site.custom_domain && (
          <>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Domain</div>
                <div className="font-medium">{site.custom_domain}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">DNS</div>
                <span className={`text-xs font-medium ${site.dns_verified ? "text-emerald-700" : "text-muted-foreground"}`}>
                  {site.dns_verified ? "Verified" : "Pending"}
                </span>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">SSL</div>
                <span className="text-xs font-medium capitalize">{site.ssl_status ?? "—"}</span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Last checked: {site.last_verified_at ? new Date(site.last_verified_at).toLocaleString() : "never"} · {site.verify_attempts ?? 0} attempts
            </div>

            {!customLive && dns && (
              <div className="bg-[hsl(40_30%_96%)] p-4 space-y-3 text-sm border border-input">
                <p className="font-medium">DNS records to add at the registrar</p>
                {dns.cname && (
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs">CNAME · {dns.cname.name} → {dns.cname.value}</code>
                    <button onClick={() => copy(dns.cname.value)} className="text-muted-foreground hover:text-foreground"><Copy className="w-3.5 h-3.5" /></button>
                  </div>
                )}
                {dns.ownership && (
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs break-all">{dns.ownership.type ?? "TXT"} · {dns.ownership.name} → {dns.ownership.value}</code>
                    <button onClick={() => copy(dns.ownership.value)} className="text-muted-foreground hover:text-foreground"><Copy className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
            )}

            <Button size="sm" variant="outline" onClick={recheck} disabled={busy === "recheck"} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${busy === "recheck" ? "animate-spin" : ""}`} /> Re-check now
            </Button>
          </>
        )}
      </div>

      <div className="findr-card space-y-3">
        <div className="flex items-center justify-between">
          <p className="section-label">RECENT CACHE PURGES</p>
          <Button size="sm" variant="outline" onClick={purgeNow} disabled={busy === "purge"}>Purge cache</Button>
        </div>
        {purges.length === 0 ? (
          <p className="text-sm text-muted-foreground">No purges yet.</p>
        ) : (
          <div className="text-xs">
            {purges.map((p) => (
              <div key={p.id} className="grid grid-cols-[1fr_120px_90px_140px] gap-3 py-2 border-b border-input last:border-0">
                <span className="truncate">{p.purge_trigger} · {p.paths?.join(", ")}</span>
                <span className="text-muted-foreground truncate">{p.hostname}</span>
                <span className={p.status === "success" ? "text-emerald-700" : p.status === "dead" ? "text-destructive" : "text-muted-foreground"}>
                  {p.status} ({p.attempt_count})
                </span>
                <span className="text-muted-foreground">{new Date(p.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
