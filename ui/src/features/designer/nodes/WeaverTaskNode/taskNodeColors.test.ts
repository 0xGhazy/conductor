import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { TASK_NODE_COLORS } from "@/features/designer/nodes/WeaverTaskNode";

// Vitest stubs CSS imports (even ?raw), so read the token file directly; tests run from the ui/ root.
const variablesCss = readFileSync(resolve(process.cwd(), "src/styles/variables.css"), "utf8");

const tokenName = (value: string) => value.match(/var\((--[a-z-]+)\)/)?.[1] ?? "";

describe("TASK_NODE_COLORS", () => {
  it("gives every task type its own color token", () => {
    const tokens = Object.values(TASK_NODE_COLORS).map(tokenName);
    expect(tokens.every(Boolean)).toBe(true);
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it("maps every token to a distinct palette hue defined in both themes", () => {
    const hues = Object.values(TASK_NODE_COLORS).map((value) => {
      const token = tokenName(value);
      const declaration = variablesCss.match(new RegExp(`${token}:\\s*var\\((--hue-[a-z]+)\\)`));
      expect(declaration, `${token} should be declared in variables.css`).not.toBeNull();
      return declaration![1];
    });

    expect(new Set(hues).size).toBe(hues.length);
    hues.forEach((hue) => {
      // Light (:root) and dark (html[data-theme="dark"]) palettes both define the hue
      const definitions = variablesCss.match(new RegExp(`${hue}:\\s*#`, "g")) ?? [];
      expect(definitions.length, `${hue} should exist in light and dark palettes`).toBe(2);
    });
  });
});
