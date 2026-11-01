/**
 * Single entry point for the Monaco React components.
 *
 * Ensures Monaco is served from the local bundle (see ./monacoBootstrap) before
 * any editor mounts, so `@monaco-editor/loader` never falls back to the CDN.
 * Editor components must import `Editor` / `DiffEditor` from here (not directly
 * from `@monaco-editor/react`): the app's package.json marks only CSS as having
 * side effects, so a bare `import "./monacoSetup"` would be tree-shaken away.
 *
 * Top-level await keeps importers (the lazily loaded editor chunks) from
 * evaluating until `loader.config({ monaco })` has run. Under Vitest the bootstrap
 * is skipped: tests mock `@monaco-editor/react`, and evaluating the real
 * monaco-editor package (plus `?worker` imports) in happy-dom is slow/unsupported.
 */
import ReactEditor, { DiffEditor as ReactDiffEditor } from "@monaco-editor/react";

if (import.meta.env.MODE !== "test") {
  const { configureMonaco } = await import("./monacoBootstrap");
  configureMonaco();
}

// Local bindings (not plain re-exports): Rollup only keeps this module, and therefore
// the bootstrap above, when one of its own declarations is used.
export const Editor = ReactEditor;
export const DiffEditor = ReactDiffEditor;
export type { Monaco } from "@monaco-editor/react";
