---
version: 1
slug: "ui-src-pages-settings-auditeventdrawer-tsx"
primary_target: "ui/src/pages/Settings/AuditEventDrawer.tsx"
related_targets: ["ui/src/pages/Settings/SettingsAuditLogsPage.tsx"]
---

# Audit event panel (Settings › Audit Logs)

Scope: the side panel opened from an audit log row, plus the actor/resource filter chips it feeds. Visitor mode: Operate.

Audience and job: an admin investigating an incident needs what changed, then who, when and whether it worked, then a pivot to everything by that person or on that resource.

Constraints: inherits the app's MUI + CSS-module world and the Settings pages; no secrets ever (passwords as "changed", JDBC property names only); older events carry raw arguments; no editing or revert from the log; no new dependencies.

Open decisions taken as defaults: long text shows whole Before/After blocks (no line diff); Previous/Next stop at the current page's edges.

## Direction contract

THESIS: The change is the headline. The panel opens on a plain sentence ("Updated query · workflow-status-summary") and the field-by-field Before → After, refusing the default "metadata table with a JSON dump at the bottom".

OWN-WORLD: Weaver's restrained admin language: canvas-default panel, 1px border-default rules, accent only for actions and current focus, success/danger tokens only on status, monospace only for code, ids and values.

STORY: The admin sees the outcome and the exact change in one glance, trusts who and when from one meta line, then pivots with one click to the actor's or resource's history, or steps to the neighbouring event.

FIRST VIEWPORT: Header: sentence title, status chip, meta line (actor · time · duration), Previous/Next and Close. Then the error (failed only), then Changes rows, then Context with the two filter actions; raw arguments collapsed last.

FORM: Extension of an established surface: a right-side detail drawer, first and only form considered; seed:3daa5acfc229dcf7 (dealt 3, 4, 5); the deal was applied to grounded structures for an established drawer, and the drawer extension held as the lead because the shape interview fixed the surface as the existing log's detail panel

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
