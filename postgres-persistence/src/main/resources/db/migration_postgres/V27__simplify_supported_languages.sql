-- Supported languages keep only id, code, name and timestamps.
-- native_name, is_rtl and is_default are no longer used.
ALTER TABLE supported_languages DROP COLUMN IF EXISTS native_name;
ALTER TABLE supported_languages DROP COLUMN IF EXISTS is_rtl;
ALTER TABLE supported_languages DROP COLUMN IF EXISTS is_default;
