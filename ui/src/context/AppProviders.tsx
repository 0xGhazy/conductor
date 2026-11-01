import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { buildTheme } from "@/styles/theme";
import { WeaverNotificationProvider } from "@/components/common/notifications";
import { AuthProvider } from "@/features/auth";
import { ThemeModeContext, type ThemeMode } from "@/context/ThemeModeContext";

interface AppProvidersProps {
  children: ReactNode;
}

const getInitialMode = (): ThemeMode => {
  const saved = localStorage.getItem("theme");
  if (saved === "dark" || saved === "light") return saved;
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      refetchOnWindowFocus: false,
    },
  },
});

export default function AppProviders({ children }: AppProvidersProps) {
  const [mode, setMode] = useState<ThemeMode>(getInitialMode);

  useEffect(() => {
    const next = mode === "dark" ? "dark" : "light";
    if (document.documentElement.dataset.theme !== next) {
      document.documentElement.dataset.theme = next;
    }
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Storage can be unavailable (private mode); the in-memory mode still applies.
    }
  }, [mode]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "theme") return;
      const next = event.newValue === "dark" ? "dark" : "light";
      setMode((prev) => (prev === next ? prev : next));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const next =
        document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      setMode((prev) => (prev === next ? prev : next));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const themeMode = useMemo(() => ({ mode, toggleMode }), [mode, toggleMode]);
  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeModeContext.Provider value={themeMode}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <AuthProvider>
              <WeaverNotificationProvider>
                {children}
              </WeaverNotificationProvider>
            </AuthProvider>
          </ThemeProvider>
        </ThemeModeContext.Provider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
