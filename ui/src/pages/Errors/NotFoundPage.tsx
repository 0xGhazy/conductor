import { useEffect, useMemo } from "react";
import { Box, Button, Divider, Paper, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import { useLocation, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";

const ENTITY_NOT_FOUND_CONTEXT_KEY = "entity_not_found_context";

const readContext = () => {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(ENTITY_NOT_FOUND_CONTEXT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const padDatePart = (value) => String(value || "").padStart(2, "0");

const formatSessionTimestamp = (value) => {
  if (!value || value === "-") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })
    .formatToParts(date)
    .reduce((result, part) => ({ ...result, [part.type]: part.value }), {});

  return `${parts.year}-${parts.month}-${parts.day} ${padDatePart(parts.hour)}:${parts.minute}:${parts.second} ${parts.dayPeriod}`;
};

export default function NotFoundPage({ context: contextOverride = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const context = useMemo(
    () => contextOverride || location?.state || readContext(),
    [contextOverride, location?.state]
  );
  const isDark = theme.palette.mode === "dark";
  const accent = theme.palette.primary.main;
  const error = theme.palette.error.main;
  const pageBg = theme.palette.background.default;
  const surfaceBg = theme.palette.background.paper;
  const sidePanelBg = isDark ? theme.palette.background.default : "var(--color-canvas-subtle, #F7F8FA)";
  const diagnosticsBg = theme.palette.background.paper;

  useEffect(() => {
    document.title = "404 - Not Found";
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(ENTITY_NOT_FOUND_CONTEXT_KEY);
    }
  }, []);

  const message = String(context?.message || "The requested page or entity was not found.");
  const reason = String(context?.reason || "Requested resource does not exist.");
  const requestId = String(context?.requestId || "-");
  const timestamp = formatSessionTimestamp(context?.timestamp || "-");
  const currentPath = String(
    context?.path ||
      (typeof window === "undefined" ? "-" : `${window.location.pathname}${window.location.search}`)
  );
  const canCopyRequestId = requestId && requestId !== "-";

  const handleCopyRequestId = async () => {
    if (!canCopyRequestId) return;
    try {
      await navigator.clipboard.writeText(requestId);
    } catch {
      // Copy failure should not block navigation from the error page.
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: { xs: 2, md: 4 },
        overflow: "hidden",
        background: pageBg,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "min(1040px, 96vw)",
          overflow: "hidden",
          borderRadius: 3,
          border: `1px solid ${theme.palette.divider}`,
          background: surfaceBg,
          boxShadow: "none",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1.05fr 0.95fr" },
            minHeight: { md: 520 },
          }}
        >
          <Box
            sx={{
              position: "relative",
              p: { xs: 3, md: 5 },
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              borderRight: { md: `1px solid ${theme.palette.divider}` },
            }}
          >
            <Stack spacing={3}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 1.5,
                    color: error,
                    bgcolor: alpha(error, 0.12),
                    border: `1px solid ${alpha(error, 0.24)}`,
                  }}
                >
                  <ReportProblemOutlinedIcon fontSize="small" />
                </Box>
                <Typography
                  sx={{
                    color: error,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 0,
                    textTransform: "uppercase",
                  }}
                >
                  Error 404
                </Typography>
              </Stack>

              <Box>
                <Typography
                  sx={{
                    color: alpha(theme.palette.text.primary, isDark ? 0.28 : 0.12),
                    fontSize: { xs: 76, sm: 96, md: 116 },
                    fontWeight: 800,
                    lineHeight: 0.82,
                    letterSpacing: 0,
                  }}
                >
                  404
                </Typography>
                <Typography
                  component="h1"
                  sx={{
                    mt: 2,
                    color: theme.palette.text.primary,
                    fontSize: { xs: 30, md: 42 },
                    fontWeight: 800,
                    lineHeight: 1.12,
                    letterSpacing: 0,
                  }}
                >
                  We could not find this page
                </Typography>
                <Typography
                  sx={{
                    mt: 1.5,
                    maxWidth: 560,
                    color: theme.palette.text.secondary,
                    fontSize: 15.5,
                    lineHeight: 1.8,
                  }}
                >
                  {message}
                </Typography>
              </Box>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mt: 4 }}>
              <Button
                variant="contained"
                startIcon={<HomeOutlinedIcon />}
                onClick={() => navigate("/")}
                sx={{
                  minHeight: 42,
                  px: 2,
                  borderRadius: 1.25,
                  bgcolor: accent,
                  color: theme.palette.primary.contrastText,
                  fontWeight: 800,
                  textTransform: "none",
                  "&:hover": {
                    bgcolor: theme.palette.primary.dark || accent,
                  },
                }}
              >
                Go to Dashboard
              </Button>
              <Button
                variant="outlined"
                startIcon={<ArrowBackOutlinedIcon />}
                onClick={() => navigate(-1)}
                sx={{
                  minHeight: 42,
                  px: 2,
                  borderRadius: 1.25,
                  borderColor: theme.palette.divider,
                  color: theme.palette.text.primary,
                  fontWeight: 700,
                  textTransform: "none",
                  "&:hover": {
                    borderColor: alpha(accent, 0.46),
                    bgcolor: alpha(accent, 0.08),
                  },
                }}
              >
                Go Back
              </Button>
            </Stack>
          </Box>

          <Box
            sx={{
              p: { xs: 3, md: 4 },
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              bgcolor: sidePanelBg,
            }}
          >
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, md: 2.5 },
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
                bgcolor: diagnosticsBg,
              }}
            >
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 1.25,
                    color: accent,
                    bgcolor: alpha(accent, 0.1),
                  }}
                >
                  <SearchOffOutlinedIcon fontSize="small" />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ color: theme.palette.text.primary, fontWeight: 750, fontSize: 16 }}>
                    Request details
                  </Typography>
                  <Typography sx={{ color: theme.palette.text.secondary, fontSize: 12.5 }}>
                    Information returned by the application.
                  </Typography>
                </Box>
              </Stack>

              <Divider sx={{ my: 2, borderColor: theme.palette.divider }} />

              <Stack spacing={1.25}>
                {[
                  ["Path", currentPath],
                  ["Reason", reason],
                  ["Request ID", requestId],
                  ["Timestamp", timestamp],
                ].map(([label, value]) => (
                  <Box
                    key={label}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "112px minmax(0, 1fr)" },
                      gap: { xs: 0.35, sm: 1 },
                      alignItems: "start",
                    }}
                  >
                    <Typography
                      sx={{
                        color: theme.palette.text.secondary,
                        fontSize: 12,
                        fontWeight: 750,
                        textTransform: "uppercase",
                      }}
                    >
                      {label}
                    </Typography>
                    <Typography
                      sx={{
                        color: theme.palette.text.primary,
                        fontFamily:
                          label === "Request ID" || label === "Path"
                            ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'
                            : "inherit",
                        fontSize: 13,
                        lineHeight: 1.55,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {value}
                    </Typography>
                  </Box>
                ))}
              </Stack>

              <Button
                variant="text"
                startIcon={<ContentCopyOutlinedIcon />}
                disabled={!canCopyRequestId}
                onClick={handleCopyRequestId}
                sx={{
                  mt: 2.25,
                  px: 0,
                  color: accent,
                  fontWeight: 750,
                  textTransform: "none",
                  "&.Mui-disabled": {
                    color: theme.palette.text.disabled,
                  },
                }}
              >
                Copy request ID
              </Button>
            </Paper>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}

NotFoundPage.propTypes = {
  context: PropTypes.object,
};

NotFoundPage.defaultProps = {
  context: null,
};

