import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  children: ReactNode;
  require: "admin" | "client";
}

export function RoleGate({ children, require }: Props) {
  const { user, role, loading } = useAuth();
  const location = useLocation();
  const [intakeChecked, setIntakeChecked] = useState(false);
  const [intakeComplete, setIntakeComplete] = useState(true);

  useEffect(() => {
    if (require !== "client" || !user) {
      setIntakeChecked(true);
      return;
    }
    (async () => {
      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("owner_user_id", user.id)
        .maybeSingle();
      if (!client) {
        setIntakeComplete(false);
        setIntakeChecked(true);
        return;
      }
      const { data: intake } = await supabase
        .from("intake_status")
        .select("completed_at")
        .eq("client_id", client.id)
        .maybeSingle();
      setIntakeComplete(!!intake?.completed_at);
      setIntakeChecked(true);
    })();
  }, [user, require]);

  if (loading || !intakeChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  if (role !== require) {
    return <Navigate to={role === "admin" ? "/admin" : "/portal"} replace />;
  }

  if (require === "client" && !intakeComplete && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
