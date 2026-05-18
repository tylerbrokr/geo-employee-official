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
  const [client, setClient] = useState<any>(null);
  const [purges, setPurges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [domainInput, setDomainInput] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: p }, { data: c }] = await Promise.all([
      supabase.from("client_sites").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("site_cache_purges").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(10),
      supabase.from("clients").select("domain_preference").eq("id", clientId).maybeSingle(),
    ]);
    setSite(s);
    setPurges(p ?? []);
    setClient(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, [clientId]);

  const provisionSubdomain = async () => {
    setBusy("provision");
    const { data, error } = await supabase.functions.invoke("provision-site", {
      body: { client_id: clientId, custom_domain: null },
    });
    setBusy(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Provision failed");
      return;
    }
    toast.success("Site provisioned");
    load();
  };

  const connectDomain = async () => {
    const domain = domainInput.trim().toLowerCase();
    if (!domain) { toast.error("Enter a domain"); return; }
    setBusy("connect");
    const { data, error } = await supabase.functions.invoke("provision-custom-domain", {
      body: { client_id: clientId, custom_domain: domain },
    });
    setBusy(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Connect failed");
      return;
    }
    toast.success("Domain connected. Add the DNS records to verify.");
    setDomainInput("");
    load();
  };

  const removeDomain = async () => {
    if (!confirm("Disconnect this domain? Only do this if we're replacing it.")) return;
    setBusy("remove");
    const { data, error } = await supabase.functions.invoke("remove-custom-hostname", {
      body: { client_id: clientId },
    });
    setBusy(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Remove failed");
      return;
    }
    toast.success("Domain disconnected");
    load();
  };

  const recheck = async () => {
    setBusy("recheck");
    const { error } = await supabase.functions.invoke("verify-custom-domains", {
      body: { client_id: clientId },
    });
    setBusy(null);
    if (error) toast.error(error.message);
    else { toast.success("Re-checked with Cloudflare"); load(); }
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
        <Button size="sm" onClick={provisionSubdomain} disabled={busy === "provision"} className="gap-2">
          <Globe className="w-4 h-4" /> {busy === "provision" ? "Provisioning..." : "Provision site"}
        </Button>
      </div>
    );
  }

  const subUrl = site.subdomain ? `https://${site.subdomain}.${SUBDOMAIN_HOST}` : null;
  const dns = site.dns_records as any;
  const hasHostname = !!site.cloudflare_hostname_id;
  const isActive = !!site.dns_verified;

  const renameSubdomain = async () => {
    const current = site?.subdomain ?? "";
    const next = window.prompt(
      "New subdomain (lowercase, a-z 0-9 hyphens, 2-40 chars).\n\nThe old URL will stop working immediately.",
      current,
    );
    if (!next || next.trim() === current) return;
    setBusy("rename");
    const { data, error } = await supabase.functions.invoke("rename-subdomain", {
      body: { client_id: clientId, new_subdomain: next.trim() },
    });
    setBusy(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Rename failed");
      return;
    }
    toast.success(`Renamed to ${(data as any).subdomain}`);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="findr-card">
        <div className="flex items-center justify-between mb-3">
          <p className="section-label">SUBDOMAIN</p>
          {site.subdomain && (
            <button onClick={renameSubdomain} disabled={busy === "rename"} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
              <Pencil className="w-3 h-3" /> {busy === "rename" ? "Renaming..." : "Rename"}
            </button>
          )}
        </div>
        {subUrl ? (
          <div className="flex items-center justify-between">
            <a href={subUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">{subUrl}</a>
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live
            </span>
          </div>
        ) : (
          <Button size="sm" onClick={provisionSubdomain} disabled={busy === "provision"}>Allocate subdomain</Button>
        )}
      </div>

      <div className="findr-card space-y-4">
        <p className="section-label">CUSTOM DOMAIN</p>

        {!hasHostname && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Enter the domain we purchased for this client. We provision SSL automatically once DNS is in place.</p>
            {client?.domain_preference && (
              <p className="text-xs text-ink/60">
                Domain preference from intake: <span className="font-medium text-ink">{client.domain_preference}</span>
              </p>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="www.yourdomain.com"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                className="h-9"
              />
              <Button size="sm" onClick={connectDomain} disabled={busy === "connect"}>
                {busy === "connect" ? "Connecting..." : "Connect Domain"}
              </Button>
            </div>
          </div>
        )}

        {hasHostname && !isActive && (
          <div className="space-y-4">
            <div>
              <p className="font-medium text-sm mb-1">Add these DNS records at the registrar</p>
              <p className="text-xs text-muted-foreground">DNS changes can take up to 48 hours. We check every 15 minutes automatically.</p>
            </div>

            <div className="border border-input">
              <div className="grid grid-cols-[80px_140px_1fr_32px] gap-2 px-3 py-2 bg-[hsl(40_30%_96%)] text-[10px] uppercase tracking-wider text-muted-foreground border-b border-input">
                <span>Type</span><span>Name</span><span>Value</span><span></span>
              </div>
              {dns?.cname && (
                <div className="grid grid-cols-[80px_140px_1fr_32px] gap-2 px-3 py-2 text-xs items-center border-b border-input">
                  <span className="font-medium">CNAME</span>
                  <code>{dns.cname.name}</code>
                  <code className="break-all">{dns.cname.value}</code>
                  <button onClick={() => copy(dns.cname.value)} className="text-muted-foreground hover:text-foreground"><Copy className="w-3.5 h-3.5" /></button>
                </div>
              )}
              {dns?.ownership_txt && (
                <div className="grid grid-cols-[80px_140px_1fr_32px] gap-2 px-3 py-2 text-xs items-center">
                  <span className="font-medium">TXT</span>
                  <code className="break-all">{dns.ownership_txt.name}</code>
                  <code className="break-all">{dns.ownership_txt.value}</code>
                  <button onClick={() => copy(dns.ownership_txt.value)} className="text-muted-foreground hover:text-foreground"><Copy className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-muted-foreground">Waiting for DNS propagation · {site.verify_attempts ?? 0} checks</span>
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={recheck} disabled={busy === "recheck"} className="gap-2">
                  <RefreshCw className={`w-4 h-4 ${busy === "recheck" ? "animate-spin" : ""}`} /> Re-check now
                </Button>
                <button onClick={removeDomain} disabled={busy === "remove"} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                  {busy === "remove" ? "Removing..." : "Remove domain"}
                </button>
              </div>
            </div>
          </div>
        )}

        {hasHostname && isActive && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Live at</p>
                <a href={`https://${site.custom_domain}`} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">
                  https://{site.custom_domain}
                </a>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Verified {site.last_verified_at ? new Date(site.last_verified_at).toLocaleString() : "—"}
            </div>
            <button onClick={removeDomain} disabled={busy === "remove"} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
              {busy === "remove" ? "Disconnecting..." : "Disconnect domain"}
            </button>
          </div>
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
