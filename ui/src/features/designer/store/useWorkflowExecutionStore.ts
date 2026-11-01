import { create } from "zustand";

export type WorkflowExecutionStatus =
  | "idle"
  | "starting"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "terminated";

export interface WorkflowExecutionOptions {
  correlationId?: string;
  executionMode: "Async" | "Sync";
  waitSeconds?: number;
  pauseAtTaskReferenceName?: string;
  refreshEvery?: string;
  showLogs: boolean;
}

export interface TaskExecutionStatusInfo {
  status: string;
  durationMs?: number;
  errorMessage?: string;
}

export interface WorkflowExecutionState {
  status: WorkflowExecutionStatus;
  hasStarted: boolean;
  workflowId: string | null;
  startTime: number | null;
  endTime: number | null;
  durationMs: number | null;
  taskStatusMap: Record<string, TaskExecutionStatusInfo>;
  options: WorkflowExecutionOptions;
  isExpanded: boolean;
  isOptionsPopoverOpen: boolean;
  errorMessage: string | null;

  // Actions
  startExecution: (workflowId?: string) => void;
  setExecutionStatus: (status: WorkflowExecutionStatus) => void;
  setWorkflowId: (id: string | null) => void;
  setTaskStatusMap: (map: Record<string, TaskExecutionStatusInfo>) => void;
  updateExecutionProgress: (progress: {
    status?: WorkflowExecutionStatus;
    workflowId?: string;
    tasks?: any[];
    endTime?: number;
    durationMs?: number;
    errorMessage?: string;
  }) => void;
  pauseExecution: () => void;
  resumeExecution: () => void;
  terminateExecution: () => void;
  toggleExpanded: () => void;
  setExpanded: (expanded: boolean) => void;
  setOptionsPopoverOpen: (open: boolean) => void;
  toggleOptionsPopover: () => void;
  setOptions: (options: Partial<WorkflowExecutionOptions>) => void;
  setOption: <K extends keyof WorkflowExecutionOptions>(
    key: K,
    value: WorkflowExecutionOptions[K]
  ) => void;
  resetExecution: () => void;
}

export const DEFAULT_EXECUTION_OPTIONS: WorkflowExecutionOptions = {
  correlationId: "",
  executionMode: "Async",
  waitSeconds: undefined,
  pauseAtTaskReferenceName: "",
  refreshEvery: "2s",
  showLogs: false,
};

export const useWorkflowExecutionStore = create<WorkflowExecutionState>((set) => ({
  status: "idle",
  hasStarted: false,
  workflowId: null,
  startTime: null,
  endTime: null,
  durationMs: null,
  taskStatusMap: {},
  options: DEFAULT_EXECUTION_OPTIONS,
  isExpanded: false,
  isOptionsPopoverOpen: false,
  errorMessage: null,

  startExecution: (workflowId?: string) =>
    set({
      hasStarted: true,
      status: "starting",
      workflowId: workflowId ?? null,
      startTime: Date.now(),
      endTime: null,
      durationMs: null,
      taskStatusMap: {},
      errorMessage: null,
    }),

  setExecutionStatus: (status) => set({ status }),

  setWorkflowId: (workflowId) => set({ workflowId }),

  setTaskStatusMap: (taskStatusMap) => set({ taskStatusMap }),

  updateExecutionProgress: ({ status, workflowId, tasks, endTime, durationMs, errorMessage }) =>
    set((state) => {
      const nextMap = { ...state.taskStatusMap };
      if (Array.isArray(tasks)) {
        tasks.forEach((t) => {
          const refName = t?.referenceTaskName || t?.taskReferenceName;
          if (refName) {
            const taskStart = Number(t?.startTime || 0);
            const taskEnd = Number(t?.endTime || 0);
            const calculatedDuration =
              taskStart > 0 && taskEnd >= taskStart ? taskEnd - taskStart : undefined;
            nextMap[refName] = {
              status: String(t?.status || "").toUpperCase(),
              durationMs: calculatedDuration,
              errorMessage: t?.reasonForIncompletion || undefined,
            };
          }
        });
      }

      const calculatedDuration =
        durationMs ??
        (state.startTime && endTime ? endTime - state.startTime : state.durationMs);

      return {
        status: status ?? state.status,
        workflowId: workflowId !== undefined ? workflowId : state.workflowId,
        endTime: endTime !== undefined ? endTime : state.endTime,
        durationMs: calculatedDuration,
        taskStatusMap: nextMap,
        errorMessage: errorMessage !== undefined ? errorMessage : state.errorMessage,
      };
    }),

  pauseExecution: () =>
    set({
      status: "paused",
    }),

  resumeExecution: () =>
    set({
      status: "running",
    }),

  terminateExecution: () =>
    set({
      status: "terminated",
      endTime: Date.now(),
    }),

  toggleExpanded: () =>
    set((state) => ({
      isExpanded: !state.isExpanded,
    })),

  setExpanded: (expanded: boolean) =>
    set({
      isExpanded: expanded,
    }),

  setOptionsPopoverOpen: (open: boolean) =>
    set({
      isOptionsPopoverOpen: open,
    }),

  toggleOptionsPopover: () =>
    set((state) => ({
      isOptionsPopoverOpen: !state.isOptionsPopoverOpen,
    })),

  setOptions: (newOptions) =>
    set((state) => ({
      options: { ...state.options, ...newOptions },
    })),

  setOption: (key, value) =>
    set((state) => ({
      options: { ...state.options, [key]: value },
    })),

  resetExecution: () =>
    set({
      status: "idle",
      hasStarted: false,
      workflowId: null,
      startTime: null,
      endTime: null,
      durationMs: null,
      taskStatusMap: {},
      isExpanded: false,
      isOptionsPopoverOpen: false,
      options: { ...DEFAULT_EXECUTION_OPTIONS },
      errorMessage: null,
    }),
}));
