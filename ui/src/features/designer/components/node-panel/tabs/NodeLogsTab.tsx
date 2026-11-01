import React, { useEffect, useState, useMemo, useRef } from "react";
import type { Node } from "@xyflow/react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import TerminalIcon from "@mui/icons-material/Terminal";
import { subscribeLogs } from "@/utils/logger";
import type { WeaverNodePanelContext } from "../nodeDefinition.types";

export interface LogEntry {
  level: "info" | "debug" | "warn" | "error" | string;
  message: string;
  timestamp: number;
  formatted?: string;
  nodeId?: string;
  nodeRef?: string;
}

export interface NodeLogsTabProps {
  node?: Node | null;
  context?: WeaverNodePanelContext;
  customLogs?: LogEntry[];
}

export const NodeLogsTab: React.FC<NodeLogsTabProps> = ({
  node,
  context,
  customLogs,
}) => {
  const targetNode = node || context?.node;
  const [allLogs, setAllLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to live application logger
  useEffect(() => {
    const unsubscribe = subscribeLogs((entry: any) => {
      setAllLogs((prev) => [...prev.slice(-300), entry]);
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  // Filter logs strictly for targetNode to ensure isolation
  const filteredLogs = useMemo(() => {
    if (!targetNode) return [];
    if (customLogs) return customLogs;
    if (context?.logs) return context.logs;

    const nodeId = String(targetNode.id).toLowerCase();
    const nodeName = String(targetNode.data?.name || "").toLowerCase();
    const refName = String(
      targetNode.data?.config?.name ||
      targetNode.data?.config?.referenceName ||
      targetNode.data?.config?.taskReferenceName ||
      ""
    ).toLowerCase();

    return allLogs.filter((entry) => {
      if (entry.nodeId && String(entry.nodeId).toLowerCase() === nodeId) {
        return true;
      }
      if (entry.nodeRef && String(entry.nodeRef).toLowerCase() === refName) {
        return true;
      }
      const msg = String(entry.message || "").toLowerCase();
      return (
        (refName && msg.includes(refName)) ||
        (nodeName && msg.includes(nodeName)) ||
        msg.includes(nodeId)
      );
    });
  }, [targetNode, customLogs, context?.logs, allLogs]);

  // Auto-scroll when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs]);

  if (!targetNode) {
    return (
      <div style={{ padding: "16px", color: "var(--color-fg-muted, #667085)", fontSize: 13 }}>
        Select a node to inspect logs.
      </div>
    );
  }

  if (filteredLogs.length === 0) {
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
        <TerminalIcon sx={{ fontSize: 32, opacity: 0.5 }} />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          No logs available for this node.
        </Typography>
        <Typography variant="caption" sx={{ color: "var(--color-fg-soft, #98a2b3)" }}>
          Execution traces matching this node will appear here.
        </Typography>
      </Box>
    );
  }

  const getLevelColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case "error":
        return "var(--color-status-danger, #c93136)";
      case "warn":
        return "var(--color-status-warn, #b66a00)";
      case "info":
        return "var(--color-support-fg, #2c8c84)";
      default:
        return "var(--color-fg-muted, #667085)";
    }
  };

  return (
    <Box
      ref={scrollRef}
      sx={{
        p: 1.5,
        height: "100%",
        overflowY: "auto",
        fontFamily: "monospace",
        fontSize: 12,
        display: "flex",
        flexDirection: "column",
        gap: 0.75,
        backgroundColor: "var(--color-canvas-subtle, #080a0d)",
        color: "var(--color-fg-default, #f2f5f7)",
        borderRadius: "4px",
      }}
    >
      {filteredLogs.map((entry, idx) => {
        const timeStr = entry.timestamp
          ? new Date(entry.timestamp).toLocaleTimeString()
          : "";
        return (
          <Stack
            key={idx}
            direction="row"
            spacing={1}
            alignItems="flex-start"
            sx={{
              py: 0.25,
              borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
            }}
          >
            {timeStr && (
              <Typography
                component="span"
                sx={{
                  fontFamily: "monospace",
                  fontSize: 11,
                  color: "var(--color-fg-muted, #667085)",
                  flexShrink: 0,
                }}
              >
                {timeStr}
              </Typography>
            )}

            <Chip
              size="small"
              label={entry.level?.toUpperCase() || "LOG"}
              sx={{
                height: 18,
                fontSize: 10,
                fontWeight: 700,
                color: "#ffffff",
                backgroundColor: getLevelColor(entry.level),
                borderRadius: "3px",
                flexShrink: 0,
              }}
            />

            <Typography
              component="span"
              sx={{
                fontFamily: "monospace",
                fontSize: 12,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                flex: 1,
              }}
            >
              {entry.message || entry.formatted}
            </Typography>
          </Stack>
        );
      })}
    </Box>
  );
};
