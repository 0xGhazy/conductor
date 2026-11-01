import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WeaverNameField } from "./WeaverNameField";

describe("WeaverNameField", () => {
  it("allows standard text entry and fires onChange", () => {
    const handleChange = vi.fn();
    render(<WeaverNameField label="Workflow Name" onChange={handleChange} />);

    const input = screen.getByLabelText(/workflow name/i);
    fireEvent.change(input, { target: { value: "order_fulfillment" } });

    expect(handleChange).toHaveBeenCalledWith("order_fulfillment");
  });

  it("performs local regex validation and does not trigger async validation if regex fails", async () => {
    const mockAsyncValidator = vi.fn().mockResolvedValue({ valid: true });

    render(
      <WeaverNameField
        label="Task Name"
        value="Invalid Name!"
        namePattern={/^[a-zA-Z0-9_-]+$/}
        invalidNameMessage="Only alphanumeric, underscores, and dashes allowed"
        validateName={mockAsyncValidator}
        debounceMs={50}
      />
    );

    expect(
      screen.getByText("Only alphanumeric, underscores, and dashes allowed")
    ).toBeInTheDocument();

    // Wait debounce duration
    await new Promise((r) => setTimeout(r, 100));

    expect(mockAsyncValidator).not.toHaveBeenCalled();
  });

  it("runs async validation after debounce when regex passes", async () => {
    const mockAsyncValidator = vi.fn().mockResolvedValue({
      valid: false,
      message: "Workflow name already exists in tenant",
    });

    render(
      <WeaverNameField
        label="Workflow"
        value="my_flow"
        namePattern={/^[a-zA-Z0-9_-]+$/}
        validateName={mockAsyncValidator}
        debounceMs={50}
      />
    );

    await waitFor(() => {
      expect(mockAsyncValidator).toHaveBeenCalledWith("my_flow");
    });

    await waitFor(() => {
      expect(
        screen.getByText("Workflow name already exists in tenant")
      ).toBeInTheDocument();
    });
  });

  it("prioritizes external errorMessage over both regex and async errors", async () => {
    const mockAsyncValidator = vi.fn().mockResolvedValue({
      valid: false,
      message: "Async error message",
    });

    render(
      <WeaverNameField
        label="Service"
        value="my_service"
        errorMessage="Critical external API collision"
        validateName={mockAsyncValidator}
        debounceMs={50}
      />
    );

    expect(screen.getByText("Critical external API collision")).toBeInTheDocument();
  });

  it("prevents stale async validation responses from overwriting newer entries", async () => {
    let resolveFirst: (res: { valid: boolean; message: string }) => void;
    let resolveSecond: (res: { valid: boolean }) => void;

    const mockAsyncValidator = vi.fn((val: string) => {
      if (val === "first_query") {
        return new Promise<{ valid: boolean; message: string }>((res) => {
          resolveFirst = res;
        });
      }
      return new Promise<{ valid: boolean }>((res) => {
        resolveSecond = res;
      });
    });

    const { rerender } = render(
      <WeaverNameField
        label="Tenant"
        value="first_query"
        validateName={mockAsyncValidator}
        debounceMs={20}
      />
    );

    await waitFor(() => {
      expect(mockAsyncValidator).toHaveBeenCalledWith("first_query");
    });

    // Update to second query before first resolves
    rerender(
      <WeaverNameField
        label="Tenant"
        value="second_query"
        validateName={mockAsyncValidator}
        debounceMs={20}
      />
    );

    await waitFor(() => {
      expect(mockAsyncValidator).toHaveBeenCalledWith("second_query");
    });

    // Second completes first as VALID
    resolveSecond!({ valid: true });

    // First completes later as INVALID
    resolveFirst!({ valid: false, message: "Stale error from first" });

    // Stale error must not overwrite the valid state of second_query!
    await waitFor(() => {
      expect(
        screen.queryByText("Stale error from first")
      ).not.toBeInTheDocument();
    });
  });
});
