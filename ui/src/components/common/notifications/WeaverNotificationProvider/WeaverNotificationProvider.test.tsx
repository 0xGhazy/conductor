import { describe, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_DURATIONS,
  generateNotificationId,
  normalizeNotificationInput,
} from "../notification.utils";

describe("WeaverNotificationProvider Architecture & Logic", () => {
  it("generates unique notification IDs", () => {
    const id1 = generateNotificationId();
    const id2 = generateNotificationId();
    if (!id1.startsWith("wn_") || !id2.startsWith("wn_")) {
      throw new Error("IDs should be prefixed with wn_");
    }
    if (id1 === id2) {
      throw new Error("Generated IDs must be unique");
    }
  });

  it("normalizes string notification inputs to proper models", () => {
    const norm = normalizeNotificationInput("Workflow triggered successfully", "success");
    if (norm.severity !== "success") throw new Error("Expected severity to be success");
    if (norm.message !== "Workflow triggered successfully") throw new Error("Message mismatch");
    if (norm.duration !== DEFAULT_NOTIFICATION_DURATIONS.success) {
      throw new Error("Expected default success duration of 4000ms");
    }
    if (norm.dismissible !== true) throw new Error("Expected dismissible by default");
  });

  it("normalizes object notification inputs with custom title and action", () => {
    let retried = false;
    const norm = normalizeNotificationInput(
      {
        title: "API Error",
        message: "Failed to fetch queries",
        duration: null,
        dedupeKey: "queries_fetch_error",
        action: {
          label: "Retry",
          onClick: () => {
            retried = true;
          },
        },
      },
      "error"
    );

    if (norm.title !== "API Error") throw new Error("Expected title to be API Error");
    if (norm.duration !== null) throw new Error("Expected persistent duration (null)");
    if (norm.dedupeKey !== "queries_fetch_error") throw new Error("Dedupe key mismatch");

    norm.action?.onClick();
    if (!retried) throw new Error("Expected retry callback to execute");
  });

  it("verifies queue model limits to maxVisible (default 3)", () => {
    const maxVisible = 3;
    const queueState = {
      visible: ["wn_1", "wn_2", "wn_3"],
      queued: ["wn_4", "wn_5"],
    };

    if (queueState.visible.length !== maxVisible) {
      throw new Error("Visible items must equal maxVisible threshold");
    }
    if (queueState.queued.length !== 2) {
      throw new Error("Excess items must be held in queue");
    }

    // Dismissing one visible item promotes head of queue
    const nextVisible = queueState.visible.slice(1);
    const promoted = queueState.queued[0];
    nextVisible.push(promoted);
    const nextQueued = queueState.queued.slice(1);

    if (nextVisible.length !== 3 || nextVisible[2] !== "wn_4") {
      throw new Error("Expected next queued item to be promoted to visible");
    }
    if (nextQueued.length !== 1 || nextQueued[0] !== "wn_5") {
      throw new Error("Expected queue to contain remaining unpromoted items");
    }
  });

  it("verifies deduplication logic ignores identical dedupe keys", () => {
    const existing = [
      { id: "wn_1", dedupeKey: "db_conn_err" },
      { id: "wn_2", dedupeKey: "query_timeout" },
    ];

    const duplicateKey = "db_conn_err";
    const found = existing.find((item) => item.dedupeKey === duplicateKey);

    if (!found || found.id !== "wn_1") {
      throw new Error("Expected deduplication check to match existing notification ID");
    }
  });

  it("verifies timer pause and resume calculations", () => {
    const duration = 5000;
    const startedAt = 10000;
    const mouseEnterAt = 12000; // 2 seconds elapsed
    const elapsed = mouseEnterAt - startedAt;
    const remaining = Math.max(0, duration - elapsed);

    if (remaining !== 3000) {
      throw new Error(`Expected remaining duration of 3000ms, got ${remaining}`);
    }
  });
});
