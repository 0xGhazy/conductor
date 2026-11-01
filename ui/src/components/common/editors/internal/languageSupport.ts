import { useEffect } from "react";
import type { Monaco } from "@monaco-editor/react";
import type * as monaco from "monaco-editor";
import type {
  WeaverEditorLanguage,
  WeaverEditorSuggestion,
} from "../WeaverCodeEditor/WeaverCodeEditor.types";

const DIAGNOSTICS_OWNER = "weaver-script-diagnostics";
const DIAGNOSTICS_DEBOUNCE_MS = 500;
const MAX_DIAGNOSTIC_CHARACTERS = 20000;

type MarkerSeverityName = "Error" | "Warning";

/** Languages with lightweight in-editor diagnostics and built-in snippets */
export const SCRIPT_LANGUAGES: ReadonlySet<WeaverEditorLanguage> = new Set(["python", "jexl"]);

/** Built-in snippet completions offered for script languages */
export const LANGUAGE_SNIPPETS: Partial<Record<WeaverEditorLanguage, WeaverEditorSuggestion[]>> = {
  python: [
    { label: "if", insertText: "if ${1:condition}:\n    ${0:pass}", detail: "Python if block" },
    { label: "elif", insertText: "elif ${1:condition}:\n    ${0:pass}", detail: "Python elif block" },
    { label: "else", insertText: "else:\n    ${0:pass}", detail: "Python else block" },
    { label: "for", insertText: "for ${1:item} in ${2:items}:\n    ${0:pass}", detail: "Python for loop" },
    { label: "while", insertText: "while ${1:condition}:\n    ${0:pass}", detail: "Python while loop" },
    { label: "def", insertText: "def ${1:function_name}(${2:args}):\n    ${0:pass}", detail: "Python function" },
    { label: "try", insertText: "try:\n    ${1:pass}\nexcept ${2:Exception} as ${3:error}:\n    ${0:pass}", detail: "Python try/except" },
    { label: "print", insertText: "print(${1:value})", detail: "Python print" },
    { label: "len", insertText: "len(${1:value})", detail: "Python built-in" },
    { label: "range", insertText: "range(${1:stop})", detail: "Python built-in" },
  ],
  jexl: [
    { label: "if", insertText: "if (${1:condition}) {\n  ${0}\n}", detail: "JEXL if block" },
    { label: "else", insertText: "else {\n  ${0}\n}", detail: "JEXL else block" },
    { label: "for", insertText: "for (${1:item} : ${2:items}) {\n  ${0}\n}", detail: "JEXL for loop" },
    { label: "while", insertText: "while (${1:condition}) {\n  ${0}\n}", detail: "JEXL while loop" },
    { label: "return", insertText: "return ${1:value}", detail: "JEXL return" },
    { label: "empty", insertText: "empty(${1:value})", detail: "JEXL empty check" },
    { label: "size", insertText: "size(${1:value})", detail: "JEXL size function" },
    { label: "new", insertText: "new('${1:java.util.HashMap}')", detail: "JEXL object creation" },
    { label: "null", insertText: "null", detail: "JEXL literal" },
    { label: "true", insertText: "true", detail: "JEXL literal" },
    { label: "false", insertText: "false", detail: "JEXL literal" },
  ],
};

/**
 * Converts a plain list of variable tokens (e.g. `${workflow.input.id}`) into
 * deduplicated editor suggestions.
 */
export function toWeaverSuggestions(tokens: readonly unknown[] | null | undefined): WeaverEditorSuggestion[] {
  if (!Array.isArray(tokens)) return [];
  const seen = new Set<string>();
  const result: WeaverEditorSuggestion[] = [];
  tokens.forEach((item, index) => {
    const token = String(item ?? "").trim();
    if (!token || seen.has(token)) return;
    seen.add(token);
    result.push({
      label: token,
      insertText: token,
      insertAsSnippet: false,
      sortText: `1_${String(index).padStart(6, "0")}`,
    });
  });
  return result;
}

/** Registers languages Monaco does not ship with (JEXL). Safe to call repeatedly. */
export function registerWeaverLanguages(monacoInstance: Monaco): void {
  const registered = monacoInstance.languages
    .getLanguages()
    .some((language: { id: string }) => language.id === "jexl");
  if (registered) return;

  monacoInstance.languages.register({ id: "jexl" });
  monacoInstance.languages.setMonarchTokensProvider("jexl", {
    keywords: ["if", "else", "for", "while", "return", "true", "false", "null", "new", "var", "let"],
    tokenizer: {
      root: [
        [/[a-zA-Z_$][\w$]*/, { cases: { "@keywords": "keyword", "@default": "identifier" } }],
        [/\d+(\.\d+)?/, "number"],
        [/".*?"/, "string"],
        [/'.*?'/, "string"],
        [/\/\/.*$/, "comment"],
        [/[{}[\]()]/, "@brackets"],
        [/[+\-*/%=!<>|&?:]+/, "operator"],
      ],
    },
  });
}

const createMarker = (
  monacoInstance: Monaco,
  message: string,
  lineNumber: number,
  startColumn: number,
  endColumn: number,
  severity: MarkerSeverityName = "Warning"
): monaco.editor.IMarkerData => ({
  message,
  severity: monacoInstance.MarkerSeverity[severity],
  startLineNumber: lineNumber,
  endLineNumber: lineNumber,
  startColumn,
  endColumn: Math.max(endColumn, startColumn + 1),
});

const countLeadingSpaces = (line: string) => line.match(/^ */)?.[0].length ?? 0;

const hasUnclosedQuote = (line: string, quote: string) => {
  let escaped = false;
  let count = 0;
  for (const char of line) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === quote) count += 1;
  }
  return count % 2 === 1;
};

const buildBracketDiagnostics = (model: monaco.editor.ITextModel, monacoInstance: Monaco) => {
  const markers: monaco.editor.IMarkerData[] = [];
  const opening = new Map([
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
  ]);
  const closing = new Set([")", "]", "}"]);
  const stack: Array<{ lineNumber: number; column: number; expected: string }> = [];

  for (let lineNumber = 1; lineNumber <= model.getLineCount(); lineNumber += 1) {
    const line = model.getLineContent(lineNumber);
    let quote = "";
    let escaped = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (quote) {
        if (char === quote) quote = "";
        continue;
      }
      if (char === "'" || char === '"') {
        quote = char;
        continue;
      }
      const expected = opening.get(char);
      if (expected) {
        stack.push({ lineNumber, column: index + 1, expected });
        continue;
      }
      if (closing.has(char)) {
        const last = stack.pop();
        if (!last || last.expected !== char) {
          markers.push(createMarker(monacoInstance, `Unexpected closing bracket "${char}".`, lineNumber, index + 1, index + 2, "Error"));
        }
      }
    }
  }

  stack.slice(-5).forEach((entry) => {
    markers.push(createMarker(monacoInstance, `Missing closing bracket "${entry.expected}".`, entry.lineNumber, entry.column, entry.column + 1, "Error"));
  });

  return markers;
};

const buildPythonDiagnostics = (model: monaco.editor.ITextModel, monacoInstance: Monaco) => {
  const markers = buildBracketDiagnostics(model, monacoInstance);
  const blockStartPattern = /^(if|elif|else|for|while|try|except|finally|with|def|class)\b/;

  for (let lineNumber = 1; lineNumber <= model.getLineCount(); lineNumber += 1) {
    const line = model.getLineContent(lineNumber);
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const leading = line.match(/^\s*/)?.[0] || "";
    if (leading.includes("\t") && leading.includes(" ")) {
      markers.push(createMarker(monacoInstance, "Mixed tabs and spaces in indentation.", lineNumber, 1, leading.length + 1));
    }
    if (countLeadingSpaces(line) % 4 !== 0 && leading.length > 0 && !leading.includes("\t")) {
      markers.push(createMarker(monacoInstance, "Python indentation is usually a multiple of 4 spaces.", lineNumber, 1, leading.length + 1));
    }
    if (blockStartPattern.test(trimmed) && !trimmed.endsWith(":")) {
      markers.push(createMarker(monacoInstance, "Python block statements should end with ':'.", lineNumber, line.length, line.length + 1, "Error"));
    }
    if (hasUnclosedQuote(line, "'") || hasUnclosedQuote(line, '"')) {
      markers.push(createMarker(monacoInstance, "Possible unclosed string literal.", lineNumber, Math.max(1, line.length), line.length + 1, "Error"));
    }
  }

  return markers;
};

const buildJexlDiagnostics = (model: monaco.editor.ITextModel, monacoInstance: Monaco) => {
  const markers = buildBracketDiagnostics(model, monacoInstance);
  const controlWithoutParens = /^(if|for|while)\s+[^(]/;

  for (let lineNumber = 1; lineNumber <= model.getLineCount(); lineNumber += 1) {
    const line = model.getLineContent(lineNumber);
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;

    if (controlWithoutParens.test(trimmed)) {
      markers.push(createMarker(monacoInstance, "JEXL control statements should use parentheses, e.g. if (condition).", lineNumber, line.indexOf(trimmed) + 1, line.length + 1));
    }
    if (hasUnclosedQuote(line, "'") || hasUnclosedQuote(line, '"')) {
      markers.push(createMarker(monacoInstance, "Possible unclosed string literal.", lineNumber, Math.max(1, line.length), line.length + 1, "Error"));
    }
  }

  return markers;
};

const buildDiagnostics = (model: monaco.editor.ITextModel, monacoInstance: Monaco, language: WeaverEditorLanguage) => {
  if (language === "python") return buildPythonDiagnostics(model, monacoInstance);
  if (language === "jexl") return buildJexlDiagnostics(model, monacoInstance);
  return [];
};

/**
 * Runs debounced, idle-time syntax diagnostics for script languages (Python, JEXL)
 * and publishes them as Monaco markers on the editor's active model.
 */
export function useEditorDiagnostics(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  monacoInstance: Monaco | null,
  language: WeaverEditorLanguage
): void {
  useEffect(() => {
    const model = editor?.getModel?.();
    if (!editor || !monacoInstance || !model) return;

    if (!SCRIPT_LANGUAGES.has(language)) {
      monacoInstance.editor.setModelMarkers(model, DIAGNOSTICS_OWNER, []);
      return;
    }

    let timer: number | null = null;
    let idleHandle: number | null = null;

    const cancelPending = () => {
      if (timer !== null) window.clearTimeout(timer);
      if (idleHandle !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleHandle);
      }
      timer = null;
      idleHandle = null;
    };

    const validateNow = () => {
      const activeModel = editor.getModel();
      if (!activeModel) return;
      const markers =
        activeModel.getValueLength() > MAX_DIAGNOSTIC_CHARACTERS
          ? []
          : buildDiagnostics(activeModel, monacoInstance, language);
      monacoInstance.editor.setModelMarkers(activeModel, DIAGNOSTICS_OWNER, markers);
    };

    const scheduleValidate = () => {
      cancelPending();
      timer = window.setTimeout(() => {
        timer = null;
        if (typeof window.requestIdleCallback === "function") {
          idleHandle = window.requestIdleCallback(() => {
            idleHandle = null;
            validateNow();
          }, { timeout: 1000 });
          return;
        }
        validateNow();
      }, DIAGNOSTICS_DEBOUNCE_MS);
    };

    scheduleValidate();
    const listener = model.onDidChangeContent(scheduleValidate);

    return () => {
      listener.dispose();
      cancelPending();
      monacoInstance.editor.setModelMarkers(model, DIAGNOSTICS_OWNER, []);
    };
  }, [editor, monacoInstance, language]);
}
