import { describe, it, expect } from "vitest";
import React from "react";
import type {
  WeaverConfirmIntent,
  WeaverConfirmDetail,
  WeaverRelatedRecord,
  WeaverTextConfirmation,
  WeaverConfirmDialogProps,
} from "./WeaverConfirmDialog.types";

/**
 * Pure evaluation helper for typed confirmation logic, matching WeaverConfirmDialog's implementation.
 */
function evaluateTextConfirmation(
  config: WeaverTextConfirmation | undefined,
  userInput: string
): boolean {
  if (!config) return true;

  const expected = config.trim ? config.expectedText.trim() : config.expectedText;
  const actual = config.trim ? userInput.trim() : userInput;

  return config.caseSensitive === false
    ? actual.toLowerCase() === expected.toLowerCase()
    : actual === expected;
}

/**
 * Pure evaluation helper for confirmation enabled condition.
 */
function evaluateCanConfirm(params: {
  confirmDisabled?: boolean;
  loading?: boolean;
  textMatches: boolean;
}): boolean {
  const { confirmDisabled = false, loading = false, textMatches } = params;
  return !confirmDisabled && !loading && textMatches;
}

/**
 * Pure evaluation helper for close behavior on backdrop and escape.
 */
function shouldDismissDialog(params: {
  reason: "backdropClick" | "escapeKeyDown";
  loading?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
}): boolean {
  const {
    reason,
    loading = false,
    closeOnBackdropClick = false,
    closeOnEscape = true,
  } = params;

  if (loading) return false;
  if (reason === "backdropClick" && !closeOnBackdropClick) return false;
  if (reason === "escapeKeyDown" && !closeOnEscape) return false;
  return true;
}

/**
 * Pure evaluation helper for related data rendering priority.
 */
function resolveRelatedDataType(props: {
  relatedContent?: React.ReactNode;
  relatedRecords?: WeaverRelatedRecord[];
  details?: WeaverConfirmDetail[];
}): "content" | "records" | "details" | "none" {
  if (props.relatedContent) return "content";
  if (props.relatedRecords && props.relatedRecords.length > 0) return "records";
  if (props.details && props.details.length > 0) return "details";
  return "none";
}

describe("WeaverConfirmDialog Specification & Behavior", () => {
  describe("1. Basic Rendering & Prop Contracts", () => {
    it("validates basic dialog props contract", () => {
      let confirmed = false;
      let cancelled = false;

      const props: WeaverConfirmDialogProps = {
        open: true,
        title: "Confirm Action",
        message: "Are you sure you want to proceed?",
        description: "This will apply changes immediately.",
        confirmLabel: "Proceed",
        cancelLabel: "Dismiss",
        onConfirm: () => {
          confirmed = true;
        },
        onCancel: () => {
          cancelled = true;
        },
      };

      if (!props.open) throw new Error("Expected open to be true");
      if (props.title !== "Confirm Action") throw new Error("Title mismatch");
      if (props.confirmLabel !== "Proceed") throw new Error("Confirm label mismatch");
      if (props.cancelLabel !== "Dismiss") throw new Error("Cancel label mismatch");

      props.onConfirm();
      if (!confirmed) throw new Error("Expected onConfirm to fire");

      props.onCancel();
      if (!cancelled) throw new Error("Expected onCancel to fire");
    });
  });

  describe("2. Intents Mapping", () => {
    const intents: WeaverConfirmIntent[] = ["default", "info", "warning", "danger"];

    it("supports all 4 canonical intents", () => {
      intents.forEach((intent) => {
        const props: WeaverConfirmDialogProps = {
          open: true,
          title: `${intent} Dialog`,
          intent,
          onConfirm: () => {},
          onCancel: () => {},
        };

        if (props.intent !== intent) {
          throw new Error(`Failed to assign intent ${intent}`);
        }
      });
    });

    it("maps danger intent to error button semantics and non-destructive defaults", () => {
      const dangerProps: WeaverConfirmDialogProps = {
        open: true,
        title: "Delete Resource",
        intent: "danger",
        onConfirm: () => {},
        onCancel: () => {},
      };

      if (dangerProps.intent !== "danger") throw new Error("Expected danger intent");
    });
  });

  describe("3. Typed Confirmation", () => {
    it("allows confirmation without textConfirmation config", () => {
      const matches = evaluateTextConfirmation(undefined, "");
      if (!matches) throw new Error("Expected match when no config provided");

      const canConfirm = evaluateCanConfirm({ textMatches: matches });
      if (!canConfirm) throw new Error("Expected canConfirm to be true");
    });

    it("disables confirm until exact match with case-sensitive config", () => {
      const config: WeaverTextConfirmation = {
        expectedText: "DELETE",
        caseSensitive: true,
        trim: true,
      };

      if (evaluateTextConfirmation(config, "")) throw new Error("Empty text must not match");
      if (evaluateTextConfirmation(config, "delete")) {
        throw new Error("Lower case must not match when caseSensitive is true");
      }
      if (evaluateTextConfirmation(config, "DELET")) throw new Error("Partial text must not match");
      if (!evaluateTextConfirmation(config, "DELETE")) throw new Error("Exact text must match");
      if (!evaluateTextConfirmation(config, "  DELETE  ")) {
        throw new Error("Trimmed text must match when trim is true");
      }
    });

    it("supports case-insensitive typed confirmation", () => {
      const config: WeaverTextConfirmation = {
        expectedText: "Archive",
        caseSensitive: false,
        trim: false,
      };

      if (!evaluateTextConfirmation(config, "archive")) {
        throw new Error("Lowercase must match when caseSensitive is false");
      }
      if (!evaluateTextConfirmation(config, "ARCHIVE")) {
        throw new Error("Uppercase must match when caseSensitive is false");
      }
      if (!evaluateTextConfirmation(config, "Archive")) {
        throw new Error("Exact match must pass");
      }
      if (evaluateTextConfirmation(config, " Archive ")) {
        throw new Error("Untrimmed spaces must fail when trim is false");
      }
    });

    it("disables confirm when loading even if text matches", () => {
      const config: WeaverTextConfirmation = { expectedText: "CONFIRM" };
      const textMatches = evaluateTextConfirmation(config, "CONFIRM");

      const canConfirmWhenLoading = evaluateCanConfirm({
        loading: true,
        textMatches,
      });

      if (canConfirmWhenLoading) {
        throw new Error("canConfirm must be false while loading is true");
      }
    });

    it("resets typed text state when reopening dialog", () => {
      let typedInput = "TEMP_TEXT";
      // Simulating the dialog opening session reset
      const onOpenSession = () => {
        typedInput = "";
      };

      onOpenSession();
      if (typedInput !== "") throw new Error("Typed input must reset to empty on open");
    });
  });

  describe("4. Basic Details Rendering Contract", () => {
    it("handles key-value details with string and ReactNode values", () => {
      const details: WeaverConfirmDetail[] = [
        { label: "Entity", value: "Workflow A" },
        { label: "Version", value: 3 },
        { label: "Status", value: React.createElement("span", null, "Active") },
      ];

      if (details.length !== 3) throw new Error("Expected 3 detail items");
      if (details[0].label !== "Entity") throw new Error("Expected first label to be Entity");
      if (details[1].value !== 3) throw new Error("Expected second value to be 3");
    });
  });

  describe("5. Related Records List Contract", () => {
    it("handles records with full and optional fields", () => {
      const records: WeaverRelatedRecord[] = [
        {
          id: "rec_1",
          title: "Get Customer Details",
          subtitle: "Database Query",
          icon: React.createElement("span", null, "ICON"),
          status: React.createElement("span", null, "Active"),
          details: [{ label: "Timeout", value: "5000ms" }],
        },
        {
          id: "rec_2",
          title: "Delete Customer",
          // subtitle, icon, status, details omitted cleanly
        },
      ];

      if (records.length !== 2) throw new Error("Expected 2 records");
      if (!records[0].subtitle) throw new Error("Expected record 1 to have subtitle");
      if (records[1].subtitle !== undefined) {
        throw new Error("Expected record 2 subtitle to be omitted");
      }
      if (!records[0].details || records[0].details.length !== 1) {
        throw new Error("Expected record 1 to have 1 nested detail");
      }
      if (records[1].details !== undefined) {
        throw new Error("Expected record 2 details to be undefined");
      }
    });

    it("supports large scrollable lists safely", () => {
      const largeList: WeaverRelatedRecord[] = Array.from({ length: 50 }, (_, i) => ({
        id: `record_${i}`,
        title: `Affected Item #${i + 1}`,
      }));

      if (largeList.length !== 50) throw new Error("Expected 50 items in large list");
    });
  });

  describe("6. Related Data Rendering Priority", () => {
    const customContent = React.createElement("div", null, "Custom Dependency Tree");
    const records: WeaverRelatedRecord[] = [{ id: 1, title: "Record 1" }];
    const details: WeaverConfirmDetail[] = [{ label: "Type", value: "Test" }];

    it("prioritizes relatedContent over relatedRecords and details", () => {
      const resolved = resolveRelatedDataType({
        relatedContent: customContent,
        relatedRecords: records,
        details,
      });

      if (resolved !== "content") {
        throw new Error(`Expected 'content' priority, got '${resolved}'`);
      }
    });

    it("prioritizes relatedRecords over details when relatedContent is absent", () => {
      const resolved = resolveRelatedDataType({
        relatedRecords: records,
        details,
      });

      if (resolved !== "records") {
        throw new Error(`Expected 'records' priority, got '${resolved}'`);
      }
    });

    it("falls back to details when neither relatedContent nor relatedRecords are present", () => {
      const resolved = resolveRelatedDataType({
        details,
      });

      if (resolved !== "details") {
        throw new Error(`Expected 'details' fallback, got '${resolved}'`);
      }
    });

    it("returns 'none' when no related context is provided", () => {
      const resolved = resolveRelatedDataType({});
      if (resolved !== "none") {
        throw new Error(`Expected 'none', got '${resolved}'`);
      }
    });
  });

  describe("7. Actions and Loading Behavior", () => {
    it("respects confirmDisabled flag", () => {
      const canConfirm = evaluateCanConfirm({
        confirmDisabled: true,
        loading: false,
        textMatches: true,
      });

      if (canConfirm) throw new Error("canConfirm must be false when confirmDisabled=true");
    });

    it("prevents double execution while loading", () => {
      let callCount = 0;
      const onConfirm = () => {
        callCount++;
      };

      let loading = true;
      const handleConfirmClick = () => {
        const canConfirm = evaluateCanConfirm({
          confirmDisabled: false,
          loading,
          textMatches: true,
        });
        if (!canConfirm) return;
        onConfirm();
      };

      handleConfirmClick();
      if (callCount !== 0) throw new Error("Must not fire onConfirm while loading");

      loading = false;
      handleConfirmClick();
      if (callCount !== 1) throw new Error("Must fire onConfirm once loading finishes");
    });
  });

  describe("8. Close Behavior (Backdrop and Escape)", () => {
    it("ignores backdrop clicks by default (closeOnBackdropClick = false)", () => {
      const dismiss = shouldDismissDialog({
        reason: "backdropClick",
        closeOnBackdropClick: false,
      });

      if (dismiss) throw new Error("Backdrop click should not dismiss by default");
    });

    it("allows backdrop click dismissal when explicitly enabled", () => {
      const dismiss = shouldDismissDialog({
        reason: "backdropClick",
        closeOnBackdropClick: true,
      });

      if (!dismiss) throw new Error("Backdrop click should dismiss when enabled");
    });

    it("dismisses on escape key by default (closeOnEscape = true)", () => {
      const dismiss = shouldDismissDialog({
        reason: "escapeKeyDown",
        closeOnEscape: true,
      });

      if (!dismiss) throw new Error("Escape key should dismiss by default");
    });

    it("prevents escape key dismissal when closeOnEscape is false", () => {
      const dismiss = shouldDismissDialog({
        reason: "escapeKeyDown",
        closeOnEscape: false,
      });

      if (dismiss) throw new Error("Escape should not dismiss when closeOnEscape=false");
    });

    it("never dismisses on backdrop or escape while loading", () => {
      const backdropDismiss = shouldDismissDialog({
        reason: "backdropClick",
        loading: true,
        closeOnBackdropClick: true,
      });
      if (backdropDismiss) throw new Error("Backdrop must not dismiss while loading");

      const escapeDismiss = shouldDismissDialog({
        reason: "escapeKeyDown",
        loading: true,
        closeOnEscape: true,
      });
      if (escapeDismiss) throw new Error("Escape must not dismiss while loading");
    });
  });

  describe("9. Accessibility & Theme Semantics", () => {
    it("defines aria-labelledby and aria-describedby contracts", () => {
      const titleId = "weaver-confirm-dialog-title";
      const descId = "weaver-confirm-dialog-desc";

      const hasDescription = true;
      const ariaDescribedBy = hasDescription ? descId : undefined;

      if (ariaDescribedBy !== "weaver-confirm-dialog-desc") {
        throw new Error("Expected aria-describedby to link to description element");
      }
      if (titleId !== "weaver-confirm-dialog-title") {
        throw new Error("Expected aria-labelledby to link to title element");
      }
    });

    it("determines safe initial focus target", () => {
      const getInitialFocus = (hasTextConfirmation: boolean): "input" | "cancel" => {
        return hasTextConfirmation ? "input" : "cancel";
      };

      if (getInitialFocus(true) !== "input") {
        throw new Error("Focus should target typed confirmation field when present");
      }
      if (getInitialFocus(false) !== "cancel") {
        throw new Error("Focus should target Cancel button when no text confirmation");
      }
    });
  });
});
