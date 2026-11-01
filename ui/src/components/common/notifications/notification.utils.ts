import { nanoid } from "nanoid";
import type {
  WeaverNotification,
  WeaverNotificationContent,
  WeaverNotificationInput,
  WeaverNotificationPosition,
  WeaverNotificationSeverity,
} from "./notification.types";

export const DEFAULT_NOTIFICATION_DURATIONS: Record<WeaverNotificationSeverity, number | null> = {
  success: 4000,
  info: 5000,
  warning: 6000,
  error: 7000,
};

let fallbackCounter = 0;

export function generateNotificationId(): string {
  try {
    return `wn_${nanoid(8)}`;
  } catch {
    fallbackCounter += 1;
    return `wn_${Date.now()}_${fallbackCounter}`;
  }
}

export function normalizeNotificationInput(
  content: WeaverNotificationContent,
  defaultSeverity: WeaverNotificationSeverity = "info",
  customDefaults?: Partial<Record<WeaverNotificationSeverity, number | null>>
): Omit<WeaverNotification, "id" | "createdAt" | "remainingDuration" | "timerStartedAt"> {
  if (typeof content === "string") {
    const duration =
      customDefaults?.[defaultSeverity] !== undefined
        ? customDefaults[defaultSeverity]
        : DEFAULT_NOTIFICATION_DURATIONS[defaultSeverity];

    return {
      severity: defaultSeverity,
      message: content,
      duration,
      dismissible: true,
    };
  }

  const severity = defaultSeverity;
  const configuredDuration =
    content.duration !== undefined
      ? content.duration
      : customDefaults?.[severity] !== undefined
      ? customDefaults[severity]
      : DEFAULT_NOTIFICATION_DURATIONS[severity];

  return {
    severity,
    title: content.title,
    message: content.message,
    duration: configuredDuration,
    dismissible: content.dismissible !== undefined ? content.dismissible : true,
    action: content.action,
    dedupeKey: content.dedupeKey,
  };
}

export function normalizeFullNotificationInput(
  input: WeaverNotificationInput,
  customDefaults?: Partial<Record<WeaverNotificationSeverity, number | null>>
): Omit<WeaverNotification, "id" | "createdAt" | "remainingDuration" | "timerStartedAt"> {
  const severity: WeaverNotificationSeverity = input.severity || "info";
  const configuredDuration =
    input.duration !== undefined
      ? input.duration
      : customDefaults?.[severity] !== undefined
      ? customDefaults[severity]
      : DEFAULT_NOTIFICATION_DURATIONS[severity];

  return {
    severity,
    title: input.title,
    message: input.message,
    duration: configuredDuration,
    dismissible: input.dismissible !== undefined ? input.dismissible : true,
    action: input.action,
    dedupeKey: input.dedupeKey,
  };
}

export function getPositionStyles(position: WeaverNotificationPosition): React.CSSProperties {
  const spacing = 16;
  const base: React.CSSProperties = {
    position: "fixed",
    zIndex: 1400,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    maxWidth: "420px",
    width: "calc(100vw - 32px)",
    pointerEvents: "none",
  };

  switch (position) {
    case "top-right":
      return {
        ...base,
        top: spacing,
        right: spacing,
        alignItems: "flex-end",
      };
    case "top-left":
      return {
        ...base,
        top: spacing,
        left: spacing,
        alignItems: "flex-start",
      };
    case "bottom-right":
      return {
        ...base,
        bottom: spacing,
        right: spacing,
        alignItems: "flex-end",
      };
    case "bottom-left":
      return {
        ...base,
        bottom: spacing,
        left: spacing,
        alignItems: "flex-start",
      };
    case "top-center":
      return {
        ...base,
        top: spacing,
        left: "50%",
        transform: "translateX(-50%)",
        alignItems: "center",
      };
    case "bottom-center":
      return {
        ...base,
        bottom: spacing,
        left: "50%",
        transform: "translateX(-50%)",
        alignItems: "center",
      };
    default:
      return {
        ...base,
        bottom: spacing,
        right: spacing,
        alignItems: "flex-end",
      };
  }
}
