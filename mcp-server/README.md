# Weaver MCP Sidecar

The Weaver MCP Sidecar exposes four Model Context Protocol tools backed by the public REST API in Weaver's `release-2-enhancements` branch. It is an adapter: Weaver remains responsible for storing, versioning, and executing workflows.

```text
Codex / Antigravity
        │
        │ MCP Streamable HTTP
        ▼
  Weaver MCP Sidecar :3000
  ├─ input validation
  ├─ simplified graph compiler
  └─ Weaver REST client
        │
        ▼
  Weaver Backend :9090
        │
        ▼
  Conductor / Postgres / Redis
```

The server is stateless and tools-only. It has no MCP resources, prompts, session store, SSE-only route, or stdio transport. Every successful Weaver JSON response is returned twice: as serialized MCP text content and as `structuredContent`, without changing REST field names. Weaver 4xx and 5xx bodies are retained and returned with `isError: true`.

## Quick start with Docker Compose

Requirements:

- Docker Engine with Compose
- A Weaver backend reachable on the host at port `9090`, or another URL supplied through `WEAVER_BASE_URL`

From this directory:

```sh
docker compose up --build -d
docker compose ps
```

The MCP endpoint is available only on the Docker host's loopback interface:

```text
http://127.0.0.1:3000/mcp
```

Check process and dependency health separately:

```sh
curl --fail http://127.0.0.1:3000/healthz
curl --fail http://127.0.0.1:3000/readyz
```

`/healthz` reports whether the sidecar process is alive. `/readyz` makes a bounded request to Weaver and returns a non-2xx status when Weaver is not reachable or produces an invalid response.

To stop this separate Compose project:

```sh
docker compose down
```

The Compose file does not join or modify Weaver's existing Compose project. It resolves a host-run backend through `host.docker.internal`, runs as a non-root user, uses a read-only root filesystem, mounts only a temporary `/tmp`, and enables `no-new-privileges`.

## Configuration

Copy `.env.example` to `.env` to customize the Compose deployment.

| Variable | Default | Purpose |
|---|---:|---|
| `WEAVER_BASE_URL` | `http://host.docker.internal:9090` | Weaver backend origin; do not include `/api` |
| `MCP_PORT` | `3000` | Host loopback port in Compose, and the application port outside Compose |
| `WEAVER_REQUEST_TIMEOUT_MS` | `10000` | Timeout for list, describe, create, and readiness requests |
| `WEAVER_EXECUTION_TIMEOUT_MS` | `130000` | Separate timeout for synchronous workflow execution |
| `WEAVER_LIST_MAX_PAGES` | `100` | Safety limit for `list_workflows` in `all` mode |
| `MCP_ALLOWED_HOSTS` | `localhost,127.0.0.1,[::1]` | Comma-separated HTTP Host allowlist |
| `MCP_ALLOWED_ORIGINS` | empty | Comma-separated browser Origin allowlist; non-browser requests without `Origin` remain allowed |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, or `error` |

The process also accepts `MCP_HOST`; the container fixes it to `0.0.0.0`. When running locally it defaults to `0.0.0.0`.

For a reverse proxy, add every public host value to `MCP_ALLOWED_HOSTS` and every browser origin to `MCP_ALLOWED_ORIGINS`. Host values may include a port. Authentication and TLS are deliberately not provided by this service; terminate TLS and enforce authentication at the proxy, tunnel, or equivalent network layer.

## MCP tools

The server exposes exactly these tools.

### `list_workflows`

Lists workflow definitions using `GET /api/metadata/workflows`.

```json
{
  "mode": "page",
  "page": 0,
  "size": 20,
  "sort": ["createdOn,desc"]
}
```

- `mode` defaults to `page`; the backend page envelope is returned unchanged.
- `mode: "all"` starts at page zero and returns an array of unchanged page envelopes until Weaver reports `isLastPage`.
- `size` must be from 1 through 100.
- `sort` values are sent as repeated Spring query parameters.
- Reaching `WEAVER_LIST_MAX_PAGES` before the last page returns `WEAVER_PAGE_LIMIT` and includes the collected page envelopes in the error details.

The tool is annotated read-only and idempotent.

### `describe_workflow`

Gets the latest versioned definition using `GET /api/metadata/workflows/{name}`. The name is URL-encoded.

```json
{
  "workflow_name": "example_workflow"
}
```

The tool is annotated read-only and idempotent.

### `execute_workflow`

Starts a synchronous execution using `POST /api/executor/{name}`. The `input` value is sent unchanged.

```json
{
  "workflow_name": "example_workflow",
  "input": {
    "customerId": "customer-42"
  }
}
```

Execution uses `WEAVER_EXECUTION_TIMEOUT_MS`, which defaults to 130 seconds to cover Weaver's approximately 120-second polling window. This tool is marked potentially side-effecting and open-world.

### `create_workflow`

Creates or updates a workflow using `POST /api/workflows/upsert/new?incrementVersion=false&version={version}`. There is no preflight existence check and no confirmation flag, preserving the release-2 endpoint's upsert semantics.

Raw mode accepts a backend-compatible release-2 `WorkflowDto`, checks its required fields, allows additional fields, and forwards it unchanged:

```json
{
  "format": "raw",
  "payload": {
    "name": "example_workflow",
    "version": 1,
    "description": "Created through MCP",
    "_inputs": {},
    "variables": {},
    "tasks": [
      {
        "name": "terminate",
        "taskReferenceName": "done",
        "inputParameters": {
          "terminationStatus": "COMPLETED",
          "workflowOutput": {},
          "terminationReason": "Done"
        },
        "type": "TERMINATE"
      }
    ],
    "edges": []
  }
}
```

Simplified mode accepts a graph without UI-only or duplicated topology fields:

```json
{
  "format": "simplified",
  "payload": {
    "workflowName": "example_workflow",
    "description": "Created through MCP",
    "variables": {},
    "nodes": [
      {
        "id": "finish",
        "type": "TERMINATE",
        "config": {
          "status": "COMPLETED",
          "reason": "Done",
          "output": {}
        }
      }
    ],
    "edges": []
  }
}
```

Supported node types and their configuration fields are:

| Type | Configuration |
|---|---|
| `HTTP_ACTION` | `url`, `method`, `headers`, `query`, `body`, `connection`, `timeout` |
| `DATABASE_ACTION` | query UUID, datasource UUID, and parameters |
| `JEXL_ACTION` | JEXL expression, variables, and timeout |
| `SCRIPT_ACTION` | expression, variables, `PYTHON` / `JAVA_SCRIPT` / `JEXL`, and timeout |
| `REDIS_ACTION` | datasource UUID, Redis command, key, value, field, TTL, delta, keys, and hash values |
| `VALIDATION_ACTION` | field/operator/value rules and variables |
| `RULE_ENGINE_ACTION` | field/operator/value rules with optional `AND` / `OR`, and variables |
| `SWITCH_ACTION` | `value-param` or `javascript`, expression/input parameter, and `{id,value}` cases |
| `WAIT_ACTION` | `DURATION` with a duration, or `UNTIL` with a timestamp |
| `RESPOND_ACTION` | message code, language code, workflow identity, variables, and workflow input |
| `TERMINATE` | `COMPLETED`, `FAILED`, or `TERMINATED`, plus reason and output |

An edge has `source`, `target`, and optional `branch`. Switch edges must use a configured case ID or `default`. The compiler rejects duplicate or reserved IDs, missing targets, cycles, invalid switch branches, and any terminal path that does not end in `TERMINATE` or `RESPOND_ACTION`. It deterministically generates start edges, edge IDs, layout coordinates stored in task metadata, unique task references, nested switch `decisionCases` / `defaultCase`, and the release-2 `WorkflowDto` fields consumed by Weaver. Merged graph segments are expanded into each Conductor branch with deterministic unique task references. Simplified workflow versions default to `1`.

## Connect Codex

Codex supports remote Streamable HTTP servers in `~/.codex/config.toml` or a trusted project's `.codex/config.toml`. Because its default tool timeout is shorter than Weaver's execution window, configure 140 seconds:

```toml
[mcp_servers.weaver]
url = "http://127.0.0.1:3000/mcp"
tool_timeout_sec = 140
```

Restart the MCP server from Codex's MCP settings, then ask Codex to list the `weaver` tools. See the [Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp).

For a server on another machine, replace the loopback URL with the HTTPS URL supplied by your authenticated reverse proxy or tunnel.

## Connect Antigravity

Open the MCP manager and choose **Manage MCP Servers** → **View raw config**, or edit the workspace file `.agents/mcp_config.json`:

```json
{
  "mcpServers": {
    "weaver": {
      "serverUrl": "http://127.0.0.1:3000/mcp"
    }
  }
}
```

Antigravity requires `serverUrl` for remote Streamable HTTP servers. It rejects the legacy `url` and `httpUrl` fields. See the [Antigravity MCP documentation](https://antigravity.google/docs/ide-mcp).

For a remote deployment, use the HTTPS endpoint exposed by your reverse proxy or tunnel. Since this v1 sidecar has no application authentication, do not publish port 3000 directly on an untrusted network.

## Local development

Node.js 22 or later and pnpm are required.

```sh
corepack enable
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
```

Run against a locally installed Weaver backend:

```sh
WEAVER_BASE_URL=http://127.0.0.1:9090 pnpm dev
```

On PowerShell:

```powershell
$env:WEAVER_BASE_URL = "http://127.0.0.1:9090"
pnpm dev
```

The test suite covers schema validation, graph compilation, every supported node type, invalid graphs, REST request construction and pass-through behavior, pagination and page limits, timeout/error translation, and MCP discovery/invocation through the official client SDK.

## Operations and errors

Logs are JSON objects on standard output. Request logs include the operation, duration, HTTP status, and request ID. Workflow execution inputs and outputs, HTTP headers, and complete topology payloads are never logged.

Sidecar-originated failures use these codes:

| Code | Meaning |
|---|---|
| `INVALID_INPUT` | The MCP arguments or simplified graph are invalid |
| `WEAVER_UNREACHABLE` | The Weaver backend could not be reached |
| `WEAVER_TIMEOUT` | The configured REST timeout elapsed |
| `INVALID_WEAVER_RESPONSE` | Weaver returned a response the sidecar could not safely pass through as JSON |
| `WEAVER_PAGE_LIMIT` | All-mode pagination reached its configured safety limit |

Weaver-generated error bodies are not replaced by these codes. A Weaver 4xx or 5xx response is passed through unchanged with MCP `isError: true`.
