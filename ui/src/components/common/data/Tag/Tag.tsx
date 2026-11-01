import { Chip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

const COLOR_SWATCHES = [
  { light: "#E5484D", dark: "#FF5A5F" }, // coral
  { light: "#FF8A3D", dark: "#FF9B45" }, // orange
  { light: "#2C8C84", dark: "#5BC8BC" }, // teal
  { light: "#B66A00", dark: "#FFB15C" }, // warn / amber
  { light: "#C93136", dark: "#FF6B70" }, // red / danger
  { light: "#D33B40", dark: "#FF7043" }, // deep coral
];

const hashString = (value: unknown) => {
  const str = String(value ?? "");
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const safeAlphaBackground = (colorValue: string, opacity: number) => {
  if (!colorValue) return "transparent";
  if (typeof colorValue === "string" && colorValue.includes("var(")) {
    return `color-mix(in srgb, ${colorValue} ${opacity * 100}%, transparent)`;
  }
  try {
    return alpha(colorValue, opacity);
  } catch {
    return `color-mix(in srgb, ${colorValue} ${opacity * 100}%, transparent)`;
  }
};

export interface TagProps {
  text?: string | number;
  color?: string;
  border?: string;
  borderColor?: string;
  randomColor?: boolean;
}

export default function Tag({
  text = "",
  color = "",
  border = "",
  borderColor = "",
  randomColor = false,
}: TagProps) {
  const theme = useTheme();

  const accent = (() => {
    if (color) return color;
    if (!randomColor) return theme.palette.primary.main;

    const idx = hashString(text) % COLOR_SWATCHES.length;
    const swatch = COLOR_SWATCHES[idx];
    return theme.palette.mode === "dark" ? swatch.dark : swatch.light;
  })();

  const borderValue = border || borderColor || accent;
  const bgOpacity = theme.palette.mode === "dark" ? 0.18 : 0.12;

  return (
    <Chip
      size="small"
      label={text ?? "-"}
      variant="outlined"
      sx={{
        height: 22,
        borderRadius: "999px",
        fontWeight: 700,
        // override global `.definitions-page .MuiChip-root { background/border/... }`
        background: `${safeAlphaBackground(accent, bgOpacity)} !important`,
        border: `1px solid ${borderValue} !important`,
        color: `${borderValue} !important`,
        "& .MuiChip-label": { px: 1, fontSize: 12, lineHeight: 1 },
      }}
    />
  );
}
