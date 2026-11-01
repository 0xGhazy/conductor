import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import RefreshIcon from "@mui/icons-material/Refresh";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import { useWeaverNotification } from "@/components/common/notifications";
import { getErrorMessage } from "@/utils/error";
import { useQueryClient } from "@tanstack/react-query";
import { CONNECTION_STRATEGIES, OAUTH_GRANT_TYPES, buildConnectionPayload, buildEmptyConnection, normalizeConnection, validateConnection } from "@/features/connections";
import { connectionKeys, createConnection, deleteConnection, updateConnection, useConnection } from "@/features/connections";
import "@/styles/definitionPages.css";

const CREATE_HYDRATION_KEY = "__create__";

const buildDraftSnapshot = (form) => {
  const safeForm = form || {};
  return JSON.stringify({
    name: String(safeForm?.name ?? ""),
    strategy: String(safeForm?.strategy ?? "API_KEY"),
    active: Boolean(safeForm?.active ?? true),
    apiKey: String(safeForm?.apiKey ?? ""),
    apiKeyHeader: String(safeForm?.apiKeyHeader ?? ""),
    cookie: String(safeForm?.cookie ?? ""),
    cookieHeader: String(safeForm?.cookieHeader ?? ""),
    grantType: String(safeForm?.grantType ?? "CLIENT_CREDENTIALS"),
    tokenEndpoint: String(safeForm?.tokenEndpoint ?? ""),
    clientId: String(safeForm?.clientId ?? ""),
    clientSecret: String(safeForm?.clientSecret ?? ""),
    resource: String(safeForm?.resource ?? ""),
    scope: String(safeForm?.scope ?? ""),
    username: String(safeForm?.username ?? ""),
    password: String(safeForm?.password ?? ""),
    code: String(safeForm?.code ?? ""),
    codeVerifier: String(safeForm?.codeVerifier ?? ""),
    redirectUri: String(safeForm?.redirectUri ?? ""),
  });
};

export default function ConnectionViewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isCreateMode = location.pathname === "/connections/new";
  const { error: showError, success: showSuccess } = useWeaverNotification();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(buildEmptyConnection());
  const [formErrors, setFormErrors] = useState({});
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const [unsavedActionLabel, setUnsavedActionLabel] = useState("continue");

  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showCookie, setShowCookie] = useState(false);
  const [showOauthPassword, setShowOauthPassword] = useState(false);
  const [showOauthCode, setShowOauthCode] = useState(false);
  const [showOauthCodeVerifier, setShowOauthCodeVerifier] = useState(false);

  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  const [draftSnapshot, setDraftSnapshot] = useState(() => buildDraftSnapshot(buildEmptyConnection()));
  const unsavedResolverRef = useRef(null);
  const hasUnsavedChanges = useMemo(() => buildDraftSnapshot(form) !== draftSnapshot, [form, draftSnapshot]);

  const connectionQuery = useConnection(id, { enabled: !isCreateMode });
  const { data: connectionResponse, error: connectionError, refetch: refetchConnection } = connectionQuery;
  const loading = !isCreateMode && Boolean(id) && connectionQuery.isPending;

  // Hydrate the form once per id (or once on entering create mode), synchronously during render,
  // so background refetches never clobber in-progress edits.
  if (isCreateMode && hydratedFor !== CREATE_HYDRATION_KEY) {
    const empty = buildEmptyConnection();
    setHydratedFor(CREATE_HYDRATION_KEY);
    setForm(empty);
    setFormErrors({});
    setDraftSnapshot(buildDraftSnapshot(empty));
  } else if (!isCreateMode && id && connectionResponse && hydratedFor !== id) {
    const body = connectionResponse?.data ?? {};
    const data = body?.data ?? body ?? {};
    const normalized = normalizeConnection(data);
    setHydratedFor(id);
    setForm(normalized);
    setFormErrors({});
    setDraftSnapshot(buildDraftSnapshot(normalized));
  }

  useEffect(() => {
    if (connectionError) showError(getErrorMessage(connectionError, "Failed to load connection."));
  }, [connectionError, showError]);

  const reloadConnection = useCallback(async () => {
    await refetchConnection();
    setHydratedFor(null);
  }, [refetchConnection]);

  useEffect(() => {
    const name = String(form?.name || "").trim();
    document.title = name ? `Connection: ${name}` : "Connection";
  }, [form?.name]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...(prev || {}), [field]: value }));
    setFormErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleSave = async () => {
    const errors = validateConnection(form || {});
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const payload = buildConnectionPayload(form);
      if (isCreateMode || !form?.id) {
        const response = await createConnection(payload);
        const body = response?.data ?? {};
        const data = body?.data ?? body ?? {};
        const created = normalizeConnection(data);
        setForm(created);
        setDraftSnapshot(buildDraftSnapshot(created));
        await queryClient.invalidateQueries({ queryKey: connectionKeys.all });
        showSuccess("Connection created successfully.");
        if (created?.id) {
          navigate(`/connections/${encodeURIComponent(created.id)}`, { replace: true });
        }
      } else {
        await updateConnection(form.id || id, payload);
        setDraftSnapshot(buildDraftSnapshot(form));
        showSuccess("Connection updated successfully.");
        await queryClient.invalidateQueries({ queryKey: connectionKeys.all });
        setHydratedFor(null);
      }
    } catch (error) {
      showError(
        getErrorMessage(
          error,
          isCreateMode ? "Failed to create connection." : "Failed to update connection."
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    const connectionId = String(form?.id || id || "").trim();
    if (!connectionId) return;
    const confirmed = window.confirm("Delete this connection? This action cannot be undone.");
    if (!confirmed) return;

    setSubmitting(true);
    try {
      await deleteConnection(connectionId);
      // Mark stale without refetching the (now deleted) detail query that is still mounted.
      void queryClient.invalidateQueries({ queryKey: connectionKeys.all, refetchType: "none" });
      showSuccess("Connection deleted successfully.");
      navigate("/connections");
    } catch (error) {
      showError(getErrorMessage(error, "Failed to delete connection."));
    } finally {
      setSubmitting(false);
    }
  };

  const askUnsavedDecision = useCallback(
    (actionLabel) =>
      new Promise((resolve) => {
        setUnsavedActionLabel(actionLabel);
        setUnsavedDialogOpen(true);
        unsavedResolverRef.current = resolve;
      }),
    []
  );

  const resolveUnsavedDecision = useCallback((decision) => {
    setUnsavedDialogOpen(false);
    const resolver = unsavedResolverRef.current;
    unsavedResolverRef.current = null;
    resolver?.(decision);
  }, []);

  const confirmDraftAction = useCallback(
    async (actionLabel) => {
      if (!hasUnsavedChanges) return true;
      const decision = await askUnsavedDecision(actionLabel);
      if (decision === "save") return await handleSave();
      if (decision === "discard") return true;
      return false;
    },
    [askUnsavedDecision, hasUnsavedChanges, handleSave]
  );

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  return (
    <div className="definitions-page">
      <Dialog
        open={unsavedDialogOpen}
        onClose={() => resolveUnsavedDecision("cancel")}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Unsaved Changes</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            You have unsaved changes. Choose to save, discard, or cancel before {unsavedActionLabel}.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => resolveUnsavedDecision("cancel")} variant="text" disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => resolveUnsavedDecision("discard")} variant="outlined" color="warning" disabled={submitting}>
            Discard
          </Button>
          <Button onClick={() => resolveUnsavedDecision("save")} variant="contained" startIcon={<SaveIcon />} disabled={submitting}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
      <div className="definitions-content">
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={async () => {
                  const proceed = await confirmDraftAction("going back");
                  if (proceed) navigate("/connections");
                }}
              >
                Back
              </Button>
              <Box sx={{ display: "flex", gap: 1 }}>
                {!isCreateMode ? (
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={async () => {
                      const proceed = await confirmDraftAction("reloading");
                      if (proceed) await reloadConnection();
                    }}
                    disabled={loading || submitting}
                  >
                    Refresh
                  </Button>
                ) : null}
                {!isCreateMode ? (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteOutlineIcon />}
                    onClick={handleDelete}
                    disabled={submitting || loading}
                  >
                    Delete
                  </Button>
                ) : null}
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                  disabled={submitting || loading}
                >
                  {submitting ? (isCreateMode ? "Creating..." : "Updating...") : (isCreateMode ? "Create" : "Update")}
                </Button>
              </Box>
            </Box>

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                <CircularProgress size={32} />
              </Box>
            ) : (
              <>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: isCreateMode ? "1fr" : { xs: "1fr", lg: "1.45fr 1fr" },
                    gap: 2,
                  }}
                >
                  <Paper
                    sx={(theme) => ({
                      p: 3,
                      borderRadius: 2,
                      border: `1px solid ${theme.palette.divider}`,
                      background: theme.palette.background.paper,
                      boxShadow: "none",
                    })}
                  >
                <Typography variant="h6" className="definitions-title" sx={{ mb: 1.5 }}>
                  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                    <InfoOutlinedIcon fontSize="small" />
                    <span>Details</span>
                  </Box>
                </Typography>

                <TextField
                  label="Name"
                  value={form?.name || ""}
                  onChange={(e) => handleChange("name", e.target.value)}
                  fullWidth
                  margin="normal"
                  error={Boolean(formErrors.name)}
                  helperText={formErrors.name}
                  disabled={!isCreateMode}
                />

                <FormControl fullWidth margin="normal" error={Boolean(formErrors.strategy)}>
                  <InputLabel>Strategy</InputLabel>
                  <Select
                    value={form?.strategy || "API_KEY"}
                    label="Strategy"
                    onChange={(e) => {
                      handleChange("strategy", e.target.value);
                      if (e.target.value === "OAUTH2") {
                        handleChange("grantType", "CLIENT_CREDENTIALS");
                      }
                    }}
                  >
                    {CONNECTION_STRATEGIES.map((strategy) => (
                      <MenuItem key={strategy} value={strategy}>
                        {strategy}
                      </MenuItem>
                    ))}
                  </Select>
                  {formErrors.strategy ? (
                    <Typography variant="caption" className="definitions-error">
                      {formErrors.strategy}
                    </Typography>
                  ) : null}
                </FormControl>

                {form?.strategy === "API_KEY" ? (
                  <>
                    <TextField
                      label="API Key"
                      type={showApiKey ? "text" : "password"}
                      value={form?.apiKey || ""}
                      onChange={(e) => handleChange("apiKey", e.target.value)}
                      fullWidth
                      margin="normal"
                      error={Boolean(formErrors.apiKey)}
                      helperText={formErrors.apiKey}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowApiKey((prev) => !prev)}
                              edge="end"
                              aria-label={showApiKey ? "Hide API key" : "Show API key"}
                              size="small"
                            >
                              {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                    <TextField
                      label="API Key Header"
                      value={form?.apiKeyHeader || ""}
                      onChange={(e) => handleChange("apiKeyHeader", e.target.value)}
                      fullWidth
                      margin="normal"
                      error={Boolean(formErrors.apiKeyHeader)}
                      helperText={formErrors.apiKeyHeader}
                    />
                  </>
                ) : null}

                {form?.strategy === "BASIC_AUTHENTICATION" ? (
                  <>
                    <TextField
                      label="Username"
                      value={form?.username || ""}
                      onChange={(e) => handleChange("username", e.target.value)}
                      fullWidth
                      margin="normal"
                      error={Boolean(formErrors.username)}
                      helperText={formErrors.username}
                    />
                    <TextField
                      label="Password"
                      type={showPassword ? "text" : "password"}
                      value={form?.password || ""}
                      onChange={(e) => handleChange("password", e.target.value)}
                      fullWidth
                      margin="normal"
                      error={Boolean(formErrors.password)}
                      helperText={formErrors.password}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowPassword((prev) => !prev)}
                              edge="end"
                              aria-label={showPassword ? "Hide password" : "Show password"}
                              size="small"
                            >
                              {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </>
                ) : null}

                {form?.strategy === "OAUTH2" ? (
                  <>
                    <FormControl fullWidth margin="normal" error={Boolean(formErrors.grantType)}>
                      <InputLabel>Grant Type</InputLabel>
                      <Select
                        value={form?.grantType || "CLIENT_CREDENTIALS"}
                        label="Grant Type"
                        onChange={(e) => handleChange("grantType", e.target.value)}
                      >
                        {OAUTH_GRANT_TYPES.map((grant) => (
                          <MenuItem key={grant} value={grant}>
                            {grant}
                          </MenuItem>
                        ))}
                      </Select>
                      {formErrors.grantType ? (
                        <Typography variant="caption" className="definitions-error">
                          {formErrors.grantType}
                        </Typography>
                      ) : null}
                    </FormControl>

                    <TextField
                      label="Token Endpoint"
                      value={form?.tokenEndpoint || ""}
                      onChange={(e) => handleChange("tokenEndpoint", e.target.value)}
                      fullWidth
                      margin="normal"
                      error={Boolean(formErrors.tokenEndpoint)}
                      helperText={formErrors.tokenEndpoint}
                    />
                    <TextField
                      label="Client ID"
                      value={form?.clientId || ""}
                      onChange={(e) => handleChange("clientId", e.target.value)}
                      fullWidth
                      margin="normal"
                      error={Boolean(formErrors.clientId)}
                      helperText={formErrors.clientId}
                    />
                    <TextField
                      label="Client Secret"
                      type="password"
                      value={form?.clientSecret || ""}
                      onChange={(e) => handleChange("clientSecret", e.target.value)}
                      fullWidth
                      margin="normal"
                      error={Boolean(formErrors.clientSecret)}
                      helperText={formErrors.clientSecret}
                    />
                    {form?.grantType === "CLIENT_CREDENTIALS" ? (
                      <TextField
                        label="Resource"
                        value={form?.resource || ""}
                        onChange={(e) => handleChange("resource", e.target.value)}
                        fullWidth
                        margin="normal"
                      />
                    ) : null}
                    <TextField
                      label="Scope"
                      value={form?.scope || ""}
                      onChange={(e) => handleChange("scope", e.target.value)}
                      fullWidth
                      margin="normal"
                    />

                    {form?.grantType === "PASSWORD" ? (
                      <>
                        <TextField
                          label="Username"
                          value={form?.username || ""}
                          onChange={(e) => handleChange("username", e.target.value)}
                          fullWidth
                          margin="normal"
                          error={Boolean(formErrors.username)}
                          helperText={formErrors.username}
                        />
                        <TextField
                          label="Password"
                          type={showOauthPassword ? "text" : "password"}
                          value={form?.password || ""}
                          onChange={(e) => handleChange("password", e.target.value)}
                          fullWidth
                          margin="normal"
                          error={Boolean(formErrors.password)}
                          helperText={formErrors.password}
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  onClick={() => setShowOauthPassword((prev) => !prev)}
                                  edge="end"
                                  aria-label={showOauthPassword ? "Hide password" : "Show password"}
                                  size="small"
                                >
                                  {showOauthPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                        />
                      </>
                    ) : null}

                    {form?.grantType === "AUTHORIZATION_CODE" ? (
                      <>
                        <TextField
                          label="Code"
                          type={showOauthCode ? "text" : "password"}
                          value={form?.code || ""}
                          onChange={(e) => handleChange("code", e.target.value)}
                          fullWidth
                          margin="normal"
                          error={Boolean(formErrors.code)}
                          helperText={formErrors.code}
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  onClick={() => setShowOauthCode((prev) => !prev)}
                                  edge="end"
                                  aria-label={showOauthCode ? "Hide code" : "Show code"}
                                  size="small"
                                >
                                  {showOauthCode ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                        />
                        <TextField
                          label="Code Verifier"
                          type={showOauthCodeVerifier ? "text" : "password"}
                          value={form?.codeVerifier || ""}
                          onChange={(e) => handleChange("codeVerifier", e.target.value)}
                          fullWidth
                          margin="normal"
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  onClick={() => setShowOauthCodeVerifier((prev) => !prev)}
                                  edge="end"
                                  aria-label={
                                    showOauthCodeVerifier ? "Hide code verifier" : "Show code verifier"
                                  }
                                  size="small"
                                >
                                  {showOauthCodeVerifier ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                        />
                        <TextField
                          label="Redirect URI"
                          value={form?.redirectUri || ""}
                          onChange={(e) => handleChange("redirectUri", e.target.value)}
                          fullWidth
                          margin="normal"
                          error={Boolean(formErrors.redirectUri)}
                          helperText={formErrors.redirectUri}
                        />
                      </>
                    ) : null}
                  </>
                ) : null}

                {form?.strategy === "COOKIE" ? (
                  <>
                    <TextField
                      label="Cookie"
                      type={showCookie ? "text" : "password"}
                      value={form?.cookie || ""}
                      onChange={(e) => handleChange("cookie", e.target.value)}
                      fullWidth
                      margin="normal"
                      error={Boolean(formErrors.cookie)}
                      helperText={formErrors.cookie}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowCookie((prev) => !prev)}
                              edge="end"
                              aria-label={showCookie ? "Hide cookie" : "Show cookie"}
                              size="small"
                            >
                              {showCookie ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                    <TextField
                      label="Cookie Header"
                      value={form?.cookieHeader || ""}
                      onChange={(e) => handleChange("cookieHeader", e.target.value)}
                      placeholder="Cookie"
                      fullWidth
                      margin="normal"
                      error={Boolean(formErrors.cookieHeader)}
                      helperText={formErrors.cookieHeader || "Defaults to 'Cookie' header if omitted"}
                    />
                  </>
                ) : null}
                  </Paper>
                  {!isCreateMode ? (
                    <Paper
                      sx={(theme) => {
                        const isActive = Boolean(form?.active);
                        return {
                          p: 2,
                          borderRadius: 2,
                          border: `1px solid ${theme.palette.divider}`,
                          background: isActive
                            ? "var(--color-support-soft)"
                            : "var(--color-surface-soft)",
                          boxShadow: "none",
                        };
                      }}
                    >
                      <Typography variant="h6" className="definitions-title" sx={{ mb: 1.5 }}>
                        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                          <HealthAndSafetyIcon fontSize="small" />
                          <span>Status</span>
                        </Box>
                      </Typography>
                      <Box sx={{ display: "grid", gap: 2 }}>
                        <TextField
                          label="Status"
                          value={form?.active ? "ACTIVE" : "INACTIVE"}
                          fullWidth
                          disabled
                        />
                        <TextField
                          label="Strategy"
                          value={form?.strategy || "-"}
                          fullWidth
                          disabled
                        />
                        <TextField
                          label="Last Checked At"
                          value={form?.createdAt || "-"}
                          fullWidth
                          disabled
                        />
                        <TextField
                          label="Message"
                          value={form?.active ? "Connection is available." : "Connection is inactive."}
                          fullWidth
                          disabled
                          multiline
                          minRows={3}
                        />
                      </Box>
                    </Paper>
                  ) : null}
                </Box>
              </>
            )}
          </div>
    </div>
  );
}
