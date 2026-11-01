import type { BaseActionConfig, WeaverActionNodeData } from "@/features/designer/types/nodeData";

export interface RuleCondition {
  field: string;
  operator: string;
  value?: any;
  message?: string;
  failureMessage?: string;
}

export type RuleItem = RuleCondition | "AND" | "OR";

export interface RuleEngineConfig extends BaseActionConfig {
  rules?: RuleItem[];
}

export interface RuleEngineNodeData extends WeaverActionNodeData<RuleEngineConfig> {
  action?: string;
}

export const generateRuleEngineReferenceName = (): string => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 8; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `rule_${suffix}`;
};

export const exportRuleEngineActionData = (
  nodeData: RuleEngineNodeData,
  id?: string,
  _position?: { x: number; y: number }
) => {
  const cfg = nodeData?.config ?? {};
  const refName = cfg.name ?? cfg.referenceName ?? cfg.reference ?? "rule";
  const rules = cfg.rules ?? [];

  return {
    name: "RuleEngineWorker",
    taskReferenceName: refName,
    inputParameters: {
      rules: rules,
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
