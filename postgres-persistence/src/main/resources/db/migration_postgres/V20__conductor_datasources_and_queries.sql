-- Conductor Datasources Table
CREATE TABLE IF NOT EXISTS conductor_datasources (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    version BIGINT NOT NULL DEFAULT 0,
    type VARCHAR(30) NOT NULL,
    connection JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(64),
    updated_by VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_datasources_name ON conductor_datasources (name);
CREATE INDEX IF NOT EXISTS idx_datasources_created_at ON conductor_datasources (created_at DESC);

-- Conductor Queries Table
CREATE TABLE IF NOT EXISTS conductor_queries (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sql_query TEXT NOT NULL,
    timeout INTEGER NOT NULL DEFAULT 1000,
    parameters JSONB,
    datasource_id UUID NOT NULL REFERENCES conductor_datasources(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(64),
    updated_by VARCHAR(64),
    CONSTRAINT uk_queries_name_datasource UNIQUE (name, datasource_id)
);

CREATE INDEX IF NOT EXISTS idx_queries_datasource_id ON conductor_queries (datasource_id);
CREATE INDEX IF NOT EXISTS idx_queries_name ON conductor_queries (name);
CREATE INDEX IF NOT EXISTS idx_queries_created_at ON conductor_queries (created_at DESC);

