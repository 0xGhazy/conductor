CREATE TABLE IF NOT EXISTS supported_languages (
    id UUID PRIMARY KEY,
    code VARCHAR(15) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    native_name VARCHAR(100),
    is_rtl BOOLEAN DEFAULT FALSE NOT NULL,
    is_default BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_supported_languages_code ON supported_languages (code);

INSERT INTO supported_languages (id, code, name, native_name, is_rtl, is_default, created_at, updated_at)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'en', 'English', 'English', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('a0000000-0000-0000-0000-000000000002', 'ar', 'Arabic', 'العربية', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (code) DO NOTHING;

