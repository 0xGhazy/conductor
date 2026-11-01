import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type {
  WeaverNotification,
  WeaverNotificationContent,
  WeaverNotificationInput,
  WeaverNotificationProviderProps,
} from "../notification.types";
import {
  generateNotificationId,
  getPositionStyles,
  normalizeFullNotificationInput,
  normalizeNotificationInput,
} from "../notification.utils";
import WeaverNotificationComponent from "../WeaverNotification/WeaverNotification";
import type { WeaverNotificationContextValue } from "./WeaverNotificationProvider.types";

export const WeaverNotificationContext = createContext<WeaverNotificationContextValue | null>(
  null
);

interface TimerMeta {
  timeoutId: ReturnType<typeof setTimeout> | null;
  remainingDuration: number;
  startedAt: number | null;
}

export const WeaverNotificationProvider: React.FC<WeaverNotificationProviderProps> = ({
  children,
  maxVisible = 3,
  position = "bottom-right",
  showProgress = false,
  defaultDurations,
}) => {
  const [visible, setVisible] = useState<WeaverNotification[]>([]);
  const [queued, setQueued] = useState<WeaverNotification[]>([]);
  const timersRef = useRef<Map<string, TimerMeta>>(new Map());

  // Ref mirror to access current state synchronously inside callbacks without stale closures
  const stateRef = useRef<{
    visible: WeaverNotification[];
    queued: WeaverNotification[];
  }>({
    visible: [],
    queued: [],
  });

  stateRef.current = { visible, queued };

  // Timer helpers
  const clearTimer = useCallback((id: string) => {
    const meta = timersRef.current.get(id);
    if (meta?.timeoutId) {
      clearTimeout(meta.timeoutId);
    }
    timersRef.current.delete(id);
  }, []);

  // Pure state updates only: queue promotion and timer start-up happen in effects below,
  // so updaters stay side-effect free (StrictMode may invoke them twice).
  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id);
      setVisible((prevVisible) => {
        const nextVisible = prevVisible.filter((item) => item.id !== id);
        return nextVisible.length === prevVisible.length ? prevVisible : nextVisible;
      });
      setQueued((prevQueued) => {
        const nextQueued = prevQueued.filter((item) => item.id !== id);
        return nextQueued.length === prevQueued.length ? prevQueued : nextQueued;
      });
    },
    [clearTimer]
  );

  const startTimer = useCallback(
    (id: string, duration: number) => {
      clearTimer(id);
      const timeoutId = setTimeout(() => {
        dismiss(id);
      }, duration);

      timersRef.current.set(id, {
        timeoutId,
        remainingDuration: duration,
        startedAt: Date.now(),
      });
    },
    [clearTimer, dismiss]
  );

  const handleMouseEnter = useCallback((id: string) => {
    const meta = timersRef.current.get(id);
    if (!meta) return;

    if (meta.timeoutId) {
      clearTimeout(meta.timeoutId);
      const elapsed = meta.startedAt ? Date.now() - meta.startedAt : 0;
      const remaining = Math.max(0, meta.remainingDuration - elapsed);

      timersRef.current.set(id, {
        timeoutId: null,
        remainingDuration: remaining,
        startedAt: null,
      });
    }
  }, []);

  const handleMouseLeave = useCallback(
    (id: string) => {
      const meta = timersRef.current.get(id);
      if (!meta || meta.timeoutId !== null) return;

      if (meta.remainingDuration <= 0) {
        dismiss(id);
      } else {
        const timeoutId = setTimeout(() => {
          dismiss(id);
        }, meta.remainingDuration);

        timersRef.current.set(id, {
          timeoutId,
          remainingDuration: meta.remainingDuration,
          startedAt: Date.now(),
        });
      }
    },
    [dismiss]
  );

  const dismissAll = useCallback(() => {
    // Clear all running timers
    timersRef.current.forEach((meta) => {
      if (meta.timeoutId) clearTimeout(meta.timeoutId);
    });
    timersRef.current.clear();

    setVisible([]);
    setQueued([]);
  }, []);

  const show = useCallback(
    (input: WeaverNotificationInput): string => {
      const normalized = normalizeFullNotificationInput(input, defaultDurations);

      // Deduplication check: if dedupeKey exists in visible or queued, return existing id
      if (normalized.dedupeKey) {
        const existingVisible = stateRef.current.visible.find(
          (item) => item.dedupeKey === normalized.dedupeKey
        );
        if (existingVisible) return existingVisible.id;

        const existingQueued = stateRef.current.queued.find(
          (item) => item.dedupeKey === normalized.dedupeKey
        );
        if (existingQueued) return existingQueued.id;
      }

      const id = generateNotificationId();
      const notification: WeaverNotification = {
        ...normalized,
        id,
        createdAt: Date.now(),
        remainingDuration: normalized.duration,
        timerStartedAt: null,
        isPaused: false,
      };

      // Timers for visible notifications are started by the effect below
      if (stateRef.current.visible.length < maxVisible) {
        stateRef.current = {
          ...stateRef.current,
          visible: [...stateRef.current.visible, notification],
        };
        setVisible((prev) => [...prev, notification]);
      } else {
        stateRef.current = {
          ...stateRef.current,
          queued: [...stateRef.current.queued, notification],
        };
        setQueued((prev) => [...prev, notification]);
      }

      return id;
    },
    [defaultDurations, maxVisible]
  );

  const success = useCallback(
    (content: WeaverNotificationContent): string => {
      const normalized = normalizeNotificationInput(content, "success", defaultDurations);
      return show(normalized);
    },
    [defaultDurations, show]
  );

  const error = useCallback(
    (content: WeaverNotificationContent): string => {
      const normalized = normalizeNotificationInput(content, "error", defaultDurations);
      return show(normalized);
    },
    [defaultDurations, show]
  );

  const warning = useCallback(
    (content: WeaverNotificationContent): string => {
      const normalized = normalizeNotificationInput(content, "warning", defaultDurations);
      return show(normalized);
    },
    [defaultDurations, show]
  );

  const info = useCallback(
    (content: WeaverNotificationContent): string => {
      const normalized = normalizeNotificationInput(content, "info", defaultDurations);
      return show(normalized);
    },
    [defaultDurations, show]
  );

  // Clean up all timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((meta) => {
        if (meta.timeoutId) clearTimeout(meta.timeoutId);
      });
      timers.clear();
    };
  }, []);

  // Promote queued notifications whenever visible slots free up
  useEffect(() => {
    const room = maxVisible - visible.length;
    if (room <= 0 || queued.length === 0) return;
    const promoted = queued.slice(0, room);
    const promotedIds = new Set(promoted.map((item) => item.id));
    setQueued((prev) => prev.filter((item) => !promotedIds.has(item.id)));
    setVisible((prev) => [...prev, ...promoted.filter((item) => !prev.some((v) => v.id === item.id))]);
  }, [visible, queued, maxVisible]);

  // Start auto-dismiss timers for newly visible notifications (idempotent: paused or
  // running timers already have an entry and are left alone)
  useEffect(() => {
    visible.forEach((item) => {
      if (item.duration && item.duration > 0 && !timersRef.current.has(item.id)) {
        startTimer(item.id, item.duration);
      }
    });
  }, [visible, startTimer]);

  const contextValue = useMemo<WeaverNotificationContextValue>(
    () => ({
      show,
      success,
      error,
      warning,
      info,
      dismiss,
      dismissAll,
    }),
    [show, success, error, warning, info, dismiss, dismissAll]
  );

  const containerStyles = useMemo(() => getPositionStyles(position), [position]);

  const renderPortal = () => {
    if (typeof document === "undefined" || visible.length === 0) return null;

    return createPortal(
      <div
        style={containerStyles}
        aria-label="Notifications"
        data-testid="weaver-notification-container"
      >
        {visible.map((item) => (
          <WeaverNotificationComponent
            key={item.id}
            notification={item}
            onDismiss={dismiss}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            showProgress={showProgress}
          />
        ))}
      </div>,
      document.body
    );
  };

  return (
    <WeaverNotificationContext.Provider value={contextValue}>
      {children}
      {renderPortal()}
    </WeaverNotificationContext.Provider>
  );
};

export default WeaverNotificationProvider;
