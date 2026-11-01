import type { ReactNode } from "react";
import type { EditorProps, Monaco } from "@monaco-editor/react";
import type * as monaco from "monaco-editor";

/**
 * Supported editor languages in WeaverCodeEditor
 */
export type WeaverEditorLanguage =
  | "java"
  | "python"
  | "javascript"
  | "json"
  | "sql"
  | "jexl"
  | "bash"
  | "plaintext";

/**
 * Theme mode option:
 * - 'auto': follows the active application/MUI theme
 * - 'light': forces the light Monaco theme
 * - 'dark': forces the dark Monaco theme
 */
export type WeaverThemeMode = "auto" | "light" | "dark";

/**
 * Autocompletion suggestion descriptor
 */
export interface WeaverEditorSuggestion {
  label: string;
  insertText: string;
  detail?: string;
  documentation?: string;
  kind?: monaco.languages.CompletionItemKind | number;
  sortText?: string;
  filterText?: string;
  insertAsSnippet?: boolean;
}

/**
 * Context provided to dynamic suggestion providers
 */
export interface WeaverSuggestionContext {
  value: string;
  language: WeaverEditorLanguage;
  position: {
    lineNumber: number;
    column: number;
  };
}

/**
 * Props for the canonical WeaverCodeEditor component
 */
export interface WeaverCodeEditorProps
  extends Omit<
    EditorProps,
    "language" | "value" | "defaultValue" | "onChange" | "theme"
  > {
  /**
   * The programming language of the editor
   */
  language: WeaverEditorLanguage;

  /**
   * Controlled editor value
   */
  value?: string;

  /**
   * Initial uncontrolled editor value
   */
  defaultValue?: string;

  /**
   * Callback fired when editor content changes
   */
  onChange?: (value: string) => void;

  /**
   * Callback fired with the current content when the editor text loses focus
   */
  onBlur?: (value: string) => void;

  /**
   * Optional unique model key to persist document state, undo/redo history,
   * and view state across tab switches and component unmounts.
   */
  modelKey?: string;

  /**
   * When true, disables editing while keeping selection, search, and scrolling active
   */
  readOnly?: boolean;

  /**
   * Width of the editor container
   * @default "100%"
   */
  width?: number | string;

  /**
   * Height of the editor container
   * @default "100%"
   */
  height?: number | string;

  /**
   * Theme mode: 'auto' | 'light' | 'dark'
   * @default "auto"
   */
  themeMode?: WeaverThemeMode;

  /**
   * Whether the fullscreen toggle action is available in the toolbar
   * @default true
   */
  allowFullscreen?: boolean;

  /**
   * Whether to display the toolbar Run action
   * @default false
   */
  runnable?: boolean;

  /**
   * Whether F5 triggers the onRun callback
   * @default true
   */
  runShortcut?: boolean;

  /**
   * Code execution handler triggered by the toolbar button or F5 shortcut
   */
  onRun?: (code: string) => void | Promise<void>;

  /**
   * Static autocompletion suggestions
   */
  suggestions?: WeaverEditorSuggestion[];

  /**
   * Dynamic autocompletion provider invoked on suggestion trigger (Ctrl+Space)
   */
  suggestionProvider?: (
    context: WeaverSuggestionContext
  ) =>
    | WeaverEditorSuggestion[]
    | Promise<WeaverEditorSuggestion[]>;

  /**
   * Additional Monaco editor construction options
   */
  options?: EditorProps["options"];

  /**
   * Custom toolbar right-side actions if needed
   */
  toolbarExtra?: ReactNode;

  /**
   * Optional container className
   */
  className?: string;
}

export type WeaverEditorInstance = monaco.editor.IStandaloneCodeEditor;
export type WeaverMonaco = Monaco;
