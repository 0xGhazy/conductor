-- HTTP Connections Table
CREATE TABLE IF NOT EXISTS http_connections (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    strategy VARCHAR(64) NOT NULL,
    auth_config JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_check TIMESTAMP WITH TIME ZONE,
    error TEXT
);

CREATE INDEX IF NOT EXISTS idx_http_connections_name ON http_connections (name);
CREATE INDEX IF NOT EXISTS idx_http_connections_strategy ON http_connections (strategy);

-- API Collections Table
CREATE TABLE IF NOT EXISTS api_collections (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    connection UUID REFERENCES http_connections(id) ON DELETE SET NULL,
    type VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_api_collections_name ON api_collections (name);
CREATE INDEX IF NOT EXISTS idx_api_collections_connection ON api_collections (connection);

-- API Collections Endpoints Table
CREATE TABLE IF NOT EXISTS api_collections_endpoints (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    collection UUID NOT NULL REFERENCES api_collections(id) ON DELETE CASCADE,
    connection UUID REFERENCES http_connections(id) ON DELETE SET NULL,
    config JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_api_collections_endpoints_collection ON api_collections_endpoints (collection);
CREATE INDEX IF NOT EXISTS idx_api_collections_endpoints_connection ON api_collections_endpoints (connection);

