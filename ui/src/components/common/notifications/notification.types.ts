import type { ReactNode } from "react";

export type WeaverNotificationSeverity = "success" | "error" | "warning" | "info";

export type WeaverNotificationPosition =
  | "top-right"
  | "top-left"
  | "bottom-right"
  | "bottom-left"
  | "top-center"
  | "bottom-center";

export interface WeaverNotificationAction {
  label: string;
  onClick: () => void;
}

export interface WeaverNotification {
  id: string;
  severity: WeaverNotificationSeverity;
  title?: string;
  message: ReactNode;
  duration?: number | null;
  dismissible?: boolean;
  action?: WeaverNotificationAction;
  dedupeKey?: string;
  createdAt?: number;
  /** Internal tracking for pause/resume */
  remainingDuration?: number | null;
  timerStartedAt?: number | null;
  isPaused?: boolean;
}

export type WeaverNotificationContent =
  | string
  | {
      title?: string;
      message: ReactNode;
      duration?: number | null;
      dismissible?: boolean;
      action?: WeaverNotificationAction;
      dedupeKey?: string;
    };

export interface WeaverNotificationInput {
  severity?: WeaverNotificationSeverity;
  title?: string;
  message: ReactNode;
  duration?: number | null;
  dismissible?: boolean;
  action?: WeaverNotificationAction;
  dedupeKey?: string;
}

export interface WeaverNotificationApi {
  show(notification: WeaverNotificationInput): string;
  success(notification: WeaverNotificationContent): string;
  error(notification: WeaverNotificationContent): string;
  warning(notification: WeaverNotificationContent): string;
  info(notification: WeaverNotificationContent): string;
  dismiss(id: string): void;
  dismissAll(): void;
}

export interface WeaverNotificationProviderProps {
  children: ReactNode;
  /** Maximum number of notifications visible simultaneously (default: 3) */
  maxVisible?: number;
  /** Screen position for notification container (default: 'bottom-right') */
  position?: WeaverNotificationPosition;
  /** Optional animated progress bar indicator (default: false) */
  showProgress?: boolean;
  /** Custom default durations per severity in ms (null means persistent) */
  defaultDurations?: Partial<Record<WeaverNotificationSeverity, number | null>>;
}
