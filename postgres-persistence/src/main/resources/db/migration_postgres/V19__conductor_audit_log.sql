-- Conductor Audit Log Table
CREATE TABLE IF NOT EXISTS conductor_audit_log (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor_id VARCHAR(64),
    actor_username VARCHAR(255),
    actor_name VARCHAR(255),
    actor_email VARCHAR(255),
    action VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL,
    duration_ms BIGINT,
    error_message TEXT,
    details JSONB,
    client_ip VARCHAR(45)
);

CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON conductor_audit_log (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON conductor_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON conductor_audit_log (actor_id);
