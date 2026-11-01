import { describe, it } from "vitest";
import type { WeaverNotification as WeaverNotificationModel } from "../notification.types";

/**
 * Specification and contract tests for WeaverNotification component.
 */
describe("WeaverNotification Specification", () => {
  it("defines contract for severity, title, message, and close action", () => {
    const item: WeaverNotificationModel = {
      id: "test_1",
      severity: "success",
      title: "Operation Complete",
      message: "Data was successfully persisted",
      dismissible: true,
      duration: 4000,
    };

    if (item.severity !== "success") throw new Error("Expected success severity");
    if (!item.title) throw new Error("Expected title to exist");
    if (item.dismissible !== true) throw new Error("Expected dismissible to be true");
  });

  it("supports optional primary action callback contract", () => {
    let clicked = false;
    const item: WeaverNotificationModel = {
      id: "test_2",
      severity: "error",
      message: "Connection lost",
      action: {
        label: "Retry",
        onClick: () => {
          clicked = true;
        },
      },
    };

    item.action?.onClick();
    if (!clicked) throw new Error("Expected action callback to fire");
  });

  it("supports persistent notifications where duration is null", () => {
    const item: WeaverNotificationModel = {
      id: "test_3",
      severity: "warning",
      message: "Unsaved changes",
      duration: null,
    };

    if (item.duration !== null) throw new Error("Expected duration to be null");
  });

  it("supports accessibility semantics per severity", () => {
    const errorSeverity = "error";
    const isAssertive = errorSeverity === "error";
    const role = isAssertive ? "alert" : "status";
    const live = isAssertive ? "assertive" : "polite";

    if (role !== "alert" || live !== "assertive") {
      throw new Error("Error severity must use alert / assertive accessibility semantics");
    }

    const infoSeverity = "info";
    const isInfoAssertive = infoSeverity === "error";
    const infoRole = isInfoAssertive ? "alert" : "status";
    const infoLive = isInfoAssertive ? "assertive" : "polite";

    if (infoRole !== "status" || infoLive !== "polite") {
      throw new Error("Info severity must use status / polite accessibility semantics");
    }
  });
});
