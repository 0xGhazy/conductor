import { createTheme } from "@mui/material";

export const buildTheme = (mode: "light" | "dark" = "light") => {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      background: isDark
        ? { default: "#141A27", paper: "#1C2433" }
        : { default: "#F3F5F9", paper: "#FFFFFF" },
      text: isDark
        ? { primary: "#E9ECF4", secondary: "#AAB3C6" }
        : { primary: "#151B2B", secondary: "#4A5468" },
      primary: {
        main: "#D9102B",
        dark: isDark ? "#EE2A40" : "#BD0D25",
        light: isDark ? "rgba(255, 107, 120, 0.14)" : "rgba(217, 16, 43, 0.12)",
        contrastText: "#FFFFFF",
      },
      secondary: isDark
        ? { main: "#FF8A4C", light: "rgba(255, 138, 76, 0.18)", contrastText: "#FFFFFF" }
        : { main: "#9A3412", light: "rgba(234, 88, 12, 0.12)", contrastText: "#FFFFFF" },
      success: isDark
        ? { main: "#4ADE80", contrastText: "#141A27" }
        : { main: "#15803D", contrastText: "#FFFFFF" },
      warning: isDark
        ? { main: "#FFC15A", contrastText: "#141A27" }
        : { main: "#9A5A00", contrastText: "#FFFFFF" },
      info: isDark
        ? { main: "#7FB0FF", contrastText: "#141A27" }
        : { main: "#1D4ED8", contrastText: "#FFFFFF" },
      error: isDark
        ? { main: "#FF7A85", contrastText: "#141A27" }
        : { main: "#C81E2D", contrastText: "#FFFFFF" },
      divider: isDark ? "#35405A" : "#D8DDE8",
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      button: { textTransform: "none" },
    },
    components: {
      MuiTableCell: {
        styleOverrides: {
          head: {
            textAlign: "left",
            fontWeight: 700,
          },
        },
      },
      MuiListItemIcon: { styleOverrides: { root: { minWidth: 36 } } },
      MuiButton: { styleOverrides: {
        root: { borderRadius: 8, fontWeight: 600, textTransform: "none", transition: "background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease" },
        containedPrimary: { backgroundColor: "var(--color-accent-solid)", color: "#FFFFFF", boxShadow: "none", "&:hover": { backgroundColor: "var(--color-accent-hover)", boxShadow: "none" } },
        outlinedPrimary: { borderColor: "var(--color-accent-fg)", color: "var(--color-accent-fg)", "&:hover": { borderColor: "var(--color-accent-hover)", backgroundColor: "var(--color-accent-subtle)" } },
      } },
      MuiTabs: { styleOverrides: { indicator: { backgroundColor: "var(--color-accent-solid)", height: 3, borderRadius: "3px 3px 0 0" } } },
      MuiTab: { styleOverrides: { root: {
        textTransform: "none", fontWeight: 600, color: "var(--color-fg-muted)", transition: "color 0.2s ease",
        "&.Mui-selected": { color: "var(--color-accent-fg)" },
        "&:focus-visible": { outline: "none", boxShadow: "var(--color-focus-ring)" },
      } } },
      MuiChip: { styleOverrides: {
        root: { fontWeight: 600, borderRadius: 6 },
        colorPrimary: { backgroundColor: "var(--color-accent-subtle)", color: "var(--color-accent-fg)", borderColor: "var(--color-accent-fg)" },
        colorSecondary: { backgroundColor: "var(--hue-orange-tint)", color: "var(--color-orange-fg)", borderColor: "var(--hue-orange)" },
      } },
      MuiOutlinedInput: { styleOverrides: { root: {
        borderRadius: 8, transition: "border-color 0.2s ease, box-shadow 0.2s ease",
        "& .MuiOutlinedInput-notchedOutline": { borderColor: "var(--color-border-strong)" },
        "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "var(--color-fg-muted)" },
        "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "var(--color-accent-fg)", borderWidth: "1.5px" },
        "&.Mui-focused": { boxShadow: "var(--color-focus-ring)" },
      } } },
    },
  });
};
