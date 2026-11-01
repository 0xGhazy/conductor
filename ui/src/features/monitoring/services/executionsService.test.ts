import { describe, expect, it } from "vitest";
import {
  formatExecutionLogLine,
  formatLogLevelToken,
  formatLogTimestampIso,
  getExecutionTaskDurationMs,
  getExecutionTaskReferenceName,
  indexExecutionTasksByReference,
  parseTaskLogLine,
} from "./executionsService";

describe("execution task helpers", () => {
  it("strips loop iteration suffixes from reference names", () => {
    expect(getExecutionTaskReferenceName({ referenceTaskName: "ship_item__3" })).toBe("ship_item");
    expect(getExecutionTaskReferenceName({ taskReferenceName: "fetch_order" })).toBe("fetch_order");
  });

  it("keeps the latest attempt per reference name", () => {
    const index = indexExecutionTasksByReference([
      { referenceTaskName: "fetch_order", seq: 1, status: "FAILED" },
      { referenceTaskName: "fetch_order", seq: 2, status: "COMPLETED" },
      { referenceTaskName: "ship_item__1", seq: 3, status: "COMPLETED" },
      { referenceTaskName: "ship_item__2", seq: 4, status: "IN_PROGRESS" },
    ]);

    expect(index.get("fetch_order")?.status).toBe("COMPLETED");
    expect(index.get("ship_item")?.status).toBe("IN_PROGRESS");
  });

  it("computes duration only for finished tasks", () => {
    expect(getExecutionTaskDurationMs({ startTime: 1000, endTime: 1250 })).toBe(250);
    expect(getExecutionTaskDurationMs({ startTime: 1000, endTime: 0 })).toBeUndefined();
  });
});

describe("parseTaskLogLine", () => {
  const entry = (log: string) => ({ taskId: "t1", log, createdTime: 1000 });

  it("reads a leading level token and strips it from the message", () => {
    expect(parseTaskLogLine(entry("[WARN] Slow response"))).toMatchObject({ level: "WARN", message: "Slow response" });
    expect(parseTaskLogLine(entry("ERROR: boom"))).toMatchObject({ level: "ERROR", message: "boom" });
    expect(parseTaskLogLine(entry("warning - retrying"))).toMatchObject({ level: "WARN", message: "retrying" });
  });

  it("treats exception lines as errors and everything else as info", () => {
    expect(parseTaskLogLine(entry("com.zaxxer.hikari.pool.HikariPool$PoolInitializationException: x")).level).toBe("ERROR");
    expect(parseTaskLogLine(entry("Start http worker"))).toMatchObject({ level: "INFO", message: "Start http worker" });
    expect(parseTaskLogLine(entry("information only"))).toMatchObject({ level: "INFO", message: "information only" });
  });

  it("separates double-colon log levels and clean messages", () => {
    expect(parseTaskLogLine(entry("error::Worker input is missing, expected object but got null"))).toMatchObject({
      level: "ERROR",
      message: "Worker input is missing, expected object but got null",
    });
    expect(parseTaskLogLine(entry("info::Worker input is missing, expected object but got null"))).toMatchObject({
      level: "INFO",
      message: "Worker input is missing, expected object but got null",
    });
    expect(parseTaskLogLine(entry("warn::Worker input is missing, expected object but got null"))).toMatchObject({
      level: "WARN",
      message: "Worker input is missing, expected object but got null",
    });
    expect(parseTaskLogLine(entry("debug::Worker input is missing, expected object but got null"))).toMatchObject({
      level: "DEBUG",
      message: "Worker input is missing, expected object but got null",
    });
    expect(parseTaskLogLine(entry("trace::Worker input is missing, expected object but got null"))).toMatchObject({
      level: "TRACE",
      message: "Worker input is missing, expected object but got null",
    });
  });

  it("parses pre-formatted standard Weaver log lines", () => {
    const raw = "2026-10-20T23:16:28,947 [INFO ] weaver.action.HTTP (fetch_data) - Fetching execution logs for taskId=5f3c2513";
    const res = parseTaskLogLine(entry(raw));
    expect(res.level).toBe("INFO");
    expect(res.taskName).toBe("HTTP");
    expect(res.taskReferenceName).toBe("fetch_data");
    expect(res.message).toBe("Fetching execution logs for taskId=5f3c2513");
  });

  it("safely handles non-string arguments when invoked in Array.prototype.map style", () => {
    // Array.map passes (element, index, array). Ensure index or array are not treated as strings.
    const res = (parseTaskLogLine as any)(entry("info::Test map pass-through"), 0, [entry("test")]);
    expect(res.level).toBe("INFO");
    expect(res.taskReferenceName).toBeUndefined();
    expect(res.taskName).toBeUndefined();
    expect(res.message).toBe("Test map pass-through");
  });

  it("safely serializes non-string log entry payloads without throwing", () => {
    const res = (parseTaskLogLine as any)({ log: { nested: "object" } as any, taskId: "t2", createdTime: 5000 });
    expect(res.message).toBe('{"nested":"object"}');
  });
});

describe("log formatters", () => {
  it("formats log timestamps as YYYY-MM-DDTHH:mm:ss,SSS", () => {
    const date = new Date(2026, 9, 20, 23, 16, 28, 947);
    expect(formatLogTimestampIso(date.getTime())).toBe("2026-10-20T23:16:28,947");
  });

  it("pads log levels to 5 characters in brackets", () => {
    expect(formatLogLevelToken("INFO")).toBe("[INFO ]");
    expect(formatLogLevelToken("WARN")).toBe("[WARN ]");
    expect(formatLogLevelToken("ERROR")).toBe("[ERROR]");
    expect(formatLogLevelToken("DEBUG")).toBe("[DEBUG]");
    expect(formatLogLevelToken("TRACE")).toBe("[TRACE]");
  });

  it("formats complete log line in exact Weaver format", () => {
    const date = new Date(2026, 9, 20, 23, 16, 28, 947);
    const line = formatExecutionLogLine({
      timestamp: date.getTime(),
      level: "INFO",
      taskName: "<TaskName>",
      taskReferenceName: "taskReferenceName",
      message: "Fetching execution logs for taskId=5f3c2513-6213-4110-bf61-fbe25ac03826",
    });

    expect(line).toBe(
      "2026-10-20T23:16:28,947 [INFO ] weaver.action.<TaskName> (taskReferenceName) - Fetching execution logs for taskId=5f3c2513-6213-4110-bf61-fbe25ac03826"
    );
  });
});
