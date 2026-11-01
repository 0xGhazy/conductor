import { render, screen, fireEvent } from "@testing-library/react";
import { WeaverOptionTextField } from "./WeaverOptionTextField";
import type { WeaverOption } from "./WeaverOptionTextField.types";

const mockOptions: WeaverOption<string>[] = [
  { label: "Postgres Database", value: "pg", inputValue: "postgres://host:5432" },
  { label: "Redis Cache Store", value: "redis", inputValue: "redis://localhost:6379" },
  { label: "Disabled Source", value: "disabled", disabled: true },
];

describe("WeaverOptionTextField", () => {
  it("renders with label and allows free typing", () => {
    const handleChange = vi.fn();
    const handleInputChange = vi.fn();

    render(
      <WeaverOptionTextField
        label="Datasource URI"
        options={mockOptions}
        onChange={handleChange}
        onInputChange={handleInputChange}
      />
    );

    const input = screen.getByLabelText(/datasource uri/i);
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "custom-input" } });
    expect(handleChange).toHaveBeenCalledWith("custom-input");
    expect(handleInputChange).toHaveBeenCalledWith("custom-input", "typing");
  });

  it("handles Ctrl + Space to open dropdown suggestions", () => {
    render(
      <WeaverOptionTextField
        label="Expression"
        options={mockOptions}
        suggestions={{ onCtrlSpace: true }}
      />
    );

    const input = screen.getByLabelText(/expression/i);
    fireEvent.keyDown(input, { ctrlKey: true, code: "Space" });

    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("triggers onOptionSelect and writes inputValue into field on selection", () => {
    const handleChange = vi.fn();
    const handleOptionSelect = vi.fn();
    const handleInputChange = vi.fn();

    render(
      <WeaverOptionTextField
        label="Database"
        options={mockOptions}
        onChange={handleChange}
        onOptionSelect={handleOptionSelect}
        onInputChange={handleInputChange}
      />
    );

    const input = screen.getByLabelText(/database/i);
    fireEvent.keyDown(input, { ctrlKey: true, code: "Space" });

    const optionItem = screen.getByText("Postgres Database");
    fireEvent.click(optionItem);

    expect(handleOptionSelect).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Postgres Database", value: "pg" })
    );
    expect(handleChange).toHaveBeenCalledWith("postgres://host:5432");
    expect(handleInputChange).toHaveBeenCalledWith("postgres://host:5432", "selection");
  });

  it("renders refresh button and triggers onRefresh", () => {
    const handleRefresh = vi.fn();
    render(
      <WeaverOptionTextField
        label="Endpoint"
        options={mockOptions}
        refreshable
        onRefresh={handleRefresh}
      />
    );

    const refreshBtn = screen.getByRole("button", { name: /refresh options/i });
    expect(refreshBtn).toBeInTheDocument();

    fireEvent.click(refreshBtn);
    expect(handleRefresh).toHaveBeenCalledTimes(1);
  });

  it("disables refresh button when refreshing is active", () => {
    render(
      <WeaverOptionTextField
        label="Endpoint"
        options={mockOptions}
        refreshable
        refreshing
      />
    );

    const refreshBtn = screen.getByRole("button", { name: /refresh options/i });
    expect(refreshBtn).toBeDisabled();
  });

  it("displays clear action and handles clearing properly", () => {
    const handleChange = vi.fn();
    const handleInputChange = vi.fn();

    render(
      <WeaverOptionTextField
        label="Query"
        value="SELECT 1"
        clearable
        options={mockOptions}
        onChange={handleChange}
        onInputChange={handleInputChange}
      />
    );

    const clearBtn = screen.getByRole("button", { name: /clear input/i });
    fireEvent.click(clearBtn);

    expect(handleChange).toHaveBeenCalledWith("");
    expect(handleInputChange).toHaveBeenCalledWith("", "clear");
  });
});
