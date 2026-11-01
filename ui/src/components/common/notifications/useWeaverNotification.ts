import { useContext } from "react";
import { WeaverNotificationContext } from "./WeaverNotificationProvider/WeaverNotificationProvider";
import type { WeaverNotificationApi } from "./notification.types";

/**
 * Canonical hook to trigger application notifications.
 *
 * Usage:
 * ```tsx
 * const notify = useWeaverNotification();
 * notify.success("Workflow saved successfully");
 * notify.error({
 *   title: "Connection Failed",
 *   message: "Database endpoint is unreachable",
 *   action: { label: "Retry", onClick: () => handleRetry() },
 * });
 * ```
 */
export function useWeaverNotification(): WeaverNotificationApi {
  const context = useContext(WeaverNotificationContext);
  if (!context) {
    throw new Error(
      "useWeaverNotification must be used within a WeaverNotificationProvider"
    );
  }
  return context;
}

export default useWeaverNotification;
