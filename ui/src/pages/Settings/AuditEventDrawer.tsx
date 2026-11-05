import { useMemo, useRef, type KeyboardEvent } from "react";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Filter,
  Lock,
  X,
} from "lucide-react";
import { formatRelativeTime } from "@/utils/dateTime";
import { getErrorMessage } from "@/utils/error";
import { useAuditEvent, type AuditEvent } from "@/features/settings";
import {
  actionSentence,
  actorName,
  eventChanges,
  eventSubject,
  exactTimeWithZone,
  hasResourceId,
  isCreation,
  recordedArguments,
  valueText,
  type AuditChange,
} from "./auditEventFormat";
import { AuditStatus } from "./AuditStatus";
import styles from "./AuditEventDrawer.module.css";

export interface AuditActorFilter {
  actorId: string;
  label: string;
}

export interface AuditResourceFilter {
  resourceType: string;
  resourceId: string;
  label: string;
}

interface AuditEventDrawerProps {
  eventId: string | null;
  /** Events on the current page, in table order, for Previous / Next. */
  events: AuditEvent[];
  onNavigate: (eventId: string) => void;
  onClose: () => void;
  onFilterActor: (filter: AuditActorFilter) => void;
  onFilterResource: (filter: AuditResourceFilter) => void;
}

const isNotFound = (error: unknown) =>
  (error as { response?: { status?: number } } | null)?.response?.status ===
  404;

function EmptyValue() {
  return <span className={styles.empty}>Empty</span>;
}

function HiddenChip({ children }: { children: string }) {
  return (
    <span className={styles.secret}>
      <Lock size={12} aria-hidden />
      {children}
    </span>
  );
}

function ChangeRow({
  change,
  creation,
}: {
  change: AuditChange;
  creation: boolean;
}) {
  if (change.secret) {
    return (
      <div className={styles.changeRow}>
        <dt className={styles.changeLabel}>{change.label}</dt>
        <dd className={styles.changeValues}>
          <HiddenChip>
            {change.hasFrom ? "Changed (hidden)" : "Set (hidden)"}
          </HiddenChip>
        </dd>
      </div>
    );
  }

  if (change.valuesHidden) {
    // Same keys, new values: name the keys, never the values.
    return (
      <div className={styles.changeRow}>
        <dt className={styles.changeLabel}>{change.label}</dt>
        <dd className={styles.changeValues}>
          <span className={styles.keys}>{valueText(change.to)}</span>
          <HiddenChip>Values changed (hidden)</HiddenChip>
        </dd>
      </div>
    );
  }

  const from = valueText(change.from);
  const to = valueText(change.to);
  const blockClass = change.code ? styles.code : styles.prose;

  if (change.long) {
    return (
      <div className={`${styles.changeRow} ${styles.changeRowLong}`}>
        <dt className={styles.changeLabel}>{change.label}</dt>
        <dd className={styles.blocks}>
          {!creation && (
            <figure className={styles.block}>
              <figcaption>Before</figcaption>
              {from ? (
                <pre className={`${blockClass} ${styles.blockBefore}`}>
                  {from}
                </pre>
              ) : (
                <EmptyValue />
              )}
            </figure>
          )}
          <figure className={styles.block}>
            {!creation && <figcaption>After</figcaption>}
            {to ? <pre className={blockClass}>{to}</pre> : <EmptyValue />}
          </figure>
        </dd>
      </div>
    );
  }

  return (
    <div className={styles.changeRow}>
      <dt className={styles.changeLabel}>{change.label}</dt>
      <dd className={styles.changeValues}>
        {!creation && (
          <>
            <span className={styles.before}>{from || <EmptyValue />}</span>
            <ArrowRight size={13} className={styles.arrow} aria-hidden />
            <span className={styles.visuallyHidden}>changed to</span>
          </>
        )}
        <span className={styles.after}>{to || <EmptyValue />}</span>
      </dd>
    </div>
  );
}

function Skeleton() {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <span style={{ width: "62%" }} />
      <span style={{ width: "40%" }} />
      <span style={{ width: "88%" }} />
      <span style={{ width: "74%" }} />
      <span style={{ width: "81%" }} />
    </div>
  );
}

/**
 * One audit event, change first: what changed, then who, when and the outcome, then the
 * pivots to everything by this actor or on this resource.
 */
export function AuditEventDrawer({
  eventId,
  events,
  onNavigate,
  onClose,
  onFilterActor,
  onFilterResource,
}: AuditEventDrawerProps) {
  const eventQuery = useAuditEvent(eventId);
  const bodyRef = useRef<HTMLDivElement>(null);
  // While the full event loads, show what the table row already knows.
  const listed = events.find((item) => item.id === eventId);
  const event = eventQuery.data ?? listed;

  const index = events.findIndex((item) => item.id === eventId);
  const previous = index > 0 ? events[index - 1] : undefined;
  const next =
    index >= 0 && index < events.length - 1 ? events[index + 1] : undefined;

  const changes = useMemo(
    () => eventChanges(eventQuery.data),
    [eventQuery.data],
  );
  const args = useMemo(
    () => recordedArguments(eventQuery.data),
    [eventQuery.data],
  );
  const creation = changes ? isCreation(changes) : false;

  const title = event ? actionSentence(event.action) : "Audit event";
  const subject = event ? eventSubject(event) : null;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Arrow keys keep scrolling the content when focus is inside it.
    if (bodyRef.current?.contains(e.target as Node)) return;
    if (e.key === "ArrowUp" && previous) {
      e.preventDefault();
      onNavigate(previous.id);
    } else if (e.key === "ArrowDown" && next) {
      e.preventDefault();
      onNavigate(next.id);
    }
  };

  const failed = event?.status === "FAILED";

  return (
    <Drawer
      anchor="right"
      open={Boolean(eventId)}
      onClose={onClose}
      PaperProps={
        {
          className: styles.paper,
          role: "dialog",
          "aria-modal": true,
          "aria-labelledby": "audit-event-title",
          onKeyDown: handleKeyDown,
        } as object
      }
    >
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2
            id="audit-event-title"
            className={styles.title}
            aria-live="polite"
          >
            {title}
            {subject && <span className={styles.subject}>{subject}</span>}
          </h2>
          <div className={styles.headerActions}>
            <Tooltip
              title={
                previous ? "Previous event (↑)" : "First event on this page"
              }
            >
              <span>
                <IconButton
                  size="small"
                  aria-label="Previous event"
                  aria-keyshortcuts="ArrowUp"
                  disabled={!previous}
                  onClick={() => previous && onNavigate(previous.id)}
                >
                  <ChevronUp size={18} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip
              title={next ? "Next event (↓)" : "Last event on this page"}
            >
              <span>
                <IconButton
                  size="small"
                  aria-label="Next event"
                  aria-keyshortcuts="ArrowDown"
                  disabled={!next}
                  onClick={() => next && onNavigate(next.id)}
                >
                  <ChevronDown size={18} />
                </IconButton>
              </span>
            </Tooltip>
            <IconButton size="small" aria-label="Close" onClick={onClose}>
              <X size={18} />
            </IconButton>
          </div>
        </div>

        {event && (
          <p className={styles.meta}>
            {[
              <AuditStatus key="status" status={event.status} />,
              <span key="actor">{actorName(event)}</span>,
              event.timestamp ? (
                <time
                  key="time"
                  dateTime={new Date(event.timestamp).toISOString()}
                  title={exactTimeWithZone(event.timestamp)}
                >
                  {formatRelativeTime(event.timestamp)}
                </time>
              ) : null,
              event.durationMs != null ? (
                <span key="duration">{event.durationMs} ms</span>
              ) : null,
            ]
              .filter(Boolean)
              .map((item, i, items) => (
                // The dot ends an item, so a wrapped line never starts with one.
                <span key={i} className={styles.metaItem}>
                  {item}
                  {i < items.length - 1 && (
                    <span className={styles.metaSep} aria-hidden="true" />
                  )}
                </span>
              ))}
          </p>
        )}
      </header>

      <div className={styles.body} ref={bodyRef} tabIndex={-1}>
        {eventQuery.isPending && <Skeleton />}

        {eventQuery.error && (
          <div className={styles.loadError} role="alert">
            {isNotFound(eventQuery.error) ? (
              <p>This event no longer exists.</p>
            ) : (
              <>
                <p>
                  {getErrorMessage(
                    eventQuery.error,
                    "Could not load this event.",
                  )}
                </p>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => void eventQuery.refetch()}
                >
                  Try again
                </Button>
              </>
            )}
          </div>
        )}

        {eventQuery.data && event && (
          <>
            {failed && event.errorMessage && (
              <section
                className={styles.errorBox}
                aria-labelledby="audit-event-error"
              >
                <h3 id="audit-event-error" className={styles.sectionTitle}>
                  Error
                </h3>
                <p>{event.errorMessage}</p>
              </section>
            )}

            {changes && (
              <section aria-labelledby="audit-event-changes">
                <h3 id="audit-event-changes" className={styles.sectionTitle}>
                  {creation ? "Initial values" : "Changes"}
                </h3>
                {changes.length ? (
                  <dl className={styles.changes}>
                    {changes.map((change) => (
                      <ChangeRow
                        key={change.field}
                        change={change}
                        creation={creation}
                      />
                    ))}
                  </dl>
                ) : (
                  <p className={styles.note}>Saved with no field changes.</p>
                )}
              </section>
            )}

            <section aria-labelledby="audit-event-context">
              <h3 id="audit-event-context" className={styles.sectionTitle}>
                Context
              </h3>
              <dl className={styles.context}>
                <div>
                  <dt>Actor</dt>
                  <dd>
                    {actorName(event)}
                    {event.actorEmail && (
                      <span className={styles.secondary}>
                        {event.actorEmail}
                      </span>
                    )}
                  </dd>
                </div>
                {event.actorId && (
                  <div>
                    <dt>Actor ID</dt>
                    <dd className={styles.mono}>{event.actorId}</dd>
                  </div>
                )}
                <div>
                  <dt>Resource</dt>
                  <dd>
                    {event.resourceType}
                    {hasResourceId(event) && (
                      <span className={`${styles.secondary} ${styles.mono}`}>
                        {event.resourceId}
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Action</dt>
                  <dd className={styles.mono}>{event.action}</dd>
                </div>
                {event.timestamp && (
                  <div>
                    <dt>Time</dt>
                    <dd>{exactTimeWithZone(event.timestamp)}</dd>
                  </div>
                )}
                {event.clientIp && (
                  <div>
                    <dt>Client IP</dt>
                    <dd className={styles.mono}>{event.clientIp}</dd>
                  </div>
                )}
                <div>
                  <dt>Event ID</dt>
                  <dd className={styles.mono}>{event.id}</dd>
                </div>
              </dl>

              {/* A pivot is offered only when it applies: no id, no filter. */}
              {(event.actorId || hasResourceId(event)) && (
                <div className={styles.pivots}>
                  {event.actorId && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Filter size={14} aria-hidden />}
                      onClick={() =>
                        onFilterActor({
                          actorId: String(event.actorId),
                          label: actorName(event),
                        })
                      }
                    >
                      Show all by this actor
                    </Button>
                  )}
                  {hasResourceId(event) && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Filter size={14} aria-hidden />}
                      onClick={() =>
                        onFilterResource({
                          resourceType: event.resourceType,
                          resourceId: String(event.resourceId),
                          label:
                            typeof event.details?.name === "string" &&
                            event.details.name.trim()
                              ? event.details.name.trim()
                              : String(event.resourceId),
                        })
                      }
                    >
                      Show all for this resource
                    </Button>
                  )}
                </div>
              )}
            </section>

            {args.length > 0 && (
              <details className={styles.raw}>
                <summary>
                  <ChevronRight
                    size={14}
                    className={styles.summaryIcon}
                    aria-hidden
                  />
                  Recorded arguments
                </summary>
                <p className={styles.note}>
                  Recorded before change tracking. These are the call’s raw
                  arguments, not a list of changes.
                </p>
                {args.map(([label, text]) => (
                  <figure key={label} className={styles.block}>
                    <figcaption>{label}</figcaption>
                    <pre className={styles.code}>{text}</pre>
                  </figure>
                ))}
              </details>
            )}

            {!changes && args.length === 0 && !failed && (
              <p className={styles.note}>
                No details were recorded for this event.
              </p>
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}

export default AuditEventDrawer;
