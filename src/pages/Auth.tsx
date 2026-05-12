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
        toast.success("Account created. You're being signed in.");
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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      {/* Wordmark */}
      <div className="flex items-center gap-2.5 mb-10">
        <span
          className="w-1.5 h-1.5 rounded-none gold-pulse"
          style={{ background: "hsl(var(--gold))" }}
        />
        <span className="text-sm font-semibold tracking-[0.2em] uppercase text-foreground">
          GEO
        </span>
      </div>

      {/* Card — square, hairline ink-08 border, no shadow */}
      <div className="w-full max-w-[440px] bg-background border border-border p-10">
        <h1
          className="text-[34px] leading-[1.1] tracking-tight text-foreground"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 500 }}
        >
          {mode === "signin" ? "Welcome back." : "Create your account."}
        </h1>
        <p className="text-sm text-muted-foreground mt-2 mb-8">
          {mode === "signin"
            ? "Sign in to your GEO portal."
            : "Get started with your GEO site."}
        </p>

        <form onSubmit={submit} className="space-y-5">
          {mode === "signup" && (
            <div>
              <Label className="section-label mb-2 block">Full name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="h-11 rounded-none border-border bg-background"
              />
            </div>
          )}
          <div>
            <Label className="section-label mb-2 block">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 rounded-none border-border bg-background"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="section-label block">Password</Label>
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!email) { toast.error("Enter your email above first"); return; }
                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: `${window.location.origin}/reset-password`,
                    });
                    if (error) toast.error(error.message);
                    else toast.success("Check your email for a reset link");
                  }}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-opacity"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-11 rounded-none border-border bg-background"
            />
          </div>
          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-none font-medium tracking-wide"
          >
            {submitting
              ? "Please wait."
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-border text-center text-sm text-muted-foreground">
          {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-foreground hover:opacity-70 font-medium transition-opacity"
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </div>
      </div>

      <p className="mt-8 text-xs text-muted-foreground tracking-wide">
        A delivery tool of <span className="text-foreground">The Inner Cirql</span>.
      </p>
    </div>
  );
}
