export interface WorkflowTranslation {
  id: string;
  workflowName: string;
  workflowVersion: number;
  messageCode: string;
  translations: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowTranslationPayload {
  workflowName: string;
  workflowVersion: number;
  messageCode: string;
  translations: Record<string, string>;
}

export interface TranslationListParams {
  page: number;
  size: number;
  workflowName?: string;
  workflowVersion?: number;
  search?: string;
}

export interface TranslationPage {
  content: WorkflowTranslation[];
  page: number;
  size: number;
  numberOfElements: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export type WorkflowTranslationsMap = Record<string, Record<string, string>>;
