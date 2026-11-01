import React, { useState } from "react";
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import type {
  WeaverDataAction,
  WeaverDataActionContext,
} from "../WeaverDataExplorer/WeaverDataExplorer.types";

interface DataActionsMenuProps<TRecord> {
  actions?: WeaverDataAction<TRecord>[];
  context: WeaverDataActionContext<TRecord>;
  size?: "small" | "medium";
  tooltip?: string;
  ariaLabel?: string;
}

export function DataActionsMenu<TRecord>({
  actions,
  context,
  size = "small",
  tooltip = "Actions",
  ariaLabel = "Record actions",
}: DataActionsMenuProps<TRecord>) {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  if (!actions || actions.length === 0) return null;

  // Filter out hidden actions
  const visibleActions = actions.filter((action) => {
    if (typeof action.hidden === "function") {
      return !action.hidden(context.record);
    }
    return !action.hidden;
  });

  if (visibleActions.length === 0) return null;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleClose = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setAnchorEl(null);
  };

  const handleActionClick = (
    e: React.MouseEvent,
    action: WeaverDataAction<TRecord>
  ) => {
    e.stopPropagation();
    handleClose();
    action.onClick(context);
  };

  return (
    <>
      <Tooltip title={tooltip}>
        <IconButton
          size={size}
          aria-label={ariaLabel}
          onClick={handleClick}
          sx={{ color: "text.secondary" }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={(_, reason) => {
          if (reason) handleClose();
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 150,
              borderRadius: 1.5,
              boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
              border: 1,
              borderColor: "divider",
            },
          },
        }}
      >
        {visibleActions.map((action) => {
          const isDisabled =
            typeof action.disabled === "function"
              ? action.disabled(context.record)
              : Boolean(action.disabled);

          return (
            <MenuItem
              key={action.id}
              disabled={isDisabled}
              onClick={(e) => handleActionClick(e, action)}
              sx={{
                fontSize: "0.84rem",
                py: 0.8,
                color: action.danger ? "error.main" : "text.primary",
                "&:hover": {
                  bgcolor: action.danger
                    ? "rgba(229, 72, 77, 0.08)"
                    : undefined,
                },
              }}
            >
              {action.icon && (
                <ListItemIcon
                  sx={{
                    minWidth: 28,
                    color: action.danger ? "error.main" : "inherit",
                  }}
                >
                  {action.icon}
                </ListItemIcon>
              )}
              <ListItemText primaryTypographyProps={{ fontSize: "0.84rem" }}>
                {action.label}
              </ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
