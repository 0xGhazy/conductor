
Modules: [database, query, cache, collection, script, authentication, secrets, environment, translation, workflow, executions, migration, configuration, identity, audit]

permissions per module:

- database: read, write, update, delete.
- query: read, write, update, delete, execute.
- cache: read, write, update, delete.
- collection: read, write, update, delete.
- script: read, write, update, delete, execute.
- authentication: read, write, update, delete, execute.
- environment: read, write, update, delete.
- translation: read, write, update, delete.
- workflow: read, write, update, delete.
- executions: read, write, update, delete.
- migration: read, write.
- configuration: read, write.
- identity: read, write, update, delete.
- audit: read.

```json
{
    "database": [
        {
            "name": "read",
            "description": "read and list database instances"
        }
    ]
} // Make sure to make the permissions is module:permission => database:read
```