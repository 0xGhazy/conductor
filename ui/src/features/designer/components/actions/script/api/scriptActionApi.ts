import { config } from "@/config/appConfig";

const SCRIPT_ENGINE_EXECUTE_URL = `${config.apiBaseUrl}/api/scripts/execute`;

export interface ExecuteScriptActionResult {
  response: Response;
  body: unknown;
}

export const executeScriptAction = async (
  payload: unknown
): Promise<ExecuteScriptActionResult> => {
  const response = await fetch(SCRIPT_ENGINE_EXECUTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  return { response, body };
};
