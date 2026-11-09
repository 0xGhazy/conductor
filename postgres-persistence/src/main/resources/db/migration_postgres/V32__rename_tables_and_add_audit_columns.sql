-- Migration: Rename tables to simplified names and add created_by / updated_by audit columns
--
-- 1. Rename tables:
--    - http_connections -> authentications
--    - conductor_queries -> queries
--    - conductor_datasources / conductor_databases -> databases
--    - conductor_audit_log / conductor_audit_logs -> audit_logs

ALTER TABLE IF EXISTS http_connections RENAME TO authentications;
ALTER TABLE IF EXISTS conductor_queries RENAME TO queries;
ALTER TABLE IF EXISTS conductor_databases RENAME TO databases;
ALTER TABLE IF EXISTS conductor_datasources RENAME TO databases;
ALTER TABLE IF EXISTS conductor_audit_logs RENAME TO audit_logs;
ALTER TABLE IF EXISTS conductor_audit_log RENAME TO audit_logs;

-- 2. Add created_by (uuid), updated_by (uuid) to authentications and secrets
ALTER TABLE authentications ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE authentications ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE secrets ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE secrets ADD COLUMN IF NOT EXISTS updated_by UUID;

COMMENT ON COLUMN authentications.created_by IS 'Keycloak user_entity.id of the creator';
COMMENT ON COLUMN authentications.updated_by IS 'Keycloak user_entity.id of the last editor';
COMMENT ON COLUMN secrets.created_by IS 'Keycloak user_entity.id of the creator';
COMMENT ON COLUMN secrets.updated_by IS 'Keycloak user_entity.id of the last editor';

-- 3. Ensure created_by and updated_by in databases and queries are UUID
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'databases' AND column_name = 'created_by' AND data_type != 'uuid'
    ) THEN
        ALTER TABLE databases
            ALTER COLUMN created_by TYPE UUID USING (
                CASE 
                    WHEN created_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN created_by::uuid 
                    ELSE NULL 
                END
            );
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'databases' AND column_name = 'updated_by' AND data_type != 'uuid'
    ) THEN
        ALTER TABLE databases
            ALTER COLUMN updated_by TYPE UUID USING (
                CASE 
                    WHEN updated_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN updated_by::uuid 
                    ELSE NULL 
                END
            );
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'queries' AND column_name = 'created_by' AND data_type != 'uuid'
    ) THEN
        ALTER TABLE queries
            ALTER COLUMN created_by TYPE UUID USING (
                CASE 
                    WHEN created_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN created_by::uuid 
                    ELSE NULL 
                END
            );
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'queries' AND column_name = 'updated_by' AND data_type != 'uuid'
    ) THEN
        ALTER TABLE queries
            ALTER COLUMN updated_by TYPE UUID USING (
                CASE 
                    WHEN updated_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN updated_by::uuid 
                    ELSE NULL 
                END
            );
    END IF;
END $$;
