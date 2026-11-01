export { WeaverCodeEditor } from "./WeaverCodeEditor";
export type {
  WeaverCodeEditorProps,
  WeaverEditorLanguage,
  WeaverThemeMode,
  WeaverEditorSuggestion,
  WeaverSuggestionContext,
  WeaverEditorInstance,
  WeaverMonaco,
} from "./WeaverCodeEditor";

export {
  getWeaverModelUri,
  getExistingWeaverModel,
  getOrCreateWeaverModel,
  disposeWeaverModel,
  clearAllWeaverModels,
} from "./internal/useEditorModel";

export {
  saveEditorViewState,
  restoreEditorViewState,
  clearEditorViewState,
} from "./internal/useEditorViewState";

export {
  registerWeaverThemes,
  resolveMonacoTheme,
  applyWeaverTheme,
  WEAVER_DARK_THEME,
  WEAVER_LIGHT_THEME,
} from "./internal/editorTheme";

export { toWeaverSuggestions } from "./internal/languageSupport";
