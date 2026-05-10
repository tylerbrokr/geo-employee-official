import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useClient } from "@/hooks/useClient";

export default function Account() {
  const { user, signOut } = useAuth();
  const { client } = useClient();

  const fullName = (user?.user_metadata?.full_name as string | undefined) || user?.email?.split("@")[0] || "Client";
  const initials = fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="page-title mb-8">Account</h1>

        <div className="space-y-8">
          <div>
            <p className="section-label mb-4">PROFILE</p>
            <div className="findr-card">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-semibold text-white shrink-0" style={{ background: "linear-gradient(135deg, #059669, #047857)" }}>
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold">{fullName}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  {client?.brokerage && <p className="text-sm text-muted-foreground">{client.brokerage}</p>}
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="section-label mb-4">REQUEST CHANGES</p>
            <p className="text-sm text-muted-foreground">
              Need to update your market, specialties, or brand? Use the <strong>Request a Change</strong> button in the sidebar — our team will handle it within 1 business day.
            </p>
          </div>

          <div>
            <p className="section-label mb-4">SESSION</p>
            <Button variant="secondary" onClick={signOut}>Sign out</Button>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
