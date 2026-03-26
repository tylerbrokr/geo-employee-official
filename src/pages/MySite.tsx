import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function MySite() {
  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="page-title mb-8">My Site</h1>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Site Preview — 3 cols */}
          <div className="lg:col-span-3">
            <div className="findr-card-elevated h-full flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="w-full aspect-[16/10] bg-surface rounded-lg flex flex-col items-center justify-center mb-4 px-10 py-16">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-emerald" />
                    <span className="text-lg font-bold text-foreground">FindR</span>
                  </div>
                  <p className="text-sm text-muted-foreground">sarahjones-omaha.netlify.app</p>
                </div>
              </div>
            </div>
          </div>

          {/* Site Details — 2 cols */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <p className="section-label mb-4">SITE DETAILS</p>
              <div className="space-y-3">
                {[
                  { label: "URL", value: "sarahjones-omaha.netlify.app", accent: true },
                  { label: "Status", value: "Live and publishing", dot: true },
                  { label: "Created", value: "November 15, 2024" },
                  { label: "Total Posts", value: "14" },
                  { label: "Last Updated", value: "Today" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className={`font-medium flex items-center gap-1.5 ${item.accent ? "text-primary" : "text-foreground"}`}>
                      {item.dot && <span className="w-1.5 h-1.5 rounded-full bg-emerald" />}
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="fading-divider" />

            <div>
              <p className="section-label mb-3">CUSTOM DOMAIN</p>
              <p className="text-sm text-muted-foreground mb-3">No custom domain connected</p>
              <Button variant="secondary" size="sm">Connect Domain</Button>
            </div>

            <div className="fading-divider" />

            <div>
              <p className="section-label mb-4">BRAND SETTINGS</p>
              <div className="flex gap-4 mb-4">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald mb-1.5 mx-auto" />
                  <span className="text-xs text-muted-foreground">Primary</span>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-navy mb-1.5 mx-auto" />
                  <span className="text-xs text-muted-foreground">Accent</span>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                  SJ
                </div>
                <button className="text-sm text-primary hover:text-emerald-hover transition-colors">Update Photo</button>
              </div>

              <div className="flex items-center gap-3 mb-5">
                <div className="w-20 h-12 rounded-lg border border-dashed border-border flex items-center justify-center">
                  <span className="text-[10px] text-muted-foreground">No logo</span>
                </div>
                <button className="text-sm text-primary hover:text-emerald-hover transition-colors">Upload Logo</button>
              </div>

              <Button variant="default" size="sm">Edit Brand Settings</Button>
            </div>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
