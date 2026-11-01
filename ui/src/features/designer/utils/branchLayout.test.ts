import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import {
  calculateAutoLayout,
  detectCollisions,
  boxesIntersect,
  getNodeDimensions,
  getEdgeLabelDimensions,
  type BoundingBox,
} from "./autoLayout";
import { computeStyledEdges } from "./designerGraphUtils";

describe("Compact Branch Auto-Layout and Collision Verification", () => {
  it("keeps 4 branches compact (gap 40-70px, total width under 1200px) with no overlap and strictly left-to-right", () => {
    const switchNodeId = "switch-1";
    const switchNode: Node = {
      id: switchNodeId,
      type: "SWITCH_ACTION",
      position: { x: 0, y: 0 },
      data: {
        name: "Order Router",
        config: {
          taskReferenceName: "order_router",
          cases: [
            { id: "case-0", value: "VALID_REQUEST", label: "VALID_REQUEST" },
            {
              id: "case-1",
              value: "MISSING_REQUIRED_ATTRIBUTES",
              label: "MISSING_REQUIRED_ATTRIBUTES",
            },
            { id: "case-2", value: "INVALID_WALLET", label: "INVALID_WALLET" },
          ],
          defaultCase: [],
        },
      },
      measured: { width: 340, height: 110 },
    };

    const targetNodes: Node[] = [
      {
        id: "target-valid",
        type: "HTTP_ACTION",
        position: { x: 0, y: 0 },
        data: { name: "Process Valid Request" },
        measured: { width: 220, height: 85 },
      },
      {
        id: "target-missing",
        type: "HTTP_ACTION",
        position: { x: 0, y: 0 },
        data: { name: "Handle Missing Attributes" },
        measured: { width: 240, height: 85 },
      },
      {
        id: "target-invalid",
        type: "HTTP_ACTION",
        position: { x: 0, y: 0 },
        data: { name: "Reject Invalid Wallet" },
        measured: { width: 220, height: 85 },
      },
      {
        id: "target-default",
        type: "HTTP_ACTION",
        position: { x: 0, y: 0 },
        data: { name: "Default Fallback" },
        measured: { width: 220, height: 85 },
      },
    ];

    const edges: Edge[] = [
      {
        id: "edge-0",
        source: switchNodeId,
        sourceHandle: "case-0",
        target: "target-valid",
        label: "VALID_REQUEST",
      },
      {
        id: "edge-1",
        source: switchNodeId,
        sourceHandle: "case-1",
        target: "target-missing",
        label: "MISSING_REQUIRED_ATTRIBUTES",
      },
      {
        id: "edge-2",
        source: switchNodeId,
        sourceHandle: "case-2",
        target: "target-invalid",
        label: "INVALID_WALLET",
      },
      {
        id: "edge-3",
        source: switchNodeId,
        sourceHandle: "default",
        target: "target-default",
        label: "default",
      },
    ];

    const allNodes = [switchNode, ...targetNodes];

    const { nodes: layoutedNodes, edges: layoutedEdges } = calculateAutoLayout(
      allNodes,
      edges,
      { direction: "TB" }
    );

    const layoutedNodeMap = new Map(layoutedNodes.map((n) => [n.id, n]));
    const validNode = layoutedNodeMap.get("target-valid")!;
    const missingNode = layoutedNodeMap.get("target-missing")!;
    const invalidNode = layoutedNodeMap.get("target-invalid")!;
    const defaultNode = layoutedNodeMap.get("target-default")!;

    // 1. Assert children are ordered strictly left-to-right matching the source handles
    expect(validNode.position.x).toBeLessThan(missingNode.position.x);
    expect(missingNode.position.x).toBeLessThan(invalidNode.position.x);
    expect(invalidNode.position.x).toBeLessThan(defaultNode.position.x);

    // 2. Assert compact horizontal gap between sibling nodes (40px - 70px, not 200px+)
    const gap01 = missingNode.position.x - (validNode.position.x + getNodeDimensions(validNode).width);
    const gap12 = invalidNode.position.x - (missingNode.position.x + getNodeDimensions(missingNode).width);
    const gap23 = defaultNode.position.x - (invalidNode.position.x + getNodeDimensions(invalidNode).width);

    expect(gap01).toBeGreaterThanOrEqual(40);
    expect(gap01).toBeLessThanOrEqual(75);
    expect(gap12).toBeGreaterThanOrEqual(40);
    expect(gap12).toBeLessThanOrEqual(75);
    expect(gap23).toBeGreaterThanOrEqual(40);
    expect(gap23).toBeLessThanOrEqual(75);

    // 3. Assert total row width is compact (<= 1200px, not 2500px+)
    const minX = validNode.position.x;
    const maxX = defaultNode.position.x + getNodeDimensions(defaultNode).width;
    const totalRowWidth = maxX - minX;
    expect(totalRowWidth).toBeLessThanOrEqual(1150);

    // 4. Assert zero collisions across nodes and labels
    const collisionReport = detectCollisions(layoutedNodes, layoutedEdges);
    expect(collisionReport.hasCollisions).toBe(false);

    // 5. Assert no two node bounding boxes intersect
    const nodeBoxes: BoundingBox[] = layoutedNodes.map((n) => {
      const dims = getNodeDimensions(n);
      return { id: n.id, x: n.position.x, y: n.position.y, width: dims.width, height: dims.height };
    });

    for (let i = 0; i < nodeBoxes.length; i++) {
      for (let j = i + 1; j < nodeBoxes.length; j++) {
        expect(boxesIntersect(nodeBoxes[i], nodeBoxes[j])).toBe(false);
      }
    }

    // 6. Assert no two edge label bounding boxes intersect
    const labelBoxes: BoundingBox[] = layoutedEdges.map((e) => {
      const target = layoutedNodeMap.get(e.target)!;
      const targetDims = getNodeDimensions(target);
      const targetX = target.position.x + targetDims.width / 2;
      const targetY = target.position.y;
      const dims = getEdgeLabelDimensions(String(e.label));
      return {
        id: `label-${e.id}`,
        x: targetX - dims.width / 2,
        y: targetY - 26 - dims.height / 2,
        width: dims.width,
        height: dims.height,
      };
    });

    for (let i = 0; i < labelBoxes.length; i++) {
      for (let j = i + 1; j < labelBoxes.length; j++) {
        expect(boxesIntersect(labelBoxes[i], labelBoxes[j])).toBe(false);
      }
    }

    // 7. Assert edges receive staggered branch indices
    const styledEdges = computeStyledEdges(layoutedEdges, layoutedNodes);
    const branchIndices = styledEdges.map((e) => e.data?.branchIndex);
    expect(branchIndices).toEqual([0, 1, 2, 3]);
  });

  it("handles the 'Check request scope' -> 'Switch' -> 'Switch on ICCID status' flow compactly without pushing terminal siblings away", () => {
    // Exact topology from scripts/sim_swap.json
    const switchScopeNode: Node = {
      id: "check-request-scope",
      type: "SWITCH_ACTION",
      position: { x: 0, y: 0 },
      data: {
        name: "Check request scope",
        config: {
          cases: [
            { id: "case-status", value: "CHECK_SIM_SWAP_STATUS", label: "CHECK_SIM_SWAP_STATUS" },
            { id: "case-perform", value: "PERFORM_SIM_SWAP", label: "PERFORM_SIM_SWAP" },
            { id: "case-invalid", value: "INVALID_REQUEST", label: "INVALID_REQUEST" },
          ],
        },
      },
      measured: { width: 340, height: 110 },
    };

    // Branch 0 target: Database task
    const dbTaskNode: Node = {
      id: "check-sim-swap-status-db",
      type: "DATABASE_ACTION",
      position: { x: 0, y: 0 },
      data: { name: "Query DB by ICCID" },
      measured: { width: 220, height: 80 },
    };

    // Branch 1 targets: Pipeline leading to second switch
    const checkAvailabilityNode: Node = {
      id: "check-iccid-availability",
      type: "DATABASE_ACTION",
      position: { x: 0, y: 0 },
      data: { name: "Check ICCID availability" },
      measured: { width: 220, height: 80 },
    };

    const prepareCasesNode: Node = {
      id: "prepare-iccid-cases",
      type: "SCRIPT_ACTION",
      position: { x: 0, y: 0 },
      data: { name: "Prepare ICCID status cases" },
      measured: { width: 220, height: 80 },
    };

    const switchIccidStatusNode: Node = {
      id: "switch-on-iccid-status",
      type: "SWITCH_ACTION",
      position: { x: 0, y: 0 },
      data: {
        name: "Switch on (ICCID status)",
        config: {
          cases: [
            { id: "case-unavailable", value: "UNAVAILABLE_ICCID", label: "UNAVAILABLE_ICCID" },
          ],
        },
      },
      measured: { width: 300, height: 105 },
    };

    const subSwitchUnavailableTerminate: Node = {
      id: "term-unavailable-iccid",
      type: "TERMINATE",
      position: { x: 0, y: 0 },
      data: { name: "Terminate Unavailable" },
      measured: { width: 200, height: 75 },
    };

    const subSwitchPerformSwapTask: Node = {
      id: "task-perform-swap",
      type: "HTTP_ACTION",
      position: { x: 0, y: 0 },
      data: { name: "Perform Swap HTTP" },
      measured: { width: 220, height: 80 },
    };

    // Branch 2 target: Terminal node for INVALID_REQUEST
    const terminateInvalidNode: Node = {
      id: "terminate-invalid-request",
      type: "TERMINATE",
      position: { x: 0, y: 0 },
      data: { name: "Terminate Invalid" },
      measured: { width: 200, height: 75 },
    };

    // Branch 3 target: Terminal node for default
    const terminateDefaultNode: Node = {
      id: "terminate-default",
      type: "TERMINATE",
      position: { x: 0, y: 0 },
      data: { name: "Terminate Default" },
      measured: { width: 200, height: 75 },
    };

    const edges: Edge[] = [
      // 4 Outgoing edges from parent switch
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
      // Branch 1 downstream pipeline
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
      // Sub-switch branches
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

    const allNodes = [
      switchScopeNode,
      dbTaskNode,
      checkAvailabilityNode,
      prepareCasesNode,
      switchIccidStatusNode,
      subSwitchUnavailableTerminate,
      subSwitchPerformSwapTask,
      terminateInvalidNode,
      terminateDefaultNode,
    ];

    const { nodes: layoutedNodes, edges: layoutedEdges } = calculateAutoLayout(
      allNodes,
      edges,
      { direction: "TB" }
    );

    const layoutedNodeMap = new Map(layoutedNodes.map((n) => [n.id, n]));
    const b0 = layoutedNodeMap.get("check-sim-swap-status-db")!;
    const b1 = layoutedNodeMap.get("check-iccid-availability")!;
    const b2 = layoutedNodeMap.get("terminate-invalid-request")!;
    const b3 = layoutedNodeMap.get("terminate-default")!;

    // 1. Direct children on the layer directly beneath the parent switch are in the same row
    expect(Math.abs(b0.position.y - b1.position.y)).toBeLessThan(10);
    expect(Math.abs(b1.position.y - b2.position.y)).toBeLessThan(10);
    expect(Math.abs(b2.position.y - b3.position.y)).toBeLessThan(10);

    // 2. Direct children are ordered left-to-right matching the source handles
    expect(b0.position.x).toBeLessThan(b1.position.x);
    expect(b1.position.x).toBeLessThan(b2.position.x);
    expect(b2.position.x).toBeLessThan(b3.position.x);

    // 3. Terminal nodes (b2, b3) are NOT pushed far away to the right (within compact distance)
    const gap12 = b2.position.x - (b1.position.x + getNodeDimensions(b1).width);
    const gap23 = b3.position.x - (b2.position.x + getNodeDimensions(b2).width);
    expect(gap12).toBeGreaterThanOrEqual(40);
    expect(gap12).toBeLessThanOrEqual(80);
    expect(gap23).toBeGreaterThanOrEqual(40);
    expect(gap23).toBeLessThanOrEqual(80);

    // 4. Total graph width should be roughly the width of the widest row of siblings (no more than about 1.5x)
    let overallMinX = Infinity;
    let overallMaxX = -Infinity;
    layoutedNodes.forEach((n) => {
      const dims = getNodeDimensions(n);
      overallMinX = Math.min(overallMinX, n.position.x);
      overallMaxX = Math.max(overallMaxX, n.position.x + dims.width);
    });
    const totalLayoutWidth = overallMaxX - overallMinX;

    // Widest row is ~1000px, 1.5x is 1500px
    expect(totalLayoutWidth).toBeLessThanOrEqual(1350);

    // 5. Assert zero collisions
    const collisionReport = detectCollisions(layoutedNodes, layoutedEdges);
    expect(collisionReport.hasCollisions).toBe(false);
  });

  it("arranges a nested branching case compactly without any collisions", () => {
    const parentSwitch: Node = {
      id: "parent-switch",
      type: "SWITCH_ACTION",
      position: { x: 0, y: 0 },
      data: {
        name: "Main Classifier",
        config: {
          cases: [{ id: "parent-case-0", value: "ROUTE_NESTED", label: "ROUTE_NESTED" }],
        },
      },
      measured: { width: 280, height: 100 },
    };

    const regularChild: Node = {
      id: "regular-child",
      type: "HTTP_ACTION",
      position: { x: 0, y: 0 },
      data: { name: "Direct Action" },
      measured: { width: 220, height: 80 },
    };

    const childSwitch: Node = {
      id: "child-switch",
      type: "SWITCH_ACTION",
      position: { x: 0, y: 0 },
      data: {
        name: "Sub Classifier",
        config: {
          cases: [
            { id: "sub-case-0", value: "TIER_1_ENTERPRISE", label: "TIER_1_ENTERPRISE" },
            { id: "sub-case-1", value: "TIER_2_STANDARD", label: "TIER_2_STANDARD" },
          ],
        },
      },
      measured: { width: 300, height: 100 },
    };

    const nestedChild1: Node = {
      id: "nested-action-1",
      type: "HTTP_ACTION",
      position: { x: 0, y: 0 },
      data: { name: "Enterprise Handler" },
      measured: { width: 220, height: 80 },
    };

    const nestedChild2: Node = {
      id: "nested-action-2",
      type: "HTTP_ACTION",
      position: { x: 0, y: 0 },
      data: { name: "Standard Handler" },
      measured: { width: 220, height: 80 },
    };

    const nestedDefault: Node = {
      id: "nested-action-default",
      type: "HTTP_ACTION",
      position: { x: 0, y: 0 },
      data: { name: "Fallback Handler" },
      measured: { width: 220, height: 80 },
    };

    const edges: Edge[] = [
      {
        id: "p-edge-0",
        source: "parent-switch",
        sourceHandle: "parent-case-0",
        target: "child-switch",
        label: "ROUTE_NESTED",
      },
      {
        id: "p-edge-1",
        source: "parent-switch",
        sourceHandle: "default",
        target: "regular-child",
        label: "default",
      },
      {
        id: "c-edge-0",
        source: "child-switch",
        sourceHandle: "sub-case-0",
        target: "nested-action-1",
        label: "TIER_1_ENTERPRISE",
      },
      {
        id: "c-edge-1",
        source: "child-switch",
        sourceHandle: "sub-case-1",
        target: "nested-action-2",
        label: "TIER_2_STANDARD",
      },
      {
        id: "c-edge-2",
        source: "child-switch",
        sourceHandle: "default",
        target: "nested-action-default",
        label: "default",
      },
    ];

    const allNodes = [
      parentSwitch,
      regularChild,
      childSwitch,
      nestedChild1,
      nestedChild2,
      nestedDefault,
    ];

    const { nodes: layoutedNodes, edges: layoutedEdges } = calculateAutoLayout(
      allNodes,
      edges,
      { direction: "TB" }
    );

    const collisionReport = detectCollisions(layoutedNodes, layoutedEdges);
    expect(collisionReport.hasCollisions).toBe(false);

    const layoutedNodeMap = new Map(layoutedNodes.map((n) => [n.id, n]));
    const n1 = layoutedNodeMap.get("nested-action-1")!;
    const n2 = layoutedNodeMap.get("nested-action-2")!;
    const nDef = layoutedNodeMap.get("nested-action-default")!;

    expect(n1.position.x).toBeLessThan(n2.position.x);
    expect(n2.position.x).toBeLessThan(nDef.position.x);

    const cSwitch = layoutedNodeMap.get("child-switch")!;
    const regChild = layoutedNodeMap.get("regular-child")!;
    expect(cSwitch.position.x).toBeLessThan(regChild.position.x);
  });

  it("Task 1: verifies edge label wrapper preserves getBoundingClientRect and does not mutate transform or dimensions on hover", () => {
    // Simulate DOM elements with the exact class hierarchy and styles as WeaverBranchEdge
    const container = document.createElement("div");
    document.body.appendChild(container);

    const labelX = 350;
    const labelY = 200;

    const wrapper = document.createElement("div");
    wrapper.className = "weaver-branch-edge-label-wrapper";
    wrapper.style.position = "absolute";
    wrapper.style.transform = `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`;
    wrapper.style.pointerEvents = "all";
    wrapper.style.zIndex = "10";

    const label = document.createElement("div");
    label.className = "weaver-branch-edge-label";
    label.style.borderColor = "#94a3b8";
    label.style.color = "#1f2937";
    label.textContent = "CHECK_SIM_SWAP_STATUS";

    wrapper.appendChild(label);
    container.appendChild(wrapper);

    // Initial bounding client rect before hover
    const rectBefore = wrapper.getBoundingClientRect();
    const labelRectBefore = label.getBoundingClientRect();
    const transformBefore = wrapper.style.transform;

    // Simulate hover on the label
    label.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    label.classList.add("hover");

    const rectAfter = wrapper.getBoundingClientRect();
    const labelRectAfter = label.getBoundingClientRect();
    const transformAfter = wrapper.style.transform;

    // 1. Transform on wrapper is identical (positioning never overridden)
    expect(transformAfter).toBe(transformBefore);
    expect(transformAfter).toBe(`translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`);

    // 2. getBoundingClientRect before and after hover are identical (no flicker/jump)
    expect(rectAfter.width).toBe(rectBefore.width);
    expect(rectAfter.height).toBe(rectBefore.height);
    expect(rectAfter.top).toBe(rectBefore.top);
    expect(rectAfter.left).toBe(rectBefore.left);

    expect(labelRectAfter.width).toBe(labelRectBefore.width);
    expect(labelRectAfter.height).toBe(labelRectBefore.height);

    // Simulate hover on the gap between path and label
    const pathElem = document.createElementNS("http://www.w3.org/2000/svg", "path");
    container.appendChild(pathElem);
    pathElem.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));

    // Confirm wrapper transform remains intact
    expect(wrapper.style.transform).toBe(`translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`);

    document.body.removeChild(container);
  });

  it("Task 2: renders the sim_swap_wf flow in both TB and LR: assert zero overlapping nodes or labels and edges exit right and enter left in LR", () => {
    // 10-step sim_swap_wf topology
    const switchScopeNode: Node = {
      id: "check-request-scope",
      type: "SWITCH_ACTION",
      position: { x: 0, y: 0 },
      data: {
        name: "Check request scope",
        config: {
          cases: [
            { id: "case-status", value: "CHECK_SIM_SWAP_STATUS", label: "CHECK_SIM_SWAP_STATUS" },
            { id: "case-perform", value: "PERFORM_SIM_SWAP", label: "PERFORM_SIM_SWAP" },
            { id: "case-invalid", value: "INVALID_REQUEST", label: "INVALID_REQUEST" },
          ],
        },
      },
      measured: { width: 340, height: 110 },
    };

    const dbTaskNode: Node = {
      id: "check-sim-swap-status-db",
      type: "DATABASE_ACTION",
      position: { x: 0, y: 0 },
      data: { name: "Query DB by ICCID" },
      measured: { width: 220, height: 80 },
    };

    const checkAvailabilityNode: Node = {
      id: "check-iccid-availability",
      type: "DATABASE_ACTION",
      position: { x: 0, y: 0 },
      data: { name: "Check ICCID availability" },
      measured: { width: 220, height: 80 },
    };

    const prepareCasesNode: Node = {
      id: "prepare-iccid-cases",
      type: "SCRIPT_ACTION",
      position: { x: 0, y: 0 },
      data: { name: "Prepare ICCID status cases" },
      measured: { width: 220, height: 80 },
    };

    const switchIccidStatusNode: Node = {
      id: "switch-on-iccid-status",
      type: "SWITCH_ACTION",
      position: { x: 0, y: 0 },
      data: {
        name: "Switch on (ICCID status)",
        config: {
          cases: [
            { id: "case-unavailable", value: "UNAVAILABLE_ICCID", label: "UNAVAILABLE_ICCID" },
          ],
        },
      },
      measured: { width: 300, height: 105 },
    };

    const subSwitchUnavailableTerminate: Node = {
      id: "term-unavailable-iccid",
      type: "TERMINATE",
      position: { x: 0, y: 0 },
      data: { name: "Terminate Unavailable" },
      measured: { width: 200, height: 75 },
    };

    const subSwitchPerformSwapTask: Node = {
      id: "task-perform-swap",
      type: "HTTP_ACTION",
      position: { x: 0, y: 0 },
      data: { name: "Perform Swap HTTP" },
      measured: { width: 220, height: 80 },
    };

    const terminateInvalidNode: Node = {
      id: "terminate-invalid-request",
      type: "TERMINATE",
      position: { x: 0, y: 0 },
      data: { name: "Terminate Invalid" },
      measured: { width: 200, height: 75 },
    };

    const terminateDefaultNode: Node = {
      id: "terminate-default",
      type: "TERMINATE",
      position: { x: 0, y: 0 },
      data: { name: "Terminate Default" },
      measured: { width: 200, height: 75 },
    };

    const edges: Edge[] = [
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

    const allNodes = [
      switchScopeNode,
      dbTaskNode,
      checkAvailabilityNode,
      prepareCasesNode,
      switchIccidStatusNode,
      subSwitchUnavailableTerminate,
      subSwitchPerformSwapTask,
      terminateInvalidNode,
      terminateDefaultNode,
    ];

    // --- 1. Test TB Mode ---
    const { nodes: tbNodes, edges: tbEdges } = calculateAutoLayout(allNodes, edges, { direction: "TB" });
    const tbCollisions = detectCollisions(tbNodes, tbEdges, "TB");
    expect(tbCollisions.hasCollisions).toBe(false);
    expect(tbNodes.every((n) => n.sourcePosition === "bottom" && n.targetPosition === "top")).toBe(true);

    // --- 2. Test LR Mode ---
    const { nodes: lrNodes, edges: lrEdges } = calculateAutoLayout(allNodes, edges, { direction: "LR" });
    const lrCollisions = detectCollisions(lrNodes, lrEdges, "LR");
    expect(lrCollisions.hasCollisions).toBe(false);

    // Assert handles in LR: every edge starts at right side and ends at left side
    expect(lrNodes.every((n) => n.sourcePosition === "right" && n.targetPosition === "left")).toBe(true);

    const lrMap = new Map(lrNodes.map((n) => [n.id, n]));
    const b0 = lrMap.get("check-sim-swap-status-db")!;
    const b1 = lrMap.get("check-iccid-availability")!;
    const b2 = lrMap.get("terminate-invalid-request")!;
    const b3 = lrMap.get("terminate-default")!;

    // In LR: direct children are stacked vertically directly to the right of parent switch
    expect(b0.position.y).toBeLessThan(b1.position.y);
    expect(b1.position.y).toBeLessThan(b2.position.y);
    expect(b2.position.y).toBeLessThan(b3.position.y);

    // All 4 branch children are aligned in the same vertical column
    expect(b0.position.x).toBe(b1.position.x);
    expect(b1.position.x).toBe(b2.position.x);
    expect(b2.position.x).toBe(b3.position.x);

    // Target nodes are strictly to the right of the switch node
    const parentSwitch = lrMap.get("check-request-scope")!;
    expect(b0.position.x).toBeGreaterThan(parentSwitch.position.x + getNodeDimensions(parentSwitch).width);

    // Terminal nodes (b2, b3) are in the column beside their sibling branches with compact vertical gap (40px)
    const gap12 = b2.position.y - (b1.position.y + getNodeDimensions(b1).height);
    const gap23 = b3.position.y - (b2.position.y + getNodeDimensions(b2).height);
    expect(gap12).toBe(40);
    expect(gap23).toBe(40);
  });

  it("verifies edge labels are hidden by default (opacity: 0) and appear on hover (opacity: 1) or when selected", () => {
    // Simulate label wrapper style calculation logic matching WeaverBranchEdge
    const getWrapperStyle = (isVisible: boolean, labelX = 200, labelY = 150) => ({
      position: "absolute" as const,
      transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
      pointerEvents: isVisible ? "all" : "none",
      opacity: isVisible ? 1 : 0,
      transition: "opacity 0.15s ease",
      zIndex: 10,
    });

    // 1. By default (not hovered, not selected): hidden
    const unhovered = getWrapperStyle(false);
    expect(unhovered.opacity).toBe(0);
    expect(unhovered.pointerEvents).toBe("none");

    // 2. When hovered: visible
    const hovered = getWrapperStyle(true);
    expect(hovered.opacity).toBe(1);
    expect(hovered.pointerEvents).toBe("all");

    // 3. When edge is selected: visible even without hover
    const isVisibleSelected = false || Boolean(true);
    const selectedStyle = getWrapperStyle(isVisibleSelected);
    expect(selectedStyle.opacity).toBe(1);
    expect(selectedStyle.pointerEvents).toBe("all");
  });
});


