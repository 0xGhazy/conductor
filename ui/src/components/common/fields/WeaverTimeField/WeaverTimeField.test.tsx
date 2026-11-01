import React from "react";
import { render, screen } from "@testing-library/react";
import dayjs from "dayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { WeaverTimeField } from "./WeaverTimeField";

const renderWithAdapter = (ui: React.ReactElement) => {
  return render(
    <LocalizationProvider dateAdapter={AdapterDayjs}>{ui}</LocalizationProvider>
  );
};

describe("WeaverTimeField", () => {
  describe("Rendering & Value", () => {
    it("renders label and controlled value in 24h format", () => {
      const testTime = dayjs("2026-01-01T14:30:00");
      renderWithAdapter(
        <WeaverTimeField
          label="Execution Time"
          value={testTime}
          ampm={false}
          format="HH:mm"
        />
      );

      expect(screen.getByLabelText(/execution time/i)).toBeInTheDocument();
      const input = screen.getByLabelText(/execution time/i);
      expect(input).toHaveValue("14:30");
    });

    it("renders controlled value in 12h AM/PM mode", () => {
      const testTime = dayjs("2026-01-01T09:15:00");
      renderWithAdapter(
        <WeaverTimeField
          label="Start Time"
          value={testTime}
          ampm
        />
      );

      const input = screen.getByLabelText(/start time/i);
      expect(input).toHaveValue("09:15 AM");
    });

    it("renders Now action button in popup by default", () => {
      renderWithAdapter(
        <WeaverTimeField
          label="Time Picker"
          open
        />
      );

      expect(screen.getByRole("button", { name: /now/i })).toBeInTheDocument();
    });
  });

  describe("Dimensions and States", () => {
    it("applies default small size and fullWidth matching WeaverTextField", () => {
      const { container } = renderWithAdapter(
        <WeaverTimeField label="Sizing Test" />
      );

      const root = container.querySelector(".MuiFormControl-root");
      expect(root).toHaveClass("MuiFormControl-fullWidth");
      const inputBase = container.querySelector(".MuiInputBase-root");
      expect(inputBase).toHaveClass("MuiInputBase-sizeSmall");
    });

    it("supports readOnly and disabled modes cleanly", () => {
      const { rerender } = renderWithAdapter(
        <WeaverTimeField label="Read Only Test" readOnly />
      );
      expect(screen.getByLabelText(/read only test/i)).toHaveAttribute("readonly");

      rerender(<WeaverTimeField label="Disabled Test" disabled />);
      expect(screen.getByLabelText(/disabled test/i)).toBeDisabled();
    });
  });
});
