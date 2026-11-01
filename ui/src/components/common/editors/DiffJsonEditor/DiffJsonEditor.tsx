import { useCallback, useMemo } from "react";
import { DiffEditor, type Monaco } from "../internal/monacoSetup";
import { useTheme } from "@mui/material/styles";
import type { WeaverThemeMode } from "../WeaverCodeEditor/WeaverCodeEditor.types";
import { registerWeaverThemes, resolveMonacoTheme } from "../internal/editorTheme";

/**
 * Read-only (by default) JSON diff editor.
 *
 * `theme` accepts a Weaver theme mode ("auto" | "light" | "dark") so it shares the
 * same Monaco theme as WeaverCodeEditor; Monaco themes are global, so using a
 * different theme here would restyle every open editor. "vs"/"vs-dark" map to the
 * Weaver light/dark themes; any other string is passed through as a Monaco theme name.
 */
export default function DiffJsonEditor({
  original = "",
  modified = "",
  height = "100%",
  theme = "auto",
  language = "json",
  readOnly = true,
  renderSideBySide = false,
  onChange,
}: any) {
  const muiTheme = useTheme();
  const appMode = (muiTheme.palette.mode as "light" | "dark") || "light";

  const resolvedTheme = useMemo(() => {
    if (theme === "auto" || theme === "light" || theme === "dark") {
      return resolveMonacoTheme(theme as WeaverThemeMode, appMode);
    }
    // Built-in Monaco base themes map onto the matching Weaver theme so a diff view
    // never flips the global Monaco theme away from the one other editors use.
    if (theme === "vs") return resolveMonacoTheme("light", appMode);
    if (theme === "vs-dark" || theme === "hc-black") return resolveMonacoTheme("dark", appMode);
    return theme;
  }, [theme, appMode]);

  const handleBeforeMount = useCallback((monacoInstance: Monaco) => {
    registerWeaverThemes(monacoInstance);
  }, []);

  const options = useMemo(
    () => ({
      minimap: { enabled: false },
      renderSideBySide,
      fontSize: 13,
      wordWrap: "on",
      scrollBeyondLastLine: false,
      stickyScroll: { enabled: false, maxNumStickyLines: 0 },
      readOnly,
    }),
    [renderSideBySide, readOnly]
  );

  const ReactDiffEditor = DiffEditor as any;
  return (
    <ReactDiffEditor
      height={height}
      language={language}
      theme={resolvedTheme}
      original={original}
      modified={modified}
      onChange={onChange}
      beforeMount={handleBeforeMount}
      options={options}
    />
  );
}
