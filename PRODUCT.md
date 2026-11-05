# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Platform admins and operators** of Weaver who design, run and maintain workflows and the resources they use (databases, queries, connections, scripts, secrets).
- When something breaks or changes unexpectedly, an **admin investigating an incident** opens the audit log to find out what changed, who changed it, when, and whether it failed. Speed of that triage is the priority. (Confirmed for the audit log.)
- Inferred, to confirm: users are internal engineering staff, not external customers.

## Product Purpose

Weaver is a workflow orchestration platform built on Netflix Conductor. People design workflows visually, connect them to databases, queries, HTTP services, Redis, scripts and secrets, run them, and monitor their executions. Success means workflows are easy to build and safe to change, and when something goes wrong it can be traced quickly.

## Operating Context

- Browser app (`ui/`, React + MUI + CSS modules) talking to one Conductor-based server (`/api/**`).
- Sign-in through Keycloak; roles `conductor_admin`, `conductor_operator`, `conductor_viewer`, `conductor_worker` decide what each user may do.
- Settings area (`/settings/*`) holds admin tools: Migrations, Configurations, Audit Logs, Identity (Users, Roles & Permissions).

## Capabilities and Constraints

- The audit log records audited operations: actor (Keycloak user), action, resource type and id, outcome (SUCCESS / FAILED), duration, client IP, error, and details. Database and query create/update events record their field changes; older events carry raw arguments.
- Audit events are readable by admins only (`/api/admin/**`).
- Secrets are never shown: passwords appear only as "changed", JDBC property values are never recorded.
- Some screens use sample data where no backend API exists yet (Configurations, Users); those are labelled and have no fake actions.

## Evidence on Hand

- Real audit data in the local `conductor_audit_log` table.
- Keycloak realm setup: `docker/keycloak/weaver-realm.json`.
- No testimonials, customers, metrics or external claims exist; do not invent them.

## Product Principles

1. Trace before trust: every change should be attributable to a person, a time and an outcome.
2. Never expose secrets, even to admins.
3. Show real data or say plainly that it is sample data; no fake actions.
4. Familiar, dense admin UI over decoration: the tool disappears into the task.
