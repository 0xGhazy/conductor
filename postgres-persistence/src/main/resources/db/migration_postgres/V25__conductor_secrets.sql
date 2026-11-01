CREATE TABLE IF NOT EXISTS secrets (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    encrypted_value BYTEA NOT NULL,
    iv BYTEA NOT NULL,
    displayed_text VARCHAR(20) NOT NULL,
    description VARCHAR(500),
    version BIGINT DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_secrets_created_at ON secrets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_secrets_name ON secrets (name);

