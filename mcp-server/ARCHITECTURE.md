# Weaver MCP Sidecar: Developer Architecture

This document is the fast reference for understanding and extending the Weaver MCP sidecar.

## What this service does

The sidecar translates Model Context Protocol (MCP) tool calls into Weaver REST API calls.

```text
MCP client
(Codex, Antigravity, or another agent)
        |
        | Streamable HTTP: POST /mcp
        v
Weaver MCP sidecar
  1. Validate tool arguments with Zod
  2. Run optional sidecar logic or compilation
  3. Call the Weaver REST API
  4. Return Weaver's JSON as MCP content
        |
        v
Weaver backend
```

The sidecar is an adapter, not a workflow engine. Weaver remains responsible for workflow persistence, versioning, and execution.

## Main components

| Component | File | Responsibility |
|---|---|---|
| HTTP entry point | `src/server.ts` | Exposes `/mcp`, `/healthz`, and `/readyz`; checks allowed hosts/origins; handles shutdown |
| MCP tool registry | `src/tools.ts` | Defines tool names, descriptions, schemas, annotations, handlers, and MCP result formatting |
| Input schemas | `src/workflow/schemas.ts` | Validates MCP arguments with Zod and exports inferred TypeScript types |
| Workflow compiler | `src/workflow/compiler.ts` | Converts simplified workflow input into the Weaver workflow payload |
| Weaver REST client | `src/weaver-client.ts` | Owns REST paths, HTTP methods, pagination, timeouts, response parsing, and safe request logs |
| Configuration | `src/config.ts` | Reads and validates environment variables |
| Sidecar errors | `src/errors.ts` | Defines stable sidecar error codes and their JSON shape |
| Structured logger | `src/logger.ts` | Emits JSON logs without workflow payloads or secrets |
| Protocol tests | `test/mcp-integration.test.ts` | Uses the official MCP client to test discovery and invocation |
| REST tests | `test/weaver-client.test.ts` | Verifies paths, methods, bodies, pagination, timeouts, and passthrough behavior |
| Schema tests | `test/schemas.test.ts` | Verifies accepted, rejected, and defaulted arguments |
| Compiler tests | `test/compiler.test.ts` | Verifies graph validation and generated Weaver payloads |

## Tool-to-Weaver mappings

The target mappings for the `release-2-enhancements` Weaver API are:

| MCP tool | Sidecar method | Weaver request | Notes |
|---|---|---|---|
| `list_workflows` | `WeaverClient.listWorkflows` | `GET /api/workflows` | Supports page traversal; return each Weaver envelope unchanged |
| `describe_workflow` | `WeaverClient.describeWorkflow` | `GET /api/workflows/name/{name}` | URL-encode the workflow name |
| `execute_workflow` | `WeaverClient.executeWorkflow` | `POST /api/executor/{name}` | Send `input` unchanged; use the longer execution timeout |
| `create_workflow` | `WeaverClient.createWorkflow` | `POST /api/workflows/upsert/new` | Send the compiled or raw `WorkflowDto`; preserve Weaver upsert/version behavior |

Keep REST paths and HTTP details inside `src/weaver-client.ts`. Tool handlers should call named client methods instead of building URLs themselves.

## Request lifecycle

```text
MCP JSON-RPC request
  -> server.ts routes /mcp
  -> MCP SDK selects the registered tool
  -> Zod validates inputSchema
  -> tools.ts runs the tool handler
  -> compiler.ts transforms input when needed
  -> weaver-client.ts calls Weaver
  -> Weaver JSON is returned as:
       content: [{ type: "text", text: "<serialized JSON>" }]
       structuredContent: <same JSON value>
```

Weaver 4xx and 5xx bodies are preserved and returned with MCP `isError: true`. Sidecar validation, network, timeout, pagination, and invalid-response failures use sidecar-owned error codes from `src/errors.ts`.

## Tool annotations

Annotations help MCP clients decide how cautiously to use a tool. They are advisory metadata, not authorization controls.

| Annotation | Set to `true` when... |
|---|---|
| `readOnlyHint` | The tool cannot change state |
| `destructiveHint` | The tool may overwrite, delete, trigger, or otherwise cause irreversible effects |
| `idempotentHint` | Repeating the same call should have the same effect as one call |
| `openWorldHint` | The tool or workflow may interact with systems outside Weaver |

Current intent:

| Tool | Read-only | Destructive | Idempotent | Open world |
|---|---:|---:|---:|---:|
| `list_workflows` | Yes | No | Yes | No |
| `describe_workflow` | Yes | No | Yes | No |
| `execute_workflow` | No | Yes | No | Yes |
| `create_workflow` | No | Yes | No | No |

## How to add a new tool

### 1. Confirm the Weaver REST contract

Record the following before coding:

- HTTP method and path
- Path, query, and body fields
- Success and error response shapes
- Whether the operation changes state
- Whether it can call external systems
- Normal and maximum response time

Do not duplicate backend behavior in the sidecar unless the tool needs a deliberate adapter or compiler.

### 2. Add the input schema

Define the schema in `src/workflow/schemas.ts`, or create a focused schema module when the domain is unrelated to workflows.

```ts
export const GetExecutionInputSchema = z
  .object({
    execution_id: z.string().trim().min(1),
  })
  .strict();

export type GetExecutionInput = z.infer<typeof GetExecutionInputSchema>;
```

Schema rules:

- Use `.strict()` for MCP argument objects so typos fail early.
- Add defaults only when they are part of the public tool contract.
- Use `.passthrough()` only for raw Weaver payloads that intentionally allow backend-compatible extra fields.
- Prefer a discriminated union when one tool accepts clearly different payload formats.
- Add at least one valid, invalid, and default-value test in `test/schemas.test.ts`.

### 3. Add the REST client method

Add a named method to `WeaverClient` in `src/weaver-client.ts`.

```ts
getExecution(executionId: string): Promise<WeaverResponse> {
  return this.request(
    "get_execution",
    `/api/executions/${encodeURIComponent(executionId)}`,
    { method: "GET" },
  );
}
```

REST client rules:

- URL-encode every user-controlled path segment.
- Serialize the request body once with `JSON.stringify`.
- Use `executionTimeoutMs` only for long-running execution calls; use `requestTimeoutMs` otherwise.
- Return `WeaverResponse` even for Weaver 4xx and 5xx responses.
- Throw `SidecarError` only for failures created by the sidecar.
- Log operation, duration, status, and request ID only. Never log headers, workflow inputs, outputs, or full topology payloads.

Add request-level tests in `test/weaver-client.test.ts` for the method, encoded path, body, error response, and timeout behavior.

### 4. Register the MCP tool

Register the tool in `createWeaverMcpServer` in `src/tools.ts`.

```ts
server.registerTool(
  "get_execution",
  {
    title: "Get Weaver execution",
    description: "Fetch one Weaver workflow execution by ID.",
    inputSchema: GetExecutionInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ execution_id }) => {
    try {
      return weaverResult(await client.getExecution(execution_id));
    } catch (error) {
      return failureResult(error, logger, "get_execution");
    }
  },
);
```

Tool registration rules:

- Use a stable `snake_case` tool name.
- Write the description for an agent deciding when to call the tool.
- Attach the Zod schema directly as `inputSchema`.
- Set all four annotations deliberately.
- Reuse `weaverResult` so REST bodies remain unchanged.
- Reuse `failureResult` so sidecar errors have one consistent shape.

### 5. Add protocol coverage

Update `test/mcp-integration.test.ts` to verify:

- The new tool appears in `listTools()`.
- Its annotations are correct.
- A successful call returns both text and structured content.
- A Weaver error sets `isError: true` and preserves the response body.
- The expected `WeaverClient` method receives the parsed arguments.

If adding a tool is intentional, also update any test that asserts the exact tool list.

### 6. Update operator documentation

Update `README.md` with:

- Tool purpose and input example
- Side effects and timeout expectations
- Any new environment variable
- Any deployment or network requirement

## When a tool needs compilation

Keep protocol input separate from Weaver's internal DTO when the MCP-facing shape should be simpler or safer.

```text
MCP input schema
  -> semantic validation
  -> deterministic compiler
  -> Weaver DTO
  -> WeaverClient
```

Compiler requirements:

- Reject invalid references and impossible graphs before calling Weaver.
- Produce deterministic output for the same input.
- Preserve input order when it is the tie-breaker.
- Keep compiler tests independent from HTTP tests.
- Do not silently invent behavior that belongs in Weaver.

Raw payload modes should validate required Weaver fields and otherwise avoid normalization or renaming.

## Errors and response passthrough

Use these boundaries:

| Failure source | Behavior |
|---|---|
| Invalid MCP arguments | MCP validation error or `INVALID_INPUT` |
| Sidecar graph/compiler rejection | `INVALID_INPUT` |
| Weaver cannot be reached | `WEAVER_UNREACHABLE` |
| Request deadline expires | `WEAVER_TIMEOUT` |
| Weaver returns invalid JSON | `INVALID_WEAVER_RESPONSE` |
| All-page safety limit is reached | `WEAVER_PAGE_LIMIT` |
| Weaver returns 4xx/5xx JSON | Preserve body and set MCP `isError: true` |

Do not convert Weaver errors into sidecar error codes. That would hide the backend contract from MCP clients.

## Configuration and deployment boundaries

- The process exposes stateless Streamable HTTP at `/mcp`.
- `/healthz` checks the sidecar process.
- `/readyz` performs a bounded Weaver connectivity check.
- `MCP_ALLOWED_HOSTS` protects the Host header.
- `MCP_ALLOWED_ORIGINS` controls browser origins.
- Authentication and TLS belong at the reverse proxy or tunnel in v1.
- Docker publishes the sidecar on loopback by default.

## Development checks

Run these from `mcp-server/`:

```sh
pnpm run typecheck
pnpm test
pnpm run build
```

For container validation:

```sh
docker compose config
docker compose up --build -d
docker compose ps
```

Check both health endpoints, then initialize an official MCP client and confirm that `listTools()` returns the expected tool surface.

## Definition of done for a new tool

- [ ] REST contract confirmed against the active Weaver branch
- [ ] Zod schema and inferred type added
- [ ] REST client method added with safe encoding and timeout
- [ ] Tool registered with description and all annotations
- [ ] Weaver response passthrough preserved
- [ ] Sidecar failures use a stable sidecar error code
- [ ] Schema, REST, and MCP integration tests added
- [ ] Exact tool-list expectation updated
- [ ] README tool reference updated
- [ ] Typecheck, tests, build, and smoke checks pass
