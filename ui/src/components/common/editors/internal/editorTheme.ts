import type { Monaco } from "@monaco-editor/react";
import type { WeaverThemeMode } from "../WeaverCodeEditor/WeaverCodeEditor.types";

export const WEAVER_DARK_THEME = "weaver-dark";
export const WEAVER_LIGHT_THEME = "weaver-light";

let themesRegistered = false;

/**
 * Registers custom Weaver light and dark Monaco themes matching the application's flat solid design system
 */
export function registerWeaverThemes(monaco: Monaco, force = false): void {
  if ((themesRegistered && !force) || !monaco?.editor?.defineTheme) return;
  themesRegistered = true;

  // Dark Theme (Solid Flat Background #101418, Coral Accent #FF5A5F, Teal Support #5BC8BC)
  monaco.editor.defineTheme(WEAVER_DARK_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "748391", fontStyle: "italic" },
      { token: "keyword", foreground: "FF5A5F", fontStyle: "bold" },
      { token: "keyword.sql", foreground: "FF5A5F", fontStyle: "bold" },
      { token: "operator.sql", foreground: "FF9B45" },
      { token: "predefined.sql", foreground: "5BC8BC" },
      { token: "string", foreground: "5BC8BC" },
      { token: "string.sql", foreground: "5BC8BC" },
      { token: "number", foreground: "FF9B45" },
      { token: "number.sql", foreground: "FF9B45" },
      { token: "type", foreground: "FF9B45" },
      { token: "identifier", foreground: "F2F5F7" },
      { token: "delimiter", foreground: "A9B4BF" },
      { token: "delimiter.bracket", foreground: "A9B4BF" },
      { token: "delimiter.comma", foreground: "A9B4BF" },
      { token: "delimiter.colon", foreground: "748391" },
    ],
    colors: {
      "editor.background": "#101418",
      "editor.foreground": "#F2F5F7",
      "editor.lineHighlightBackground": "#171D23",
      "editor.lineHighlightBorder": "#00000000",
      "editorLineNumber.foreground": "#748391",
      "editorLineNumber.activeForeground": "#FF5A5F",
      "editorCursor.foreground": "#FF5A5F",
      "editor.selectionBackground": "#26313A88",
      "editor.inactiveSelectionBackground": "#1D242B88",
      "editorWidget.background": "#171D23",
      "editorWidget.border": "#26313A",
      "editorSuggestWidget.background": "#171D23",
      "editorSuggestWidget.border": "#26313A",
      "editorSuggestWidget.selectedBackground": "#26313A",
      "editorSuggestWidget.highlightForeground": "#FF5A5F",
      "scrollbarSlider.background": "rgba(255, 255, 255, 0.08)",
      "scrollbarSlider.hoverBackground": "rgba(255, 255, 255, 0.16)",
      "scrollbarSlider.activeBackground": "rgba(255, 255, 255, 0.24)",
    },
  });

  // Light Theme (Solid Flat Background #FFFFFF, Coral Accent #E5484D, Teal Support #2C8C84)
  monaco.editor.defineTheme(WEAVER_LIGHT_THEME, {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "98A2B3", fontStyle: "italic" },
      { token: "keyword", foreground: "E5484D", fontStyle: "bold" },
      { token: "keyword.sql", foreground: "E5484D", fontStyle: "bold" },
      { token: "operator.sql", foreground: "FF8A3D" },
      { token: "predefined.sql", foreground: "2C8C84" },
      { token: "string", foreground: "2C8C84" },
      { token: "string.sql", foreground: "2C8C84" },
      { token: "number", foreground: "FF8A3D" },
      { token: "number.sql", foreground: "FF8A3D" },
      { token: "type", foreground: "FF8A3D" },
      { token: "identifier", foreground: "111827" },
      { token: "delimiter", foreground: "667085" },
      { token: "delimiter.bracket", foreground: "667085" },
      { token: "delimiter.comma", foreground: "667085" },
      { token: "delimiter.colon", foreground: "98A2B3" },
    ],
    colors: {
      "editor.background": "#FFFFFF",
      "editor.foreground": "#111827",
      "editor.lineHighlightBackground": "#F7F8FA",
      "editor.lineHighlightBorder": "#00000000",
      "editorLineNumber.foreground": "#98A2B3",
      "editorLineNumber.activeForeground": "#E5484D",
      "editorCursor.foreground": "#E5484D",
      "editor.selectionBackground": "#E2F4F2",
      "editor.inactiveSelectionBackground": "#EEF1F4",
      "editorWidget.background": "#FFFFFF",
      "editorWidget.border": "#DDE3EA",
      "editorSuggestWidget.background": "#FFFFFF",
      "editorSuggestWidget.border": "#DDE3EA",
      "editorSuggestWidget.selectedBackground": "#EEF1F4",
      "editorSuggestWidget.highlightForeground": "#E5484D",
      "scrollbarSlider.background": "rgba(17, 24, 39, 0.12)",
      "scrollbarSlider.hoverBackground": "rgba(17, 24, 39, 0.22)",
      "scrollbarSlider.activeBackground": "rgba(17, 24, 39, 0.32)",
    },
  });

  themesRegistered = true;
}

/**
 * Resolves the active Monaco theme based on the requested themeMode and the application's active mode
 */
export function resolveMonacoTheme(
  themeMode: WeaverThemeMode = "auto",
  appMode: "light" | "dark" = "light"
): string {
  if (themeMode === "dark") return WEAVER_DARK_THEME;
  if (themeMode === "light") return WEAVER_LIGHT_THEME;
  return appMode === "dark" ? WEAVER_DARK_THEME : WEAVER_LIGHT_THEME;
}

/**
 * Imperatively updates the active Monaco theme without remounting the editor
 */
export function applyWeaverTheme(monaco: Monaco | null, themeName: string): void {
  if (!monaco?.editor?.setTheme) return;
  try {
    monaco.editor.setTheme(themeName);
  } catch {
    // Graceful fallback if theme is not yet registered
  }
}
