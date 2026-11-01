import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ExecutionLogsConsole } from "./ExecutionLogsConsole";
import type { ParsedTaskLogLine } from "@/features/monitoring/types/executionTypes";

describe("ExecutionLogsConsole", () => {
  const sampleLogs: ParsedTaskLogLine[] = [
    {
      taskId: "t1",
      taskReferenceName: "fetch_customer",
      taskName: "HTTP",
      level: "INFO",
      message: "Starting customer data fetch",
      timestamp: 1600000000000,
    },
    {
      taskId: "t1",
      taskReferenceName: "fetch_customer",
      taskName: "HTTP",
      level: "WARN",
      message: "Rate limit near threshold (85%)",
      timestamp: 1600000001000,
    },
    {
      taskId: "t2",
      taskReferenceName: "process_payment",
      taskName: "Kafka",
      level: "ERROR",
      message: "Payment gateway connection timeout",
      timestamp: 1600000002000,
    },
  ];

  it("renders log lines in standard Weaver format with logger and taskRef", () => {
    render(<ExecutionLogsConsole logs={sampleLogs} />);

    expect(screen.getByText("Starting customer data fetch")).toBeInTheDocument();
    expect(screen.getByText("Rate limit near threshold (85%)")).toBeInTheDocument();

    // Check logger tags: weaver.action.<TaskName>
    expect(screen.getAllByText("weaver.action.HTTP").length).toBe(2);
    expect(screen.getByText("weaver.action.Kafka")).toBeInTheDocument();

    // Check task reference pills: (taskReferenceName)
    expect(screen.getAllByText("(fetch_customer)").length).toBe(2);
    expect(screen.getByText("(process_payment)")).toBeInTheDocument();

    // Check padded level badges
    expect(screen.getAllByText("[INFO ]").length).toBe(1);
    expect(screen.getAllByText("[WARN ]").length).toBe(1);
    expect(screen.getAllByText("[ERROR]").length).toBe(1);
  });

  it("filters logs when clicking level pills", () => {
    render(<ExecutionLogsConsole logs={sampleLogs} />);

    // Click ERROR pill
    const errorPill = screen.getByRole("button", { name: /^ERROR/i });
    fireEvent.click(errorPill);

    expect(screen.getByText("Payment gateway connection timeout")).toBeInTheDocument();
    expect(screen.queryByText("Starting customer data fetch")).not.toBeInTheDocument();
    expect(screen.queryByText("Rate limit near threshold (85%)")).not.toBeInTheDocument();

    // Click ALL pill
    const allPill = screen.getByRole("button", { name: /^ALL/i });
    fireEvent.click(allPill);
    expect(screen.getByText("Starting customer data fetch")).toBeInTheDocument();
  });

  it("filters logs by search query and highlights match", () => {
    render(<ExecutionLogsConsole logs={sampleLogs} />);

    const searchInput = screen.getByPlaceholderText(/search log messages/i);
    fireEvent.change(searchInput, { target: { value: "gateway" } });

    // The highlighted match is rendered within a <mark> tag
    expect(screen.getByText("gateway")).toBeInTheDocument();
    expect(screen.queryByText("Starting customer data fetch")).not.toBeInTheDocument();
  });

  it("renders empty state when no logs exist", () => {
    render(<ExecutionLogsConsole logs={[]} />);
    expect(screen.getByText("No Execution Logs Recorded")).toBeInTheDocument();
  });

  it("renders error state when errorMessage prop is provided", () => {
    render(<ExecutionLogsConsole logs={[]} errorMessage="Agent service unavailable" />);
    expect(screen.getByText("Failed to Load Logs")).toBeInTheDocument();
    expect(screen.getByText("Agent service unavailable")).toBeInTheDocument();
  });

  it("supports copying logs in exact standard format to clipboard", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(<ExecutionLogsConsole logs={sampleLogs} />);
    const copyBtn = screen.getByTitle("Copy visible log lines to clipboard");

    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeTextMock).toHaveBeenCalled();
    const copiedText = writeTextMock.mock.calls[0][0];
    expect(copiedText).toContain("[INFO ] weaver.action.HTTP (fetch_customer) - Starting customer data fetch");
    expect(copiedText).toContain("[WARN ] weaver.action.HTTP (fetch_customer) - Rate limit near threshold (85%)");
    expect(copiedText).toContain("[ERROR] weaver.action.Kafka (process_payment) - Payment gateway connection timeout");
  });
});
