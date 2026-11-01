import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WeaverNotificationProvider } from "@/components/common/notifications";
import SecretViewContent from "./SecretViewContent";

const api = vi.hoisted(() => ({
  fetchSecrets: vi.fn(),
  fetchSecretById: vi.fn(),
  fetchSecretUsages: vi.fn(),
  createSecret: vi.fn(),
  updateSecret: vi.fn(),
  deleteSecret: vi.fn(),
}));
vi.mock("../services/secretsApi", () => ({ ...api, SECRETS_API: "/api/secrets" }));

const SECRET = {
  id: "s1",
  name: "stripe_key",
  displayedText: "sk**********9f",
  description: "Payments",
  placeholder: "${weaver.secrets.stripe_key}",
  usageCount: 0,
  version: 4,
};

const renderAt = (path: string, element: React.ReactNode) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <WeaverNotificationProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/secrets/new" element={element} />
            <Route path="/secrets/:id" element={element} />
          </Routes>
        </MemoryRouter>
      </WeaverNotificationProvider>
    </QueryClientProvider>
  );
};

describe("SecretViewContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchSecretById.mockResolvedValue({ data: SECRET });
    api.fetchSecretUsages.mockResolvedValue({ data: [] });
  });

  it("creates a secret with the trimmed name and entered value", async () => {
    api.createSecret.mockResolvedValue({ data: { ...SECRET, id: "new-id" } });
    renderAt("/secrets/new", <SecretViewContent isCreateMode />);

    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: " stripe_key " } });
    fireEvent.change(screen.getByLabelText(/^Value/), { target: { value: "sk_live_123" } });
    expect(screen.getByText("${weaver.secrets.stripe_key}")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(api.createSecret).toHaveBeenCalledWith({ name: "stripe_key", value: "sk_live_123", description: undefined })
    );
  });

  it("shows the duplicate-name error on the name field", async () => {
    api.createSecret.mockRejectedValue({
      response: { data: { code: "SECRET_ALREADY_EXISTS", reason: "exists" } },
    });
    renderAt("/secrets/new", <SecretViewContent isCreateMode />);

    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "stripe_key" } });
    fireEvent.change(screen.getByLabelText(/^Value/), { target: { value: "v" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("A secret with this name already exists")).toBeTruthy();
  });

  it("updates the description without sending a value unless it is replaced", async () => {
    api.updateSecret.mockResolvedValue({ data: { ...SECRET, description: "New", version: 5 } });
    renderAt("/secrets/s1", <SecretViewContent id="s1" isCreateMode={false} />);

    const description = await screen.findByLabelText("Description");
    expect(screen.getByText("sk**********9f")).toBeTruthy();
    fireEvent.change(description, { target: { value: "New" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(api.updateSecret).toHaveBeenCalledWith("s1", { description: "New", version: 4 }));
  });

  it("sends the new value when the user replaces it", async () => {
    api.updateSecret.mockResolvedValue({ data: { ...SECRET, version: 5 } });
    renderAt("/secrets/s1", <SecretViewContent id="s1" isCreateMode={false} />);

    fireEvent.click(await screen.findByRole("button", { name: "Replace value" }));
    fireEvent.change(screen.getByLabelText(/^New value/), { target: { value: "rotated" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(api.updateSecret).toHaveBeenCalledWith("s1", { value: "rotated", description: "Payments", version: 4 })
    );
  });

  it("disables delete while connections use the secret", async () => {
    api.fetchSecretUsages.mockResolvedValue({ data: [{ type: "DATASOURCE", id: "d1", name: "orders-db" }] });
    renderAt("/secrets/s1", <SecretViewContent id="s1" isCreateMode={false} />);

    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement).disabled).toBe(true)
    );
  });

  it("shows the blast-radius reconnect warning when rotating a secret bound to connections", async () => {
    api.fetchSecretUsages.mockResolvedValue({
      data: [
        { type: "DATASOURCE", id: "d1", name: "orders-db" },
        { type: "HTTP_CONNECTION", id: "c1", name: "stripe-gateway" },
      ],
    });
    renderAt("/secrets/s1", <SecretViewContent id="s1" isCreateMode={false} />);

    fireEvent.click(await screen.findByRole("button", { name: "Replace value" }));
    expect(
      screen.getByText("2 connection(s) use this secret and will reconnect with the new value after you save.")
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText(/^New value/)).toBeNull();
  });
});
