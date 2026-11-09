import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useWeaverNotification } from "@/components/common/notifications";
import { getErrorMessage } from "@/utils/error";
import { useQueryClient } from "@tanstack/react-query";
import {
  collectionKeys,
  createCollection,
  deleteCollection,
  updateCollection,
  useCollection,
  useCollectionEndpoints,
  CollectionDetailsHeader,
  CollectionEndpointsExplorer,
  CollectionImportModal,
  EndpointConfigDrawer,
  buildCollectionPayload,
  buildEmptyCollection,
  normalizeCollection,
  validateCollection,
} from "@/features/collections";
import styles from "./CollectionViewPage.module.css";

const extractEndpointList = (responseBody: any) => {
  const candidates = [
    responseBody?.data?.items,
    responseBody?.data?.content,
    responseBody?.data?.endpoints,
    responseBody?.data?.records,
    responseBody?.items,
    responseBody?.content,
    responseBody?.endpoints,
    responseBody?.records,
    responseBody?.data,
    responseBody,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
};

const CREATE_HYDRATION_KEY = "__create__";
const EMPTY_LIST: any[] = [];

export default function CollectionViewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const isCreateMode = location.pathname === "/collections/new";
  const { error: showError, success: showSuccess } = useWeaverNotification();
  const queryClient = useQueryClient();

  const [form, setForm] = useState(buildEmptyCollection());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  // Endpoint Drawer State
  const [selectedEndpoint, setSelectedEndpoint] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Collection Query
  const collectionQuery = useCollection(id, { enabled: !isCreateMode && Boolean(id) });
  const endpointsQuery = useCollectionEndpoints(id, { enabled: !isCreateMode && Boolean(id) });
  const loading = !isCreateMode && Boolean(id) && collectionQuery.isPending;
  const endpointsLoading = !isCreateMode && Boolean(id) && endpointsQuery.isPending;
  const collectionResponse = collectionQuery.data;
  const collectionError = collectionQuery.error;
  const endpointsResponse = endpointsQuery.data;
  const endpointsError = endpointsQuery.error;
  const refetchCollection = collectionQuery.refetch;
  const refetchEndpoints = endpointsQuery.refetch;

  const rawEndpoints = useMemo(() => {
    if (isCreateMode || !endpointsResponse || endpointsError) return EMPTY_LIST;
    const endpointsBody = (endpointsResponse as any)?.data ?? {};
    return extractEndpointList(endpointsBody);
  }, [isCreateMode, endpointsResponse, endpointsError]);

  // Synchronously hydrate form once per id
  if (isCreateMode && hydratedFor !== CREATE_HYDRATION_KEY) {
    setHydratedFor(CREATE_HYDRATION_KEY);
    setForm(buildEmptyCollection());
    setFormErrors({});
  } else if (!isCreateMode && id && collectionResponse && hydratedFor !== id) {
    const collectionBody = (collectionResponse as any)?.data ?? {};
    const collectionData = collectionBody?.data ?? collectionBody ?? {};
    setHydratedFor(id);
    setForm(normalizeCollection(collectionData));
    setFormErrors({});
  }

  // Error notifications
  useEffect(() => {
    if (collectionError) showError(getErrorMessage(collectionError, "Failed to load collection details."));
  }, [collectionError, showError]);

  useEffect(() => {
    if (endpointsError) showError(getErrorMessage(endpointsError, "Failed to load related endpoints."));
  }, [endpointsError, showError]);

  useEffect(() => {
    const name = String(form?.name || "").trim();
    const title = isCreateMode ? "New Collection" : name ? `Collections - ${name}` : "Collections";
    document.title = title;
    if (name) {
      window.dispatchEvent(
        new CustomEvent("weaver:breadcrumb-title", {
          detail: { title: name, pathname: window.location.pathname },
        })
      );
    }
  }, [form?.name, isCreateMode]);

  const loadCollection = useCallback(async () => {
    await Promise.all([refetchCollection(), refetchEndpoints()]);
    setHydratedFor(null);
  }, [refetchCollection, refetchEndpoints]);

  const handleFieldChange = (field: string, value: any) => {
    setForm((prev) => ({ ...(prev || {}), [field]: value }));
    setFormErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleSave = async () => {
    const errors = validateCollection(form || {});
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      showError("Please fix collection validation errors before saving.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildCollectionPayload(form);
      if (isCreateMode || !form?.id) {
        const response = await createCollection(payload);
        const body = (response as any)?.data ?? {};
        const data = body?.data ?? body ?? {};
        const created = normalizeCollection(data);
        setForm(created);
        void queryClient.invalidateQueries({ queryKey: collectionKeys.all });
        showSuccess("Collection created successfully.");
        if (created?.id) {
          navigate(`/collections/${encodeURIComponent(created.id)}`, { replace: true });
        }
      } else {
        const response = await updateCollection(form.id || id, payload);
        const body = (response as any)?.data ?? {};
        const data = body?.data ?? body ?? payload;
        setForm((prev) => normalizeCollection({ ...(prev || {}), ...data }));
        showSuccess("Collection updated successfully.");
        await queryClient.invalidateQueries({ queryKey: collectionKeys.all });
        await queryClient.invalidateQueries({ queryKey: collectionKeys.detail(String(form.id || id)) });
        setHydratedFor(String(form.id || id));
      }
    } catch (error) {
      showError(
        getErrorMessage(
          error,
          isCreateMode ? "Failed to create collection." : "Failed to update collection."
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    const collectionId = String(form?.id || id || "").trim();
    if (!collectionId) return;

    setSubmitting(true);
    try {
      await deleteCollection(collectionId);
      void queryClient.invalidateQueries({ queryKey: collectionKeys.all, refetchType: "none" });
      showSuccess("Collection deleted successfully.");
      navigate("/collections");
    } catch (error) {
      showError(getErrorMessage(error, "Failed to delete collection."));
    } finally {
      setSubmitting(false);
    }
  };

  // Structured endpoint items
  const endpointOperations = useMemo(() => {
    return rawEndpoints.map((endpoint: any, index: number) => {
      let tags: string[] = [];
      if (Array.isArray(endpoint?.tags) && endpoint.tags.length > 0) {
        tags = endpoint.tags;
      } else if (Array.isArray(endpoint?.config?.tags) && endpoint.config.tags.length > 0) {
        tags = endpoint.config.tags;
      } else if (Array.isArray(endpoint?.raw?.tags) && endpoint.raw.tags.length > 0) {
        tags = endpoint.raw.tags;
      } else if (typeof endpoint?.tags === "string" && endpoint.tags.trim()) {
        tags = endpoint.tags.split(",").map((s: string) => s.trim()).filter(Boolean);
      } else if (typeof endpoint?.config?.tags === "string" && endpoint.config.tags.trim()) {
        tags = endpoint.config.tags.split(",").map((s: string) => s.trim()).filter(Boolean);
      }

      return {
        __rowId:
          endpoint?.id ||
          endpoint?.endpointId ||
          `${endpoint?.name || endpoint?.endpointName || "endpoint"}-${index}`,
        id: endpoint?.id || endpoint?.endpointId || "",
        name: endpoint?.name || endpoint?.endpointName || "HTTP Operation",
        method: String(
          endpoint?.config?.method ||
          endpoint?.method ||
          endpoint?.request?.method ||
          "GET"
        ).toUpperCase(),
        url:
          endpoint?.config?.url ||
          endpoint?.url ||
          endpoint?.request?.url ||
          "-",
        description: endpoint?.description || endpoint?.endpointDescription || "",
        tags,
        config: endpoint?.config || {},
        raw: endpoint,
      };
    });
  }, [rawEndpoints]);

  const handleInspectEndpoint = (ep: any) => {
    setSelectedEndpoint(ep?.raw || ep);
    setIsDrawerOpen(true);
  };

  const handleAddEndpoint = () => {
    setSelectedEndpoint(null);
    setIsDrawerOpen(true);
  };

  return (
    <div className={styles.pageContainer}>
      {loading ? (
        <div className={styles.loadingWrapper}>
          <Loader2 className={`${styles.spinner} spin`} />
        </div>
      ) : (
        <>
          {/* Top Header with Action Bar & Embedded Collection Configuration */}
          <CollectionDetailsHeader
            collection={form}
            formErrors={formErrors}
            isCreateMode={isCreateMode}
            loading={loading}
            submitting={submitting}
            onChange={handleFieldChange}
            onSave={handleSave}
            onDelete={!isCreateMode ? confirmDelete : undefined}
          />

          {/* Endpoints Explorer */}
          {!isCreateMode && (
            <CollectionEndpointsExplorer
              collectionId={String(form?.id || id)}
              endpoints={endpointOperations}
              loading={endpointsLoading}
              onInspectEndpoint={handleInspectEndpoint}
              onAddEndpoint={handleAddEndpoint}
              onImportClick={() => setImportModalOpen(true)}
            />
          )}
        </>
      )}

      {/* Endpoint Configuration Drawer */}
      {!isCreateMode && (
        <EndpointConfigDrawer
          open={isDrawerOpen}
          collectionId={String(form?.id || id || "")}
          endpoint={selectedEndpoint}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedEndpoint(null);
          }}
          onSaved={() => {
            void queryClient.invalidateQueries({
              queryKey: collectionKeys.endpoints(String(form?.id || id || "")),
            });
            void queryClient.invalidateQueries({
              queryKey: collectionKeys.all,
            });
            void refetchEndpoints();
          }}
          onDeleted={() => {
            void queryClient.invalidateQueries({
              queryKey: collectionKeys.endpoints(String(form?.id || id || "")),
            });
            void queryClient.invalidateQueries({
              queryKey: collectionKeys.all,
            });
            void refetchEndpoints();
          }}
          onNotify={({ severity, message }) => {
            if (severity === "error") showError(message);
            else showSuccess(message);
          }}
        />
      )}


      {/* Import Modal */}
      <CollectionImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => {
          void loadCollection();
        }}
        onNotify={({ severity, message }) => {
          if (severity === "error") showError(message);
          else showSuccess(message);
        }}
      />
    </div>
  );
}
