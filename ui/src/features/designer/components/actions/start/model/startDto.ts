export interface StartActionConfig {
  name?: string;
  version?: number | string;
  description?: string;
  timeoutSeconds?: number | null;
  timeoutPolicy?: string;
  language?: string;
  inputDefinitions?: any[];
  inputParameters?: Record<string, any>;
  variables?: Record<string, any>;
  [key: string]: unknown;
}

export interface StartNodeData {
  name?: string;
  config?: StartActionConfig;
  [key: string]: unknown;
}

export const getStartDisplayName = (data?: StartNodeData | null): string => {
  const displayName = String(data?.name || "").trim();
  return displayName || "Start";
};
