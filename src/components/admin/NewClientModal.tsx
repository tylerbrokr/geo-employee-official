import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (clientId: string) => void;
}

export function NewClientModal({ open, onOpenChange, onCreated }: Props) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [magicLink, setMagicLink] = useState<string | null>(null);

  const reset = () => {
    setEmail(""); setFullName(""); setBusinessName(""); setMagicLink(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("create-client", {
      body: { email, full_name: fullName, business_name: businessName },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Failed to create client");
      return;
    }
    toast.success("Client created");
    setMagicLink((data as any).magic_link ?? null);
    onCreated?.((data as any).client_id);
  };

  const copyLink = async () => {
    if (!magicLink) return;
    await navigator.clipboard.writeText(magicLink);
    toast.success("Magic link copied");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{magicLink ? "Client created" : "New client"}</DialogTitle>
        </DialogHeader>

        {magicLink ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Send this magic link to the client to start their intake. It signs them in directly.
            </p>
            <div className="rounded-lg border bg-muted/30 p-3 text-xs break-all font-mono">{magicLink}</div>
            <Button onClick={copyLink} className="w-full gap-2">
              <Copy className="w-4 h-4" /> Copy magic link
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="text-[13px] mb-1.5 block">Email</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 rounded-[10px]" />
            </div>
            <div>
              <Label className="text-[13px] mb-1.5 block">Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-10 rounded-[10px]" />
            </div>
            <div>
              <Label className="text-[13px] mb-1.5 block">Business name (optional)</Label>
              <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="h-10 rounded-[10px]" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting || !email}>
                {submitting ? "Creating..." : "Create client"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
