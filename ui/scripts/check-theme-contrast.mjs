import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = fs.readFileSync(path.join(root, "src/styles/variables.css"), "utf8");
const themes = {
  light: css.match(/:root,\s*html\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/)?.[1],
  dark: css.match(/html\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/)?.[1],
};

if (!themes.light || !themes.dark) throw new Error("Could not find light and dark theme blocks.");

const parse = (block) => ({
  "--white": "#FFFFFF",
  ...Object.fromEntries(
    [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, key, value]) => [key, value.trim()]),
  ),
});

const hexToRgb = (hex) => {
  const normalized = hex.replace("#", "");
  if (!/^[\da-f]{6}$/i.test(normalized)) throw new Error(`Unsupported color: ${hex}`);
  return [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16));
};

const mix = (foreground, background, amount) => foreground.map(
  (channel, index) => Math.round(channel * amount + background[index] * (1 - amount)),
);

const luminance = (rgb) => {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
};

const resolveValue = (tokens, name, seen = new Set()) => {
  if (seen.has(name)) throw new Error(`Circular token reference: ${name}`);
  const raw = tokens[name];
  if (!raw) throw new Error(`Missing token: ${name}`);
  const variable = raw.match(/^var\((--[\w-]+)\)$/);
  if (!variable) return raw;
  return resolveValue(tokens, variable[1], new Set([...seen, name]));
};

const resolveColor = (tokens, name, backgroundName) => {
  const raw = resolveValue(tokens, name);
  if (raw.startsWith("#")) return hexToRgb(raw);
  const colorMix = raw.match(/^color-mix\(in srgb, var\((--[\w-]+)\) (\d+)%?, transparent\)$/);
  if (colorMix && backgroundName) {
    return mix(resolveColor(tokens, colorMix[1]), resolveColor(tokens, backgroundName), Number(colorMix[2]) / 100);
  }
  throw new Error(`Unsupported resolved color for ${name}: ${raw}`);
};

const rows = [];
const check = (mode, foreground, background, minimum, tintBackground) => {
  const tokens = parse(themes[mode]);
  const ratio = contrast(
    resolveColor(tokens, foreground, tintBackground ?? background),
    resolveColor(tokens, background, tintBackground),
  );
  rows.push({ mode, foreground, background, minimum, ratio, pass: ratio + 1e-9 >= minimum });
};

for (const mode of ["light", "dark"]) {
  const surfaces = ["--color-canvas-default", "--color-canvas-subtle", "--color-surface-soft", "--color-node-surface"];
  for (const text of ["--color-fg-default", "--color-fg-muted", "--color-fg-soft", "--color-fg-subtle"]) {
    for (const surface of surfaces) check(mode, text, surface, 4.5);
  }
  check(mode, "--color-accent-solid", "--white", 4.5);
  for (const semantic of ["--color-accent-fg", "--color-status-success", "--color-status-danger", "--color-status-warn", "--color-status-info"]) {
    check(mode, semantic, "--color-canvas-default", 4.5);
  }
  for (const hue of ["indigo", "blue", "cyan", "teal", "green", "amber", "orange", "red", "violet", "pink"]) {
    const surface = mode === "light" ? "--color-canvas-default" : "--color-node-surface";
    check(mode, `--hue-${hue}-ink`, `--hue-${hue}-tint`, 4.5, surface);
    check(mode, `--hue-${hue}-ink`, surface, 4.5);
    check(mode, `--hue-${hue}`, "--color-canvas-subtle", 3);
  }
  for (const surface of ["--color-canvas-default", "--color-surface-soft"]) {
    check(mode, "--color-border-strong", surface, 3);
  }
}

console.log("Mode   Foreground                    Background                     Ratio  Min   Result");
console.log("------ ----------------------------- ------------------------------ ------ ----- ------");
for (const row of rows) {
  console.log(`${row.mode.padEnd(6)} ${row.foreground.padEnd(29)} ${row.background.padEnd(30)} ${row.ratio.toFixed(2).padStart(6)} ${row.minimum.toFixed(1).padStart(5)} ${row.pass ? "PASS" : "FAIL"}`);
}

const failures = rows.filter((row) => !row.pass);
console.log(`\n${rows.length} checks; ${rows.length - failures.length} passed; ${failures.length} failed.`);
if (failures.length) process.exitCode = 1;
