/** React Query keys for the settings feature. Invalidate `supportedLanguageKeys.all` after mutations. */
export const supportedLanguageKeys = {
  all: ["supportedLanguages"] as const,
  list: () => [...supportedLanguageKeys.all, "list"] as const,
};
