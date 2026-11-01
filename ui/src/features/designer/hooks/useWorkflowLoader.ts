import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { useWeaverNotification } from "@/components/common/notifications";
import { fetchWorkflowJsonByName } from "@/features/designer/services/designerApi";
import { extractWorkflowJsonDataFromResponse } from "@/features/designer/utils/workflowSerialization";

export function useWorkflowLoader({
  applyLoadedWorkflowTopology,
  applyImportedWorkflowDraft,
}: {
  applyLoadedWorkflowTopology: (args: any) => void;
  applyImportedWorkflowDraft: (json: any) => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { workflowId: workflowIdFromPath } = useParams();
  const { error: showErrorNotification } = useWeaverNotification();

  const replaceConfirmOpen = useDesignerStore((s) => s.replaceConfirmOpen);
  const pendingReplaceAction = useDesignerStore((s) => s.pendingReplaceAction);
  const setReplaceConfirmOpen = useDesignerStore((s) => s.setReplaceConfirmOpen);
  const setReplaceConfirmContext = useDesignerStore((s) => s.setReplaceConfirmContext);
  const setPendingReplaceAction = useDesignerStore((s) => s.setPendingReplaceAction);

  const lastRouteWorkflowLoadKeyRef = useRef("");

  const applyLoadedWorkflowTopologyRef = useRef(applyLoadedWorkflowTopology);
  useEffect(() => {
    applyLoadedWorkflowTopologyRef.current = applyLoadedWorkflowTopology;
  });

  const applyImportedWorkflowDraftRef = useRef(applyImportedWorkflowDraft);
  useEffect(() => {
    applyImportedWorkflowDraftRef.current = applyImportedWorkflowDraft;
  });

  // Handle imported workflow JSON from navigation state
  useEffect(() => {
    const importedWorkflowJson = (location.state as any)?.importedWorkflowJson;
    if (!importedWorkflowJson || replaceConfirmOpen || pendingReplaceAction) return;

    setReplaceConfirmContext("import");
    setPendingReplaceAction(() => () => {
      applyImportedWorkflowDraftRef.current(importedWorkflowJson);
      navigate(location.pathname + location.search, { replace: true, state: null });
    });
    setReplaceConfirmOpen(true);
  }, [
    location.pathname,
    location.search,
    location.state,
    navigate,
    replaceConfirmOpen,
    pendingReplaceAction,
    setReplaceConfirmContext,
    setPendingReplaceAction,
    setReplaceConfirmOpen,
  ]);

  // Handle URL route workflow loading
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const workflowNameParam = String(
      workflowIdFromPath || params.get("workflowName") || params.get("name") || ""
    ).trim();
    if (!workflowNameParam || replaceConfirmOpen || pendingReplaceAction) return;

    const versionParamRaw = String(params.get("version") || "").trim();
    const requestedVersion =
      versionParamRaw === "" ? null : Number.isNaN(Number(versionParamRaw))
        ? versionParamRaw
        : Number(versionParamRaw);
    const routeLoadKey = `${workflowNameParam}::${String(requestedVersion ?? "")}`;

    if (lastRouteWorkflowLoadKeyRef.current === routeLoadKey) return;

    let cancelled = false;
    const loadWorkflow = async () => {
      try {
        const response = await fetchWorkflowJsonByName(workflowNameParam, requestedVersion);
        if (cancelled) return;

        const workflowJson = extractWorkflowJsonDataFromResponse(response);
        const resolvedVersion = workflowJson?.version ?? requestedVersion;
        const resolvedKey = `${workflowNameParam}::${String(resolvedVersion ?? "")}`;

        // Mark the resolved route key as loaded so subsequent navigation does not re-fetch
        lastRouteWorkflowLoadKeyRef.current = resolvedKey;

        applyLoadedWorkflowTopologyRef.current({
          topology: workflowJson,
          workflowNameParam,
          requestedVersion,
          routeLoadKey: resolvedKey,
        });
      } catch (error: any) {
        if (cancelled) return;
        lastRouteWorkflowLoadKeyRef.current = "";
        showErrorNotification(
          `Failed to load workflow from backend: ${error?.message || "Unknown error."}`
        );
      }
    };

    loadWorkflow();
    return () => {
      cancelled = true;
    };
  }, [
    workflowIdFromPath,
    location.search,
    replaceConfirmOpen,
    pendingReplaceAction,
    showErrorNotification,
  ]);
}
