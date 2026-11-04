-- created_by / updated_by of datasources and queries hold the Keycloak user id (user_entity.id).
--
-- Keycloak keeps its tables in its own "keycloak" database, so a foreign key is not possible:
-- PostgreSQL cannot reference a table in another database. The uuid type guarantees the format;
-- the server writes the id from the caller's token (its "sub" claim is user_entity.id) and never
-- takes these values from request bodies.
--
-- Older rows may hold a username (for example "admin") or "system". Those cannot be mapped to an
-- id from here and become NULL ("unknown user"). To keep them, update them to the user's id in
-- Keycloak before this migration runs.

ALTER TABLE conductor_datasources
    ALTER COLUMN created_by TYPE uuid USING (
        CASE WHEN created_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             THEN created_by::uuid END),
    ALTER COLUMN updated_by TYPE uuid USING (
        CASE WHEN updated_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             THEN updated_by::uuid END);

ALTER TABLE conductor_queries
    ALTER COLUMN created_by TYPE uuid USING (
        CASE WHEN created_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             THEN created_by::uuid END),
    ALTER COLUMN updated_by TYPE uuid USING (
        CASE WHEN updated_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             THEN updated_by::uuid END);

COMMENT ON COLUMN conductor_datasources.created_by IS 'Keycloak user_entity.id (keycloak database) of the creator';
COMMENT ON COLUMN conductor_datasources.updated_by IS 'Keycloak user_entity.id (keycloak database) of the last editor';
COMMENT ON COLUMN conductor_queries.created_by IS 'Keycloak user_entity.id (keycloak database) of the creator';
COMMENT ON COLUMN conductor_queries.updated_by IS 'Keycloak user_entity.id (keycloak database) of the last editor';
