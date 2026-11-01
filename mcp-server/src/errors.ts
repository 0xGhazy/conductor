export type SidecarErrorCode =
  | "INVALID_INPUT"
  | "WEAVER_UNREACHABLE"
  | "WEAVER_TIMEOUT"
  | "INVALID_WEAVER_RESPONSE"
  | "WEAVER_PAGE_LIMIT";

export class SidecarError extends Error {
  readonly code: SidecarErrorCode;
  readonly details?: unknown;

  constructor(code: SidecarErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "SidecarError";
    this.code = code;
    this.details = details;
  }
}

export const sidecarErrorBody = (
  error: SidecarError,
): Record<string, unknown> => ({
  error: {
    code: error.code,
    message: error.message,
    ...(error.details === undefined ? {} : { details: error.details }),
  },
});
