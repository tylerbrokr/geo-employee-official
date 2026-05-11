import { DashboardLayout } from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { useClient } from "@/hooks/useClient";
import { SiteBuildStatus } from "@/components/SiteBuildStatus";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Copy } from "lucide-react";
import { toast } from "sonner";

const SUBDOMAIN_HOST = "mygeosite.com";

export default function MySite() {
  const { client } = useClient();
  const [site, setSite] = useState<any>(null);

  useEffect(() => {
    if (!client?.id) return;
    supabase.from("client_sites").select("*").eq("client_id", client.id).maybeSingle()
      .then(({ data }) => setSite(data));
  }, [client?.id]);

  const subUrl = site?.subdomain ? `https://${site.subdomain}.${SUBDOMAIN_HOST}` : null;
  const customLive = !!(site?.custom_domain && site?.dns_verified);
  const liveUrl = customLive ? `https://${site.custom_domain}` : subUrl;
  const dns = site?.dns_records as any;
  const showDnsInstructions = !!(site?.custom_domain && !site?.dns_verified && dns);

  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success("Copied"); };

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="page-title mb-8">My Site</h1>

        {!site && client && <SiteBuildStatus client={client as any} />}

        {site && (
          <div className="space-y-6">
            <div className="findr-card-elevated">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1">
                  <p className="section-label mb-3">YOUR SITE</p>
                  {liveUrl ? (
                    <a href={liveUrl} target="_blank" rel="noreferrer" className="text-lg font-medium text-primary hover:underline">{liveUrl}</a>
                  ) : (
                    <p className="text-sm text-muted-foreground">Setting up...</p>
                  )}
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: customLive || (subUrl && !site.custom_domain) ? "#c9a96e" : "hsl(220 9% 60%)" }} />
                    <span className="text-muted-foreground">
                      {customLive ? `Live at ${site.custom_domain}` : site.custom_domain ? "Custom domain pending" : "Live"}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="section-label mb-3">BRAND</p>
                  <div className="flex gap-3">
                    <div className="text-center">
                      <div className="w-8 h-8 rounded-full mb-1 mx-auto border border-input" style={{ background: client?.primary_color ?? "#059669" }} />
                      <span className="text-[10px] text-muted-foreground">Primary</span>
                    </div>
                    <div className="text-center">
                      <div className="w-8 h-8 rounded-full mb-1 mx-auto border border-input" style={{ background: client?.accent_color ?? "#0F172A" }} />
                      <span className="text-[10px] text-muted-foreground">Accent</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {showDnsInstructions && (
              <div className="findr-card space-y-4">
                <div>
                  <p className="section-label mb-1">CONNECT YOUR CUSTOM DOMAIN</p>
                  <p className="text-sm text-muted-foreground">
                    Add these two records at your registrar. We'll detect them within 5 minutes.
                  </p>
                </div>
                {dns.cname && (
                  <div className="bg-[hsl(40_30%_96%)] p-4 border border-input">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">CNAME record</div>
                    <div className="grid grid-cols-[80px_1fr_auto] gap-3 text-sm items-center">
                      <span className="text-muted-foreground">Name</span>
                      <code className="text-xs">{dns.cname.name}</code>
                      <button onClick={() => copy(dns.cname.name)} className="text-muted-foreground hover:text-foreground"><Copy className="w-3.5 h-3.5" /></button>
                      <span className="text-muted-foreground">Value</span>
                      <code className="text-xs">{dns.cname.value}</code>
                      <button onClick={() => copy(dns.cname.value)} className="text-muted-foreground hover:text-foreground"><Copy className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                )}
                {dns.ownership && (
                  <div className="bg-[hsl(40_30%_96%)] p-4 border border-input">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{dns.ownership.type ?? "TXT"} record (ownership)</div>
                    <div className="grid grid-cols-[80px_1fr_auto] gap-3 text-sm items-center">
                      <span className="text-muted-foreground">Name</span>
                      <code className="text-xs break-all">{dns.ownership.name}</code>
                      <button onClick={() => copy(dns.ownership.name)} className="text-muted-foreground hover:text-foreground"><Copy className="w-3.5 h-3.5" /></button>
                      <span className="text-muted-foreground">Value</span>
                      <code className="text-xs break-all">{dns.ownership.value}</code>
                      <button onClick={() => copy(dns.ownership.value)} className="text-muted-foreground hover:text-foreground"><Copy className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Your subdomain {subUrl} stays live the whole time. The custom domain will switch on once verified.
                </p>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
