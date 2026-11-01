import { useEffect, useRef } from "react";
import type * as monaco from "monaco-editor";

/** Maximum number of view states retained (least recently used are dropped first) */
export const MAX_CACHED_VIEW_STATES = 20;

/**
 * Module-level LRU cache storing editor view states keyed by modelKey
 * (Map keeps insertion order; re-inserting on write/read marks an entry as recent).
 */
const viewStateCache = new Map<string, monaco.editor.ICodeEditorViewState>();

function setCachedViewState(modelKey: string, viewState: monaco.editor.ICodeEditorViewState): void {
  viewStateCache.delete(modelKey);
  viewStateCache.set(modelKey, viewState);
  while (viewStateCache.size > MAX_CACHED_VIEW_STATES) {
    const oldestKey = viewStateCache.keys().next().value;
    if (oldestKey === undefined) break;
    viewStateCache.delete(oldestKey);
  }
}

/**
 * Saves current editor view state (cursor, scroll, selection, folds) for a modelKey
 */
export function saveEditorViewState(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  modelKey: string
): void {
  if (!editor || !modelKey) return;
  try {
    const viewState = editor.saveViewState();
    if (viewState) {
      setCachedViewState(modelKey, viewState);
    }
  } catch {
    // Ignore if editor is in a transitional state
  }
}

/**
 * Restores previously saved view state for a modelKey into the editor
 */
export function restoreEditorViewState(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  modelKey: string
): boolean {
  if (!editor || !modelKey) return false;
  const saved = viewStateCache.get(modelKey);
  if (!saved) return false;
  setCachedViewState(modelKey, saved);
  try {
    editor.restoreViewState(saved);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clears cached view state for a specific modelKey or all keys
 */
export function clearEditorViewState(modelKey?: string): void {
  if (modelKey) {
    viewStateCache.delete(modelKey);
  } else {
    viewStateCache.clear();
  }
}

/**
 * Hook to manage view-state preservation and restoration for modelKey
 */
export function useEditorViewState(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  modelKey?: string
): void {
  const prevModelKeyRef = useRef<string | undefined>(modelKey);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(editor);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // When modelKey changes, save previous view state and restore new view state
  useEffect(() => {
    const prevKey = prevModelKeyRef.current;
    const currentEditor = editorRef.current;

    if (prevKey && prevKey !== modelKey && currentEditor) {
      saveEditorViewState(currentEditor, prevKey);
    }

    if (modelKey && currentEditor) {
      restoreEditorViewState(currentEditor, modelKey);
    }

    prevModelKeyRef.current = modelKey;
  }, [modelKey, editor]);

  // Save view state on unmount
  useEffect(() => {
    return () => {
      const activeKey = prevModelKeyRef.current;
      const currentEditor = editorRef.current;
      if (activeKey && currentEditor) {
        saveEditorViewState(currentEditor, activeKey);
      }
    };
  }, []);
}
