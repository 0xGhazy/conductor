import React from "react";
import type { WeaverNodeConfigProps } from "../../nodeDefinition.types";
import {
  WeaverTextField,
  WeaverSelectField,
} from "@/components/common/fields";
import { WeaverCodeEditor } from "@/components/common/editors";
import { NodeConfigSection } from "../../common/NodeConfigSection";
import { NodeIdentityFields } from "../../common/NodeIdentityFields";

/**
 * Side-panel config for tasks whose detailed settings live in their own modal
 * (Validation, Rule Engine, ForEach): just the shared node name / reference fields.
 */
export const TaskIdentityNodeConfig: React.FC<WeaverNodeConfigProps> = ({
  node,
  value,
  onChange,
  readOnly,
  disabled,
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    <NodeConfigSection title="General">
      <NodeIdentityFields
        node={node}
        value={value || {}}
        onChange={onChange}
        readOnly={readOnly}
        disabled={disabled}
      />
    </NodeConfigSection>
  </div>
);

// Terminate
export const TerminateNodeConfig: React.FC<WeaverNodeConfigProps> = ({
  node,
  value,
  onChange,
  readOnly,
  disabled,
}) => {
  const cfg = value || {};
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <NodeConfigSection title="General">
        <NodeIdentityFields
          node={node}
          value={cfg}
          onChange={onChange}
          defaultNodeName="Terminate"
          readOnly={readOnly}
          disabled={disabled}
        />
        <WeaverTextField
          label="Termination Reason"
          value={cfg.reason || ""}
          onChange={(v) => onChange({ reason: v })}
          readOnly={readOnly}
          disabled={disabled}
        />
      </NodeConfigSection>
      <NodeConfigSection title="Termination Output" defaultExpanded={false}>
        <div style={{ height: 250 }}>
          <WeaverCodeEditor
            language="json"
            value={typeof cfg.output === "string" ? cfg.output : JSON.stringify(cfg.output || {}, null, 2)}
            onChange={(v) => {
              try {
                onChange({ output: JSON.parse(v) });
              } catch {
                onChange({ output: v });
              }
            }}
            readOnly={readOnly}
            height="100%"
          />
        </div>
      </NodeConfigSection>
    </div>
  );
};

// Respond
export const RespondNodeConfig: React.FC<WeaverNodeConfigProps> = ({
  node,
  value,
  onChange,
  readOnly,
  disabled,
}) => {
  const cfg = value || {};
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <NodeConfigSection title="General">
        <NodeIdentityFields
          node={node}
          value={cfg}
          onChange={onChange}
          defaultNodeName="Respond"
          readOnly={readOnly}
          disabled={disabled}
        />
        <WeaverTextField
          label="Message Code"
          value={cfg.messageCode || ""}
          onChange={(v) => onChange({ messageCode: v })}
          readOnly={readOnly}
          disabled={disabled}
        />
        <WeaverTextField
          label="Language Code"
          value={cfg.languageCode || "${workflow.input._language}"}
          onChange={(v) => onChange({ languageCode: v })}
          readOnly={readOnly}
          disabled={disabled}
        />
        <WeaverTextField
          label="Preview Text"
          value={cfg.previewText || ""}
          onChange={(v) => onChange({ previewText: v })}
          multiline
          rows={2}
          readOnly={readOnly}
          disabled={disabled}
        />
      </NodeConfigSection>
    </div>
  );
};

// Wait
export const WaitNodeConfig: React.FC<WeaverNodeConfigProps> = ({
  node,
  value,
  onChange,
  readOnly,
  disabled,
}) => {
  const cfg = value || {};
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <NodeConfigSection title="General">
        <NodeIdentityFields
          node={node}
          value={cfg}
          onChange={onChange}
          defaultNodeName="Wait"
          readOnly={readOnly}
          disabled={disabled}
        />
        <WeaverSelectField
          label="Mode"
          value={cfg.mode || "DURATION"}
          options={[
            { value: "DURATION", label: "Duration" },
            { value: "UNTIL", label: "Until Timestamp" },
          ]}
          onChange={(v) => onChange({ mode: v })}
          readOnly={readOnly}
          disabled={disabled}
        />
        <WeaverTextField
          label="Duration / Timestamp"
          value={cfg.duration || "1 minute"}
          onChange={(v) => onChange({ duration: v })}
          readOnly={readOnly}
          disabled={disabled}
          helperText="e.g. 5 minutes, 1 hour, or ISO timestamp"
        />
      </NodeConfigSection>
    </div>
  );
};

// Redis
export { RedisNodeConfig } from "../redis";
