-- Remove HTTP connection reference from api_collections table
DROP INDEX IF EXISTS idx_api_collections_connection;

ALTER TABLE api_collections DROP COLUMN IF EXISTS connection;

