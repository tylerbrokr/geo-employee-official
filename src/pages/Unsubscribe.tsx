import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Status = "loading" | "ready" | "already" | "invalid" | "submitting" | "done" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`;
    fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          setError(data?.error ?? "Invalid link");
          setStatus("invalid");
          return;
        }
        if (data?.already_unsubscribed) { setStatus("already"); setEmail(data?.email ?? null); return; }
        setEmail(data?.email ?? null);
        setStatus("ready");
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  const confirm = async () => {
    setStatus("submitting");
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
    if (error || (data as any)?.error) {
      setError((data as any)?.error ?? error?.message ?? "Could not unsubscribe");
      setStatus("error");
      return;
    }
    setStatus("done");
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="max-w-[480px] w-full border border-ink/[0.08] p-12">
        <p className="text-[10px] tracking-[2px] uppercase text-ink/60 mb-6">The Inner Cirql · GEO</p>
        <h1 className="font-display text-[32px] leading-tight text-ink mb-6">
          {status === "loading" && "Checking your link..."}
          {status === "ready" && "Unsubscribe from GEO emails"}
          {status === "already" && "You are already unsubscribed"}
          {status === "submitting" && "Processing..."}
          {status === "done" && "You are unsubscribed"}
          {status === "invalid" && "Link not valid"}
          {status === "error" && "Something went wrong"}
        </h1>

        {email && (status === "ready" || status === "already" || status === "done") && (
          <p className="text-[15px] text-ink/80 leading-relaxed mb-6">{email}</p>
        )}

        {status === "ready" && (
          <>
            <p className="text-[15px] text-ink/80 leading-relaxed mb-8">
              Confirm to stop receiving messages from this address. You can still sign in to your portal.
            </p>
            <Button onClick={confirm} className="w-full">Confirm unsubscribe</Button>
          </>
        )}

        {status === "done" && (
          <p className="text-[15px] text-ink/80 leading-relaxed">You will no longer receive these emails.</p>
        )}

        {(status === "invalid" || status === "error") && (
          <p className="text-[15px] text-ink/80 leading-relaxed">{error ?? "This link may have expired or already been used."}</p>
        )}
      </div>
    </div>
  );
}
