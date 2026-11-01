import React, { useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  FormGroup,
  IconButton,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ViewColumnOutlinedIcon from "@mui/icons-material/ViewColumnOutlined";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import type { WeaverDataField } from "../WeaverDataExplorer/WeaverDataExplorer.types";

interface FieldManagerProps<TRecord> {
  fields: WeaverDataField<TRecord>[];
  visibleFields: string[];
  onChange: (fields: string[]) => void;
}

export function FieldManager<TRecord>({
  fields,
  visibleFields,
  onChange,
}: FieldManagerProps<TRecord>) {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  const handleToggle = (key: string) => {
    const isCurrentlyVisible = visibleFields.includes(key);
    if (isCurrentlyVisible) {
      onChange(visibleFields.filter((k) => k !== key));
    } else {
      onChange([...visibleFields, key]);
    }
  };

  const handleShowAll = () => {
    onChange(fields.map((f) => f.key));
  };

  const handleReset = () => {
    onChange(
      fields
        .filter((f) => {
          if (f.visibleByDefault !== undefined) return f.visibleByDefault;
          if (f.key.toLowerCase() === "id") return false;
          return true;
        })
        .map((f) => f.key)
    );
  };

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<ViewColumnOutlinedIcon fontSize="small" />}
        onClick={handleClick}
        aria-label="Manage field visibility"
        sx={{
          textTransform: "none",
          fontWeight: 600,
          color: "text.primary",
          borderColor: "divider",
          height: 36,
          px: 1.5,
        }}
      >
        Fields
      </Button>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              p: 2,
              width: 260,
              maxHeight: 400,
              borderRadius: 2,
              boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
              border: 1,
              borderColor: "divider",
            },
          },
        }}
      >
        <Stack spacing={1}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Manage Fields
            </Typography>
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Reset to default">
                <IconButton size="small" onClick={handleReset} aria-label="Reset fields">
                  <RestartAltIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          <Divider />

          <FormGroup sx={{ maxHeight: 260, overflowY: "auto", pr: 0.5 }}>
            {fields.map((field) => {
              const isChecked = visibleFields.includes(field.key);
              const isNonHideable = field.hideable === false;

              return (
                <FormControlLabel
                  key={field.key}
                  control={
                    <Checkbox
                      size="small"
                      checked={isChecked}
                      disabled={isNonHideable}
                      onChange={() => handleToggle(field.key)}
                      sx={{ p: 0.5 }}
                    />
                  }
                  label={
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: "0.84rem",
                        color: isNonHideable ? "text.disabled" : "text.primary",
                      }}
                    >
                      {field.label}
                      {isNonHideable && " (Locked)"}
                    </Typography>
                  }
                  sx={{ mx: 0, my: 0.25 }}
                />
              );
            })}
          </FormGroup>

          <Divider />

          <Box display="flex" justifyContent="flex-end" pt={0.5}>
            <Button
              size="small"
              onClick={handleShowAll}
              sx={{ textTransform: "none", fontSize: "0.75rem", p: 0 }}
            >
              Show all fields
            </Button>
          </Box>
        </Stack>
      </Popover>
    </>
  );
}
