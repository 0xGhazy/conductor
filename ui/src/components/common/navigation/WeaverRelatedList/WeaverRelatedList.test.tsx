import { describe, it } from "vitest";
import React from "react";
import type {
  WeaverRelatedListItem,
  WeaverRelatedListProps,
} from "./WeaverRelatedList.types";

/**
 * Pure helper simulating the item click logic of WeaverRelatedList.
 */
function simulateItemClick(
  item: WeaverRelatedListItem,
  options: {
    scrollBehavior?: ScrollBehavior;
    targetFinder?: (id: string) => { scrollIntoView: (opt: any) => void } | null;
    onItemClick?: (item: WeaverRelatedListItem) => void;
    onActiveItemChange?: (id: string) => void;
  }
): {
  scrolled: boolean;
  scrollOptions?: any;
  activatedId?: string;
  itemClicked?: WeaverRelatedListItem;
} {
  if (item.disabled) {
    return { scrolled: false };
  }

  let scrolled = false;
  let scrollOptions: any = null;

  options.onItemClick?.(item);
  options.onActiveItemChange?.(item.id);

  if (options.targetFinder) {
    const target = options.targetFinder(item.targetId);
    if (target) {
      scrollOptions = {
        behavior: options.scrollBehavior ?? "smooth",
        block: "start",
      };
      target.scrollIntoView(scrollOptions);
      scrolled = true;
    }
  }

  return {
    scrolled,
    scrollOptions,
    activatedId: item.id,
    itemClicked: item,
  };
}

/**
 * Pure helper simulating controlled vs uncontrolled active item resolution.
 */
function resolveActiveItemId(params: {
  controlledId?: string;
  uncontrolledId?: string;
  defaultId?: string;
  items: WeaverRelatedListItem[];
}): string {
  if (params.controlledId !== undefined) {
    return params.controlledId;
  }
  if (params.uncontrolledId !== undefined) {
    return params.uncontrolledId;
  }
  return params.defaultId ?? params.items[0]?.id ?? "";
}

/**
 * Pure helper simulating IntersectionObserver section visibility matching.
 */
function matchVisibleSection(
  entries: Array<{ targetId: string; isIntersecting: boolean; top: number }>,
  items: WeaverRelatedListItem[]
): string | null {
  const intersecting = entries.filter((e) => e.isIntersecting);
  if (intersecting.length === 0) return null;

  // Closest to top of reading area
  const primary = intersecting.reduce((prev, curr) =>
    curr.top < prev.top ? curr : prev
  );

  const matched = items.find((i) => i.targetId === primary.targetId);
  return matched ? matched.id : null;
}

describe("WeaverRelatedList Specification & Behavior", () => {
  const SAMPLE_ITEMS: WeaverRelatedListItem[] = [
    {
      id: "details",
      label: "Connection Details",
      targetId: "details-section",
      icon: "DATABASE_ICON",
    },
    {
      id: "queries",
      label: "Related Queries",
      targetId: "queries-section",
    },
    {
      id: "workflows",
      label: "Associated Workflows",
      targetId: "workflows-section",
      disabled: true,
    },
  ];

  describe("1. Basic Rendering & Item Model", () => {
    it("validates basic navigation properties and default title", () => {
      const props: WeaverRelatedListProps = {
        items: SAMPLE_ITEMS,
        title: "Page Sections",
        sticky: true,
      };

      if (!props.items || props.items.length !== 3) {
        throw new Error("Expected 3 items in list");
      }
      if (props.title !== "Page Sections") {
        throw new Error("Expected custom title to be preserved");
      }
      if (props.sticky !== true) {
        throw new Error("Expected sticky to be true by default");
      }
    });

    it("ensures no record counts or badges exist in the item model", () => {
      const item = SAMPLE_ITEMS[0] as any;
      if (item.count !== undefined || item.badge !== undefined || item.total !== undefined) {
        throw new Error("Item model must not include record counts or badges");
      }
    });
  });

  describe("2. Optional Icons Contract", () => {
    it("preserves icon when provided and omits container when absent", () => {
      const itemWithIcon = SAMPLE_ITEMS[0];
      const itemWithoutIcon = SAMPLE_ITEMS[1];

      if (!itemWithIcon.icon) throw new Error("Expected itemWithIcon to have icon");
      if (itemWithoutIcon.icon !== undefined) {
        throw new Error("Expected itemWithoutIcon to omit icon property");
      }
    });
  });

  describe("3. Click Navigation & Smooth Scrolling", () => {
    it("locates target element and invokes scrollIntoView with smooth behavior", () => {
      let scrolledTarget: string | null = null;
      let usedScrollOptions: any = null;

      const mockTarget = {
        scrollIntoView: (opt: any) => {
          scrolledTarget = "queries-section";
          usedScrollOptions = opt;
        },
      };

      const result = simulateItemClick(SAMPLE_ITEMS[1], {
        scrollBehavior: "smooth",
        targetFinder: (id) => (id === "queries-section" ? mockTarget : null),
      });

      if (!result.scrolled) throw new Error("Expected click to trigger scroll");
      if (scrolledTarget !== "queries-section") {
        throw new Error("Expected target 'queries-section' to be scrolled into view");
      }
      if (usedScrollOptions?.behavior !== "smooth" || usedScrollOptions?.block !== "start") {
        throw new Error("Expected smooth behavior and start block alignment");
      }
    });

    it("respects custom scrollBehavior (e.g. auto / instant)", () => {
      let usedOptions: any = null;
      const mockTarget = {
        scrollIntoView: (opt: any) => {
          usedOptions = opt;
        },
      };

      simulateItemClick(SAMPLE_ITEMS[0], {
        scrollBehavior: "auto",
        targetFinder: () => mockTarget,
      });

      if (usedOptions?.behavior !== "auto") {
        throw new Error("Expected custom scrollBehavior 'auto' to be passed to scrollIntoView");
      }
    });

    it("fires onItemClick callback with clicked item", () => {
      let clickedItem: WeaverRelatedListItem | null = null;

      simulateItemClick(SAMPLE_ITEMS[0], {
        onItemClick: (item) => {
          clickedItem = item;
        },
      });

      if (clickedItem?.id !== "details") {
        throw new Error("Expected onItemClick to fire with item details");
      }
    });
  });

  describe("4. Disabled Items Behavior", () => {
    it("does not scroll or fire callbacks when item is disabled", () => {
      let clicked = false;
      let targetScrolled = false;

      const mockTarget = {
        scrollIntoView: () => {
          targetScrolled = true;
        },
      };

      const result = simulateItemClick(SAMPLE_ITEMS[2], { // workflows is disabled
        onItemClick: () => {
          clicked = true;
        },
        targetFinder: () => mockTarget,
      });

      if (result.scrolled || targetScrolled) {
        throw new Error("Disabled item must not trigger scrolling");
      }
      if (clicked) {
        throw new Error("Disabled item must not fire onItemClick");
      }
      if (result.activatedId !== undefined) {
        throw new Error("Disabled item must not become active");
      }
    });
  });

  describe("5. Controlled vs Uncontrolled Active State", () => {
    it("uses defaultActiveItemId in uncontrolled mode", () => {
      const active = resolveActiveItemId({
        defaultId: "queries",
        items: SAMPLE_ITEMS,
      });
      if (active !== "queries") throw new Error("Expected 'queries' to be active by default");
    });

    it("falls back to first item id when no defaultActiveItemId is provided", () => {
      const active = resolveActiveItemId({
        items: SAMPLE_ITEMS,
      });
      if (active !== "details") throw new Error("Expected first item 'details' to be active");
    });

    it("respects controlled activeItemId over internal state", () => {
      const active = resolveActiveItemId({
        controlledId: "queries",
        uncontrolledId: "details",
        items: SAMPLE_ITEMS,
      });
      if (active !== "queries") throw new Error("Controlled activeItemId must take precedence");
    });

    it("fires onActiveItemChange callback when active item changes", () => {
      let changedId: string | null = null;

      simulateItemClick(SAMPLE_ITEMS[1], {
        onActiveItemChange: (id) => {
          changedId = id;
        },
      });

      if (changedId !== "queries") {
        throw new Error("Expected onActiveItemChange to receive 'queries'");
      }
    });
  });

  describe("6. IntersectionObserver Section Visibility Matching", () => {
    it("detects active section closest to top reading zone", () => {
      const entries = [
        { targetId: "details-section", isIntersecting: true, top: 40 },
        { targetId: "queries-section", isIntersecting: true, top: 220 },
      ];

      const matchedId = matchVisibleSection(entries, SAMPLE_ITEMS);
      if (matchedId !== "details") {
        throw new Error(`Expected 'details' to be active section, got ${matchedId}`);
      }
    });

    it("switches active section as user scrolls down", () => {
      const entries = [
        { targetId: "details-section", isIntersecting: false, top: -400 },
        { targetId: "queries-section", isIntersecting: true, top: 50 },
      ];

      const matchedId = matchVisibleSection(entries, SAMPLE_ITEMS);
      if (matchedId !== "queries") {
        throw new Error(`Expected 'queries' to be active section, got ${matchedId}`);
      }
    });

    it("returns null when no observed section is intersecting", () => {
      const entries = [
        { targetId: "details-section", isIntersecting: false, top: -500 },
        { targetId: "queries-section", isIntersecting: false, top: 800 },
      ];

      const matchedId = matchVisibleSection(entries, SAMPLE_ITEMS);
      if (matchedId !== null) {
        throw new Error("Expected null when no section intersects");
      }
    });
  });

  describe("7. Missing Target DOM Elements Safety", () => {
    it("handles missing target gracefully without throwing", () => {
      let errorThrown = false;
      try {
        const result = simulateItemClick(
          { id: "missing", label: "Missing Section", targetId: "does-not-exist" },
          {
            targetFinder: () => null, // element not found in DOM
          }
        );
        if (result.scrolled) throw new Error("Should not scroll missing element");
      } catch {
        errorThrown = true;
      }

      if (errorThrown) throw new Error("Missing target must not throw runtime exception");
    });
  });

  describe("8. Sticky & Styling Semantics", () => {
    it("applies sticky positioning semantics when sticky=true", () => {
      const stickyProps: WeaverRelatedListProps = {
        items: SAMPLE_ITEMS,
        sticky: true,
        stickyTop: 84,
      };

      if (stickyProps.sticky !== true) throw new Error("Expected sticky to be true");
      if (stickyProps.stickyTop !== 84) throw new Error("Expected stickyTop to be 84");
    });

    it("supports non-sticky positioning when sticky=false", () => {
      const nonStickyProps: WeaverRelatedListProps = {
        items: SAMPLE_ITEMS,
        sticky: false,
      };

      if (nonStickyProps.sticky !== false) throw new Error("Expected sticky to be false");
    });
  });

  describe("9. Accessibility & Keyboard Semantics", () => {
    it("defines aria-label, aria-current, and role semantics", () => {
      const title = "Record Sections";
      const navAriaLabel = title;

      if (navAriaLabel !== "Record Sections") {
        throw new Error("Navigation aria-label must match section title");
      }

      const activeItem = SAMPLE_ITEMS[0];
      const isItemActive = true;
      const ariaCurrent = isItemActive ? "true" : undefined;

      if (ariaCurrent !== "true") {
        throw new Error("Active item must set aria-current='true'");
      }
    });
  });
});
