
-- Backfill scheduled_for for legacy scheduled posts that were created before
-- the generator started writing this field. Computes the next occurrence of
-- the client's autopilot_day after the latest existing scheduled_for (or after
-- now/last_autopublish_at), then chains +7 days per additional row.
WITH per_client AS (
  SELECT p.client_id,
         GREATEST(
           COALESCE((SELECT MAX(scheduled_for) FROM posts p2
                      WHERE p2.client_id = p.client_id
                        AND p2.status = 'scheduled'
                        AND p2.scheduled_for IS NOT NULL), 'epoch'::timestamptz),
           COALESCE(c.last_autopublish_at, now()),
           now()
         ) AS anchor_ts,
         c.autopilot_day
  FROM posts p
  JOIN clients c ON c.id = p.client_id
  WHERE p.status = 'scheduled'
    AND p.scheduled_for IS NULL
    AND c.autopilot_day IS NOT NULL
  GROUP BY p.client_id, c.autopilot_day, c.last_autopublish_at
),
ordered AS (
  SELECT p.id, p.client_id,
         ROW_NUMBER() OVER (PARTITION BY p.client_id ORDER BY p.created_at) AS rn
  FROM posts p
  JOIN per_client pc ON pc.client_id = p.client_id
  WHERE p.status = 'scheduled' AND p.scheduled_for IS NULL
),
computed AS (
  SELECT o.id,
         (date_trunc('day', pc.anchor_ts) + interval '14 hours'
           + (
               (
                 ((pc.autopilot_day - EXTRACT(DOW FROM pc.anchor_ts)::int) % 7 + 7) % 7
                 + CASE WHEN ((pc.autopilot_day - EXTRACT(DOW FROM pc.anchor_ts)::int) % 7 + 7) % 7 = 0 THEN 7 ELSE 0 END
                 + (o.rn - 1) * 7
               ) || ' days'
             )::interval
         ) AS new_sched
  FROM ordered o
  JOIN per_client pc ON pc.client_id = o.client_id
)
UPDATE posts SET scheduled_for = c.new_sched
FROM computed c
WHERE posts.id = c.id;
