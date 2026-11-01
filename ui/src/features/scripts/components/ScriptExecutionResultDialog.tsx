import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import TerminalIcon from "@mui/icons-material/Terminal";
import { alpha, useTheme } from "@mui/material/styles";
import { WeaverCodeEditor } from "@/components/common/editors";

interface ScriptExecutionResultDialogProps {
  open: boolean;
  onClose: () => void;
  status: string;
  executionTime: string;
  code: string;
  output: string;
  errorMessage?: string;
}

const getStatusTone = (status: string): "success" | "error" | "warning" => {
  const normalizedStatus = status.toUpperCase();
  if (normalizedStatus === "SUCCESS") return "success";
  if (normalizedStatus === "FAILED") return "error";
  return "warning";
};

export default function ScriptExecutionResultDialog({
  open,
  onClose,
  status,
  executionTime,
  code,
  output,
  errorMessage,
}: ScriptExecutionResultDialogProps) {
  const theme = useTheme();
  const statusTone = getStatusTone(status);
  const statusColor = theme.palette[statusTone].main;

  const metricItems = [
    { label: "Status", value: status, color: statusColor },
    { label: "Execution Time", value: executionTime, color: theme.palette.primary.main },
    { label: "Code", value: code, color: theme.palette.text.secondary },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          backgroundImage: "none",
          boxShadow: "none",
          color: theme.palette.text.primary,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
          pb: 2,
        }}
      >
        <TerminalIcon fontSize="small" sx={{ color: theme.palette.primary.main }} />
        <Typography variant="h6" component="span">
          Script Execution Result
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 4, "&.MuiDialogContent-root": { pt: 4 } }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2 }}>
          {metricItems.map((item) => (
            <Box
              key={item.label}
              sx={{
                flex: 1,
                minWidth: 0,
                p: 1.5,
                borderRadius: 1,
                border: `1px solid ${alpha(item.color, 0.28)}`,
                backgroundColor: alpha(item.color, theme.palette.mode === "dark" ? 0.12 : 0.07),
              }}
            >
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                {item.label}
              </Typography>
              <Typography variant="body2" fontWeight={700} noWrap sx={{ color: item.color }}>
                {item.value || "N/A"}
              </Typography>
            </Box>
          ))}
        </Stack>

        {errorMessage ? (
          <Box
            sx={{
              mb: 2,
              p: 1.5,
              borderRadius: 1,
              border: `1px solid ${alpha(theme.palette.error.main, 0.35)}`,
              backgroundColor: alpha(theme.palette.error.main, theme.palette.mode === "dark" ? 0.14 : 0.08),
            }}
          >
            <Typography variant="body2" sx={{ color: theme.palette.error.main }}>
              {errorMessage}
            </Typography>
          </Box>
        ) : null}

        <Box
          sx={{
            overflow: "hidden",
            borderRadius: 1,
            border: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.default,
          }}
        >
          <WeaverCodeEditor
            height="360px"
            language="json"
            value={output}
            options={{ readOnly: true, minimap: { enabled: false }, automaticLayout: true }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ borderTop: `1px solid ${theme.palette.divider}`, px: 3, py: 1.5 }}>
        <Button startIcon={<CloseIcon />} onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
