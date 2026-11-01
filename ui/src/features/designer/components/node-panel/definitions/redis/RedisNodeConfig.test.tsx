import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Node } from "@xyflow/react";
import { RedisNodeConfig, REDIS_ACTIONS } from "./RedisNodeConfig";
import { RedisNodeDefinition } from "./RedisNodeDefinition";
import { WeaverNodeConfigurationPanel } from "../../WeaverNodeConfigurationPanel/WeaverNodeConfigurationPanel";
import { fetchRedisDatasources } from "@/features/redis/services/redisDatasourcesApi";
import { useDesignerStore } from "@/features/designer/store/useDesignerStore";
import { useWorkflowExecutionStore } from "@/features/designer/store/useWorkflowExecutionStore";

// Mock redis datasources API
vi.mock("@/features/redis/services/redisDatasourcesApi", () => ({
  fetchRedisDatasources: vi.fn(),
}));

describe("RedisNodeConfig & RedisNodeDefinition", () => {
  const mockRedisNode: Node = {
    id: "redis-node-1",
    type: "REDIS_ACTION",
    position: { x: 100, y: 200 },
    data: {
      name: "Redis Cache",
      config: {
        nodeName: "Redis Cache",
        name: "redis_task_1",
        referenceName: "redis_task_1",
        action: "GET",
        key: "user:1001",
        datasourceId: "redis-ds-1",
      },
    },
  };

  const mockDatasources = [
    { id: "redis-ds-1", name: "Redis Primary", host: "127.0.0.1", port: 6379, active: true },
    { id: "redis-ds-2", name: "Redis Replica", host: "127.0.0.1", port: 6380, active: false },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useWorkflowExecutionStore.getState().resetExecution();
    useDesignerStore.setState({
      nodes: [mockRedisNode],
      edges: [],
      workflowName: "UserWorkflow",
      workflowVersion: 1,
      workflowVariables: { redisPrefix: "app_v1" },
    });

    (fetchRedisDatasources as any).mockResolvedValue({ data: mockDatasources });
  });

  it("renders NodeIdentityFields, Redis Instance select, and Action select", async () => {
    render(
      <RedisNodeConfig
        node={mockRedisNode}
        value={mockRedisNode.data.config}
        onChange={vi.fn()}
      />
    );

    // Node identity fields
    expect(screen.getByLabelText(/Node Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Task Reference Name/i)).toBeInTheDocument();

    // Redis Instance
    expect(screen.getByLabelText(/Redis Instance/i)).toBeInTheDocument();

    // Action select
    expect(screen.getByLabelText(/Action/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchRedisDatasources).toHaveBeenCalledTimes(1);
    });
  });

  it("displays Key input for GET action and calls onChange when changed", async () => {
    const onChange = vi.fn();
    render(
      <RedisNodeConfig
        node={mockRedisNode}
        value={{ action: "GET", key: "user:old" }}
        onChange={onChange}
      />
    );

    const keyInput = screen.getByLabelText(/Key \*/i);
    expect(keyInput).toBeInTheDocument();
    expect((keyInput as HTMLInputElement).value).toBe("user:old");

    fireEvent.change(keyInput, { target: { value: "user:new:2002" } });
    expect(onChange).toHaveBeenCalledWith({ key: "user:new:2002" });
  });

  it("displays Pattern * label for KEYS action", () => {
    render(
      <RedisNodeConfig
        node={mockRedisNode}
        value={{ action: "KEYS", key: "user:*" }}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/Pattern \*/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Key \*/i)).not.toBeInTheDocument();
  });

  it("displays Key, Value, and TTL for SET action", () => {
    render(
      <RedisNodeConfig
        node={mockRedisNode}
        value={{ action: "SET", key: "session:1", value: "active", ttlSeconds: 3600 }}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/Key \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Value$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/TTL \(Seconds\)/i)).toBeInTheDocument();
  });

  it("displays Key, Hash Field, and Value for HSET action", () => {
    render(
      <RedisNodeConfig
        node={mockRedisNode}
        value={{ action: "HSET", key: "user:profile", field: "email", value: "test@example.com" }}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/Key \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Hash Field \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Value$/i)).toBeInTheDocument();
  });

  it("displays Key and Increment / Decrement Delta for INCRBY action", () => {
    render(
      <RedisNodeConfig
        node={mockRedisNode}
        value={{ action: "INCRBY", key: "counter:hits", delta: 5 }}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/Key \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Increment \/ Decrement Delta/i)).toBeInTheDocument();
  });

  it("displays PING information notice and no input fields for PING action", () => {
    render(
      <RedisNodeConfig
        node={mockRedisNode}
        value={{ action: "PING" }}
        onChange={vi.fn()}
      />
    );

    expect(
      screen.getByText(/PING action tests Redis server connectivity and latency/i)
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/Key \*/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Value$/i)).not.toBeInTheDocument();
  });

  it("verifies RedisNodeDefinition includes Configuration, JSON, Result, and Logs tabs", () => {
    expect(RedisNodeDefinition.type).toBe("REDIS_ACTION");
    expect(RedisNodeDefinition.label).toBe("Redis");
    expect(RedisNodeDefinition.tabs.map((t) => t.id)).toEqual([
      "configuration",
      "json",
      "result",
      "logs",
    ]);
  });

  it("serializes Redis node for Conductor Simple Task JSON format", () => {
    const exported = RedisNodeDefinition.serializeForJson(mockRedisNode, {
      selectedNode: mockRedisNode,
      isWorkflow: false,
      readOnly: false,
    });

    expect(exported).toMatchObject({
      name: "RedisWorker",
      taskReferenceName: "redis_task_1",
      type: "SIMPLE",
      inputParameters: {
        action: "GET",
        key: "user:1001",
        datasourceId: "redis-ds-1",
      },
    });
  });

  it("integrates with WeaverNodeConfigurationPanel showing Logs tab and Redis configuration", async () => {
    useDesignerStore.setState({
      selectedId: "redis-node-1",
      nodes: [mockRedisNode],
    });

    render(<WeaverNodeConfigurationPanel selectedNode={mockRedisNode} />);

    // Verify tabs rendered in panel
    expect(screen.getByRole("tab", { name: /Configuration/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /JSON/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Result/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Logs/i })).toBeInTheDocument();

    // Verify configuration fields rendered
    expect(screen.getByLabelText(/Node Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Task Reference Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Redis Instance/i)).toBeInTheDocument();
  });
});
