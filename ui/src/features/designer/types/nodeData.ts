/**
 * Shared generic interfaces and utility types for Weaver Action Nodes on the React Flow canvas.
 */

export interface BaseActionConfig {
  name?: string;
  referenceName?: string;
  taskReferenceName?: string;
  reference?: string;
  [key: string]: unknown;
}

export interface WeaverActionNodeData<TConfig extends BaseActionConfig = BaseActionConfig> {
  id?: string;
  name?: string;
  kind?: string;
  config?: TConfig;
  [key: string]: unknown;
}

export interface WeaverActionNodeProps<TData extends WeaverActionNodeData = WeaverActionNodeData> {
  id: string;
  data: TData;
  parameterOptions?: Array<string | { value?: string; label?: string; id?: string }>;
}

/**
 * Resolves the effective task reference name from an action config object.
 */
export function getActionConfigReferenceName(config?: BaseActionConfig | null): string {
  if (!config) return "";
  return String(
    config.taskReferenceName ??
    config.referenceName ??
    config.reference ??
    config.name ??
    ""
  ).trim();
}

/**
 * Merges a partial data update into a WeaverActionNodeData object cleanly.
 */
export function mergeActionNodeData<TData extends WeaverActionNodeData<any>>(
  baseData: TData | null | undefined,
  patch: Partial<TData>
): TData {
  const prevData = baseData ?? ({} as TData);
  const prevConfig = prevData.config ?? {};
  const nextConfig = patch.config ?? {};

  return {
    ...prevData,
    ...patch,
    config: {
      ...prevConfig,
      ...nextConfig,
    },
  };
}
