import { useEffect, useRef } from "react";
import type { Monaco } from "@monaco-editor/react";
import type * as monaco from "monaco-editor";
import type {
  WeaverEditorLanguage,
  WeaverEditorSuggestion,
  WeaverSuggestionContext,
} from "../WeaverCodeEditor/WeaverCodeEditor.types";

interface UseEditorSuggestionsOptions {
  editor?: monaco.editor.IStandaloneCodeEditor | null;
  monaco: Monaco | null;
  language: WeaverEditorLanguage;
  suggestions?: WeaverEditorSuggestion[];
  suggestionProvider?: (
    context: WeaverSuggestionContext
  ) =>
    | WeaverEditorSuggestion[]
    | Promise<WeaverEditorSuggestion[]>;
}

/**
 * Registers Monaco completion provider once per language, reading suggestions
 * dynamically through stable refs to prevent duplicate providers and memory leaks.
 */
export function useEditorSuggestions({
  editor,
  monaco: monacoInstance,
  language,
  suggestions,
  suggestionProvider,
}: UseEditorSuggestionsOptions): void {
  const suggestionsRef = useRef(suggestions);
  const suggestionProviderRef = useRef(suggestionProvider);
  const editorRef = useRef(editor);

  // Keep refs up-to-date without re-registering completion providers
  useEffect(() => {
    suggestionsRef.current = suggestions;
  }, [suggestions]);

  useEffect(() => {
    suggestionProviderRef.current = suggestionProvider;
  }, [suggestionProvider]);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!monacoInstance || !language) return;

    // Register completion provider for this language
    const disposable = monacoInstance.languages.registerCompletionItemProvider(
      language,
      {
        triggerCharacters: [".", "(", "{", "[", '"', "'", "/", "@", "$", " "],
        provideCompletionItems: async (
          model: monaco.editor.ITextModel,
          position: monaco.Position,
          _context: monaco.languages.CompletionContext,
          token: monaco.CancellationToken
        ): Promise<monaco.languages.CompletionList> => {
          if (token.isCancellationRequested) {
            return { suggestions: [] };
          }

          // If editor instance is known, verify the completion is for this editor's active model
          const activeModelUri = editorRef.current?.getModel()?.uri?.toString();
          if (activeModelUri && model.uri.toString() !== activeModelUri) {
            return { suggestions: [] };
          }

          const wordInfo = model.getWordUntilPosition(position);
          const defaultRange: monaco.IRange = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: wordInfo.startColumn,
            endColumn: wordInfo.endColumn,
          };

          const rawSuggestions: WeaverEditorSuggestion[] = [];

          // 1. Static suggestions
          if (suggestionsRef.current && suggestionsRef.current.length > 0) {
            rawSuggestions.push(...suggestionsRef.current);
          }

          // 2. Dynamic suggestions from suggestionProvider
          if (typeof suggestionProviderRef.current === "function") {
            try {
              const dynamicResult = await suggestionProviderRef.current({
                value: model.getValue(),
                language,
                position: {
                  lineNumber: position.lineNumber,
                  column: position.column,
                },
              });

              if (Array.isArray(dynamicResult)) {
                rawSuggestions.push(...dynamicResult);
              }
            } catch (error) {
              console.error("WeaverCodeEditor suggestionProvider error:", error);
            }
          }

          if (token.isCancellationRequested) {
            return { suggestions: [] };
          }

          // Deduplicate by label, keeping last defined
          const uniqueMap = new Map<string, WeaverEditorSuggestion>();
          for (const item of rawSuggestions) {
            if (item && item.label) {
              uniqueMap.set(item.label, item);
            }
          }

          const mappedSuggestions: monaco.languages.CompletionItem[] = Array.from(
            uniqueMap.values()
          ).map((item, index) => {
            const isNumberedSnippet =
              typeof item.insertText === "string" && /\$\{\d+(?::[^}]*)?\}/.test(item.insertText);
            const isSnippet =
              item.insertAsSnippet !== undefined ? item.insertAsSnippet : isNumberedSnippet;
            const kind = item.kind ?? (isSnippet
              ? monacoInstance.languages.CompletionItemKind.Snippet
              : monacoInstance.languages.CompletionItemKind.Variable);

            return {
              label: item.label,
              kind,
              insertText: item.insertText,
              insertTextRules: isSnippet
                ? monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet
                : undefined,
              detail: item.detail,
              documentation: item.documentation,
              sortText: item.sortText ?? `0_${String(index).padStart(5, "0")}`,
              filterText: item.filterText ?? item.label,
              range: defaultRange,
            };
          });

          return {
            suggestions: mappedSuggestions,
          };
        },
      }
    );

    return () => {
      disposable.dispose();
    };
  }, [monacoInstance, language]);
}
