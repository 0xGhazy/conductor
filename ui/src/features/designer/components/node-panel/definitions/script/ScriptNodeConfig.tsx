import React, { useMemo } from "react";
import type { WeaverNodeConfigProps } from "../../nodeDefinition.types";
import {
  WeaverSelectField,
  WeaverNumberField,
} from "@/components/common/fields";
import { WeaverCodeEditor } from "@/components/common/editors";
import type { WeaverEditorLanguage } from "@/components/common/editors";
import { NodeConfigSection } from "../../common/NodeConfigSection";
import { NodeIdentityFields } from "../../common/NodeIdentityFields";

const SCRIPT_LANGUAGES = [
  { value: "JAVASCRIPT", label: "JavaScript" },
  { value: "PYTHON", label: "Python" },
  { value: "JEXL", label: "JEXL" },
];

export const ScriptNodeConfig: React.FC<WeaverNodeConfigProps> = ({
  node,
  value,
  onChange,
  readOnly = false,
  disabled = false,
}) => {
  const cfg = value || {};

  const handleFieldChange = (field: string, val: any) => {
    onChange({ [field]: val });
  };

  const selectedLanguage = String(cfg.language || "JAVASCRIPT").toUpperCase();

  const editorLanguage: WeaverEditorLanguage = useMemo(() => {
    if (selectedLanguage === "PYTHON") return "python";
    if (selectedLanguage === "JAVASCRIPT" || selectedLanguage === "JEXL") return "javascript";
    return "javascript";
  }, [selectedLanguage]);

  const formatVariables = (val: any) => {
    if (typeof val === "string") return val;
    try {
      return JSON.stringify(val || {}, null, 2);
    } catch {
      return "{}";
    }
  };

  const handleVariablesChange = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      onChange({ variables: parsed });
    } catch {
      onChange({ variables: text });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <NodeConfigSection title="General" defaultExpanded={true}>
        <NodeIdentityFields
          node={node}
          value={cfg}
          onChange={onChange}
          defaultNodeName="Script"
          readOnly={readOnly}
          disabled={disabled}
        />

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <WeaverSelectField
              label="Language"
              value={cfg.language || "JAVASCRIPT"}
              options={SCRIPT_LANGUAGES}
              onChange={(v) => handleFieldChange("language", v)}
              readOnly={readOnly}
              disabled={disabled}
            />
          </div>
          <div style={{ flex: 1 }}>
            <WeaverNumberField
              label="Timeout (ms)"
              value={cfg.timeout !== undefined ? Number(cfg.timeout) : 30000}
              onChange={(v) => handleFieldChange("timeout", v ?? 30000)}
              min={100}
              step={1000}
              suffix="ms"
              readOnly={readOnly}
              disabled={disabled}
            />
          </div>
        </div>
      </NodeConfigSection>

      <NodeConfigSection title="Script Code" defaultExpanded={true}>
        <div style={{ height: 250 }}>
          <WeaverCodeEditor
            language={editorLanguage}
            value={cfg.expression || cfg.code || ""}
            onChange={(v) => handleFieldChange("expression", v)}
            readOnly={readOnly}
            height="100%"
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              wordWrap: "on",
            }}
          />
        </div>
      </NodeConfigSection>

      <NodeConfigSection title="Variables" defaultExpanded={false}>
        <div style={{ height: 250 }}>
          <WeaverCodeEditor
            language="json"
            value={formatVariables(cfg.variables || {})}
            onChange={handleVariablesChange}
            readOnly={readOnly}
            height="100%"
            options={{ minimap: { enabled: false }, fontSize: 12 }}
          />
        </div>
      </NodeConfigSection>
    </div>
  );
};
