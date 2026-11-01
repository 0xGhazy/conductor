import React, { useEffect, useState, useRef } from "react";
import { Braces as BracesIcon, RefreshCcw } from "lucide-react";
import { FaJava } from "react-icons/fa";
import { SiJavascript, SiPython } from "react-icons/si";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Autocomplete from "@mui/material/Autocomplete";
import { Stack, IconButton, Typography, CircularProgress, Tooltip, InputAdornment } from "@mui/material";
import { WeaverTextField, WeaverSelectField } from "@/components/common/fields";
import { WeaverCodeEditor, toWeaverSuggestions, type WeaverEditorLanguage } from "@/components/common/editors";

import {
  normalizeScriptLanguage,
  normalizeVariablesMap,
  getScriptTimeoutInputValue,
} from "@/features/designer/components/actions/script/model/scriptActionDto";
import { useScriptStore } from "@/features/designer/components/actions/script/ScriptNode";

const SCRIPT_LANGUAGE_OPTIONS = [
  { value: "PYTHON", label: "Python", editorLanguage: "python" as WeaverEditorLanguage, icon: SiPython, color: "#3776ab" },
  { value: "JAVASCRIPT", label: "JavaScript", editorLanguage: "javascript" as WeaverEditorLanguage, icon: SiJavascript, color: "#f7df1e" },
  { value: "JEXL", label: "JEXL", editorLanguage: "jexl" as WeaverEditorLanguage, icon: FaJava, color: "#f89820" },
];

const getEditorLanguageForScriptLanguage = (value: string): WeaverEditorLanguage => {
  const language = normalizeScriptLanguage(value);
  return SCRIPT_LANGUAGE_OPTIONS.find((option) => option.value === language)?.editorLanguage || "jexl";
};

const getScriptLanguageOption = (value: string) => {
  const language = normalizeScriptLanguage(value);
  return SCRIPT_LANGUAGE_OPTIONS.find((option) => option.value === language) || SCRIPT_LANGUAGE_OPTIONS[2];
};

const stringifyVariables = (value: any) => JSON.stringify(normalizeVariablesMap(value), null, 2);

interface ScriptLanguageOptionLabelProps {
  option: typeof SCRIPT_LANGUAGE_OPTIONS[0];
}

function ScriptLanguageOptionLabel({ option }: ScriptLanguageOptionLabelProps) {
  const Icon = option.icon;
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Box
        component="span"
        className="script-language-icon"
        sx={{
          color: option.color,
          bgcolor: `${option.color}18`,
        }}
      >
        <Icon size={16} />
      </Box>
      <Typography component="span" variant="body2" sx={{ fontWeight: 700 }}>
        {option.label}
      </Typography>
    </Stack>
  );
}

interface ScriptConfigFormProps {
  data: any;
  onChange: (patch: any) => void;
  validationErrors?: Record<string, string>;
  parameterOptions?: Array<string | { value: string; label: string }>;
  nodeLabel?: string;
  referencePlaceholder?: string;
  expressionLabel?: string;
  showLanguageSelector?: boolean;
}

export function ScriptConfigForm({
  data,
  onChange,
  validationErrors = {},
  parameterOptions = [],
  nodeLabel = "Script",
  referencePlaceholder = "script_xxxxxxxx",
  expressionLabel = "Script",
  showLanguageSelector = false,
}: ScriptConfigFormProps) {
  const cfg = data?.config || {};
  const { templates, loading: loadingScripts, error: scriptsError, fetchTemplates } = useScriptStore();

  const [variableKeyDrafts, setVariableKeyDrafts] = useState<Record<string, string>>({});
  const [activeVariableAutocompleteKey, setActiveVariableAutocompleteKey] = useState("");
  const nodeName = data?.name ?? "";
  const [expressionText, setExpressionText] = useState(cfg.expression ?? "");
  const [variablesJsonText, setVariablesJsonText] = useState(() => stringifyVariables(cfg.variables));
  const [variablesJsonError, setVariablesJsonError] = useState("");
  const variablesJsonLocalUpdateRef = useRef(false);
  const variablesJsonParseTimerRef = useRef<number | null>(null);

  const variablesEndRef = useRef<HTMLDivElement>(null);
  const prevRowsCount = useRef(0);

  const selectedLanguage = normalizeScriptLanguage(cfg.language ?? cfg.scriptLanguage);
  const editorLanguage = showLanguageSelector
    ? getEditorLanguageForScriptLanguage(selectedLanguage)
    : "javascript";
  const timeoutValue = showLanguageSelector ? getScriptTimeoutInputValue(cfg) : "";

  const leftColumnSx = showLanguageSelector
    ? { gridColumn: { xs: "1", md: "1" }, minWidth: 0 }
    : undefined;
  const leftFullWidthSx = {
    gridColumn: { xs: "1", md: showLanguageSelector ? "1" : "1 / span 2" },
    minWidth: 0,
  };
  const scriptRuntimeRowSx = {
    ...leftFullWidthSx,
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 1.5,
    alignItems: "start",
  };
  const editorColumnSx = {
    gridColumn: { xs: "1", md: showLanguageSelector ? "2" : "1 / span 2" },
    gridRow: { xs: "auto", md: showLanguageSelector ? "1 / span 9" : "auto" },
    minWidth: 0,
  };
  const variablesColumnSx = showLanguageSelector
    ? {
      gridColumn: { xs: "1", md: "1" },
      gridRow: { xs: "auto", md: "4 / span 6" },
      alignSelf: "stretch",
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
      minWidth: 0,
    }
    : leftFullWidthSx;

  const anchorRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    setExpressionText(cfg.expression ?? "");
  }, [cfg.expression]);

  useEffect(() => {
    if (variablesJsonLocalUpdateRef.current) {
      variablesJsonLocalUpdateRef.current = false;
      return;
    }
    setVariablesJsonText(stringifyVariables(cfg.variables));
    setVariablesJsonError("");
  }, [cfg.variables]);

  const handleReloadScripts = () => {
    fetchTemplates(true);
  };

  const updateConfig = (patch: any) => {
    if (typeof onChange !== "function") return;
    onChange({
      config: patch,
    });
  };

  const handleNodeNameChange = (val: string) => {
    if (typeof onChange !== "function") return;
    onChange({
      name: val,
      config: {
        nodeName: val,
      },
    });
  };

  const handleScriptSelect = (script: any) => {
    const scriptVariables =
      script?.variables && typeof script.variables === "object" && !Array.isArray(script.variables)
        ? script.variables
        : {};
    const backendKeys = Object.keys(scriptVariables);
    const existingVariables =
      cfg?.variables && typeof cfg.variables === "object" && !Array.isArray(cfg.variables)
        ? cfg.variables
        : {};
    const nextVariables = backendKeys.reduce((acc: any, key) => {
      acc[key] = existingVariables[key] ?? "";
      return acc;
    }, {});

    updateConfig({
      scriptId: script.id,
      scriptName: script.name,
      expression: script.script,
      variables: nextVariables,
      isAdHoc: false,
      ...(showLanguageSelector ? { language: normalizeScriptLanguage(script.language ?? selectedLanguage) } : {}),
    });
    setMenuOpen(false);
  };

  const variablesMap = normalizeVariablesMap(cfg?.variables);
  const variableRows = Object.entries(variablesMap);

  // Auto-scroll variables container when a variable is added
  useEffect(() => {
    if (variableRows.length > prevRowsCount.current) {
      variablesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevRowsCount.current = variableRows.length;
  }, [variableRows.length]);

  const completionOptions = React.useMemo(() => {
    if (!Array.isArray(parameterOptions)) return [];
    const seen = new Set<string>();
    return parameterOptions.reduce((acc: string[], option) => {
      const raw =
        typeof option === "string"
          ? option
          : typeof option?.value === "string"
            ? option.value
            : "";
      const normalized = String(raw ?? "").trim();
      if (!normalized || seen.has(normalized)) return acc;
      seen.add(normalized);
      acc.push(normalized);
      return acc;
    }, []);
  }, [parameterOptions]);

  const handleVariableValueChange = (key: string, value: any) => {
    updateConfig({
      variables: {
        ...variablesMap,
        [key]: value,
      },
    });
  };

  const handleVariableKeyChange = (oldKey: string, newKeyRaw: string) => {
    setVariableKeyDrafts((prev) => ({
      ...prev,
      [oldKey]: newKeyRaw,
    }));
  };

  const handleVariableKeyCommit = (oldKey: string) => {
    const drafted = Object.prototype.hasOwnProperty.call(variableKeyDrafts, oldKey)
      ? variableKeyDrafts[oldKey]
      : oldKey;
    const newKeyRaw = drafted;
    const newKey = String(newKeyRaw || "").trim();
    if (!newKey || newKey === oldKey) {
      setVariableKeyDrafts((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, oldKey)) return prev;
        const next = { ...prev };
        delete next[oldKey];
        return next;
      });
      return;
    }
    if (Object.prototype.hasOwnProperty.call(variablesMap, newKey)) {
      setVariableKeyDrafts((prev) => ({
        ...prev,
        [oldKey]: oldKey,
      }));
      return;
    }
    const nextVariables = { ...variablesMap };
    const oldValue = nextVariables[oldKey];
    delete nextVariables[oldKey];
    nextVariables[newKey] = oldValue;
    updateConfig({ variables: nextVariables });
    if (activeVariableAutocompleteKey === oldKey) {
      setActiveVariableAutocompleteKey(newKey);
    }
    setVariableKeyDrafts((prev) => {
      const next = { ...prev };
      delete next[oldKey];
      return next;
    });
  };

  const handleAddVariable = () => {
    let index = variableRows.length + 1;
    let key = `param${index}`;
    while (Object.prototype.hasOwnProperty.call(variablesMap, key)) {
      index += 1;
      key = `param${index}`;
    }
    updateConfig({
      variables: {
        ...variablesMap,
        [key]: "",
      },
    });
  };

  const handleDeleteVariable = (key: string) => {
    const nextVariables = { ...variablesMap };
    delete nextVariables[key];
    updateConfig({ variables: nextVariables });
    if (activeVariableAutocompleteKey === key) {
      setActiveVariableAutocompleteKey("");
    }
  };

  const handleVariableValueKeyDown = (key: string, event: React.KeyboardEvent) => {
    const isCtrlSpace =
      event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      (event.code === "Space" || event.key === " ");
    if (!isCtrlSpace) return;
    event.preventDefault();
    event.stopPropagation();
    if (completionOptions.length === 0) return;
    setActiveVariableAutocompleteKey(key);
  };

  const applyConfigPatch = (patch: any, { immediate = false } = {}) => {
    if (immediate) {
      updateConfig(patch);
      return;
    }
    React.startTransition(() => updateConfig(patch));
  };

  const commitVariablesJsonChange = (safeValue: string, options = {}) => {
    if (!safeValue.trim()) {
      setVariablesJsonError("");
      variablesJsonLocalUpdateRef.current = true;
      applyConfigPatch({ variables: {} }, options);
      return;
    }

    try {
      const parsed = JSON.parse(safeValue);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setVariablesJsonError("Variables must be a JSON object.");
        return;
      }
      setVariablesJsonError("");
      variablesJsonLocalUpdateRef.current = true;
      applyConfigPatch({ variables: parsed }, options);
    } catch (error: any) {
      setVariablesJsonError(error?.message || "Invalid JSON.");
    }
  };

  const handleVariablesJsonChange = (nextValue?: string) => {
    const safeValue = nextValue ?? "";
    setVariablesJsonText(safeValue);

    if (variablesJsonParseTimerRef.current) {
      window.clearTimeout(variablesJsonParseTimerRef.current);
    }
    variablesJsonParseTimerRef.current = window.setTimeout(() => {
      variablesJsonParseTimerRef.current = null;
      commitVariablesJsonChange(safeValue);
    }, 350);
  };

  const flushVariablesJsonChange = (nextValue = variablesJsonText) => {
    if (variablesJsonParseTimerRef.current) {
      window.clearTimeout(variablesJsonParseTimerRef.current);
      variablesJsonParseTimerRef.current = null;
    }
    commitVariablesJsonChange(nextValue ?? "", { immediate: true });
  };

  useEffect(() => {
    return () => {
      if (variablesJsonParseTimerRef.current) {
        window.clearTimeout(variablesJsonParseTimerRef.current);
        variablesJsonParseTimerRef.current = null;
      }
    };
  }, []);

  return (
    <Box className={showLanguageSelector ? "script-config-layout" : "database-config-grid"}>
      <Box sx={leftColumnSx}>
        <WeaverTextField
          label="Node Name *"
          value={nodeName}
          onChange={handleNodeNameChange}
          placeholder={nodeLabel}
        />
      </Box>
      <Box sx={leftColumnSx}>
        <WeaverTextField
          label="Reference Name"
          value={cfg.name ?? cfg.referenceName ?? cfg.reference ?? cfg.taskReferenceName ?? ""}
          onChange={(val) => {
            updateConfig({
              name: val,
              referenceName: val,
              reference: val,
              taskReferenceName: val,
            });
          }}
          errorMessage={validationErrors.referenceName || undefined}
          placeholder={referencePlaceholder}
        />
      </Box>

      {showLanguageSelector ? (
        <Box sx={scriptRuntimeRowSx}>
          <WeaverSelectField
            id="script-language-select"
            label="Language"
            value={selectedLanguage}
            onChange={(value) => updateConfig({ language: normalizeScriptLanguage(value as string) })}
            renderValue={(value) => (
              <ScriptLanguageOptionLabel option={getScriptLanguageOption(value as string)} />
            )}
            options={SCRIPT_LANGUAGE_OPTIONS.map((option) => {
              const Icon = option.icon;
              return {
                label: option.label,
                value: option.value,
                icon: (
                  <Box
                    component="span"
                    className="script-language-icon"
                    sx={{ color: option.color, bgcolor: `${option.color}18` }}
                  >
                    <Icon size={16} />
                  </Box>
                ),
              };
            })}
          />
          <WeaverTextField
            label="Timeout (ms)"
            type="number"
            value={String(timeoutValue)}
            onChange={(rawValue) => {
              const parsedValue = Number(rawValue);
              updateConfig({
                timeout:
                  rawValue === ""
                    ? ""
                    : Number.isFinite(parsedValue)
                      ? parsedValue
                      : rawValue,
              });
            }}
            inputProps={{ min: 1, step: 100 }}
          />
        </Box>
      ) : null}

      {!showLanguageSelector ? (
        <Box ref={anchorRef} sx={leftFullWidthSx}>
          <WeaverTextField
            label="Script name"
            value={cfg.scriptName || ""}
            onChange={(value) =>
              updateConfig({
                scriptName: value,
                isAdHoc: cfg.scriptId ? cfg.isAdHoc : true,
              })
            }
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Reload scripts">
                      <span>
                        <IconButton
                          edge="end"
                          size="large"
                          onClick={handleReloadScripts}
                          disabled={loadingScripts}
                          sx={{ color: "var(--color-fg-default, #111827)" }}
                        >
                          {loadingScripts ? (
                            <CircularProgress size={16} />
                          ) : (
                            <RefreshCcw size={16} />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Load script from templates">
                      <IconButton edge="end" size="large" onClick={() => setMenuOpen(true)}>
                        <BracesIcon size={16} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </InputAdornment>
              ),
            }}
          />
        </Box>
      ) : null}

      {scriptsError && (
        <Typography variant="caption" color="error" sx={leftFullWidthSx}>
          {scriptsError}
        </Typography>
      )}

      <Box sx={editorColumnSx}>
        {!showLanguageSelector ? (
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {expressionLabel}
          </Typography>
        ) : null}
        <WeaverCodeEditor
          className="start-config-json-editor"
          language={editorLanguage}
          value={expressionText}
          height={showLanguageSelector ? "520px" : "220px"}
          suggestions={toWeaverSuggestions(parameterOptions)}
          onChange={(nextValue) => {
            const safeValue = nextValue ?? "";
            setExpressionText(safeValue);
            applyConfigPatch({
              expression: safeValue,
              isAdHoc: cfg.scriptId ? cfg.isAdHoc : true,
            });
          }}
          onBlur={(nextValue) =>
            applyConfigPatch({
              expression: nextValue ?? "",
              isAdHoc: cfg.scriptId ? cfg.isAdHoc : true,
            }, { immediate: true })
          }
          options={{ lineNumbers: "on" }}
        />
      </Box>

      <Box sx={variablesColumnSx}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle2">Variables</Typography>
          {!showLanguageSelector ? (
            <IconButton aria-label="add-variable" size="small" onClick={handleAddVariable}>
              <AddIcon fontSize="small" />
            </IconButton>
          ) : null}
        </Stack>
        {showLanguageSelector ? (
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <Box sx={{ flex: 1, minHeight: 180 }}>
              <WeaverCodeEditor
                className="start-config-json-editor script-variables-editor"
                language="json"
                value={variablesJsonText}
                height="100%"
                suggestions={toWeaverSuggestions(parameterOptions)}
                onChange={handleVariablesJsonChange}
                onBlur={flushVariablesJsonChange}
                options={{ lineNumbers: "on" }}
              />
            </Box>
            {variablesJsonError ? (
              <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.75 }}>
                {variablesJsonError}
              </Typography>
            ) : null}
          </Box>
        ) : variableRows.length === 0 ? (
          <Typography variant="caption" sx={{ color: "var(--color-fg-muted)" }}>
            No variables.
          </Typography>
        ) : (
          <Box className="database-params-grid" sx={{ maxHeight: 300, overflowY: "auto", pr: 1 }}>
            {variableRows.map(([key, value]) => {
              return (
                <Box key={key} className="database-params-row">
                  <WeaverTextField
                    label="Key"
                    value={
                      Object.prototype.hasOwnProperty.call(variableKeyDrafts, key)
                        ? variableKeyDrafts[key]
                        : key
                    }
                    onChange={(value) => handleVariableKeyChange(key, value)}
                    onBlur={() => handleVariableKeyCommit(key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleVariableKeyCommit(key);
                      }
                    }}
                    disabled={false}
                    helperText=""
                  />
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ flex: 1 }}>
                      <Autocomplete
                        freeSolo
                        forcePopupIcon={false}
                        options={completionOptions}
                        open={
                          activeVariableAutocompleteKey === key &&
                          completionOptions.length > 0
                        }
                        value={value == null ? "" : String(value)}
                        inputValue={value == null ? "" : String(value)}
                        onClose={() => {
                          if (activeVariableAutocompleteKey === key) {
                            setActiveVariableAutocompleteKey("");
                          }
                        }}
                        onInputChange={(_event, nextInputValue, reason) => {
                          if (reason === "input" || reason === "clear") {
                            handleVariableValueChange(key, nextInputValue ?? "");
                            if (completionOptions.length > 0) {
                              setActiveVariableAutocompleteKey(key);
                            }
                          }
                        }}
                        onChange={(_event, nextValue) => {
                          const resolvedValue =
                            typeof nextValue === "string"
                              ? nextValue
                              : String(nextValue ?? "");
                          handleVariableValueChange(key, resolvedValue);
                          setActiveVariableAutocompleteKey("");
                        }}
                        renderInput={(autocompleteParams) => (
                          <WeaverTextField
                            {...autocompleteParams}
                            label="Value"
                            helperText=""
                            placeholder={`Enter ${key}`}
                            onKeyDown={(event) => handleVariableValueKeyDown(key, event)}
                            inputProps={{
                              ...autocompleteParams.inputProps,
                              autoComplete: "off",
                            }}
                          />
                        )}
                      />
                    </Box>
                    <IconButton
                      aria-label="delete-variable"
                      size="small"
                      disabled={false}
                      onClick={() => handleDeleteVariable(key)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Box>
              );
            })}
            <div ref={variablesEndRef} />
          </Box>
        )}
      </Box>

      <Menu
        id="jexl-script-menu"
        anchorEl={anchorRef.current}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        PaperProps={{
          sx: {
            width: anchorRef.current ? anchorRef.current.offsetWidth : undefined,
          },
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {loadingScripts && (
          <MenuItem disabled>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
              <CircularProgress size={16} />
              <span>Loading scripts...</span>
            </Stack>
          </MenuItem>
        )}
        {!loadingScripts && scriptsError && <MenuItem disabled>Failed to load scripts.</MenuItem>}
        {!loadingScripts && !scriptsError && templates.length === 0 && (
          <MenuItem disabled>No scripts available</MenuItem>
        )}
        {templates.map((script) => (
          <MenuItem key={script.id} onClick={() => handleScriptSelect(script)}>
            {script.name}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
