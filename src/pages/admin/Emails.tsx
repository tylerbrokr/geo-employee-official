import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Send, Eye } from "lucide-react";

const TEMPLATE_NAME = "client-intake-invite";
const TEMPLATE_DISPLAY = "Client intake invite";

interface CopyRow {
  template_name: string;
  subject: string;
  eyebrow: string;
  headline: string;
  body_paragraphs: string[];
  cta_label: string;
  signature_line_1: string;
  signature_line_2: string;
  updated_at: string;
}

export default function AdminEmails() {
  const [row, setRow] = useState<CopyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("email_template_copy")
      .select("*")
      .eq("template_name", TEMPLATE_NAME)
      .maybeSingle();
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRow(data as CopyRow);
  };

  useEffect(() => { load(); }, []);

  const refreshPreview = async (current: CopyRow) => {
    setPreviewLoading(true);
    const { data, error } = await supabase.functions.invoke("render-email-preview", {
      body: {
        templateName: TEMPLATE_NAME,
        props: {
          name: "Jane",
          magicLink: "https://www.geoemployee.com/onboarding?token=preview",
          subject: current.subject,
          eyebrow: current.eyebrow,
          headline: current.headline,
          body_paragraphs: current.body_paragraphs,
          cta_label: current.cta_label,
          signature_line_1: current.signature_line_1,
          signature_line_2: current.signature_line_2,
        },
      },
    });
    setPreviewLoading(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Preview failed");
      return;
    }
    setPreviewHtml((data as any).html ?? "");
  };

  useEffect(() => { if (row) refreshPreview(row); /* eslint-disable-next-line */ }, [row?.template_name]);

  const update = (patch: Partial<CopyRow>) => {
    if (!row) return;
    setRow({ ...row, ...patch });
  };

  const updateParagraph = (i: number, value: string) => {
    if (!row) return;
    const next = [...row.body_paragraphs];
    next[i] = value;
    setRow({ ...row, body_paragraphs: next });
  };

  const addParagraph = () => {
    if (!row) return;
    setRow({ ...row, body_paragraphs: [...row.body_paragraphs, ""] });
  };

  const removeParagraph = (i: number) => {
    if (!row) return;
    setRow({ ...row, body_paragraphs: row.body_paragraphs.filter((_, idx) => idx !== i) });
  };

  const save = async () => {
    if (!row) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("email_template_copy")
      .update({
        subject: row.subject,
        eyebrow: row.eyebrow,
        headline: row.headline,
        body_paragraphs: row.body_paragraphs,
        cta_label: row.cta_label,
        signature_line_1: row.signature_line_1,
        signature_line_2: row.signature_line_2,
        updated_by: user?.id ?? null,
      })
      .eq("template_name", TEMPLATE_NAME);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Email copy saved");
    await load();
  };

  const sendTest = async () => {
    if (!testEmail) { toast.error("Enter a test email address"); return; }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: TEMPLATE_NAME,
        recipientEmail: testEmail,
        idempotencyKey: `test-${TEMPLATE_NAME}-${Date.now()}`,
        templateData: {
          name: "Test",
          magicLink: "https://www.geoemployee.com/onboarding?token=preview",
        },
      },
    });
    setSending(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Send failed");
      return;
    }
    toast.success(`Test email queued to ${testEmail}`);
  };

  const lastUpdated = useMemo(() => {
    if (!row?.updated_at) return null;
    return new Date(row.updated_at).toLocaleString();
  }, [row?.updated_at]);

  if (loading) return <div className="text-sm text-ink/60">Loading...</div>;
  if (!row) return <div className="text-sm text-ink/60">No template found.</div>;

  return (
    <div className="space-y-8">
      <div>
        <p className="section-label mb-2">EMAIL TEMPLATES</p>
        <h1 className="page-title">Emails</h1>
        <p className="text-sm text-ink/60 mt-1">Edit the copy for transactional emails. Changes apply to the next send.</p>
      </div>

      <div className="border border-ink/[0.08] bg-white">
        <div className="px-6 py-4 border-b border-ink/[0.08] flex items-center justify-between">
          <div>
            <p className="font-display text-[20px] text-ink leading-none">{TEMPLATE_DISPLAY}</p>
            <p className="text-[11px] text-ink/50 mt-1">Sent from create-client and the "Resend intake email" button</p>
          </div>
          {lastUpdated && (
            <div className="text-right">
              <p className="text-[10px] tracking-[2px] uppercase text-ink/50">Last updated</p>
              <p className="text-[12px] text-ink/80 mt-0.5">{lastUpdated}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-0">
          {/* LEFT: form */}
          <div className="p-6 space-y-5 border-r border-ink/[0.08]">
            <div>
              <Label className="text-[11px] tracking-[1.5px] uppercase text-ink/60 mb-2 block">Subject line</Label>
              <Input value={row.subject} onChange={(e) => update({ subject: e.target.value })} />
            </div>

            <div>
              <Label className="text-[11px] tracking-[1.5px] uppercase text-ink/60 mb-2 block">Eyebrow (small label above headline)</Label>
              <Input value={row.eyebrow} onChange={(e) => update({ eyebrow: e.target.value })} />
            </div>

            <div>
              <Label className="text-[11px] tracking-[1.5px] uppercase text-ink/60 mb-2 block">Headline</Label>
              <Input value={row.headline} onChange={(e) => update({ headline: e.target.value })} />
              <p className="text-[11px] text-ink/50 mt-1.5">Use <code className="text-ink/80">{`{name}`}</code> to insert the recipient's first name. Falls back gracefully when the name is missing.</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-[11px] tracking-[1.5px] uppercase text-ink/60">Body paragraphs</Label>
                <button
                  type="button"
                  onClick={addParagraph}
                  className="flex items-center gap-1 text-[11px] text-ink/60 hover:text-ink transition-opacity"
                >
                  <Plus className="w-3 h-3" /> Add paragraph
                </button>
              </div>
              <div className="space-y-3">
                {row.body_paragraphs.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <Textarea
                      value={p}
                      onChange={(e) => updateParagraph(i, e.target.value)}
                      rows={3}
                      className="flex-1"
                    />
                    {row.body_paragraphs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeParagraph(i)}
                        className="text-ink/40 hover:text-ink self-start mt-2"
                        aria-label="Remove paragraph"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-[11px] tracking-[1.5px] uppercase text-ink/60 mb-2 block">CTA button label</Label>
              <Input value={row.cta_label} onChange={(e) => update({ cta_label: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] tracking-[1.5px] uppercase text-ink/60 mb-2 block">Signature line 1</Label>
                <Input value={row.signature_line_1} onChange={(e) => update({ signature_line_1: e.target.value })} />
              </div>
              <div>
                <Label className="text-[11px] tracking-[1.5px] uppercase text-ink/60 mb-2 block">Signature line 2</Label>
                <Input value={row.signature_line_2} onChange={(e) => update({ signature_line_2: e.target.value })} />
              </div>
            </div>

            <div className="pt-4 flex items-center gap-2 border-t border-ink/[0.08]">
              <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
              <Button variant="outline" onClick={() => row && refreshPreview(row)} disabled={previewLoading} className="gap-2">
                <Eye className="w-4 h-4" /> {previewLoading ? "Rendering..." : "Refresh preview"}
              </Button>
            </div>

            <div className="pt-5 border-t border-ink/[0.08]">
              <Label className="text-[11px] tracking-[1.5px] uppercase text-ink/60 mb-2 block">Send a test email</Label>
              <p className="text-[11px] text-ink/50 mb-3">Sends the current saved copy. Save first if you want to test unsaved changes.</p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="flex-1"
                />
                <Button variant="outline" onClick={sendTest} disabled={sending || !testEmail} className="gap-2">
                  <Send className="w-4 h-4" /> {sending ? "Sending..." : "Send test"}
                </Button>
              </div>
            </div>
          </div>

          {/* RIGHT: preview */}
          <div className="bg-[#faf8f4] p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] tracking-[2px] uppercase text-ink/50">Preview</p>
              <p className="text-[11px] text-ink/50 truncate ml-3">Subject: <span className="text-ink/80">{row.subject}</span></p>
            </div>
            <div className="border border-ink/[0.08] bg-white overflow-hidden" style={{ height: "calc(100vh - 280px)", minHeight: 600 }}>
              {previewLoading ? (
                <div className="h-full flex items-center justify-center text-sm text-ink/50">Rendering preview...</div>
              ) : (
                <iframe
                  title="Email preview"
                  srcDoc={previewHtml}
                  className="w-full h-full border-0"
                  sandbox=""
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
