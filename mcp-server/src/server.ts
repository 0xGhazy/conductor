import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { loadConfig } from "./config.js";
import { Logger } from "./logger.js";
import { createWeaverMcpServer } from "./tools.js";
import { WeaverClient } from "./weaver-client.js";

const config = loadConfig();
const logger = new Logger(config.logLevel);
const weaverClient = new WeaverClient(config, logger);

const mcpHandler = createMcpHandler(
  () => createWeaverMcpServer(weaverClient, logger),
  {
    legacy: "stateless",
    responseMode: "json",
    onerror: (error) =>
      logger.error("mcp_protocol_error", { message: error.message }),
  },
);

const handleMcp = toNodeHandler(mcpHandler);

const json = (
  response: ServerResponse,
  status: number,
  body: unknown,
): void => {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
};

const requestHostname = (request: IncomingMessage): string | undefined => {
  const host = request.headers.host?.trim().toLowerCase();
  if (!host) return undefined;
  if (host.startsWith("[")) {
    const closingBracket = host.indexOf("]");
    return closingBracket >= 0 ? host.slice(0, closingBracket + 1) : undefined;
  }
  return host.split(":", 1)[0];
};

const requestAllowed = (
  request: IncomingMessage,
  response: ServerResponse,
): boolean => {
  const hostname = requestHostname(request);
  if (hostname === undefined || !config.allowedHosts.has(hostname)) {
    json(response, 403, { error: "Host header is not allowed" });
    return false;
  }

  const origin = request.headers.origin?.trim().toLowerCase();
  if (origin !== undefined && !config.allowedOrigins.has(origin)) {
    json(response, 403, { error: "Origin header is not allowed" });
    return false;
  }
  return true;
};

const httpServer = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;

  if (pathname === "/healthz" && request.method === "GET") {
    json(response, 200, { status: "ok" });
    return;
  }

  if (pathname === "/readyz" && request.method === "GET") {
    const ready = await weaverClient.ready();
    json(response, ready ? 200 : 503, {
      status: ready ? "ready" : "not_ready",
    });
    return;
  }

  if (pathname !== "/mcp") {
    json(response, 404, { error: "Not found" });
    return;
  }

  if (!requestAllowed(request, response)) return;

  try {
    await handleMcp(
      request as unknown as Parameters<typeof handleMcp>[0],
      response as unknown as Parameters<typeof handleMcp>[1],
    );
  } catch (error) {
    logger.error("mcp_http_error", {
      message: error instanceof Error ? error.message : String(error),
    });
    if (!response.headersSent)
      json(response, 500, { error: "Internal MCP server error" });
    else response.end();
  }
});

httpServer.listen(config.port, config.host, () => {
  logger.info("server_started", {
    host: config.host,
    port: config.port,
    weaverBaseUrl: config.weaverBaseUrl,
    authentication: "disabled",
  });
});

let shuttingDown = false;
const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("server_stopping", { signal });
  httpServer.closeIdleConnections();
  await mcpHandler.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  logger.info("server_stopped");
};

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void shutdown(signal).then(() => process.exit(0));
  });
}
