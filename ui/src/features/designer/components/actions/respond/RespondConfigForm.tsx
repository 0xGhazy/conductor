import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import InputAdornment from "@mui/material/InputAdornment";
import CircularProgress from "@mui/material/CircularProgress";
import Autocomplete from "@mui/material/Autocomplete";
import { RefreshCcw, Braces as BracesIcon, Plus } from "lucide-react";
import { WeaverTextField } from "@/components/common/fields";
import { translationApi } from "@/features/translations";
import type {
  RespondNodeData,
  RespondActionConfig,
} from "@/features/designer/components/actions/respond/model/respondDto";
import type { WorkflowTranslationsMap } from "@/features/translations";

const DEFAULT_LANGUAGE_EXPRESSION = "${workflow.input._language}";
const DEFAULT_LANGUAGE_LABEL = "Workflow input language";

export interface RespondConfigFormProps {
  data?: RespondNodeData | null;
  onChange?: (patch: Partial<RespondNodeData>) => void;
  validationErrors?: Record<string, string>;
  parameterOptions?: Array<string | { value?: string; label?: string; id?: string }>;
  workflowName?: string;
  workflowVersion?: number | string;
  onOpenTranslationsModal?: () => void;
}

export function RespondConfigForm({
  data,
  onChange,
  validationErrors = {},
  parameterOptions = [],
  workflowName = "",
  workflowVersion = 1,
  onOpenTranslationsModal,
}: RespondConfigFormProps) {
  const cfg = data?.config ?? {};
  const actionName = data?.name || "Respond";
  const currentWorkflowName = workflowName || "";
  const currentWorkflowVersion = workflowVersion || 1;

  const [translationsMap, setTranslationsMap] = useState<WorkflowTranslationsMap>({});
  const [loadingTranslations, setLoadingTranslations] = useState(false);
  const [translationsError, setTranslationsError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const messageCodeFieldAnchorRef = useRef<HTMLDivElement>(null);

  const fetchTranslations = async () => {
    if (!currentWorkflowName) return;
    setLoadingTranslations(true);
    setTranslationsError("");
    try {
      const map = await translationApi.fetchWorkflowTranslationsMap(
        currentWorkflowName,
        currentWorkflowVersion
      );
      setTranslationsMap(map || {});
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to load translations.";
      setTranslationsError(errorMsg);
      setTranslationsMap({});
    } finally {
      setLoadingTranslations(false);
    }
  };

  useEffect(() => {
    fetchTranslations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkflowName, currentWorkflowVersion]);

  useEffect(() => {
    if (!cfg.languageCode || cfg.languageCode === "default") {
      updateConfig({ languageCode: DEFAULT_LANGUAGE_EXPRESSION });
    }
  }, []);

  const updateConfig = (patch: Partial<RespondActionConfig>) => {
    if (!onChange) return;
    onChange({
      config: {
        ...cfg,
        ...patch,
      },
    });
  };

  const handleActionNameChange = (value: string) => {
    if (!onChange) return;
    onChange({
      name: value,
    });
  };

  const handleReferenceNameChange = (value: string) => {
    updateConfig({
      name: value,
      referenceName: value,
      taskReferenceName: value,
    });
  };

  const handleMessageCodeChange = (value: string) => {
    updateConfig({ messageCode: value });
  };

  const handleReloadTranslations = (e?: React.MouseEvent) => {
    e?.stopPropagation?.();
    fetchTranslations();
  };

  const openMenu = (e?: React.MouseEvent) => {
    e?.stopPropagation?.();
    setMenuOpen(true);
    fetchTranslations();
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const handleMessageCodeSelect = (code: string) => {
    updateConfig({ messageCode: code });
    closeMenu();
  };

  const messageCodes = useMemo(() => Object.keys(translationsMap), [translationsMap]);
  const selectedMessageCode = cfg.messageCode || "";

  const languageOptions = useMemo<string[]>(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    const add = (val: string) => {
      const trimmed = String(val ?? "").trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      result.push(trimmed);
    };

    add(DEFAULT_LANGUAGE_EXPRESSION);

    // Workflow parameters from contextMap
    if (Array.isArray(parameterOptions)) {
      parameterOptions.forEach((opt) => {
        const raw = typeof opt === "string" ? opt : opt?.value || opt?.label || "";
        if (raw) {
          const str = String(raw).trim();
          const formatted = str.startsWith("${") && str.endsWith("}") ? str : `\${${str}}`;
          add(formatted);
        }
      });
    }

    return result;
  }, [parameterOptions]);

  return (
    <Box>
      <Box className="database-config-grid">
        <Box>
          <WeaverTextField
            label="Node Name *"
            value={actionName}
            onChange={handleActionNameChange}
            disabled={false}
            helperText=""
            placeholder="Respond"
          />
        </Box>
        <Box>
          <WeaverTextField
            label="Reference Name"
            value={cfg.referenceName || cfg.name || ""}
            onChange={handleReferenceNameChange}
            disabled={false}
            errorMessage={validationErrors.referenceName || undefined}
            placeholder="respond_xxxxxxxx"
          />
        </Box>
        <Box ref={messageCodeFieldAnchorRef}>
          <WeaverTextField
            label="Message Code *"
            value={cfg.messageCode || ""}
            onChange={handleMessageCodeChange}
            placeholder=""
            errorMessage={validationErrors.messageCode || undefined}
            helperText={!messageCodes.length && !loadingTranslations ? "No message codes available." : ""}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Reload message codes">
                      <IconButton
                        size="small"
                        onClick={handleReloadTranslations}
                        disabled={loadingTranslations}
                        sx={{ color: "var(--color-fg-muted, #64748b)" }}
                      >
                        {loadingTranslations ? (
                          <CircularProgress size={14} />
                        ) : (
                          <RefreshCcw size={14} />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Pick from defined message codes">
                      <IconButton
                        size="large"
                        onClick={openMenu}
                        disableRipple={false}
                        sx={{ color: "var(--color-fg-default, #111827)" }}
                      >
                        <BracesIcon size={16} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </InputAdornment>
              ),
            }}
          />
        </Box>
        <Box>
          <Autocomplete
            freeSolo
            options={languageOptions}
            value={
              cfg.languageCode && cfg.languageCode !== "default"
                ? cfg.languageCode
                : DEFAULT_LANGUAGE_EXPRESSION
            }
            onChange={(_, newValue) => {
              const resolved = typeof newValue === "string" ? newValue.trim() : "";
              updateConfig({
                languageCode: resolved || DEFAULT_LANGUAGE_EXPRESSION,
              });
            }}
            onInputChange={(_, newInputValue, reason) => {
              if (reason === "input" || reason === "clear") {
                updateConfig({
                  languageCode: newInputValue?.trim() || DEFAULT_LANGUAGE_EXPRESSION,
                });
              }
            }}
            renderOption={(props, option) => (
              <li {...props} key={option}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: "monospace",
                    }}
                  >
                    {option}
                  </Typography>
                  {option === DEFAULT_LANGUAGE_EXPRESSION && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#0284c7",
                        ml: 1,
                        fontSize: "10px",
                        fontWeight: 600,
                      }}
                    >
                      default
                    </Typography>
                  )}
                </Box>
              </li>
            )}
            renderInput={(params) => (
              <WeaverTextField
                {...params}
                label="Language Code"
                placeholder="${workflow.input._language}"
              />
            )}
          />
        </Box>
      </Box>

      {translationsError && (
        <Typography variant="caption" color="error" sx={{ mt: 1, display: "block" }}>
          {translationsError}
        </Typography>
      )}

      <Menu
        id="respond-message-code-menu"
        anchorEl={messageCodeFieldAnchorRef.current}
        open={menuOpen}
        onClose={closeMenu}
        PaperProps={{
          sx: {
            width: messageCodeFieldAnchorRef.current
              ? messageCodeFieldAnchorRef.current.offsetWidth
              : undefined,
            maxHeight: 320,
          },
        }}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
      >
        {loadingTranslations && (
          <MenuItem disabled>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent="center"
            >
              <CircularProgress size={16} />
              <span>Loading message codes...</span>
            </Stack>
          </MenuItem>
        )}
        {!loadingTranslations && translationsError && (
          <MenuItem disabled>Failed to load message codes.</MenuItem>
        )}
        {!loadingTranslations && !translationsError && messageCodes.length === 0 && (
          <MenuItem disabled>No message codes available</MenuItem>
        )}
        {messageCodes.map((code) => (
          <MenuItem
            key={code}
            selected={code === (cfg.messageCode || "")}
            onClick={() => handleMessageCodeSelect(code)}
          >
            {code}
          </MenuItem>
        ))}
        {onOpenTranslationsModal ? (
          <>
            <Divider />
            <MenuItem
              onClick={() => {
                closeMenu();
                onOpenTranslationsModal();
              }}
              sx={{
                color: "var(--color-accent-fg)",
                fontSize: "0.85rem",
                fontWeight: 500,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Plus size={14} />
                <span>Manage translations...</span>
              </Stack>
            </MenuItem>
          </>
        ) : null}
      </Menu>
    </Box>
  );
}
