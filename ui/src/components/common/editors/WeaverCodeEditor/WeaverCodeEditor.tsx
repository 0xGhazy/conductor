import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Editor, type Monaco } from "../internal/monacoSetup";
import type * as monaco from "monaco-editor";
import { useTheme } from "@mui/material/styles";
import { CircularProgress, Tooltip } from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";

import type {
  WeaverCodeEditorProps,
  WeaverEditorInstance,
  WeaverEditorLanguage,
} from "./WeaverCodeEditor.types";
import {
  applyWeaverTheme,
  registerWeaverThemes,
  resolveMonacoTheme,
} from "../internal/editorTheme";
import {
  getWeaverModelUri,
  useEditorModel,
} from "../internal/useEditorModel";
import { useEditorViewState } from "../internal/useEditorViewState";
import { useEditorSuggestions } from "../internal/useEditorSuggestions";
import {
  LANGUAGE_SNIPPETS,
  SCRIPT_LANGUAGES,
  registerWeaverLanguages,
  useEditorDiagnostics,
} from "../internal/languageSupport";
import styles from "./WeaverCodeEditor.module.css";

const EDITOR_INPUT_SHIELD_CLASSES = "nokey nodrag nowheel nopan";

const LANGUAGE_LABELS: Record<WeaverEditorLanguage, string> = {
  javascript: "JavaScript",
  python: "Python",
  java: "Java",
  json: "JSON",
  sql: "SQL",
  jexl: "JEXL",
  bash: "Bash",
  plaintext: "Text",
};

/** Script languages rely on explicit snippets rather than noisy word-based suggestions */
const SCRIPT_LANGUAGE_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  quickSuggestionsDelay: 300,
  quickSuggestions: false,
  acceptSuggestionOnCommitCharacter: false,
  wordBasedSuggestions: "off",
};

/**
 * Normalizes line endings to LF (\n) to prevent CRLF vs LF mismatches
 * on Windows that can cause spurious controlled value updates and cursor jumps.
 */
function normalizeEol(str: string | undefined | null): string {
  return (str ?? "").replace(/\r\n/g, "\n");
}

const defaultMonacoOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  scrollBeyondLastLine: false,
  fontSize: 13,
  tabSize: 2,
  wordWrap: "on",
  lineNumbers: "on",
  renderLineHighlight: "all",
  fixedOverflowWidgets: true,
  minimap: { enabled: false },
  scrollbar: {
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8,
    alwaysConsumeMouseWheel: false,
  },
  suggest: {
    showWords: false,
  },
  stickyScroll: {
    enabled: false,
    maxNumStickyLines: 0,
  },
  smoothScrolling: true,
};

function WeaverCodeEditorComponent({
  language,
  value,
  defaultValue,
  onChange,
  onBlur,
  modelKey,
  readOnly = false,
  width = "100%",
  height = 320,
  themeMode = "auto",
  allowFullscreen = true,
  runnable = false,
  runShortcut = true,
  onRun,
  suggestions,
  suggestionProvider,
  options,
  toolbarExtra,
  className = "",
  onMount,
  beforeMount,
  ...restEditorProps
}: WeaverCodeEditorProps) {
  const muiTheme = useTheme();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const editorRef = useRef<WeaverEditorInstance | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const onRunRef = useRef(onRun);
  const onBlurRef = useRef(onBlur);
  const runShortcutRef = useRef(runShortcut);
  const isRunningRef = useRef(isRunning);
  const lastEmittedValueRef = useRef<string | null>(null);
  const isApplyingExternalValueRef = useRef(false);

  useEffect(() => {
    onRunRef.current = onRun;
  }, [onRun]);

  useEffect(() => {
    onBlurRef.current = onBlur;
  }, [onBlur]);

  useEffect(() => {
    runShortcutRef.current = runShortcut;
  }, [runShortcut]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  // Derive active Monaco theme based on themeMode & MUI mode
  const activeThemeName = useMemo(() => {
    const appMode = (muiTheme.palette.mode as "light" | "dark") || "light";
    return resolveMonacoTheme(themeMode, appMode);
  }, [themeMode, muiTheme.palette.mode]);

  // Imperatively apply theme when activeThemeName changes without remounting
  useEffect(() => {
    if (monacoRef.current && isReady) {
      applyWeaverTheme(monacoRef.current, activeThemeName);
    }
  }, [activeThemeName, isReady]);

  // Unified execution handler for both Run button & F5 shortcut
  const handleExecute = useCallback(async () => {
    if (!onRunRef.current || isRunningRef.current) return;
    const currentCode = editorRef.current ? editorRef.current.getValue() : "";
    setIsRunning(true);
    try {
      await onRunRef.current(currentCode);
    } catch (err) {
      console.error("WeaverCodeEditor onRun execution error:", err);
    } finally {
      setIsRunning(false);
    }
  }, []);

  // Built-in language snippets come first, caller suggestions extend them
  const effectiveSuggestions = useMemo(() => {
    const snippets = LANGUAGE_SNIPPETS[language];
    if (!snippets) return suggestions;
    return suggestions?.length ? [...snippets, ...suggestions] : snippets;
  }, [language, suggestions]);

  // Internal suggestions provider management
  useEditorSuggestions({
    editor: editorRef.current,
    monaco: monacoRef.current,
    language,
    suggestions: effectiveSuggestions,
    suggestionProvider,
  });

  // Lightweight syntax diagnostics for script languages
  useEditorDiagnostics(isReady ? editorRef.current : null, monacoRef.current, language);

  // Persistent model management across tabs and model keys
  useEditorModel({
    editor: editorRef.current,
    monaco: monacoRef.current,
    modelKey,
    language,
    initialValue: value ?? defaultValue ?? "",
  });

  // Preserve cursor, selection, and scroll view state by modelKey
  useEditorViewState(editorRef.current, modelKey);

  // Controlled value synchronization:
  // Carefully compares normalized text to avoid replacing the model during user typing,
  // preventing the cursor from jumping to EOF.
  useEffect(() => {
    const isControlled = value !== undefined;
    const editor = editorRef.current;
    if (!isControlled || !editor) return;

    const model = editor.getModel();
    if (!model) return;

    const targetNormalized = normalizeEol(value);
    const currentNormalized = normalizeEol(model.getValue());

    // 1. If editor model content already matches incoming value, do nothing
    if (targetNormalized === currentNormalized) {
      return;
    }

    // 2. If incoming value matches what was just emitted by user typing, do nothing
    if (targetNormalized === normalizeEol(lastEmittedValueRef.current)) {
      return;
    }

    // 3. Genuine external change (e.g. parent reset, form wipe, external fetch)
    // Capture cursor and selection to preserve position if possible
    const currentPosition = editor?.getPosition ? editor.getPosition() : null;
    const currentSelections = editor?.getSelections ? editor.getSelections() : null;

    const isReadOnly = Boolean(
      readOnly ||
      options?.readOnly ||
      (monacoRef.current &&
        editor.getOption?.(monacoRef.current.editor.EditorOption.readOnly))
    );

    if (isReadOnly) {
      isApplyingExternalValueRef.current = true;
      model.setValue(value ?? "");
      isApplyingExternalValueRef.current = false;
      if (currentPosition) {
        const lineCount = model.getLineCount();
        const targetLine = Math.min(currentPosition.lineNumber, lineCount);
        const maxCol = model.getLineMaxColumn(targetLine);
        const targetCol = Math.min(currentPosition.column, maxCol);
        editor.setPosition({ lineNumber: targetLine, column: targetCol });
      }
    } else {
      isApplyingExternalValueRef.current = true;
      editor.executeEdits("weaver-external-sync", [
        {
          range: model.getFullModelRange(),
          text: value ?? "",
          forceMoveMarkers: false,
        },
      ]);
      editor.pushUndoStop();
      isApplyingExternalValueRef.current = false;

      // Restore cursor position clamped to valid bounds in the new text
      if (currentPosition) {
        const lineCount = model.getLineCount();
        const targetLine = Math.min(currentPosition.lineNumber, lineCount);
        const maxCol = model.getLineMaxColumn(targetLine);
        const targetCol = Math.min(currentPosition.column, maxCol);
        editor.setPosition({ lineNumber: targetLine, column: targetCol });
      }
      if (currentSelections && currentSelections.length > 0) {
        editor.setSelections(currentSelections);
      }
    }
  }, [value, readOnly, options?.readOnly]);

  // Monaco beforeMount: register themes
  const handleBeforeMount = useCallback(
    (monacoInstance: Monaco) => {
      monacoRef.current = monacoInstance;
      registerWeaverThemes(monacoInstance);
      registerWeaverLanguages(monacoInstance);
      beforeMount?.(monacoInstance);
    },
    [beforeMount]
  );

  // Monaco onMount: store ref, bind F5, apply theme, layout
  const handleMount = useCallback(
    (editor: WeaverEditorInstance, monacoInstance: Monaco) => {
      editorRef.current = editor;
      monacoRef.current = monacoInstance;
      setIsReady(true);

      // Force model EOL to LF for consistent line ending behavior
      const model = editor.getModel();
      if (model && typeof model.setEOL === "function" && monacoInstance.editor?.EndOfLineSequence) {
        model.setEOL(monacoInstance.editor.EndOfLineSequence.LF);
      }

      // Apply initial theme
      applyWeaverTheme(monacoInstance, activeThemeName);

      // Register F5 command
      editor.addCommand(monacoInstance.KeyCode.F5, () => {
        if (runShortcutRef.current && onRunRef.current) {
          void handleExecute();
        }
      });

      editor.onDidBlurEditorText(() => {
        onBlurRef.current?.(normalizeEol(editor.getValue()));
      });

      // Explicitly disable sticky scroll / line freezing on scroll upon mounting
      editor.updateOptions?.({
        stickyScroll: {
          enabled: false,
          maxNumStickyLines: 0,
        },
      });

      onMount?.(editor, monacoInstance);
    },
    [activeThemeName, handleExecute, onMount]
  );

  // Editor content change listener
  const handleContentChange = useCallback(
    (nextValue: string | undefined) => {
      if (isApplyingExternalValueRef.current) return;
      const normalizedValue = normalizeEol(nextValue);
      lastEmittedValueRef.current = normalizedValue;
      onChange?.(normalizedValue);
    },
    [onChange]
  );

  // Fullscreen layout recalculation & Escape key handling
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  useEffect(() => {
    // When fullscreen state changes or dimensions change, refresh Monaco layout
    const timer = window.setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.layout();
      }
    }, 50);

    return () => window.clearTimeout(timer);
  }, [isFullscreen, width, height]);

  // Merged Monaco options
  const mergedOptions = useMemo<monaco.editor.IStandaloneEditorConstructionOptions>(() => {
    return {
      ...defaultMonacoOptions,
      ...(language === "json"
        ? {
            formatOnPaste: true,
            formatOnType: true,
          }
        : {}),
      ...(SCRIPT_LANGUAGES.has(language) ? SCRIPT_LANGUAGE_OPTIONS : {}),
      ...options,
      readOnly: Boolean(readOnly || options?.readOnly),
      minimap: {
        ...defaultMonacoOptions.minimap,
        ...(options?.minimap || {}),
      },
      scrollbar: {
        ...defaultMonacoOptions.scrollbar,
        ...(options?.scrollbar || {}),
      },
      suggest: {
        ...defaultMonacoOptions.suggest,
        ...(options?.suggest || {}),
      },
      stickyScroll: {
        ...defaultMonacoOptions.stickyScroll,
        ...(options?.stickyScroll || {}),
        enabled: options?.stickyScroll?.enabled ?? false,
      },
    };
  }, [language, options, readOnly]);

  // Synchronize options directly to editor instance whenever mergedOptions change
  useEffect(() => {
    if (editorRef.current?.updateOptions) {
      editorRef.current.updateOptions(mergedOptions);
    }
  }, [mergedOptions]);

  const containerClasses = [
    styles.container,
    isFullscreen ? styles.fullscreen : "",
    EDITOR_INPUT_SHIELD_CLASSES,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const containerStyle: React.CSSProperties = isFullscreen
    ? {}
    : {
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
      };

  const showRunAction = Boolean(runnable && onRun);
  const runShortcutTooltip = runShortcut ? " (F5)" : "";

  const editorElement = (
    <div className={containerClasses} style={containerStyle}>
      {/* Toolbar */}
      <div className={styles.toolbar} role="toolbar" aria-label="Editor toolbar">
        <div className={styles.toolbarLeft}>
          <span className={styles.languageBadge}>
            {LANGUAGE_LABELS[language] || language}
          </span>
          {(readOnly || options?.readOnly) && <span className={styles.readOnlyBadge}>Read-Only</span>}
        </div>

        <div className={styles.toolbarRight}>
          {toolbarExtra}

          {showRunAction && (
            <Tooltip title={`Run code${runShortcutTooltip}`}>
              <button
                type="button"
                className={styles.runButton}
                onClick={handleExecute}
                disabled={isRunning}
                aria-label={`Run code${runShortcutTooltip}`}
              >
                {isRunning ? (
                  <CircularProgress size={12} color="inherit" />
                ) : (
                  <PlayArrowRoundedIcon sx={{ fontSize: 16 }} />
                )}
                <span>{isRunning ? "Running..." : "Run"}</span>
              </button>
            </Tooltip>
          )}

          {allowFullscreen && (
            <Tooltip
              title={isFullscreen ? "Exit fullscreen (Esc)" : "Enter fullscreen"}
            >
              <button
                type="button"
                className={styles.toolbarIconButton}
                onClick={() => setIsFullscreen((prev) => !prev)}
                aria-label={
                  isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                }
              >
                {isFullscreen ? (
                  <FullscreenExitIcon sx={{ fontSize: 18 }} />
                ) : (
                  <FullscreenIcon sx={{ fontSize: 18 }} />
                )}
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Monaco Editor Container */}
      <div className={styles.editorWrapper}>
        <Editor
          height="100%"
          width="100%"
          language={language}
          value={undefined}
          defaultValue={defaultValue ?? value}
          theme={activeThemeName}
          options={mergedOptions}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          onChange={handleContentChange}
          path={
            modelKey
              ? `inmemory://weaver/${encodeURIComponent(modelKey)}`
              : undefined
          }
          keepCurrentModel={Boolean(modelKey)}
          saveViewState={false} // Managed via our robust useEditorViewState
          {...restEditorProps}
        />
      </div>
    </div>
  );

  if (isFullscreen && typeof document !== "undefined") {
    return (
      <>
        <div
          style={{
            width: typeof width === "number" ? `${width}px` : width,
            height: typeof height === "number" ? `${height}px` : height,
          }}
          aria-hidden="true"
        />
        {createPortal(editorElement, document.body)}
      </>
    );
  }

  return editorElement;
}

export const WeaverCodeEditor = React.memo(WeaverCodeEditorComponent);
WeaverCodeEditor.displayName = "WeaverCodeEditor";
