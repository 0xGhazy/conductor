import { z } from "zod/v4";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

export const JsonObjectSchema = z.record(z.string(), JsonValueSchema);
const StringMapSchema = z.record(z.string(), z.string());

const NodeIdSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => value.toLowerCase() !== "start",
    "The node id 'start' is reserved",
  );

const CommonNodeFields = {
  id: NodeIdSchema,
  name: z.string().trim().min(1).optional(),
};

const RuleOperatorSchema = z.enum([
  "==",
  "!=",
  ">",
  ">=",
  "<",
  "<=",
  "IN",
  "NOT_IN",
  "UNIQUE",
  "MATCH",
  "EMAIL",
  "NUMERIC",
  "ALPHANUMERIC",
  "NULL",
  "NOT_NULL",
  "EMPTY",
  "NOT_EMPTY",
  "IS_MAP",
  "IS_ARRAY",
  "POSITIVE",
  "NEGATIVE",
]);

const RuleConditionSchema = z
  .object({
    field: z.string().trim().min(1),
    operator: RuleOperatorSchema,
    value: JsonValueSchema.default(""),
    message: z.string().optional(),
    failureMessage: z.string().optional(),
  })
  .strict();

const RuleItemSchema = z.union([
  RuleConditionSchema,
  z.literal("AND"),
  z.literal("OR"),
]);

const HttpNodeSchema = z
  .object({
    ...CommonNodeFields,
    type: z.literal("HTTP_ACTION"),
    config: z
      .object({
        url: z.string().trim().min(1),
        method: z.enum([
          "GET",
          "POST",
          "PUT",
          "PATCH",
          "DELETE",
          "OPTIONS",
          "HEAD",
          "TRACE",
        ]),
        headers: StringMapSchema.default({}),
        query: StringMapSchema.default({}),
        body: JsonValueSchema.default({}),
        connection: z.string().default("--NONE--"),
        timeout: z.number().int().positive().default(30_000),
      })
      .strict(),
  })
  .strict();

const DatabaseNodeSchema = z
  .object({
    ...CommonNodeFields,
    type: z.literal("DATABASE_ACTION"),
    config: z
      .object({
        queryId: z.uuid(),
        datasourceId: z.uuid(),
        params: JsonObjectSchema.default({}),
      })
      .strict(),
  })
  .strict();

const JexlNodeSchema = z
  .object({
    ...CommonNodeFields,
    type: z.literal("JEXL_ACTION"),
    config: z
      .object({
        expression: z.string().min(1),
        variables: JsonObjectSchema.default({}),
        timeout: z.number().int().positive().default(30_000),
      })
      .strict(),
  })
  .strict();

const ScriptNodeSchema = z
  .object({
    ...CommonNodeFields,
    type: z.literal("SCRIPT_ACTION"),
    config: z
      .object({
        expression: z.string().min(1),
        variables: JsonObjectSchema.default({}),
        language: z.enum(["PYTHON", "JAVA_SCRIPT", "JEXL"]),
        timeout: z.number().int().positive().default(30_000),
      })
      .strict(),
  })
  .strict();

const RedisNodeSchema = z
  .object({
    ...CommonNodeFields,
    type: z.literal("REDIS_ACTION"),
    config: z
      .object({
        datasourceId: z.uuid(),
        action: z.enum([
          "SET",
          "GET",
          "DEL",
          "DELETE",
          "EXISTS",
          "EXPIRE",
          "KEYS",
          "INCR",
          "DECR",
          "INCRBY",
          "DECRBY",
          "HSET",
          "HGET",
          "HDEL",
          "HGETALL",
          "HINCRBY",
          "PING",
        ]),
        key: z.string().min(1),
        value: z.string().default(""),
        field: z.string().optional(),
        ttlSeconds: z.number().int().positive().optional(),
        delta: z.number().int().optional(),
        keys: z.array(z.string()).optional(),
        hashValues: StringMapSchema.default({}),
      })
      .strict(),
  })
  .strict();

const ValidationNodeSchema = z
  .object({
    ...CommonNodeFields,
    type: z.literal("VALIDATION_ACTION"),
    config: z
      .object({
        rules: z.array(RuleConditionSchema).min(1),
        variables: JsonObjectSchema.default({}),
      })
      .strict(),
  })
  .strict();

const RuleEngineNodeSchema = z
  .object({
    ...CommonNodeFields,
    type: z.literal("RULE_ENGINE_ACTION"),
    config: z
      .object({
        rules: z.array(RuleItemSchema).min(1),
        variables: JsonObjectSchema.default({}),
      })
      .strict(),
  })
  .strict();

const SwitchNodeSchema = z
  .object({
    ...CommonNodeFields,
    type: z.literal("SWITCH_ACTION"),
    config: z
      .object({
        evaluatorType: z.enum(["value-param", "javascript"]),
        expression: z.string().optional(),
        switchCaseValue: JsonValueSchema.optional(),
        inputParameters: JsonObjectSchema.default({}),
        cases: z
          .array(
            z
              .object({
                id: z.string().trim().min(1),
                value: z.string().trim().min(1),
              })
              .strict(),
          )
          .min(1),
      })
      .strict()
      .superRefine((config, context) => {
        if (
          config.evaluatorType === "javascript" &&
          !config.expression?.trim()
        ) {
          context.addIssue({
            code: "custom",
            path: ["expression"],
            message: "expression is required for javascript switches",
          });
        }
        if (
          config.evaluatorType === "value-param" &&
          config.switchCaseValue === undefined
        ) {
          context.addIssue({
            code: "custom",
            path: ["switchCaseValue"],
            message: "switchCaseValue is required for value-param switches",
          });
        }
      }),
  })
  .strict();

const WaitNodeSchema = z
  .object({
    ...CommonNodeFields,
    type: z.literal("WAIT_ACTION"),
    config: z
      .object({
        mode: z.enum(["DURATION", "UNTIL"]),
        duration: z.string().trim().min(1).optional(),
        until: z.string().trim().min(1).optional(),
      })
      .strict()
      .superRefine((config, context) => {
        if (config.mode === "DURATION" && !config.duration) {
          context.addIssue({
            code: "custom",
            path: ["duration"],
            message: "duration is required for DURATION waits",
          });
        }
        if (config.mode === "UNTIL" && !config.until) {
          context.addIssue({
            code: "custom",
            path: ["until"],
            message: "until is required for UNTIL waits",
          });
        }
      }),
  })
  .strict();

const RespondNodeSchema = z
  .object({
    ...CommonNodeFields,
    type: z.literal("RESPOND_ACTION"),
    config: z
      .object({
        messageCode: z.string().trim().min(1),
        languageCode: z.string().trim().min(1).default("default"),
        workflowName: z.string().trim().min(1).optional(),
        workflowVersion: z.number().int().positive().optional(),
        variables: JsonObjectSchema.default({}),
        workflowInput: JsonValueSchema.default("${workflow.input}"),
      })
      .strict(),
  })
  .strict();

const TerminateNodeSchema = z
  .object({
    ...CommonNodeFields,
    type: z.literal("TERMINATE"),
    config: z
      .object({
        status: z
          .enum(["COMPLETED", "FAILED", "TERMINATED"])
          .default("TERMINATED"),
        reason: z.string().default(""),
        output: JsonValueSchema.default({}),
      })
      .strict(),
  })
  .strict();

export const SimplifiedNodeSchema = z.discriminatedUnion("type", [
  HttpNodeSchema,
  DatabaseNodeSchema,
  JexlNodeSchema,
  ScriptNodeSchema,
  RedisNodeSchema,
  ValidationNodeSchema,
  RuleEngineNodeSchema,
  SwitchNodeSchema,
  WaitNodeSchema,
  RespondNodeSchema,
  TerminateNodeSchema,
]);

export const SimplifiedWorkflowSchema = z
  .object({
    workflowName: z.string().regex(/^[A-Za-z0-9_]+$/),
    description: z.string().optional(),
    inputs: JsonObjectSchema.default({}),
    variables: JsonObjectSchema.default({}),
    version: z.number().int().positive().default(1),
    timeoutPolicy: z.string().trim().min(1).default("ALERT_ONLY"),
    timeoutSeconds: z.number().int().nonnegative().default(0),
    restartable: z.boolean().default(false),
    nodes: z.array(SimplifiedNodeSchema).min(1),
    edges: z
      .array(
        z
          .object({
            source: NodeIdSchema,
            target: NodeIdSchema,
            branch: z.string().trim().min(1).optional(),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

const RawTaskSchema: z.ZodType<Record<string, unknown>> = z.lazy(() =>
  z
    .object({
      name: z.string().trim().min(1),
      taskReferenceName: z.string().trim().min(1),
      inputParameters: z.record(z.string(), z.unknown()),
      type: z.enum(["SIMPLE", "SWITCH", "WAIT", "TERMINATE"]),
      decisionCases: z.record(z.string(), z.array(RawTaskSchema)).optional(),
      defaultCase: z.array(RawTaskSchema).optional(),
    })
    .passthrough(),
);

const RawEdgeSchema = z
  .object({
    id: z.string().trim().min(1),
    source: z.string().trim().min(1),
    target: z.string().trim().min(1),
    sourceHandle: z.string().nullable().optional(),
    targetHandle: z.string().nullable().optional(),
  })
  .passthrough();

export const RawWorkflowDtoSchema = z
  .object({
    name: z.string().regex(/^[A-Za-z0-9_]+$/),
    version: z.number().int().positive(),
    tasks: z.array(RawTaskSchema).min(1),
    edges: z.array(RawEdgeSchema),
  })
  .passthrough();

export const CreateWorkflowInputSchema = z.discriminatedUnion("format", [
  z
    .object({
      format: z.literal("simplified"),
      payload: SimplifiedWorkflowSchema,
    })
    .strict(),
  z
    .object({ format: z.literal("raw"), payload: RawWorkflowDtoSchema })
    .strict(),
]);

export const ListWorkflowsInputSchema = z
  .object({
    mode: z.enum(["page", "all"]).default("page"),
    page: z.number().int().nonnegative().default(0),
    size: z.number().int().min(1).max(100).default(20),
    sort: z.array(z.string().trim().min(1)).default(["createdOn,desc"]),
  })
  .strict();

export const DescribeWorkflowInputSchema = z
  .object({ workflow_name: z.string().trim().min(1) })
  .strict();

export const ExecuteWorkflowInputSchema = z
  .object({
    workflow_name: z.string().trim().min(1),
    input: JsonObjectSchema.default({}),
  })
  .strict();

export type SimplifiedNode = z.infer<typeof SimplifiedNodeSchema>;
export type SimplifiedWorkflow = z.infer<typeof SimplifiedWorkflowSchema>;
export type CreateWorkflowInput = z.infer<typeof CreateWorkflowInputSchema>;
export type ListWorkflowsInput = z.infer<typeof ListWorkflowsInputSchema>;
