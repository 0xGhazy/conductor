import type { NavigateFunction, NavigateOptions } from "react-router-dom";

let navigateInstance: NavigateFunction | null = null;

export const setNavigator = (navigate: NavigateFunction): void => {
  navigateInstance = navigate;
};

export const navigateTo = (to: string, options?: NavigateOptions): void => {
  if (navigateInstance) {
    navigateInstance(to, options);
  } else if (typeof window !== "undefined") {
    window.location.assign(to);
  }
};
