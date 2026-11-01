import Timeline from "@mui/lab/Timeline";
import TimelineItem from "@mui/lab/TimelineItem";
import TimelineSeparator from "@mui/lab/TimelineSeparator";
import TimelineConnector from "@mui/lab/TimelineConnector";
import TimelineContent from "@mui/lab/TimelineContent";
import TimelineOppositeContent from "@mui/lab/TimelineOppositeContent";
import TimelineDot from "@mui/lab/TimelineDot";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Avatar from "@mui/material/Avatar";

export type ActivityTimelineAction = {
  timestamp?: string | number | Date;
  actor?: string;
  photo?: string;
  avatar?: string;
  description?: string;
  details?: string[];
};

export type ActivityTimelinePosition = "left" | "right" | "alternate" | "alternate-reverse";

export interface ActivityTimelineProps {
  actions?: ActivityTimelineAction[];
  position?: ActivityTimelinePosition;
  emptyText?: string;
}

const toDisplayTime = (value: ActivityTimelineAction["timestamp"]) => {
  if (value == null || value === "") return "N/A";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toLocaleString();
  return String(value);
};

export default function ActivityTimeline({
  actions,
  position = "alternate",
  emptyText = "No activity yet.",
}: ActivityTimelineProps) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return (
      <Paper
        sx={{
          p: 2,
          borderRadius: 2,
          border: "1px solid var(--color-border-default)",
          background: "var(--color-canvas-default)",
        }}
      >
        <Typography variant="body2" sx={{ color: "var(--color-fg-muted)" }}>
          {emptyText}
        </Typography>
      </Paper>
    );
  }

  return (
    <Timeline
      position={position}
      sx={{
        m: 0,
        p: 0,
      }}
    >
      {actions.map((action, index) => {
        const isLast = index === actions.length - 1;
        const timestamp = toDisplayTime(action?.timestamp);
        const actor = String(action?.actor || "Unknown Actor");
        const description = String(action?.description || "");
        const actorPhoto = String(action?.photo || action?.avatar || "").trim();
        const details = Array.isArray(action?.details)
          ? action.details.filter(Boolean).map((item) => String(item))
          : [];
        const isOppositeOnLeft =
          position === "alternate"
            ? index % 2 === 0
            : position === "alternate-reverse"
              ? index % 2 !== 0
              : true;
        const isContentOnRight = isOppositeOnLeft;

        return (
          <TimelineItem
            key={`${timestamp}-${actor}-${index}`}
            sx={{
              alignItems: "center",
            }}
          >
            <TimelineOppositeContent
              align={isOppositeOnLeft ? "right" : "left"}
              variant="body2"
              sx={{
                color: "var(--color-fg-muted)",
                m: 0,
                py: 0,
                minWidth: 140,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                justifyContent: isOppositeOnLeft ? "flex-end" : "flex-start",
                textAlign: isOppositeOnLeft ? "right" : "left",
              }}
            >
              {timestamp}
            </TimelineOppositeContent>

            <TimelineSeparator>
              <TimelineConnector
                sx={{
                  bgcolor: "var(--color-border-default)",
                }}
              />
              <TimelineDot
                sx={{
                  bgcolor: "var(--color-canvas-default)",
                  color: "var(--color-accent-fg)",
                  border: "1px solid var(--color-border-default)",
                  boxShadow: "none",
                }}
              >
                <PersonOutlineIcon fontSize="small" />
              </TimelineDot>
              {!isLast ? (
                <TimelineConnector
                  sx={{
                    bgcolor: "var(--color-border-default)",
                  }}
                />
              ) : null}
            </TimelineSeparator>

            <TimelineContent
              sx={{
                py: 1,
                px: 2,
                display: "flex",
                justifyContent: { xs: "stretch", md: isContentOnRight ? "flex-start" : "flex-end" },
              }}
            >
              <Paper
                sx={{
                  p: 1,
                  borderRadius: 2,
                  border: "1px solid var(--color-border-default)",
                  background: "var(--color-canvas-default)",
                  width: { xs: "100%", md: "52%" },
                }}
              >
                <Typography
                  variant="subtitle2"
                  component="div"
                  sx={{
                    color: "var(--color-fg-default)",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <Avatar
                    src={actorPhoto || undefined}
                    alt={actor}
                    sx={{
                      width: 26,
                      height: 26,
                      fontSize: 12,
                      bgcolor: "var(--color-canvas-subtle)",
                      color: "var(--color-fg-default)",
                      border: "1px solid var(--color-border-default)",
                    }}
                  >
                    {actor
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase() || "")
                      .join("")}
                  </Avatar>
                  <span>{actor}</span>
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "var(--color-fg-muted)",
                      lineHeight: 1.35,
                      whiteSpace: "pre-line",
                    }}
                  >
                    {description || "No description provided."}
                  </Typography>
                  {details.length ? (
                    <Box sx={{ mt: 0.5, display: "grid", gap: 0.25 }}>
                      {details.map((line, lineIndex) => (
                        <Typography
                          key={`${index}-detail-${lineIndex}`}
                          variant="caption"
                          sx={{
                            color: "var(--color-fg-muted)",
                            lineHeight: 1.3,
                            whiteSpace: "pre-line",
                          }}
                        >
                          {line}
                        </Typography>
                      ))}
                    </Box>
                  ) : null}
                </Box>
              </Paper>
            </TimelineContent>
          </TimelineItem>
        );
      })}
    </Timeline>
  );
}
