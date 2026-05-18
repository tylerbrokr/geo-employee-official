import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function AdminPostEditor() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!post) return;
    setDeleting(true);
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Post deleted");
    navigate("/admin/posts");
  };

  useEffect(() => {
    if (!postId) return;
    supabase.from("posts").select("*").eq("id", postId).maybeSingle().then(({ data }) => setPost(data));
  }, [postId]);

  const save = async (publish = false) => {
    if (!post) return;
    setSaving(true);
    const updates: any = {
      title: post.title,
      slug: post.slug,
      body: post.body,
      tag: post.tag,
      target_keyword: post.target_keyword,
      status: publish ? "published" : post.status,
      published_at: publish ? new Date().toISOString() : post.published_at,
    };
    const { error } = await supabase.from("posts").update(updates).eq("id", post.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(publish ? "Published" : "Saved");
    if (publish && post.client_id && post.slug) {
      // Fire-and-forget IndexNow ping. Failures surface only in edge logs.
      supabase.functions.invoke("submit-indexnow", {
        body: { client_id: post.client_id, slug: post.slug },
      }).catch(() => {});
    }
  };

  if (!post) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <Link to="/admin/posts" className="text-sm text-primary hover:underline">← Posts queue</Link>

      <div className="space-y-4">
        <div>
          <Label className="text-[13px] font-medium mb-1.5 block">Title</Label>
          <Input value={post.title ?? ""} onChange={(e) => setPost({ ...post, title: e.target.value })} className="h-10 rounded-[12px]" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label className="text-[13px] font-medium mb-1.5 block">Slug</Label>
            <Input value={post.slug ?? ""} onChange={(e) => setPost({ ...post, slug: e.target.value })} className="h-10 rounded-[12px]" />
          </div>
          <div>
            <Label className="text-[13px] font-medium mb-1.5 block">Tag</Label>
            <Input value={post.tag ?? ""} onChange={(e) => setPost({ ...post, tag: e.target.value })} className="h-10 rounded-[12px]" />
          </div>
          <div>
            <Label className="text-[13px] font-medium mb-1.5 block">Status</Label>
            <Select value={post.status} onValueChange={(v) => setPost({ ...post, status: v })}>
              <SelectTrigger className="h-10 rounded-[12px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_review">Pending review</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-[13px] font-medium mb-1.5 block">Target keyword</Label>
          <Input value={post.target_keyword ?? ""} onChange={(e) => setPost({ ...post, target_keyword: e.target.value })} className="h-10 rounded-[12px]" />
        </div>
        <div>
          <Label className="text-[13px] font-medium mb-1.5 block">Body (Markdown)</Label>
          <Textarea value={post.body ?? ""} onChange={(e) => setPost({ ...post, body: e.target.value })} rows={20} className="rounded-[12px] font-mono text-sm" />
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => save(false)} disabled={saving || deleting}>Save</Button>
          <Button variant="secondary" onClick={() => save(true)} disabled={saving || deleting}>Save & Publish</Button>
          <div className="ml-auto">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={saving || deleting}>
                  {deleting ? "Deleting..." : "Delete post"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the post from the client's site and the queue. It cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}
