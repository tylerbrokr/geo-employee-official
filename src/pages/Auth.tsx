import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Mode = "signin" | "signup";

export default function Auth() {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate(role === "admin" ? "/admin" : "/portal", { replace: true });
    }
  }, [user, role, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/portal`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created. You're being signed in...");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#F8FAFC" }}>
      <div className="flex items-center gap-2 mb-8">
        <span className="w-2.5 h-2.5 rounded-full bg-primary emerald-pulse" />
        <span className="text-xl font-bold text-foreground tracking-tight">GEO</span>
      </div>

      <div
        className="w-full max-w-[420px] rounded-2xl p-10 bg-white"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.8), 0 1px 3px rgba(0,0,0,0.06), 0 8px 24px -4px rgba(0,0,0,0.10)",
        }}
      >
        <h1 className="text-[22px] font-semibold tracking-tight">
          {mode === "signin" ? "Welcome back." : "Create your account."}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 mb-6">
          {mode === "signin" ? "Sign in to your GEO portal." : "Get started with your GEO site."}
        </p>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <Label className="text-[13px] font-medium mb-1.5 block">Full Name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required className="h-10 rounded-[12px]" />
            </div>
          )}
          <div>
            <Label className="text-[13px] font-medium mb-1.5 block">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-10 rounded-[12px]" />
          </div>
          <div>
            <Label className="text-[13px] font-medium mb-1.5 block">Password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="h-10 rounded-[12px]" />
          </div>
          <Button type="submit" disabled={submitting} className="w-full h-10 rounded-[12px] font-medium">
            {submitting ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-primary hover:underline font-medium">
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
