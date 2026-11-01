import { memo, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { Handle, Position } from "@xyflow/react";
import { Boxes, Maximize2, Minus, Plus, Sparkles } from "lucide-react";
import { getScopeColorPreset } from "@/features/designer/services/scopeGraph";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { SelectionTrace } from "@/features/designer/nodes/SelectionTrace";

function ScopeNodeBase({ id, data, onToggleScope, onFocusScope }) {
  const isSelected = useDesignerStore((state) => state.selectedNodeIds.includes(id));
  const surfaceRef = useRef(null);
  const scope = data?.scope || data?.config?.scope || {};
  const name = String(scope.name || data?.name || "Sub-Process");
  const childrenCount = Array.isArray(scope.childrenIds)
    ? scope.childrenIds.length
    : 0;
  const childrenLabel = childrenCount === 1 ? "Node" : "Nodes";
  const collapsed = scope.collapsed !== false;
  const colorPreset = getScopeColorPreset(scope.color);
  const scopeStyle = {
    pointerEvents: "all",
    "--scope-color": colorPreset.value,
    "--scope-cyan": colorPreset.cyan,
    "--scope-indigo": colorPreset.indigo,
    "--scope-rose": colorPreset.rose,
    "--scope-amber": colorPreset.amber,
    "--scope-green": colorPreset.green,
  };

  const handleToggle = useCallback(
    (event) => {
      event.stopPropagation();
      onToggleScope?.(id);
    },
    [id, onToggleScope]
  );

  const handleFocus = useCallback(
    (event) => {
      event.stopPropagation();
      onFocusScope?.(id);
    },
    [id, onFocusScope]
  );

  return (
    <div
      className={`scope-node ${collapsed ? "scope-node--collapsed" : "scope-node--expanded"} ${
        scope.focused ? "scope-node--focused" : ""
      }`.trim()}
      onDoubleClick={handleFocus}
      style={scopeStyle}
    >
      <Handle
        type="target"
        id="scope-in"
        position={Position.Left}
        className="scope-node-handle scope-node-handle--in"
      />
      <Handle
        type="source"
        id="scope-out"
        position={Position.Right}
        className="scope-node-handle scope-node-handle--out"
      />

      {collapsed ? (
        <div className="scope-node-frame">
          <div
            ref={surfaceRef}
            className={`scope-node-card designer-node-card ${isSelected ? "scope-node-surface--selected" : ""}`.trim()}
          >
            <span className="scope-node-glow" aria-hidden="true" />
            <div className="scope-node-icon">
              <Boxes size={16} />
            </div>
            <div className="scope-node-main">
              <div className="scope-node-kicker">
                <Sparkles size={10} aria-hidden="true" />
                <span>Scope</span>
              </div>
              <div className="scope-node-title">{name}</div>
              <div className="scope-node-tag">{childrenCount} {childrenLabel}</div>
            </div>
            <button
              type="button"
              className="scope-node-icon-button scope-node-icon-button--primary"
              onClick={handleToggle}
              aria-label="Expand scope"
              title="Expand inline"
            >
              <Plus size={16} />
            </button>
          </div>
          <SelectionTrace active={isSelected} targetRef={surfaceRef} />
        </div>
      ) : (
        <div className="scope-node-frame scope-node-frame--fill">
          <div
            ref={surfaceRef}
            className={`scope-node-container ${isSelected ? "scope-node-surface--selected" : ""}`.trim()}
          >
            <div className="scope-node-header">
              <div className="scope-node-header-title">
                <span className="scope-node-icon scope-node-icon--small">
                  <Boxes size={14} />
                </span>
                <span className="scope-node-title-stack">
                  <span className="scope-node-kicker">
                    <Sparkles size={10} aria-hidden="true" />
                    <span>Scope</span>
                  </span>
                  <span className="scope-node-title">{name}</span>
                </span>
                <span className="scope-node-tag">{childrenCount} {childrenLabel}</span>
              </div>
              <div className="scope-node-actions">
                <button
                  type="button"
                  className="scope-node-icon-button"
                  onClick={handleFocus}
                  aria-label="Focus scope"
                  title="Open focused view"
                >
                  <Maximize2 size={14} />
                </button>
                <button
                  type="button"
                  className="scope-node-icon-button"
                  onClick={handleToggle}
                  aria-label="Collapse scope"
                  title="Collapse scope"
                >
                  <Minus size={14} />
                </button>
              </div>
            </div>
          </div>
          <SelectionTrace active={isSelected} targetRef={surfaceRef} />
        </div>
      )}
    </div>
  );
}

ScopeNodeBase.propTypes = {
  id: PropTypes.string.isRequired,
  data: PropTypes.shape({
    name: PropTypes.string,
    config: PropTypes.shape({
      scope: PropTypes.shape({
        name: PropTypes.string,
        color: PropTypes.string,
        collapsed: PropTypes.bool,
        focused: PropTypes.bool,
        childrenIds: PropTypes.arrayOf(PropTypes.string),
      }),
    }),
    scope: PropTypes.shape({
      name: PropTypes.string,
      color: PropTypes.string,
      collapsed: PropTypes.bool,
      focused: PropTypes.bool,
      childrenIds: PropTypes.arrayOf(PropTypes.string),
    }),
  }),
  onToggleScope: PropTypes.func,
  onFocusScope: PropTypes.func,
};

ScopeNodeBase.defaultProps = {
  data: {},
  onToggleScope: null,
  onFocusScope: null,
};

export const ScopeNode = memo(
  ScopeNodeBase,
  (prev, next) => {
    const prevScope = prev.data?.scope || prev.data?.config?.scope || {};
    const nextScope = next.data?.scope || next.data?.config?.scope || {};
    return (
      prev.id === next.id &&
      prevScope.name === nextScope.name &&
      prevScope.color === nextScope.color &&
      prevScope.collapsed === nextScope.collapsed &&
      prevScope.focused === nextScope.focused &&
      (prevScope.childrenIds?.length ?? 0) ===
        (nextScope.childrenIds?.length ?? 0) &&
      prev.onToggleScope === next.onToggleScope &&
      prev.onFocusScope === next.onFocusScope
    );
  }
);
