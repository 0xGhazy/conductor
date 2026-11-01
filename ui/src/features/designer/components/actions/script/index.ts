import {
  buildScriptDtoPayload,
  type ScriptDtoPayload,
  type ScriptNodeData,
} from "@/features/designer/components/actions/script/model/scriptActionDto";

export { ScriptNode, exportJexlActionData, ScriptActionNode } from "@/features/designer/components/actions/script/ScriptNode";

export type {
  ScriptActionConfig,
  ScriptDtoPayload,
  ScriptLanguage,
  ScriptNodeData,
  ScriptingEngineLanguage,
  VariablesMap,
} from "@/features/designer/components/actions/script/model/scriptActionDto";

export const exportScriptActionData = (
  nodeData: ScriptNodeData,
  nodeId: string | null | undefined
): ScriptDtoPayload =>
  buildScriptDtoPayload(nodeId, nodeData);
