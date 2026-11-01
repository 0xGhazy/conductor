import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import RefreshIcon from "@mui/icons-material/Refresh";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { useWeaverNotification } from "@/components/common/notifications";
import { WeaverButton } from "@/components/common/buttons";
import { getErrorMessage } from "@/utils/error";
import { toTimezoneDateTime } from "@/utils/dateTime";
import { createRedisDatasource, deleteRedisDatasource, redisDatasourceKeys, updateRedisDatasource, testRedisConnection, useRedisDatasource } from "@/features/redis";
import { buildEmptyRedisDatasource, buildRedisDatasourcePayload, normalizeRedisDatasource, validateRedisDatasource } from "@/features/redis";
import "@/styles/definitionPages.css";

const formatDateTime = (value: unknown) =>
  toTimezoneDateTime(value as string, "Africa/Cairo") || "-";

export default function RedisSourceViewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isCreateMode = location.pathname === "/redis/new";
  const { error: showError, success: showSuccess } = useWeaverNotification();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState(buildEmptyRedisDatasource());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  const redisSourceQuery = useRedisDatasource(id, { enabled: !isCreateMode });
  const { data: redisSourceResponse, error: redisSourceError, refetch: refetchRedisSource } = redisSourceQuery;
  const loading = !isCreateMode && Boolean(id) && redisSourceQuery.isPending;

  // Hydrate the form once per id, synchronously during render, so background refetches
  // never clobber in-progress edits.
  if (!isCreateMode && id && redisSourceResponse && hydratedFor !== id) {
    const body = redisSourceResponse?.data ?? {};
    const data = body?.data ?? body ?? {};
    setHydratedFor(id);
    setForm(normalizeRedisDatasource(data));
  }

  useEffect(() => {
    if (redisSourceError) showError(getErrorMessage(redisSourceError, "Failed to load Redis source."));
  }, [redisSourceError, showError]);

  const loadRedisSource = useCallback(async () => {
    if (!id || isCreateMode) return;
    await refetchRedisSource();
    setHydratedFor(null);
  }, [id, isCreateMode, refetchRedisSource]);

  const handleChange = (field: string, value: any) => {
    setForm((prev) => ({ ...(prev || {}), [field]: value }));
  };

  const handleUpdate = async () => {
    const nextErrors = validateRedisDatasource(form || {});
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSubmitting(true);
    try {
      if (isCreateMode) {
        const response = await createRedisDatasource(buildRedisDatasourcePayload(form));
        const body = response?.data ?? {};
        const created = body?.data ?? body ?? {};
        const createdId = String(created?.id || "").trim();

        void queryClient.invalidateQueries({ queryKey: redisDatasourceKeys.all });
        showSuccess("Redis datasource created successfully.");
        if (createdId) {
          navigate(`/redis/${encodeURIComponent(createdId)}`, {
            replace: true,
          });
        } else {
          navigate("/redis");
        }
      } else {
        await updateRedisDatasource(id!, buildRedisDatasourcePayload(form));
        showSuccess("Redis datasource updated successfully.");
        await queryClient.invalidateQueries({ queryKey: redisDatasourceKeys.all });
        setHydratedFor(null);
      }
    } catch (error) {
      showError(
        getErrorMessage(
          error,
          isCreateMode ? "Failed to create Redis datasource." : "Failed to update Redis datasource."
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    const confirmed = window.confirm("Delete this Redis datasource? This will close all active connections.");
    if (!confirmed) return;

    setSubmitting(true);
    try {
      await deleteRedisDatasource(id);
      // Mark stale without refetching the (now deleted) detail query that is still mounted.
      void queryClient.invalidateQueries({ queryKey: redisDatasourceKeys.all, refetchType: "none" });
      showSuccess("Redis datasource deleted successfully.");
      navigate("/redis");
    } catch (error) {
      showError(getErrorMessage(error, "Failed to delete Redis datasource."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestConnection = async () => {
    const nextErrors = validateRedisDatasource(form || {});
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setTestingConnection(true);
    try {
      const response = await testRedisConnection(buildRedisDatasourcePayload(form));
      const body = response?.data ?? {};
      const status = body?.data ?? body ?? {};
      const isOk = status?.reachable === true || status?.pingResult === "PONG";
      const message = body?.message || status?.message || "Successfully connected to Redis instance!";

      if (isOk) {
        showSuccess(message);
      } else {
        showError(message || "Failed to connect to Redis instance.");
      }
    } catch (error) {
      showError(getErrorMessage(error, "Connection test failed."));
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="definitions-page">

      <div className="definitions-content">
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate("/redis")}
              >
                Back
              </Button>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<HealthAndSafetyIcon />}
                  onClick={handleTestConnection}
                  disabled={loading || submitting || testingConnection}
                >
                  {testingConnection ? "Pinging..." : "Ping"}
                </Button>
                {!isCreateMode ? (
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={loadRedisSource}
                    disabled={loading || submitting}
                  >
                    Refresh
                  </Button>
                ) : null}
                {!isCreateMode ? (
                  <WeaverButton
                    mode="delete"
                    variant="outlined"
                    onAction={handleDelete}
                    disabled={submitting || loading}
                    holdLabel="Hold to delete..."
                  >
                    Delete
                  </WeaverButton>
                ) : null}
                <WeaverButton
                  mode={isCreateMode ? "save" : "update"}
                  variant="contained"
                  onAction={handleUpdate}
                  disabled={submitting || loading}
                  loadingLabel={isCreateMode ? "Creating..." : "Updating..."}
                >
                  {isCreateMode ? "Create" : "Update"}
                </WeaverButton>
              </Box>
            </Box>

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                <CircularProgress size={32} />
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
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
                      <span>Redis Connection Details</span>
                    </Box>
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
                    <TextField
                      label="Name"
                      value={form?.name || ""}
                      onChange={(e) => handleChange("name", e.target.value)}
                      fullWidth
                      error={Boolean(formErrors.name)}
                      helperText={formErrors.name}
                      disabled={!isCreateMode}
                    />
                    <TextField
                      label="Host"
                      value={form?.host || ""}
                      onChange={(e) => handleChange("host", e.target.value)}
                      fullWidth
                      error={Boolean(formErrors.host)}
                      helperText={formErrors.host}
                      placeholder="e.g. localhost or redis"
                    />
                    <TextField
                      label="Port"
                      type="number"
                      value={form?.port ?? 6379}
                      onChange={(e) => handleChange("port", e.target.value)}
                      fullWidth
                      error={Boolean(formErrors.port)}
                      helperText={formErrors.port}
                    />
                    <TextField
                      label="Database Index"
                      type="number"
                      value={form?.databaseIndex ?? 0}
                      onChange={(e) => handleChange("databaseIndex", e.target.value)}
                      fullWidth
                      error={Boolean(formErrors.databaseIndex)}
                      helperText={formErrors.databaseIndex}
                      placeholder="0-15"
                    />
                    <TextField
                      label="Username (optional)"
                      value={form?.username || ""}
                      onChange={(e) => handleChange("username", e.target.value)}
                      fullWidth
                    />
                    <TextField
                      label="Password (optional)"
                      type={showPassword ? "text" : "password"}
                      value={form?.password || ""}
                      onChange={(e) => handleChange("password", e.target.value)}
                      fullWidth
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
                    <TextField
                      label="Timeout (ms)"
                      type="number"
                      value={form?.timeoutMs ?? 2000}
                      onChange={(e) => handleChange("timeoutMs", e.target.value)}
                      fullWidth
                      error={Boolean(formErrors.timeoutMs)}
                      helperText={formErrors.timeoutMs}
                    />
                    <Box sx={{ display: "flex", gap: 3, gridColumn: { md: "1 / -1" } }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(form?.ssl)}
                            onChange={(e) => handleChange("ssl", e.target.checked)}
                          />
                        }
                        label="Use SSL"
                      />

                    </Box>

                    {!isCreateMode ? (
                      <>
                        <TextField
                          label="Created At"
                          value={formatDateTime(form?.createdAt)}
                          fullWidth
                          disabled
                        />
                        <TextField
                          label="Updated At"
                          value={formatDateTime(form?.updatedAt)}
                          fullWidth
                          disabled
                        />
                      </>
                    ) : null}
                  </Box>
                </Paper>
              </Box>
            )}
          </div>
    </div>
  );
}
