-- Workflow Translation Table
CREATE TABLE IF NOT EXISTS workflow_translation (
    id UUID PRIMARY KEY,
    workflow_name VARCHAR(255) NOT NULL,
    workflow_version INTEGER NOT NULL,
    message_code VARCHAR(255) NOT NULL,
    translations JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_workflow_translation UNIQUE (workflow_name, workflow_version, message_code)
);

CREATE INDEX IF NOT EXISTS idx_workflow_translation_wf ON workflow_translation (workflow_name, workflow_version);
CREATE INDEX IF NOT EXISTS idx_workflow_translation_msg ON workflow_translation (message_code);
CREATE INDEX IF NOT EXISTS idx_workflow_translation_updated_at ON workflow_translation (updated_at DESC);

