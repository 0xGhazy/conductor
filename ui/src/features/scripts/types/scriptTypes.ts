import type { WeaverEditorLanguage } from "@/components/common/editors";
export type ScriptLanguage = "JEXL" | "JAVA_SCRIPT" | "PYTHON";

export type VariablesMap = Record<string, unknown>;

export interface ScriptDefinition {
  id: string;
  name: string;
  description?: string;
  script: string;
  language: ScriptLanguage;
  variables?: VariablesMap;
  timeout?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScriptPage {
  content: ScriptDefinition[];
  page: number;
  size: number;
  numberOfElements: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface ScriptListParams {
  page: number;
  size: number;
  search?: string;
  language?: ScriptLanguage;
}

export interface ScriptBulkDeleteResult {
  deletedCount: number;
  ids: string[];
}

export interface ScriptDefinitionPayload {
  name: string;
  description: string;
  script: string;
  language: ScriptLanguage;
  variables: VariablesMap;
  timeout: number;
}

export interface ScriptExecutionPayload {
  script: string;
  language: ScriptLanguage;
  variables: VariablesMap;
  timeout: number;
}

export interface ScriptExecutionResult {
  code?: string;
  reason?: string;
  output?: unknown;
  status?: "SUCCESS" | "FAILED" | string;
  message?: string;
  executionTime?: number;
}

export interface ApiEnvelope<T> {
  data?: T;
  message?: string;
  status?: number;
  details?: unknown;
}

export interface ScriptLanguageOption {
  value: ScriptLanguage;
  label: string;
  editorLanguage: WeaverEditorLanguage;
}
