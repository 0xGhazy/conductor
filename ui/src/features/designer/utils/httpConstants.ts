export const VALID_HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
  "OPTIONS",
] as const;

export type ValidHttpMethod = (typeof VALID_HTTP_METHODS)[number];

export const VALID_HTTP_METHODS_SET = new Set<string>(VALID_HTTP_METHODS);

export const HTTP_METHOD_OPTIONS = VALID_HTTP_METHODS.map((method) => ({
  value: method,
  label: method,
}));

export const DEFAULT_HTTP_TIMEOUT = 3000;

export const DEFAULT_HTTP_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

export const DEFAULT_HTTP_HEADERS_STR = JSON.stringify(DEFAULT_HTTP_HEADERS, null, 2);
