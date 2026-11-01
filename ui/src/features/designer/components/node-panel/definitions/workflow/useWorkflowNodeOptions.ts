import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import apiClient from "@/services/apiClient";
import { config } from "@/config/appConfig";
import { fetchWorkflowJsonByName } from "@/features/designer/services/designerApi";
import type { WorkflowSummaryItem } from "./WorkflowNodeConfig.types";

/**
 * Derives a clean JSON input template object from a workflow definition or summary.
 * Follows the backend NewShortDetailedWorkflow / Conductor input parameter structure.
 * E.g., keys with empty strings: { customerId: "", phoneNumber: "", source: "" }
 */
export function deriveWorkflowInputTemplate(definition: any): Record<string, any> {
  if (!definition) return {};

  const template: Record<string, any> = {};

  // 1. Direct input map (from /api/workflows/list or NewShortDetailedWorkflow)
  const directInput = definition.input ?? definition.inputs ?? definition.workflowInput;
  if (directInput && typeof directInput === "object" && !Array.isArray(directInput)) {
    Object.entries(directInput).forEach(([key, val]) => {
      const trimmed = String(key || "").trim();
      if (trimmed) {
        template[trimmed] = val !== undefined && val !== null ? val : "";
      }
    });
  }

  // 2. Conductor inputParameters (can be array of parameter names or object map)
  const inputParams = definition.inputParameters ?? definition.jsonData?.inputParameters;
  if (Array.isArray(inputParams)) {
    inputParams.forEach((param) => {
      const trimmed = String(param || "").trim();
      if (trimmed && !(trimmed in template)) {
        template[trimmed] = "";
      }
    });
  } else if (inputParams && typeof inputParams === "object") {
    Object.entries(inputParams).forEach(([key, val]) => {
      const trimmed = String(key || "").trim();
      if (trimmed && !(trimmed in template)) {
        template[trimmed] = val !== undefined && val !== null ? val : "";
      }
    });
  }

  // 3. Workflow variables
  const variables = definition.variables ?? definition.jsonData?.variables;
  if (variables && typeof variables === "object" && !Array.isArray(variables)) {
    Object.entries(variables).forEach(([key, val]) => {
      const trimmed = String(key || "").trim();
      if (trimmed && !(trimmed in template)) {
        template[trimmed] = val !== undefined && val !== null ? val : "";
      }
    });
  }

  // 4. Conductor definition inputs (string array)
  const inputsArray = definition.inputs;
  if (Array.isArray(inputsArray)) {
    inputsArray.forEach((key) => {
      const trimmed = String(key || "").trim();
      if (trimmed && !(trimmed in template)) {
        template[trimmed] = "";
      }
    });
  }

  return template;
}

export interface UseWorkflowNodeOptionsResult {
  workflows: WorkflowSummaryItem[];
  workflowOptions: { value: string; label: string }[];
  versionOptions: { value: string; label: string }[];
  loadingWorkflows: boolean;
  loadingVersions: boolean;
  loadingInputs: boolean;
  workflowError: string | null;
  versionError: string | null;
  inputsError: string | null;
  getGreatestVersion: (workflowName: string) => number | null;
  resolveInputsForWorkflow: (
    workflowName: string,
    version: number | null
  ) => Promise<Record<string, any>>;
  refetchWorkflows: () => Promise<void>;
}

export function useWorkflowNodeOptions(
  selectedWorkflowName?: string | null,
  selectedVersion?: number | null
): UseWorkflowNodeOptionsResult {
  const [workflows, setWorkflows] = useState<WorkflowSummaryItem[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);

  const [loadingInputs, setLoadingInputs] = useState(false);
  const [inputsError, setInputsError] = useState<string | null>(null);

  // In-memory definition cache to avoid redundant network round-trips
  const definitionCacheRef = useRef<Map<string, any>>(new Map());

  // Tracks active request identity to prevent stale async overwrites
  const activeRequestIdRef = useRef<number>(0);

  // Load workflow catalog on mount
  const loadWorkflows = useCallback(async () => {
    setLoadingWorkflows(true);
    setWorkflowError(null);

    try {
      const res = await apiClient.get(`${config.apiBaseUrl}/api/workflows/list`);
      const body = res?.data;
      const data = Array.isArray(body?.data)
        ? body.data
        : Array.isArray(body)
        ? body
        : [];

      const parsed: WorkflowSummaryItem[] = data.map((item: any) => ({
        id: item.id ? String(item.id) : undefined,
        name: String(item.name || item.workflowName || "").trim(),
        version: Number(item.version) || 1,
        input: item.input && typeof item.input === "object" ? item.input : {},
        description: item.description ? String(item.description).trim() : undefined,
      })).filter((item: WorkflowSummaryItem) => Boolean(item.name));

      setWorkflows(parsed);
    } catch (err: any) {
      // Fallback: attempt /api/metadata/workflow
      try {
        const fallbackRes = await apiClient.get(
          `${config.apiBaseUrl}/api/metadata/workflow`
        );
        const fallbackBody = fallbackRes?.data;
        const fallbackData = Array.isArray(fallbackBody?.data)
          ? fallbackBody.data
          : Array.isArray(fallbackBody)
          ? fallbackBody
          : [];

        const parsed: WorkflowSummaryItem[] = fallbackData.map((item: any) => ({
          name: String(item.name || item.workflowName || "").trim(),
          version: Number(item.version) || 1,
          description: item.description ? String(item.description).trim() : undefined,
        })).filter((item: WorkflowSummaryItem) => Boolean(item.name));

        setWorkflows(parsed);
      } catch (fallbackErr: any) {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load workflows list.";
        setWorkflowError(message);
        setWorkflows([]);
      }
    } finally {
      setLoadingWorkflows(false);
    }
  }, []);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  // Derived unique workflow name options sorted alphabetically
  const workflowOptions = useMemo(() => {
    const uniqueNames = Array.from(
      new Set(workflows.map((w) => w.name).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    const options = uniqueNames.map((name) => ({
      value: name,
      label: name,
    }));

    if (
      selectedWorkflowName &&
      !options.some((o) => o.value === selectedWorkflowName)
    ) {
      options.unshift({
        value: selectedWorkflowName,
        label: selectedWorkflowName,
      });
    }

    return options;
  }, [workflows, selectedWorkflowName]);

  // Derived available versions for the selected workflow (sorted descending by version number)
  const versionOptions = useMemo(() => {
    if (!selectedWorkflowName) {
      return [];
    }

    const matchingVersions = workflows
      .filter((w) => w.name === selectedWorkflowName)
      .map((w) => w.version)
      .filter((v) => Number.isFinite(v));

    const distinctVersions = Array.from(new Set(matchingVersions)).sort(
      (a, b) => b - a
    );

    const options = distinctVersions.map((v) => ({
      value: String(v),
      label: String(v),
    }));

    if (
      selectedVersion != null &&
      !options.some((o) => o.value === String(selectedVersion))
    ) {
      options.push({
        value: String(selectedVersion),
        label: String(selectedVersion),
      });
      options.sort((a, b) => Number(b.value) - Number(a.value));
    }

    return options;
  }, [workflows, selectedWorkflowName, selectedVersion]);

  // Compute the greatest version number for a workflow
  const getGreatestVersion = useCallback(
    (workflowName: string): number | null => {
      const trimmed = String(workflowName || "").trim();
      if (!trimmed) return null;

      const matchingVersions = workflows
        .filter((w) => w.name === trimmed)
        .map((w) => w.version)
        .filter((v) => Number.isFinite(v));

      if (matchingVersions.length === 0) return null;
      return Math.max(...matchingVersions);
    },
    [workflows]
  );

  // Resolve input template for a workflow + version with stale request safety
  const resolveInputsForWorkflow = useCallback(
    async (
      workflowName: string,
      version: number | null
    ): Promise<Record<string, any>> => {
      const normalizedName = String(workflowName || "").trim();
      if (!normalizedName) return {};

      const requestId = ++activeRequestIdRef.current;
      const cacheKey = `${normalizedName}@${version ?? "latest"}`;

      // Check cache first
      if (definitionCacheRef.current.has(cacheKey)) {
        return definitionCacheRef.current.get(cacheKey);
      }

      // Check if workflow list summary already contains the inputs
      const matchInList = workflows.find((w) => {
        if (w.name !== normalizedName) return false;
        if (version != null) return w.version === version;
        return true;
      });

      if (matchInList?.input && Object.keys(matchInList.input).length > 0) {
        const template = deriveWorkflowInputTemplate(matchInList);
        definitionCacheRef.current.set(cacheKey, template);
        return template;
      }

      setLoadingInputs(true);
      setInputsError(null);

      try {
        const response = await fetchWorkflowJsonByName(
          normalizedName,
          version != null ? version : null
        );

        // Stale response safety: discard if another request started after this one
        if (requestId !== activeRequestIdRef.current) {
          return {};
        }

        const data = response?.data ?? response;
        const template = deriveWorkflowInputTemplate(data);

        definitionCacheRef.current.set(cacheKey, template);
        return template;
      } catch (err: any) {
        if (requestId === activeRequestIdRef.current) {
          const msg =
            err?.response?.data?.message ||
            err?.message ||
            `Failed to resolve inputs for workflow "${normalizedName}".`;
          setInputsError(msg);
        }
        return {};
      } finally {
        if (requestId === activeRequestIdRef.current) {
          setLoadingInputs(false);
        }
      }
    },
    [workflows]
  );

  return {
    workflows,
    workflowOptions,
    versionOptions,
    loadingWorkflows,
    loadingVersions,
    loadingInputs,
    workflowError,
    versionError,
    inputsError,
    getGreatestVersion,
    resolveInputsForWorkflow,
    refetchWorkflows: loadWorkflows,
  };
}
