/**
 * Bundles Monaco locally instead of letting `@monaco-editor/loader` fetch it
 * from the jsdelivr CDN at runtime.
 *
 * Loaded through ./monacoSetup, which is imported only by the editor components
 * (WeaverCodeEditor, DiffJsonEditor); those are lazily loaded by pages, so Monaco
 * stays out of the main chunk.
 *
 * Workers: Monaco's base editor worker, JSON (used throughout the app) and
 * TypeScript/JavaScript (used for JavaScript expressions). The other app
 * languages (python, java, sql, bash, jexl, plaintext) are Monarch-tokenized
 * and need no dedicated worker.
 */
import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker.js?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker.js?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker.js?worker";

type MonacoEnvironmentHost = typeof globalThis & {
  MonacoEnvironment?: { getWorker: (workerId: string, label: string) => Worker };
};

let configured = false;

/**
 * Registers the worker factory and points @monaco-editor/loader at the bundled
 * Monaco. Exported (rather than run as a bare side effect) because the app's
 * package.json marks only CSS as side-effectful, so an unused module would be
 * tree-shaken out of the build.
 */
export function configureMonaco(): typeof monaco {
  if (configured) return monaco;
  configured = true;

  (self as MonacoEnvironmentHost).MonacoEnvironment = {
    getWorker(_workerId: string, label: string): Worker {
      if (label === "json") return new JsonWorker();
      if (label === "typescript" || label === "javascript") return new TsWorker();
      return new EditorWorker();
    },
  };

  loader.config({ monaco });
  return monaco;
}
