import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";

export default function Account() {
  return (
    <DashboardLayout>
      <h1 className="page-title mb-8">Account</h1>

      <div className="space-y-8">
        {/* Profile */}
        <div>
          <p className="section-label mb-4">PROFILE</p>
          <div className="findr-card">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-lg font-semibold text-muted-foreground shrink-0">
                SJ
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-foreground">Sarah Jones</p>
                <p className="text-sm text-muted-foreground">sarah@jonesrealtyomaha.com</p>
                <p className="text-sm text-muted-foreground">Keller Williams Greater Omaha</p>
              </div>
              <Button variant="secondary" size="sm" className="shrink-0">Edit Profile</Button>
            </div>
          </div>
        </div>

        {/* Subscription */}
        <div>
          <p className="section-label mb-4">SUBSCRIPTION</p>
          <div className="findr-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-semibold text-foreground">FindR Pro</p>
                <p className="stat-number mt-1">$197<span className="text-sm font-normal text-muted-foreground"> / month</span></p>
                <p className="text-sm text-muted-foreground mt-2">Next billing date: January 15, 2025</p>
                <span className="inline-flex items-center gap-1.5 mt-3 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
                  <span className="text-primary font-medium">Active</span>
                </span>
              </div>
              <Button variant="secondary" size="sm" className="shrink-0">Manage Subscription</Button>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div>
          <p className="section-label mb-4">DANGER ZONE</p>
          <div>
            <button className="text-sm text-danger hover:underline transition-colors">Cancel Subscription</button>
            <p className="text-xs text-muted-foreground mt-1">Your site will remain live until the end of your billing period.</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
