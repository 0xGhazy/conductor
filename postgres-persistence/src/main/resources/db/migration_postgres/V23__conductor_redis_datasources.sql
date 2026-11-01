-- Redis Instances / Datasources Table
CREATE TABLE IF NOT EXISTS redis_instances (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL DEFAULT 6379,
    username VARCHAR(255),
    password VARCHAR(255),
    database_index INTEGER NOT NULL DEFAULT 0,
    ssl BOOLEAN NOT NULL DEFAULT FALSE,
    timeout_ms INTEGER NOT NULL DEFAULT 2000,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_redis_instances_name ON redis_instances (name);
CREATE INDEX IF NOT EXISTS idx_redis_instances_active ON redis_instances (active);

