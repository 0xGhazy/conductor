import type {
  WeaverDataFieldType,
  WeaverFilterOperator,
} from "../WeaverDataExplorer/WeaverDataExplorer.types";

export interface OperatorOption {
  value: WeaverFilterOperator;
  label: string;
  noValue?: boolean;
}

export const OPERATOR_LABELS: Record<WeaverFilterOperator, string> = {
  contains: "contains",
  notContains: "does not contain",
  equals: "equals",
  notEquals: "does not equal",
  startsWith: "starts with",
  endsWith: "ends with",
  greaterThan: "> (greater than)",
  greaterThanOrEqual: ">= (greater or equal)",
  lessThan: "< (less than)",
  lessThanOrEqual: "<= (less or equal)",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
  before: "before",
  after: "after",
  beforeOrEqual: "on or before",
  afterOrEqual: "on or after",
  in: "in list",
  notIn: "not in list",
};

export function getOperatorsForFieldType(
  type: WeaverDataFieldType = "string"
): OperatorOption[] {
  switch (type) {
    case "number":
      return [
        { value: "equals", label: "equals" },
        { value: "notEquals", label: "does not equal" },
        { value: "greaterThan", label: "> (greater than)" },
        { value: "greaterThanOrEqual", label: ">= (greater or equal)" },
        { value: "lessThan", label: "< (less than)" },
        { value: "lessThanOrEqual", label: "<= (less or equal)" },
        { value: "isEmpty", label: "is empty", noValue: true },
        { value: "isNotEmpty", label: "is not empty", noValue: true },
      ];

    case "date":
    case "datetime":
      return [
        { value: "equals", label: "on (equals)" },
        { value: "before", label: "before" },
        { value: "after", label: "after" },
        { value: "beforeOrEqual", label: "on or before" },
        { value: "afterOrEqual", label: "on or after" },
        { value: "isEmpty", label: "is empty", noValue: true },
        { value: "isNotEmpty", label: "is not empty", noValue: true },
      ];

    case "boolean":
      return [
        { value: "equals", label: "is" },
        { value: "notEquals", label: "is not" },
      ];

    case "enum":
      return [
        { value: "equals", label: "equals" },
        { value: "notEquals", label: "does not equal" },
        { value: "in", label: "is any of" },
        { value: "notIn", label: "is none of" },
        { value: "isEmpty", label: "is empty", noValue: true },
        { value: "isNotEmpty", label: "is not empty", noValue: true },
      ];

    case "string":
    case "custom":
    default:
      return [
        { value: "contains", label: "contains" },
        { value: "notContains", label: "does not contain" },
        { value: "equals", label: "equals" },
        { value: "notEquals", label: "does not equal" },
        { value: "startsWith", label: "starts with" },
        { value: "endsWith", label: "ends with" },
        { value: "isEmpty", label: "is empty", noValue: true },
        { value: "isNotEmpty", label: "is not empty", noValue: true },
      ];
  }
}

let filterCounter = 0;
export function generateFilterId(): string {
  filterCounter += 1;
  return `filter_${Date.now()}_${filterCounter}`;
}

export function formatDisplayValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}
