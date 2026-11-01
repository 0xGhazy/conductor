import type { Node, Edge } from "@xyflow/react";
import type { WeaverNodePanelContext } from "../../nodeDefinition.types";
import { DEFAULT_HTTP_TIMEOUT } from "@/features/designer/utils/httpConstants";

/**
 * Parses a JSON string or returns an object safely, falling back to an empty object.
 */
function parseJsonObject(val: unknown): Record<string, any> {
  if (!val) return {};
  if (typeof val === "object" && !Array.isArray(val)) {
    return val as Record<string, any>;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed || trimmed === "{}") return {};
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Parses request body safely into an object, defaulting to {}.
 */
function parseJsonBody(val: unknown): Record<string, any> | unknown[] {
  if (!val) return {};
  if (typeof val === "object") {
    return val as Record<string, any> | unknown[];
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed || trimmed === "{}") return {};
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed !== null && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Serializes an HTTP Action node into the Conductor Simple Task format:
 *
 * {
 *   "name": "HttpWorker",
 *   "taskReferenceName": "http_request_kz9jw708",
 *   "inputParameters": {
 *     "method": "GET",
 *     "url": "http://localhost:8090/vodafone/bundles",
 *     "timeout": 3000,
 *     "connection": "--NONE--",
 *     "headers": {},
 *     "body": {}
 *   },
 *   "type": "SIMPLE"
 * }
 */
export function serializeHttpNodeForJson(
  node: Node,
  _context?: WeaverNodePanelContext & { edges?: Edge[] }
): Record<string, any> {
  const cfg = (node?.data?.config as Record<string, any>) || {};

  const rawTimeout = cfg.timeout !== undefined && cfg.timeout !== null && cfg.timeout !== ""
    ? Number(cfg.timeout)
    : DEFAULT_HTTP_TIMEOUT;
  const timeout = Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : DEFAULT_HTTP_TIMEOUT;

  let headers = parseJsonObject(cfg.headers);
  if (Object.keys(headers).length === 0 && Array.isArray(cfg.headersRows) && cfg.headersRows.length > 0) {
    headers = cfg.headersRows.reduce((acc: Record<string, any>, row: any) => {
      const key = String(row?.header ?? "").trim();
      if (key) acc[key] = String(row?.value ?? "");
      return acc;
    }, {});
  }

  const body = parseJsonBody(cfg.body !== undefined ? cfg.body : cfg.bodyDraftText);

  const taskReferenceName = String(
    cfg.taskReferenceName ||
    cfg.referenceName ||
    cfg.name ||
    (node?.data as any)?.name ||
    (node?.id ? `request_${node.id}` : "")
  );

  return {
    name: "HttpWorker",
    taskReferenceName,
    inputParameters: {
      method: String(cfg.method || "GET").toUpperCase(),
      url: String(cfg.url || ""),
      timeout,
      connection: String(cfg.connection || "--NONE--"),
      headers,
      body,
    },
    type: "SIMPLE",
  };
}

/**
 * Adapter export to guarantee backward compatibility with legacy callers of exportHttpActionData.
 */
export function exportHttpActionData(data: any, id: string, position: any = {}): Record<string, any> {
  const dummyNode = {
    id,
    position,
    data,
  } as Node;
  return serializeHttpNodeForJson(dummyNode);
}
