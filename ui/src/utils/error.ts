const BACKEND_DOWN_MESSAGE = "Unable to reach backend service. Please ensure backend is running.";

const isJsonParseErrorText = (text) => {
  const msg = String(text || "").toLowerCase();
  return (
    msg.includes("unexpected token '<'") ||
    msg.includes("is not valid json") ||
    msg.includes("json at position")
  );
};

const isLikelyHtmlText = (text) => {
  const msg = String(text || "").trim().toLowerCase();
  return msg.startsWith("<!doctype") || msg.startsWith("<html") || msg.includes("<body");
};

export function getErrorMessage(error, fallback) {
  if (!error) return fallback;
  if (typeof error === "string") {
    if (isJsonParseErrorText(error) || isLikelyHtmlText(error)) return fallback || BACKEND_DOWN_MESSAGE;
    return error;
  }
  const responseData = error?.response?.data;
  if (responseData) {
    if (typeof responseData === "string") {
      if (isJsonParseErrorText(responseData) || isLikelyHtmlText(responseData)) {
        return fallback || BACKEND_DOWN_MESSAGE;
      }
      try {
        const parsed = JSON.parse(responseData);
        return parsed.reason || parsed.message || fallback;
      } catch {
        return responseData;
      }
    }
    if (typeof responseData === "object") {
      return responseData.reason || responseData.message || fallback;
    }
  }
  const message = error.message || fallback;
  if (typeof message !== "string") return fallback;
  if (isJsonParseErrorText(message) || isLikelyHtmlText(message)) {
    return fallback || BACKEND_DOWN_MESSAGE;
  }
  try {
    const parsed = JSON.parse(message);
    return parsed.reason || parsed.message || fallback;
  } catch {
    return message;
  }
}

