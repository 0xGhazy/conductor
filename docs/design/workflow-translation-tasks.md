# Workflow Translation Module: Fix Plan

Task list from the design review of the workflow translation module. Each task can be implemented and merged on its own, in the order listed. Tick the box when its "Done when" checks pass.

**Scope:** the `workflow_translation` table, its model/DTO/DAO, `WorkflowTranslationService`, `WorkflowTranslationCacheService`, `WorkflowTranslationResource`, and how the Respond task and the designer UI use them.

**Key files**

| Area | File |
|---|---|
| Table | `postgres-persistence/src/main/resources/db/migration_postgres/V22__conductor_workflow_translations.sql` |
| Model / DTO | `common/src/main/java/com/vodafone/vss/weaver/common/respond/WorkflowTranslationModel.java`, `WorkflowTranslationDto.java` |
| DAO | `core/src/main/java/com/vodafone/vss/weaver/dao/WorkflowTranslationDAO.java`, `postgres-persistence/src/main/java/com/vodafone/vss/weaver/postgres/dao/PostgresWorkflowTranslationDAO.java` |
| Services | `respond-task/src/main/java/com/vodafone/vss/weaver/tasks/respond/service/WorkflowTranslationService.java`, `WorkflowTranslationCacheService.java` |
| Runtime use | `respond-task/src/main/java/com/vodafone/vss/weaver/tasks/respond/RespondWorkerTask.java`, `respond-task/.../contract/WorkflowMetadataProvider.java` |
| REST API | `rest/src/main/java/com/vodafone/vss/weaver/rest/controllers/WorkflowTranslationResource.java` |
| UI | `ui/src/features/designer/utils/workflowSerialization.ts`, `ui/src/features/translations/` |

Priorities: **P1** = wrong behaviour users will hit, **P2** = design weakness or likely bug, **P3** = cleanup.

---

## Phase 1: Cache bugs (small, do first)

### - [x] Task 1: Refresh both cache entries when a translation is moved (P1)

> **Status:** Done by the `translations` restructure (V28): workflow name, version and message code can no longer be changed on update, so a translation can't move.

**Problem.** `updateTranslation` refreshes the cache only for the translation's new workflow name and version (`WorkflowTranslationService.java`, around line 139). If an edit changes the workflow name or version, the old workflow keeps serving the old text from the cache for up to 24 hours.

**Change.**
- In `updateTranslation`, remember the old `workflowName` and `workflowVersion` before saving.
- After saving, call `cacheService.updateWorkflowCache(...)` for the old key and for the new key (once if they're the same).

**Done when.**
- A unit test moves a translation from `wf v1` to `wf v2`, and `getTranslations("wf", 1)` no longer returns it, without waiting for expiry.

> If Task 9 makes name, version and message code read-only, this fix is still worth keeping as a safety net.

### - [x] Task 2: Make "reload cache" a real reload (P2)

> **Status:** Done in V28 work: reload rebuilds the map and replaces the cache; reload and update share one lock.

**Problem.** `loadAllTranslationsToCache()` only adds entries; it never removes ones that no longer exist. A translation deleted directly in the database survives `POST /api/workflows/translations/cache/reload`. A reload running at the same time as an update can also put back older text.

**Change.**
- Build the complete new map first, then replace the cache contents in one step: `invalidateAll()` followed by `putAll(...)`, both inside the existing `synchronized` method.
- Make `updateWorkflowCache` `synchronized` on the same lock, so a reload and an update can't interleave.

**Done when.**
- A unit test: rows A and B are cached, the DAO then returns only A, and after a reload B is gone.

### - [x] Task 3: Stop hiding unreadable translation JSON (P2)

> **Status:** Done by V28: the JSON column is gone (one row per language), so there is nothing to parse.

**Problem.** `PostgresWorkflowTranslationDAO.mapRow` (around lines 322-331) catches any JSON parse error, logs nothing, and returns an empty map. A corrupted row looks exactly like "no translations".

**Change.**
- Log an error with the row `id`, `workflow_name`, `workflow_version` and `message_code`, then keep returning an empty map so one bad row doesn't break the whole list.

**Done when.**
- A row with invalid JSON produces one ERROR log line naming the row.

---

## Phase 2: Runtime behaviour

### - [ ] Task 4: Use the workflow's default language at runtime (P1)

**Problem.** The designer saves the workflow's default and supported languages in the workflow definition (`metadata.defaultLanguage`, `metadata.supportedLanguages`; see `workflowSerialization.ts` and `exportWorkflow.test.ts`). The Respond task reads the default only through `WorkflowMetadataProvider`, which has **no implementation**. So the default language users pick in the UI is ignored, and the fallback is always `en`.

**Change.**
- Implement `WorkflowMetadataProvider` (for example `WorkflowDefMetadataProvider`) using `MetadataDAO.getWorkflowDef(name, version)`:
  - `findDefaultLanguage` returns `metadata.defaultLanguage` when present.
  - `findLatestVersion` returns the latest version number.
- Register it as a Spring bean.
- Put it where it survives removal of the Respond worker; see Task 12.

**Done when.**
- A workflow whose definition has `metadata.defaultLanguage = "ar-EG"` and no `_language` input responds in `ar-EG`.
- A unit test covers: default present, default missing (falls back to `en`), and workflow definition not found.

### - [ ] Task 5: Decide how translations follow workflow versions (P1)

**Problem.** Translations are keyed by exact workflow version (unique on `workflow_name, workflow_version, message_code`), and nothing copies them when a new version is published. Publishing v2 silently drops every translation, and Respond returns the raw message code (for example `ORDER_SUCCESS`) to clients.

**Decision needed.** Pick one:
- **A. Fallback lookup (recommended).** Look up the exact version first. If there's nothing, use the highest version below it that has translations for that message code. Nothing has to be copied, and nothing can be forgotten.
- **B. Copy on publish.** When a new workflow version is saved, copy the previous version's translations. Each version is then explicit, but you need a hook on workflow save plus a way to handle edits made after the copy.

**Change (option A).**
- Add `findLatestUpTo(workflowName, version)` to `WorkflowTranslationDAO`, returning rows for the highest `workflow_version <= version` that has rows.
- Use it in `WorkflowTranslationCacheService.getTranslations` when the exact version is empty. Cache the result under the requested version.

**Done when.**
- With translations only for `wf v1`, running `wf v2` returns the v1 text.
- Adding a v2 translation overrides v1 for v2 only.
- Tests cover all three cases.

### - [x] Task 6: Validate and normalise language keys (P2)

> **Status:** Done in V28 work: keys are matched case-insensitively to `supported_languages` and stored in its form; unknown or duplicate keys return 400; blank texts are dropped. The table also enforces this (foreign key + CHECK). Respond-side lookup normalisation is still open.

**Problem.** Any language key is accepted: `english`, `AR`, `en_us`. Keys aren't checked against `supported_languages` or the workflow's `metadata.supportedLanguages`. The Respond task matches keys exactly, and the supported codes are now region codes (`en-US`, `ar-EG`). A translation keyed `en` or `ar`, or a request language `ar-eg`, silently misses and falls back.

**Change.**
- On create and update, reject any key that isn't a code in `supported_languages`. Return 400 listing the unknown keys.
- Normalise key case the same way the `Accept-Language` handling does (`ar-eg` becomes `ar-EG`, via `Locale.forLanguageTag(...).toLanguageTag()`), both when saving and when looking up in Respond.
- Drop blank values before saving (finding #20).
- Optionally, warn when a key isn't in the workflow's own `supportedLanguages`.

**Done when.**
- Creating `{"english": "Hi"}` returns 400.
- `{"en-us": "Hi"}` is stored as `en-US`.
- A request with `_language = ar-eg` finds the `ar-EG` text.

### - [ ] Task 7: Decide on the `"default"` key (P2)

**Problem.** Respond treats a language key named `"default"` as a fallback, but it isn't documented, validated, or shown in the UI. Once Task 4 is done, the workflow's default language does the same job.

**Decision needed.**
- Remove the `"default"` key handling (recommended once Task 4 is done), or
- Keep it, document it, and allow it explicitly in Task 6's validation.

**Change.**
- Remove it: drop the `"default"` branch in the Respond (and later Terminate) fallback, and include a check that finds existing rows using it.
- Keep it: document it in the API description, accept it in validation, and show it in the UI translation editor.

**Done when.**
- The fallback order is written down in one place, with a test per step, for example: requested language, then the workflow's default language, then `en`, then the message code.

---

## Phase 3: Multi-node correctness and load

### - [ ] Task 8: Keep the cache correct with more than one server (P1)

**Problem.** Translations are loaded at startup and cached for 24 hours. Create, update, delete and "reload" refresh only the node that handled the request, so other nodes serve old text for up to 24 hours. The edit screen reads through the same cache (`GET /api/workflows/translations/{workflowName}/{version}`), so editors can also see old data.

**Change.**
- Lower the cache expiry to a few minutes and make it configurable, e.g. `weaver.translations.cache-ttl=5m`.
- Have the edit screen's map endpoint read from the database, not the cache.
- Optional, for instant updates: store a per-workflow `max(updated_at)` and check it before serving from the cache (the same approach `DataSourceRegistry` uses with datasource versions).

**Done when.**
- An edit made on node A is visible on node B within the configured expiry.
- The edit screen always shows saved data.

### - [ ] Task 9: Make the identifying fields read-only and handle concurrent edits (P2)

> **Status:** Partly done in V28 work: identifying fields are read-only (400 if changed) and edits are per language. Still open: a per-row `version` column for edits to the same language.

**Problem.**
- `PUT /api/workflows/translations/{id}` lets callers change `workflowName`, `workflowVersion` and `messageCode` of an existing row. That causes Task 1's bug and makes the audit trail hard to follow.
- There's no row version, so two people editing different languages of the same message overwrite each other.

**Change.**
- In `updateTranslation`, ignore or reject changes to `workflowName`, `workflowVersion` and `messageCode` (400 if they differ from the stored row). Moving a translation becomes delete + create.
- Add a `version BIGINT NOT NULL DEFAULT 0` column (new migration). Include `version` in the DTO. Update with `WHERE id = ? AND version = ?` and increment it; return 409 when no row is updated.
- Update the UI translation editor to send back the `version` it loaded.

**Done when.**
- Two updates with the same starting `version`: the second gets 409.
- Changing `messageCode` through PUT gets 400.

### - [x] Task 10: Return 409 on duplicate create (P3)

> **Status:** Done in V28 work: a duplicate insert returns 409 (`ConflictException` from the DAO, mapped in the service).

**Problem.** `createTranslation` checks for an existing row, then inserts. A parallel create can slip in between; the database's unique constraint rejects it, but the API returns a generic 500.

**Change.**
- In `PostgresWorkflowTranslationDAO.create` (or the service), catch the unique-constraint violation (SQL state `23505`) and throw the same "already exists" error the pre-check uses.

**Done when.**
- Inserting a duplicate that bypasses the pre-check returns 409.

### - [ ] Task 11: Cache "no translations" results and stop loading the whole table at startup (P2)

> **Status:** Partly done in V28 work: empty results are cached. Still open: removing the full-table load at startup.

**Problem.**
- `getTranslations` doesn't cache empty results, so every Respond in a workflow without translations queries the database.
- Startup loads every translation row with no limit (`findAll`).

**Change.**
- Cache empty results as an empty map under the same key (this also covers Task 5's fallback).
- Remove the startup warm-up (`onApplicationReady`), or limit it to recently updated workflows. With the shorter expiry from Task 8, loading on demand is enough.

**Done when.**
- Two lookups for a workflow with no translations make one DAO call.
- Startup makes no full-table query.

---

## Phase 4: Structure

### - [ ] Task 12: Move translation management out of `respond-task` (P2)

**Problem.** The CRUD service, cache and supported-language service all live in `respond-task`. The plan is to remove the Respond worker and have the Terminate task resolve translated messages, so translation management would disappear along with the module.

**Change.**
- Create a `translations` module, or move into `core`:
  - `WorkflowTranslationService`
  - `WorkflowTranslationCacheService`
  - `SupportedLanguageService`
  - the new `WorkflowMetadataProvider` implementation (Task 4)
- Point `rest` (`WorkflowTranslationResource`, `SupportedLanguageResource`) at the new location.
- `respond-task` depends on it, until it's removed.

**Done when.**
- `respond-task` can be removed from `server/pom.xml` and the translation and supported-language APIs still work.

---

## Phase 5: Cleanup

### - [ ] Task 13: Make workflow-name matching consistent (P3)

**Problem.**
- Lookups and the unique constraint are case-sensitive.
- The duplicate check on update uses `equalsIgnoreCase`.
- Search uses `LOWER(...) LIKE`.

As a result, `Test-WF` and `test-wf` can both exist, and update conflict handling is unpredictable.

**Change.**
- Workflow names are case-sensitive in Conductor, so use exact matching everywhere. Replace `equalsIgnoreCase` with `equals` in `updateTranslation`.
- Search can stay case-insensitive (it's for finding things), but document that.

**Done when.**
- Creating `Test-WF` and `test-wf` translations behaves the same in create, update and lookup.

### - [ ] Task 14: Stop turning a missing version into 1 (P3)

**Problem.** `PostgresWorkflowTranslationDAO` silently turns a `null` version into `1` in every query, while the cache returns empty for `null`. This hides caller bugs, and the two layers disagree.

**Change.**
- In the DAO, throw `IllegalArgumentException` when the version is `null` (the DTO already requires `version >= 1`).
- Remove the `!= null ? ... : 1` fallbacks.

**Done when.**
- No query in the DAO defaults the version, and existing callers still pass their tests.

### - [x] Task 15: Fix search wildcards and paging order (P3)

> **Status:** Done in V28 work: wildcards are escaped (`ESCAPE ''`) and paging sorts by the group key as a tie-breaker.

**Problem.**
- `%` and `_` typed into search act as wildcards.
- Results sorted by `updated_at` alone can repeat or skip rows between pages, because that value isn't unique.

**Change.**
- Escape `\`, `%` and `_` in search input and add `ESCAPE '\'` to the `LIKE` clauses.
- Add `id` as a second sort key: `ORDER BY <column> <direction>, id <direction>`.

**Done when.**
- Searching `50%` matches only literal `50%`.
- Paging through results with equal `updated_at` values never repeats or skips a row.

### - [x] Task 16: Drop the two unused indexes (P3)

> **Status:** Done by V28: the new table only has the unique key (which covers the lookup) and an index on `language_code` for the foreign key.

**Problem.**
- `idx_workflow_translation_wf (workflow_name, workflow_version)` duplicates the start of the unique index on `(workflow_name, workflow_version, message_code)`.
- `idx_workflow_translation_msg (message_code)` can't be used by the `LIKE '%…%'` search.

**Change.** New migration:
```sql
DROP INDEX IF EXISTS idx_workflow_translation_wf;
DROP INDEX IF EXISTS idx_workflow_translation_msg;
```

**Done when.**
- The migration applies cleanly. `EXPLAIN` on the per-workflow lookup still shows an index scan on the unique index.

### - [ ] Task 17: Align the API path and the reload description (P3)

**Problem.**
- The API lives at `/api/workflows/translations` (plural); every other workflow endpoint uses `/api/workflow`.
- `POST .../cache/reload` only reloads the node that receives it, which isn't stated.

**Change.**
- Optional: add `/api/workflow/translations` as the main path and keep the old path as a deprecated alias for one release (the UI must be updated).
- Update the reload endpoint's `@Operation` description to say it reloads only the current node.

**Done when.**
- The OpenAPI docs describe the reload scope correctly.
- If the path changed, both paths work and the UI uses the new one.

---

## Finding-to-task map

| Review finding | Task |
|---|---|
| #1 version-bound translations | 5 |
| #2 default language never read | 4 |
| #3 stale cache on rename | 1 |
| #4 per-node cache | 8 |
| #5 reload doesn't remove | 2 |
| #6 unchecked language keys | 6 |
| #7 `"default"` key | 7 |
| #8 concurrent edits | 9 |
| #9 editable identifying fields | 9 |
| #10 hidden JSON errors | 3 |
| #11 no link to workflows | not scheduled; see note below |
| #12 module placement | 12 |
| #13 uncached misses / full load | 11 |
| #14 name case | 13 |
| #15 null version | 14 |
| #16 duplicate create 500 | 10 |
| #17 search wildcards / paging | 15 |
| #18 unused indexes | 16 |
| #19 API path / reload scope | 17 |
| #20 blank values | 6 |

**Note on #11 (no link to workflow definitions):** workflow definitions and translations are stored separately, so a database foreign key isn't practical. A reasonable follow-up is to check that the workflow definition exists on create (via `MetadataDAO`), and to delete or flag translations when a workflow definition is deleted. It's left out of this plan because it needs a hook into workflow-definition deletion.
