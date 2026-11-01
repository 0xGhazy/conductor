import React, { useMemo, useState } from "react";
import {
  Search,
  X,
  Copy,
  Check,
  Plus,
  Layers,
  Tag,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
} from "lucide-react";
import styles from "./CollectionEndpointsExplorer.module.css";

export interface EndpointItem {
  __rowId?: string;
  id?: string;
  endpointId?: string;
  name: string;
  method: string;
  url: string;
  description?: string;
  tags?: string[] | string;
  config?: any;
  raw?: any;
  [key: string]: any;
}

export interface CollectionEndpointsExplorerProps {
  collectionId: string;
  endpoints: EndpointItem[];
  loading?: boolean;
  onInspectEndpoint: (endpoint: EndpointItem) => void;
  onAddEndpoint?: () => void;
  onImportClick?: () => void;
}

const HTTP_METHODS = ["ALL", "GET", "POST", "PUT", "PATCH", "DELETE"];

export const extractEndpointPrimaryTag = (endpoint: EndpointItem): string => {
  // 1. Direct tags array
  if (Array.isArray(endpoint.tags) && endpoint.tags.length > 0) {
    const firstTag = String(endpoint.tags[0] ?? "").trim();
    if (firstTag) return firstTag;
  }
  // 2. Direct string tag
  if (typeof endpoint.tags === "string" && endpoint.tags.trim()) {
    const parts = endpoint.tags.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[0];
  }
  // 3. Config tags array
  if (Array.isArray(endpoint.config?.tags) && endpoint.config.tags.length > 0) {
    const firstTag = String(endpoint.config.tags[0] ?? "").trim();
    if (firstTag) return firstTag;
  }
  // 4. Config tags string
  if (typeof endpoint.config?.tags === "string" && endpoint.config.tags.trim()) {
    const parts = endpoint.config.tags.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[0];
  }
  // 5. Raw tags
  if (Array.isArray(endpoint.raw?.tags) && endpoint.raw.tags.length > 0) {
    const firstTag = String(endpoint.raw.tags[0] ?? "").trim();
    if (firstTag) return firstTag;
  }
  // 6. Intelligent fallback derived from URL segments
  const rawUrl = endpoint.url || endpoint.config?.url || "";
  if (typeof rawUrl === "string" && rawUrl.trim()) {
    try {
      const cleanPath = rawUrl.replace(/^[a-zA-Z]+:\/\/[^/]+/, "");
      const segments = cleanPath
        .split("/")
        .map((s) => s.trim().replace(/^\{.*\}$/, ""))
        .filter(
          (s) =>
            s &&
            !["api", "v1", "v2", "v3", "v4", "v5", "rest", "swagger", "openapi"].includes(
              s.toLowerCase()
            )
        );
      if (segments.length > 0 && segments[0]) {
        return segments[0];
      }
    } catch {
      // ignore parsing error
    }
  }

  return "default";
};

export const extractAllEndpointTags = (endpoint: EndpointItem): string[] => {
  const list: string[] = [];
  const add = (t: unknown) => {
    if (typeof t === "string") {
      t.split(",").forEach((item) => {
        const trimmed = item.trim();
        if (trimmed && !list.includes(trimmed)) list.push(trimmed);
      });
    } else if (Array.isArray(t)) {
      t.forEach((item) => add(item));
    }
  };

  add(endpoint.tags);
  if (list.length === 0) add(endpoint.config?.tags);
  if (list.length === 0) add(endpoint.raw?.tags);

  if (list.length === 0) {
    list.push(extractEndpointPrimaryTag(endpoint));
  }
  return list;
};

const getCardMethodClass = (m: string) => {
  switch (m) {
    case "GET":
      return styles.cardGet;
    case "POST":
      return styles.cardPost;
    case "PUT":
      return styles.cardPut;
    case "PATCH":
      return styles.cardPatch;
    case "DELETE":
      return styles.cardDelete;
    default:
      return styles.cardOther;
  }
};

const getChipActiveClass = (m: string) => {
  switch (m) {
    case "GET":
      return styles.chipActiveGet;
    case "POST":
      return styles.chipActivePost;
    case "PUT":
      return styles.chipActivePut;
    case "PATCH":
      return styles.chipActivePatch;
    case "DELETE":
      return styles.chipActiveDelete;
    default:
      return styles.chipActiveAll;
  }
};

const getChipMethodClass = (m: string) => {
  switch (m) {
    case "GET":
      return styles.chipGet;
    case "POST":
      return styles.chipPost;
    case "PUT":
      return styles.chipPut;
    case "PATCH":
      return styles.chipPatch;
    case "DELETE":
      return styles.chipDelete;
    default:
      return styles.chipAll;
  }
};

export const CollectionEndpointsExplorer: React.FC<CollectionEndpointsExplorerProps> = ({
  endpoints,
  loading = false,
  onInspectEndpoint,
  onAddEndpoint,
  onImportClick,
}) => {
  const [search, setSearch] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [collapsedTags, setCollapsedTags] = useState<Record<string, boolean>>({});

  // Calculate method breakdown counts
  const methodCounts = useMemo(() => {
    return endpoints.reduce((acc, ep) => {
      const m = String(ep.method || "GET").toUpperCase();
      acc[m] = (acc[m] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [endpoints]);

  // Filter endpoints by method and search query (matching name, url, description, and tags)
  const filteredEndpoints = useMemo(() => {
    let result = endpoints;

    if (selectedMethod !== "ALL") {
      result = result.filter(
        (ep) => String(ep.method || "").toUpperCase() === selectedMethod
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((ep) => {
        const epTags = extractAllEndpointTags(ep);
        return (
          ep.name?.toLowerCase().includes(q) ||
          ep.url?.toLowerCase().includes(q) ||
          ep.description?.toLowerCase().includes(q) ||
          epTags.some((t) => t.toLowerCase().includes(q))
        );
      });
    }

    return result;
  }, [endpoints, selectedMethod, search]);

  // Group and sort endpoints by tags
  const tagGroups = useMemo(() => {
    const map = new Map<string, EndpointItem[]>();

    filteredEndpoints.forEach((ep) => {
      const tag = extractEndpointPrimaryTag(ep);
      const group = map.get(tag) || [];
      group.push(ep);
      map.set(tag, group);
    });

    // Sort tag names alphabetically, with 'default' / 'other' placed at the end
    const sortedTags = Array.from(map.keys()).sort((a, b) => {
      const isDefaultA = a.toLowerCase() === "default" || a.toLowerCase() === "other";
      const isDefaultB = b.toLowerCase() === "default" || b.toLowerCase() === "other";
      if (isDefaultA && !isDefaultB) return 1;
      if (!isDefaultA && isDefaultB) return -1;
      return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
    });

    // Sort endpoints within each tag group by URL then method
    return sortedTags.map((tagName) => {
      const items = (map.get(tagName) || []).slice().sort((a, b) => {
        const urlA = a.url || "";
        const urlB = b.url || "";
        if (urlA !== urlB) return urlA.localeCompare(urlB);
        return (a.method || "").localeCompare(b.method || "");
      });

      const groupMethodCounts = items.reduce((acc, ep) => {
        const m = String(ep.method || "GET").toUpperCase();
        acc[m] = (acc[m] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        tag: tagName,
        endpoints: items,
        methodCounts: groupMethodCounts,
      };
    });
  }, [filteredEndpoints]);

  const toggleTagCollapse = (tagName: string) => {
    setCollapsedTags((prev) => ({
      ...prev,
      [tagName]: !prev[tagName],
    }));
  };

  const isAllCollapsed = useMemo(() => {
    if (tagGroups.length === 0) return false;
    return tagGroups.every((g) => collapsedTags[g.tag]);
  }, [tagGroups, collapsedTags]);

  const toggleAllCollapse = () => {
    if (isAllCollapsed) {
      // Expand all
      setCollapsedTags({});
    } else {
      // Collapse all
      const next: Record<string, boolean> = {};
      tagGroups.forEach((g) => {
        next[g.tag] = true;
      });
      setCollapsedTags(next);
    }
  };

  const handleCopyUrl = (e: React.MouseEvent, endpoint: EndpointItem) => {
    e.stopPropagation();
    const textToCopy = endpoint.url;
    if (!textToCopy) return;

    void navigator.clipboard.writeText(textToCopy);
    const id = endpoint.id || endpoint.__rowId || endpoint.url;
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 1800);
  };

  return (
    <div className={styles.explorerContainer}>
      {/* Header bar: Title + Count + Expand All + Search */}
      <div className={styles.explorerHeader}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>API Endpoints</h2>
          <span className={styles.countBadge}>
            {filteredEndpoints.length} of {endpoints.length}
          </span>
          {tagGroups.length > 1 && (
            <button
              type="button"
              className={styles.expandToggleBtn}
              onClick={toggleAllCollapse}
              title={isAllCollapsed ? "Expand all tag groups" : "Collapse all tag groups"}
              aria-label={isAllCollapsed ? "Expand all tag groups" : "Collapse all tag groups"}
            >
              <ChevronsUpDown size={14} />
              <span>{isAllCollapsed ? "Expand all" : "Collapse all"}</span>
            </button>
          )}
        </div>

        <div className={styles.headerActions}>
          <div className={styles.searchWrapper}>
            <Search size={15} className={styles.searchIcon} aria-hidden="true" />
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search by tag, path, name, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Filter endpoints"
            />
            {search && (
              <button
                type="button"
                className={styles.clearSearchBtn}
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {onAddEndpoint && (
            <button
              type="button"
              className={styles.addEndpointBtn}
              onClick={onAddEndpoint}
              title="Add a new endpoint to this collection"
            >
              <Plus size={14} />
              <span>Add Endpoint</span>
            </button>
          )}
        </div>
      </div>

      {/* Method filter chips */}
      <div className={styles.filterRow} role="tablist" aria-label="Filter by HTTP method">
        {HTTP_METHODS.map((method) => {
          const isActive = selectedMethod === method;
          const count =
            method === "ALL" ? endpoints.length : methodCounts[method] || 0;

          return (
            <button
              key={method}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`${styles.filterChip} ${getChipMethodClass(method)} ${
                isActive ? getChipActiveClass(method) : ""
              }`}
              onClick={() => setSelectedMethod(method)}
            >
              <span>{method}</span>
              <span className={styles.chipCount}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Endpoints List grouped by Tag */}
      <div className={styles.endpointsList}>
        {loading ? (
          <div className={styles.emptyExplorer}>
            <p className={styles.emptyText}>Loading endpoints...</p>
          </div>
        ) : tagGroups.length > 0 ? (
          <div className={styles.tagGroupsContainer}>
            {tagGroups.map((group) => {
              const isCollapsed = Boolean(collapsedTags[group.tag]);
              return (
                <section
                  key={group.tag}
                  className={styles.tagGroupSection}
                  aria-labelledby={`tag-heading-${group.tag}`}
                >
                  <button
                    type="button"
                    className={styles.tagGroupHeader}
                    onClick={() => toggleTagCollapse(group.tag)}
                    aria-expanded={!isCollapsed}
                  >
                    <div className={styles.tagHeaderLeft}>
                      <div className={styles.tagIconWrapper}>
                        <Tag size={14} />
                      </div>
                      <span id={`tag-heading-${group.tag}`} className={styles.tagName}>
                        {group.tag}
                      </span>
                      <span className={styles.tagCountPill}>
                        {group.endpoints.length} {group.endpoints.length === 1 ? "endpoint" : "endpoints"}
                      </span>
                    </div>

                    <div className={styles.tagHeaderRight}>
                      <div className={styles.tagMethodPills}>
                        {group.methodCounts.GET ? (
                          <span className={styles.miniMethodGet}>GET {group.methodCounts.GET}</span>
                        ) : null}
                        {group.methodCounts.POST ? (
                          <span className={styles.miniMethodPost}>POST {group.methodCounts.POST}</span>
                        ) : null}
                        {group.methodCounts.PUT ? (
                          <span className={styles.miniMethodPut}>PUT {group.methodCounts.PUT}</span>
                        ) : null}
                        {group.methodCounts.PATCH ? (
                          <span className={styles.miniMethodPatch}>PATCH {group.methodCounts.PATCH}</span>
                        ) : null}
                        {group.methodCounts.DELETE ? (
                          <span className={styles.miniMethodDelete}>DEL {group.methodCounts.DELETE}</span>
                        ) : null}
                      </div>
                      <span className={styles.tagChevron} aria-hidden="true">
                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </span>
                    </div>
                  </button>

                  {!isCollapsed && (
                    <div className={styles.tagEndpointsList}>
                      {group.endpoints.map((ep, idx) => {
                        const rowKey = ep.id || ep.__rowId || `${ep.name}-${idx}`;
                        const m = String(ep.method || "GET").toUpperCase();
                        const cardMethodClass = getCardMethodClass(m);
                        const isCopied = copiedId === (ep.id || ep.__rowId || ep.url);
                        const allTags = extractAllEndpointTags(ep);

                        return (
                          <div
                            key={rowKey}
                            className={`${styles.endpointCard} ${cardMethodClass}`}
                            onClick={() => onInspectEndpoint(ep)}
                            tabIndex={0}
                            role="button"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onInspectEndpoint(ep);
                              }
                            }}
                          >
                            <div className={styles.endpointMain}>
                              <span className={styles.methodBadge}>
                                {m}
                              </span>

                              <div className={styles.endpointDetails}>
                                <div className={styles.urlRow}>
                                  <span className={styles.urlText} title={ep.url}>
                                    {ep.url}
                                  </span>
                                  <button
                                    type="button"
                                    className={`${styles.copyBtn} ${isCopied ? styles.copiedText : ""}`}
                                    onClick={(e) => handleCopyUrl(e, ep)}
                                    title={isCopied ? "Copied!" : "Copy URL"}
                                    aria-label="Copy URL"
                                  >
                                    {isCopied ? <Check size={14} /> : <Copy size={14} />}
                                  </button>
                                </div>

                                <div className={styles.nameRow}>
                                  <span className={styles.endpointName}>
                                    {ep.name || "HTTP Operation"}
                                    {ep.description ? ` — ${ep.description}` : ""}
                                  </span>
                                  {allTags.slice(1).map((extraTag) => (
                                    <span key={extraTag} className={styles.cardTagPill}>
                                      {extraTag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        ) : endpoints.length === 0 ? (
          <div className={styles.emptyExplorer}>
            <Layers size={32} style={{ color: "var(--color-fg-muted, #7e899e)" }} />
            <p className={styles.emptyText}>
              No endpoints registered for this collection yet.
            </p>
            {onImportClick && (
              <button
                type="button"
                className={styles.clearFilterBtn}
                onClick={onImportClick}
              >
                Import Spec
              </button>
            )}
          </div>
        ) : (
          <div className={styles.emptyExplorer}>
            <p className={styles.emptyText}>
              No endpoints matching &quot;{search}&quot;
              {selectedMethod !== "ALL" ? ` with method ${selectedMethod}` : ""}.
            </p>
            <button
              type="button"
              className={styles.clearFilterBtn}
              onClick={() => {
                setSearch("");
                setSelectedMethod("ALL");
              }}
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionEndpointsExplorer;
