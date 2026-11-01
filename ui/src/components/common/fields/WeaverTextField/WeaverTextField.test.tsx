import { render, screen, fireEvent } from "@testing-library/react";
import { WeaverTextField } from "./WeaverTextField";

describe("WeaverTextField", () => {
  it("renders with label and helper text", () => {
    render(
      <WeaverTextField
        label="Project Name"
        helperText="Enter a unique name"
      />
    );
    expect(screen.getByLabelText(/project name/i)).toBeInTheDocument();
    expect(screen.getByText("Enter a unique name")).toBeInTheDocument();
  });

  it("prioritizes external errorMessage over helperText and marks error state", () => {
    render(
      <WeaverTextField
        label="Username"
        helperText="Standard hint"
        errorMessage="Name is already taken"
      />
    );
    expect(screen.getByText("Name is already taken")).toBeInTheDocument();
    expect(screen.queryByText("Standard hint")).not.toBeInTheDocument();
  });

  it("handles controlled value and onChange", () => {
    const handleChange = vi.fn();
    render(
      <WeaverTextField
        label="Query"
        value="initial"
        onChange={handleChange}
      />
    );

    const input = screen.getByLabelText(/query/i);
    expect(input).toHaveValue("initial");

    fireEvent.change(input, { target: { value: "updated" } });
    expect(handleChange).toHaveBeenCalledWith("updated");
  });

  it("shows clear button when clearable is enabled and value is present", () => {
    const handleClear = vi.fn();
    const handleChange = vi.fn();

    render(
      <WeaverTextField
        label="Search"
        value="term"
        clearable
        onChange={handleChange}
        onClear={handleClear}
      />
    );

    const clearButton = screen.getByRole("button", { name: /clear input/i });
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);
    expect(handleChange).toHaveBeenCalledWith("");
    expect(handleClear).toHaveBeenCalledTimes(1);
  });

  it("does not show clear button when value is empty or field is disabled/readOnly", () => {
    const { rerender } = render(
      <WeaverTextField label="Search" value="" clearable />
    );
    expect(screen.queryByRole("button", { name: /clear input/i })).not.toBeInTheDocument();

    rerender(
      <WeaverTextField label="Search" value="text" clearable disabled />
    );
    expect(screen.queryByRole("button", { name: /clear input/i })).not.toBeInTheDocument();

    rerender(
      <WeaverTextField label="Search" value="text" clearable readOnly />
    );
    expect(screen.queryByRole("button", { name: /clear input/i })).not.toBeInTheDocument();
  });

  it("toggles password visibility when passwordToggle is true", () => {
    render(<WeaverTextField label="Secret" value="my-secret" passwordToggle />);

    const input = screen.getByLabelText(/secret/i);
    expect(input).toHaveAttribute("type", "password");

    const toggleButton = screen.getByRole("button", { name: /show password/i });
    fireEvent.click(toggleButton);

    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: /hide password/i })).toBeInTheDocument();
  });

  it("shows loading indicator when loading is true", () => {
    render(<WeaverTextField label="Loading field" loading />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("validates regex patterns and reports error when invalid", () => {
    const handleValidityChange = vi.fn();
    const pattern = /^[A-Z0-9]+$/;

    const { rerender } = render(
      <WeaverTextField
        label="Code"
        value="ABC12"
        pattern={pattern}
        patternErrorMessage="Must be uppercase alphanumeric"
        onPatternValidityChange={handleValidityChange}
      />
    );

    expect(screen.queryByText("Must be uppercase alphanumeric")).not.toBeInTheDocument();

    rerender(
      <WeaverTextField
        label="Code"
        value="abc 12"
        pattern={pattern}
        patternErrorMessage="Must be uppercase alphanumeric"
        onPatternValidityChange={handleValidityChange}
      />
    );

    expect(screen.getByText("Must be uppercase alphanumeric")).toBeInTheDocument();
  });

  it("applies maxLength to html input attribute", () => {
    render(<WeaverTextField label="Short Code" maxLength={8} />);
    const input = screen.getByLabelText(/short code/i);
    expect(input).toHaveAttribute("maxlength", "8");
  });

  it("supports readOnly mode distinctly", () => {
    render(<WeaverTextField label="System ID" value="SYS-101" readOnly />);
    const input = screen.getByLabelText(/system id/i);
    expect(input).toHaveAttribute("readonly");
  });

  it("supports custom width and height cleanly", () => {
    const { container } = render(
      <WeaverTextField label="Sized" width={320} height={44} />
    );
    const rootElement = container.querySelector(".MuiFormControl-root");
    expect(rootElement).toHaveStyle({ width: "320px" });
  });

  it("supports direction rtl and ltr", () => {
    render(<WeaverTextField label="Arabic Text" direction="rtl" />);
    const input = screen.getByLabelText(/arabic text/i);
    expect(input).toHaveAttribute("dir", "rtl");
  });
});
