import React from "react";
import { render, screen } from "@testing-library/react";
import dayjs from "dayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { WeaverDateTimeField } from "./WeaverDateTimeField";

const renderWithAdapter = (ui: React.ReactElement) => {
  return render(
    <LocalizationProvider dateAdapter={AdapterDayjs}>{ui}</LocalizationProvider>
  );
};

describe("WeaverDateTimeField", () => {
  describe("Rendering & Value", () => {
    it("renders label, helper text, and controlled datetime value", () => {
      const testDateTime = dayjs("2026-06-20T16:45:00");
      renderWithAdapter(
        <WeaverDateTimeField
          label="Scheduled Run"
          helperText="Select date and time"
          value={testDateTime}
          ampm={false}
          format="YYYY-MM-DD HH:mm"
        />
      );

      expect(screen.getByLabelText(/scheduled run/i)).toBeInTheDocument();
      expect(screen.getByText("Select date and time")).toBeInTheDocument();
      const input = screen.getByLabelText(/scheduled run/i);
      expect(input).toHaveValue("2026-06-20 16:45");
    });

    it("displays external errorMessage with precedence", () => {
      renderWithAdapter(
        <WeaverDateTimeField
          label="Scheduled Run"
          helperText="Normal hint"
          errorMessage="Execution time must be in future"
        />
      );

      expect(screen.getByText("Execution time must be in future")).toBeInTheDocument();
      expect(screen.queryByText("Normal hint")).not.toBeInTheDocument();
    });

    it("renders Today and Now action buttons in popup by default", () => {
      renderWithAdapter(
        <WeaverDateTimeField
          label="DateTime Picker"
          open
        />
      );

      expect(screen.getByRole("button", { name: /today/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /now/i })).toBeInTheDocument();
    });
  });

  describe("Dimensions and States", () => {
    it("applies default small size and fullWidth matching WeaverTextField", () => {
      const { container } = renderWithAdapter(
        <WeaverDateTimeField label="Sizing Test" />
      );

      const root = container.querySelector(".MuiFormControl-root");
      expect(root).toHaveClass("MuiFormControl-fullWidth");
      const inputBase = container.querySelector(".MuiInputBase-root");
      expect(inputBase).toHaveClass("MuiInputBase-sizeSmall");
    });

    it("supports readOnly and disabled modes cleanly", () => {
      const { rerender } = renderWithAdapter(
        <WeaverDateTimeField label="Read Only Test" readOnly />
      );
      expect(screen.getByLabelText(/read only test/i)).toHaveAttribute("readonly");

      rerender(<WeaverDateTimeField label="Disabled Test" disabled />);
      expect(screen.getByLabelText(/disabled test/i)).toBeDisabled();
    });
  });
});
