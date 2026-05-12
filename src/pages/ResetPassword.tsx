import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery token from the URL hash and emits a
    // PASSWORD_RECOVERY event. Either path lands here with a session.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (password !== confirm) { toast.error("Passwords don't match"); return; }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password set. Signing you in.");
    const { data: roles } = await supabase.from("user_roles").select("role");
    const isAdmin = roles?.some((r) => r.role === "admin");
    navigate(isAdmin ? "/admin" : "/portal", { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <div className="flex items-center gap-2.5 mb-10">
        <span className="w-1.5 h-1.5 rounded-none gold-pulse" style={{ background: "hsl(var(--gold))" }} />
        <span className="text-sm font-semibold tracking-[0.2em] uppercase text-foreground">GEO</span>
      </div>
      <div className="w-full max-w-[440px] bg-background border border-border p-10">
        <h1
          className="text-[34px] leading-[1.1] tracking-tight text-foreground"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 500 }}
        >
          Set a new password.
        </h1>
        <p className="text-sm text-muted-foreground mt-2 mb-8">
          Choose a password you'll use to sign back in to your portal.
        </p>

        {!ready ? (
          <p className="text-sm text-muted-foreground">Verifying your reset link.</p>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div>
              <Label className="section-label mb-2 block">New password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="h-11" />
            </div>
            <div>
              <Label className="section-label mb-2 block">Confirm password</Label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} className="h-11" />
            </div>
            <Button type="submit" disabled={submitting} className="w-full h-11 rounded-none font-medium tracking-wide">
              {submitting ? "Saving." : "Save password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
