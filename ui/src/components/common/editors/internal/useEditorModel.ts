import { useEffect, useRef } from "react";
import type { Monaco } from "@monaco-editor/react";
import type * as monaco from "monaco-editor";
import type { WeaverEditorLanguage } from "../WeaverCodeEditor/WeaverCodeEditor.types";
import {
  saveEditorViewState,
  restoreEditorViewState,
  clearEditorViewState,
} from "./useEditorViewState";

const WEAVER_SCHEME = "inmemory";
const WEAVER_AUTHORITY = "weaver";

/** Maximum number of keyed Weaver models kept alive once their editors unmount */
export const MAX_CACHED_WEAVER_MODELS = 20;

/**
 * LRU of keyed model keys (Map keeps insertion order, oldest first).
 * Keyed models outlive their editors (`keepCurrentModel`) so tabs can restore
 * content; this cap keeps a long session from accumulating models forever.
 */
const modelLru = new Map<string, true>();

/** Last Monaco namespace seen, so the helpers can be called without one */
let lastMonacoInstance: Monaco | null = null;

function rememberMonaco(monacoInstance: Monaco | null | undefined): Monaco | null {
  if (monacoInstance) lastMonacoInstance = monacoInstance;
  return monacoInstance ?? lastMonacoInstance;
}

function isModelAttached(model: monaco.editor.ITextModel, monacoInstance: Monaco): boolean {
  const editors = monacoInstance.editor?.getEditors?.();
  if (!editors) return true; // Unknown: be conservative and keep the model
  return editors.some((editor) => editor.getModel() === model);
}

/** Marks a key as most recently used and evicts the oldest unmounted models over the cap */
function touchModelKey(modelKey: string, monacoInstance: Monaco): void {
  modelLru.delete(modelKey);
  modelLru.set(modelKey, true);
  if (modelLru.size <= MAX_CACHED_WEAVER_MODELS) return;

  for (const key of Array.from(modelLru.keys())) {
    if (modelLru.size <= MAX_CACHED_WEAVER_MODELS) break;
    if (key === modelKey) continue;
    const model = monacoInstance.editor?.getModel?.(getWeaverModelUri(key, monacoInstance)) ?? null;
    if (model && isModelAttached(model, monacoInstance)) continue;
    modelLru.delete(key);
    clearEditorViewState(key);
    model?.dispose();
  }
}

/**
 * Returns a stable Monaco URI for a given modelKey
 */
export function getWeaverModelUri(modelKey: string, monacoInstance: Monaco): monaco.Uri {
  return monacoInstance.Uri.parse(`${WEAVER_SCHEME}://${WEAVER_AUTHORITY}/${encodeURIComponent(modelKey)}`);
}

/**
 * Gets an existing Weaver model by modelKey or returns null
 */
export function getExistingWeaverModel(
  modelKey: string,
  monacoInstance: Monaco | null
): monaco.editor.ITextModel | null {
  if (!modelKey || !monacoInstance?.editor?.getModel) return null;
  const uri = getWeaverModelUri(modelKey, monacoInstance);
  return monacoInstance.editor.getModel(uri);
}

/**
 * Gets or creates a persistent Monaco model by modelKey
 */
export function getOrCreateWeaverModel(
  modelKey: string,
  language: WeaverEditorLanguage,
  initialValue: string = "",
  monacoInstance: Monaco
): monaco.editor.ITextModel {
  rememberMonaco(monacoInstance);
  const uri = getWeaverModelUri(modelKey, monacoInstance);
  let model = monacoInstance.editor.getModel(uri);
  touchModelKey(modelKey, monacoInstance);

  if (model) {
    // If the model exists but language changed, update language without recreating
    if (model.getLanguageId() !== language) {
      monacoInstance.editor.setModelLanguage(model, language);
    }
    return model;
  }

  model = monacoInstance.editor.createModel(initialValue, language, uri);
  if (model && typeof model.setEOL === "function" && monacoInstance.editor?.EndOfLineSequence) {
    model.setEOL(monacoInstance.editor.EndOfLineSequence.LF);
  }
  return model;
}

/**
 * Explicitly disposes a persisted Weaver model (and its cached view state)
 */
export function disposeWeaverModel(
  modelKey: string,
  monacoInstance?: Monaco | null
): boolean {
  if (!modelKey) return false;
  modelLru.delete(modelKey);
  clearEditorViewState(modelKey);
  const resolvedMonaco = rememberMonaco(monacoInstance);
  if (resolvedMonaco) {
    const uri = getWeaverModelUri(modelKey, resolvedMonaco);
    const model = resolvedMonaco.editor.getModel(uri);
    if (model) {
      model.dispose();
      return true;
    }
  }
  return false;
}

/**
 * Clears and disposes all Weaver in-memory models and all cached view states.
 * The Monaco namespace is optional; when omitted, the last one seen by the editors is used.
 */
export function clearAllWeaverModels(monacoInstance?: Monaco | null): void {
  modelLru.clear();
  clearEditorViewState();
  const resolvedMonaco = rememberMonaco(monacoInstance);
  if (!resolvedMonaco?.editor?.getModels) return;
  const models = resolvedMonaco.editor.getModels();
  models.forEach((model) => {
    if (model.uri.scheme === WEAVER_SCHEME && model.uri.authority === WEAVER_AUTHORITY) {
      model.dispose();
    }
  });
}

interface UseEditorModelOptions {
  editor: monaco.editor.IStandaloneCodeEditor | null;
  monaco: Monaco | null;
  modelKey?: string;
  language: WeaverEditorLanguage;
  initialValue?: string;
}

/**
 * Hook to manage Monaco models and model switching across tabs
 */
export function useEditorModel({
  editor,
  monaco: monacoInstance,
  modelKey,
  language,
  initialValue = "",
}: UseEditorModelOptions) {
  const activeModelKeyRef = useRef<string | undefined>(modelKey);

  useEffect(() => {
    if (!editor || !monacoInstance) return;

    // If modelKey is specified, bind the persistent model to the editor
    if (modelKey) {
      const prevKey = activeModelKeyRef.current;
      if (prevKey && prevKey !== modelKey) {
        saveEditorViewState(editor, prevKey);
      }

      const model = getOrCreateWeaverModel(modelKey, language, initialValue, monacoInstance);
      const currentEditorModel = editor.getModel();

      if (currentEditorModel !== model) {
        editor.setModel(model);
        restoreEditorViewState(editor, modelKey);
      } else if (model.getLanguageId() !== language) {
        monacoInstance.editor.setModelLanguage(model, language);
      }

      activeModelKeyRef.current = modelKey;
    } else {
      // Unkeyed mode: manage language on the editor's current model
      const currentModel = editor.getModel();
      if (currentModel && currentModel.getLanguageId() !== language) {
        monacoInstance.editor.setModelLanguage(currentModel, language);
      }
      activeModelKeyRef.current = undefined;
    }
  }, [editor, monacoInstance, modelKey, language]);

  return {
    activeModelUri: modelKey && monacoInstance ? getWeaverModelUri(modelKey, monacoInstance) : undefined,
  };
}
