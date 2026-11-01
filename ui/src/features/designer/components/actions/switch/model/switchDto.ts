import type { BaseActionConfig, WeaverActionNodeData } from "@/features/designer/types/nodeData";

export const CASE_COLORS = [
  "#4f46e5",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
];

export type SwitchEvaluatorType = "value-param" | "javascript";

export interface SwitchCase {
  id?: string;
  value?: string;
  label?: string;
  [key: string]: unknown;
}

export interface SwitchInputParameters {
  switchCaseValue?: unknown;
  [key: string]: unknown;
}

export interface SwitchActionConfig extends BaseActionConfig {
  nodeName?: string;
  evaluatorType?: SwitchEvaluatorType | string;
  expression?: string;
  inputParameters?: SwitchInputParameters;
  cases?: SwitchCase[];
  decisionCases?: Record<string, unknown[]>;
  defaultCase?: unknown[];
  type?: string;
}

export interface SwitchNodeData extends WeaverActionNodeData<SwitchActionConfig> {}

export interface NodePosition {
  x?: string | number;
  y?: string | number;
}

export interface SwitchCaseHandle {
  id: string;
  key: string;
  label: string;
  leftPercent: number;
  color: string;
  isDefault?: boolean;
}

export const createDefaultSwitchCase = (index = 0): SwitchCase => ({
  id: `case-${Date.now()}`,
  value: `case_${index + 1}`,
  label: `Case ${index + 1}`,
});

export const createDefaultSwitchConfig = (data?: SwitchNodeData | null): SwitchActionConfig => ({
  taskReferenceName: data?.name ?? "Switch",
  evaluatorType: "value-param",
  expression: "",
  inputParameters: { switchCaseValue: "switchCaseValue" },
  cases: [
    {
      id: `case-${Date.now()}`,
      value: "case1",
      label: "Case 1",
    },
  ],
  decisionCases: { case1: [] },
  defaultCase: [],
});

export const generateSwitchReferenceName = (): string => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 8; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `switch_${suffix}`;
};

export const getCaseValue = (caseData?: SwitchCase, index = 0): string => {
  const raw = typeof caseData?.value === "string" ? caseData.value.trim() : "";
  return raw || `case_${index + 1}`;
};

export const buildDecisionCases = (cases?: SwitchCase[]): Record<string, unknown[]> => {
  const out: Record<string, unknown[]> = {};
  (cases || []).forEach((caseData, index) => {
    const key = getCaseValue(caseData, index);
    out[key] = [];
  });
  return out;
};

export const normalizeCases = (cfg?: SwitchActionConfig | { config?: SwitchActionConfig } | null): SwitchCase[] => {
  const rawCases =
    (cfg as SwitchActionConfig | undefined)?.cases ??
    (cfg as { config?: SwitchActionConfig } | undefined)?.config?.cases;
  if (Array.isArray(rawCases) && rawCases.length) return rawCases;

  const decisionCases =
    (cfg as SwitchActionConfig | undefined)?.decisionCases ??
    (cfg as { config?: SwitchActionConfig } | undefined)?.config?.decisionCases;
  if (!decisionCases || typeof decisionCases !== "object") return [];

  return Object.keys(decisionCases).map((key, index) => ({
    id: `case-${index}`,
    value: key,
    label: "",
  }));
};

export const buildSwitchDraftData = (data?: SwitchNodeData | null): SwitchNodeData => {
  const existingRefName = String(
    data?.config?.name ?? data?.config?.referenceName ?? data?.config?.taskReferenceName ?? ""
  ).trim();
  const defaultRef = existingRefName || generateSwitchReferenceName();

  return {
    ...(data ?? {}),
    name: data?.name || "Switch",
    config: {
      ...(data?.config ?? createDefaultSwitchConfig(data)),
      name: defaultRef,
      referenceName: defaultRef,
      taskReferenceName: defaultRef,
    },
  };
};

export const buildSwitchCaseHandles = (
  nodeId: string,
  cases: SwitchCase[]
): SwitchCaseHandle[] => {
  const count = cases.length + 1;
  const handles: SwitchCaseHandle[] = cases.map((caseData, index) => {
    const leftPercent = ((index + 1) / (count + 1)) * 100;
    const baseId = caseData.id || `case-${index}`;
    const caseValue = getCaseValue(caseData, index);
    return {
      id: baseId,
      key: `${nodeId}-${baseId}`,
      label: caseData.label?.trim() || caseValue,
      leftPercent,
      color: CASE_COLORS[index % CASE_COLORS.length],
    };
  });

  handles.push({
    id: "default",
    key: `${nodeId}-default`,
    label: "default",
    leftPercent: ((cases.length + 1) / (count + 1)) * 100,
    color: CASE_COLORS[(cases.length + 1) % CASE_COLORS.length],
    isDefault: true,
  });

  return handles;
};

export const exportSwitchActionData = (
  data?: SwitchNodeData | null,
  id?: string,
  position: NodePosition = {}
) => {
  const cfg = data?.config || {};
  const refName =
    cfg.name ||
    cfg.referenceName ||
    cfg.taskReferenceName ||
    (data?.name && data.name !== "SWITCH" && data.name !== "Switch" ? data.name : null) ||
    `switch_${id || "ref"}`;

  const rawCases = cfg.cases || [];
  const decisionCases: Record<string, unknown[]> = {};
  if (Array.isArray(rawCases) && rawCases.length > 0) {
    rawCases.forEach((caseData, index) => {
      const key = getCaseValue(caseData, index);
      decisionCases[key] = cfg.decisionCases?.[key] || [];
    });
  } else if (cfg.decisionCases && typeof cfg.decisionCases === "object") {
    Object.keys(cfg.decisionCases).forEach((key) => {
      decisionCases[key] = cfg.decisionCases?.[key] || [];
    });
  }

  const evaluatorType = cfg.evaluatorType || "value-param";
  const expression =
    evaluatorType === "value-param"
      ? "switchCaseValue"
      : cfg.expression || "";

  const switchCaseValue =
    cfg.inputParameters?.switchCaseValue !== undefined
      ? cfg.inputParameters.switchCaseValue
      : "${workflow.input}";

  const inputParameters = {
    switchCaseValue,
  };

  return {
    name: "switch",
    taskReferenceName: refName,
    inputParameters,
    type: "SWITCH",
    decisionCases,
    defaultCase: cfg.defaultCase || [],
    evaluatorType,
    expression,
  };
};
