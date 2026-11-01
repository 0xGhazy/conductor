import type { Node, Edge } from "@xyflow/react";
import { getSmoothStepPath } from "@xyflow/react";
import { getNodeDimensions, getEdgeLabelDimensions } from "./autoLayout";
import { getSwitchCaseLabel, getSwitchCaseColor } from "./designerGraphUtils";

export interface WorkflowExportOptions {
  format?: "svg" | "pdf" | "png" | "jpg";
  backgroundPreset?: "dark" | "white" | "transparent" | "custom";
  customBackgroundColor?: string;
  nodeFillPreset?: "theme" | "custom";
  customNodeFillColor?: string;
  detailLevel?: "client" | "full";
  themeMode?: "dark" | "light";
  includeTitle?: boolean;
  titleText?: string;
  includeExportDate?: boolean;
  exportDateText?: string;
  width?: number;
  height?: number;
  padding?: number;
  layoutDirection?: "TB" | "LR";
}

export interface GeneratedSvgResult {
  svgString: string;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
    viewBoxWidth: number;
    viewBoxHeight: number;
  };
  aspectRatio: number;
  autoContrastAdjusted: boolean;
  contrastNotice: string | null;
  effectiveBackgroundColor: string;
  effectiveNodeFillColor: string;
  effectiveTextColor: string;
}

// XML entity escaper for safe SVG text attributes and content
export function escapeXml(unsafe: string | null | undefined): string {
  if (unsafe == null) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Parse hex colors into RGB components
export function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  if (!hex || typeof hex !== "string") return null;
  let clean = hex.trim().replace(/^#/, "");
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  if (clean.length !== 6 && clean.length !== 8) return null;
  const num = parseInt(clean.substring(0, 6), 16);
  if (isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

// WCAG 2.1 relative luminance calculation
export function getRelativeLuminance(hex: string): number {
  const rgb = parseHexColor(hex);
  if (!rgb) return 0.5;
  const sRGB = [rgb.r, rgb.g, rgb.b].map((val) => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}

// WCAG 2.1 contrast ratio calculation
export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Node category / type theme definitions
export const NODE_EXPORT_COLORS: Record<string, { border: string; tagBg: string; tagFg: string; icon: string }> = {
  START: { border: "#10b981", tagBg: "rgba(16, 185, 129, 0.15)", tagFg: "#10b981", icon: "#10b981" },
  start: { border: "#10b981", tagBg: "rgba(16, 185, 129, 0.15)", tagFg: "#10b981", icon: "#10b981" },
  HTTP_ACTION: { border: "#2563eb", tagBg: "rgba(37, 99, 235, 0.15)", tagFg: "#2563eb", icon: "#2563eb" },
  http: { border: "#2563eb", tagBg: "rgba(37, 99, 235, 0.15)", tagFg: "#2563eb", icon: "#2563eb" },
  DATABASE_ACTION: { border: "#0d9488", tagBg: "rgba(13, 148, 136, 0.15)", tagFg: "#0d9488", icon: "#0d9488" },
  database: { border: "#0d9488", tagBg: "rgba(13, 148, 136, 0.15)", tagFg: "#0d9488", icon: "#0d9488" },
  SWITCH_ACTION: { border: "#d97706", tagBg: "rgba(217, 119, 6, 0.15)", tagFg: "#d97706", icon: "#d97706" },
  switch: { border: "#d97706", tagBg: "rgba(217, 119, 6, 0.15)", tagFg: "#d97706", icon: "#d97706" },
  FOREACH_ACTION: { border: "#ea580c", tagBg: "rgba(234, 88, 12, 0.15)", tagFg: "#ea580c", icon: "#ea580c" },
  foreach: { border: "#ea580c", tagBg: "rgba(234, 88, 12, 0.15)", tagFg: "#ea580c", icon: "#ea580c" },
  TERMINATE: { border: "#e11d48", tagBg: "rgba(225, 29, 72, 0.15)", tagFg: "#e11d48", icon: "#e11d48" },
  terminate: { border: "#e11d48", tagBg: "rgba(225, 29, 72, 0.15)", tagFg: "#e11d48", icon: "#e11d48" },
  RESPOND_ACTION: { border: "#059669", tagBg: "rgba(5, 150, 105, 0.15)", tagFg: "#059669", icon: "#059669" },
  respond: { border: "#059669", tagBg: "rgba(5, 150, 105, 0.15)", tagFg: "#059669", icon: "#059669" },
  SCRIPT_ACTION: { border: "#7c3aed", tagBg: "rgba(124, 58, 237, 0.15)", tagFg: "#7c3aed", icon: "#7c3aed" },
  script: { border: "#7c3aed", tagBg: "rgba(124, 58, 237, 0.15)", tagFg: "#7c3aed", icon: "#7c3aed" },
  SCOPE: { border: "#4f46e5", tagBg: "rgba(79, 70, 229, 0.15)", tagFg: "#4f46e5", icon: "#4f46e5" },
  scope: { border: "#4f46e5", tagBg: "rgba(79, 70, 229, 0.15)", tagFg: "#4f46e5", icon: "#4f46e5" },
  default: { border: "#64748b", tagBg: "rgba(100, 116, 139, 0.15)", tagFg: "#64748b", icon: "#64748b" },
};

function getNodeStyleInfo(nodeType: string | undefined): { border: string; tagBg: string; tagFg: string; icon: string } {
  if (!nodeType) return NODE_EXPORT_COLORS.default;
  return NODE_EXPORT_COLORS[nodeType] || NODE_EXPORT_COLORS[nodeType.toUpperCase()] || NODE_EXPORT_COLORS.default;
}

// Inline SVG paths for node icons
function renderNodeIconSvg(nodeType: string | undefined, x: number, y: number, color: string): string {
  const type = String(nodeType || "").toUpperCase();
  if (type.includes("START")) {
    return `<polygon points="${x + 6},${y + 4} ${x + 16},${y + 10} ${x + 6},${y + 16}" fill="${color}" />`;
  }
  if (type.includes("SWITCH")) {
    return `<path d="M ${x + 5} ${y + 5} L ${x + 5} ${y + 15} M ${x + 5} ${y + 10} C ${x + 10} ${y + 10}, ${x + 10} ${y + 6}, ${x + 15} ${y + 6} M ${x + 5} ${y + 10} C ${x + 10} ${y + 10}, ${x + 10} ${y + 14}, ${x + 15} ${y + 14}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" />`;
  }
  if (type.includes("DATABASE")) {
    return `<path d="M ${x + 4} ${y + 6} C ${x + 4} ${y + 4}, ${x + 16} ${y + 4}, ${x + 16} ${y + 6} L ${x + 16} ${y + 14} C ${x + 16} ${y + 16}, ${x + 4} ${y + 16}, ${x + 4} ${y + 14} Z M ${x + 4} ${y + 10} C ${x + 4} ${y + 12}, ${x + 16} ${y + 12}, ${x + 16} ${y + 10}" fill="none" stroke="${color}" stroke-width="1.8" />`;
  }
  if (type.includes("HTTP")) {
    return `<circle cx="${x + 10}" cy="${y + 10}" r="6.5" fill="none" stroke="${color}" stroke-width="1.8" /><ellipse cx="${x + 10}" cy="${y + 10}" rx="3" ry="6.5" fill="none" stroke="${color}" stroke-width="1.8" /><line x1="${x + 3.5}" y1="${y + 10}" x2="${x + 16.5}" y2="${y + 10}" stroke="${color}" stroke-width="1.8" />`;
  }
  if (type.includes("TERMINATE")) {
    return `<path d="M ${x + 6.5} ${y + 6.5} A 5.5 5.5 0 1 0 ${x + 13.5} ${y + 6.5}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" /><line x1="${x + 10}" y1="${y + 3}" x2="${x + 10}" y2="${y + 9}" stroke="${color}" stroke-width="2" stroke-linecap="round" />`;
  }
  if (type.includes("RESPOND")) {
    return `<path d="M ${x + 4} ${y + 5} L ${x + 16} ${y + 5} C ${x + 17} ${y + 5}, ${x + 17} ${y + 13}, ${x + 16} ${y + 13} L ${x + 8} ${y + 13} L ${x + 4} ${y + 16} Z" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" />`;
  }
  if (type.includes("SCRIPT") || type.includes("CODE")) {
    return `<path d="M ${x + 7} ${y + 6} L ${x + 3} ${y + 10} L ${x + 7} ${y + 14} M ${x + 13} ${y + 6} L ${x + 17} ${y + 10} L ${x + 13} ${y + 14}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />`;
  }
  if (type.includes("FOREACH")) {
    return `<path d="M ${x + 5} ${y + 8} A 5 5 0 0 1 ${x + 15} ${y + 8} M ${x + 15} ${y + 12} A 5 5 0 0 1 ${x + 5} ${y + 12}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" />`;
  }
  // Generic box icon
  return `<rect x="${x + 4}" y="${y + 4}" width="12" height="12" rx="3" fill="none" stroke="${color}" stroke-width="1.8" />`;
}

/**
 * Calculates raw graph bounding box across all nodes and edges.
 */
export function calculateGraphBounds(
  nodes: Node[],
  edges: Edge[],
  options: { padding?: number; includeHeader?: boolean } = {}
): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  const padding = options.padding ?? 60;
  if (!nodes || nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach((node) => {
    const { width, height } = getNodeDimensions(node);
    const x = node.position.x;
    const y = node.position.y;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  });

  // Account for edge labels that might extend horizontally
  edges.forEach((edge) => {
    const label = edge.label || (edge.data as any)?.note;
    if (label) {
      const { width: labelW } = getEdgeLabelDimensions(String(label));
      // Ensure padding accounts for label half-widths
      minX = Math.min(minX, minX - 10);
      maxX = Math.max(maxX, maxX + Math.min(60, labelW / 2));
    }
  });

  const width = Math.max(100, maxX - minX + padding * 2);
  const height = Math.max(100, maxY - minY + padding * 2 + (options.includeHeader ? 70 : 0));

  return {
    minX: minX - padding,
    minY: minY - padding - (options.includeHeader ? 70 : 0),
    maxX: maxX + padding,
    maxY: maxY + padding,
    width,
    height,
  };
}

/**
 * Generates pure native vector SVG from workflow graph topology.
 * NO foreignObject, NO images.
 */
export function generateWorkflowSvg(
  nodes: Node[],
  edges: Edge[],
  options: WorkflowExportOptions = {}
): GeneratedSvgResult {
  const {
    format = "svg",
    backgroundPreset = "dark",
    customBackgroundColor = "#0d1117",
    nodeFillPreset = "theme",
    customNodeFillColor = "#161b22",
    detailLevel = "client",
    themeMode = "dark",
    includeTitle = false,
    titleText = "Workflow Diagram",
    includeExportDate = false,
    exportDateText = new Date().toISOString().split("T")[0],
    padding = 60,
    layoutDirection = "TB",
  } = options;

  const isLR = layoutDirection === "LR";
  const hasHeader = Boolean(includeTitle || includeExportDate);

  // 1. Calculate graph bounds
  const rawBounds = calculateGraphBounds(nodes, edges, { padding, includeHeader: hasHeader });
  const baseWidth = rawBounds.width;
  const baseHeight = rawBounds.height;
  const aspectRatio = baseWidth / baseHeight;

  // 2. Resolve background color
  let effectiveBg: string;
  const isJpg = format === "jpg";

  if (backgroundPreset === "transparent" && !isJpg) {
    effectiveBg = "transparent";
  } else if (backgroundPreset === "white") {
    effectiveBg = "#ffffff";
  } else if (backgroundPreset === "dark") {
    effectiveBg = themeMode === "light" ? "#f8fafc" : "#0d1117";
  } else if (backgroundPreset === "custom") {
    effectiveBg = customBackgroundColor || (themeMode === "light" ? "#ffffff" : "#0d1117");
  } else {
    // If JPG fell back from transparent
    effectiveBg = themeMode === "light" ? "#ffffff" : "#0d1117";
  }

  // 3. Resolve node card fill color
  let effectiveFill: string;
  if (nodeFillPreset === "custom" && customNodeFillColor) {
    effectiveFill = customNodeFillColor;
  } else {
    // Theme default
    if (themeMode === "light") {
      effectiveFill = "#ffffff";
    } else {
      effectiveFill = "#161b22";
    }
  }

  // 4. Auto-contrast calculations
  let autoContrastAdjusted = false;
  let contrastNotice: string | null = null;

  // Evaluate text contrast against node card fill
  const ratioWithLightText = getContrastRatio(effectiveFill, "#f8fafc");
  const ratioWithDarkText = getContrastRatio(effectiveFill, "#0f172a");

  let effectiveTextColor: string;
  let secondaryTextColor: string;
  let accentTextColor: string;

  if (ratioWithLightText >= 4.5 && ratioWithLightText >= ratioWithDarkText) {
    effectiveTextColor = "#f8fafc";
    secondaryTextColor = "#94a3b8";
    accentTextColor = "#38bdf8";
  } else if (ratioWithDarkText >= 4.5) {
    effectiveTextColor = "#0f172a";
    secondaryTextColor = "#475569";
    accentTextColor = "#2563eb";
  } else {
    // Neither exceeds 4.5: pick the best one and flag notice
    if (ratioWithLightText >= ratioWithDarkText) {
      effectiveTextColor = "#ffffff";
      secondaryTextColor = "#e2e8f0";
      accentTextColor = "#67e8f9";
    } else {
      effectiveTextColor = "#000000";
      secondaryTextColor = "#1e293b";
      accentTextColor = "#1d4ed8";
    }
    autoContrastAdjusted = true;
    contrastNotice = "Auto-contrast adjusted text & element colors to maintain WCAG 4.5:1 readability.";
  }

  // If user picked custom fill and default theme text would have clashed
  if (nodeFillPreset === "custom") {
    const originalText = themeMode === "dark" ? "#f8fafc" : "#0f172a";
    const originalRatio = getContrastRatio(effectiveFill, originalText);
    if (originalRatio < 4.5) {
      autoContrastAdjusted = true;
      contrastNotice = "Auto-contrast adjusted text & element colors to maintain WCAG 4.5:1 readability.";
    }
  }

  // Evaluate edge stroke contrast against background
  const bgLuminance = effectiveBg === "transparent" ? (themeMode === "dark" ? 0.05 : 0.95) : getRelativeLuminance(effectiveBg);
  let defaultEdgeColor: string;
  let headerDividerColor: string;
  let titleColor: string;
  let dateColor: string;

  if (bgLuminance < 0.4) {
    // Dark background
    defaultEdgeColor = "#64748b";
    titleColor = "#f8fafc";
    dateColor = "#94a3b8";
  } else {
    // Light background
    defaultEdgeColor = "#475569";
    titleColor = "#0f172a";
    dateColor = "#64748b";
  }

  const fillLuminance = getRelativeLuminance(effectiveFill);
  headerDividerColor = fillLuminance < 0.4 ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)";

  // Map of nodes for quick edge endpoint lookup
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Build SVG content parts
  const svgParts: string[] = [];

  // Start SVG Root tag
  const displayWidth = options.width ?? baseWidth;
  const displayHeight = options.height ?? baseHeight;

  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="${rawBounds.minX} ${rawBounds.minY} ${baseWidth} ${baseHeight}" ` +
    `width="${displayWidth}" height="${displayHeight}" ` +
    `style="background-color: ${effectiveBg}; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">`
  );

  // SVG Definitions: Clean embedded font styles, filter definitions, styles
  svgParts.push(`  <defs>
    <style>
      @font-face {
        font-family: 'Inter';
        src: local('Inter'), local('Segoe UI'), local('Roboto');
        font-weight: 400 800;
      }
      text {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        user-select: none;
      }
    </style>
    <filter id="node-shadow" x="-8%" y="-8%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.12" />
    </filter>
  </defs>`);

  // Background rect (first element, omitted if transparent)
  if (effectiveBg !== "transparent") {
    svgParts.push(
      `  <rect class="export-background" x="${rawBounds.minX}" y="${rawBounds.minY}" width="${baseWidth}" height="${baseHeight}" fill="${effectiveBg}" />`
    );
  }

  // Header Banner: Title & Export Date
  if (hasHeader) {
    const bannerY = rawBounds.minY + 40;
    const bannerLineY = bannerY + 16;
    svgParts.push(`  <g class="export-header-banner">`);
    if (includeTitle && titleText) {
      svgParts.push(
        `    <text x="${rawBounds.minX + padding}" y="${bannerY}" font-size="20" font-weight="700" fill="${titleColor}" letter-spacing="-0.02em">${escapeXml(titleText)}</text>`
      );
    }
    if (includeExportDate && exportDateText) {
      svgParts.push(
        `    <text x="${rawBounds.maxX - padding}" y="${bannerY}" text-anchor="end" font-size="12" font-weight="normal" fill="${dateColor}">Exported: ${escapeXml(exportDateText)}</text>`
      );
    }
    svgParts.push(
      `    <line x1="${rawBounds.minX + padding}" y1="${bannerLineY}" x2="${rawBounds.maxX - padding}" y2="${bannerLineY}" stroke="${headerDividerColor}" stroke-width="1" />`
    );
    svgParts.push(`  </g>`);
  }

  // Render Edges (drawn underneath nodes)
  svgParts.push(`  <g class="workflow-edges">`);

  edges.forEach((edge) => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) return;

    const sourceDim = getNodeDimensions(sourceNode);
    const targetDim = getNodeDimensions(targetNode);

    // Compute Source Coordinates
    let sourceX: number;
    let sourceY: number;

    const isSwitch = sourceNode.type === "switch" || sourceNode.type === "SWITCH_ACTION";
    if (isSwitch) {
      const cfg = (sourceNode.data as any)?.config ?? (sourceNode.data as any);
      const cases = Array.isArray(cfg?.cases) ? cfg.cases : [];
      const totalHandles = cases.length + 1; // cases + default
      let handleIndex = cases.findIndex((c: any) => c?.id === edge.sourceHandle);
      if (handleIndex === -1 && edge.sourceHandle === "default") {
        handleIndex = cases.length;
      }
      if (handleIndex === -1) handleIndex = 0;

      const percent = ((handleIndex + 1) * 100) / (totalHandles + 1);

      if (isLR) {
        sourceX = sourceNode.position.x + sourceDim.width;
        sourceY = sourceNode.position.y + (sourceDim.height * percent) / 100;
      } else {
        sourceX = sourceNode.position.x + (sourceDim.width * percent) / 100;
        sourceY = sourceNode.position.y + sourceDim.height;
      }
    } else {
      if (isLR) {
        sourceX = sourceNode.position.x + sourceDim.width;
        sourceY = sourceNode.position.y + sourceDim.height / 2;
      } else {
        sourceX = sourceNode.position.x + sourceDim.width / 2;
        sourceY = sourceNode.position.y + sourceDim.height;
      }
    }

    // Compute Target Coordinates
    let targetX: number;
    let targetY: number;
    if (isLR) {
      targetX = targetNode.position.x;
      targetY = targetNode.position.y + targetDim.height / 2;
    } else {
      targetX = targetNode.position.x + targetDim.width / 2;
      targetY = targetNode.position.y;
    }

    // Compute branch routing with center offset matching WeaverBranchEdge.tsx
    const edgeData = (edge.data || {}) as any;
    const branchIndex = edgeData.branchIndex;
    const totalBranches = edgeData.totalBranches ?? 1;

    let centerX: number | undefined;
    let centerY: number | undefined;

    if (isLR) {
      const deltaX = targetX - sourceX;
      if (typeof edgeData.centerX === "number") {
        centerX = edgeData.centerX;
      } else if (typeof branchIndex === "number" && deltaX > 40) {
        const baseOffset = 28;
        const stepOffset = 18;
        const rawCenterX = sourceX + baseOffset + branchIndex * stepOffset;
        const maxCenterX = targetX - 45;
        if (rawCenterX <= maxCenterX) {
          centerX = Math.round(rawCenterX);
        } else {
          const availableSpace = Math.max(10, deltaX - 60);
          const step = availableSpace / Math.max(1, totalBranches);
          centerX = Math.round(sourceX + 25 + branchIndex * step);
        }
      }
    } else {
      const deltaY = targetY - sourceY;
      if (typeof edgeData.centerY === "number") {
        centerY = edgeData.centerY;
      } else if (typeof branchIndex === "number" && deltaY > 40) {
        const baseOffset = 28;
        const stepOffset = 18;
        const rawCenterY = sourceY + baseOffset + branchIndex * stepOffset;
        const maxCenterY = targetY - 45;
        if (rawCenterY <= maxCenterY) {
          centerY = Math.round(rawCenterY);
        } else {
          const availableSpace = Math.max(10, deltaY - 60);
          const step = availableSpace / Math.max(1, totalBranches);
          centerY = Math.round(sourceY + 25 + branchIndex * step);
        }
      }
    }

    const [computedPath] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition: isLR ? "right" as any : "bottom" as any,
      targetX,
      targetY,
      targetPosition: isLR ? "left" as any : "top" as any,
      borderRadius: 8,
      centerX: isLR ? centerX : undefined,
      centerY: !isLR ? centerY : undefined,
    });

    // Resolve edge stroke color
    let strokeColor = defaultEdgeColor;
    if (edge.style?.stroke) {
      strokeColor = String(edge.style.stroke);
    } else if (isSwitch) {
      const caseColor = getSwitchCaseColor(sourceNode, edge.sourceHandle);
      if (caseColor) strokeColor = caseColor;
    } else if (edge.sourceHandle === "true" || edge.sourceHandle === "success") {
      strokeColor = "#22c55e";
    } else if (edge.sourceHandle === "false" || edge.sourceHandle === "error") {
      strokeColor = "#ef4444";
    }

    // Explicit arrowhead polygon (vector PDF & SVG compatible)
    let arrowPoints: string;
    if (isLR) {
      // enters from left
      arrowPoints = `${targetX - 7},${targetY - 4} ${targetX - 7},${targetY + 4} ${targetX},${targetY}`;
    } else {
      // enters from top
      arrowPoints = `${targetX - 4},${targetY - 7} ${targetX + 4},${targetY - 7} ${targetX},${targetY}`;
    }

    svgParts.push(`    <g class="workflow-edge" id="edge-${escapeXml(edge.id)}">`);
    svgParts.push(
      `      <path d="${computedPath}" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`
    );
    svgParts.push(`      <polygon points="${arrowPoints}" fill="${strokeColor}" />`);

    // Edge Label Badge
    const rawLabel = edge.label || (edge.data as any)?.label || getSwitchCaseLabel(sourceNode, edge.sourceHandle);
    if (rawLabel) {
      const labelText = String(rawLabel).trim();

      // Label coordinate calculation matching WeaverBranchEdge.tsx
      let lx: number;
      let ly: number;

      if (isLR) {
        const effectiveCenterX = centerX ?? Math.round((sourceX + targetX) / 2);
        if (Math.abs(targetY - sourceY) < 8) {
          lx = Math.round((sourceX + targetX) / 2);
          ly = targetY;
        } else {
          lx = Math.round((effectiveCenterX + targetX) / 2);
          ly = targetY;
        }
      } else {
        const effectiveCenterY = centerY ?? Math.round((sourceY + targetY) / 2);
        if (Math.abs(targetX - sourceX) < 8) {
          lx = targetX;
          ly = Math.round((sourceY + targetY) / 2);
        } else {
          const distanceToTarget = targetY - effectiveCenterY;
          if (distanceToTarget >= 44) {
            ly = Math.round(targetY - 26);
          } else {
            ly = Math.round(effectiveCenterY + distanceToTarget / 2);
          }
          lx = targetX;
        }
      }

      const { width: labelW } = getEdgeLabelDimensions(labelText);
      const badgeH = 20;
      const badgeFill = effectiveFill;
      const badgeBorder = strokeColor || "#94a3b8";

      svgParts.push(
        `      <g class="edge-label-badge" transform="translate(${lx}, ${ly})">` +
        `        <rect x="${-labelW / 2}" y="${-badgeH / 2}" width="${labelW}" height="${badgeH}" rx="6" fill="${badgeFill}" stroke="${badgeBorder}" stroke-width="1.5" />` +
        `        <text x="0" y="3.5" text-anchor="middle" font-size="10.5" font-weight="700" fill="${strokeColor}">${escapeXml(labelText)}</text>` +
        `      </g>`
      );
    }

    svgParts.push(`    </g>`);
  });

  svgParts.push(`  </g>`);

  // Render Nodes
  svgParts.push(`  <g class="workflow-nodes">`);

  nodes.forEach((node) => {
    const { width: w, height: h } = getNodeDimensions(node);
    const x = node.position.x;
    const y = node.position.y;
    const styleInfo = getNodeStyleInfo(node.type);

    const title = (node.data as any)?.name || (node.data as any)?.title || node.type || "Action Node";
    const taskRef = (node.data as any)?.config?.taskReferenceName || (node.data as any)?.config?.name || (node.data as any)?.taskReferenceName || "";
    const description = (node.data as any)?.description || (node.data as any)?.config?.description || "";
    const typeLabel = String(node.type || "ACTION").replace(/_ACTION$/, "");

    // Node Outer Card Rect with shadow filter
    svgParts.push(`    <g class="workflow-node" id="node-${escapeXml(node.id)}" transform="translate(${x}, ${y})">`);
    svgParts.push(
      `      <rect x="0" y="0" width="${w}" height="${h}" rx="12" ry="12" fill="${effectiveFill}" stroke="${styleInfo.border}" stroke-width="1.75" filter="url(#node-shadow)" />`
    );

    // Node Header Divider Line
    svgParts.push(
      `      <line x1="0" y1="36" x2="${w}" y2="36" stroke="${headerDividerColor}" stroke-width="1" />`
    );

    // Node Icon Box & Vector Path
    svgParts.push(
      `      <circle cx="20" cy="18" r="10" fill="${styleInfo.tagBg}" stroke="${styleInfo.border}" stroke-width="1" />`
    );
    svgParts.push(`      ${renderNodeIconSvg(node.type, 10, 8, styleInfo.icon)}`);

    // Title text
    const displayTitle = title.length > 24 ? title.substring(0, 22) + "…" : title;
    svgParts.push(
      `      <text x="36" y="22" font-size="12" font-weight="700" fill="${effectiveTextColor}">${escapeXml(displayTitle)}</text>`
    );

    // Type Badge Pill in top right
    const tagWidth = Math.max(38, Math.round(typeLabel.length * 6.5 + 14));
    svgParts.push(
      `      <rect x="${w - tagWidth - 8}" y="9" width="${tagWidth}" height="18" rx="4" fill="${styleInfo.tagBg}" />` +
      `      <text x="${w - tagWidth / 2 - 8}" y="21.5" text-anchor="middle" font-size="9" font-weight="700" fill="${styleInfo.tagFg}">${escapeXml(typeLabel)}</text>`
    );

    // Card Body Content (Client view vs Full detail)
    if (detailLevel === "client") {
      // Clean, elegant client view
      const subText = description || `${typeLabel} Action`;
      const displaySub = subText.length > 30 ? subText.substring(0, 28) + "…" : subText;
      svgParts.push(
        `      <text x="14" y="56" font-size="11" font-weight="normal" fill="${secondaryTextColor}">${escapeXml(displaySub)}</text>`
      );
    } else {
      // Full detail view: show reference and configuration parameters
      if (taskRef) {
        svgParts.push(
          `      <text x="14" y="52" font-family="monospace" font-size="10" font-weight="700" fill="${accentTextColor}">ref: ${escapeXml(taskRef)}</text>`
        );
      }
      const cfg = (node.data as any)?.config;
      let extraDetail = "";
      if (cfg?.evaluatorType) {
        extraDetail = `eval: ${cfg.evaluatorType}`;
      } else if (cfg?.method) {
        extraDetail = `${cfg.method} ${cfg.url || ""}`;
      } else if (cfg?.statement) {
        extraDetail = `SQL: ${String(cfg.statement).substring(0, 20)}`;
      } else if (description) {
        extraDetail = description;
      }
      if (extraDetail) {
        const displayExtra = extraDetail.length > 32 ? extraDetail.substring(0, 30) + "…" : extraDetail;
        svgParts.push(
          `      <text x="14" y="68" font-size="10" fill="${secondaryTextColor}">${escapeXml(displayExtra)}</text>`
        );
      }
    }

    svgParts.push(`    </g>`);
  });

  svgParts.push(`  </g>`);

  // Close SVG Root tag
  svgParts.push(`</svg>`);

  const svgString = svgParts.join("\n");

  return {
    svgString,
    bounds: {
      ...rawBounds,
      viewBoxWidth: baseWidth,
      viewBoxHeight: baseHeight,
    },
    aspectRatio,
    autoContrastAdjusted,
    contrastNotice,
    effectiveBackgroundColor: effectiveBg,
    effectiveNodeFillColor: effectiveFill,
    effectiveTextColor,
  };
}
