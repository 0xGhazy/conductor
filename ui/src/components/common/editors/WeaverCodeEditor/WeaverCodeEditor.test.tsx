import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { WeaverCodeEditor } from "./WeaverCodeEditor";
import {
  getOrCreateWeaverModel,
  getWeaverModelUri,
  disposeWeaverModel,
  clearAllWeaverModels,
} from "../internal/useEditorModel";
import {
  saveEditorViewState,
  restoreEditorViewState,
  clearEditorViewState,
} from "../internal/useEditorViewState";
import {
  resolveMonacoTheme,
  registerWeaverThemes,
  WEAVER_DARK_THEME,
  WEAVER_LIGHT_THEME,
} from "../internal/editorTheme";
import type { WeaverEditorSuggestion } from "./WeaverCodeEditor.types";

// Mock Monaco Editor component and Monaco API
const mockEditorInstance = {
  getValue: vi.fn(() => "console.log('hello world');"),
  setValue: vi.fn(),
  layout: vi.fn(),
  getPosition: vi.fn(() => ({ lineNumber: 1, column: 1 })),
  getSelections: vi.fn(() => []),
  setPosition: vi.fn(),
  setSelections: vi.fn(),
  executeEdits: vi.fn(),
  pushUndoStop: vi.fn(),
  updateOptions: vi.fn(),
  getModel: vi.fn(() => ({
    getLanguageId: vi.fn(() => "javascript"),
    getValue: vi.fn(() => "console.log('hello world');"),
    getWordUntilPosition: vi.fn(() => ({ startColumn: 1, endColumn: 5 })),
    getLineCount: vi.fn(() => 1),
    getLineMaxColumn: vi.fn(() => 20),
    getFullModelRange: vi.fn(() => ({})),
    setEOL: vi.fn(),
    getValueLength: vi.fn(() => 26),
    getLineContent: vi.fn(() => "console.log('hello world');"),
    onDidChangeContent: vi.fn(() => ({ dispose: vi.fn() })),
  })),
  setModel: vi.fn(),
  saveViewState: vi.fn(() => ({ cursorState: [{ inSelectionMode: false }] })),
  restoreViewState: vi.fn(),
  addCommand: vi.fn(),
  onDidBlurEditorText: vi.fn((_listener: () => void) => ({ dispose: vi.fn() })),
};

const mockRegisteredProviders: any[] = [];

const mockMonacoInstance: any = {
  KeyCode: { F5: 116 },
  MarkerSeverity: { Error: 8, Warning: 4 },
  Uri: {
    parse: vi.fn((str: string) => ({
      toString: () => str,
      scheme: str.split("://")[0],
      authority: str.split("://")[1]?.split("/")[0],
      path: str.split("://")[1]?.slice(str.split("://")[1]?.indexOf("/") || 0),
    })),
  },
  editor: {
    defineTheme: vi.fn(),
    setTheme: vi.fn(),
    getModel: vi.fn(),
    getModels: vi.fn(() => []),
    createModel: vi.fn((value: string, language: string, uri: any) => ({
      getValue: () => value,
      getLanguageId: () => language,
      uri,
      dispose: vi.fn(),
    })),
    setModelLanguage: vi.fn(),
    setModelMarkers: vi.fn(),
  },
  languages: {
    getLanguages: vi.fn(() => [{ id: "javascript" }, { id: "python" }]),
    register: vi.fn(),
    setMonarchTokensProvider: vi.fn(),
    CompletionItemKind: { Snippet: 27, Variable: 4 },
    CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
    registerCompletionItemProvider: vi.fn((lang: string, provider: any) => {
      const entry = { lang, provider, disposed: false };
      mockRegisteredProviders.push(entry);
      return {
        dispose: () => {
          entry.disposed = true;
        },
      };
    }),
  },
};

// Mock @monaco-editor/react to simulate editor mounting and prop inspection
vi.mock("@monaco-editor/react", () => {
  return {
    default: function MockEditor(props: any) {
      React.useEffect(() => {
        props.beforeMount?.(mockMonacoInstance);
        props.onMount?.(mockEditorInstance, mockMonacoInstance);
      }, []);

      return (
        <div
          data-testid="monaco-editor-mock"
          data-language={props.language}
          data-theme={props.theme}
          data-value={props.value}
          data-default-value={props.defaultValue}
          data-path={props.path}
        >
          <textarea
            data-testid="mock-editor-textarea"
            defaultValue={props.defaultValue || props.value || ""}
            onChange={(e) => props.onChange?.(e.target.value)}
          />
        </div>
      );
    },
    // Re-exported by ../internal/monacoSetup alongside the default Editor
    DiffEditor: function MockDiffEditor() {
      return null;
    },
  };
});

describe("WeaverCodeEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearEditorViewState();
  });

  describe("General Language and Options", () => {
    it("renders Java language badge and passes language to Monaco", () => {
      render(<WeaverCodeEditor language="java" />);
      expect(screen.getByText("Java")).toBeInTheDocument();
      const mock = screen.getByTestId("monaco-editor-mock");
      expect(mock).toHaveAttribute("data-language", "java");
    });

    it("renders Python language badge and passes language to Monaco", () => {
      render(<WeaverCodeEditor language="python" />);
      expect(screen.getByText("Python")).toBeInTheDocument();
      const mock = screen.getByTestId("monaco-editor-mock");
      expect(mock).toHaveAttribute("data-language", "python");
    });

    it("renders JavaScript language badge and passes language to Monaco", () => {
      render(<WeaverCodeEditor language="javascript" />);
      expect(screen.getByText("JavaScript")).toBeInTheDocument();
      const mock = screen.getByTestId("monaco-editor-mock");
      expect(mock).toHaveAttribute("data-language", "javascript");
    });

    it("renders JSON language badge and passes language to Monaco", () => {
      render(<WeaverCodeEditor language="json" />);
      expect(screen.getByText("JSON")).toBeInTheDocument();
      const mock = screen.getByTestId("monaco-editor-mock");
      expect(mock).toHaveAttribute("data-language", "json");
    });

    it("renders SQL language badge and passes language to Monaco", () => {
      render(<WeaverCodeEditor language="sql" />);
      expect(screen.getByText("SQL")).toBeInTheDocument();
      const mock = screen.getByTestId("monaco-editor-mock");
      expect(mock).toHaveAttribute("data-language", "sql");
    });

    it("shows read-only badge when readOnly is enabled", () => {
      render(<WeaverCodeEditor language="javascript" readOnly />);
      expect(screen.getByText("Read-Only")).toBeInTheDocument();
    });

    it("honors options.readOnly instead of overriding it", () => {
      render(<WeaverCodeEditor language="json" options={{ readOnly: true }} />);
      expect(screen.getByText("Read-Only")).toBeInTheDocument();
      expect(mockEditorInstance.updateOptions).toHaveBeenCalledWith(
        expect.objectContaining({ readOnly: true })
      );
    });

    it("registers the JEXL language once and labels it", () => {
      render(<WeaverCodeEditor language="jexl" />);
      expect(screen.getByText("JEXL")).toBeInTheDocument();
      expect(mockMonacoInstance.languages.register).toHaveBeenCalledWith({ id: "jexl" });
      expect(mockMonacoInstance.languages.setMonarchTokensProvider).toHaveBeenCalledWith(
        "jexl",
        expect.any(Object)
      );
    });

    it("calls onBlur with the current editor value", () => {
      const onBlur = vi.fn();
      render(<WeaverCodeEditor language="javascript" onBlur={onBlur} />);
      const blurListener = mockEditorInstance.onDidBlurEditorText.mock.calls[0][0];
      blurListener();
      expect(onBlur).toHaveBeenCalledWith("console.log('hello world');");
    });

    it("applies custom width and height styles", () => {
      const { container } = render(
        <WeaverCodeEditor language="javascript" width="500px" height="400px" />
      );
      const editorContainer = container.firstChild as HTMLElement;
      expect(editorContainer.style.width).toBe("500px");
      expect(editorContainer.style.height).toBe("400px");
    });

    it("handles controlled value and onChange", () => {
      const handleChange = vi.fn();
      render(
        <WeaverCodeEditor
          language="javascript"
          value="const x = 1;"
          onChange={handleChange}
        />
      );

      const textarea = screen.getByTestId("mock-editor-textarea");
      fireEvent.change(textarea, { target: { value: "const x = 2;" } });
      expect(handleChange).toHaveBeenCalledWith("const x = 2;");
    });

    it("handles uncontrolled defaultValue without forcing controlled updates", () => {
      render(
        <WeaverCodeEditor
          language="javascript"
          defaultValue="initial content"
        />
      );
      const mock = screen.getByTestId("monaco-editor-mock");
      expect(mock).toHaveAttribute("data-default-value", "initial content");
    });
  });

  describe("Theme Support", () => {
    it("resolves to weaver-light when themeMode is auto in light mode", () => {
      const theme = resolveMonacoTheme("auto", "light");
      expect(theme).toBe(WEAVER_LIGHT_THEME);
    });

    it("resolves to weaver-dark when themeMode is auto in dark mode", () => {
      const theme = resolveMonacoTheme("auto", "dark");
      expect(theme).toBe(WEAVER_DARK_THEME);
    });

    it("forces weaver-light when themeMode is light regardless of app mode", () => {
      expect(resolveMonacoTheme("light", "dark")).toBe(WEAVER_LIGHT_THEME);
      expect(resolveMonacoTheme("light", "light")).toBe(WEAVER_LIGHT_THEME);
    });

    it("forces weaver-dark when themeMode is dark regardless of app mode", () => {
      expect(resolveMonacoTheme("dark", "light")).toBe(WEAVER_DARK_THEME);
      expect(resolveMonacoTheme("dark", "dark")).toBe(WEAVER_DARK_THEME);
    });

    it("registers Weaver themes on Monaco mount", () => {
      registerWeaverThemes(mockMonacoInstance, true);
      expect(mockMonacoInstance.editor.defineTheme).toHaveBeenCalledWith(
        WEAVER_DARK_THEME,
        expect.any(Object)
      );
      expect(mockMonacoInstance.editor.defineTheme).toHaveBeenCalledWith(
        WEAVER_LIGHT_THEME,
        expect.any(Object)
      );
    });
  });

  describe("Fullscreen Support", () => {
    it("renders fullscreen button by default", () => {
      render(<WeaverCodeEditor language="javascript" />);
      expect(
        screen.getByRole("button", { name: /enter fullscreen/i })
      ).toBeInTheDocument();
    });

    it("hides fullscreen button when allowFullscreen is false", () => {
      render(<WeaverCodeEditor language="javascript" allowFullscreen={false} />);
      expect(
        screen.queryByRole("button", { name: /enter fullscreen/i })
      ).not.toBeInTheDocument();
    });

    it("toggles fullscreen mode and updates button label", () => {
      render(<WeaverCodeEditor language="javascript" allowFullscreen />);
      const button = screen.getByRole("button", { name: /enter fullscreen/i });

      fireEvent.click(button);
      expect(
        screen.getByRole("button", { name: /exit fullscreen/i })
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /exit fullscreen/i }));
      expect(
        screen.getByRole("button", { name: /enter fullscreen/i })
      ).toBeInTheDocument();
    });

    it("exits fullscreen on Escape key press", () => {
      render(<WeaverCodeEditor language="javascript" allowFullscreen />);
      const button = screen.getByRole("button", { name: /enter fullscreen/i });
      fireEvent.click(button);

      expect(
        screen.getByRole("button", { name: /exit fullscreen/i })
      ).toBeInTheDocument();

      fireEvent.keyDown(window, { key: "Escape" });
      expect(
        screen.getByRole("button", { name: /enter fullscreen/i })
      ).toBeInTheDocument();
    });
  });

  describe("Run and F5 Execution", () => {
    it("shows Run button only when runnable is true and onRun is provided", () => {
      const { rerender } = render(<WeaverCodeEditor language="javascript" />);
      expect(
        screen.queryByRole("button", { name: /run code/i })
      ).not.toBeInTheDocument();

      rerender(<WeaverCodeEditor language="javascript" runnable />);
      expect(
        screen.queryByRole("button", { name: /run code/i })
      ).not.toBeInTheDocument();

      const onRun = vi.fn();
      rerender(
        <WeaverCodeEditor language="javascript" runnable onRun={onRun} />
      );
      expect(
        screen.getByRole("button", { name: /run code/i })
      ).toBeInTheDocument();
    });

    it("calls onRun with current editor value when Run button is clicked", async () => {
      const onRun = vi.fn();
      render(
        <WeaverCodeEditor language="javascript" runnable onRun={onRun} />
      );

      const runButton = screen.getByRole("button", { name: /run code/i });
      fireEvent.click(runButton);

      await waitFor(() => {
        expect(onRun).toHaveBeenCalledWith("console.log('hello world');");
      });
    });

    it("registers F5 key command on mount", () => {
      const onRun = vi.fn();
      render(
        <WeaverCodeEditor language="javascript" runnable onRun={onRun} runShortcut />
      );
      expect(mockEditorInstance.addCommand).toHaveBeenCalledWith(
        mockMonacoInstance.KeyCode.F5,
        expect.any(Function)
      );
    });
  });

  describe("Completion Suggestions", () => {
    it("registers static suggestions provider", () => {
      const suggestions: WeaverEditorSuggestion[] = [
        {
          label: "workflow.input",
          insertText: "workflow.input",
          detail: "Workflow input object",
        },
      ];

      render(
        <WeaverCodeEditor
          language="javascript"
          suggestions={suggestions}
        />
      );

      expect(
        mockMonacoInstance.languages.registerCompletionItemProvider
      ).toHaveBeenCalledWith("javascript", expect.any(Object));
    });

    it("supports dynamic suggestionProvider callback", async () => {
      const dynamicSuggestions: WeaverEditorSuggestion[] = [
        { label: "dynamicField", insertText: "dynamicField" },
      ];
      const provider = vi.fn().mockResolvedValue(dynamicSuggestions);

      render(
        <WeaverCodeEditor
          language="javascript"
          suggestionProvider={provider}
        />
      );

      expect(
        mockMonacoInstance.languages.registerCompletionItemProvider
      ).toHaveBeenCalledWith("javascript", expect.any(Object));
    });

    it("disposes completion provider on unmount", () => {
      const { unmount } = render(
        <WeaverCodeEditor
          language="javascript"
          suggestions={[{ label: "test", insertText: "test" }]}
        />
      );

      const lastProvider =
        mockRegisteredProviders[mockRegisteredProviders.length - 1];
      unmount();
      expect(lastProvider?.disposed).toBe(true);
    });
  });

  describe("Model and View State Persistence", () => {
    it("derives inmemory://weaver URI for a stable modelKey", () => {
      const uri = getWeaverModelUri("workflow-step-1", mockMonacoInstance);
      expect(uri.toString()).toBe("inmemory://weaver/workflow-step-1");
    });

    it("reuses existing model when same modelKey is used", () => {
      const existingModel = {
        uri: { toString: () => "inmemory://weaver/node-1" },
        getLanguageId: () => "javascript",
        dispose: vi.fn(),
      };
      mockMonacoInstance.editor.getModel.mockReturnValueOnce(existingModel);

      const model = getOrCreateWeaverModel(
        "node-1",
        "javascript",
        "",
        mockMonacoInstance
      );
      expect(model).toBe(existingModel);
      expect(mockMonacoInstance.editor.createModel).not.toHaveBeenCalled();
    });

    it("creates a new model when modelKey does not exist", () => {
      mockMonacoInstance.editor.getModel.mockReturnValueOnce(null);

      getOrCreateWeaverModel(
        "new-node-2",
        "python",
        "def run(): pass",
        mockMonacoInstance
      );
      expect(mockMonacoInstance.editor.createModel).toHaveBeenCalledWith(
        "def run(): pass",
        "python",
        expect.any(Object)
      );
    });

    it("saves and restores view state by modelKey across tab switches", () => {
      saveEditorViewState(mockEditorInstance as any, "tab-a");
      const restored = restoreEditorViewState(
        mockEditorInstance as any,
        "tab-a"
      );
      expect(restored).toBe(true);
      expect(mockEditorInstance.restoreViewState).toHaveBeenCalled();
    });

    it("disposes model explicitly via disposeWeaverModel", () => {
      const mockModel = { dispose: vi.fn() };
      mockMonacoInstance.editor.getModel.mockReturnValueOnce(mockModel);

      const disposed = disposeWeaverModel("step-close", mockMonacoInstance);
      expect(disposed).toBe(true);
      expect(mockModel.dispose).toHaveBeenCalled();
    });
  });
});
