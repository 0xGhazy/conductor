import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { WeaverSelectField } from "./WeaverSelectField";
import type { WeaverSelectOption } from "./WeaverSelectField.types";

interface DbOption {
  label: string;
  value: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

const sampleOptions: DbOption[] = [
  { label: "Postgres", value: "postgres", icon: <span data-testid="icon-pg">PG</span> },
  { label: "MySQL", value: "mysql", icon: <span data-testid="icon-my">MY</span> },
  { label: "Oracle", value: "oracle" },
  { label: "Legacy DB", value: "legacy", disabled: true },
];

describe("WeaverSelectField", () => {
  describe("Rendering & Base Props", () => {
    it("renders label and helper text", () => {
      render(
        <WeaverSelectField
          label="Database Engine"
          helperText="Select the primary database"
          options={sampleOptions}
        />
      );

      expect(screen.getByText("Database Engine")).toBeInTheDocument();
      expect(screen.getByText("Select the primary database")).toBeInTheDocument();
    });

    it("prioritizes external errorMessage over helperText and displays error state", () => {
      render(
        <WeaverSelectField
          label="Database Engine"
          helperText="Select the primary database"
          errorMessage="Database is required"
          options={sampleOptions}
        />
      );

      expect(screen.getByText("Database is required")).toBeInTheDocument();
      expect(screen.queryByText("Select the primary database")).not.toBeInTheDocument();
    });

    it("displays placeholder when no option is selected", () => {
      render(
        <WeaverSelectField
          label="Database"
          placeholder="Choose an engine"
          options={sampleOptions}
        />
      );

      expect(screen.getByText("Choose an engine")).toBeInTheDocument();
    });

    it("marks required state with asterisk", () => {
      render(
        <WeaverSelectField
          label="Required Field"
          required
          options={sampleOptions}
        />
      );

      expect(screen.getByText(/\*/)).toBeInTheDocument();
    });
  });

  describe("Single Selection", () => {
    it("renders the selected option label", () => {
      render(
        <WeaverSelectField
          label="Database"
          options={sampleOptions}
          value="postgres"
        />
      );

      expect(screen.getByText("Postgres")).toBeInTheDocument();
    });

    it("fires onChange with clean value and selected option metadata", () => {
      const handleChange = vi.fn();
      render(
        <WeaverSelectField
          label="Database"
          options={sampleOptions}
          value=""
          onChange={handleChange}
        />
      );

      // Open select
      const combobox = screen.getByRole("combobox");
      fireEvent.mouseDown(combobox);

      // Select MySQL
      const option = screen.getByRole("option", { name: /mysql/i });
      fireEvent.click(option);

      expect(handleChange).toHaveBeenCalledWith(
        "mysql",
        expect.arrayContaining([
          expect.objectContaining({ label: "MySQL", value: "mysql" }),
        ])
      );
    });

    it("renders selected icon when showSelectedIcons is true", () => {
      render(
        <WeaverSelectField
          label="Database"
          options={sampleOptions}
          value="postgres"
          showSelectedIcons
        />
      );

      expect(screen.getByTestId("icon-pg")).toBeInTheDocument();
      expect(screen.getByText("Postgres")).toBeInTheDocument();
    });
  });

  describe("Multiple Selection", () => {
    it("renders multiple selected items as comma-separated list by default", () => {
      render(
        <WeaverSelectField
          multiple
          label="Databases"
          options={sampleOptions}
          value={["postgres", "oracle"]}
        />
      );

      expect(screen.getByText("Postgres, Oracle")).toBeInTheDocument();
    });

    it("fires onChange with array of values and array of selected option metadata", () => {
      const handleChange = vi.fn();
      render(
        <WeaverSelectField
          multiple
          label="Databases"
          options={sampleOptions}
          value={["postgres"]}
          onChange={handleChange}
        />
      );

      const combobox = screen.getByRole("combobox");
      fireEvent.mouseDown(combobox);

      const mysqlOption = screen.getByRole("option", { name: /mysql/i });
      fireEvent.click(mysqlOption);

      expect(handleChange).toHaveBeenCalledWith(
        expect.arrayContaining(["postgres", "mysql"]),
        expect.arrayContaining([
          expect.objectContaining({ value: "postgres" }),
          expect.objectContaining({ value: "mysql" }),
        ])
      );
    });

    it("supports custom renderSelectedValue", () => {
      render(
        <WeaverSelectField
          multiple
          label="Databases"
          options={sampleOptions}
          value={["postgres", "oracle"]}
          renderSelectedValue={(selected) => (
            <span data-testid="custom-selected">{selected.length} items active</span>
          )}
        />
      );

      expect(screen.getByTestId("custom-selected")).toHaveTextContent("2 items active");
    });
  });

  describe("Dimensions and Sizing", () => {
    it("applies default fullWidth and small size matching WeaverTextField", () => {
      const { container } = render(
        <WeaverSelectField
          label="Default Sizing"
          options={sampleOptions}
        />
      );

      const root = container.querySelector(".MuiFormControl-root") as HTMLElement;
      expect(root).toHaveClass("MuiFormControl-fullWidth");
      const inputBase = container.querySelector(".MuiInputBase-root") as HTMLElement;
      expect(inputBase).toHaveClass("MuiInputBase-sizeSmall");
    });

    it("applies width and height overrides cleanly", () => {
      const { container } = render(
        <WeaverSelectField
          label="Size Test"
          options={sampleOptions}
          width="350px"
          height={48}
        />
      );

      const root = container.firstChild as HTMLElement;
      expect(root.style.width).toBe("350px");

      const inputBase = container.querySelector(".MuiInputBase-root") as HTMLElement;
      expect(inputBase).toBeInTheDocument();
    });
  });

  describe("Icons and Presentation", () => {
    it("renders options without icons properly", () => {
      render(
        <WeaverSelectField
          label="Database"
          options={sampleOptions}
        />
      );

      const combobox = screen.getByRole("combobox");
      fireEvent.mouseDown(combobox);

      const oracleOption = screen.getByRole("option", { name: /oracle/i });
      expect(oracleOption).toBeInTheDocument();
      expect(within(oracleOption).queryByTestId("icon-pg")).not.toBeInTheDocument();
    });
  });

  describe("Disabled and Read-Only States", () => {
    it("disables user interaction when disabled prop is true", () => {
      render(
        <WeaverSelectField
          label="Disabled Test"
          options={sampleOptions}
          disabled
        />
      );

      const combobox = screen.getByRole("combobox");
      expect(combobox).toHaveAttribute("aria-disabled", "true");
    });

    it("disables individual option marked as disabled", () => {
      render(
        <WeaverSelectField
          label="Option Test"
          options={sampleOptions}
        />
      );

      const combobox = screen.getByRole("combobox");
      fireEvent.mouseDown(combobox);

      const disabledOption = screen.getByRole("option", { name: /legacy db/i });
      expect(disabledOption).toHaveAttribute("aria-disabled", "true");
    });

    it("supports read-only state without opening menu on click", () => {
      render(
        <WeaverSelectField
          label="ReadOnly Test"
          options={sampleOptions}
          value="postgres"
          readOnly
        />
      );

      expect(screen.getByText("Postgres")).toBeInTheDocument();
      const combobox = screen.getByRole("combobox");
      fireEvent.mouseDown(combobox);

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  describe("Native MUI Props Passthrough", () => {
    it("passes native MenuProps, onOpen, and onClose callbacks", () => {
      const handleOpen = vi.fn();
      const handleClose = vi.fn();
      render(
        <WeaverSelectField
          label="Props Test"
          options={sampleOptions}
          onOpen={handleOpen}
          onClose={handleClose}
        />
      );

      const combobox = screen.getByRole("combobox");
      fireEvent.mouseDown(combobox);
      expect(handleOpen).toHaveBeenCalled();

      fireEvent.keyDown(combobox, { key: "Escape", code: "Escape" });
      expect(handleClose).toHaveBeenCalled();
    });

    it("supports custom IconComponent", () => {
      const CustomIcon = () => <span data-testid="custom-arrow">▼</span>;
      render(
        <WeaverSelectField
          label="Custom Icon"
          options={sampleOptions}
          IconComponent={CustomIcon}
        />
      );

      expect(screen.getByTestId("custom-arrow")).toBeInTheDocument();
    });
  });

  describe("Theme Support", () => {
    it("renders seamlessly under light and dark theme context", () => {
      const { rerender, container } = render(
        <div data-theme="light">
          <WeaverSelectField
            label="Theme Test"
            options={sampleOptions}
            value="postgres"
          />
        </div>
      );
      expect(screen.getByText("Postgres")).toBeInTheDocument();

      rerender(
        <div data-theme="dark">
          <WeaverSelectField
            label="Theme Test"
            options={sampleOptions}
            value="postgres"
          />
        </div>
      );
      expect(container.firstChild).toBeInTheDocument();
      expect(screen.getByText("Postgres")).toBeInTheDocument();
    });
  });
});
