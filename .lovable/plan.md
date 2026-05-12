## Fix 1 — Add "Delete post" to the admin Post Editor

`src/pages/admin/PostEditor.tsx` has Save and Save & Publish but no delete. RLS already allows admins to delete `posts` (see `Admins manage posts` ALL policy), so no migration needed.

Changes:
- Add a destructive `Delete post` button on the right side of the action row (separated from Save / Save & Publish).
- Click → `AlertDialog` confirm ("Delete this post? This cannot be undone.").
- On confirm → `supabase.from("posts").delete().eq("id", post.id)`, toast result, navigate back to `/admin/posts` via `useNavigate`.
- Use existing `Button` `variant="destructive"` (or muted ghost styled with ink text — match the brand bible: no rounded corners, no shadows). Keep it visually deprioritized from Save.

## Fix 2 — "Client" column blank in Posts Queue

`src/pages/admin/PostsQueue.tsx` line 13 selects `clients!inner(business_name, owner_user_id)` and renders `p.clients?.business_name ?? "—"`. The test client (and most clients) won't have `business_name` populated — that field is optional on the `clients` table and isn't set during the intake wizard. The agent's actual display name lives in either `profiles.full_name` (joined via `clients.owner_user_id`) or `client_sites.agent_display_name`.

Changes (display-only, no schema change):
- Update the select to pull a usable name with fallbacks:
  ```
  .select(`
    id, title, status, created_at, client_id,
    clients!inner(
      business_name,
      brokerage,
      owner_user_id,
      profiles:owner_user_id ( full_name, email ),
      client_sites ( agent_display_name )
    )
  `)
  ```
- Render with fallback chain: `agent_display_name` → `full_name` → `business_name` → `brokerage` → `email` → `—`.
- Pull that into a small `clientLabel(p)` helper at the top of the file.

No DB migration. No edge function changes. Two files touched: `PostEditor.tsx`, `PostsQueue.tsx`.
