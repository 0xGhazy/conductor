import React, { useMemo } from "react";
import type { Node } from "@xyflow/react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { WeaverCodeEditor } from "@/components/common/editors";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import type { WeaverNodePanelContext } from "../nodeDefinition.types";

export interface NodeResultTabProps {
  node?: Node | null;
  context?: WeaverNodePanelContext;
  customResult?: any;
}

export const NodeResultTab: React.FC<NodeResultTabProps> = ({
  node,
  context,
  customResult,
}) => {
  const targetNode = node || context?.node;
  const storeRunResult = useDesignerStore((state) => state.runResultData);

  // Extract result strictly associated with targetNode
  const nodeResult = useMemo(() => {
    if (!targetNode) return null;
    if (customResult !== undefined) return customResult;
    if (context?.result !== undefined) return context.result;

    // Check if storeRunResult has node-specific output or task output
    if (!storeRunResult?.runWorkflowId && !storeRunResult?.runOutputJsonText) {
      return null;
    }

    try {
      const outputObj = storeRunResult.runOutputJsonText
        ? JSON.parse(storeRunResult.runOutputJsonText)
        : null;

      const refName =
        targetNode.data?.config?.name ||
        targetNode.data?.config?.referenceName ||
        targetNode.data?.config?.taskReferenceName ||
        targetNode.id;

      // Check if output dictionary has an entry for this node/task
      if (outputObj && typeof outputObj === "object") {
        if (outputObj[refName] !== undefined) {
          return {
            source: refName,
            status: "COMPLETED",
            output: outputObj[refName],
          };
        }
        if (outputObj[targetNode.id] !== undefined) {
          return {
            source: targetNode.id,
            status: "COMPLETED",
            output: outputObj[targetNode.id],
          };
        }
      }

      // If workflow has overall status and this node is Start or part of the workflow
      if (targetNode.type === "startFlag" || targetNode.id === "00000000-0000-0000-0000-000000000000") {
        return {
          source: "Workflow Root",
          status: storeRunResult.runWorkflowStatus || (storeRunResult.runSuccessStatus ? "COMPLETED" : "FAILED"),
          duration: storeRunResult.runDurationText,
          executionTimeMs: storeRunResult.runExecutionTimeMs,
          output: outputObj,
          error: storeRunResult.runReasonForIncompletion || (!storeRunResult.runSuccessStatus ? storeRunResult.runResultText : undefined),
        };
      }
    } catch {
      // Fallback
    }

    return null;
  }, [targetNode, customResult, context?.result, storeRunResult]);

  if (!targetNode) {
    return (
      <div style={{ padding: "16px", color: "var(--color-fg-muted, #667085)", fontSize: 13 }}>
        Select a node to inspect its execution result.
      </div>
    );
  }

  if (!nodeResult) {
    return (
      <Box
        sx={{
          p: 3,
          textAlign: "center",
          color: "var(--color-fg-muted, #667085)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          height: "100%",
          minHeight: 200,
        }}
      >
        <AccessTimeIcon sx={{ fontSize: 32, opacity: 0.5 }} />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          No result available for this node.
        </Typography>
        <Typography variant="caption" sx={{ color: "var(--color-fg-soft, #98a2b3)" }}>
          Run the workflow or task to produce execution outputs.
        </Typography>
      </Box>
    );
  }

  const isSuccess =
    nodeResult.status === "COMPLETED" ||
    nodeResult.status === "SUCCESS" ||
    (!nodeResult.error && nodeResult.status !== "FAILED");

  const formattedOutput =
    typeof nodeResult.output === "object"
      ? JSON.stringify(nodeResult.output, null, 2)
      : String(nodeResult.output ?? nodeResult.resultText ?? "{}");

  return (
    <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2, height: "100%" }}>
      {/* Status banner */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          p: 1.5,
          borderRadius: "6px",
          bgcolor: isSuccess
            ? "var(--color-support-soft, #e2f4f2)"
            : "var(--color-accent-soft, #fde8e9)",
          border: `1px solid ${
            isSuccess
              ? "var(--color-support-fg, #2c8c84)"
              : "var(--color-accent-fg)"
          }`,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          {isSuccess ? (
            <CheckCircleOutlineIcon
              sx={{ color: "var(--color-support-fg, #2c8c84)", fontSize: 20 }}
            />
          ) : (
            <ErrorOutlineIcon
              sx={{ color: "var(--color-accent-fg)", fontSize: 20 }}
            />
          )}
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              color: isSuccess
                ? "var(--color-support-fg, #2c8c84)"
                : "var(--color-accent-fg)",
            }}
          >
            {nodeResult.status || (isSuccess ? "SUCCESS" : "FAILED")}
          </Typography>
        </Stack>

        {nodeResult.duration && (
          <Chip
            size="small"
            icon={<AccessTimeIcon fontSize="small" />}
            label={nodeResult.duration}
            sx={{
              fontSize: 11,
              bgcolor: "var(--color-surface-raised, #ffffff)",
              color: "var(--color-fg-default, #111827)",
            }}
          />
        )}
      </Stack>

      {/* Error message if present */}
      {nodeResult.error && (
        <Box
          sx={{
            p: 1.5,
            borderRadius: "6px",
            bgcolor: "var(--color-accent-soft, #fde8e9)",
            color: "var(--color-accent-fg)",
            fontSize: 12,
            fontFamily: "monospace",
            wordBreak: "break-word",
          }}
        >
          {String(nodeResult.error)}
        </Box>
      )}

      {/* Output viewer */}
      <Box sx={{ flex: 1, minHeight: 220, display: "flex", flexDirection: "column" }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            mb: 0.5,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            color: "var(--color-fg-muted, #667085)",
          }}
        >
          Output Data
        </Typography>
        <WeaverCodeEditor
          language="json"
          value={formattedOutput}
          readOnly={true}
          height="100%"
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            wordWrap: "on",
          }}
        />
      </Box>
    </Box>
  );
};
