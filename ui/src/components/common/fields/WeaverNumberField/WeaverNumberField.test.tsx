import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { WeaverNumberField } from "./WeaverNumberField";

describe("WeaverNumberField", () => {
  describe("Basic Behavior & Base Props", () => {
    it("renders label, helper text, and required mark", () => {
      render(
        <WeaverNumberField
          label="Item Count"
          helperText="Enter positive count"
          required
        />
      );

      expect(screen.getByLabelText(/item count/i)).toBeInTheDocument();
      expect(screen.getByText("Enter positive count")).toBeInTheDocument();
      expect(screen.getByText(/\*/)).toBeInTheDocument();
    });

    it("renders controlled numeric value", () => {
      render(
        <WeaverNumberField
          label="Port"
          value={8080}
        />
      );

      const input = screen.getByLabelText(/port/i);
      expect(input).toHaveValue("8080");
    });

    it("renders uncontrolled defaultValue", () => {
      render(
        <WeaverNumberField
          label="Timeout"
          defaultValue={3000}
        />
      );

      const input = screen.getByLabelText(/timeout/i);
      expect(input).toHaveValue("3000");
    });
  });

  describe("Numeric Parsing & Editing", () => {
    it("emits parsed number on user input", () => {
      const handleChange = vi.fn();
      render(
        <WeaverNumberField
          label="Quantity"
          onChange={handleChange}
        />
      );

      const input = screen.getByLabelText(/quantity/i);
      fireEvent.change(input, { target: { value: "42" } });

      expect(handleChange).toHaveBeenCalledWith(42);
    });

    it("emits null when cleared or empty", () => {
      const handleChange = vi.fn();
      render(
        <WeaverNumberField
          label="Quantity"
          value={10}
          onChange={handleChange}
        />
      );

      const input = screen.getByLabelText(/quantity/i);
      fireEvent.change(input, { target: { value: "" } });

      expect(handleChange).toHaveBeenCalledWith(null);
    });

    it("allows intermediate decimal typing states without emitting NaN", () => {
      const handleChange = vi.fn();
      render(
        <WeaverNumberField
          label="Price"
          onChange={handleChange}
        />
      );

      const input = screen.getByLabelText(/price/i);
      fireEvent.change(input, { target: { value: "12." } });

      expect(input).toHaveValue("12.");
      expect(handleChange).toHaveBeenCalledWith(12);
      expect(handleChange).not.toHaveBeenCalledWith(NaN);
    });

    it("validates when allowDecimal is false", () => {
      render(
        <WeaverNumberField
          label="Integers Only"
          value={12.5}
          allowDecimal={false}
        />
      );

      expect(screen.getByText("Decimals are not allowed")).toBeInTheDocument();
    });

    it("validates when allowNegative is false", () => {
      render(
        <WeaverNumberField
          label="Positive Only"
          value={-5}
          allowNegative={false}
        />
      );

      expect(screen.getByText("Negative values are not allowed")).toBeInTheDocument();
    });
  });

  describe("Validation & Error Precedence", () => {
    it("validates min and max boundaries", () => {
      const { rerender } = render(
        <WeaverNumberField
          label="Score"
          value={150}
          min={0}
          max={100}
        />
      );

      expect(screen.getByText("Maximum value is 100")).toBeInTheDocument();

      rerender(
        <WeaverNumberField
          label="Score"
          value={-10}
          min={0}
          max={100}
        />
      );

      expect(screen.getByText("Minimum value is 0")).toBeInTheDocument();
    });

    it("prioritizes external errorMessage over numeric validation error", () => {
      render(
        <WeaverNumberField
          label="Score"
          value={150}
          max={100}
          errorMessage="Custom server error"
        />
      );

      expect(screen.getByText("Custom server error")).toBeInTheDocument();
      expect(screen.queryByText("Maximum value is 100")).not.toBeInTheDocument();
    });

    it("clamps value to min/max on blur when clampOnBlur is true", () => {
      const handleChange = vi.fn();
      render(
        <WeaverNumberField
          label="Percentage"
          min={0}
          max={100}
          clampOnBlur
          onChange={handleChange}
        />
      );

      const input = screen.getByLabelText(/percentage/i);
      fireEvent.change(input, { target: { value: "150" } });
      fireEvent.blur(input);

      expect(handleChange).toHaveBeenLastCalledWith(100);
      expect(input).toHaveValue("100");
    });
  });

  describe("Stepping & Controls", () => {
    it("increments and decrements on stepper button clicks", () => {
      const handleChange = vi.fn();
      render(
        <WeaverNumberField
          label="Counter"
          value={10}
          step={5}
          showControls
          onChange={handleChange}
        />
      );

      const incButton = screen.getByRole("button", { name: /increment value/i });
      const decButton = screen.getByRole("button", { name: /decrement value/i });

      fireEvent.click(incButton);
      expect(handleChange).toHaveBeenCalledWith(15);

      fireEvent.click(decButton);
      expect(handleChange).toHaveBeenCalledWith(5);
    });

    it("increments and decrements via keyboard ArrowUp and ArrowDown", () => {
      const handleChange = vi.fn();
      render(
        <WeaverNumberField
          label="Keys"
          value={20}
          step={1}
          onChange={handleChange}
        />
      );

      const input = screen.getByLabelText(/keys/i);
      fireEvent.keyDown(input, { key: "ArrowUp", code: "ArrowUp" });
      expect(handleChange).toHaveBeenCalledWith(21);

      fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });
      expect(handleChange).toHaveBeenCalledWith(19);
    });

    it("disables stepper controls when disabled or readOnly", () => {
      const { rerender } = render(
        <WeaverNumberField
          label="Locked"
          value={5}
          showControls
          disabled
        />
      );

      const inc = screen.getByRole("button", { name: /increment value/i });
      expect(inc).toBeDisabled();

      rerender(
        <WeaverNumberField
          label="Locked"
          value={5}
          showControls
          readOnly
        />
      );

      expect(inc).toBeDisabled();
    });
  });

  describe("Formatting & Adornments", () => {
    it("renders prefix and suffix adornments", () => {
      render(
        <WeaverNumberField
          label="Amount"
          value={100}
          prefix="$"
          suffix="USD"
        />
      );

      expect(screen.getByText("$")).toBeInTheDocument();
      expect(screen.getByText("USD")).toBeInTheDocument();
    });

    it("displays thousand separators while keeping numeric output", () => {
      render(
        <WeaverNumberField
          label="Revenue"
          value={1250000}
          thousandSeparator
        />
      );

      const input = screen.getByLabelText(/revenue/i);
      expect(input).toHaveValue("1,250,000");
    });
  });

  describe("Dimensions and Theme", () => {
    it("matches default WeaverTextField sizing", () => {
      const { container } = render(
        <WeaverNumberField label="Size Test" />
      );

      const root = container.querySelector(".MuiFormControl-root");
      expect(root).toHaveClass("MuiFormControl-fullWidth");
      const inputBase = container.querySelector(".MuiInputBase-root");
      expect(inputBase).toHaveClass("MuiInputBase-sizeSmall");
    });

    it("renders under light and dark theme data attributes", () => {
      const { rerender, container } = render(
        <div data-theme="light">
          <WeaverNumberField label="Theme Test" value={42} />
        </div>
      );
      expect(screen.getByLabelText(/theme test/i)).toHaveValue("42");

      rerender(
        <div data-theme="dark">
          <WeaverNumberField label="Theme Test" value={42} />
        </div>
      );
      expect(container.firstChild).toBeInTheDocument();
    });
  });
});
