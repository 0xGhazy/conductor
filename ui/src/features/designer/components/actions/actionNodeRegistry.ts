import { type ComponentType, type ReactNode } from "react";
import {
  ACTION_NODE_DISPLAY_REGISTRY,
  getActionNodeDisplayMeta,
  resolveActionNodeType,
  type ActionNodeDisplayMeta,
} from "./actionNodeMetadata";

// DTOs & Forms
import { RuleEngineConfigForm } from "./rule-engine/RuleEngineConfigForm";
import {
  generateRuleEngineReferenceName,
  exportRuleEngineActionData,
} from "./rule-engine/model/ruleEngineDto";

import { TerminateConfigForm } from "./terminate/TerminateConfigForm";
import {
  buildTerminateDraftData,
  exportTerminateActionData,
} from "./terminate/model/terminateDto";

import { WaitConfigForm } from "./wait/WaitConfigForm";
import {
  buildWaitDraftData,
  exportWaitActionData,
  formatUntil,
  isValidDuration,
  isValidUntil,
  normalizeWaitMode,
} from "./wait/model/waitDto";

import { RespondConfigForm } from "./respond/RespondConfigForm";
import {
  buildRespondDraftData,
  exportRespondActionData,
} from "./respond/model/respondDto";

import { ValidationConfigForm } from "./validation/ValidationConfigForm";
import {
  generateValidationReferenceName,
  exportValidationActionData,
} from "./validation/model/validationDto";

import { ForEachConfigForm } from "./foreach/ForEachConfigForm";
import {
  buildForEachDraftData,
  exportForEachActionData,
} from "./foreach/model/forEachDto";

import { SwitchConfigForm } from "./switch/SwitchConfigForm";
import { buildSwitchDraftData, exportSwitchActionData } from "./switch/model/switchDto";

import { RedisConfigForm } from "./redis/RedisConfigForm";
import {
  generateRedisReferenceName,
  exportRedisActionData,
} from "./redis/model/redisDto";

import { DatabaseActionNode } from "./DatabaseActionNode";
import { ScriptActionNode } from "./script";

export type { ActionNodeCustomHandlesContext, ActionNodeDisplayMeta } from "./actionNodeMetadata";
export { ACTION_TYPE_ALIASES, getActionNodeDisplayMeta } from "./actionNodeMetadata";

/** Editing behaviour layered on top of the display metadata (designer canvas only). */
interface ActionNodeBehavior {
  modalWidth?: number;
  ConfigForm?: ComponentType<any>;
  CustomNodeComponent?: ComponentType<any>;
  customTabs?: Array<{ id: string; label: string; icon?: ReactNode }>;
  buildInitialDraft?: (data: any) => any;
  validateDraft?: (draft: any) => Record<string, string> | null | undefined;
  transformBeforeSave?: (draft: any) => any;
  serializeForJson?: (data: any, id: string, pos?: any) => unknown;
  extractJsonUpdate?: (parsed: any) => any;
  generateDefaultReferenceName?: () => string;
}

export interface ActionNodeMeta extends ActionNodeDisplayMeta, ActionNodeBehavior {}

const ACTION_NODE_BEHAVIORS: Record<string, ActionNodeBehavior> = {
  DATABASE_ACTION: {
    CustomNodeComponent: DatabaseActionNode,
  },
  SCRIPT_ACTION: {
    CustomNodeComponent: ScriptActionNode,
  },
  HTTP_ACTION: {},
  WORKFLOW: {},
  RULE_ENGINE_ACTION: {
    ConfigForm: RuleEngineConfigForm,
    generateDefaultReferenceName: generateRuleEngineReferenceName,
    serializeForJson: exportRuleEngineActionData,
    extractJsonUpdate: (parsed) => ({
      name: parsed.name,
      config: {
        name: parsed.taskReferenceName || parsed.referenceName,
        referenceName: parsed.taskReferenceName || parsed.referenceName,
        reference: parsed.taskReferenceName || parsed.referenceName,
        rules: parsed.inputParameters?.rules || parsed.rules || [],
      },
    }),
  },
  TERMINATE: {
    ConfigForm: TerminateConfigForm,
    modalWidth: 1000,
    buildInitialDraft: buildTerminateDraftData,
    serializeForJson: (d, nid, pos) =>
      JSON.stringify(exportTerminateActionData(d, nid, pos), null, 2),
  },
  WAIT_ACTION: {
    ConfigForm: WaitConfigForm,
    modalWidth: 900,
    buildInitialDraft: buildWaitDraftData,
    validateDraft: (sourceData) => {
      const errors: Record<string, string> = {};
      if (
        normalizeWaitMode(sourceData?.config?.mode) === "DURATION" &&
        !isValidDuration(sourceData?.config?.duration)
      ) {
        errors.duration = "Duration must use units like 1 day 2 hours 30 minutes 15 seconds.";
      }
      if (
        normalizeWaitMode(sourceData?.config?.mode) === "UNTIL" &&
        !isValidUntil(sourceData?.config)
      ) {
        errors.until = "Until must be a valid date/time and timezone.";
      }
      return errors;
    },
    transformBeforeSave: (sourceData) => ({
      ...sourceData,
      config: {
        ...(sourceData?.config ?? {}),
        until: formatUntil(sourceData?.config ?? {}),
      },
    }),
    serializeForJson: exportWaitActionData,
  },
  RESPOND: {
    ConfigForm: RespondConfigForm,
    modalWidth: 900,
    buildInitialDraft: buildRespondDraftData,
    validateDraft: (sourceData) => {
      const cfg = sourceData?.config ?? {};
      const messageCodeValue = String(cfg.messageCode ?? "").trim();
      if (!messageCodeValue) {
        return { messageCode: "Message Code is required." };
      }
      return null;
    },
    serializeForJson: (d, nid, pos) =>
      JSON.stringify(exportRespondActionData(d, nid, pos), null, 2),
  },
  VALIDATION_ACTION: {
    ConfigForm: ValidationConfigForm,
    generateDefaultReferenceName: generateValidationReferenceName,
    serializeForJson: exportValidationActionData,
  },
  FOREACH_ACTION: {
    ConfigForm: ForEachConfigForm,
    modalWidth: 900,
    buildInitialDraft: buildForEachDraftData,
    validateDraft: (sourceData) => {
      const collectionExpr = String(
        sourceData?.config?.collectionExpression ?? sourceData?.config?.collection ?? ""
      ).trim();
      const itemVar = String(sourceData?.config?.itemVariable ?? "").trim();
      const errors: Record<string, string> = {};
      if (!collectionExpr) {
        errors.collection = "Collection Expression is required.";
      }
      if (!itemVar) {
        errors.itemVariable = "Item Variable Name is required.";
      }
      return errors;
    },
    transformBeforeSave: (sourceData) => {
      const trimmedName = String(
        sourceData?.config?.name ?? sourceData?.config?.referenceName ?? ""
      ).trim();
      const collectionExpr = String(
        sourceData?.config?.collectionExpression ?? sourceData?.config?.collection ?? ""
      ).trim();
      const itemVar = String(sourceData?.config?.itemVariable ?? "").trim();
      return {
        ...sourceData,
        config: {
          ...(sourceData?.config ?? {}),
          name: trimmedName,
          referenceName: trimmedName,
          reference: trimmedName,
          taskReferenceName: trimmedName,
          collection: collectionExpr,
          collectionExpression: collectionExpr,
          itemVariable: itemVar,
        },
      };
    },
    serializeForJson: exportForEachActionData,
  },
  SWITCH_ACTION: {
    ConfigForm: SwitchConfigForm,
    modalWidth: 1200,
    buildInitialDraft: buildSwitchDraftData,
    serializeForJson: exportSwitchActionData,
  },
  REDIS_ACTION: {
    ConfigForm: RedisConfigForm,
    modalWidth: 950,
    generateDefaultReferenceName: generateRedisReferenceName,
    transformBeforeSave: (sourceData) => {
      const ref = String(
        sourceData.config?.name ?? sourceData.config?.referenceName ?? ""
      ).trim();
      return {
        ...sourceData,
        config: {
          ...(sourceData.config ?? { action: "GET" }),
          name: ref,
          referenceName: ref,
          reference: ref,
        },
      };
    },
    serializeForJson: (d, nid, pos) =>
      JSON.stringify(exportRedisActionData(d, nid, pos), null, 2),
  },
};

export const ACTION_NODE_REGISTRY: Record<string, ActionNodeMeta> = Object.fromEntries(
  Object.entries(ACTION_NODE_DISPLAY_REGISTRY).map(([type, display]) => [
    type,
    { ...display, ...(ACTION_NODE_BEHAVIORS[type] ?? {}) },
  ])
);

/**
 * Resolves the full ActionNodeMeta (display + editing behaviour) for any given type or fallback.
 */
export function getActionNodeMeta(type?: string, data?: any): ActionNodeMeta {
  const canonicalType = resolveActionNodeType(type, data);
  return ACTION_NODE_REGISTRY[canonicalType] ?? getActionNodeDisplayMeta(type, data);
}
