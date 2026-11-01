import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DataObjectIcon from "@mui/icons-material/DataObject";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import TerminalIcon from "@mui/icons-material/Terminal";
import { WeaverCodeEditor } from "@/components/common/editors";
import { useWeaverNotification } from "@/components/common/notifications";
import RunIconButton from "@/components/common/buttons/RunIconButton";
import { WeaverNumberField } from "@/components/common/fields";
import { getErrorMessage } from "@/utils/error";
import { ScriptExecutionResultDialog } from "@/features/scripts";
import { useScriptDetails } from "@/features/scripts";
import type { ScriptDefinition, ScriptLanguage, VariablesMap } from "@/features/scripts";
import { DEFAULT_SCRIPT_LANGUAGE, DEFAULT_SCRIPT_TIMEOUT_MS, SCRIPT_LANGUAGE_OPTIONS, buildScriptPayload, formatVariablesText, getEditorLanguage, normalizeScriptLanguage, normalizeTimeout, parseVariablesText } from "@/features/scripts";
import "@/styles/definitionPages.css";

interface ScriptFormState {
  name: string;
  description: string;
  script: string;
  language: ScriptLanguage;
  timeout: number | string;
  variablesText: string;
}

interface ScriptFormErrors {
  name?: string;
  script?: string;
  timeout?: string;
  variables?: string;
}

const createEmptyForm = (): ScriptFormState => ({
  name: "",
  description: "",
  script: "",
  language: DEFAULT_SCRIPT_LANGUAGE,
  timeout: DEFAULT_SCRIPT_TIMEOUT_MS,
  variablesText: "{}",
});

const createFormFromScript = (script: ScriptDefinition): ScriptFormState => ({
  name: script.name || "",
  description: script.description || "",
  script: script.script || "",
  language: normalizeScriptLanguage(script.language),
  timeout: script.timeout ?? DEFAULT_SCRIPT_TIMEOUT_MS,
  variablesText: formatVariablesText(script.variables),
});

const formatResult = (value: unknown): string => {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value);
  }
};

const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 13,
  wordWrap: "on" as const,
  scrollBeyondLastLine: false,
  automaticLayout: true,
};

const detailsPanelSx = (theme: any) => ({
  p: 3,
  borderRadius: 2,
  border: `1px solid ${theme.palette.divider}`,
  background: theme.palette.background.paper,
  boxShadow: "none",
});

const secondaryPanelSx = (theme: any) => ({
  p: 2,
  borderRadius: 2,
  border: `1px solid ${theme.palette.divider}`,
  background: theme.palette.background.paper,
  boxShadow: "none",
});

export default function ScriptViewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isCreateMode = location.pathname === "/scripts/new";
  const { error: showError, success: showSuccess } = useWeaverNotification();
  const { script, loading, errorMessage, error, loadScript, createScript, updateScript, deleteScript, executeScript } =
    useScriptDetails(id, !isCreateMode);

  const [form, setForm] = useState<ScriptFormState>(createEmptyForm);
  const [formErrors, setFormErrors] = useState<ScriptFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [resultText, setResultText] = useState("");
  const [resultError, setResultError] = useState("");
  const [resultMeta, setResultMeta] = useState({ status: "N/A", executionTime: "N/A", code: "N/A" });

  const editorLanguage = useMemo(() => getEditorLanguage(form.language), [form.language]);

  // Hydrate the form from the fetched script once per id (during render, so there is no empty-form flash).
  // Background refetches never clobber in-progress edits; Refresh re-hydrates explicitly.
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  if (!isCreateMode && id && script && hydratedFor !== id) {
    setHydratedFor(id);
    setForm(createFormFromScript(script));
    setFormErrors({});
  }

  useEffect(() => {
    if (!isCreateMode) return;
    setHydratedFor(null);
    setForm(createEmptyForm());
    setFormErrors({});
    setResultText("");
    setResultError("");
    setResultMeta({ status: "N/A", executionTime: "N/A", code: "N/A" });
  }, [isCreateMode]);

  // One notification per failed fetch (the query error object changes on every failure).
  useEffect(() => {
    if (error && errorMessage) {
      showError(errorMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const handleRefresh = useCallback(async () => {
    await loadScript();
    setHydratedFor(null);
  }, [loadScript]);

  const validateForm = useCallback((): VariablesMap | null => {
    const errors: ScriptFormErrors = {};
    if (!form.name.trim()) errors.name = "Name is required.";
    if (!form.script.trim()) errors.script = "Script is required.";
    if (!Number.isFinite(Number(form.timeout)) || Number(form.timeout) <= 0) {
      errors.timeout = "Timeout must be a positive number of milliseconds.";
    }

    const variables = parseVariablesText(form.variablesText);
    if (variables === null) errors.variables = "Variables must be valid JSON.";

    setFormErrors(errors);
    return Object.keys(errors).length > 0 || variables === null ? null : variables;
  }, [form]);

  const handleSave = async () => {
    const variables = validateForm();
    if (!variables) return;

    const payload = buildScriptPayload(form, variables);
    setSaving(true);
    try {
      const saved = isCreateMode ? await createScript(payload) : await updateScript(payload);
      showSuccess(isCreateMode ? "Script created successfully." : "Script updated successfully.");
      const nextForm = createFormFromScript(saved);
      setForm(nextForm);
      if (isCreateMode) {
        navigate(`/scripts/${encodeURIComponent(saved.id)}`, { replace: true });
      }
    } catch (error) {
      showError(getErrorMessage(error, isCreateMode ? "Failed to create script." : "Failed to update script."));
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    const variables = validateForm();
    if (!variables) return;

    setRunning(true);
    setResultText("");
    setResultError("");
    try {
      const result = await executeScript({
        script: form.script,
        language: normalizeScriptLanguage(form.language),
        variables,
        timeout: normalizeTimeout(form.timeout),
      });
      const status = String(result.status || "SUCCESS");
      setResultMeta({
        status,
        executionTime: result.executionTime != null ? `${result.executionTime} ms` : "N/A",
        code: result.code || "N/A",
      });
      if (status.toUpperCase() === "FAILED") {
        setResultError(result.reason || result.message || "Script execution failed.");
      }
      setResultText(formatResult(result.output ?? result));
    } catch (error) {
      setResultMeta({ status: "FAILED", executionTime: "N/A", code: "N/A" });
      setResultError(getErrorMessage(error, "Failed to run script."));
      setResultText("");
    } finally {
      setResultDialogOpen(true);
      setRunning(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteScript();
      showSuccess("Script deleted successfully.");
      navigate("/scripts", { replace: true });
    } catch (error) {
      showError(getErrorMessage(error, "Failed to delete script."));
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div className="definitions-page">

      <div className="definitions-content">
            <Box
              sx={{
                position: "sticky",
                top: 0,
                zIndex: 5,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 2,
                mb: 2,
                py: 1,
                width: "100%",
                maxWidth: "100%",
                border: 0,
                boxShadow: "none",
                backgroundColor: "transparent",
              }}
            >
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate("/scripts")}
              >
                Back
              </Button>
              <Box sx={{ flex: 1 }} />
              {!isCreateMode ? (
                <Button
                  startIcon={<RefreshIcon />}
                  variant="outlined"
                  onClick={handleRefresh}
                  disabled={loading}
                >
                  Refresh
                </Button>
              ) : null}
              {!isCreateMode ? (
                <Button
                  startIcon={<DeleteOutlineIcon />}
                  variant="outlined"
                  color="error"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={deleting || loading}
                >
                  Delete
                </Button>
              ) : null}
              <Button
                startIcon={<SaveIcon />}
                variant="contained"
                onClick={handleSave}
                disabled={saving || loading}
              >
                {saving ? (isCreateMode ? "Creating..." : "Updating...") : (isCreateMode ? "Create" : "Update")}
              </Button>
            </Box>

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                <CircularProgress size={32} />
              </Box>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.75fr) minmax(360px, 0.75fr)" },
                  gap: 2,
                  alignItems: "start",
                }}
              >
                <Paper sx={detailsPanelSx}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: { xs: "stretch", md: "center" },
                      justifyContent: "space-between",
                      gap: 2,
                      mb: 1.5,
                      flexDirection: { xs: "column", md: "row" },
                    }}
                  >
                    <Typography variant="h6" className="definitions-title">
                      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                        <TerminalIcon fontSize="small" />
                        <span>Script Editor</span>
                      </Box>
                    </Typography>
                    <TextField
                      select
                      label="Language"
                      size="small"
                      value={form.language}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, language: normalizeScriptLanguage(event.target.value) }))
                      }
                      sx={{ width: { xs: "100%", md: 180 } }}
                    >
                      {SCRIPT_LANGUAGE_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <WeaverNumberField
                      label="Timeout"
                      suffix="ms"
                      size="small"
                      value={typeof form.timeout === "number" ? form.timeout : (form.timeout === "" ? null : Number(form.timeout))}
                      onChange={(val) => setForm((prev) => ({ ...prev, timeout: val ?? "" }))}
                      min={1}
                      step={1000}
                      allowDecimal={false}
                      showControls
                      errorMessage={formErrors.timeout}
                      sx={{ width: { xs: "100%", md: 170 } }}
                    />
                    <RunIconButton
                      onClick={handleRun}
                      running={running}
                      disabled={loading}
                      ariaLabel="Run script"
                    />
                  </Box>
                  <WeaverCodeEditor
                    height="clamp(420px, calc(100vh - 340px), 680px)"
                    language={editorLanguage}
                    value={form.script}
                    onChange={(value: string | undefined) => setForm((prev) => ({ ...prev, script: value ?? "" }))}
                    options={EDITOR_OPTIONS}
                  />
                  {formErrors.script ? (
                    <Typography variant="caption" className="definitions-error">
                      {formErrors.script}
                    </Typography>
                  ) : null}
                </Paper>

                <Stack spacing={2} sx={{ position: { lg: "sticky" }, top: { lg: 84 } }}>
                  <Paper sx={secondaryPanelSx}>
                    <Typography variant="h6" className="definitions-title" sx={{ mb: 1.5 }}>
                      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                        <InfoOutlinedIcon fontSize="small" />
                        <span>Details</span>
                      </Box>
                    </Typography>
                    <Stack spacing={2}>
                      <TextField
                        label="Name"
                        value={form.name}
                        onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                        fullWidth
                        error={Boolean(formErrors.name)}
                        helperText={formErrors.name}
                      />
                      <TextField
                        label="Description"
                        value={form.description}
                        onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                        fullWidth
                        multiline
                        minRows={3}
                      />
                    </Stack>
                  </Paper>

                  <Paper sx={secondaryPanelSx}>
                    <Typography variant="h6" className="definitions-title" sx={{ mb: 1.5 }}>
                      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                        <DataObjectIcon fontSize="small" />
                        <span>Variables</span>
                      </Box>
                    </Typography>
                    <WeaverCodeEditor
                      height="220px"
                      language="json"
                      value={form.variablesText}
                      onChange={(value: string | undefined) =>
                        setForm((prev) => ({ ...prev, variablesText: value ?? "{}" }))
                      }
                      options={EDITOR_OPTIONS}
                    />
                    {formErrors.variables ? (
                      <Typography variant="caption" className="definitions-error">
                        {formErrors.variables}
                      </Typography>
                    ) : null}
                  </Paper>
                </Stack>
              </Box>
            )}
          </div>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Delete script?</DialogTitle>
        <DialogContent>
          <Typography>
            You're about to delete script "{form.name}". This action can't be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <ScriptExecutionResultDialog
        open={resultDialogOpen}
        onClose={() => setResultDialogOpen(false)}
        status={resultMeta.status}
        executionTime={resultMeta.executionTime}
        code={resultMeta.code}
        output={resultText}
        errorMessage={resultError}
      />
    </div>
  );
}
