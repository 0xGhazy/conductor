export interface WorkbenchWorkflow {
  key: string;
  id: string;
  name: string;
  version: number | string;
  input: Record<string, unknown>;
  description: string;
}

export interface WorkflowExecuteOptions {
  version?: number | string | null;
  correlationId?: string | null;
  requestId?: string | null;
  waitForSeconds?: number | null;
  consistency?: string | null;
  returnStrategy?: string | null;
}
