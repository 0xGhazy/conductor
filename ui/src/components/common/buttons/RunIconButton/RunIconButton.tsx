import type { MouseEventHandler } from "react";
import { CircularProgress, IconButton, Tooltip } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import type { SxProps, Theme } from "@mui/material/styles";

interface RunIconButtonProps {
  onClick?: MouseEventHandler<HTMLButtonElement>;
  running?: boolean;
  disabled?: boolean;
  title?: string;
  runningTitle?: string;
  ariaLabel?: string;
  buttonSize?: number;
  iconSize?: number;
  spinnerSize?: number;
  sx?: SxProps<Theme>;
}

const buildRunButtonSx = (buttonSize: number, iconSize: number, sx?: SxProps<Theme>): SxProps<Theme> => {
  const baseSx = {
    width: buttonSize,
    height: buttonSize,
    flexShrink: 0,
    border: 0,
    color: "var(--color-status-success, #1a7f37) !important",
    backgroundColor: "transparent",
    "&:hover": {
      color: "var(--color-btn-primary-hover, #2c974b) !important",
      backgroundColor: "transparent",
    },
    "&.Mui-disabled": {
      color: "var(--color-status-success, #1a7f37) !important",
      backgroundColor: "transparent",
      opacity: 0.65,
    },
    "& .MuiSvgIcon-root, & .MuiCircularProgress-root": {
      fontSize: iconSize,
      color: "var(--color-status-success, #1a7f37) !important",
    },
  };

  if (!sx) return baseSx;
  return (Array.isArray(sx) ? [baseSx, ...sx] : [baseSx, sx]) as SxProps<Theme>;
};

export default function RunIconButton({
  onClick,
  running = false,
  disabled = false,
  title = "Run",
  runningTitle = "Running",
  ariaLabel = "Run",
  buttonSize = 44,
  iconSize = 32,
  spinnerSize = 20,
  sx,
}: RunIconButtonProps) {
  const isDisabled = disabled || running;

  return (
    <Tooltip title={running ? runningTitle : title}>
      <span>
        <IconButton
          aria-label={ariaLabel}
          onClick={onClick}
          disabled={isDisabled}
          size="large"
          sx={buildRunButtonSx(buttonSize, iconSize, sx)}
        >
          {running ? <CircularProgress size={spinnerSize} color="inherit" /> : <PlayArrowIcon />}
        </IconButton>
      </span>
    </Tooltip>
  );
}
