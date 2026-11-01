-- Scripts Table
CREATE TABLE IF NOT EXISTS scripts (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    script TEXT NOT NULL,
    language VARCHAR(40) NOT NULL,
    variables JSONB,
    timeout INTEGER NOT NULL DEFAULT 3000,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_scripts_name ON scripts (name);
CREATE INDEX IF NOT EXISTS idx_scripts_language ON scripts (language);
CREATE INDEX IF NOT EXISTS idx_scripts_updated_at ON scripts (updated_at DESC);

