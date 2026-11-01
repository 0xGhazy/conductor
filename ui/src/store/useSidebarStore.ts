import { create } from "zustand";

interface SidebarState {
  collapsed: boolean;
  toggleSidebar: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed: (() => {
    try {
      return localStorage.getItem("sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  })(),
  toggleSidebar: () =>
    set((state) => {
      const next = !state.collapsed;
      try {
        localStorage.setItem("sidebar_collapsed", String(next));
      } catch {}
      return { collapsed: next };
    }),
  setCollapsed: (collapsed: boolean) => {
    try {
      localStorage.setItem("sidebar_collapsed", String(collapsed));
    } catch {}
    set({ collapsed });
  },
}));
