import React, { useState, useEffect, useMemo, type ReactNode } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";

import CloseIcon from "@mui/icons-material/Close";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";

import { WeaverTextField } from "../../fields/WeaverTextField";
import { WeaverButton } from "../../buttons/WeaverButton";
import type {
  WeaverConfirmDialogProps,
  WeaverConfirmIntent,
} from "./WeaverConfirmDialog.types";
import styles from "./WeaverConfirmDialog.module.css";

const getIntentIcon = (intent: WeaverConfirmIntent = "default") => {
  switch (intent) {
    case "danger":
      return <ErrorOutlineRoundedIcon fontSize="inherit" />;
    case "warning":
      return <WarningAmberRoundedIcon fontSize="inherit" />;
    case "info":
      return <InfoOutlinedIcon fontSize="inherit" />;
    case "default":
    default:
      return <HelpOutlineRoundedIcon fontSize="inherit" />;
  }
};

const getIntentClass = (intent: WeaverConfirmIntent = "default") => {
  switch (intent) {
    case "danger":
      return styles.intentDanger;
    case "warning":
      return styles.intentWarning;
    case "info":
      return styles.intentInfo;
    case "default":
    default:
      return styles.intentDefault;
  }
};

const getConfirmButtonColor = (
  intent: WeaverConfirmIntent = "default"
): "error" | "warning" | "info" | "primary" => {
  switch (intent) {
    case "danger":
      return "error";
    case "warning":
      return "warning";
    case "info":
      return "primary";
    case "default":
    default:
      return "primary";
  }
};

export const WeaverConfirmDialog: React.FC<WeaverConfirmDialogProps> = ({
  open,
  title,
  message,
  description,
  intent = "default",
  icon,
  detailsTitle,
  details,
  relatedRecordsTitle,
  relatedRecords,
  relatedContent,
  textConfirmation,
  confirmLabel,
  cancelLabel = "Cancel",
  confirmDisabled = false,
  loading = false,
  closeOnBackdropClick = false,
  closeOnEscape = true,
  maxWidth = "sm",
  fullWidth = true,
  children,
  onConfirm,
  onCancel,
  dialogProps,
}) => {
  // Internal typed confirmation input state
  const [typedValue, setTypedValue] = useState<string>("");

  // Reset typed input whenever a new confirmation session opens
  useEffect(() => {
    if (open) {
      setTypedValue("");
    }
  }, [open]);

  // Evaluate typed confirmation match
  const textMatches = useMemo(() => {
    if (!textConfirmation) return true;

    const expected = textConfirmation.trim
      ? textConfirmation.expectedText.trim()
      : textConfirmation.expectedText;
    const actual = textConfirmation.trim ? typedValue.trim() : typedValue;

    return textConfirmation.caseSensitive === false
      ? actual.toLowerCase() === expected.toLowerCase()
      : actual === expected;
  }, [textConfirmation, typedValue]);

  // Confirm enabled condition
  const canConfirm = !confirmDisabled && !loading && textMatches;

  // Handle Dialog dismiss events (backdrop and Escape)
  const handleDialogClose = (
    _event: object,
    reason: "backdropClick" | "escapeKeyDown"
  ) => {
    if (loading) return;
    if (reason === "backdropClick" && !closeOnBackdropClick) return;
    if (reason === "escapeKeyDown" && !closeOnEscape) return;
    onCancel();
  };

  const handleConfirmClick = () => {
    if (!canConfirm) return;
    onConfirm();
  };

  const handleCancelClick = () => {
    if (loading) return;
    onCancel();
  };

  const titleId = "weaver-confirm-dialog-title";
  const descId = "weaver-confirm-dialog-desc";
  const hasDescription = Boolean(message || description);

  // Effective icon: caller-supplied or fallback intent icon
  const effectiveIcon = icon !== undefined ? icon : getIntentIcon(intent);
  const intentBadgeClass = getIntentClass(intent);
  const confirmColor = getConfirmButtonColor(intent);

  // Related data rendering priority:
  // 1. relatedContent
  // 2. relatedRecords
  // 3. details
  const renderRelatedContext = () => {
    if (relatedContent) {
      return (
        <div className={styles.relatedContentWrapper}>
          {relatedContent}
        </div>
      );
    }

    if (relatedRecords && relatedRecords.length > 0) {
      return (
        <div>
          {relatedRecordsTitle ? (
            <div className={styles.sectionTitle}>{relatedRecordsTitle}</div>
          ) : null}
          <div className={styles.relatedRecordsList} role="list">
            {relatedRecords.map((record, index) => {
              const recordKey = record.id !== undefined ? String(record.id) : `record-${index}`;
              const hasNestedDetails = Array.isArray(record.details) && record.details.length > 0;

              return (
                <div
                  key={recordKey}
                  className={styles.relatedRecordItem}
                  role="listitem"
                >
                  <div className={styles.relatedRecordMain}>
                    <div className={styles.relatedRecordLeft}>
                      {record.icon ? (
                        <div className={styles.relatedRecordIcon}>{record.icon}</div>
                      ) : null}
                      <div className={styles.relatedRecordTitles}>
                        <div className={styles.relatedRecordTitle}>{record.title}</div>
                        {record.subtitle ? (
                          <div className={styles.relatedRecordSubtitle}>
                            {record.subtitle}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {record.status ? (
                      <div className={styles.relatedRecordStatus}>{record.status}</div>
                    ) : null}
                  </div>

                  {hasNestedDetails ? (
                    <div className={styles.relatedRecordNestedDetails}>
                      {record.details!.map((detail, dIdx) => (
                        <div
                          key={`detail-${dIdx}`}
                          className={styles.relatedRecordDetailRow}
                        >
                          <span className={styles.relatedRecordDetailLabel}>
                            {detail.label}:
                          </span>
                          <span className={styles.relatedRecordDetailValue}>
                            {detail.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (details && details.length > 0) {
      return (
        <div>
          {detailsTitle ? (
            <div className={styles.sectionTitle}>{detailsTitle}</div>
          ) : null}
          <div className={styles.detailsContainer}>
            {details.map((detail, index) => (
              <div key={`detail-${index}`} className={styles.detailRow}>
                <span className={styles.detailLabel}>{detail.label}</span>
                <span className={styles.detailValue}>{detail.value}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      aria-labelledby={titleId}
      aria-describedby={hasDescription ? descId : undefined}
      PaperProps={{
        className: styles.paper,
        ...dialogProps?.PaperProps,
      }}
      slotProps={{
        backdrop: {
          className: styles.backdrop,
          ...dialogProps?.slotProps?.backdrop,
        },
      }}
      {...dialogProps}
    >
      {/* Header */}
      <DialogTitle id={titleId} className={styles.header} component="div">
        <div className={styles.titleArea}>
          {effectiveIcon ? (
            <div className={`${styles.iconWrapper} ${intentBadgeClass}`}>
              {effectiveIcon}
            </div>
          ) : null}
          <Typography component="h2" className={styles.titleText}>
            {title}
          </Typography>
        </div>
        <IconButton
          aria-label="Close dialog"
          className={styles.closeButton}
          onClick={handleCancelClick}
          disabled={loading}
          size="small"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      {/* Content Area */}
      <DialogContent className={styles.content}>
        {hasDescription ? (
          <Box id={descId} sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
            {message ? <p className={styles.message}>{message}</p> : null}
            {description ? <p className={styles.description}>{description}</p> : null}
          </Box>
        ) : null}

        {/* Level 1 / 2 / 3 Related Context */}
        {renderRelatedContext()}

        {/* Custom optional children */}
        {children}

        {/* Typed Confirmation Field */}
        {textConfirmation ? (
          <div className={styles.textConfirmationWrapper}>
            <div className={styles.confirmationPrompt}>
              <span>{textConfirmation.label ?? "To confirm, please type "}</span>
              {!textConfirmation.label ? (
                <>
                  <span className={styles.expectedTextBadge}>{textConfirmation.expectedText}</span>
                  <span> below:</span>
                </>
              ) : null}
            </div>
            <WeaverTextField
              placeholder={textConfirmation.placeholder ?? textConfirmation.expectedText}
              helperText={textConfirmation.helperText}
              value={typedValue}
              onChange={(val) => setTypedValue(val)}
              disabled={loading}
              fullWidth
              size="small"
              autoFocus
            />
          </div>
        ) : null}
      </DialogContent>

      {/* Actions */}
      <DialogActions className={styles.actions}>
        <Button
          variant="outlined"
          className={`${styles.actionButton} ${styles.cancelButton}`}
          onClick={handleCancelClick}
          disabled={loading}
          autoFocus={!textConfirmation}
        >
          {cancelLabel}
        </Button>
        {intent === "danger" ? (
          <WeaverButton
            mode="delete"
            variant="contained"
            className={`${styles.actionButton} ${styles.confirmButtonDanger}`}
            onAction={handleConfirmClick}
            disabled={!canConfirm}
            loading={loading}
            holdDuration={textConfirmation ? 800 : 1200}
            holdLabel="Hold to delete..."
          >
            {confirmLabel || "Delete"}
          </WeaverButton>
        ) : (
          <Button
            variant="contained"
            className={`${styles.actionButton} ${
              intent === "warning"
                ? styles.confirmButtonWarning
                : styles.confirmButtonPrimary
            }`}
            onClick={handleConfirmClick}
            disabled={!canConfirm}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {confirmLabel || "Confirm"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
