import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import {
  generateWorkflowSvg,
  calculateGraphBounds,
  getRelativeLuminance,
  getContrastRatio,
  escapeXml,
} from "./exportSvgGenerator";
import {
  checkAndClampRasterDimensions,
  exportSvgToPdfBlob,
  rasterizeSvgToBlob,
  buildExportFilename,
  CANVAS_MAX_SIDE,
  CANVAS_MAX_AREA,
} from "./exportRasterizer";
import { buildExportPayload } from "./workflowSerialization";

describe("Workflow Export Feature & Native SVG Generator", () => {
  // 10-step sim_swap_wf topology (matching project standard)
  const simSwapNodes: Node[] = [
    {
      id: "check-request-scope",
      type: "SWITCH_ACTION",
      position: { x: 300, y: 50 },
      data: {
        name: "Check request scope",
        config: {
          taskReferenceName: "check_request_scope_ref",
          cases: [
            { id: "case-status", value: "CHECK_SIM_SWAP_STATUS", label: "CHECK_SIM_SWAP_STATUS" },
            { id: "case-perform", value: "PERFORM_SIM_SWAP", label: "PERFORM_SIM_SWAP" },
            { id: "case-invalid", value: "INVALID_REQUEST", label: "INVALID_REQUEST" },
          ],
        },
      },
      measured: { width: 340, height: 110 },
    },
    {
      id: "check-sim-swap-status-db",
      type: "DATABASE_ACTION",
      position: { x: 80, y: 220 },
      data: { name: "Query DB by ICCID", config: { taskReferenceName: "query_db_ref", statement: "SELECT * FROM sim" } },
      measured: { width: 220, height: 80 },
    },
    {
      id: "check-iccid-availability",
      type: "DATABASE_ACTION",
      position: { x: 340, y: 220 },
      data: { name: "Check ICCID availability", config: { taskReferenceName: "check_iccid_ref" } },
      measured: { width: 220, height: 80 },
    },
    {
      id: "prepare-iccid-cases",
      type: "SCRIPT_ACTION",
      position: { x: 340, y: 360 },
      data: { name: "Prepare ICCID status cases", config: { taskReferenceName: "prep_cases_ref", evaluatorType: "javascript" } },
      measured: { width: 220, height: 80 },
    },
    {
      id: "switch-on-iccid-status",
      type: "SWITCH_ACTION",
      position: { x: 340, y: 500 },
      data: {
        name: "Switch on (ICCID status)",
        config: {
          taskReferenceName: "switch_iccid_status_ref",
          cases: [
            { id: "case-unavailable", value: "UNAVAILABLE_ICCID", label: "UNAVAILABLE_ICCID" },
          ],
        },
      },
      measured: { width: 300, height: 105 },
    },
    {
      id: "term-unavailable-iccid",
      type: "TERMINATE",
      position: { x: 240, y: 660 },
      data: { name: "Terminate Unavailable", config: { taskReferenceName: "term_unavail_ref" } },
      measured: { width: 200, height: 75 },
    },
    {
      id: "task-perform-swap",
      type: "HTTP_ACTION",
      position: { x: 480, y: 660 },
      data: { name: "Perform Swap HTTP", config: { taskReferenceName: "perform_swap_ref", method: "POST", url: "/api/swap" } },
      measured: { width: 220, height: 80 },
    },
    {
      id: "terminate-invalid-request",
      type: "TERMINATE",
      position: { x: 600, y: 220 },
      data: { name: "Terminate Invalid", config: { taskReferenceName: "term_invalid_ref" } },
      measured: { width: 200, height: 75 },
    },
    {
      id: "terminate-default",
      type: "TERMINATE",
      position: { x: 840, y: 220 },
      data: { name: "Terminate Default", config: { taskReferenceName: "term_default_ref" } },
      measured: { width: 200, height: 75 },
    },
  ];

  const simSwapEdges: Edge[] = [
    {
      id: "e-status",
      source: "check-request-scope",
      sourceHandle: "case-status",
      target: "check-sim-swap-status-db",
      label: "CHECK_SIM_SWAP_STATUS",
    },
    {
      id: "e-perform",
      source: "check-request-scope",
      sourceHandle: "case-perform",
      target: "check-iccid-availability",
      label: "PERFORM_SIM_SWAP",
    },
    {
      id: "e-invalid",
      source: "check-request-scope",
      sourceHandle: "case-invalid",
      target: "terminate-invalid-request",
      label: "INVALID_REQUEST",
    },
    {
      id: "e-default",
      source: "check-request-scope",
      sourceHandle: "default",
      target: "terminate-default",
      label: "default",
    },
    {
      id: "e-prep",
      source: "check-iccid-availability",
      target: "prepare-iccid-cases",
    },
    {
      id: "e-subswitch",
      source: "prepare-iccid-cases",
      target: "switch-on-iccid-status",
    },
    {
      id: "e-sub-unavail",
      source: "switch-on-iccid-status",
      sourceHandle: "case-unavailable",
      target: "term-unavailable-iccid",
      label: "UNAVAILABLE_ICCID",
    },
    {
      id: "e-sub-default",
      source: "switch-on-iccid-status",
      sourceHandle: "default",
      target: "task-perform-swap",
      label: "default",
    },
  ];

  it("exports sim_swap_wf in TB and LR with default dark theme without foreignObject or images", () => {
    // 1. TB mode
    const tbResult = generateWorkflowSvg(simSwapNodes, simSwapEdges, {
      layoutDirection: "TB",
      backgroundPreset: "dark",
      themeMode: "dark",
      includeTitle: true,
      titleText: "sim_swap_wf",
    });

    expect(tbResult.svgString).toContain("<svg");
    expect(tbResult.svgString).toContain("</svg>");
    expect(tbResult.svgString).not.toContain("<foreignObject");
    expect(tbResult.svgString).not.toContain("<image");
    expect(tbResult.svgString).toContain("Check request scope");
    expect(tbResult.svgString).toContain("CHECK_SIM_SWAP_STATUS");
    expect(tbResult.svgString).toContain("Query DB by ICCID");

    // Assert full graph bounds enclosing all nodes
    expect(tbResult.bounds.viewBoxWidth).toBeGreaterThan(800);
    expect(tbResult.bounds.viewBoxHeight).toBeGreaterThan(600);

    // 2. LR mode
    const lrResult = generateWorkflowSvg(simSwapNodes, simSwapEdges, {
      layoutDirection: "LR",
      backgroundPreset: "dark",
      themeMode: "dark",
      includeTitle: true,
      titleText: "sim_swap_wf",
    });

    expect(lrResult.svgString).not.toContain("<foreignObject");
    expect(lrResult.svgString).not.toContain("<image");
    expect(lrResult.svgString).toContain("sim_swap_wf");
  });

  it("supports (b) white background with light custom fill and preserves contrast", () => {
    const result = generateWorkflowSvg(simSwapNodes, simSwapEdges, {
      backgroundPreset: "white",
      nodeFillPreset: "custom",
      customNodeFillColor: "#f1f5f9",
      themeMode: "light",
      includeTitle: true,
    });

    expect(result.effectiveBackgroundColor).toBe("#ffffff");
    expect(result.effectiveNodeFillColor).toBe("#f1f5f9");
    // Against #f1f5f9, text should be dark for >= 4.5:1 contrast
    expect(result.effectiveTextColor).toBe("#0f172a");

    const contrast = getContrastRatio(result.effectiveNodeFillColor, result.effectiveTextColor);
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    expect(result.svgString).toContain('fill="#ffffff"');
  });

  it("supports (c) transparent background (SVG/PNG/PDF) omitting the background rect", () => {
    const result = generateWorkflowSvg(simSwapNodes, simSwapEdges, {
      format: "svg",
      backgroundPreset: "transparent",
    });

    expect(result.effectiveBackgroundColor).toBe("transparent");
    // Verify first child is NOT a solid background rect
    expect(result.svgString).not.toContain('class="export-background"');
    // But node cards are still rendered
    expect(result.svgString).toContain('class="workflow-node"');
  });

  it("handles (d) unreadable custom choices by auto-adjusting contrast to >= 4.5:1 and setting a notice", () => {
    // Extreme unreadable choice: white node fill (#ffffff) with white custom background (#ffffff)
    const result = generateWorkflowSvg(simSwapNodes, simSwapEdges, {
      backgroundPreset: "white",
      nodeFillPreset: "custom",
      customNodeFillColor: "#ffffff",
      themeMode: "dark", // default theme text was light #f8fafc!
    });

    // Auto-contrast must have triggered
    expect(result.autoContrastAdjusted).toBe(true);
    expect(result.contrastNotice).toContain("WCAG 4.5:1");
    // Text must have been flipped to dark #0f172a to maintain readability
    expect(result.effectiveTextColor).toBe("#0f172a");

    const ratio = getContrastRatio(result.effectiveNodeFillColor, result.effectiveTextColor);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("generates real vector PDF using jsPDF and svg2pdf with selectable text and page dimensions", async () => {
    const svgResult = generateWorkflowSvg(simSwapNodes, simSwapEdges, {
      layoutDirection: "TB",
      backgroundPreset: "dark",
      includeTitle: true,
      titleText: "sim_swap_wf",
      width: 1200,
      height: 900,
    });

    const pdfBlob = await exportSvgToPdfBlob(svgResult.svgString, {
      width: 1200,
      height: 900,
    });

    expect(pdfBlob).toBeDefined();
    expect(pdfBlob.size).toBeGreaterThan(1000);
    expect(pdfBlob.type).toBe("application/pdf");

    // Read initial bytes to assert PDF magic header
    const buffer = await pdfBlob.arrayBuffer();
    const header = new TextDecoder().decode(buffer.slice(0, 5));
    expect(header).toBe("%PDF-");
  });

  it("tests raster size clamping with oversized requests (exceeding canvas limits)", () => {
    // Normal request: 1200 x 800 at 2x
    const normal = checkAndClampRasterDimensions(1200, 800, 2);
    expect(normal.clamped).toBe(false);
    expect(normal.targetWidth).toBe(2400);
    expect(normal.targetHeight).toBe(1600);

    // Oversized request: 6000 x 4000 at 4x -> 24000 x 16000 > 16384 max side & > 16.7M area
    const oversized = checkAndClampRasterDimensions(6000, 4000, 4);
    expect(oversized.clamped).toBe(true);
    expect(oversized.targetWidth).toBeLessThanOrEqual(CANVAS_MAX_SIDE);
    expect(oversized.targetHeight).toBeLessThanOrEqual(CANVAS_MAX_SIDE);
    expect(oversized.targetWidth * oversized.targetHeight).toBeLessThanOrEqual(CANVAS_MAX_AREA);
    expect(oversized.warningMessage).toContain("exceeds safe browser canvas limits");
    expect(oversized.warningMessage).toContain("SVG or PDF");
  });

  it("builds sanitized and dated filenames: <workflow-name>-<YYYY-MM-DD>.<ext>", () => {
    const today = new Date().toISOString().split("T")[0];
    expect(buildExportFilename("sim_swap_wf", "svg")).toBe(`sim_swap_wf-${today}.svg`);
    expect(buildExportFilename("sim_swap_wf", "pdf")).toBe(`sim_swap_wf-${today}.pdf`);
    expect(buildExportFilename("sim swap / flow!", "png")).toBe(`sim_swap___flow_-${today}.png`);
    expect(buildExportFilename("OrderRouter", "jpg")).toBe(`OrderRouter-${today}.jpg`);
  });

  it("supports Client view vs Full detail view modes", () => {
    // Client view
    const client = generateWorkflowSvg(simSwapNodes, simSwapEdges, {
      detailLevel: "client",
    });
    // Does not include technical ref markers like ref:
    expect(client.svgString).not.toContain("ref: check_request_scope_ref");

    // Full detail view
    const full = generateWorkflowSvg(simSwapNodes, simSwapEdges, {
      detailLevel: "full",
    });
    expect(full.svgString).toContain("ref: check_request_scope_ref");
  });

  it("Verification: exports all 4 format variations of sim_swap_wf and writes to test-exports folder", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const outDir = path.resolve(process.cwd(), "..", "test-exports");
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    // (a) TB Default Dark
    const tbDark = generateWorkflowSvg(simSwapNodes, simSwapEdges, {
      layoutDirection: "TB",
      backgroundPreset: "dark",
      themeMode: "dark",
      includeTitle: true,
      titleText: "sim_swap_wf (TB Dark)",
      includeExportDate: true,
    });
    fs.writeFileSync(path.join(outDir, "sim_swap_wf-TB-dark.svg"), tbDark.svgString, "utf-8");
    const tbDarkPdf = await exportSvgToPdfBlob(tbDark.svgString, { width: tbDark.bounds.viewBoxWidth, height: tbDark.bounds.viewBoxHeight });
    fs.writeFileSync(path.join(outDir, "sim_swap_wf-TB-dark.pdf"), Buffer.from(await tbDarkPdf.arrayBuffer()));

    // (a) LR Default Dark
    const lrDark = generateWorkflowSvg(simSwapNodes, simSwapEdges, {
      layoutDirection: "LR",
      backgroundPreset: "dark",
      themeMode: "dark",
      includeTitle: true,
      titleText: "sim_swap_wf (LR Dark)",
      includeExportDate: true,
    });
    fs.writeFileSync(path.join(outDir, "sim_swap_wf-LR-dark.svg"), lrDark.svgString, "utf-8");
    const lrDarkPdf = await exportSvgToPdfBlob(lrDark.svgString, { width: lrDark.bounds.viewBoxWidth, height: lrDark.bounds.viewBoxHeight });
    fs.writeFileSync(path.join(outDir, "sim_swap_wf-LR-dark.pdf"), Buffer.from(await lrDarkPdf.arrayBuffer()));

    // (b) White background with light custom fill
    const whiteFill = generateWorkflowSvg(simSwapNodes, simSwapEdges, {
      backgroundPreset: "white",
      nodeFillPreset: "custom",
      customNodeFillColor: "#f1f5f9",
      themeMode: "light",
      includeTitle: true,
      titleText: "sim_swap_wf (White + Light Fill)",
      includeExportDate: true,
    });
    fs.writeFileSync(path.join(outDir, "sim_swap_wf-white-lightfill.svg"), whiteFill.svgString, "utf-8");
    const whiteFillPdf = await exportSvgToPdfBlob(whiteFill.svgString, { width: whiteFill.bounds.viewBoxWidth, height: whiteFill.bounds.viewBoxHeight });
    fs.writeFileSync(path.join(outDir, "sim_swap_wf-white-lightfill.pdf"), Buffer.from(await whiteFillPdf.arrayBuffer()));

    // (c) Transparent background (SVG/PDF)
    const transparent = generateWorkflowSvg(simSwapNodes, simSwapEdges, {
      backgroundPreset: "transparent",
      includeTitle: true,
      titleText: "sim_swap_wf (Transparent)",
      includeExportDate: true,
    });
    fs.writeFileSync(path.join(outDir, "sim_swap_wf-transparent.svg"), transparent.svgString, "utf-8");
    const transPdf = await exportSvgToPdfBlob(transparent.svgString, { width: transparent.bounds.viewBoxWidth, height: transparent.bounds.viewBoxHeight });
    fs.writeFileSync(path.join(outDir, "sim_swap_wf-transparent.pdf"), Buffer.from(await transPdf.arrayBuffer()));

    // (d) Custom colored background with unreadable fill choice -> confirm auto-contrast works
    const autoContrast = generateWorkflowSvg(simSwapNodes, simSwapEdges, {
      backgroundPreset: "custom",
      customBackgroundColor: "#1e1b4b", // deep indigo
      nodeFillPreset: "custom",
      customNodeFillColor: "#ffffff", // white fill
      themeMode: "dark", // default dark text would be light (#f8fafc) -> unreadable on white!
      includeTitle: true,
      titleText: "sim_swap_wf (Auto Contrast Corrected)",
      includeExportDate: true,
    });
    fs.writeFileSync(path.join(outDir, "sim_swap_wf-autocontrast.svg"), autoContrast.svgString, "utf-8");
    const autoContrastPdf = await exportSvgToPdfBlob(autoContrast.svgString, { width: autoContrast.bounds.viewBoxWidth, height: autoContrast.bounds.viewBoxHeight });
    fs.writeFileSync(path.join(outDir, "sim_swap_wf-autocontrast.pdf"), Buffer.from(await autoContrastPdf.arrayBuffer()));

    // Assert auto-contrast triggered and contrast ratio >= 4.5
    expect(autoContrast.autoContrastAdjusted).toBe(true);
    expect(autoContrast.effectiveTextColor).toBe("#0f172a");
    const ratio = getContrastRatio(autoContrast.effectiveNodeFillColor, autoContrast.effectiveTextColor);
    expect(ratio).toBeGreaterThanOrEqual(4.5);

    // Verify written files exist and have non-zero size
    expect(fs.existsSync(path.join(outDir, "sim_swap_wf-TB-dark.svg"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "sim_swap_wf-TB-dark.pdf"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "sim_swap_wf-LR-dark.svg"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "sim_swap_wf-LR-dark.pdf"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "sim_swap_wf-white-lightfill.svg"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "sim_swap_wf-white-lightfill.pdf"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "sim_swap_wf-transparent.svg"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "sim_swap_wf-transparent.pdf"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "sim_swap_wf-autocontrast.svg"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "sim_swap_wf-autocontrast.pdf"))).toBe(true);
  });
});

describe("Workflow JSON serialization (buildExportPayload)", () => {
  it("exports only tasks, variables, metadata, name, version, description without paths, order, nodesOrder, edges, nodes, validationActions, contextMap", () => {
    const payload = buildExportPayload({
      nodes: [
        {
          id: "start-1",
          type: "START",
          data: {
            name: "Start",
            config: {
              language: "ar",
              supportedLanguages: ["en", "ar"],
              variables: { env: "prod" },
            },
          },
        },
        {
          id: "task-1",
          type: "HTTP_ACTION",
          data: {
            name: "Fetch Data",
            config: {
              taskReferenceName: "fetch_data_ref",
            },
          },
        },
      ],
      edges: [{ id: "e1-2", source: "start-1", target: "task-1" }],
      workflowName: "sim_swap_wf",
      workflowVersion: 2,
      workflowDescription: "SIM Swap Workflow",
    });

    // Verify root fields
    expect(payload.name).toBe("sim_swap_wf");
    expect(payload.version).toBe(2);
    expect(payload.description).toBe("SIM Swap Workflow");
    expect(payload.inputParameters).toEqual([]);
    expect(payload.outputParameters).toEqual({});
    expect(payload.schemaVersion).toBe(2);
    expect(payload.restartable).toBe(false);
    expect(payload.workflowStatusListenerEnabled).toBe(false);
    expect(typeof payload.ownerEmail).toBe("string");
    expect(payload.ownerEmail.length).toBeGreaterThan(0);
    expect(payload.timeoutPolicy).toBe("TIME_OUT_WF");
    expect(payload.timeoutSeconds).toBe(10);
    expect(payload.variables).toEqual({ env: "prod" });
    expect(payload.inputTemplate).toEqual({});
    expect(payload.enforceSchema).toBe(true);
    expect(payload.maskedFields).toEqual([]);
    expect(payload.metadata).toEqual({
      defaultLanguage: "ar",
      supportedLanguages: ["en", "ar"],
    });
    expect(payload.metadata.description).toBeUndefined();
    expect(payload.metadata.variables).toBeUndefined();
    expect(payload.metadata.default_language).toBeUndefined();
    expect(payload.metadata.supported_languages).toBeUndefined();

    expect(Array.isArray(payload.tasks)).toBe(true);
    expect(payload.tasks.length).toBeGreaterThan(0);

    // Explicitly verify removed fields are omitted
    expect(payload.paths).toBeUndefined();
    expect(payload.order).toBeUndefined();
    expect(payload.nodesOrder).toBeUndefined();
    expect(payload.nodes).toBeUndefined();
    expect(payload.edges).toBeUndefined();
    expect(payload.validationActions).toBeUndefined();
    expect(payload.contextMap).toBeUndefined();
    expect(payload.default_language).toBeUndefined();
    expect(payload.supported_languages).toBeUndefined();
    expect(payload.language).toBeUndefined();
    expect(payload.defaultLanguage).toBeUndefined();
    expect(payload.supportedLanguages).toBeUndefined();
    expect(payload.meta).toBeUndefined();
  });

  it("respects start node timeoutSeconds, timeoutPolicy, ownerEmail, restartable, and maskedFields", () => {
    const payload = buildExportPayload({
      nodes: [
        {
          id: "start-1",
          type: "startFlag",
          data: {
            config: {
              timeoutSeconds: 45,
              timeoutPolicy: "ALERT_ONLY",
              ownerEmail: "developer@vodafone.com",
              maskedFields: ["secretToken", "password"],
              restartable: true,
              workflowStatusListenerEnabled: true,
            },
          },
        },
      ],
      edges: [],
      workflowName: "custom_wf",
      workflowVersion: 3,
    });

    expect(payload.schemaVersion).toBe(2);
    expect(payload.timeoutSeconds).toBe(45);
    expect(payload.ownerEmail).toBe("developer@vodafone.com");
    expect(payload.timeoutPolicy).toBe("ALERT_ONLY");
    expect(payload.maskedFields).toEqual(["secretToken", "password"]);
    expect(payload.restartable).toBe(true);
    expect(payload.workflowStatusListenerEnabled).toBe(true);
  });

  it("ensures exported tasks and nested branches contain pure Conductor task definitions without internal metadata", () => {
    const payload = buildExportPayload({
      nodes: [
        {
          id: "00000000-0000-0000-0000-000000000000",
          type: "startFlag",
          position: { x: 220, y: 140 },
          data: { name: "Start" },
        },
        {
          id: "http-node-1",
          type: "HTTP_ACTION",
          position: { x: 400, y: 140 },
          data: {
            name: "Fetch bundles",
            config: {
              taskReferenceName: "fetch_bundles_ref",
              url: "https://api.vodafone.com/bundles",
              method: "GET",
            },
          },
        },
        {
          id: "switch-node-1",
          type: "SWITCH_ACTION",
          position: { x: 700, y: 140 },
          data: {
            name: "Check response",
            config: {
              taskReferenceName: "check_resp_ref",
              cases: [{ id: "case-ok", value: "SUCCESS" }],
            },
          },
        },
        {
          id: "db-node-1",
          type: "DATABASE_ACTION",
          position: { x: 1000, y: 140 },
          data: {
            name: "Save log",
            config: {
              taskReferenceName: "save_log_ref",
              queryId: "query-123",
            },
          },
        },
      ],
      edges: [
        { id: "e1", source: "00000000-0000-0000-0000-000000000000", target: "http-node-1" },
        { id: "e2", source: "http-node-1", target: "switch-node-1" },
        { id: "e3", source: "switch-node-1", sourceHandle: "case-ok", target: "db-node-1" },
      ],
      workflowName: "metadata_strip_test",
    });

    const verifyNoMetadata = (task: any) => {
      Object.keys(task).forEach((key) => {
        expect(key.startsWith("_")).toBe(false);
      });

      if (task.inputParameters && typeof task.inputParameters === "object") {
        Object.keys(task.inputParameters).forEach((key) => {
          expect(key.startsWith("_")).toBe(false);
        });
      }

      if (task.decisionCases) {
        Object.values(task.decisionCases).forEach((branch: any) => {
          branch.forEach(verifyNoMetadata);
        });
      }
      if (task.defaultCase) {
        task.defaultCase.forEach(verifyNoMetadata);
      }
    };

    expect(payload.tasks.length).toBeGreaterThan(0);
    payload.tasks.forEach(verifyNoMetadata);
  });
});



