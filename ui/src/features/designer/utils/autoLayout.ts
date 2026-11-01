import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import {
  isStartNodeId,
  isEndNode,
  getTerminalNodes,
  normalizeSwitchHandleId,
  getSwitchCaseLabel,
  getSourceHandleIndex,
} from "@/features/designer/utils/designerGraphUtils";
import { isScopeNode } from "@/features/designer/services/scopeGraph";
import {
  buildSwitchCaseHandles,
  normalizeCases,
} from "@/features/designer/components/actions/switch/model/switchDto";

export { getSourceHandleIndex };

export type LayoutDirection = "TB" | "LR";

export const STORAGE_KEY_LAYOUT_DIRECTION = "weaver_layout_direction";

export function getStoredLayoutDirection(): LayoutDirection {
  try {
    const val = localStorage.getItem(STORAGE_KEY_LAYOUT_DIRECTION);
    if (val === "LR" || val === "TB") {
      return val;
    }
  } catch {
    // ignore
  }
  return "TB";
}

export function setStoredLayoutDirection(dir: LayoutDirection): void {
  try {
    localStorage.setItem(STORAGE_KEY_LAYOUT_DIRECTION, dir);
  } catch {
    // ignore
  }
}

export interface AutoLayoutOptions {
  direction?: LayoutDirection;
  nodeSep?: number;
  rankSep?: number;
}

export interface BoundingBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_NODE_WIDTH = 220;
const DEFAULT_NODE_HEIGHT = 80;

/**
 * Derives dimensions for a node based on actual measured DOM size from React Flow,
 * or fallback calculation when unmeasured.
 */
export function getNodeDimensions(node: Node): { width: number; height: number } {
  // 1. Primary: actual measured DOM dimensions from React Flow
  if (
    node.measured?.width &&
    node.measured?.height &&
    node.measured.width > 0 &&
    node.measured.height > 0
  ) {
    return { width: node.measured.width, height: node.measured.height };
  }

  // 2. Secondary: explicit width / height properties
  if (node.width && node.height && node.width > 0 && node.height > 0) {
    return { width: node.width, height: node.height };
  }

  // 3. Fallback estimations for unmeasured nodes
  if (
    isStartNodeId(node.id) ||
    isEndNode(node) ||
    node.id === "end" ||
    node.type === "startFlag" ||
    node.type === "endFlag"
  ) {
    return { width: 56, height: 56 };
  }

  if (node.type === "switch" || node.type === "SWITCH_ACTION") {
    const cfg = (node.data as any)?.config ?? (node.data as any);
    const cases = normalizeCases(cfg);
    const handleCount = Math.max(1, cases.length + 1);
    return { width: Math.max(260, handleCount * 90), height: 105 };
  }

  if (isScopeNode(node)) {
    const bounds = (node.data as any)?.bounds;
    return {
      width: bounds?.width || 340,
      height: bounds?.height || 220,
    };
  }

  return { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };
}

/**
 * Calculates estimated dimensions of an edge label badge.
 * With font-size 11px and font-weight 800, average character width is ~8.2px
 * plus horizontal padding and borders.
 */
export function getEdgeLabelDimensions(label: string | undefined | null): { width: number; height: number } {
  if (!label || !String(label).trim()) {
    return { width: 0, height: 0 };
  }
  const text = String(label).trim();
  const width = Math.max(60, Math.round(text.length * 8.5 + 28));
  const height = 24;
  return { width, height };
}

/**
 * Checks whether two 2D axis-aligned bounding boxes intersect.
 */
export function boxesIntersect(a: BoundingBox, b: BoundingBox, padding = 0): boolean {
  return (
    a.x < b.x + b.width + padding &&
    a.x + a.width + padding > b.x &&
    a.y < b.y + b.height + padding &&
    a.y + a.height + padding > b.y
  );
}

export interface CollisionDetail {
  type: "node-node" | "label-label" | "label-node";
  aId: string;
  bId: string;
  overlapX: number;
  overlapY: number;
}

const SIBLING_GAP = 40;
const LAYER_GAP = 60;

/**
 * Detects overlapping node bounding boxes and edge label bounding boxes.
 */
export function detectCollisions(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection = "TB"
): {
  hasCollisions: boolean;
  maxOverlapX: number;
  maxOverlapY: number;
  collisions: CollisionDetail[];
} {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const nodeBoxes: BoundingBox[] = nodes.map((n) => {
    const { width, height } = getNodeDimensions(n);
    return { id: n.id, x: n.position.x, y: n.position.y, width, height };
  });

  const isLR = direction === "LR";
  const labelBoxes: BoundingBox[] = [];
  edges.forEach((e) => {
    const sourceNode = nodeMap.get(e.source);
    const edgeLabel =
      e.label ||
      (e.data as any)?.label ||
      getSwitchCaseLabel(sourceNode, e.sourceHandle);
    if (!edgeLabel) return;
    const targetNode = nodeMap.get(e.target);
    if (!targetNode) return;
    const targetDims = getNodeDimensions(targetNode);
    const { width: labelW, height: labelH } = getEdgeLabelDimensions(String(edgeLabel));
    let labelX: number;
    let labelY: number;
    if (isLR) {
      labelX = targetNode.position.x - Math.round(labelW / 2 + 24);
      labelY = targetNode.position.y + targetDims.height / 2;
    } else {
      labelX = targetNode.position.x + targetDims.width / 2;
      labelY = targetNode.position.y - 26;
    }
    labelBoxes.push({
      id: `label-${e.id}`,
      x: labelX - labelW / 2,
      y: labelY - labelH / 2,
      width: labelW,
      height: labelH,
    });
  });

  const collisions: CollisionDetail[] = [];
  let hasCollisions = false;
  let maxOverlapX = 0;
  let maxOverlapY = 0;

  // 1. Check node-node collisions
  for (let i = 0; i < nodeBoxes.length; i++) {
    for (let j = i + 1; j < nodeBoxes.length; j++) {
      const a = nodeBoxes[i];
      const b = nodeBoxes[j];
      if (boxesIntersect(a, b, 8)) {
        hasCollisions = true;
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        maxOverlapX = Math.max(maxOverlapX, overlapX);
        maxOverlapY = Math.max(maxOverlapY, overlapY);
        collisions.push({ type: "node-node", aId: a.id, bId: b.id, overlapX, overlapY });
      }
    }
  }

  // 2. Check label-label collisions
  for (let i = 0; i < labelBoxes.length; i++) {
    for (let j = i + 1; j < labelBoxes.length; j++) {
      const a = labelBoxes[i];
      const b = labelBoxes[j];
      if (boxesIntersect(a, b, 6)) {
        hasCollisions = true;
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        maxOverlapX = Math.max(maxOverlapX, overlapX);
        maxOverlapY = Math.max(maxOverlapY, overlapY);
        collisions.push({ type: "label-label", aId: a.id, bId: b.id, overlapX, overlapY });
      }
    }
  }

  // 3. Check label-node collisions
  for (const lbl of labelBoxes) {
    for (const nb of nodeBoxes) {
      if (boxesIntersect(lbl, nb, 4)) {
        hasCollisions = true;
        const overlapX = Math.min(lbl.x + lbl.width, nb.x + nb.width) - Math.max(lbl.x, nb.x);
        const overlapY = Math.min(lbl.y + lbl.height, nb.y + nb.height) - Math.max(lbl.y, nb.y);
        maxOverlapX = Math.max(maxOverlapX, overlapX);
        maxOverlapY = Math.max(maxOverlapY, overlapY);
        collisions.push({ type: "label-node", aId: lbl.id, bId: nb.id, overlapX, overlapY });
      }
    }
  }

  return { hasCollisions, maxOverlapX, maxOverlapY, collisions };
}

/**
 * Places children of branching nodes (Switch, ForEach) in a tight row directly beneath
 * the parent node, centered under the parent, ordered left-to-right by handle index.
 * Terminal nodes (Respond/Terminate) stay in this row directly under their handles.
 */
function compactBranchChildren(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection
): { nodes: Node[]; edges: Edge[] } {
  const nodeMap = new Map<string, Node>(nodes.map((n) => [n.id, { ...n }]));
  const isTB = direction === "TB";

  const forwardAdj = new Map<string, string[]>();
  edges.forEach((e) => {
    if (!forwardAdj.has(e.source)) forwardAdj.set(e.source, []);
    forwardAdj.get(e.source)!.push(e.target);
  });

  const getReachableNodes = (startId: string, stopIds: Set<string>): Set<string> => {
    const reachable = new Set<string>();
    const queue = [startId];
    reachable.add(startId);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const neighbors = forwardAdj.get(curr) || [];
      for (const next of neighbors) {
        if (!reachable.has(next) && !stopIds.has(next)) {
          reachable.add(next);
          queue.push(next);
        }
      }
    }
    return reachable;
  };

  const branchingNodes = nodes.filter(
    (n) =>
      n.type === "switch" ||
      n.type === "SWITCH_ACTION" ||
      n.type === "FOREACH" ||
      n.type === "FOREACH_ACTION" ||
      edges.filter((e) => e.source === n.id).length > 1
  );

  // Bottom-up: deeper branching nodes aligned first
  branchingNodes.sort((a, b) => (isTB ? b.position.y - a.position.y : b.position.x - a.position.x));

  const updatedEdges = edges.map((e) => ({ ...e }));

  for (const branchNode of branchingNodes) {
    const sourceNode = nodeMap.get(branchNode.id);
    if (!sourceNode) continue;
    const sourceDims = getNodeDimensions(branchNode);

    const outEdges = updatedEdges.filter(
      (e) => e.source === branchNode.id && nodeMap.has(e.target)
    );
    if (outEdges.length <= 1) continue;

    // 1. Sort outgoing edges strictly by physical handle index
    outEdges.sort((a, b) => {
      const idxA = getSourceHandleIndex(sourceNode, a.sourceHandle);
      const idxB = getSourceHandleIndex(sourceNode, b.sourceHandle);
      return idxA - idxB;
    });

    // Annotate edges with branchIndex and totalBranches for staggered edge routing
    outEdges.forEach((edge, idx) => {
      edge.data = {
        ...(edge.data || {}),
        branchIndex: idx,
        totalBranches: outEdges.length,
      };
    });

    // 2. Identify target nodes and their exclusive subtrees
    const targetIds = outEdges.map((e) => e.target);
    const branchItems = outEdges.map((edge) => {
      const targetNode = nodeMap.get(edge.target)!;
      const targetDims = getNodeDimensions(targetNode);
      const otherTargets = new Set(targetIds.filter((id) => id !== targetNode.id));
      const exclusiveSubtree = getReachableNodes(targetNode.id, otherTargets);

      const edgeLabel =
        edge.label ||
        (edge.data as any)?.label ||
        getSwitchCaseLabel(sourceNode, edge.sourceHandle) ||
        "";
      const labelDims = getEdgeLabelDimensions(edgeLabel);

      return {
        edge,
        targetNode,
        targetDims,
        exclusiveSubtree,
        labelDims,
      };
    });

    if (isTB) {
      // Place direct children on the row directly beneath parent
      const targetY = sourceNode.position.y + sourceDims.height + LAYER_GAP;

      // Calculate gaps between adjacent siblings (40px, or label clearance if wide)
      const gaps: number[] = [];
      for (let i = 0; i < branchItems.length - 1; i++) {
        const a = branchItems[i];
        const b = branchItems[i + 1];
        let gap = SIBLING_GAP;
        if (a.labelDims.width > 0 && b.labelDims.width > 0) {
          const neededCenterDist = Math.round((a.labelDims.width + b.labelDims.width) / 2 + 12);
          const currentHalfSum = Math.round((a.targetDims.width + b.targetDims.width) / 2);
          gap = Math.max(SIBLING_GAP, neededCenterDist - currentHalfSum);
        }
        gaps.push(gap);
      }

      // Total width of the children row
      const totalChildrenWidth =
        branchItems.reduce((acc, b) => acc + b.targetDims.width, 0) +
        gaps.reduce((acc, g) => acc + g, 0);

      const parentCenter = sourceNode.position.x + sourceDims.width / 2;
      const startX = Math.round(parentCenter - totalChildrenWidth / 2);

      let currentX = startX;
      branchItems.forEach((b, idx) => {
        const desiredX = currentX;
        const deltaX = desiredX - b.targetNode.position.x;
        const deltaY = targetY - b.targetNode.position.y;

        if (deltaX !== 0 || deltaY !== 0) {
          b.exclusiveSubtree.forEach((nodeId) => {
            const n = nodeMap.get(nodeId);
            if (n) {
              n.position = {
                x: n.position.x + deltaX,
                y: n.position.y + deltaY,
              };
            }
          });
        }

        currentX += b.targetDims.width + (gaps[idx] ?? SIBLING_GAP);
      });
    } else {
      // LR layout: place direct children in a vertical column directly to the right of parent
      // Account for edge labels in the horizontal gap between parent and children
      const maxLabelW = branchItems.reduce((max, b) => Math.max(max, b.labelDims.width), 0);
      const effectiveLayerGap = Math.max(LAYER_GAP, maxLabelW + 50);
      const targetX = sourceNode.position.x + sourceDims.width + effectiveLayerGap;

      // Vertical gaps between adjacent siblings (at least 40px)
      const gaps: number[] = [];
      for (let i = 0; i < branchItems.length - 1; i++) {
        gaps.push(SIBLING_GAP);
      }

      // Total height of the children column
      const totalChildrenHeight =
        branchItems.reduce((acc, b) => acc + b.targetDims.height, 0) +
        gaps.reduce((acc, g) => acc + g, 0);

      const parentCenterY = sourceNode.position.y + sourceDims.height / 2;
      const startY = Math.round(parentCenterY - totalChildrenHeight / 2);

      let currentY = startY;
      branchItems.forEach((b, idx) => {
        const desiredY = currentY;
        const deltaX = targetX - b.targetNode.position.x;
        const deltaY = desiredY - b.targetNode.position.y;

        if (deltaX !== 0 || deltaY !== 0) {
          b.exclusiveSubtree.forEach((nodeId) => {
            const n = nodeMap.get(nodeId);
            if (n) {
              n.position = {
                x: n.position.x + deltaX,
                y: n.position.y + deltaY,
              };
            }
          });
        }

        currentY += b.targetDims.height + (gaps[idx] ?? SIBLING_GAP);
      });
    }
  }

  return {
    nodes: nodes.map((n) => nodeMap.get(n.id) || n),
    edges: updatedEdges,
  };
}

/**
 * Compaction pass: shifts subtrees inward toward their parent's axis
 * as far as collision-free space allows (maintaining at least 40px sibling gap).
 */
function compactionPass(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection
): Node[] {
  const isTB = direction === "TB";
  const nodeMap = new Map<string, Node>(nodes.map((n) => [n.id, { ...n }]));

  const forwardAdj = new Map<string, string[]>();
  const reverseAdj = new Map<string, string[]>();
  edges.forEach((e) => {
    if (!forwardAdj.has(e.source)) forwardAdj.set(e.source, []);
    forwardAdj.get(e.source)!.push(e.target);
    if (!reverseAdj.has(e.target)) reverseAdj.set(e.target, []);
    reverseAdj.get(e.target)!.push(e.source);
  });

  const getReachableNodes = (startId: string, stopIds: Set<string>): Set<string> => {
    const reachable = new Set<string>();
    const queue = [startId];
    reachable.add(startId);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const neighbors = forwardAdj.get(curr) || [];
      for (const next of neighbors) {
        if (!reachable.has(next) && !stopIds.has(next)) {
          reachable.add(next);
          queue.push(next);
        }
      }
    }
    return reachable;
  };

  if (isTB) {
    const sortedNodes = [...nodes].sort((a, b) => a.position.y - b.position.y);

    for (const node of sortedNodes) {
      const parents = reverseAdj.get(node.id) || [];
      if (parents.length !== 1) continue;

      const parent = nodeMap.get(parents[0]);
      if (!parent) continue;

      const parentDims = getNodeDimensions(parent);
      const parentCenter = parent.position.x + parentDims.width / 2;

      const cur = nodeMap.get(node.id)!;
      const curDims = getNodeDimensions(cur);
      const curCenter = cur.position.x + curDims.width / 2;

      const desiredDeltaX = parentCenter - curCenter;
      if (Math.abs(desiredDeltaX) < 10) continue;

      const otherParentChildren = (forwardAdj.get(parent.id) || []).filter((id) => id !== node.id);
      const subtree = getReachableNodes(node.id, new Set(otherParentChildren));

      let safeShift = desiredDeltaX;
      const subtreeSet = subtree;

      nodes.forEach((other) => {
        if (subtreeSet.has(other.id)) return;
        const otherCurrent = nodeMap.get(other.id)!;
        const otherDims = getNodeDimensions(other);

        subtree.forEach((subId) => {
          const sub = nodeMap.get(subId)!;
          const subDims = getNodeDimensions(sub);

          const yOverlap =
            sub.position.y < otherCurrent.position.y + otherDims.height + 8 &&
            sub.position.y + subDims.height + 8 > otherCurrent.position.y;

          if (yOverlap) {
            if (desiredDeltaX > 0 && otherCurrent.position.x > sub.position.x) {
              const maxRight = Math.max(0, otherCurrent.position.x - (sub.position.x + subDims.width + SIBLING_GAP));
              safeShift = Math.min(safeShift, maxRight);
            } else if (desiredDeltaX < 0 && otherCurrent.position.x < sub.position.x) {
              const maxLeft = Math.min(0, (otherCurrent.position.x + otherDims.width + SIBLING_GAP) - sub.position.x);
              safeShift = Math.max(safeShift, maxLeft);
            }
          }
        });
      });

      if (Math.abs(safeShift) >= 10) {
        subtree.forEach((id) => {
          const n = nodeMap.get(id);
          if (n) {
            n.position = { ...n.position, x: Math.round(n.position.x + safeShift) };
          }
        });
      }
    }
  } else {
    // LR compaction: pull single-child subtrees vertically towards parent center Y
    const sortedNodes = [...nodes].sort((a, b) => a.position.x - b.position.x);

    for (const node of sortedNodes) {
      const parents = reverseAdj.get(node.id) || [];
      if (parents.length !== 1) continue;

      const parent = nodeMap.get(parents[0]);
      if (!parent) continue;

      const parentDims = getNodeDimensions(parent);
      const parentCenterY = parent.position.y + parentDims.height / 2;

      const cur = nodeMap.get(node.id)!;
      const curDims = getNodeDimensions(cur);
      const curCenterY = cur.position.y + curDims.height / 2;

      const desiredDeltaY = parentCenterY - curCenterY;
      if (Math.abs(desiredDeltaY) < 10) continue;

      const otherParentChildren = (forwardAdj.get(parent.id) || []).filter((id) => id !== node.id);
      const subtree = getReachableNodes(node.id, new Set(otherParentChildren));

      let safeShift = desiredDeltaY;
      const subtreeSet = subtree;

      nodes.forEach((other) => {
        if (subtreeSet.has(other.id)) return;
        const otherCurrent = nodeMap.get(other.id)!;
        const otherDims = getNodeDimensions(other);

        subtree.forEach((subId) => {
          const sub = nodeMap.get(subId)!;
          const subDims = getNodeDimensions(sub);

          const xOverlap =
            sub.position.x < otherCurrent.position.x + otherDims.width + 8 &&
            sub.position.x + subDims.width + 8 > otherCurrent.position.x;

          if (xOverlap) {
            if (desiredDeltaY > 0 && otherCurrent.position.y > sub.position.y) {
              const maxDown = Math.max(0, otherCurrent.position.y - (sub.position.y + subDims.height + SIBLING_GAP));
              safeShift = Math.min(safeShift, maxDown);
            } else if (desiredDeltaY < 0 && otherCurrent.position.y < sub.position.y) {
              const maxUp = Math.min(0, (otherCurrent.position.y + otherDims.height + SIBLING_GAP) - sub.position.y);
              safeShift = Math.max(safeShift, maxUp);
            }
          }
        });
      });

      if (Math.abs(safeShift) >= 10) {
        subtree.forEach((id) => {
          const n = nodeMap.get(id);
          if (n) {
            n.position = { ...n.position, y: Math.round(n.position.y + safeShift) };
          }
        });
      }
    }
  }

  return nodes.map((n) => nodeMap.get(n.id) || n);
}

/**
 * Minimal-nudge collision pass: detects any overlapping node or label boxes,
 * and nudges only the specific colliding nodes by the minimal amount needed to clear.
 */
function resolveCollisionsWithMinimalNudges(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection = "TB",
  maxIterations = 5
): Node[] {
  let currentNodes = nodes.map((n) => ({ ...n }));
  const isLR = direction === "LR";

  for (let iter = 0; iter < maxIterations; iter++) {
    const { hasCollisions, collisions } = detectCollisions(currentNodes, edges, direction);
    if (!hasCollisions || collisions.length === 0) break;

    const nodeMap = new Map(currentNodes.map((n) => [n.id, n]));

    for (const c of collisions) {
      if (c.type === "node-node") {
        const a = nodeMap.get(c.aId);
        const b = nodeMap.get(c.bId);
        if (!a || !b) continue;

        if (isLR && Math.abs(a.position.x - b.position.x) < 60) {
          const [topNode, bottomNode] = a.position.y <= b.position.y ? [a, b] : [b, a];
          const topDims = getNodeDimensions(topNode);
          const overlap = Math.round(topNode.position.y + topDims.height + SIBLING_GAP - bottomNode.position.y);
          if (overlap > 0) {
            bottomNode.position = { ...bottomNode.position, y: bottomNode.position.y + overlap };
          }
        } else {
          const [leftNode, rightNode] = a.position.x <= b.position.x ? [a, b] : [b, a];
          const leftDims = getNodeDimensions(leftNode);
          const overlap = Math.round(leftNode.position.x + leftDims.width + (isLR ? LAYER_GAP : SIBLING_GAP) - rightNode.position.x);
          if (overlap > 0) {
            rightNode.position = { ...rightNode.position, x: rightNode.position.x + overlap };
          }
        }
      } else if (c.type === "label-label") {
        const edgeAId = c.aId.replace("label-", "");
        const edgeBId = c.bId.replace("label-", "");
        const edgeA = edges.find((e) => e.id === edgeAId);
        const edgeB = edges.find((e) => e.id === edgeBId);
        if (!edgeA || !edgeB) continue;

        const targetA = nodeMap.get(edgeA.target);
        const targetB = nodeMap.get(edgeB.target);
        if (!targetA || !targetB) continue;

        if (isLR) {
          const [, bottomTarget] = targetA.position.y <= targetB.position.y ? [targetA, targetB] : [targetB, targetA];
          const overlap = Math.round((c.overlapY || 24) + 16);
          if (overlap > 0) {
            bottomTarget.position = { ...bottomTarget.position, y: bottomTarget.position.y + overlap };
          }
        } else {
          const [, rightTarget] = targetA.position.x <= targetB.position.x ? [targetA, targetB] : [targetB, targetA];
          const overlap = Math.round(c.overlapX + 16);
          if (overlap > 0) {
            rightTarget.position = { ...rightTarget.position, x: rightTarget.position.x + overlap };
          }
        }
      } else if (c.type === "label-node") {
        const edgeId = c.aId.replace("label-", "");
        const edge = edges.find((e) => e.id === edgeId);
        const obstacle = nodeMap.get(c.bId);
        if (!edge || !obstacle) continue;

        const target = nodeMap.get(edge.target);
        if (!target || target.id === obstacle.id) continue;

        if (isLR) {
          if (target.position.y >= obstacle.position.y) {
            target.position = { ...target.position, y: target.position.y + Math.round((c.overlapY || 20) + 20) };
          } else {
            obstacle.position = { ...obstacle.position, y: obstacle.position.y + Math.round((c.overlapY || 20) + 20) };
          }
        } else {
          if (target.position.x >= obstacle.position.x) {
            target.position = { ...target.position, x: target.position.x + Math.round(c.overlapX + 20) };
          } else {
            obstacle.position = { ...obstacle.position, x: obstacle.position.x + Math.round(c.overlapX + 20) };
          }
        }
      }
    }

    currentNodes = Array.from(nodeMap.values());
  }

  return currentNodes;
}

/**
 * Runs a single layout pass with Dagre using compact layered settings.
 */
function runLayoutPass(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection,
  nodeSep: number,
  rankSep: number
): { nodes: Node[]; edges: Edge[] } {
  const isLR = direction === "LR";
  const maxLabelWidth = edges.reduce((max, e) => {
    const lbl = e.label || (e.data as any)?.label;
    if (!lbl) return max;
    return Math.max(max, getEdgeLabelDimensions(String(lbl)).width);
  }, 0);
  const effectiveRankSep = isLR ? Math.max(rankSep, maxLabelWidth + 50) : rankSep;

  const g = new dagre.graphlib.Graph({ compound: true, multigraph: true });
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: nodeSep,
    ranksep: effectiveRankSep,
    ranker: "network-simplex",
    marginx: 20,
    marginy: 20,
  });

  const nodeMap = new Map<string, Node>();
  nodes.forEach((node) => {
    nodeMap.set(node.id, node);
    const { width, height } = getNodeDimensions(node);
    g.setNode(node.id, { width, height });
  });

  // Group edges by source node to control outgoing branch traversal order
  const outgoingEdgesBySource = new Map<string, Edge[]>();
  edges.forEach((edge) => {
    if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
      if (!outgoingEdgesBySource.has(edge.source)) {
        outgoingEdgesBySource.set(edge.source, []);
      }
      outgoingEdgesBySource.get(edge.source)!.push(edge);
    }
  });

  // Insert edges in handle index order so Dagre respects branch ordering
  outgoingEdgesBySource.forEach((sourceEdges, sourceId) => {
    const sourceNode = nodeMap.get(sourceId);
    const sortedEdges = [...sourceEdges].sort((a, b) => {
      const idxA = getSourceHandleIndex(sourceNode, a.sourceHandle);
      const idxB = getSourceHandleIndex(sourceNode, b.sourceHandle);
      return isLR ? idxA - idxB : idxB - idxA;
    });

    sortedEdges.forEach((edge) => {
      g.setEdge(edge.source, edge.target, {}, edge.id);
    });
  });

  dagre.layout(g);

  const updatedNodes = nodes.map((node) => {
    const layoutNode = g.node(node.id);
    if (!layoutNode) {
      return node;
    }
    const { width, height } = getNodeDimensions(node);
    return {
      ...node,
      position: {
        x: Math.round(layoutNode.x - width / 2),
        y: Math.round(layoutNode.y - height / 2),
      },
    };
  });

  return { nodes: updatedNodes, edges };
}

/**
 * Places the End node one layer past the furthest node, centered on the terminal nodes
 * (or on Start when there are none), so ghost edges stay short and the graph stays compact.
 */
function placeEndNode(
  endNode: Node,
  laidOutNodes: Node[],
  edges: Edge[],
  direction: LayoutDirection
): Node {
  const isLR = direction === "LR";
  const { width, height } = getNodeDimensions(endNode);
  const terminalIds = new Set(getTerminalNodes(laidOutNodes, edges).map((n) => n.id));
  const anchors = laidOutNodes.filter((n) => terminalIds.has(n.id));
  const anchorNodes = anchors.length > 0 ? anchors : laidOutNodes.filter((n) => isStartNodeId(n.id));
  const centerNodes = anchorNodes.length > 0 ? anchorNodes : laidOutNodes;

  let crossMin = Infinity;
  let crossMax = -Infinity;
  centerNodes.forEach((n) => {
    const dims = getNodeDimensions(n);
    const start = isLR ? n.position.y : n.position.x;
    const size = isLR ? dims.height : dims.width;
    crossMin = Math.min(crossMin, start);
    crossMax = Math.max(crossMax, start + size);
  });
  const crossCenter = (crossMin + crossMax) / 2;

  const mainMax = laidOutNodes.reduce((max, n) => {
    const dims = getNodeDimensions(n);
    return Math.max(max, isLR ? n.position.x + dims.width : n.position.y + dims.height);
  }, -Infinity);

  return {
    ...endNode,
    position: isLR
      ? { x: Math.round(mainMax + LAYER_GAP), y: Math.round(crossCenter - height / 2) }
      : { x: Math.round(crossCenter - width / 2), y: Math.round(mainMax + LAYER_GAP) },
  };
}

/**
 * Arranges nodes and edges using a compact, collision-free layered layout:
 * 1. Layered Dagre pass with tight 40px sibling gap and 60px layer gap (network-simplex).
 * 2. Compact branch children: direct children in a tight row (TB) or column (LR) centered under/beside parent.
 * 3. Compaction pass: subtrees shifted inward toward parent axis.
 * 4. Minimal-nudge collision pass: resolve any remaining collisions locally without inflating global spacing.
 */
export function calculateAutoLayout(
  nodes: Node[],
  edges: Edge[],
  options: AutoLayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } {
  if (!nodes || nodes.length === 0) {
    return { nodes: [], edges };
  }

  const direction: LayoutDirection = options.direction || "TB";
  const nodeSep = options.nodeSep ?? SIBLING_GAP;
  const rankSep = options.rankSep ?? LAYER_GAP;

  // The End node is connected (via ghost edges) to every terminal node. Feeding those
  // edges into the layered/compaction passes drags End along with every subtree shift
  // and widens the graph with long dummy edges, so End is laid out separately below.
  // Callers may pass edges with or without ghost edges, so every edge into End is
  // stripped here to keep the result identical either way.
  const endNode = nodes.find((n) => isEndNode(n));
  const layoutNodes = endNode ? nodes.filter((n) => n.id !== endNode.id) : nodes;
  const layoutEdges = endNode ? edges.filter((e) => e.target !== endNode.id) : edges;
  const endEdges = endNode ? edges.filter((e) => e.target === endNode.id) : [];
  if (layoutNodes.length === 0) {
    return { nodes, edges };
  }

  // 1. Layered layout pass with compact spacing
  const { nodes: initialNodes, edges: initialEdges } = runLayoutPass(layoutNodes, layoutEdges, direction, nodeSep, rankSep);

  // 2. Compact branch children in tight rows centered under parent
  const { nodes: compactNodes, edges: branchEdges } = compactBranchChildren(initialNodes, initialEdges, direction);

  // 3. Compaction pass: pull subtrees toward parent axis
  const compactedNodes = compactionPass(compactNodes, branchEdges, direction);

  // 4. Minimal-nudge collision resolution: clear any overlapping boxes locally
  const finalNodes = resolveCollisionsWithMinimalNudges(compactedNodes, branchEdges, direction);

  if (endNode) {
    finalNodes.push(placeEndNode(endNode, finalNodes, layoutEdges, direction));
  }

  const nodesWithPositions = finalNodes.map((n) => ({
    ...n,
    sourcePosition: direction === "LR" ? "right" : "bottom",
    targetPosition: direction === "LR" ? "left" : "top",
  }));

  return { nodes: nodesWithPositions, edges: [...branchEdges, ...endEdges] };
}
