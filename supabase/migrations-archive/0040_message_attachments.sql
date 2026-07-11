-- Message image attachments: a jsonb array of { url, name? } objects pointing
-- at images uploaded to the part-photos bucket (messages/<conversation>/ path).
-- Text-optional photo messages become possible; the API degrades gracefully
-- (text-only) while this migration is unapplied.
alter table messages add column if not exists attachments jsonb;
