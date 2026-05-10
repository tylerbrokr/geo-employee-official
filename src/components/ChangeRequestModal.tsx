import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClient } from "@/hooks/useClient";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Category = "market" | "specialty" | "brand" | "profile" | "other";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ChangeRequestModal({ open, onClose }: Props) {
  const { client } = useClient();
  const [category, setCategory] = useState<Category>("market");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!client || !message.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("change_requests").insert({
      client_id: client.id,
      category,
      message: message.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Request sent. We'll get back to you shortly.");
    setMessage("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Request a change</DialogTitle>
          <DialogDescription>
            Tell us what you'd like updated. We'll handle it within 1 business day.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-[13px] font-medium mb-1.5 block">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger className="h-10 rounded-[12px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="market">Market / coverage area</SelectItem>
                <SelectItem value="specialty">Specialties</SelectItem>
                <SelectItem value="brand">Brand (colors, logo, photo)</SelectItem>
                <SelectItem value="profile">Profile info</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[13px] font-medium mb-1.5 block">What should we change?</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="e.g. Please add Gretna and Springfield to my surrounding cities."
              className="rounded-[12px]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={submitting || !message.trim()}>
              {submitting ? "Sending..." : "Send request"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
