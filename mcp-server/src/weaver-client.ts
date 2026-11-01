import type { Config } from "./config.js";
import { SidecarError } from "./errors.js";
import type { Logger } from "./logger.js";
import type { ListWorkflowsInput } from "./workflow/schemas.js";

export interface WeaverResponse {
  status: number;
  body: unknown;
  requestId?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export class WeaverClient {
  constructor(
    private readonly config: Config,
    private readonly logger: Logger,
  ) {}

  async listWorkflows(input: ListWorkflowsInput): Promise<WeaverResponse> {
    if (input.mode === "page")
      return this.getWorkflowPage(input.page, input.size, input.sort);

    const pages: unknown[] = [];
    for (let page = 0; page < this.config.listMaxPages; page += 1) {
      const response = await this.getWorkflowPage(page, input.size, input.sort);
      if (response.status < 200 || response.status >= 300) return response;
      pages.push(response.body);
      const details =
        isRecord(response.body) && isRecord(response.body.details)
          ? response.body.details
          : undefined;
      if (details?.isLastPage === true) {
        return {
          status: response.status,
          body: pages,
          ...(response.requestId ? { requestId: response.requestId } : {}),
        };
      }
      if (typeof details?.isLastPage !== "boolean") {
        throw new SidecarError(
          "INVALID_WEAVER_RESPONSE",
          "Workflow list response is missing details.isLastPage",
          { page },
        );
      }
    }
    throw new SidecarError(
      "WEAVER_PAGE_LIMIT",
      `Workflow listing exceeded the configured limit of ${this.config.listMaxPages} pages`,
      { maxPages: this.config.listMaxPages, pages },
    );
  }

  describeWorkflow(name: string): Promise<WeaverResponse> {
    return this.request(
      "describe_workflow",
      `/api/metadata/workflows/${encodeURIComponent(name)}`,
      {
        method: "GET",
      },
    );
  }

  executeWorkflow(
    name: string,
    input: Record<string, unknown>,
  ): Promise<WeaverResponse> {
    return this.request(
      "execute_workflow",
      `/api/executor/${encodeURIComponent(name)}`,
      {
        method: "POST",
        body: JSON.stringify(input),
        headers: { "content-type": "application/json" },
        timeoutMs: this.config.executionTimeoutMs,
      },
    );
  }

  createWorkflow(payload: unknown): Promise<WeaverResponse> {
    const params = new URLSearchParams({ incrementVersion: "false" });
    if (
      isRecord(payload) &&
      typeof payload.version === "number" &&
      Number.isInteger(payload.version)
    ) {
      params.set("version", String(payload.version));
    }
    return this.request(
      "create_workflow",
      `/api/workflows/upsert/new?${params.toString()}`,
      {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
      },
    );
  }

  async ready(): Promise<boolean> {
    try {
      const response = await this.getWorkflowPage(0, 1, ["workflowName,asc"]);
      return response.status >= 200 && response.status < 300;
    } catch {
      return false;
    }
  }

  private getWorkflowPage(
    page: number,
    size: number,
    sort: string[],
  ): Promise<WeaverResponse> {
    const params = new URLSearchParams({
      page: String(page),
      size: String(size),
    });
    for (const value of sort) params.append("sort", value);
    return this.request(
      "list_workflows",
      `/api/metadata/workflows?${params.toString()}`,
      { method: "GET" },
    );
  }

  private async request(
    operation: string,
    path: string,
    options: RequestInit & { timeoutMs?: number },
  ): Promise<WeaverResponse> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? this.config.requestTimeoutMs;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(`${this.config.weaverBaseUrl}${path}`, {
        ...options,
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      if (controller.signal.aborted) {
        this.logger.warn("weaver_request_timeout", {
          operation,
          durationMs: Date.now() - startedAt,
        });
        throw new SidecarError(
          "WEAVER_TIMEOUT",
          `Weaver did not respond within ${timeoutMs}ms`,
        );
      }
      this.logger.error("weaver_request_failed", {
        operation,
        durationMs: Date.now() - startedAt,
      });
      throw new SidecarError(
        "WEAVER_UNREACHABLE",
        "Unable to reach the Weaver API",
        {
          cause: error instanceof Error ? error.message : String(error),
        },
      );
    }

    let text: string;
    try {
      text = await response.text();
    } catch (error) {
      if (controller.signal.aborted) {
        this.logger.warn("weaver_request_timeout", {
          operation,
          durationMs: Date.now() - startedAt,
        });
        throw new SidecarError(
          "WEAVER_TIMEOUT",
          `Weaver did not respond within ${timeoutMs}ms`,
        );
      }
      throw new SidecarError(
        "WEAVER_UNREACHABLE",
        "The Weaver response stream ended unexpectedly",
        { cause: error instanceof Error ? error.message : String(error) },
      );
    } finally {
      clearTimeout(timeout);
    }
    let body: unknown = {};
    if (text !== "") {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        throw new SidecarError(
          "INVALID_WEAVER_RESPONSE",
          "Weaver returned a non-JSON response",
          {
            status: response.status,
          },
        );
      }
    }

    const bodyRequestId =
      isRecord(body) && typeof body.requestId === "string"
        ? body.requestId
        : undefined;
    const requestId =
      bodyRequestId ?? response.headers.get("x-request-id") ?? undefined;
    this.logger.info("weaver_request_complete", {
      operation,
      durationMs: Date.now() - startedAt,
      status: response.status,
      ...(requestId ? { requestId } : {}),
    });
    return {
      status: response.status,
      body,
      ...(requestId ? { requestId } : {}),
    };
  }
}
