import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useClient } from "@/hooks/useClient";

export default function MySite() {
  const { client } = useClient();
  const initials = (client?.business_name ?? "GEO").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="page-title mb-8">My Site</h1>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <div className="findr-card-elevated h-full flex items-center justify-center min-h-[400px]">
              <div className="text-center w-full">
                <div className="w-full aspect-[16/10] bg-surface rounded-lg flex flex-col items-center justify-center mb-4 px-10 py-16">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full" style={{ background: client?.primary_color ?? "#059669" }} />
                    <span className="text-lg font-bold">{client?.business_name ?? "Your Site"}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{client?.site_url ?? "Not yet provisioned"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div>
              <p className="section-label mb-4">SITE DETAILS</p>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">URL</span>
                  <span className="font-medium text-primary truncate ml-3">{client?.site_url ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium flex items-center gap-1.5 capitalize">
                    <span className={`w-1.5 h-1.5 rounded-full ${client?.site_status === "live" ? "bg-emerald" : "bg-muted-foreground/50"}`} />
                    {client?.site_status ?? "pending"}
                  </span>
                </div>
              </div>
            </div>

            <div className="fading-divider" />

            <div>
              <p className="section-label mb-4">BRAND SETTINGS</p>
              <div className="flex gap-4 mb-4">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full mb-1.5 mx-auto border border-input" style={{ background: client?.primary_color ?? "#059669" }} />
                  <span className="text-xs text-muted-foreground">Primary</span>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full mb-1.5 mx-auto border border-input" style={{ background: client?.accent_color ?? "#0F172A" }} />
                  <span className="text-xs text-muted-foreground">Accent</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground italic">
                Want to change brand settings? Use Request a Change.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
