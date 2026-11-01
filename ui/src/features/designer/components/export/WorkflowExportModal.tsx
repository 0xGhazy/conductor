import React, { useState, useEffect, useMemo, useCallback } from "react";
import type { Node, Edge } from "@xyflow/react";
import {
  X,
  Download,
  RotateCcw,
  Lock,
  Unlock,
  AlertTriangle,
  Info,
  Check,
  Image as ImageIcon,
  FileCode,
  FileText,
  FileJson,
  Copy,
} from "lucide-react";
import styles from "./WorkflowExportModal.module.css";
import {
  generateWorkflowSvg,
  calculateGraphBounds,
  type WorkflowExportOptions,
} from "@/features/designer/utils/exportSvgGenerator";
import {
  rasterizeSvgToBlob,
  exportSvgToPdfBlob,
  checkAndClampRasterDimensions,
  triggerFileDownload,
  buildExportFilename,
} from "@/features/designer/utils/exportRasterizer";
import {
  buildNestedWorkflowTasksFromGraph,
  buildExportPayload,
} from "@/features/designer/utils/workflowSerialization";
import { WeaverCodeEditor } from "@/components/common/editors";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { useWeaverNotification } from "@/components/common/notifications";

export interface WorkflowExportModalProps {
  open: boolean;
  onClose: () => void;
  nodes: Node[];
  edges: Edge[];
  workflowName: string;
  workflowVersion?: string | number;
  workflowVariables?: Record<string, any>;
  workflowDescription?: string;
  workflowLanguage?: string;
  workflowSupportedLanguages?: string[];
  layoutDirection?: "TB" | "LR";
  currentTheme?: "dark" | "light";
  initialFormat?: "svg" | "pdf" | "png" | "jpg" | "json";
}

const STORAGE_KEY = "weaver_export_options";

// Stable fallbacks so the memoized export payload is not rebuilt on every render.
const EMPTY_VARIABLES: Record<string, unknown> = {};
const EMPTY_LANGUAGES: string[] = [];

interface SavedExportOptions {
  format: "svg" | "pdf" | "png" | "jpg" | "json";
  bgPreset: "dark" | "white" | "transparent" | "custom";
  customBg: string;
  fillPreset: "theme" | "custom";
  customFill: string;
  dimPreset: "fit" | "hd" | "4k" | "custom";
  aspectLocked: boolean;
  scale: number;
  jpgQuality: number;
  detailLevel: "client" | "full";
  themeMode: "dark" | "light";
  includeTitle: boolean;
  includeDate: boolean;
  jsonFormatting: "pretty" | "minified";
}

const DEFAULT_OPTIONS: SavedExportOptions = {
  format: "svg",
  bgPreset: "dark",
  customBg: "#0d1117",
  fillPreset: "theme",
  customFill: "#161b22",
  dimPreset: "fit",
  aspectLocked: true,
  scale: 2,
  jpgQuality: 0.92,
  detailLevel: "client",
  themeMode: "dark",
  includeTitle: true,
  includeDate: true,
  jsonFormatting: "pretty",
};

function loadSavedOptions(fallbackTheme: "dark" | "light"): SavedExportOptions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_OPTIONS, themeMode: fallbackTheme, bgPreset: fallbackTheme === "light" ? "white" : "dark" };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_OPTIONS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_OPTIONS, themeMode: fallbackTheme };
  }
}

/**
 * Export dialog. The graph bounds, DTO payload, JSON text and SVG preview are all derived inside
 * `WorkflowExportModalContent`, which is only mounted while the dialog is open, so the closed
 * dialog adds no work to canvas updates.
 */
export const WorkflowExportModal: React.FC<WorkflowExportModalProps> = (props) =>
  props.open ? <WorkflowExportModalContent {...props} /> : null;

const WorkflowExportModalContent: React.FC<WorkflowExportModalProps> = ({
  open,
  onClose,
  nodes,
  edges,
  workflowName,
  workflowVersion,
  workflowVariables,
  workflowDescription,
  workflowLanguage,
  workflowSupportedLanguages,
  layoutDirection = "TB",
  currentTheme = "dark",
  initialFormat,
}) => {
  const { error: showError, success: showSuccess } = useWeaverNotification();

  // Read fallback values from store if not provided in props
  const storeWorkflowVersion = useDesignerStore((s) => s.workflowVersion);
  const storeWorkflowVariables = useDesignerStore((s) => s.workflowVariables);
  const storeWorkflowDescription = useDesignerStore((s) => s.workflowDescription);
  const storeWorkflowLanguage = useDesignerStore((s) => s.workflowLanguage);
  const storeWorkflowSupportedLanguages = useDesignerStore((s) => s.workflowSupportedLanguages);

  const effectiveVersion = workflowVersion ?? storeWorkflowVersion ?? 1;
  const effectiveVariables = workflowVariables ?? storeWorkflowVariables ?? EMPTY_VARIABLES;
  const effectiveDescription = workflowDescription ?? storeWorkflowDescription ?? "";
  const effectiveLanguage = workflowLanguage ?? storeWorkflowLanguage ?? "";
  const effectiveSupportedLanguages = workflowSupportedLanguages ?? storeWorkflowSupportedLanguages ?? EMPTY_LANGUAGES;

  // Graph base bounds for aspect ratio
  const rawBounds = useMemo(() => {
    return calculateGraphBounds(nodes, edges, { padding: 60, includeHeader: true });
  }, [nodes, edges]);

  const baseWidth = Math.round(rawBounds.width);
  const baseHeight = Math.round(rawBounds.height);
  const nativeRatio = baseWidth / Math.max(1, baseHeight);

  // Export Dialog State initialized from localStorage
  const [options, setOptions] = useState<SavedExportOptions>(() => loadSavedOptions(currentTheme));
  const [customWidth, setCustomWidth] = useState<number>(baseWidth);
  const [customHeight, setCustomHeight] = useState<number>(baseHeight);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgressText, setExportProgressText] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  // Initialize format from initialFormat prop when modal opens
  useEffect(() => {
    if (open && initialFormat) {
      setOptions((prev) => ({ ...prev, format: initialFormat }));
    }
  }, [open, initialFormat]);

  // Sync dimensions when opening or graph bounds change
  useEffect(() => {
    if (open) {
      if (options.dimPreset === "fit") {
        setCustomWidth(baseWidth);
        setCustomHeight(baseHeight);
      } else if (options.dimPreset === "hd") {
        setCustomWidth(1920);
        setCustomHeight(Math.round(1920 / nativeRatio));
      } else if (options.dimPreset === "4k") {
        setCustomWidth(3840);
        setCustomHeight(Math.round(3840 / nativeRatio));
      }
    }
  }, [open, baseWidth, baseHeight, nativeRatio, options.dimPreset]);

  // Fallback if JPG was selected and background was Transparent
  useEffect(() => {
    if (options.format === "jpg" && options.bgPreset === "transparent") {
      setOptions((prev) => ({
        ...prev,
        bgPreset: prev.themeMode === "light" ? "white" : "dark",
      }));
    }
  }, [options.format, options.bgPreset]);

  // Persist options changes to localStorage
  const updateOption = useCallback(<K extends keyof SavedExportOptions>(key: K, value: SavedExportOptions[K]) => {
    setOptions((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore localStorage quota errors
      }
      return next;
    });
  }, []);

  // Handle Dimension Preset changes
  const handleDimensionPresetChange = (preset: "fit" | "hd" | "4k" | "custom") => {
    updateOption("dimPreset", preset);
    if (preset === "fit") {
      setCustomWidth(baseWidth);
      setCustomHeight(baseHeight);
    } else if (preset === "hd") {
      setCustomWidth(1920);
      setCustomHeight(Math.round(1920 / nativeRatio));
    } else if (preset === "4k") {
      setCustomWidth(3840);
      setCustomHeight(Math.round(3840 / nativeRatio));
    }
  };

  // Handle Width change with aspect-ratio lock
  const handleWidthChange = (w: number) => {
    const validW = Math.max(100, isNaN(w) ? 100 : w);
    setCustomWidth(validW);
    updateOption("dimPreset", "custom");
    if (options.aspectLocked) {
      setCustomHeight(Math.round(validW / nativeRatio));
    }
  };

  // Handle Height change with aspect-ratio lock
  const handleHeightChange = (h: number) => {
    const validH = Math.max(100, isNaN(h) ? 100 : h);
    setCustomHeight(validH);
    updateOption("dimPreset", "custom");
    if (options.aspectLocked) {
      setCustomWidth(Math.round(validH * nativeRatio));
    }
  };

  // Reset to defaults
  const handleResetDefaults = () => {
    const fresh = {
      ...DEFAULT_OPTIONS,
      themeMode: currentTheme,
      bgPreset: currentTheme === "light" ? "white" : ("dark" as const),
    };
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setOptions(fresh);
    setCustomWidth(baseWidth);
    setCustomHeight(baseHeight);
  };

  // Workflow JSON serialization
  const workflowTasks = useMemo(() => {
    try {
      return buildNestedWorkflowTasksFromGraph(nodes, edges);
    } catch {
      return [];
    }
  }, [nodes, edges]);

  const workflowJsonPayload = useMemo(() => {
    try {
      return buildExportPayload({
        nodes,
        edges,
        workflowName: workflowName || "Untitled",
        workflowVersion: effectiveVersion,
        workflowVariables: effectiveVariables,
        workflowDescription: effectiveDescription,
        workflowLanguage: effectiveLanguage,
        workflowSupportedLanguages: effectiveSupportedLanguages,
        workflowTasks,
      });
    } catch (e: any) {
      return {
        name: workflowName || "Untitled",
        version: effectiveVersion,
        tasks: workflowTasks,
        error: e?.message || "Failed to generate workflow export payload",
      };
    }
  }, [
    nodes,
    edges,
    workflowName,
    effectiveVersion,
    effectiveVariables,
    effectiveDescription,
    effectiveLanguage,
    effectiveSupportedLanguages,
    workflowTasks,
  ]);

  const workflowJsonString = useMemo(() => {
    if (options.jsonFormatting === "minified") {
      return JSON.stringify(workflowJsonPayload);
    }
    return JSON.stringify(workflowJsonPayload, null, 2);
  }, [workflowJsonPayload, options.jsonFormatting]);

  const handleCopyJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(workflowJsonString);
      setCopied(true);
      showSuccess("Copied workflow JSON to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showError("Failed to copy JSON to clipboard");
    }
  }, [workflowJsonString, showSuccess, showError]);

  // Dimension limit checks for raster formats
  const clampResult = useMemo(() => {
    if (options.format === "svg" || options.format === "pdf" || options.format === "json") {
      return {
        width: customWidth,
        height: customHeight,
        scale: 1,
        targetWidth: customWidth,
        targetHeight: customHeight,
        clamped: false,
      };
    }
    return checkAndClampRasterDimensions(customWidth, customHeight, options.scale);
  }, [options.format, customWidth, customHeight, options.scale]);

  // Compute live preview SVG (only when not in json mode)
  const svgResult = useMemo(() => {
    if (options.format === "json") {
      return {
        svgString: "",
        effectiveBackgroundColor: "#ffffff",
        autoContrastAdjusted: false,
        contrastNotice: "",
      };
    }
    const exportOpts: WorkflowExportOptions = {
      format: options.format,
      backgroundPreset: options.bgPreset,
      customBackgroundColor: options.customBg,
      nodeFillPreset: options.fillPreset,
      customNodeFillColor: options.customFill,
      detailLevel: options.detailLevel,
      themeMode: options.themeMode,
      includeTitle: options.includeTitle,
      titleText: workflowName || "Workflow Diagram",
      includeExportDate: options.includeDate,
      exportDateText: new Date().toISOString().split("T")[0],
      width: customWidth,
      height: customHeight,
      padding: 60,
      layoutDirection,
    };
    return generateWorkflowSvg(nodes, edges, exportOpts);
  }, [
    options,
    customWidth,
    customHeight,
    nodes,
    edges,
    workflowName,
    layoutDirection,
  ]);

  // Main Export Action
  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      if (options.format === "json") {
        setExportProgressText("Generating workflow JSON...");
        const jsonBlob = new Blob([workflowJsonString], {
          type: "application/json;charset=utf-8",
        });
        const sanitized = (workflowName || "workflow")
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .toLowerCase();
        const filename = `${sanitized}_v${effectiveVersion}.json`;
        triggerFileDownload(jsonBlob, filename);
        showSuccess(`Exported JSON: ${filename}`);
      } else {
        const filename = buildExportFilename(workflowName, options.format);

        if (options.format === "svg") {
          setExportProgressText("Generating vector SVG...");
          const blob = new Blob([svgResult.svgString], { type: "image/svg+xml;charset=utf-8" });
          triggerFileDownload(blob, filename);
          showSuccess(`Exported SVG: ${filename}`);
        } else if (options.format === "png") {
          setExportProgressText(`Rasterizing high-res PNG (${clampResult.targetWidth}×${clampResult.targetHeight}px)...`);
          const blob = await rasterizeSvgToBlob(svgResult.svgString, {
            format: "png",
            width: customWidth,
            height: customHeight,
            scale: clampResult.scale,
            backgroundColor: svgResult.effectiveBackgroundColor,
            isTransparent: options.bgPreset === "transparent",
          });
          triggerFileDownload(blob, filename);
          showSuccess(`Exported PNG: ${filename}`);
        } else if (options.format === "jpg") {
          setExportProgressText(`Rasterizing JPG at ${Math.round(options.jpgQuality * 100)}% quality...`);
          const blob = await rasterizeSvgToBlob(svgResult.svgString, {
            format: "jpg",
            width: customWidth,
            height: customHeight,
            scale: clampResult.scale,
            backgroundColor: svgResult.effectiveBackgroundColor,
            isTransparent: false,
            quality: options.jpgQuality,
          });
          triggerFileDownload(blob, filename);
          showSuccess(`Exported JPG: ${filename}`);
        } else if (options.format === "pdf") {
          setExportProgressText("Building vector PDF document...");
          const blob = await exportSvgToPdfBlob(svgResult.svgString, {
            width: customWidth,
            height: customHeight,
            backgroundColor: svgResult.effectiveBackgroundColor,
            isTransparent: options.bgPreset === "transparent",
          });
          triggerFileDownload(blob, filename);
          showSuccess(`Exported vector PDF: ${filename}`);
        }
      }
      onClose();
    } catch (err: any) {
      showError(`Export failed: ${err?.message || "Unknown error occurred"}`);
    } finally {
      setIsExporting(false);
      setExportProgressText("");
    }
  };

  if (!open) return null;

  const isTransparent = options.bgPreset === "transparent";
  const finalMegaPixels = ((clampResult.targetWidth * clampResult.targetHeight) / 1000000).toFixed(1);

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerTitleGroup}>
            <div className={styles.headerIconWrap}>
              <Download size={20} />
            </div>
            <div>
              <h2 className={styles.headerTitle}>Export Workflow</h2>
              <p className={styles.headerSubtitle}>
                Export workflow specification as JSON or as high-precision vector &amp; raster diagrams.
              </p>
            </div>
          </div>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>

        {/* Body: Two Columns */}
        <div className={styles.modalBody}>
          {/* Controls Column */}
          <div className={styles.controlsColumn}>
            {/* 1. Format */}
            <div className={styles.sectionBlock}>
              <div className={styles.sectionLabel}>
                <span>Output Format</span>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--color-accent-emphasis, #2563eb)" }}>
                  {options.format === "svg" || options.format === "pdf"
                    ? "Vector Lossless"
                    : options.format === "json"
                    ? "Workflow Specification"
                    : "Raster Image"}
                </span>
              </div>
              <div className={styles.formatGrid}>
                {(["svg", "pdf", "png", "jpg", "json"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    className={`${styles.formatButton} ${options.format === fmt ? styles.formatButtonActive : ""}`}
                    onClick={() => updateOption("format", fmt)}
                  >
                    {fmt === "svg" && <FileCode size={16} />}
                    {fmt === "pdf" && <FileText size={16} />}
                    {(fmt === "png" || fmt === "jpg") && <ImageIcon size={16} />}
                    {fmt === "json" && <FileJson size={16} />}
                    <span>{fmt.toUpperCase()}</span>
                    <span className={styles.formatSub}>
                      {fmt === "svg"
                        ? "Vector"
                        : fmt === "pdf"
                        ? "Doc"
                        : fmt === "png"
                        ? "Alpha"
                        : fmt === "jpg"
                        ? "Solid"
                        : "Data"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* JSON Specific Options */}
            {options.format === "json" ? (
              <>
                {/* JSON Formatting Style */}
                <div className={styles.sectionBlock}>
                  <div className={styles.sectionLabel}>
                    <span>Formatting Style</span>
                  </div>
                  <div className={styles.optionRow}>
                    <button
                      type="button"
                      className={`${styles.presetChip} ${options.jsonFormatting === "pretty" ? styles.presetChipActive : ""}`}
                      onClick={() => updateOption("jsonFormatting", "pretty")}
                    >
                      Formatted (2 Spaces)
                    </button>
                    <button
                      type="button"
                      className={`${styles.presetChip} ${options.jsonFormatting === "minified" ? styles.presetChipActive : ""}`}
                      onClick={() => updateOption("jsonFormatting", "minified")}
                    >
                      Minified (Compact)
                    </button>
                  </div>
                </div>

                {/* Workflow Specification Summary */}
                <div className={styles.sectionBlock}>
                  <div className={styles.sectionLabel}>
                    <span>Workflow Summary</span>
                  </div>
                  <div className={styles.summaryCard}>
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>Workflow Name</span>
                      <span className={styles.summaryValue}>{workflowName || "Untitled"}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>Version</span>
                      <span className={styles.summaryValue}>v{effectiveVersion}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>Total Nodes</span>
                      <span className={styles.summaryValue}>{nodes.length}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>Total Connections</span>
                      <span className={styles.summaryValue}>{edges.length}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>Estimated Size</span>
                      <span className={styles.summaryValue}>
                        {(new Blob([workflowJsonString]).size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Action: Copy to Clipboard */}
                <div className={styles.sectionBlock}>
                  <button
                    type="button"
                    className={styles.copyButton}
                    onClick={handleCopyJson}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    <span>{copied ? "Copied to Clipboard!" : "Copy JSON to Clipboard"}</span>
                  </button>
                </div>

                <div className={styles.noticeBanner}>
                  <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>
                    Full lossless workflow specification including UI graph coordinates, node configurations, and orchestration tasks.
                  </span>
                </div>
              </>
            ) : (
              <>
                {/* 2. Background Color */}
                <div className={styles.sectionBlock}>
                  <div className={styles.sectionLabel}>
                    <span>Background</span>
                    {options.format === "jpg" && (
                      <span style={{ fontSize: "11px", color: "var(--color-fg-muted, #64748b)" }}>
                        JPG has no alpha channel
                      </span>
                    )}
                  </div>
                  <div className={styles.optionRow}>
                    <button
                      type="button"
                      className={`${styles.presetChip} ${options.bgPreset === "dark" ? styles.presetChipActive : ""}`}
                      onClick={() => updateOption("bgPreset", "dark")}
                    >
                      <span className={styles.colorPreviewDot} style={{ background: "#0d1117" }} />
                      Dark
                    </button>
                    <button
                      type="button"
                      className={`${styles.presetChip} ${options.bgPreset === "white" ? styles.presetChipActive : ""}`}
                      onClick={() => updateOption("bgPreset", "white")}
                    >
                      <span className={styles.colorPreviewDot} style={{ background: "#ffffff" }} />
                      White
                    </button>
                    <button
                      type="button"
                      disabled={options.format === "jpg"}
                      className={`${styles.presetChip} ${options.bgPreset === "transparent" ? styles.presetChipActive : ""}`}
                      onClick={() => updateOption("bgPreset", "transparent")}
                      title={options.format === "jpg" ? "Transparent is unavailable for JPG" : "Transparent background"}
                    >
                      Transparent
                    </button>
                    <button
                      type="button"
                      className={`${styles.presetChip} ${options.bgPreset === "custom" ? styles.presetChipActive : ""}`}
                      onClick={() => updateOption("bgPreset", "custom")}
                    >
                      Custom
                    </button>
                  </div>

                  {options.bgPreset === "custom" && (
                    <div className={styles.customColorBox}>
                      <input
                        type="color"
                        className={styles.colorInputNative}
                        value={options.customBg}
                        onChange={(e) => updateOption("customBg", e.target.value)}
                      />
                      <input
                        type="text"
                        className={styles.hexTextInput}
                        value={options.customBg}
                        onChange={(e) => updateOption("customBg", e.target.value)}
                        placeholder="#0d1117"
                      />
                    </div>
                  )}
                </div>

                {/* 3. Node Fill Color & Auto-Contrast */}
                <div className={styles.sectionBlock}>
                  <div className={styles.sectionLabel}>
                    <span>Node Card Fill</span>
                  </div>
                  <div className={styles.optionRow}>
                    <button
                      type="button"
                      className={`${styles.presetChip} ${options.fillPreset === "theme" ? styles.presetChipActive : ""}`}
                      onClick={() => updateOption("fillPreset", "theme")}
                    >
                      Theme Default ({options.themeMode === "light" ? "White" : "Dark"})
                    </button>
                    <button
                      type="button"
                      className={`${styles.presetChip} ${options.fillPreset === "custom" ? styles.presetChipActive : ""}`}
                      onClick={() => updateOption("fillPreset", "custom")}
                    >
                      Custom Color
                    </button>
                  </div>

                  {options.fillPreset === "custom" && (
                    <div className={styles.customColorBox}>
                      <input
                        type="color"
                        className={styles.colorInputNative}
                        value={options.customFill}
                        onChange={(e) => updateOption("customFill", e.target.value)}
                      />
                      <input
                        type="text"
                        className={styles.hexTextInput}
                        value={options.customFill}
                        onChange={(e) => updateOption("customFill", e.target.value)}
                        placeholder="#161b22"
                      />
                    </div>
                  )}

                  {/* Auto-contrast notice */}
                  {svgResult.autoContrastAdjusted && (
                    <div className={styles.noticeBanner}>
                      <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>{svgResult.contrastNotice || "Auto-contrast adjusted text & element colors to maintain WCAG 4.5:1 readability."}</span>
                    </div>
                  )}
                </div>

                {/* 4. Dimensions & Scale */}
                <div className={styles.sectionBlock}>
                  <div className={styles.sectionLabel}>
                    <span>Dimensions (px)</span>
                    {options.format === "svg" || options.format === "pdf" ? (
                      <span style={{ fontSize: "11px", color: "var(--color-fg-muted, #64748b)" }}>
                        Scales losslessly
                      </span>
                    ) : (
                      <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--color-accent-emphasis, #2563eb)" }}>
                        {clampResult.targetWidth}×{clampResult.targetHeight} px ({finalMegaPixels} MP)
                      </span>
                    )}
                  </div>

                  {/* Presets */}
                  <div className={styles.optionRow}>
                    <button
                      type="button"
                      className={`${styles.presetChip} ${options.dimPreset === "fit" ? styles.presetChipActive : ""}`}
                      onClick={() => handleDimensionPresetChange("fit")}
                    >
                      Fit Content (1x)
                    </button>
                    <button
                      type="button"
                      className={`${styles.presetChip} ${options.dimPreset === "hd" ? styles.presetChipActive : ""}`}
                      onClick={() => handleDimensionPresetChange("hd")}
                    >
                      HD (1920)
                    </button>
                    <button
                      type="button"
                      className={`${styles.presetChip} ${options.dimPreset === "4k" ? styles.presetChipActive : ""}`}
                      onClick={() => handleDimensionPresetChange("4k")}
                    >
                      4K (3840)
                    </button>
                    <button
                      type="button"
                      className={`${styles.presetChip} ${options.dimPreset === "custom" ? styles.presetChipActive : ""}`}
                      onClick={() => updateOption("dimPreset", "custom")}
                    >
                      Custom
                    </button>
                  </div>

                  {/* Inputs with Aspect Lock */}
                  <div className={styles.dimInputRow}>
                    <div className={styles.dimField}>
                      <label className={styles.dimLabel}>Width (px)</label>
                      <input
                        type="number"
                        min={100}
                        max={16384}
                        className={styles.dimInput}
                        value={customWidth}
                        onChange={(e) => handleWidthChange(parseInt(e.target.value, 10))}
                      />
                    </div>
                    <button
                      type="button"
                      className={`${styles.aspectLockButton} ${options.aspectLocked ? styles.aspectLockButtonActive : ""}`}
                      onClick={() => updateOption("aspectLocked", !options.aspectLocked)}
                      title={options.aspectLocked ? "Aspect ratio locked" : "Aspect ratio unlocked"}
                    >
                      {options.aspectLocked ? <Lock size={15} /> : <Unlock size={15} />}
                    </button>
                    <div className={styles.dimField}>
                      <label className={styles.dimLabel}>Height (px)</label>
                      <input
                        type="number"
                        min={100}
                        max={16384}
                        className={styles.dimInput}
                        value={customHeight}
                        onChange={(e) => handleHeightChange(parseInt(e.target.value, 10))}
                      />
                    </div>
                  </div>

                  {/* Scale / DPI for PNG & JPG */}
                  {(options.format === "png" || options.format === "jpg") && (
                    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div className={styles.dimLabel}>Raster Sharpness / Scale</div>
                      <div className={styles.optionRow}>
                        {([1, 2, 3, 4] as const).map((sc) => (
                          <button
                            key={sc}
                            type="button"
                            className={`${styles.presetChip} ${options.scale === sc ? styles.presetChipActive : ""}`}
                            onClick={() => updateOption("scale", sc)}
                          >
                            {sc}x ({sc === 1 ? "Standard" : sc === 2 ? "Retina" : sc === 3 ? "High-DPI" : "Ultra"})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quality slider for JPG */}
                  {options.format === "jpg" && (
                    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span className={styles.dimLabel}>JPEG Compression Quality</span>
                        <span style={{ fontSize: "11px", fontWeight: "600" }}>{Math.round(options.jpgQuality * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="1.0"
                        step="0.02"
                        value={options.jpgQuality}
                        onChange={(e) => updateOption("jpgQuality", parseFloat(e.target.value))}
                        style={{ accentColor: "var(--color-accent-emphasis, #2563eb)", cursor: "pointer" }}
                      />
                    </div>
                  )}

                  {/* Clamping Warning */}
                  {clampResult.clamped && (
                    <div className={styles.warningBanner}>
                      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>{clampResult.warningMessage}</span>
                    </div>
                  )}
                </div>

                {/* 5. View Mode & Details */}
                <div className={styles.sectionBlock}>
                  <div className={styles.sectionLabel}>
                    <span>View Mode &amp; Header</span>
                  </div>
                  <div className={styles.optionRow}>
                    <button
                      type="button"
                      className={`${styles.presetChip} ${options.detailLevel === "client" ? styles.presetChipActive : ""}`}
                      onClick={() => updateOption("detailLevel", "client")}
                    >
                      Client View (Clean)
                    </button>
                    <button
                      type="button"
                      className={`${styles.presetChip} ${options.detailLevel === "full" ? styles.presetChipActive : ""}`}
                      onClick={() => updateOption("detailLevel", "full")}
                    >
                      Full Detail (Technical)
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "12px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={options.includeTitle}
                        onChange={(e) => updateOption("includeTitle", e.target.checked)}
                        style={{ accentColor: "var(--color-accent-emphasis, #2563eb)" }}
                      />
                      <span>Include Title</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "12px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={options.includeDate}
                        onChange={(e) => updateOption("includeDate", e.target.checked)}
                        style={{ accentColor: "var(--color-accent-emphasis, #2563eb)" }}
                      />
                      <span>Include Export Date</span>
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Live Preview Column */}
          <div className={styles.previewColumn}>
            <div className={styles.previewHeader}>
              <div className={styles.previewTitle}>
                <span>Live Preview</span>
                {options.format === "json" ? (
                  <>
                    <span className={styles.previewMetaPill}>JSON</span>
                    <span className={styles.previewMetaPill}>
                      {options.jsonFormatting === "pretty" ? "Formatted" : "Minified"}
                    </span>
                    <span className={styles.previewMetaPill}>v{effectiveVersion}</span>
                  </>
                ) : (
                  <>
                    <span className={styles.previewMetaPill}>{layoutDirection} Layout</span>
                    <span className={styles.previewMetaPill}>{options.detailLevel === "client" ? "Client View" : "Full Detail"}</span>
                  </>
                )}
              </div>
              <div className={styles.previewMetaPill}>
                {options.format === "json"
                  ? `${(new Blob([workflowJsonString]).size / 1024).toFixed(1)} KB`
                  : `${customWidth} × ${customHeight} px`}
              </div>
            </div>

            {options.format === "json" ? (
              <div className={styles.previewJsonWrap}>
                <WeaverCodeEditor
                  language="json"
                  value={workflowJsonString}
                  readOnly
                  height="100%"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 12,
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    stickyScroll: { enabled: false, maxNumStickyLines: 0 },
                  }}
                />
              </div>
            ) : (
              <div className={`${styles.previewCanvasWrap} ${isTransparent ? styles.checkeredBg : ""}`}>
                <div
                  className={styles.previewSvgHolder}
                  dangerouslySetInnerHTML={{ __html: svgResult.svgString }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <div className={styles.footerLeft}>
            <button
              type="button"
              className={styles.resetButton}
              onClick={handleResetDefaults}
              title="Reset export options to default settings"
            >
              <RotateCcw size={14} />
              Reset to defaults
            </button>
          </div>

          <div className={styles.footerRight}>
            <button type="button" className={styles.cancelButton} onClick={onClose} disabled={isExporting}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.exportButton}
              onClick={handleExport}
              disabled={isExporting}
            >
              <Download size={16} />
              <span>{isExporting ? exportProgressText || "Exporting..." : `Export ${options.format.toUpperCase()}`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowExportModal;
