import React, { useState } from "react";
import {
  Badge,
  Box,
  Button,
  Divider,
  FormControl,
  IconButton,
  MenuItem,
  Popover,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type {
  WeaverDataField,
  WeaverFilter,
  WeaverFilterModel,
  WeaverFilterOperator,
} from "../WeaverDataExplorer/WeaverDataExplorer.types";
import {
  generateFilterId,
  getOperatorsForFieldType,
} from "./dataExplorerUtils";

interface FilterBuilderProps<TRecord> {
  fields: WeaverDataField<TRecord>[];
  filterModel: WeaverFilterModel;
  onChange: (model: WeaverFilterModel) => void;
}

export function FilterBuilder<TRecord>({
  fields,
  filterModel,
  onChange,
}: FilterBuilderProps<TRecord>) {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const filterableFields = fields.filter((f) => f.filterable !== false);
  const activeCount = filterModel.filters.length;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  const handleAddFilter = () => {
    if (filterableFields.length === 0) return;
    const defaultField = filterableFields[0];
    const operators = getOperatorsForFieldType(defaultField.type);

    const newFilter: WeaverFilter = {
      id: generateFilterId(),
      field: defaultField.key,
      operator: operators[0].value,
      value: "",
    };

    onChange({
      ...filterModel,
      filters: [...filterModel.filters, newFilter],
    });
  };

  const handleRemoveFilter = (id: string) => {
    onChange({
      ...filterModel,
      filters: filterModel.filters.filter((f) => f.id !== id),
    });
  };

  const handleClearAll = () => {
    onChange({
      ...filterModel,
      filters: [],
    });
  };

  const handleFieldChange = (id: string, fieldKey: string) => {
    const fieldDef = filterableFields.find((f) => f.key === fieldKey);
    const operators = getOperatorsForFieldType(fieldDef?.type);

    onChange({
      ...filterModel,
      filters: filterModel.filters.map((f) => {
        if (f.id !== id) return f;
        return {
          ...f,
          field: fieldKey,
          operator: operators[0].value,
          value: "",
        };
      }),
    });
  };

  const handleOperatorChange = (id: string, operator: WeaverFilterOperator) => {
    onChange({
      ...filterModel,
      filters: filterModel.filters.map((f) => {
        if (f.id !== id) return f;
        return { ...f, operator };
      }),
    });
  };

  const handleValueChange = (id: string, value: unknown) => {
    onChange({
      ...filterModel,
      filters: filterModel.filters.map((f) => {
        if (f.id !== id) return f;
        return { ...f, value };
      }),
    });
  };

  const handleLogicChange = (
    _: React.MouseEvent<HTMLElement>,
    nextLogic: "AND" | "OR" | null
  ) => {
    if (!nextLogic) return;
    onChange({
      ...filterModel,
      logic: nextLogic,
    });
  };

  return (
    <>
      <Badge badgeContent={activeCount} color="error">
        <Button
          size="small"
          variant={activeCount > 0 ? "contained" : "outlined"}
          color={activeCount > 0 ? "primary" : "inherit"}
          startIcon={<FilterAltOutlinedIcon fontSize="small" />}
          onClick={handleClick}
          aria-label="Filter records"
          sx={{
            textTransform: "none",
            fontWeight: 600,
            borderColor: activeCount > 0 ? undefined : "divider",
            height: 36,
            px: 1.5,
          }}
        >
          Filters
        </Button>
      </Badge>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              p: 2.5,
              width: { xs: 320, sm: 540 },
              maxHeight: 500,
              borderRadius: 2,
              boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
              border: 1,
              borderColor: "divider",
            },
          },
        }}
      >
        <Stack spacing={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Filter Records
            </Typography>

            {filterModel.filters.length > 1 && (
              <ToggleButtonGroup
                size="small"
                value={filterModel.logic}
                exclusive
                onChange={handleLogicChange}
                aria-label="Filter match logic"
              >
                <ToggleButton
                  value="AND"
                  sx={{ px: 1.2, py: 0.2, fontSize: "0.75rem", textTransform: "none", fontWeight: 600 }}
                >
                  All (AND)
                </ToggleButton>
                <ToggleButton
                  value="OR"
                  sx={{ px: 1.2, py: 0.2, fontSize: "0.75rem", textTransform: "none", fontWeight: 600 }}
                >
                  Any (OR)
                </ToggleButton>
              </ToggleButtonGroup>
            )}
          </Box>

          <Divider />

          {filterModel.filters.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
              No active filters. Click &quot;Add Filter&quot; below to refine records.
            </Typography>
          ) : (
            <Stack spacing={1.5} sx={{ maxHeight: 280, overflowY: "auto", pr: 0.5 }}>
              {filterModel.filters.map((filter) => {
                const currentField = filterableFields.find(
                  (f) => f.key === filter.field
                );
                const operators = getOperatorsForFieldType(currentField?.type);
                const currentOp = operators.find(
                  (op) => op.value === filter.operator
                );
                const isNoValue = currentOp?.noValue;

                return (
                  <Box
                    key={filter.id}
                    display="flex"
                    alignItems="center"
                    gap={1}
                    flexWrap="nowrap"
                  >
                    {/* Field select */}
                    <FormControl size="small" sx={{ minWidth: 130, flex: 1 }}>
                      <Select
                        value={filter.field}
                        onChange={(e) => handleFieldChange(filter.id, e.target.value)}
                        sx={{ height: 34, fontSize: "0.82rem" }}
                      >
                        {filterableFields.map((f) => (
                          <MenuItem key={f.key} value={f.key} sx={{ fontSize: "0.82rem" }}>
                            {f.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {/* Operator select */}
                    <FormControl size="small" sx={{ minWidth: 120, flex: 1 }}>
                      <Select
                        value={filter.operator}
                        onChange={(e) =>
                          handleOperatorChange(
                            filter.id,
                            e.target.value as WeaverFilterOperator
                          )
                        }
                        sx={{ height: 34, fontSize: "0.82rem" }}
                      >
                        {operators.map((op) => (
                          <MenuItem key={op.value} value={op.value} sx={{ fontSize: "0.82rem" }}>
                            {op.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {/* Value input (hidden if noValue) */}
                    {!isNoValue ? (
                      currentField?.type === "boolean" ? (
                        <FormControl size="small" sx={{ minWidth: 100, flex: 1 }}>
                          <Select
                            value={String(filter.value ?? "true")}
                            onChange={(e) =>
                              handleValueChange(filter.id, e.target.value === "true")
                            }
                            sx={{ height: 34, fontSize: "0.82rem" }}
                          >
                            <MenuItem value="true" sx={{ fontSize: "0.82rem" }}>
                              true
                            </MenuItem>
                            <MenuItem value="false" sx={{ fontSize: "0.82rem" }}>
                              false
                            </MenuItem>
                          </Select>
                        </FormControl>
                      ) : currentField?.options && currentField.options.length > 0 ? (
                        <FormControl size="small" sx={{ minWidth: 110, flex: 1 }}>
                          <Select
                            value={String(filter.value ?? "")}
                            onChange={(e) => handleValueChange(filter.id, e.target.value)}
                            sx={{ height: 34, fontSize: "0.82rem" }}
                          >
                            {currentField.options.map((opt) => (
                              <MenuItem key={String(opt.value)} value={String(opt.value)}>
                                {opt.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <TextField
                          size="small"
                          type={currentField?.type === "number" ? "number" : "text"}
                          placeholder="Value..."
                          value={String(filter.value ?? "")}
                          onChange={(e) => handleValueChange(filter.id, e.target.value)}
                          slotProps={{
                            htmlInput: {
                              sx: { height: 34, py: 0, px: 1, fontSize: "0.82rem" },
                            },
                          }}
                          sx={{ minWidth: 110, flex: 1 }}
                        />
                      )
                    ) : (
                      <Box sx={{ minWidth: 100, flex: 1 }} />
                    )}

                    {/* Remove button */}
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveFilter(filter.id)}
                      aria-label="Remove filter"
                      sx={{ color: "text.secondary" }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                );
              })}
            </Stack>
          )}

          <Divider />

          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Button
              size="small"
              startIcon={<AddIcon fontSize="small" />}
              onClick={handleAddFilter}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Add Filter
            </Button>

            {filterModel.filters.length > 0 && (
              <Button
                size="small"
                color="error"
                startIcon={<DeleteOutlineIcon fontSize="small" />}
                onClick={handleClearAll}
                sx={{ textTransform: "none" }}
              >
                Clear All
              </Button>
            )}
          </Box>
        </Stack>
      </Popover>
    </>
  );
}
