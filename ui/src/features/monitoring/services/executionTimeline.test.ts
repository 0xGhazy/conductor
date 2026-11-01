import { describe, expect, it } from "vitest";
import { buildExecutionTimeline } from "./executionTimeline";

describe("buildExecutionTimeline", () => {
  it("splits tasks into gap, queue and execution segments", () => {
    const { rows, totalMs } = buildExecutionTimeline(
      [
        { referenceTaskName: "b", seq: 2, scheduledTime: 1300, startTime: 1350, endTime: 1500 },
        { referenceTaskName: "a", seq: 1, scheduledTime: 1000, startTime: 1100, endTime: 1200 },
      ],
      1000,
      1500
    );

    expect(rows.map((row) => row.task.referenceTaskName)).toEqual(["a", "b"]);
    expect(rows[0]).toMatchObject({ gapMs: 0, queueMs: 100, executionMs: 100 });
    expect(rows[0].segments).toEqual([
      { kind: "queue", startMs: 0, endMs: 100 },
      { kind: "execution", startMs: 100, endMs: 200 },
    ]);
    expect(rows[1]).toMatchObject({ gapMs: 100, queueMs: 50, executionMs: 150 });
    expect(rows[1].segments[0]).toEqual({ kind: "gap", startMs: 200, endMs: 300 });
    expect(totalMs).toBe(500);
  });

  it("does not report a gap for tasks that ran in parallel", () => {
    const { rows } = buildExecutionTimeline(
      [
        { referenceTaskName: "a", seq: 1, scheduledTime: 1000, startTime: 1000, endTime: 1400 },
        { referenceTaskName: "b", seq: 2, scheduledTime: 1100, startTime: 1100, endTime: 1200 },
      ],
      1000,
      1400
    );

    expect(rows[1].gapMs).toBe(0);
  });

  it("runs unfinished spans until now while the workflow is running", () => {
    const { rows, totalMs } = buildExecutionTimeline(
      [
        { referenceTaskName: "running", seq: 1, scheduledTime: 1000, startTime: 1000, endTime: 0 },
        { referenceTaskName: "queued", seq: 2, scheduledTime: 1500, startTime: 0, endTime: 0 },
      ],
      1000,
      0,
      2000
    );

    expect(rows[0].executionMs).toBe(1000);
    expect(rows[1]).toMatchObject({ queueMs: 500, executionMs: 0 });
    expect(totalMs).toBe(1000);
  });
});
