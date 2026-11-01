import type {
  WeaverNotificationApi,
  WeaverNotificationPosition,
  WeaverNotificationProviderProps,
  WeaverNotificationSeverity,
} from "../notification.types";

export type {
  WeaverNotificationApi,
  WeaverNotificationPosition,
  WeaverNotificationProviderProps,
  WeaverNotificationSeverity,
};

export interface WeaverNotificationContextValue extends WeaverNotificationApi {}
