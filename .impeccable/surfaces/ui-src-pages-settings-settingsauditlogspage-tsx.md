---
version: 1
slug: "ui-src-pages-settings-settingsauditlogspage-tsx"
primary_target: "ui/src/pages/Settings/SettingsAuditLogsPage.tsx"
related_targets: ["ui/src/pages/Settings/AuditActivityStrip.tsx"]
---

# Audit Logs page (Settings › Audit Logs)

Scope: the page at /settings/audit-logs: filter row, activity strip, event list. The event panel has its own brief and stays as reviewed. Visitor mode: Operate.

Audience and job: an admin investigating an incident arrives with a question (what failed around 14:00, who changed this query) and must find the right events, then open one.

Constraints: inherits Weaver's world (DESIGN.md); filter semantics, URL contract and filter API unchanged; overview data comes from a real histogram endpoint; no chart dependency; app-shell overflow at 390px is out of scope.

Decisions taken: clicking a bar narrows the list to that bucket as a custom range; Refresh stays in the table toolbar.

## Direction contract

THESIS: The list is the instrument and every row reads as a sentence: who did what to which resource, and whether it worked. It refuses the default admin grid of raw identifiers under three stacked toolbars.

OWN-WORLD: Weaver's quiet ledger: canvas panels, 1px border-default rules, Open Sans, red only for actions and focus, danger only on failure, monospace only for ids.

STORY: The admin reads how much happened and when from one line, narrows by clicking the moment that matters, scans sentences, sees failures by their own error text, and opens the event.

FIRST VIEWPORT: Title and lede; one filter row (Search widest first, Time, Status, Resource type, Action, Filters); chips row only when active; the activity strip, counts left and about 30 thin bars right with the failed share in danger; then the list (Time, Actor, Event, Status, Duration).

FORM: Extension of an established surface, the existing page refined, first and only form considered; seed: none (extension of an established surface: concept-seed is not run for a local extension)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
