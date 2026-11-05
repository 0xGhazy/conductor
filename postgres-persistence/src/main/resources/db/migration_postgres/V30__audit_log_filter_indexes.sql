-- Indexes for the audit log screen's filters.
--
-- Every list query is "filter, then newest first (created_at DESC, id DESC), one page". Each index
-- below leads with an equality filter and ends with that order, so a filtered page reads a few
-- index entries instead of sorting every match. The log is append-only, so each index costs one
-- extra entry per audited call; nothing indexes the free-text search (see the note at the end).

-- Unfiltered pages and time windows; id makes the order total, so pages never overlap.
DROP INDEX IF EXISTS idx_audit_log_created_at;
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at_id ON conductor_audit_log (created_at DESC, id DESC);

-- "Show all by this actor".
DROP INDEX IF EXISTS idx_audit_log_actor;
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_created_at ON conductor_audit_log (actor_id, created_at DESC);

-- "Show all for this resource" (type + id) and the resource type filter alone.
DROP INDEX IF EXISTS idx_audit_log_resource;
CREATE INDEX IF NOT EXISTS idx_audit_log_resource_created_at
    ON conductor_audit_log (resource_type, resource_id, created_at DESC);

-- The action filter.
CREATE INDEX IF NOT EXISTS idx_audit_log_action_created_at ON conductor_audit_log (action, created_at DESC);

-- Failures are few and are what an investigation looks for; a partial index keeps them cheap to
-- page through. SUCCESS is most rows, so an index on it would not beat the time index.
CREATE INDEX IF NOT EXISTS idx_audit_log_failed_created_at
    ON conductor_audit_log (created_at DESC) WHERE status = 'FAILED';

-- Event id lookups use the primary key; client IP and duration filters are applied within the
-- time window. Free-text search (ILIKE '%text%') can't use these indexes and scans the rows in the
-- time window: the API always bounds the window (24 hours by default). If searches over long
-- windows become slow, a pg_trgm GIN index on the searched columns is the next step.
