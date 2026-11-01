import React from "react";
import { useOutletContext } from "react-router-dom";

export interface AppLayoutContext {
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
}

export function useAppLayout() {
  return useOutletContext<AppLayoutContext>();
}
