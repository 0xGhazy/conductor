import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  UploadCloud,
  X,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Globe,
  Loader2,
} from "lucide-react";
import { SiPostman, SiSwagger } from "react-icons/si";
import { useQueryClient } from "@tanstack/react-query";
import {
  importCollection,
} from "@/features/collections/services/apiCollectionsApi";
import {
  buildEmptyCollection,
  buildImportPayload,
  parseCollectionFile,
} from "@/features/collections/services/apiCollectionsService";
import { collectionKeys } from "@/features/collections/hooks/queryKeys";
import { getErrorMessage } from "@/utils/error";
import styles from "./CollectionImportModal.module.css";

interface CollectionImportModalProps {
  open: boolean;
  initialFile?: File | null;
  onClose: () => void;
  onSuccess?: (name: string) => void;
  onNotify?: (payload: { severity?: "error" | "success"; message: string }) => void;
}

interface ParsedSpecData {
  raw: any;
  name: string;
  description: string;
  baseUrl: string;
  endpoints: any[];
  type: "SWAGGER" | "POSTMAN";
  specVersion: string;
  methodCounts: Record<string, number>;
}

export const CollectionImportModal: React.FC<CollectionImportModalProps> = ({
  open,
  initialFile = null,
  onClose,
  onSuccess,
  onNotify,
}) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragActive, setDragActive] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [parsedData, setParsedData] = useState<ParsedSpecData | null>(null);
  const [collectionName, setCollectionName] = useState("");
  const [description, setDescription] = useState("");

  const processFile = useCallback(
    async (file: File) => {
      setParsing(true);
      setParseError(null);
      try {
        const parsed = await parseCollectionFile(file);
        if (!parsed.endpoints || parsed.endpoints.length === 0) {
          throw new Error(
            "No valid HTTP endpoints found in this file. Please verify the OpenAPI or Postman spec."
          );
        }
        setParsedData(parsed as ParsedSpecData);
        setCollectionName(parsed.name || file.name.replace(/\.(json|yaml|yml)$/i, ""));
        setDescription(parsed.description || "");
      } catch (err) {
        setParseError(getErrorMessage(err, "Failed to parse API specification file."));
        setParsedData(null);
      } finally {
        setParsing(false);
      }
    },
    []
  );

  useEffect(() => {
    if (open && initialFile) {
      void processFile(initialFile);
    }
  }, [open, initialFile, processFile]);

  const handleReset = () => {
    setParsedData(null);
    setParseError(null);
    setCollectionName("");
    setDescription("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedData || !collectionName.trim() || collectionName.trim().length < 3) {
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildImportPayload(
        {
          ...buildEmptyCollection(),
          name: collectionName.trim(),
          description: description.trim(),
          type: parsedData.type,
        },
        parsedData
      );

      await importCollection(payload);
      onNotify?.({
        severity: "success",
        message: `API Collection "${collectionName.trim()}" (${parsedData.endpoints.length} endpoints) imported successfully.`,
      });
      void queryClient.invalidateQueries({ queryKey: collectionKeys.all });
      onSuccess?.(collectionName.trim());
      handleClose();
    } catch (err) {
      const msg = getErrorMessage(err, "Failed to import collection.");
      onNotify?.({ severity: "error", message: msg });
      setParseError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const isFormValid =
    Boolean(parsedData) &&
    parsedData!.endpoints.length > 0 &&
    collectionName.trim().length >= 3 &&
    !submitting;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-collection-title"
    >
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitleGroup}>
            <div className={styles.headerIcon}>
              <UploadCloud size={20} />
            </div>
            <div>
              <h2 id="import-collection-title" className={styles.title}>
                Import API Specification
              </h2>
              <p className={styles.subtitle}>
                Ingest OpenAPI, Swagger, or Postman collections to generate workflow HTTP endpoints
              </p>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className={styles.body}>
            {!parsedData ? (
              <>
                <div
                  className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ""}`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.yaml,.yml"
                    className={styles.hiddenInput}
                    onChange={handleFileChange}
                  />
                  <div className={styles.dropzoneIcon}>
                    {parsing ? <Loader2 size={24} className="spin" /> : <FileCode size={24} />}
                  </div>
                  <div>
                    <span className={styles.dropzonePrompt}>
                      {parsing
                        ? "Analyzing specification..."
                        : "Drop API spec file here, or click to browse"}
                    </span>
                    <p className={styles.dropzoneHelp}>
                      Supports OpenAPI 3.0+ (JSON/YAML), Swagger 2.0, or Postman Collection v2.1
                    </p>
                  </div>
                </div>

                {parseError && (
                  <div className={styles.errorCallout} role="alert">
                    <AlertCircle size={16} />
                    <span>{parseError}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Pre-flight Spec Preview */}
                <div className={styles.specPreview}>
                  <div className={styles.specPreviewHeader}>
                    <div className={styles.specBadgeGroup}>
                      <span
                        className={`${styles.typeBadge} ${
                          parsedData.type === "SWAGGER"
                            ? styles.typeSwagger
                            : styles.typePostman
                        }`}
                      >
                        {parsedData.type === "SWAGGER" ? (
                          <SiSwagger size={14} />
                        ) : (
                          <SiPostman size={14} />
                        )}
                        <span>{parsedData.specVersion}</span>
                      </span>
                      <span className={styles.statItem}>
                        {parsedData.endpoints.length} Endpoints
                      </span>
                    </div>

                    <button
                      type="button"
                      className={styles.reselectButton}
                      onClick={handleReset}
                    >
                      Choose different file
                    </button>
                  </div>

                  {/* Method Distribution Breakdown */}
                  <div className={styles.specStats}>
                    {Object.entries(parsedData.methodCounts || {}).map(([method, count]) => {
                      const m = method.toUpperCase();
                      const methodClass =
                        m === "GET"
                          ? styles.methodGet
                          : m === "POST"
                          ? styles.methodPost
                          : m === "PUT"
                          ? styles.methodPut
                          : m === "DELETE"
                          ? styles.methodDelete
                          : styles.methodOther;
                      return (
                        <span key={m} className={`${styles.methodPill} ${methodClass}`}>
                          {m}: {count}
                        </span>
                      );
                    })}
                  </div>

                  {parsedData.baseUrl && (
                    <div className={styles.baseUrlBox} title="Detected Base URL">
                      <Globe size={13} />
                      <span>{parsedData.baseUrl}</span>
                    </div>
                  )}
                </div>

                {/* Form Fields */}
                <div className={styles.formGroup}>
                  <label htmlFor="collection-name" className={styles.label}>
                    Collection Name <span className={styles.requiredStar}>*</span>
                  </label>
                  <input
                    id="collection-name"
                    type="text"
                    className={styles.input}
                    value={collectionName}
                    onChange={(e) => setCollectionName(e.target.value)}
                    placeholder="e.g. Core Banking Service APIs"
                    required
                    minLength={3}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="collection-description" className={styles.label}>
                    Description
                  </label>
                  <textarea
                    id="collection-description"
                    className={styles.textarea}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the service domain and endpoints..."
                  />
                </div>

                {parseError && (
                  <div className={styles.errorCallout} role="alert">
                    <AlertCircle size={16} />
                    <span>{parseError}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className={styles.footer}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={handleClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={!isFormValid}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Import Collection</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CollectionImportModal;
