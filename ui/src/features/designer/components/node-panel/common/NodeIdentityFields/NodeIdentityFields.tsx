import type { WeaverNodeConfigProps } from "../../nodeDefinition.types";
import { WeaverNameField, WeaverTextField } from "@/components/common/fields";
import {
  TASK_REFERENCE_NAME_ERROR_MESSAGE,
  TASK_REFERENCE_NAME_PATTERN,
} from "@/utils/validation";
import { useTaskReferenceNameValidator } from "./useTaskReferenceNameValidator";

export interface NodeIdentityFieldsProps {
  node: WeaverNodeConfigProps["node"];
  /** The node's config. */
  value: WeaverNodeConfigProps["value"];
  onChange: WeaverNodeConfigProps["onChange"];
  readOnly?: boolean;
  disabled?: boolean;
  /** Shown when the node has no name yet. */
  defaultNodeName?: string;
  /**
   * Overrides how the current reference is read from `value`, for task types that
   * store something else in `name` (e.g. HTTP keeps its worker name there).
   */
  referenceName?: string;
}

const readReferenceName = (config: WeaverNodeConfigProps["value"]): string =>
  config.name || config.referenceName || config.taskReferenceName || config.reference || "";

/**
 * "Node Name" + "Task Reference Name" fields shared by every task configuration panel.
 * The node name is the display title (stored as `nodeName`, mirrored to `data.name` by the panel);
 * the reference is validated and kept unique across the workflow, and written to every
 * reference key task types read from.
 */
export function NodeIdentityFields({
  node,
  value,
  onChange,
  readOnly = false,
  disabled = false,
  defaultNodeName = "",
  referenceName,
}: NodeIdentityFieldsProps) {
  const validateReferenceName = useTaskReferenceNameValidator(node?.id);
  const nodeName = value.nodeName ?? (node?.data?.name as string | undefined) ?? defaultNodeName;
  const currentReference = referenceName ?? readReferenceName(value);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <WeaverTextField
        label="Node Name"
        value={nodeName}
        onChange={(v) => onChange({ nodeName: v })}
        required
        readOnly={readOnly}
        disabled={disabled}
      />

      <WeaverNameField
        label="Task Reference Name"
        value={currentReference}
        onChange={(v) =>
          onChange({
            name: v,
            referenceName: v,
            reference: v,
            taskReferenceName: v,
          })
        }
        namePattern={TASK_REFERENCE_NAME_PATTERN}
        invalidNameMessage={TASK_REFERENCE_NAME_ERROR_MESSAGE}
        validateName={validateReferenceName}
        debounceMs={400}
        showValidationStatus
        required
        readOnly={readOnly}
        disabled={disabled}
      />
    </div>
  );
}

export default NodeIdentityFields;
