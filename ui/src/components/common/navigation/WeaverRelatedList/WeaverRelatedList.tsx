import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type FC,
} from "react";
import type {
  WeaverRelatedListProps,
  WeaverRelatedListItem,
} from "./WeaverRelatedList.types";
import styles from "./WeaverRelatedList.module.css";

export const WeaverRelatedList: FC<WeaverRelatedListProps> = ({
  items = [],
  title = "Related List",
  sticky = true,
  activeItemId,
  defaultActiveItemId,
  onActiveItemChange,
  onItemClick,
  scrollBehavior = "smooth",
  stickyTop,
  className = "",
  style,
}) => {
  // Controlled vs Uncontrolled state
  const isControlled = activeItemId !== undefined;
  const [uncontrolledActiveId, setUncontrolledActiveId] = useState<string>(
    () => defaultActiveItemId ?? items[0]?.id ?? ""
  );

  const effectiveActiveId = isControlled ? activeItemId : uncontrolledActiveId;

  // Keep a ref of the current active ID to prevent stale closures inside observer
  const activeIdRef = useRef(effectiveActiveId);
  useEffect(() => {
    activeIdRef.current = effectiveActiveId;
  }, [effectiveActiveId]);

  // Flag to temporarily suppress IntersectionObserver updates during smooth scroll
  const isProgrammaticScrollRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSetActive = useCallback(
    (id: string) => {
      if (!isControlled) {
        setUncontrolledActiveId(id);
      }
      onActiveItemChange?.(id);
    },
    [isControlled, onActiveItemChange]
  );

  // Handle item click and smooth scrolling
  const handleItemClick = (item: WeaverRelatedListItem) => {
    if (item.disabled) return;

    onItemClick?.(item);
    handleSetActive(item.id);

    if (typeof document === "undefined" || !item.targetId) return;

    const targetElement = document.getElementById(item.targetId);
    if (!targetElement) return;

    // Suppress observer updates while the browser scrolls to the target
    isProgrammaticScrollRef.current = true;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 750);

    targetElement.scrollIntoView({
      behavior: scrollBehavior,
      block: "start",
    });
  };

  // Map targetId to itemId for fast lookup in observer (read through a ref so the
  // observer is not rebuilt when the parent passes a new-but-equal items array)
  const targetIdToItemIdMap = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((item) => {
      if (item.targetId) {
        map.set(item.targetId, item.id);
      }
    });
    return map;
  }, [items]);

  const targetIdToItemIdRef = useRef(targetIdToItemIdMap);
  targetIdToItemIdRef.current = targetIdToItemIdMap;
  const handleSetActiveRef = useRef(handleSetActive);
  handleSetActiveRef.current = handleSetActive;

  // Stable key (DOM ids cannot contain spaces): the observer only needs rebuilding
  // when the set of observed targets changes
  const observedTargetsKey = useMemo(
    () => items.map((item) => item.targetId ?? "").filter(Boolean).join(" "),
    [items]
  );

  // Clear any pending programmatic-scroll timer on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Active section tracking using IntersectionObserver
  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      return;
    }

    if (!observedTargetsKey) return;

    const handleIntersect: IntersectionObserverCallback = (entries) => {
      if (isProgrammaticScrollRef.current) return;

      // Filter to intersecting elements
      const intersectingEntries = entries.filter((e) => e.isIntersecting);
      if (intersectingEntries.length === 0) return;

      // Select the entry closest to top of reading area
      const primaryEntry = intersectingEntries.reduce((prev, curr) =>
        curr.boundingClientRect.top < prev.boundingClientRect.top ? curr : prev
      );

      const targetId = primaryEntry.target.id;
      const matchingItemId = targetIdToItemIdRef.current.get(targetId);

      if (matchingItemId && matchingItemId !== activeIdRef.current) {
        handleSetActiveRef.current(matchingItemId);
      }
    };

    const observer = new IntersectionObserver(handleIntersect, {
      root: null,
      rootMargin: "-80px 0px -60% 0px",
      threshold: [0, 0.1, 0.25],
    });

    observedTargetsKey.split(" ").forEach((targetId) => {
      const el = document.getElementById(targetId);
      if (el) {
        observer.observe(el);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [observedTargetsKey]);

  if (!items || items.length === 0) {
    return null;
  }

  const containerClasses = [
    styles.container,
    sticky ? styles.sticky : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const containerStyle: React.CSSProperties = {
    ...style,
    ...(sticky && stickyTop !== undefined ? { top: stickyTop } : {}),
  };

  const navAriaLabel =
    typeof title === "string" ? title : "Related sections navigation";

  return (
    <nav className={containerClasses} style={containerStyle} aria-label={navAriaLabel}>
      {/* Title Header */}
      {title ? (
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
        </div>
      ) : null}

      {/* Desktop Vertical List */}
      <div className={styles.desktopNav}>
        <ul className={styles.navList} role="list">
          {items.map((item) => {
            const isActive = item.id === effectiveActiveId;
            const buttonClasses = [
              styles.navButton,
              isActive ? styles.navButtonActive : "",
              item.disabled ? styles.navButtonDisabled : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <li key={item.id} className={styles.navItem} role="listitem">
                <button
                  type="button"
                  className={buttonClasses}
                  onClick={() => handleItemClick(item)}
                  disabled={item.disabled}
                  aria-current={isActive ? "true" : undefined}
                >
                  {item.icon ? (
                    <span className={styles.itemIcon}>{item.icon}</span>
                  ) : null}
                  <span className={styles.itemLabel}>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Compact Mobile / Tablet View */}
      <div className={styles.mobileNav}>
        {items.map((item) => {
          const isActive = item.id === effectiveActiveId;
          const pillClasses = [
            styles.mobilePill,
            isActive ? styles.mobilePillActive : "",
            item.disabled ? styles.mobilePillDisabled : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={`mobile-${item.id}`}
              type="button"
              className={pillClasses}
              onClick={() => handleItemClick(item)}
              disabled={item.disabled}
              aria-current={isActive ? "true" : undefined}
            >
              {item.icon ? (
                <span className={styles.itemIcon}>{item.icon}</span>
              ) : null}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
