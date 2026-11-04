-- Workflow message translations, one row per (workflow, version, message code, language).
-- Replaces workflow_translation, which stored all languages of a message in one JSONB map.
CREATE TABLE IF NOT EXISTS translations (
    id               UUID PRIMARY KEY,
    workflow_name    VARCHAR(255) NOT NULL,
    workflow_version INTEGER      NOT NULL CHECK (workflow_version >= 1),
    message_code     VARCHAR(255) NOT NULL,
    language_code    VARCHAR(15)  NOT NULL
        REFERENCES supported_languages (code) ON UPDATE CASCADE ON DELETE RESTRICT,
    message          TEXT         NOT NULL CHECK (length(btrim(message)) > 0),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by       UUID,
    updated_by       UUID,
    -- Also serves lookups by (workflow_name, workflow_version), so no separate index is needed.
    CONSTRAINT uk_translations
        UNIQUE (workflow_name, workflow_version, message_code, language_code)
);

-- Supports the language foreign key (ON DELETE RESTRICT check) and "is this language in use".
CREATE INDEX IF NOT EXISTS idx_translations_language ON translations (language_code);

-- Carry over existing data. Languages used by old rows but not registered yet are added first,
-- so no translation is lost to the new foreign key.
INSERT INTO supported_languages (id, code, name, created_at, updated_at)
SELECT md5('supported-language:' || t.code)::uuid, t.code, t.code, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT kv.key AS code
    FROM workflow_translation wt, jsonb_each_text(wt.translations) kv
    WHERE kv.value IS NOT NULL
      AND length(btrim(kv.value)) > 0
      AND length(kv.key) BETWEEN 1 AND 15
) t
WHERE NOT EXISTS (SELECT 1 FROM supported_languages s WHERE s.code = t.code);

INSERT INTO translations (
    id, workflow_name, workflow_version, message_code, language_code, message, created_at, updated_at)
SELECT md5(wt.id::text || ':' || kv.key)::uuid,
       wt.workflow_name,
       wt.workflow_version,
       wt.message_code,
       kv.key,
       kv.value,
       wt.created_at,
       COALESCE(wt.updated_at, wt.created_at)
FROM workflow_translation wt, jsonb_each_text(wt.translations) kv
WHERE kv.value IS NOT NULL
  AND length(btrim(kv.value)) > 0
  AND length(kv.key) BETWEEN 1 AND 15
  AND wt.workflow_version >= 1
ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS workflow_translation;
