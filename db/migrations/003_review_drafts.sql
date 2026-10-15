-- The rep's work-in-progress review lives on the submission (intake zone), so it is
-- wiped with everything else at purge. It becomes training rows only on Send (Phase 3).
ALTER TABLE submissions ADD COLUMN draft jsonb;
ALTER TABLE submissions ADD COLUMN draft_updated_at timestamptz;

-- Keep files in the order the family uploaded them (page order for photos).
ALTER TABLE submission_files ADD COLUMN position int NOT NULL DEFAULT 0;
