import type { BaseActionConfig, WeaverActionNodeData } from "@/features/designer/types/nodeData";

export interface ValidationRuleCondition {
  field: string;
  operator: string;
  value?: any;
  message?: string;
  failureMessage?: string;
}

export type RuleItem = ValidationRuleCondition | "AND" | "OR";
export type ValidationRuleItem = RuleItem;

export interface ValidationConfig extends BaseActionConfig {
  inputParameters?: Record<string, any>;
  validationRules?: ValidationRuleItem[];
  rules?: ValidationRuleItem[];
  config?: ValidationRuleItem[];
}

export interface ValidationNodeData extends WeaverActionNodeData<ValidationConfig> {
  action?: string;
}

export const generateValidationReferenceName = (): string => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 8; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `validation_${suffix}`;
};

const normalizeRuleFieldReference = (
  field: any,
  nodeId: string | undefined,
  refName: string
) => {
  if (typeof field !== "string" || !nodeId || !refName) return field;
  return field.replace(`\${${nodeId}.`, `\${${refName}.`);
};

const normalizeValidationRuleReferences = (
  rules: ValidationRuleItem[],
  nodeId: string | undefined,
  refName: string
) =>
  rules.map((item) => {
    if (!item || typeof item === "string") return item;
    return {
      ...item,
      field: normalizeRuleFieldReference(item.field, nodeId, refName),
    };
  });

export const exportValidationActionData = (
  nodeData: ValidationNodeData,
  nodeId?: string,
  _position?: { x?: number | string; y?: number | string }
) => {
  const cfg = nodeData?.config ?? {};
  const refName = String(cfg.taskReferenceName ?? cfg.referenceName ?? cfg.reference ?? cfg.name ?? "validation").trim() || "validation";
  const rawRules = cfg.validationRules ?? cfg.rules ?? cfg.config ?? [];
  const rules = normalizeValidationRuleReferences(rawRules, nodeId, refName);

  return {
    name: "ValidationWorker",
    taskReferenceName: refName,
    inputParameters: {
      rules,
    },
    type: "SIMPLE",
  };
};

export interface OperatorOption {
  value: string;
  label: string;
}

export interface OperatorGroup {
  category: string;
  operators: OperatorOption[];
}

export const OPERATOR_GROUPS: OperatorGroup[] = [
  {
    category: "Comparison",
    operators: [
      { value: "==", label: "== (Equals)" },
      { value: "!=", label: "!= (Not Equals)" },
      { value: ">", label: "> (Greater Than)" },
      { value: ">=", label: ">= (Greater Than or Equal)" },
      { value: "<", label: "< (Less Than)" },
      { value: "<=", label: "<= (Less Than or Equal)" },
    ],
  },
  {
    category: "Collection & Membership",
    operators: [
      { value: "IN", label: "IN (Contains Value in List)" },
      { value: "NOT_IN", label: "NOT_IN (Not In List)" },
      { value: "UNIQUE", label: "UNIQUE (All Elements Unique)" },
    ],
  },
  {
    category: "String & Format Validations",
    operators: [
      { value: "MATCH", label: "MATCH (Regex Pattern)" },
      { value: "EMAIL", label: "EMAIL (Valid Email Address)" },
      { value: "NUMERIC", label: "NUMERIC (Digits Only)" },
      { value: "ALPHANUMERIC", label: "ALPHANUMERIC (Letters & Digits)" },
    ],
  },
  {
    category: "Nullability & Presence",
    operators: [
      { value: "NULL", label: "NULL (Is Null)" },
      { value: "NOT_NULL", label: "NOT_NULL (Is Not Null)" },
      { value: "EMPTY", label: "EMPTY (Is Blank / Empty)" },
      { value: "NOT_EMPTY", label: "NOT_EMPTY (Is Non-Empty)" },
    ],
  },
  {
    category: "Data Structure Type",
    operators: [
      { value: "IS_MAP", label: "IS_MAP (Object Map / Dictionary)" },
      { value: "IS_ARRAY", label: "IS_ARRAY (List / Collection)" },
    ],
  },
  {
    category: "Numeric Sign",
    operators: [
      { value: "POSITIVE", label: "POSITIVE (Number > 0)" },
      { value: "NEGATIVE", label: "NEGATIVE (Number < 0)" },
    ],
  },
];

export const UNARY_OPERATORS: string[] = [
  "NULL", "NOT_NULL", "EMPTY", "NOT_EMPTY",
  "NUMERIC", "ALPHANUMERIC", "EMAIL",
  "IS_MAP", "IS_ARRAY", "UNIQUE", "POSITIVE", "NEGATIVE"
];
