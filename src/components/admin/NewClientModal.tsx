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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [domainPreference, setDomainPreference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<boolean>(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [recipientEmail, setRecipientEmail] = useState<string>("");

  const reset = () => {
    setEmail(""); setFirstName(""); setLastName(""); setBusinessName(""); setDomainPreference("");
    setMagicLink(null); setEmailSent(false); setEmailError(null); setRecipientEmail("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    const { data, error } = await supabase.functions.invoke("create-client", {
      body: {
        email,
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        full_name: fullName || null,
        business_name: businessName,
        domain_preference: domainPreference.trim() || null,
      },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Failed to create client");
      return;
    }
    toast.success("Client created");
    setMagicLink((data as any).magic_link ?? null);
    setEmailSent(Boolean((data as any).email_sent));
    setEmailError((data as any).email_error ?? null);
    setRecipientEmail(email);
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
          <div className="space-y-5">
            {emailSent ? (
              <div className="border border-ink/[0.08] bg-[#faf8f4] p-4">
                <p className="text-[10px] tracking-[2px] uppercase text-ink/60 mb-2">Intake email sent</p>
                <p className="text-sm text-ink">
                  Sent to <span className="font-medium">{recipientEmail}</span> from <span className="font-mono text-xs">geo@geoemployee.com</span>.
                </p>
              </div>
            ) : (
              <div className="border border-ink/[0.08] p-4">
                <p className="text-[10px] tracking-[2px] uppercase text-ink/60 mb-2">Email not sent</p>
                <p className="text-sm text-ink/80">
                  {emailError ?? "Send the magic link below directly."}
                </p>
              </div>
            )}

            <div>
              <p className="text-[10px] tracking-[2px] uppercase text-ink/60 mb-2">Magic link (backup)</p>
              <div className="border border-ink/[0.08] bg-[#faf8f4] p-3 text-xs break-all font-mono text-ink/80">{magicLink}</div>
            </div>

            <Button onClick={copyLink} variant="outline" className="w-full gap-2">
              <Copy className="w-4 h-4" /> Copy magic link
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="text-[13px] mb-1.5 block">Email</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[13px] mb-1.5 block">First name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <Label className="text-[13px] mb-1.5 block">Last name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-[13px] mb-1.5 block">Business name (optional)</Label>
              <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
            <div>
              <Label className="text-[13px] mb-1.5 block">Domain preference (optional)</Label>
              <Input
                value={domainPreference}
                onChange={(e) => setDomainPreference(e.target.value)}
                placeholder="e.g. janesmithrealty.com"
              />
              <p className="text-xs text-ink/50 mt-1">We purchase and configure the domain. This is just a note for the team.</p>
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
