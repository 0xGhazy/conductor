import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import apiClient from "@/services/apiClient";
import SettingsAuditLogsPage from "@/pages/Settings/SettingsAuditLogsPage";

vi.mock("@/services/apiClient", () => ({ default: { get: vi.fn() } }));
const get = apiClient.get as unknown as ReturnType<typeof vi.fn>;

const FAILED_START = {
  id: "e-1",
  timestamp: Date.now() - 60_000,
  actorId: "u-1",
  actorName: "Conductor Admin",
  actorEmail: "admin@conductor.local",
  action: "startWorkflow",
  resourceType: "WORKFLOW",
  resourceId: "order-flow",
  status: "FAILED",
  durationMs: 42,
  errorMessage: "Workflow definition not found",
};

const QUERY_UPDATE = {
  id: "e-2",
  timestamp: Date.now() - 30_000,
  actorId: "u-1",
  actorName: "Conductor Admin",
  action: "updateQuery",
  resourceType: "QUERY",
  resourceId: "q-1",
  status: "SUCCESS",
  durationMs: 9,
};

const QUERY_UPDATE_DETAILS = {
  name: "workflow-status-summary",
  changes: {
    timeout: { from: 1000, to: 5000 },
    sql: { from: "SELECT 1", to: "SELECT\n  status,\n  COUNT(*) AS total\nFROM workflow_index" },
    "connection.password": { from: "******", to: "****** (changed)" },
    "connection.properties": { from: ["sslmode"], to: "sslmode (values changed)" },
  },
};

const ALL_FACETS = {
  enabled: true,
  readable: true,
  resourceTypes: ["QUERY", "TASK", "WORKFLOW"],
  statuses: ["FAILED", "SUCCESS"],
  actions: ["startWorkflow", "updateQuery"],
};

let facets = ALL_FACETS;
let listResponse: unknown;
let detailError: unknown;
let detailPatch: Record<string, unknown> = {};
/** When set, answers list requests (for ordering tests). */
let listHandler: ((params: Record<string, unknown>) => Promise<unknown>) | null = null;

const respond = (url: string, options?: { params?: Record<string, unknown> }) => {
  if (url.endsWith("/facets")) return Promise.resolve({ data: { data: facets } });
  if (url.endsWith("/e-1") || url.endsWith("/e-2")) {
    if (detailError) return Promise.reject(detailError);
    return Promise.resolve({
      data: {
        data: url.endsWith("/e-1")
          ? { ...FAILED_START, details: { arg0: "order-flow" } }
          : { ...QUERY_UPDATE, ...detailPatch, details: QUERY_UPDATE_DETAILS },
      },
    });
  }
  if (listHandler) return listHandler(options?.params ?? {});
  if (listResponse instanceof Error) return Promise.reject(listResponse);
  return Promise.resolve({ data: listResponse });
};

let location: { search: string } = { search: "" };
function LocationProbe() {
  location = useLocation();
  return null;
}

const renderPage = (url = "/settings/audit-logs") =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <SettingsAuditLogsPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  );

const listCalls = () => get.mock.calls.filter(([url]) => String(url).endsWith("/api/admin/audit"));
const lastListParams = () => {
  const calls = listCalls();
  return (calls[calls.length - 1]?.[1]?.params ?? {}) as Record<string, unknown>;
};
const urlParam = (key: string) => new URLSearchParams(location.search).get(key);

const openEvent = async (action: string) => {
  fireEvent.click(await screen.findByRole("button", { name: `Show details of ${action}` }));
  return screen.findByRole("dialog");
};

const panelTitle = (panel: HTMLElement) => within(panel).getByRole("heading", { level: 2 });

const chooseOption = async (fieldName: string, option: string) => {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: fieldName }));
  fireEvent.click(await screen.findByRole("option", { name: option }));
};

describe("SettingsAuditLogsPage", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockImplementation((url: string, options?: { params?: Record<string, unknown> }) => respond(url, options));
    facets = ALL_FACETS;
    listResponse = { data: [FAILED_START, QUERY_UPDATE], details: { totalElements: 2 } };
    detailError = null;
    detailPatch = {};
    listHandler = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists events with actor, action, resource and status, from the last 24 hours", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: "Show details of startWorkflow" })).toBeInTheDocument();
    expect(screen.getAllByText("Conductor Admin").length).toBeGreaterThan(0);
    expect(screen.getByText("order-flow")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("42 ms")).toBeInTheDocument();

    const params = lastListParams();
    expect(params).toMatchObject({ page: 0, size: 20 });
    expect(Date.parse(String(params.to)) - Date.parse(String(params.from))).toBe(86_400_000);
    expect(params.sort).toBeUndefined();
  });

  it("sends the search to the server after typing pauses, and starts again at page 1", async () => {
    renderPage("/settings/audit-logs?page=2");
    await screen.findByRole("button", { name: "Show details of startWorkflow" });
    expect(lastListParams()).toMatchObject({ page: 2 });
    const requestsBefore = listCalls().length;

    const input = screen.getByLabelText("Search action, resource, actor, event ID...");
    fireEvent.change(input, { target: { value: "ord" } });
    fireEvent.change(input, { target: { value: "order" } });
    await waitFor(() => expect(lastListParams()).toMatchObject({ search: "order", page: 0 }));
    // Only the value typing paused on is sent.
    expect(listCalls().slice(requestsBefore).some(([, o]) => o?.params?.search === "ord")).toBe(false);
    expect(urlParam("search")).toBe("order");
  });

  it("reads its filters from the URL", async () => {
    renderPage(
      "/settings/audit-logs?range=7d&status=FAILED&resourceType=WORKFLOW,QUERY&action=startWorkflow&sort=durationMs,asc"
    );
    await screen.findByRole("button", { name: "Show details of startWorkflow" });
    const params = lastListParams();
    expect(params).toMatchObject({
      // Lists go as one comma-separated value, which the server splits.
      status: "FAILED",
      resourceType: "WORKFLOW,QUERY",
      action: "startWorkflow",
      sort: "durationMs,asc",
    });
    expect(Date.parse(String(params.to)) - Date.parse(String(params.from))).toBe(7 * 86_400_000);
  });

  it("filters by several statuses at once and keeps them in the URL", async () => {
    renderPage();
    await screen.findByRole("button", { name: "Show details of startWorkflow" });
    await chooseOption("Status", "Failed");
    await waitFor(() => expect(lastListParams()).toMatchObject({ status: "FAILED", page: 0 }));
    fireEvent.click(await screen.findByRole("option", { name: "Success" }));
    await waitFor(() => expect(lastListParams()).toMatchObject({ status: "FAILED,SUCCESS" }));
    expect(urlParam("status")).toBe("FAILED,SUCCESS");
  });

  it("asks for both ends of a custom range before searching", async () => {
    renderPage();
    await screen.findByRole("button", { name: "Show details of startWorkflow" });
    const requestsBefore = listCalls().length;
    await chooseOption("Time", "Custom range");
    expect(await screen.findByText("Choose a start and an end.")).toBeInTheDocument();
    expect(listCalls().length).toBe(requestsBefore);
  });

  it("uses a valid custom range from the URL as is", async () => {
    renderPage("/settings/audit-logs?range=custom&from=2026-11-01T00:00:00.000Z&to=2026-11-02T00:00:00.000Z");
    await screen.findByRole("button", { name: "Show details of startWorkflow" });
    expect(lastListParams()).toMatchObject({ from: "2026-11-01T00:00:00.000Z", to: "2026-11-02T00:00:00.000Z" });
  });

  it("checks the more filters before applying them, then shows them as chips", async () => {
    renderPage();
    await screen.findByRole("button", { name: "Show details of startWorkflow" });
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    const panel = screen.getByRole("form", { name: "More filters" });
    const requestsBefore = listCalls().length;

    fireEvent.change(within(panel).getByLabelText("Event ID"), { target: { value: "e-1" } });
    fireEvent.change(within(panel).getByLabelText("Min duration (ms)"), { target: { value: "100" } });
    fireEvent.change(within(panel).getByLabelText("Max duration (ms)"), { target: { value: "10" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Apply" }));
    expect(await within(panel).findByText(/An event ID looks like/)).toBeInTheDocument();
    expect(within(panel).getByText("Must be at least the minimum.")).toBeInTheDocument();
    expect(listCalls().length).toBe(requestsBefore);

    fireEvent.change(within(panel).getByLabelText("Event ID"), { target: { value: "" } });
    fireEvent.change(within(panel).getByLabelText("Max duration (ms)"), { target: { value: "500" } });
    fireEvent.change(within(panel).getByLabelText("Client IP"), { target: { value: "10.20.4.17" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(lastListParams()).toMatchObject({ clientIp: "10.20.4.17", minDurationMs: "100", maxDurationMs: "500" })
    );
    const chips = screen.getByRole("list", { name: "Active filters" });
    expect(chips).toHaveTextContent("10.20.4.17");
    expect(chips).toHaveTextContent("100–500 ms");
    expect(screen.getByRole("button", { name: "Filters (3)" })).toBeInTheDocument();
  });

  it("resets every filter but keeps the page size", async () => {
    renderPage("/settings/audit-logs?status=FAILED&clientIp=10.20.4.17&search=order&size=50&range=7d");
    await screen.findByRole("button", { name: "Show details of startWorkflow" });
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));

    await waitFor(() => expect(lastListParams().status).toBeUndefined());
    expect(lastListParams()).toMatchObject({ size: 50, page: 0 });
    expect(lastListParams().clientIp).toBeUndefined();
    expect(lastListParams().search).toBeUndefined();
    expect(screen.getByLabelText("Search action, resource, actor, event ID...")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Reset filters" })).toBeNull();
  });

  it("sorts on the server by the clicked column", async () => {
    renderPage();
    await screen.findByRole("button", { name: "Show details of startWorkflow" });
    const header = () =>
      Array.from(document.querySelectorAll("th")).find((th) => th.textContent?.trim() === "Duration") as HTMLElement;
    fireEvent.click(header());
    await waitFor(() => expect(lastListParams()).toMatchObject({ sort: "durationMs,asc", page: 0 }));
    await waitFor(() => expect(header()).toHaveAttribute("aria-sort", "ascending"));
    await screen.findByRole("button", { name: "Show details of startWorkflow" });
    fireEvent.click(header());
    await waitFor(() => expect(lastListParams()).toMatchObject({ sort: "durationMs,desc" }));
  });

  it("refresh moves the time window up to now", async () => {
    renderPage();
    await screen.findByRole("button", { name: "Show details of startWorkflow" });
    const later = Date.parse(String(lastListParams().to)) + 5 * 60_000;
    vi.spyOn(Date, "now").mockReturnValue(later);

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(Date.parse(String(lastListParams().to))).toBe(later));
  });

  it("never lets a slow older response replace a newer one", async () => {
    const pending: Record<string, (value: unknown) => void> = {};
    listHandler = (params) =>
      new Promise((resolve) => {
        pending[String(params.search ?? "")] = resolve;
      });
    const page = (event: object) => ({ data: { data: [event], details: { totalElements: 1 } } });

    renderPage();
    await waitFor(() => expect(pending[""]).toBeDefined());
    await act(async () => pending[""](page(FAILED_START)));
    await screen.findByRole("button", { name: "Show details of startWorkflow" });

    const input = screen.getByLabelText("Search action, resource, actor, event ID...");
    fireEvent.change(input, { target: { value: "start" } });
    await waitFor(() => expect(pending.start).toBeDefined());
    fireEvent.change(input, { target: { value: "update" } });
    await waitFor(() => expect(pending.update).toBeDefined());

    await act(async () => pending.update(page(QUERY_UPDATE)));
    await screen.findByRole("button", { name: "Show details of updateQuery" });
    await act(async () => pending.start(page(FAILED_START)));

    expect(screen.getByRole("button", { name: "Show details of updateQuery" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show details of startWorkflow" })).toBeNull();
  });

  it("leads with what changed: a plain title, the changes, secrets hidden", async () => {
    renderPage();
    const panel = await openEvent("updateQuery");
    expect(panelTitle(panel)).toHaveTextContent("Updated query");
    expect(await within(panel).findByText("workflow-status-summary")).toBeInTheDocument();
    expect(within(panel).getByRole("heading", { name: "Changes" })).toBeInTheDocument();
    expect(within(panel).getByText("Timeout (ms)")).toBeInTheDocument();
    expect(within(panel).getByText("1000")).toBeInTheDocument();
    expect(within(panel).getByText("5000")).toBeInTheDocument();
    expect(within(panel).getByText(/COUNT\(\*\) AS total/)).toBeInTheDocument();
    expect(within(panel).getByText("Changed (hidden)")).toBeInTheDocument();
    expect(within(panel).getByText("sslmode")).toBeInTheDocument();
    expect(within(panel).getByText("Values changed (hidden)")).toBeInTheDocument();
    expect(within(panel).queryByText(/\*{6}/)).toBeNull();
    expect(within(panel).queryByText(/values changed\)/)).toBeNull();
  });

  it("shows a failed event's error, and older events' raw arguments as such", async () => {
    renderPage();
    const panel = await openEvent("startWorkflow");
    expect(await within(panel).findByText("Workflow definition not found")).toBeInTheDocument();
    expect(within(panel).getByText("Recorded arguments")).toBeInTheDocument();
    expect(within(panel).getByText("order-flow", { selector: "pre" })).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("steps to the next and previous event, by button and arrow keys", async () => {
    renderPage();
    const panel = await openEvent("startWorkflow");
    expect(within(panel).getByRole("button", { name: "Previous event" })).toBeDisabled();

    fireEvent.click(within(panel).getByRole("button", { name: "Next event" }));
    await waitFor(() => expect(panelTitle(panel)).toHaveTextContent("Updated query"));
    expect(within(panel).getByRole("button", { name: "Next event" })).toBeDisabled();

    fireEvent.keyDown(within(panel).getByRole("button", { name: "Close" }), { key: "ArrowUp" });
    await waitFor(() => expect(panelTitle(panel)).toHaveTextContent("Started workflow"));
  });

  it("filters the log to everything by this actor, with a removable chip", async () => {
    renderPage();
    const panel = await openEvent("updateQuery");
    fireEvent.click(await within(panel).findByRole("button", { name: "Show all by this actor" }));

    await waitFor(() => expect(lastListParams()).toMatchObject({ actorId: "u-1", page: 0 }));
    expect(urlParam("actorId")).toBe("u-1");
    // The panel closes; the page is back in the accessibility tree once it has.
    const chips = await screen.findByRole("list", { name: "Active filters" });
    expect(chips).toHaveTextContent("Conductor Admin");

    fireEvent.click(within(chips).getByRole("button", { name: /Remove actor filter/ }));
    await waitFor(() => expect(lastListParams().actorId).toBeUndefined());
  });

  it("filters the log to everything on this resource", async () => {
    renderPage();
    const panel = await openEvent("updateQuery");
    fireEvent.click(await within(panel).findByRole("button", { name: "Show all for this resource" }));
    await waitFor(() => expect(lastListParams()).toMatchObject({ resourceId: "q-1", resourceType: "QUERY" }));
    expect(await screen.findByRole("list", { name: "Active filters" })).toHaveTextContent("workflow-status-summary");
  });

  it("marks the open event in the table", async () => {
    renderPage();
    await openEvent("updateQuery");
    expect(screen.getByRole("button", { name: "Show details of updateQuery", hidden: true })).toHaveAttribute(
      "aria-current",
      "true"
    );
  });

  it("offers no actor pivot when the event has no actor id", async () => {
    detailPatch = { actorId: undefined };
    listResponse = { data: [{ ...QUERY_UPDATE, ...detailPatch }], details: { totalElements: 1 } };
    renderPage();
    const panel = await openEvent("updateQuery");
    expect(await within(panel).findByRole("button", { name: "Show all for this resource" })).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Show all by this actor" })).toBeNull();
  });

  it("says when an event no longer exists", async () => {
    detailError = Object.assign(new Error("Not found"), { response: { status: 404 } });
    renderPage();
    const panel = await openEvent("startWorkflow");
    expect(await within(panel).findByText("This event no longer exists.")).toBeInTheDocument();
  });

  it("offers a retry when an event fails to load", async () => {
    detailError = new Error("Server unavailable");
    renderPage();
    const panel = await openEvent("startWorkflow");
    expect(await within(panel).findByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("says so when audit logging is off", async () => {
    facets = { ...ALL_FACETS, enabled: false };
    renderPage();
    expect(await screen.findByText("Audit logging is off")).toBeInTheDocument();
  });

  it("says so when events only go to the server log", async () => {
    facets = { ...ALL_FACETS, readable: false };
    renderPage();
    expect(await screen.findByText("Events go to the server log only")).toBeInTheDocument();
  });

  it("shows an empty state for the time range, and another when filters match nothing", async () => {
    listResponse = { data: [], details: { totalElements: 0 } };
    const { unmount } = renderPage();
    expect(await screen.findByText("No audit events in the last 24 hours")).toBeInTheDocument();
    unmount();
    renderPage("/settings/audit-logs?status=FAILED");
    expect(await screen.findByText("No events match these filters")).toBeInTheDocument();
  });

  it("shows the server's error", async () => {
    listResponse = new Error("Forbidden");
    renderPage();
    expect(await screen.findByText(/Forbidden/)).toBeInTheDocument();
  });
});
