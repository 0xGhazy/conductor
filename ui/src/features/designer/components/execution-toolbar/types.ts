import type {
  WorkflowExecutionStatus,
  WorkflowExecutionOptions,
} from "@/features/designer/store/useWorkflowExecutionStore";

export interface ExecutionControlsProps {
  status: WorkflowExecutionStatus;
  workflowId?: string | null;
  startTime?: number | null;
  endTime?: number | null;
  durationMs?: number | null;
  onRun: () => void;
  onPause: () => void;
  onResume: () => void;
  onTerminate: () => void;
  onRestart?: () => void;
  onRetry?: () => void;
  onReset: () => void;
  onOptionsToggle: (e: React.MouseEvent<HTMLElement>) => void;
  isOptionsOpen: boolean;
}

export interface ExecutionStatusBadgeProps {
  status: WorkflowExecutionStatus;
  durationMs?: number | null;
}

export interface ExecutionOptionsPanelProps {
  options: WorkflowExecutionOptions;
  onChangeOption: <K extends keyof WorkflowExecutionOptions>(
    key: K,
    value: WorkflowExecutionOptions[K]
  ) => void;
}

export interface WorkflowExecutionToolbarProps {
  className?: string;
  onRun?: () => void;
  onClose?: () => void;
}
