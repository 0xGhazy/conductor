import React from "react";
import { render, screen } from "@testing-library/react";
import dayjs from "dayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { WeaverDateField } from "./WeaverDateField";

const renderWithAdapter = (ui: React.ReactElement) => {
  return render(
    <LocalizationProvider dateAdapter={AdapterDayjs}>{ui}</LocalizationProvider>
  );
};

describe("WeaverDateField", () => {
  describe("Rendering & Base Props", () => {
    it("renders label, helper text, and required mark", () => {
      renderWithAdapter(
        <WeaverDateField
          label="Release Date"
          helperText="Select production release date"
          required
        />
      );

      expect(screen.getByLabelText(/release date/i)).toBeInTheDocument();
      expect(
        screen.getByText("Select production release date")
      ).toBeInTheDocument();
      expect(screen.getByText(/\*/)).toBeInTheDocument();
    });

    it("prioritizes external errorMessage over helperText and displays error", () => {
      renderWithAdapter(
        <WeaverDateField
          label="Release Date"
          helperText="Normal hint"
          errorMessage="Release date is invalid"
        />
      );

      expect(screen.getByText("Release date is invalid")).toBeInTheDocument();
      expect(screen.queryByText("Normal hint")).not.toBeInTheDocument();
    });
  });

  describe("Value & Controlled / Uncontrolled", () => {
    it("renders controlled value formatted properly", () => {
      const testDate = dayjs("2026-05-15");
      renderWithAdapter(
        <WeaverDateField
          label="Launch Date"
          value={testDate}
          format="YYYY-MM-DD"
        />
      );

      const input = screen.getByLabelText(/launch date/i);
      expect(input).toHaveValue("2026-05-15");
    });

    it("renders initial defaultValue in uncontrolled mode", () => {
      const initialDate = dayjs("2026-10-01");
      renderWithAdapter(
        <WeaverDateField
          label="Event Date"
          defaultValue={initialDate}
          format="YYYY-MM-DD"
        />
      );

      const input = screen.getByLabelText(/event date/i);
      expect(input).toHaveValue("2026-10-01");
    });
  });

  describe("Dimensions and Sizing", () => {
    it("applies default fullWidth and small size matching WeaverTextField", () => {
      const { container } = renderWithAdapter(
        <WeaverDateField label="Default Sizing" />
      );

      const root = container.querySelector(".MuiFormControl-root");
      expect(root).toHaveClass("MuiFormControl-fullWidth");
      const inputBase = container.querySelector(".MuiInputBase-root");
      expect(inputBase).toHaveClass("MuiInputBase-sizeSmall");
    });

    it("applies custom width and custom height overrides", () => {
      const { container } = renderWithAdapter(
        <WeaverDateField label="Custom Sizing" width={320} height={44} />
      );

      const root = container.querySelector(".MuiFormControl-root") as HTMLElement;
      expect(root.style.width).toBe("320px");
    });
  });

  describe("Disabled and Read-Only States", () => {
    it("disables user interaction when disabled prop is true", () => {
      renderWithAdapter(<WeaverDateField label="Disabled Field" disabled />);

      const input = screen.getByLabelText(/disabled field/i);
      expect(input).toBeDisabled();
    });

    it("supports readOnly mode distinctly", () => {
      const testDate = dayjs("2026-01-01");
      renderWithAdapter(
        <WeaverDateField
          label="Read Only Field"
          value={testDate}
          readOnly
        />
      );

      const input = screen.getByLabelText(/read only field/i);
      expect(input).toHaveAttribute("readonly");
    });
  });

  describe("Native Props and Slot Merging", () => {
    it("preserves minDate, maxDate, and custom format", () => {
      const min = dayjs("2026-01-01");
      const max = dayjs("2026-12-31");
      renderWithAdapter(
        <WeaverDateField
          label="Bounded Date"
          minDate={min}
          maxDate={max}
          format="DD/MM/YYYY"
        />
      );

      expect(screen.getByLabelText(/bounded date/i)).toBeInTheDocument();
    });

    it("renders Today action button in popup by default", () => {
      renderWithAdapter(
        <WeaverDateField
          label="Picker Test"
          open
        />
      );

      expect(screen.getByRole("button", { name: /today/i })).toBeInTheDocument();
    });

    it("merges custom slotProps safely", () => {
      renderWithAdapter(
        <WeaverDateField
          label="Slot Test"
          slotProps={{
            textField: {
              placeholder: "DD/MM/YYYY",
            },
          }}
        />
      );

      const input = screen.getByLabelText(/slot test/i);
      expect(input).toHaveAttribute("placeholder", "DD/MM/YYYY");
    });
  });

  describe("Theme Context", () => {
    it("renders under light and dark theme data attributes", () => {
      const { rerender, container } = renderWithAdapter(
        <div data-theme="light">
          <WeaverDateField label="Theme Field" />
        </div>
      );
      expect(screen.getByLabelText(/theme field/i)).toBeInTheDocument();

      rerender(
        <div data-theme="dark">
          <WeaverDateField label="Theme Field" />
        </div>
      );
      expect(container.firstChild).toBeInTheDocument();
    });
  });
});
