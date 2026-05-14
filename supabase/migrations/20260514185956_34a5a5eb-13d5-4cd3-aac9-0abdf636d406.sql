UPDATE client_topics
   SET status = 'queued', used_at = NULL
 WHERE id IN (
   SELECT topic_id FROM posts
    WHERE length(body) = 0 AND status = 'scheduled' AND topic_id IS NOT NULL
 );

DELETE FROM posts WHERE length(body) = 0 AND status = 'scheduled';