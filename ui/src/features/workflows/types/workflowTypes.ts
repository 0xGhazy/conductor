/**
 * Workflow domain types and detail representations.
 */

export interface WorkflowTaskDefinition {
  name: string;
  taskReferenceName: string;
  type?: string;
  inputParameters?: Record<string, any>;
  [key: string]: any;
}

export interface WorkflowAuditInfo {
  createdAt?: string;
  createdBy?: {
    name?: string;
    email?: string;
    avatarUrl?: string;
  };
  updatedAt?: string;
  updatedBy?: {
    name?: string;
    email?: string;
    avatarUrl?: string;
  };
}

export interface WorkflowDetail {
  id?: string;
  name: string;
  workflowName?: string;
  description?: string;
  version: number;
  latest?: boolean;
  createdAt?: string;
  createdBy?: any;
  updatedAt?: string;
  updatedBy?: any;
  conductorDefinition?: string;
  tasks?: WorkflowTaskDefinition[];
  variables?: Record<string, any>;
  inputs?: Record<string, any>;
  inputParameters?: Record<string, any>;
  timeoutPolicy?: string;
  timeoutSeconds?: number;
  supportedLanguages?: string[];
  language?: string;
  metadata?: Record<string, any>;
}

export interface WorkflowFormState {
  id?: string;
  name: string;
  description: string;
  version: number;
  createdAt?: string;
  createdBy?: any;
  updatedAt?: string;
  updatedBy?: any;
  variablesText: string;
  inputsText: string;
  timeoutPolicy: string;
  timeoutSeconds: number;
  supportedLanguages: string[];
  defaultLanguage: string;
}

export interface WorkflowReferencedIds {
  queryIds: Set<string>;
  datasourceIds: Set<string>;
  connectionNames: Set<string>;
  scriptNames: Set<string>;
}
