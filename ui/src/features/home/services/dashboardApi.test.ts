import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normalizeTaskQueues,
  normalizeWorkers,
  normalizeHealth,
  computeDashboardRange,
  fetchDashboardSummary,
  DASHBOARD_ENDPOINTS,
} from "./dashboardApi";
import apiClient from "@/services/apiClient";

vi.mock("@/services/apiClient", () => ({
  default: {
    get: vi.fn(),
  },
}));

describe("dashboardApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Endpoints configuration", () => {
    it("should point to the specified Conductor and health APIs", () => {
      expect(DASHBOARD_ENDPOINTS.queueAll).toContain("/api/tasks/queue/all");
      expect(DASHBOARD_ENDPOINTS.queuePollDataAll).toContain("/api/tasks/queue/polldata/all");
      expect(DASHBOARD_ENDPOINTS.conductorHealth).toContain("/health");
    });
  });

  describe("normalizeTaskQueues", () => {
    it("should correctly correlate queue sizes and registered workers from polldata", () => {
      const queueMap = {
        DatabaseWorker: 5,
        HttpWorker: 0,
        _deciderQueue: 10,
        search_elasticsearch: 2,
        unregisteredQueue: 0,
      };

      const pollData = [
        { queueName: "DatabaseWorker", workerId: "worker-1", lastPollTime: Date.now() },
        { queueName: "HttpWorker", workerId: "worker-2", lastPollTime: Date.now() },
        { queueName: "BrandNewWorkerQueue", workerId: "worker-3", lastPollTime: Date.now() },
      ];

      const result = normalizeTaskQueues(queueMap, pollData);

      // Total queues: 5 from queueMap + 1 extra from pollData = 6
      expect(result).toHaveLength(6);

      // Verify DatabaseWorker has registered worker and size 5
      const dbQueue = result.find((q) => q.name === "DatabaseWorker");
      expect(dbQueue).toBeDefined();
      expect(dbQueue?.size).toBe(5);
      expect(dbQueue?.registeredWorker).toBe(true);
      expect(dbQueue?.internalQueue).toBe(false);

      // Verify _deciderQueue is flagged as internal
      const decider = result.find((q) => q.name === "_deciderQueue");
      expect(decider?.internalQueue).toBe(true);
      expect(decider?.size).toBe(10);

      // Verify BrandNewWorkerQueue was added from pollData with size 0
      const brandNew = result.find((q) => q.name === "BrandNewWorkerQueue");
      expect(brandNew?.size).toBe(0);
      expect(brandNew?.registeredWorker).toBe(true);

      // Queues with backlog (size > 0) should be prioritized at the top
      expect(result[0].size).toBeGreaterThan(0);
    });
  });

  describe("normalizeWorkers", () => {
    it("should extract worker pools and identify active status based on recent poll time", () => {
      const now = Date.now();
      const pollData = [
        { queueName: "DatabaseWorker", workerId: "node-1", lastPollTime: now - 5000 },
        { queueName: "HttpWorker", workerId: "node-2", lastPollTime: now - 10000 },
        { queueName: "StaleWorker", workerId: "node-3", lastPollTime: now - 300000 }, // 5 mins ago (> 2 mins)
      ];

      const workers = normalizeWorkers(pollData);

      expect(workers).toHaveLength(3);

      const dbWorker = workers.find((w) => w.name === "DatabaseWorker");
      expect(dbWorker?.registered).toBe(true);
      expect(dbWorker?.workerId).toBe("node-1");

      const staleWorker = workers.find((w) => w.name === "StaleWorker");
      expect(staleWorker?.registered).toBe(false);
    });
  });

  describe("normalizeHealth", () => {
    it("should recognize conductor health format { healthy: true }", () => {
      const res = normalizeHealth({ healthResults: [], healthy: true }, 200);
      expect(res.healthy).toBe(true);
    });

    it("should recognize Spring Boot status format { status: 'UP' }", () => {
      const res = normalizeHealth({ status: "UP" }, 200);
      expect(res.healthy).toBe(true);
    });

    it("should return false on failure payload", () => {
      const res = normalizeHealth({ healthy: false }, 500);
      expect(res.healthy).toBe(false);
    });
  });

  describe("computeDashboardRange", () => {
    it("should calculate valid ISO bounds for 24h", () => {
      const { fromIso, toIso } = computeDashboardRange("24h");
      expect(fromIso).not.toBeNull();
      expect(toIso).not.toBeNull();
      expect(new Date(fromIso!).getTime()).toBeLessThan(new Date(toIso!).getTime());
    });

    it("should calculate valid ISO bounds for custom dates", () => {
      const { fromIso, toIso } = computeDashboardRange(
        "custom",
        "2026-10-01T00:00",
        "2026-10-02T00:00"
      );
      expect(fromIso).toBe(new Date("2026-10-01T00:00").toISOString());
      expect(toIso).toBe(new Date("2026-10-02T00:00").toISOString());
    });
  });

  describe("fetchDashboardSummary", () => {
    it("should aggregate live cluster data into a cohesive DashboardData object", async () => {
      const mockQueues = { DatabaseWorker: 2, HttpWorker: 0 };
      const mockPollData = [
        { queueName: "DatabaseWorker", workerId: "host-a", lastPollTime: Date.now() },
      ];
      const mockWorkflowSearch = {
        totalHits: 3,
        results: [
          { workflowType: "wf_alpha", status: "COMPLETED" },
          { workflowType: "wf_alpha", status: "COMPLETED" },
          { workflowType: "wf_beta", status: "FAILED" },
        ],
      };

      vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
        if (url.includes("/api/tasks/queue/all")) return { data: mockQueues } as any;
        if (url.includes("/api/tasks/queue/polldata/all")) return { data: mockPollData } as any;
        if (url.includes("/api/workflow/search")) return { data: mockWorkflowSearch } as any;
        return { data: {} } as any;
      });

      const summary = await fetchDashboardSummary();

      expect(summary.executions.total).toBe(3);
      expect(summary.executions.completed).toBe(2);
      expect(summary.executions.failed).toBe(1);
      expect(summary.executions.successRate).toBeCloseTo(66.7, 1);

      expect(summary.taskQueues).toHaveLength(2);
      expect(summary.workers).toHaveLength(1);
      expect(summary.workers[0].name).toBe("DatabaseWorker");
      expect(summary.workers[0].workerId).toBe("host-a");

      expect(summary.topWorkflows).toHaveLength(2);
      expect(summary.topWorkflows[0].workflowName).toBe("wf_alpha");
      expect(summary.topWorkflows[0].executionCount).toBe(2);
      expect(summary.topWorkflows[0].completedCount).toBe(2);
      expect(summary.topWorkflows[0].successRate).toBe(100);
    });
  });
});
